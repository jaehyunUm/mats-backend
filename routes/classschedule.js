// routes/scheduleRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 모듈
const verifyToken = require('../middleware/verifyToken');


// 스케줄 데이터를 가져오는 엔드포인트
router.get('/get-schedule', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;; // 미들웨어에서 추출된 도장 코드 사용

  try {
    // ✅ 새 컬럼명을 반영하여 데이터 조회
    const query = `
      SELECT id, time, Mon, Tue, Wed, Thur, Fri, Sat, dojang_code
      FROM schedule
      WHERE dojang_code = ?
    `;

    const [results] = await db.query(query, [dojang_code]);

    if (results.length === 0) {
      return res.status(404).json({ message: 'No schedule found for the dojang.' });
    }

    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching schedule:', err);
    res.status(500).json({ message: 'Error fetching schedule', error: err });
  }
});


// 빈 문자열을 NULL로 변환하는 함수
const nullifyEmpty = (value) => (value === '' ? null : value);
const MAX_RETRIES = 3; // 재시도 횟수 설정

// 스케줄 데이터를 업데이트하는 엔드포인트
router.post('/update-schedule', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;;
  const { schedule, deleteItems = [] } = req.body;
  console.log("Received schedule data for Dojang Code:", dojang_code);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      // ✅ 삭제 항목 처리 (컬럼명 수정)
      if (deleteItems.length > 0) {
        const deleteQuery = 'DELETE FROM schedule WHERE time = ? AND dojang_code = ? AND id = ?';
        for (const item of deleteItems) {
          await connection.query(deleteQuery, [item.time, item.dojang_code, item.id]);
        }
      }

      // ✅ 스케줄 업데이트 (컬럼명 수정)
      const scheduleQuery = `
        UPDATE schedule 
        SET Mon = ?, Tue = ?, Wed = ?, Thur = ?, Fri = ?, Sat = ? 
        WHERE time = ? AND dojang_code = ?
      `;

      for (const row of schedule) {
        const { Mon, Tue, Wed, Thur, Fri, Sat, time } = row;

        const [updateResult] = await connection.query(scheduleQuery, [
          nullifyEmpty(Mon),
          nullifyEmpty(Tue),
          nullifyEmpty(Wed),
          nullifyEmpty(Thur),
          nullifyEmpty(Fri),
          nullifyEmpty(Sat),
          time,
          dojang_code
        ]);

        if (updateResult.affectedRows === 0) {
          // ✅ 새 스케줄 추가 (컬럼명 수정)
          const insertQuery = `
            INSERT INTO schedule (time, Mon, Tue, Wed, Thur, Fri, Sat, dojang_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;
          await connection.query(insertQuery, [
            time,
            nullifyEmpty(Mon),
            nullifyEmpty(Tue),
            nullifyEmpty(Wed),
            nullifyEmpty(Thur),
            nullifyEmpty(Fri),
            nullifyEmpty(Sat),
            dojang_code
          ]);
        }
      }

      await connection.commit();

      res.setHeader("Content-Type", "application/json");
      return res.status(200).json({ message: "Schedule and class details saved successfully" });

    } catch (error) {
      if (error.code === 'ER_LOCK_DEADLOCK' && attempt < MAX_RETRIES - 1) {
        console.warn(`Deadlock detected. Retrying transaction... (Attempt ${attempt + 1})`);
        await connection.rollback();
        continue;
      }
      if (connection) await connection.rollback();
      console.error('Error saving schedule and class details:', error);

      res.setHeader("Content-Type", "application/json");
      return res.status(500).json({ message: "Error saving schedule", error: error.message });
    } finally {
      if (connection) connection.release();
    }
  }
});




// 클래스 목록을 가져오는 엔드포인트 (중복된 클래스 제거)
router.get('/get-classes', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;

  const query = `
      SELECT Mon AS className FROM schedule WHERE Mon <> '' AND dojang_code = ?
      UNION
      SELECT Tue FROM schedule WHERE Tue <> '' AND dojang_code = ?
      UNION
      SELECT Wed FROM schedule WHERE Wed <> '' AND dojang_code = ?
      UNION
      SELECT Thur FROM schedule WHERE Thur <> '' AND dojang_code = ?
      UNION
      SELECT Fri FROM schedule WHERE Fri <> '' AND dojang_code = ?
      UNION
      SELECT Sat FROM schedule WHERE Sat <> '' AND dojang_code = ?;
  `;

  try {
      const [results] = await db.query(query, [dojang_code, dojang_code, dojang_code, dojang_code, dojang_code, dojang_code]);
      const classNames = results.map(row => row.className);
      res.status(200).json(classNames);
  } catch (err) {
      console.error('Error fetching class names from schedule:', err);
      res.status(500).json({ message: 'Database error', error: err });
  }
});


router.get('/student-classes/:studentId', verifyToken, async (req, res) => {
  const { studentId } = req.params;
  const { dojang_code } = req.user; 
  
  try {
      const query = `
          SELECT sc.class_id, cd.classname AS class_name, cd.time, cd.day
          FROM student_classes sc
          JOIN class_details cd ON sc.class_id = cd.class_id
          JOIN students s ON sc.student_id = s.id
          WHERE sc.student_id = ? AND s.dojang_code = ?
      `;
      const [classes] = await db.query(query, [studentId, dojang_code]);

      if (classes.length === 0) {
          return res.status(404).json({ message: 'No classes found for the student in this dojang.' });
      }

      res.status(200).json(classes);
  } catch (error) {
      console.error('Error fetching student classes:', error);
      res.status(500).json({ message: 'Failed to fetch student classes.' });
  }
});




module.exports = router;
