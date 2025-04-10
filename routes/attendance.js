const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결
const verifyToken = require('../middleware/verifyToken');
const createNotification = require('../schedulers/createNotification');


router.post('/mark-attendance', verifyToken, async (req, res) => {
  const { classId, students, attendance_date } = req.body;
  const { dojang_code } = req.user;
  
  console.log('Received attendance request:');
  console.log('Class ID:', classId);
  console.log('Students:', students);
  console.log('Attendance Date:', attendance_date);
  console.log('Date type:', typeof attendance_date);
  
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    for (const student of students) {
      const studentId = student.id;

      // 벨트 정보 가져오기
      const [studentData] = await connection.query(
        `SELECT belt_rank, first_name FROM students WHERE id = ?`,
        [studentId]
      );

      if (!studentData || studentData.length === 0) {
        console.warn(`Student ${studentId} not found.`);
        continue;
      }

      const { belt_rank, first_name } = studentData[0];

      // 수업 등록 여부 확인
      const [registeredClasses] = await connection.query(
        `SELECT * FROM student_classes WHERE student_id = ? AND class_id = ? AND dojang_code = ?`,
        [studentId, classId, dojang_code]
      );

      if (registeredClasses.length === 0) {
        console.warn(`Student ${studentId} is not registered for class ${classId}.`);
        continue;
      }

      // 출석 저장
      const attendanceQuery = `
        INSERT INTO attendance (student_id, class_id, dojang_code, attendance_date, belt_rank)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE attendance_date = VALUES(attendance_date), belt_rank = VALUES(belt_rank);
      `;
      await connection.query(attendanceQuery, [studentId, classId, dojang_code, attendance_date, belt_rank]);
      console.log(`✅ Attendance recorded for student ${studentId}`);

      // 🟡 Pay In Full 프로그램인지 확인 후 수업 차감
      const [payInFull] = await connection.query(
        `SELECT * FROM payinfull_payment 
         WHERE student_id = ? AND dojang_code = ? 
         ORDER BY end_date DESC LIMIT 1`,
        [studentId, dojang_code]
      );

      if (payInFull.length > 0 && payInFull[0].remaining_classes > 0) {
        const payment = payInFull[0];
        const newRemaining = payment.remaining_classes - 1;
      
        // 🔔 클래스 기준 알림
        if (newRemaining === 3 && payment.class_notification_3 === 0) {
          await createNotification(dojang_code, `[${first_name}] has 3 classes remaining.`);
          await connection.query(`UPDATE payinfull_payment SET remaining_classes = ?, class_notification_3 = 1 WHERE id = ?`, [newRemaining, payment.id]);
        } else if (newRemaining === 1 && payment.class_notification_1 === 0) {
          await createNotification(dojang_code, `[${first_name}] has only 1 class remaining.`);
          await connection.query(`UPDATE payinfull_payment SET remaining_classes = ?, class_notification_1 = 1 WHERE id = ?`, [newRemaining, payment.id]);
        } else {
          await connection.query(`UPDATE payinfull_payment SET remaining_classes = ? WHERE id = ?`, [newRemaining, payment.id]);
        }

        // 🔔 종료일 기준 알림
        if (daysLeft === 30 && payment.month_notification_1 === 0) {
          await createNotification(dojang_code, `[${first_name}]'s subscription expires in 30 days.`);
          await connection.query(`UPDATE payinfull_payment SET month_notification_1 = 1 WHERE id = ?`, [payment.id]);
        } else if (daysLeft === 14 && payment.week_notification_2 === 0) {
          await createNotification(dojang_code, `[${first_name}]'s subscription expires in 14 days.`);
          await connection.query(`UPDATE payinfull_payment SET week_notification_2 = 1 WHERE id = ?`, [payment.id]);
        } else if (daysLeft === 7 && payment.week_notification_1 === 0) {
          await createNotification(dojang_code, `[${first_name}]'s subscription expires in 7 days.`);
          await connection.query(`UPDATE payinfull_payment SET week_notification_1 = 1 WHERE id = ?`, [payment.id]);
        }
      }
      
    }

    await connection.commit();
    res.status(200).json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error saving attendance:', error);
    res.status(500).json({ success: false, message: 'Server error while saving attendance', error: error.message });
  } finally {
    connection.release();
  }
});


  
// 결석 상태를 저장하는 API
router.post('/mark-absence', verifyToken, async (req, res) => {
  const { classId, students, absence_date } = req.body;
  const { dojang_code } = req.user;
  console.log('🚀 DEBUG: Received Absence Request:', req.body);

  // ✅ 요청 데이터 검증 추가
  if (!classId || !absence_date || !students || students.length === 0) {
    console.error("❌ ERROR: Missing required fields", { classId, students, absence_date });
    return res.status(400).json({ success: false, message: 'Missing required fields', receivedData: req.body });
  }

  try {
    // 1️⃣ 해당 수업이 존재하는지 확인
    const [classDetails] = await db.query(
      `SELECT class_id FROM class_details WHERE class_id = ? AND dojang_code = ?`,
      [classId, dojang_code]
    );

    if (classDetails.length === 0) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // 2️⃣ 이미 출석한 학생을 필터링
    const studentIds = students.map(student => student.id);
    
    const [attendedStudents] = await db.query(
      `SELECT student_id FROM attendance 
       WHERE class_id = ? AND attendance_date = ? AND dojang_code = ?
       AND student_id IN (?)`, 
      [classId, absence_date, dojang_code, studentIds]
    );

    const attendedStudentIds = attendedStudents.map(student => student.student_id);

    // 3️⃣ 출석하지 않은 학생만 필터링
    const absentStudents = students.filter(student => !attendedStudentIds.includes(student.id));

    if (absentStudents.length === 0) {
      console.log("✅ No absent students found. Skipping absence recording.");
      return res.status(200).json({ success: true, message: 'No absences recorded (all students attended)' });
    }

    // 4️⃣ 결석 처리 (배열 한번에 삽입)
    const values = absentStudents.map(student => [student.id, classId, dojang_code, absence_date]);
    
    await db.query(
      `INSERT INTO absences (student_id, class_id, dojang_code, absence_date)
       VALUES ? 
       ON DUPLICATE KEY UPDATE absence_date = VALUES(absence_date)`,
      [values]
    );

    console.log("✅ Absences recorded successfully:", absentStudents);

    res.status(200).json({ success: true, message: 'Absences recorded successfully', absentStudents });
  } catch (error) {
    console.error('❌ ERROR: Failed to record absences:', error);
    res.status(500).json({ success: false, message: 'Failed to record absences' });
  }
});





router.get('/absences', verifyToken, async (req, res) => {
  const { date } = req.query;
  const { dojang_code } = req.user;

  if (!date) {
    return res.status(400).json({ message: 'Date is required' });
  }

  try {
    const query = `
      SELECT 
        a.id,
        s.first_name,
        s.last_name,
        cd.classname,
        cd.time
      FROM 
        absences a
      JOIN 
        students s ON a.student_id = s.id
      JOIN 
        class_details cd ON a.class_id = cd.class_id
      WHERE 
        a.absence_date = ? AND a.dojang_code = ?
    `;

    const [absences] = await db.query(query, [date, dojang_code]);

    console.log('Absences Query Result:', absences); // 디버깅용 로그
    res.status(200).json(absences);
  } catch (error) {
    console.error('Error fetching absences:', error);
    res.status(500).json({ message: 'Failed to fetch absences' });
  }
});

// 요일에 맞는 클래스를 가져오기 위한 API
router.get('/schedule', verifyToken, async (req, res) => {
  const { date } = req.query;
  const { dojang_code } = req.user;
  
  try {
    // 간단하게 요일 매핑
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];
    const dayOfWeek = new Date(date).getDay();
    const dayColumn = days[dayOfWeek];
    
    console.log('Selected day:', dayColumn);
    
    // 도장 코드에 맞는 스케줄에서 요일에 맞는 클래스 불러오기
    const [rows] = await db.query(
      `SELECT time, ${dayColumn} as class_name, '${dayColumn}' as day
       FROM schedule
       WHERE ${dayColumn} IS NOT NULL AND dojang_code = ?`,
       [dojang_code]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});


router.post('/get-class-id', verifyToken, async (req, res) => {
  console.log("Request Body:", req.body);
  const { day, time } = req.body;
  const { dojang_code } = req.user;
  try {
      // ✅ `class_id`와 `class_name`을 함께 가져오기
      const query = `
          SELECT class_id
          FROM class_details 
          WHERE day = ? AND time = ? AND dojang_code = ?
      `;
      const [result] = await db.query(query, [day, time, dojang_code]);

      console.log("Query Result:", result);

      // ✅ 데이터가 있는 경우
      if (result && result.length > 0) {
          res.json({ 
              success: true, 
              class_id: result[0].class_id,
          });
      } else {
          res.status(404).json({ success: false, message: 'Class not found' });
      }
  } catch (error) {
      console.error('❌ Error fetching class_id:', error);
      res.status(500).json({ success: false, message: 'Error fetching class_id' });
  }
});

// 클래스에 등록된 학생 목록 가져오기 (출석/결석 처리되지 않은 학생만)
router.get('/get-students-by-class', verifyToken, async (req, res) => {
  const { classId, date } = req.query;
  const { dojang_code } = req.user;

  try {
    // 해당 날짜에 이미 출석 또는 결석 처리된 학생 ID 가져오기
    const [processedStudents] = await db.query(`
      SELECT DISTINCT student_id 
      FROM (
        SELECT student_id FROM attendance 
        WHERE class_id = ? AND dojang_code = ? AND attendance_date = ?
        UNION
        SELECT student_id FROM absences 
        WHERE class_id = ? AND dojang_code = ? AND absence_date = ?
      ) as processed_students
    `, [classId, dojang_code, date, classId, dojang_code, date]);

    const processedIds = processedStudents.map(s => s.student_id);
    
    // 클래스에 등록된 학생 중 아직 처리되지 않은 학생만 가져오기
    const [students] = await db.query(`
      SELECT DISTINCT s.id, s.first_name, s.last_name, s.belt_rank
      FROM students s
      JOIN student_classes sc ON s.id = sc.student_id
      WHERE sc.class_id = ? 
      AND sc.dojang_code = ?
      AND s.id NOT IN (${processedIds.length > 0 ? processedIds.join(',') : '0'})
      ORDER BY s.first_name
    `, [classId, dojang_code]);

    console.log(`Found ${students.length} unprocessed students for class ${classId} on ${date}`);
    res.json(students);

  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});



  // class_id를 가져오는 API
  router.post('/get-class-id', verifyToken, async (req, res) => {
    console.log("Request Body:", req.body);
    const { day, time } = req.body;
    const { dojang_code } = req.user; // 도장 코드 추출
  
    try {
        // SQL 쿼리 실행
        const query = `
            SELECT class_id 
            FROM class_details 
            WHERE day = ? AND time = ? AND dojang_code = ?
        `;
        const [result] = await db.query(query, [day, time, dojang_code]);
  
        console.log("Query Result:", result);
  
        // 데이터가 있는 경우
        if (result && result.length > 0) {
            res.json({ success: true, class_id: result[0].class_id });
        } else {
            res.status(404).json({ success: false, message: 'Class not found' });
        }
    } catch (error) {
        console.error('Error fetching class_id:', error);
        res.status(500).json({ success: false, message: 'Error fetching class_id' });
    }
  });


module.exports = router;
