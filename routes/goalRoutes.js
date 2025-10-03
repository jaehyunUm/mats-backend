const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const { upload } = require('../index');
const { uploadFileToS3, deleteFileFromS3 } = require('../modules/s3Service');

// 1. 목표 이미지 업로드 API (수정됨)
router.post('/students/:studentId/goals', verifyToken, upload.single('image'), async (req, res) => {
    const { studentId } = req.params;
    const { dojang_code } = req.user;

    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Image file is required.' });
    }

    try {
        const timestamp = Date.now();
        const originalname = req.file.originalname;
        const fileExtension = path.extname(originalname);
        const uniqueFileName = `goals/goal_${studentId}_${timestamp}${fileExtension}`;
        
        const imageUrl = await uploadFileToS3(uniqueFileName, req.file.buffer, dojang_code);

        // ✅ 수정됨: DB에 dojang_code도 함께 저장
        const query = 'INSERT INTO goals (student_id, image_url, dojang_code) VALUES (?, ?, ?)';
        await db.query(query, [studentId, imageUrl, dojang_code]);
        
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

// 2. 목표 이미지 조회 API (안전함)
router.get('/students/:studentId/goals', verifyToken, async (req, res) => {
    // ... (이전 코드와 동일, 이미 안전함)
    const { studentId } = req.params;
    const { year } = req.query;
    const { dojang_code } = req.user; 
    
    if (!year) {
        return res.status(400).json({ success: false, message: 'Year is required.' });
    }

    try {
        const query = `
            SELECT id, image_url, created_at 
            FROM goals 
            WHERE student_id = ? AND dojang_code = ? AND YEAR(created_at) = ? 
            ORDER BY created_at ASC
        `;
        const [goals] = await db.query(query, [studentId, dojang_code, year]);
        
        res.status(200).json({ success: true, data: goals });

    } catch (error) {
        console.error('❌ Error fetching goals:', error);
        res.status(500).json({ success: false, message: 'Server error occurred.' });
    }
});


// 3. 목표 이미지 삭제 API (수정됨)
router.delete('/goals/:goalId', verifyToken, async (req, res) => {
    const { goalId } = req.params;
    const { dojang_code } = req.user;

    try {
        // ✅ 수정됨: dojang_code로 한 번 더 확인하여 본인 도장 데이터만 조회
        const [goalRows] = await db.query('SELECT image_url FROM goals WHERE id = ? AND dojang_code = ?', [goalId, dojang_code]);
        
        if (goalRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Goal record not found or you do not have permission.' });
        }
        
        const { image_url } = goalRows[0];
        
        if (image_url) {
            const fileKeyWithFolder = image_url.split(`uploads/${dojang_code}/`)[1];
            if (fileKeyWithFolder) {
                await deleteFileFromS3(fileKeyWithFolder, dojang_code);
            }
        }

        // ✅ 수정됨: dojang_code로 한 번 더 확인하여 본인 도장 데이터만 삭제
        await db.query('DELETE FROM goals WHERE id = ? AND dojang_code = ?', [goalId, dojang_code]);

        res.status(200).json({ success: true, message: 'Goal record deleted successfully.' });

    } catch (error) {
        console.error('❌ Error deleting goal:', error);
        res.status(500).json({ success: false, message: 'Server error occurred.' });
    }
});

module.exports = router;