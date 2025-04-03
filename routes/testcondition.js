const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const db = require('../db'); // DB 모듈 확인

// ✅ 백엔드 수정 - Add Testing Condition
router.post('/add-testing-condition', verifyToken, async (req, res) => {
  const { minBelt, maxBelt, attendanceRequired, testType } = req.body;
  const { dojang_code } = req.user;

  try {
    await db.execute(
      'INSERT INTO testcondition (belt_min_rank, belt_max_rank, attendance_required, dojang_code, test_type) VALUES (?, ?, ?, ?, ?)',
      [minBelt || null, maxBelt || null, attendanceRequired || null, dojang_code, testType || null]
    );

    res.status(201).json({ message: 'Condition added successfully!' });
  } catch (error) {
    console.error('Error adding condition:', error);
    res.status(500).json({ message: 'Failed to add condition' });
  }
});

// ✅ 백엔드 수정 - Edit Testing Condition
router.put('/edit-testing-condition/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { minBelt, maxBelt, attendanceRequired, testType } = req.body;
  const { dojang_code } = req.user;

  try {
    const [result] = await db.execute(
      'UPDATE testcondition SET belt_min_rank = ?, belt_max_rank = ?, attendance_required = ?, test_type = ? WHERE id = ? AND dojang_code = ?',
      [minBelt || null, maxBelt || null, attendanceRequired || null, testType || null, id, dojang_code]
    );

    if (result.affectedRows > 0) {
      res.json({ message: 'Condition updated successfully!' });
    } else {
      res.status(404).json({ message: 'Condition not found' });
    }
  } catch (error) {
    console.error('Error updating condition:', error);
    res.status(500).json({ message: 'Failed to update condition' });
  }
});
  
// 4. 조건 삭제 API
router.delete('/delete-testing-condition/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { dojang_code } = req.user;

  try {
    const [result] = await db.execute('DELETE FROM testcondition WHERE id = ? AND dojang_code = ?', [id, dojang_code]);

    if (result.affectedRows > 0) {
      res.json({ message: 'Condition deleted successfully!' });
    } else {
      res.status(404).json({ message: 'Condition not found' });
    }
  } catch (error) {
    console.error('Error deleting condition:', error);
    res.status(500).json({ message: 'Failed to delete condition' });
  }
});

router.get('/get-testing-conditions', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;
  
    try {
      const [rows] = await db.execute(
        'SELECT * FROM testcondition WHERE dojang_code = ?', 
        [dojang_code]
      );
      res.status(200).json(rows); // 조건 데이터를 클라이언트로 전송
    } catch (error) {
      console.error('Error fetching conditions:', error);
      res.status(500).json({ message: 'Failed to fetch testing conditions' });
    }
  });

module.exports = router;
