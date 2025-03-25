const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const db = require('../db'); // DB 모듈 확인

// 조건 추가 API
router.post('/add-testing-condition', verifyToken, async (req, res) => {
    const { Belt, attendanceRequired, testType } = req.body;
    const { dojang_code } = req.user;
  
    // undefined를 null로 처리
    const minBeltValue = Belt !== undefined ? Belt : null;
    const attendanceRequiredValue = attendanceRequired !== undefined ? attendanceRequired : null;
    const testTypeValue = testType !== undefined ? testType : null;
  
    // 데이터 확인용 로그
    console.log("Received data for adding condition:", { Belt, attendanceRequired, testType });
  
    try {
      // 삽입 전 디버깅 메시지 출력
      console.log("Inserting with values:", {
        Belt: minBeltValue,
        attendanceRequired: attendanceRequiredValue,
        testType: testTypeValue,
        dojang_code,
      });
  
      await db.execute(
        'INSERT INTO testcondition (belt_rank, attendance_required, dojang_code, test_type) VALUES (?, ?, ?, ?)',
        [minBeltValue, attendanceRequiredValue, dojang_code, testTypeValue]
      );
  
      res.status(201).json({ message: 'Condition added successfully!' });
    } catch (error) {
      console.error('Error adding condition:', error);
      res.status(500).json({ message: 'Failed to add condition' });
    }
  });


// 2. 조건 추가 API
router.post('/add-testing-condition', verifyToken, async (req, res) => {
    const { Belt, attendanceRequired, testType } = req.body;
    const { dojang_code } = req.user;
  
    try {
      await db.execute(
        'INSERT INTO testcondition (belt_rank, attendance_required, dojang_code, test_type) VALUES (?, ?, ?, ?)',
        [Belt, attendanceRequired, dojang_code, testType]
      );
      res.status(201).json({ message: 'Condition added successfully!' });
    } catch (error) {
      console.error('Error adding condition:', error);
      res.status(500).json({ message: 'Failed to add condition' });
    }
  });

  // 조건 업데이트 API
router.put('/edit-testing-condition/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { Belt, attendanceRequired, testType } = req.body;
    const { dojang_code } = req.user;
  
    // undefined를 null로 처리
    const minBeltValue = Belt !== undefined ? Belt : null;
    const attendanceRequiredValue = attendanceRequired !== undefined ? attendanceRequired : null;
    const testTypeValue = testType !== undefined ? testType : null;
  
    console.log("Received data for adding condition:", { Belt, attendanceRequired, testType }); // 데이터 확인용 로그


    try {
      // 업데이트 전 디버깅 메시지 출력
      console.log("Updating with values:", {
        Belt: minBeltValue,
        attendanceRequired: attendanceRequiredValue,
        testType: testTypeValue,
        id,
        dojang_code,
      });
  
      const [result] = await db.execute(
        'UPDATE testcondition SET belt_rank = ?, attendance_required = ?, test_type = ? WHERE id = ? AND dojang_code = ?',
        [minBeltValue, attendanceRequiredValue, testTypeValue, id, dojang_code]
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
