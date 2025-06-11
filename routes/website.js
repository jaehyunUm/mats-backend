const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 파일


// 인증 없이 누구나 접근 가능한 스케줄 API
router.get('/public-get-schedule', async (req, res) => {
    const { dojang_code } = req.query; // 쿼리 파라미터로 받기
  
    try {
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

  router.post('/public-trial-recommend', async (req, res) => {
    const { dojang_code, age, belt_rank } = req.body;
  
    try {
      console.log("Received age:", age);
      console.log("Received belt_rank:", belt_rank);
  
      const numericBeltRank = parseInt(belt_rank, 10);
  
      if (isNaN(numericBeltRank)) {
        return res.status(400).json({ message: 'Invalid belt_rank value' });
      }
  
      const classQuery = `
        SELECT class_name
        FROM classconditions
        WHERE age_min <= ? AND age_max >= ?
        AND belt_min_rank <= ? AND belt_max_rank >= ?
        AND dojang_code = ?
      `;
      const [classConditions] = await db.query(classQuery, [age, age, numericBeltRank, numericBeltRank, dojang_code]);
  
      if (classConditions.length === 0) {
        return res.status(404).json({ message: 'No classes match the given conditions.' });
      }
  
      const classNames = classConditions.map(cls => cls.class_name);
      const classNamesString = classNames.map(name => `'${name}'`).join(",");
  
      const scheduleQuery = `
        SELECT time,
          CASE WHEN Mon IN (${classNamesString}) THEN Mon ELSE '' END AS Mon,
          CASE WHEN Tue IN (${classNamesString}) THEN Tue ELSE '' END AS Tue,
          CASE WHEN Wed IN (${classNamesString}) THEN Wed ELSE '' END AS Wed,
          CASE WHEN Thur IN (${classNamesString}) THEN Thur ELSE '' END AS Thur,
          CASE WHEN Fri IN (${classNamesString}) THEN Fri ELSE '' END AS Fri,
          CASE WHEN Sat IN (${classNamesString}) THEN Sat ELSE '' END AS Sat
        FROM schedule
        WHERE dojang_code = ?
        AND (
          Mon IN (${classNamesString}) OR
          Tue IN (${classNamesString}) OR
          Wed IN (${classNamesString}) OR
          Thur IN (${classNamesString}) OR
          Fri IN (${classNamesString}) OR
          Sat IN (${classNamesString})
        );
      `;
      const [schedule] = await db.query(scheduleQuery, [dojang_code]);
  
      if (schedule.length === 0) {
        return res.status(404).json({ message: 'No schedule found for the selected classes.' });
      }
  
      res.json({ schedule });
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });
  module.exports = router;