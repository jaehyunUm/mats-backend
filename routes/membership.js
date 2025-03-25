const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const db = require('../db');

// 자녀 정보 API
router.get('/membership-info', verifyToken, async (req, res) => {
  const parentId = req.query.parent_id;
  const { dojang_code } = req.user;

  if (!parentId) {
    return res.status(400).json({ message: 'Parent ID가 제공되지 않았습니다.' });
  }

  try {
    const [rows] = await db.query(
      `SELECT 
          s.first_name, 
          s.last_name, 
          p.name AS program_name, 
          p.price AS program_price
       FROM 
          students s
       JOIN 
          programs p 
       ON 
          s.program_id = p.id
       WHERE 
          s.parent_id = ? AND s.dojang_code = ?`,
      [parentId, dojang_code]
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error('자녀 정보 조회 오류:', error);
    res.status(500).json({ message: '자녀 정보 조회 중 오류가 발생했습니다.' });
  }
});

  
  module.exports = router;