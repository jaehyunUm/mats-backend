// routes/scheduleRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 모듈
const verifyToken = require('../middleware/verifyToken');


// 스케줄 데이터를 가져오는 엔드포인트
router.get('/get-schedule', verifyToken, async (req, res) => {
  const { dojang_code } = req.user; // 세미콜론 하나만

  try {
    // ✅ sort_order까지 조회 + 정렬
    //   보조 정렬로 시작시각을 파싱해(문자열 정렬 문제 방지) 그리고 id로 최종 안정화
    const query = `
      SELECT id, time, Mon, Tue, Wed, Thur, Fri, Sat, dojang_code, sort_order
      FROM schedule
      WHERE dojang_code = ?
      ORDER BY 
        sort_order ASC,
        STR_TO_DATE(SUBSTRING_INDEX(time, '~', 1), '%H:%i') ASC,
        id ASC
    `;

    const [results] = await db.query(query, [dojang_code]);

    // ✅ 빈 배열을 200으로 반환 (프론트 단에서 404 처리 번거로움 방지)
    return res.status(200).json(results || []);
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
