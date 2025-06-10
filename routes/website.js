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