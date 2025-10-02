const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const { upload } = require('../index'); // index.js에서 export한 upload 객체
const { uploadFileToS3, deleteFileFromS3 } = require('../modules/s3Service');

// 1. 특정 학생의 목표 이미지 업로드 API
// POST /api/students/:studentId/goals
router.post('/students/:studentId/goals', verifyToken, upload.single('image'), async (req, res) => {
    const { studentId } = req.params;
    const { dojang_code } = req.user;

    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Image file is required.' });
    }

    try {
        const timestamp = Date.now();
        const originalname = req.file.originalname;
        const fileExtension = path.extname(originalname); // 파일 확장자 추출
        const uniqueFileName = `goals/goal_${studentId}_${timestamp}${fileExtension}`;

        // S3에 파일 업로드
        const imageUrl = await uploadFileToS3(uniqueFileName, req.file.buffer, dojang_code);

        // DB에 S3 URL 저장
        const query = 'INSERT INTO goals (student_id, image_url) VALUES (?, ?)';
        await db.query(query, [studentId, imageUrl]);
        
        res.status(201).json({ 
            success: true, 
            message: 'Goal image uploaded successfully.', 
            imageUrl: imageUrl 
        });

    } catch (error) {
        console.error('❌ Error uploading goal image:', error);
        res.status(500).json({ success: false, message: 'Server error occurred.' });
    }
});

// 2. 특정 학생의 연도별 목표 이미지 조회 API
// GET /api/students/:studentId/goals?year=2025
router.get('/students/:studentId/goals', verifyToken, async (req, res) => {
    const { studentId } = req.params;
    const { year } = req.query;
    
    if (!year) {
        return res.status(400).json({ success: false, message: 'Year is required.' });
    }

    try {
        const query = `
            SELECT id, image_url, created_at 
            FROM goals 
            WHERE student_id = ? AND YEAR(created_at) = ? 
            ORDER BY created_at ASC
        `;
        const [goals] = await db.query(query, [studentId, year]);
        
        res.status(200).json({ success: true, data: goals });

    } catch (error) {
        console.error('❌ Error fetching goals:', error);
        res.status(500).json({ success: false, message: 'Server error occurred.' });
    }
});

// 3. 목표 이미지 삭제 API
// DELETE /api/goals/:goalId
router.delete('/goals/:goalId', verifyToken, async (req, res) => {
    const { goalId } = req.params;
    const { dojang_code } = req.user;

    try {
        // 1. DB에서 goal 정보 조회
        const [goalRows] = await db.query('SELECT image_url FROM goals WHERE id = ?', [goalId]);
        
        if (goalRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Goal record not found.' });
        }
        
        const { image_url } = goalRows[0];
        
        // 2. S3에서 이미지 파일 삭제
        if (image_url) {
            // S3 URL에서 파일 키(경로+이름) 추출
            const fileKeyWithFolder = image_url.split(`uploads/${dojang_code}/`)[1];
            if (fileKeyWithFolder) {
                await deleteFileFromS3(fileKeyWithFolder, dojang_code);
            }
        }

        // 3. 데이터베이스에서 goal 기록 삭제
        await db.query('DELETE FROM goals WHERE id = ?', [goalId]);

        res.status(200).json({ success: true, message: 'Goal record deleted successfully.' });

    } catch (error) {
        console.error('❌ Error deleting goal:', error);
        res.status(500).json({ success: false, message: 'Server error occurred.' });
    }
});

module.exports = router;