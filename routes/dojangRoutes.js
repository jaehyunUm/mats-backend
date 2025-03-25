// routes/dojangRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 가져오기
const verifyToken = require('../middleware/verifyToken');

// 도장코드 목록 불러오기
router.get('/dojangs', async (req, res) => {
    const query = `SELECT dojang_code, dojang_name FROM Dojangs`;

    try {
        const [results] = await db.query(query);
        console.log('Query results:', results); // 쿼리 결과 출력
        res.status(200).json(results); // 성공적으로 결과 반환
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ message: 'Database error', error: err });
    }
});

// 도장 이름 수정 API
router.put('/dojang/update-dojang-name', verifyToken, async (req, res) => {
    const { dojang_code } = req.user; // 오너 토큰에서 도장코드 추출
    const { dojang_name } = req.body;
  
    if (!dojang_name) {
      return res.status(400).json({ message: 'Dojang name is required.' });
    }
  
    try {
      // 중복 도장 이름 체크 (자기 도장은 제외)
      const [existing] = await db.query(
        'SELECT id FROM dojangs WHERE dojang_name = ? AND dojang_code != ?',
        [dojang_name, dojang_code]
      );
  
      if (existing.length > 0) {
        return res.status(409).json({ message: 'Dojang name already exists.' });
      }
  
      // 도장 이름 업데이트
      await db.query(
        'UPDATE dojangs SET dojang_name = ? WHERE dojang_code = ?',
        [dojang_name, dojang_code]
      );
  
      res.status(200).json({ message: 'Dojang name updated successfully.' });
    } catch (error) {
      console.error('Error updating dojang name:', error);
      res.status(500).json({ message: 'Failed to update dojang name.' });
    }
  });
  
  router.get('/dojang/my-dojang', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;
  
    try {
      const [result] = await db.query(
        'SELECT dojang_name FROM dojangs WHERE dojang_code = ?',
        [dojang_code]
      );
  
      if (result.length === 0) {
        return res.status(404).json({ message: 'Dojang not found.' });
      }
  
      res.status(200).json(result[0]);
    } catch (error) {
      console.error('Error fetching dojang name:', error);
      res.status(500).json({ message: 'Failed to load dojang name.' });
    }
  });

module.exports = router;
