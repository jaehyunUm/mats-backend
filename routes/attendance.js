const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결
const verifyToken = require('../middleware/verifyToken');
const createNotification = require('../schedulers/createNotification');


router.post('/mark-attendance', verifyToken, async (req, res) => {
  const { classId, students, attendance_date } = req.body;
  const { dojang_code } = req.user;

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    for (const student of students) {
      const studentId = student.id;

      // 1. 벨트 정보 가져오기
      const [studentData] = await connection.query(
        `SELECT belt_rank, first_name FROM students WHERE id = ?`,
        [studentId]
      );

      if (!studentData.length) continue;

      const { belt_rank, first_name } = studentData[0];

      // 2. 수업 등록 여부 확인
      const [registeredClasses] = await connection.query(
        `SELECT * FROM student_classes WHERE student_id = ? AND class_id = ? AND dojang_code = ?`,
        [studentId, classId, dojang_code]
      );

      if (registeredClasses.length === 0) continue;

      // 3. 출석 저장
      await connection.query(
        `INSERT INTO attendance (student_id, class_id, dojang_code, attendance_date, belt_rank)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE attendance_date = VALUES(attendance_date), belt_rank = VALUES(belt_rank)`,
        [studentId, classId, dojang_code, attendance_date, belt_rank]
      );

      // 4. 연속 결석 초기화
      await connection.query(
        `UPDATE students
         SET consecutive_absences = 0
         WHERE id = ? AND dojang_code = ?`,
        [studentId, dojang_code]
      );

      // 5. Pay In Full 프로그램 수업 차감
      const [payInFull] = await connection.query(
        `SELECT * FROM payinfull_payment 
         WHERE student_id = ? AND dojang_code = ? 
         ORDER BY end_date DESC LIMIT 1`,
        [studentId, dojang_code]
      );

      

      if (payInFull.length > 0 && payInFull[0].remaining_classes > 0) {
        const payment = payInFull[0];
        const newRemaining = payment.remaining_classes - 1;
        const today = new Date();
        const endDate = new Date(payment.end_date);
        const timeDiff = endDate.getTime() - today.getTime();
        const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        // 클래스 기준 알림
        if (newRemaining === 3 && payment.class_notification_3 === 0) {
          await createNotification(dojang_code, `[${first_name}] has 3 classes remaining.`);
          await connection.query(`UPDATE payinfull_payment SET remaining_classes = ?, class_notification_3 = 1 WHERE id = ?`, [newRemaining, payment.id]);
        } else if (newRemaining === 1 && payment.class_notification_1 === 0) {
          await createNotification(dojang_code, `[${first_name}] has only 1 class remaining.`);
          await connection.query(`UPDATE payinfull_payment SET remaining_classes = ?, class_notification_1 = 1 WHERE id = ?`, [newRemaining, payment.id]);
        } else {
          await connection.query(`UPDATE payinfull_payment SET remaining_classes = ? WHERE id = ?`, [newRemaining, payment.id]);
        }

        // 만료일 기준 알림
        if (daysLeft === 30 && payment.month_notification_1 === 0) {
          await createNotification(dojang_code, `[${first_name}]'s membership expires in 30 days.`);
          await connection.query(`UPDATE payinfull_payment SET month_notification_1 = 1 WHERE id = ?`, [payment.id]);
        } else if (daysLeft === 14 && payment.week_notification_2 === 0) {
          await createNotification(dojang_code, `[${first_name}]'s membership expires in 14 days.`);
          await connection.query(`UPDATE payinfull_payment SET week_notification_2 = 1 WHERE id = ?`, [payment.id]);
        } else if (daysLeft === 7 && payment.week_notification_1 === 0) {
          await createNotification(dojang_code, `[${first_name}]'s membership expires in 7 days.`);
          await connection.query(`UPDATE payinfull_payment SET week_notification_1 = 1 WHERE id = ?`, [payment.id]);
        }
      }

      // 6. 💵 현금 결제(Cash) 다가오는 결제일 알림 (3일 전)
      const [monthlyPayments] = await connection.query(
        `SELECT * FROM monthly_payments 
         WHERE student_id = ? AND dojang_code = ? 
         ORDER BY id DESC LIMIT 1`,
        [studentId, dojang_code]
      );

      if (monthlyPayments.length > 0) {
        const mPayment = monthlyPayments[0];
        
        // 현금 결제 대상자(source_id가 'cash')이면서, 다음 결제일이 있는 경우
        if (mPayment.source_id === 'cash' && mPayment.next_payment_date) {
          const today = new Date();
          const nextDate = new Date(mPayment.next_payment_date);
          
          // 날짜 차이 계산
          const timeDiff = nextDate.getTime() - today.getTime();
          const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

          // 결제일이 3일 이하로 남았고(0~3일), 이번 달에 아직 알림을 안 보낸 경우
          if (daysLeft <= 3 && daysLeft >= 0 && mPayment.day_notification_3 === 0) {
            
            // ⭐️ 알림 생성 (앱에서 이 알림을 누르면 학생 프로필로 가게 만들 수 있습니다)
            await createNotification(
              dojang_code, 
              `💵 [${first_name}]'s cash payment is due in ${daysLeft} days. (Next: ${mPayment.next_payment_date.toISOString().split('T')[0]})`
            );
            
            // 알림 발송 완료 처리 (중복 방지)
            await connection.query(
              `UPDATE monthly_payments SET day_notification_3 = 1 WHERE id = ?`, 
              [mPayment.id]
            );
          }
        }
      }
    }

    

    await connection.commit();
    res.status(200).json({ success: true, message: 'Attendance recorded successfully' });
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

    for (const absentStudent of absentStudents) {
      const studentId = absentStudent.id;
    
      // 1. 학생의 연속 결석 수 증가
      await db.query(`
        UPDATE students
        SET consecutive_absences = consecutive_absences + 1
        WHERE id = ? AND dojang_code = ?
      `, [studentId, dojang_code]);
    
      // 2. 학생의 현재 연속 결석 수 조회
      const [studentResult] = await db.query(`
        SELECT first_name, last_name, consecutive_absences
        FROM students
        WHERE id = ? AND dojang_code = ?
      `, [studentId, dojang_code]);
    
      const student = studentResult[0];
    
      // 3. 연속 결석 2번 이상이면 알림 생성
      if (student.consecutive_absences >= 2) {
        const message = `Student ${student.first_name} ${student.last_name} has been absent for ${student.consecutive_absences} consecutive classes.`;
    
        await db.query(`
          INSERT INTO notifications (dojang_code, message)
          VALUES (?, ?)
        `, [dojang_code, message]);
      }
    }

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
    // 먼저 absences 테이블만 확인
    const [absencesOnly] = await db.query(`
      SELECT * FROM absences 
      WHERE absence_date = ? AND dojang_code = ?
    `, [date, dojang_code]);
    
    console.log('Absences only:', absencesOnly);

    // 데이터 무결성 검사
    if (absencesOnly.length > 0) {
      const studentIds = [...new Set(absencesOnly.map(a => a.student_id))];
      const classIds = [...new Set(absencesOnly.map(a => a.class_id))];
      
      console.log('Student IDs in absences:', studentIds);
      console.log('Class IDs in absences:', classIds);
      
      // students 테이블 확인
      const [students] = await db.query(`
        SELECT id, first_name, last_name FROM students 
        WHERE id IN (${studentIds.map(() => '?').join(',')}) AND dojang_code = ?
      `, [...studentIds, dojang_code]);
      console.log('Found students:', students);
      
      // class_details 테이블 확인
      const [classes] = await db.query(`
        SELECT class_id, classname, time FROM class_details 
        WHERE class_id IN (${classIds.map(() => '?').join(',')}) AND dojang_code = ?
      `, [...classIds, dojang_code]);
      console.log('Found classes:', classes);
    }

    // 전체 JOIN 쿼리
    const query = `
      SELECT 
        a.id,
        COALESCE(s.first_name, 'Unknown') as first_name,
        COALESCE(s.last_name, 'Student') as last_name,
        COALESCE(cd.classname, 'Unknown Class') as classname,
        COALESCE(cd.time, 'Unknown Time') as time
      FROM 
        absences a
      LEFT JOIN 
        students s ON a.student_id = s.id
      LEFT JOIN 
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

router.get('/schedule', verifyToken, async (req, res) => {
  const { date } = req.query;
  const { dojang_code } = req.user;
  
  try {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];
    // date가 유효하지 않을 경우를 대비한 방어 코드
    const dateObj = new Date(date);
    if (isNaN(dateObj)) {
        return res.status(400).json({ error: 'Invalid date format' });
    }

    const dayOfWeek = dateObj.getDay();
    const dayColumn = days[dayOfWeek];
    
    console.log('Selected day:', dayColumn);
    
    // ⭐️ 수정된 부분: Test나 Promotion이 포함된 경우 제외 (AND NOT LIKE 사용)
    // sort_order가 있다면 정렬해서 보내주는 것이 좋습니다.
    const query = `
      SELECT time, ${dayColumn} as class_name, '${dayColumn}' as day
      FROM schedule
      WHERE ${dayColumn} IS NOT NULL 
        AND dojang_code = ?
        AND ${dayColumn} NOT LIKE '%Test%'       -- 'Test'가 포함된 수업 제외
        AND ${dayColumn} NOT LIKE '%Promotion%'  -- 'Promotion'이 포함된 수업 제외
      ORDER BY sort_order ASC                    -- 시간 순서대로 정렬 (옵션)
    `;

    const [rows] = await db.query(query, [dojang_code]);
    
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


router.get('/student-absences/:studentId', verifyToken, async (req, res) => {
  const { studentId } = req.params;
  const { dojang_code } = req.user;

  if (!studentId) {
    return res.status(400).json({ message: 'Student ID is required' });
  }

  try {
    const query = `
      SELECT 
        a.id,
        a.absence_date,
        cd.classname,
        cd.time
      FROM 
        absences a
      LEFT JOIN 
        class_details cd ON a.class_id = cd.class_id
      WHERE 
        a.student_id = ? AND a.dojang_code = ?
      ORDER BY 
        a.absence_date DESC
    `;

    const [absences] = await db.query(query, [studentId, dojang_code]);

    console.log('Student Absences Query Result:', absences);
    res.status(200).json(absences);
  } catch (error) {
    console.error('Error fetching student absences:', error);
    res.status(500).json({ message: 'Failed to fetch student absences' });
  }
});


module.exports = router;
