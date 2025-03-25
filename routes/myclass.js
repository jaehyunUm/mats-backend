// myclass.js

const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 가져오기
const verifyToken = require('../middleware/verifyToken');


// student_classes 테이블 업데이트 API
router.post('/update-student-classes', verifyToken, async (req, res) => {
    const { student_id, selectedClasses } = req.body;
    const { dojang_code } = req.user;
  
    try {
        // 기존 클래스 삭제
        await db.query('DELETE FROM student_classes WHERE student_id = ?', [student_id]);
  
        // 새로운 클래스 추가
        const insertQuery = 'INSERT INTO student_classes (student_id, class_id, dojang_code) VALUES (?, ?, ?)';
        for (const classId of selectedClasses) {
            await db.query(insertQuery, [student_id, classId, dojang_code]);
        }
  
        console.log("✅ Classes updated successfully for student:", student_id);
        return res.status(200).json({ success: true, message: "Classes updated successfully." });
  
    } catch (error) {
        console.error('❌ Error updating student classes:', error);
        return res.status(500).json({ success: false, message: 'Failed to update classes.' });
    }
  });
  



  

module.exports = router;
