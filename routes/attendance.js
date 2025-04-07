const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결
const verifyToken = require('../middleware/verifyToken');

// 출석 상태를 저장하는 API
router.post('/mark-attendance', verifyToken, async (req, res) => {
  const { classId, students, attendance_date } = req.body;
  const { dojang_code } = req.user;
  try {
    for (const student of students) {
      // 학생의 현재 벨트 랭크 가져오기
      const [studentData] = await db.query(
        `SELECT belt_rank FROM students WHERE id = ?`,
        [student.id]
      );

      if (!studentData || studentData.length === 0) {
        console.warn(`Student ${student.id} not found.`);
        continue; // 학생이 존재하지 않으면 건너뜀
      }

      const belt_rank = studentData[0].belt_rank; // 현재 벨트 랭크

      // 학생이 해당 클래스에 등록되어 있는지 확인
      const [registeredClasses] = await db.query(
        `SELECT * FROM student_classes WHERE student_id = ? AND class_id = ? AND dojang_code = ?`, 
        [student.id, classId, dojang_code]
      );

      if (registeredClasses.length > 0) {
        // 등록된 경우에만 출석 처리 (belt_rank 포함)
        const query = `
          INSERT INTO attendance (student_id, class_id, dojang_code, attendance_date, belt_rank)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE attendance_date = VALUES(attendance_date), belt_rank = VALUES(belt_rank);
        `;
        await db.query(query, [student.id, classId, dojang_code, attendance_date, belt_rank]);
        console.log(`Attendance recorded for student_id: ${student.id}, class_id: ${classId}, belt_rank: ${belt_rank}`);
      } else {
        console.warn(`Student ${student.id} is not registered for class ${classId}. Attendance not recorded.`);
      }
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving attendance:', error);
    res.status(500).json({ success: false, message: 'Server error while saving attendance', error: error.message });
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
    const dayOfWeek = new Date(date).getDay();
    let dayColumn = '';

    switch (dayOfWeek) {
      case 1 :  // 일요일
        dayColumn = 'Sun';
        break;
      case 2:  // 월요일
        dayColumn = 'Mon';
        break;
      case 3:  // 화요일
        dayColumn = 'Tue';
        break;
      case 4:  // 수요일
        dayColumn = 'Wed';
        break;
      case 5:  // 목요일
        dayColumn = 'Thur';
        break;
      case 6:  // 금요일
        dayColumn = 'Fri';
        break;
      case 7:  // 토요일
        dayColumn = 'Sat';
        break;
    }
    

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

router.get('/get-students-by-class', verifyToken, async (req, res) => {
  const { classId, date } = req.query;
  const { dojang_code } = req.user;
  const attendanceDate = date || new Date().toISOString().split('T')[0];
  
  if (!classId) {
    return res.status(400).json({ message: 'classId is required' });
  }
  
  try {
    const [students] = await db.query(
      `
      SELECT s.id, s.first_name, s.last_name, s.belt_rank, s.birth_date
      FROM student_classes sc
      JOIN students s ON sc.student_id = s.id
      WHERE sc.class_id = ? 
        AND sc.dojang_code = ?
        AND NOT EXISTS (
          SELECT 1 FROM attendance a 
          WHERE a.student_id = sc.student_id 
            AND a.class_id = sc.class_id 
            AND DATE(a.attendance_date) = DATE(?)
            AND a.dojang_code = ?
        )
        AND NOT EXISTS (
          SELECT 1 FROM absences ab 
          WHERE ab.student_id = sc.student_id 
            AND ab.class_id = sc.class_id 
            AND DATE(ab.absence_date) = DATE(?)
            AND ab.dojang_code = ?
        )
      `,
      [classId, dojang_code, attendanceDate, dojang_code, attendanceDate, dojang_code]
    );
    
    res.status(200).json(students);
  } catch (error) {
    console.error('❌ Error fetching students:', error);
    res.status(500).json({ message: 'Server error while fetching students' });
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
