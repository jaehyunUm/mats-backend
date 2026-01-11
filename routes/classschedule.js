// routes/scheduleRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 모듈
const verifyToken = require('../middleware/verifyToken');


router.get('/get-schedule', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;

  try {
    // 1️⃣ 기존 스케줄 틀(표) 가져오기
    const scheduleQuery = `
      SELECT id, time, Mon, Tue, Wed, Thur, Fri, Sat, dojang_code, sort_order
      FROM schedule
      WHERE dojang_code = ?
      ORDER BY 
        sort_order ASC,
        STR_TO_DATE(SUBSTRING_INDEX(time, '~', 1), '%H:%i') ASC,
        id ASC
    `;
    const [scheduleRows] = await db.query(scheduleQuery, [dojang_code]);

    // 2️⃣ 각 수업별 등록된 학생 수 카운트하기
    // class_details(요일/시간)와 student_classes(학생등록)를 조인하여 카운트
    const countQuery = `
      SELECT cd.day, cd.time, COUNT(sc.student_id) as student_count
      FROM class_details cd
      LEFT JOIN student_classes sc ON cd.class_id = sc.class_id
      WHERE cd.dojang_code = ?
      GROUP BY cd.class_id, cd.day, cd.time
    `;
    const [counts] = await db.query(countQuery, [dojang_code]);

    // 3️⃣ 카운트 데이터를 검색하기 쉽게 맵(Map)으로 변환
    // Key: "요일_시간" (예: "Mon_4:00~4:40") -> Value: 5 (명)
    const countMap = {};
    counts.forEach(row => {
      const key = `${row.day}_${row.time}`;
      countMap[key] = row.student_count;
    });

    // 4️⃣ 스케줄 데이터에 학생 수(Count) 붙이기
    const days = ['Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];
    
    const finalData = scheduleRows.map(row => {
      const newRow = { ...row }; // 원본 객체 복사

      days.forEach(day => {
        const className = newRow[day]; // 예: "Level 1"
        
        // 클래스 이름이 존재할 때만 카운트 표시
        if (className && className.trim() !== '') {
          const key = `${day}_${row.time}`; // 매핑 키 생성
          const count = countMap[key] || 0; // 학생 수 (없으면 0)

          // ⭐️ 학생 수가 0명 이상일 때만 뒤에 (N) 붙이기
          if (count > 0) {
            newRow[day] = `${className} (${count})`; 
          }
        }
      });

      return newRow;
    });

    return res.status(200).json(finalData || []);

  } catch (err) {
    console.error('Error fetching schedule:', err);
    return res.status(500).json({ message: 'Error fetching schedule' });
  }
});

// 빈 문자열을 NULL로 변환하는 함수
const nullifyEmpty = (value) => (value === '' ? null : value);
const MAX_RETRIES = 3; // 재시도 횟수 설정

router.post('/update-schedule', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;
  const { schedule, deleteItems = [] } = req.body;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      // ✅ 삭제: id 기반
      if (deleteItems.length > 0) {
        const deleteQuery = 'DELETE FROM schedule WHERE id = ? AND dojang_code = ?';
        for (const item of deleteItems) {
          await connection.query(deleteQuery, [item.id, dojang_code]);
        }
      }

      // ✅ 업데이트/삽입: id 기준 + sort_order 저장
      const updateSql = `
        UPDATE schedule
        SET Mon=?, Tue=?, Wed=?, Thur=?, Fri=?, Sat=?, time=?, sort_order=?
        WHERE id=? AND dojang_code=?
      `;
      const insertSql = `
        INSERT INTO schedule (time, Mon, Tue, Wed, Thur, Fri, Sat, dojang_code, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      for (const row of schedule) {
        const { id, Mon, Tue, Wed, Thur, Fri, Sat, time, sort_order } = row;

        if (id) {
          const [r] = await connection.query(updateSql, [
            nullifyEmpty(Mon), nullifyEmpty(Tue), nullifyEmpty(Wed),
            nullifyEmpty(Thur), nullifyEmpty(Fri), nullifyEmpty(Sat),
            time, (typeof sort_order === 'number' ? sort_order : 0),
            id, dojang_code,
          ]);

          if (r.affectedRows === 0) {
            await connection.query(insertSql, [
              time,
              nullifyEmpty(Mon), nullifyEmpty(Tue), nullifyEmpty(Wed),
              nullifyEmpty(Thur), nullifyEmpty(Fri), nullifyEmpty(Sat),
              dojang_code, (typeof sort_order === 'number' ? sort_order : 0),
            ]);
          }
        } else {
          await connection.query(insertSql, [
            time,
            nullifyEmpty(Mon), nullifyEmpty(Tue), nullifyEmpty(Wed),
            nullifyEmpty(Thur), nullifyEmpty(Fri), nullifyEmpty(Sat),
            dojang_code, (typeof sort_order === 'number' ? sort_order : 0),
          ]);
        }
      }

      await connection.commit();
      return res.status(200).json({ message: "Schedule saved successfully" });

    } catch (error) {
      if (error.code === 'ER_LOCK_DEADLOCK' && attempt < MAX_RETRIES - 1) {
        if (connection) await connection.rollback();
        continue;
      }
      if (connection) await connection.rollback();
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
