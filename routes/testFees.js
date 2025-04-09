const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const db = require('../db'); // 데이터베이스 연결 파일

// 테스트 비용 목록을 가져오는 API
router.get('/get-test-fees', verifyToken, async (req, res) => {
  const { dojang_code } = req.user; // 도장 코드 가져오기

  try {
    const query = 'SELECT * FROM test_fee WHERE dojang_code = ?';
    const [rows] = await db.query(query, [dojang_code]);

    if (rows.length === 0) {
      return res.status(404).json({ });
    }

    res.status(200).json(rows); // 데이터베이스에서 가져온 데이터를 반환
  } catch (error) {
    console.error('Error fetching test fees:', error);
    res.status(500).json({});
  }
});

// Test Fee 추가 API
router.post('/add-test-fee', verifyToken, async (req, res) => {
    const { beltMin, beltMax, fee } = req.body;
    const { dojang_code } = req.user; // 도장 코드 가져오기
  
    if (!beltMin || !beltMax || !fee) {
      return res.status(400).json({ message: 'All fields are required' });
    }
  
    try {
      const query = 'INSERT INTO test_fee (belt_min_rank, belt_max_rank, fee, dojang_code) VALUES (?, ?, ?, ?)';
      const values = [beltMin, beltMax, fee, dojang_code];
      await db.query(query, values);
  
      res.status(200).json({ message: 'Test fee added successfully' });
    } catch (error) {
      console.error('Error adding test fee:', error);
      res.status(500).json({ message: 'Failed to add test fee' });
    }
  });
  
// 테스트 비용 업데이트 API
router.put('/update-test-fee/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { beltMin, beltMax, fee } = req.body;
  const { dojang_code } = req.user;

  try {
    const query = `
      UPDATE testing_fees
      SET belt_min_rank = ?, belt_max_rank = ?, fee = ?
      WHERE id = ? AND dojang_code = ?
    `;
    
    await db.query(query, [beltMin, beltMax, fee, id, dojang_code]);
    res.status(200).json({ message: 'Test fee updated successfully' });
  } catch (err) {
    console.error('Error updating test fee:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

  // Test Fee 삭제 API
  router.delete('/delete-test-fee/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { dojang_code } = req.user; // 도장 코드 가져오기
  
    if (!id) {
      return res.status(400).json({ message: 'Test fee ID is required' });
    }
  
    try {
      const query = 'DELETE FROM test_fee WHERE id = ? AND dojang_code = ?';
      const [result] = await db.query(query, [id, dojang_code]);
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Test fee not found' });
      }
  
      res.status(200).json({ message: 'Test fee deleted successfully' });
    } catch (error) {
      console.error('Error deleting test fee:', error);
      res.status(500).json({ message: 'Failed to delete test fee' });
    }
  });

  
  router.get('/get-test-options', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;
  
    try {
      const query = `
        SELECT classname
        FROM class_details 
        WHERE type = 'test' AND dojang_code = ?
      `;
      const [rows] = await db.query(query, [dojang_code]);
  
      res.status(200).json(rows);
    } catch (error) {
      console.error('Error fetching test options:', error);
      res.status(500).json({ message: 'Server error while fetching test options' });
    }
  });
  
  
  
  

module.exports = router;
