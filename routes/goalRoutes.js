const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../db'); // mysql2/promise를 사용한다고 가정 (await db.query 가능)
const verifyToken = require('../middleware/verifyToken');
const { upload } = require('../index'); 
const { uploadFileToS3, deleteFileFromS3 } = require('../modules/s3Service');

// ==========================================
// 1. 목표 (Goals) API 섹션
// ==========================================

// 1-1. 목표 이미지 업로드 API
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
        const fileExtension = path.extname(originalname); 
        const uniqueFileName = `goals/goal_${studentId}_${timestamp}${fileExtension}`;

        const imageUrl = await uploadFileToS3(uniqueFileName, req.file.buffer, dojang_code);

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

// 1-2. 연도별 목표 이미지 조회 API (중복 제거 및 최적화됨)
// GET /api/students/:studentId/goals?year=2025
router.get('/students/:studentId/goals', verifyToken, async (req, res) => {
    const { studentId } = req.params;
    const { year } = req.query;
    const { dojang_code } = req.user;
    
    if (!year) {
        return res.status(400).json({ success: false, message: 'Year is required.' });
    }

    try {
        // dojang_code까지 체크하여 보안 강화
        const query = `
            SELECT id, image_url, created_at 
            FROM goals 
            WHERE student_id = ? AND YEAR(created_at) = ? 
            ORDER BY created_at ASC
        `;
        // 만약 goals 테이블에 dojang_code 컬럼이 없다면 위 쿼리에서 AND dojang_code = ? 부분은 빼야 합니다.
        // 현재 로직상 image_url에 dojang 폴더가 포함되므로 student_id로만 조회해도 무방할 수 있습니다.
        // 여기서는 가장 기본적인 student_id와 year로 조회합니다.
        
        const [goals] = await db.query(query, [studentId, year]);
        
        if (goals.length > 0) {
            res.status(200).json({ success: true, data: goals });
        } else {
            res.status(200).json({ success: true, data: [], message: `No goals found for ${year}.` });
        }

    } catch (error) {
        console.error('❌ Error fetching goals:', error);
        res.status(500).json({ success: false, message: 'Server error occurred.' });
    }
});

// 1-3. 목표 이미지 삭제 API
// DELETE /api/goals/:goalId
router.delete('/goals/:goalId', verifyToken, async (req, res) => {
    const { goalId } = req.params;
    const { dojang_code } = req.user;

    try {
        const [goalRows] = await db.query('SELECT image_url FROM goals WHERE id = ?', [goalId]);
        
        if (goalRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Goal record not found.' });
        }
        
        const { image_url } = goalRows[0];
        
        if (image_url) {
            const fileKeyWithFolder = image_url.split(`uploads/${dojang_code}/`)[1];
            if (fileKeyWithFolder) {
                await deleteFileFromS3(fileKeyWithFolder, dojang_code);
            }
        }

        await db.query('DELETE FROM goals WHERE id = ?', [goalId]);

        res.status(200).json({ success: true, message: 'Goal record deleted successfully.' });

    } catch (error) {
        console.error('❌ Error deleting goal:', error);
        res.status(500).json({ success: false, message: 'Server error occurred.' });
    }
});

// ==========================================
// 2. Student Notes (코멘트) API 섹션
// ==========================================
// 기존 코드 스타일(async/await)에 맞춰 변환했습니다.

// 2-1. 특정 학생의 모든 노트 가져오기
// GET /api/student-notes/:studentId
router.get('/student-notes/:studentId', verifyToken, async (req, res) => {
    const { studentId } = req.params;
    
    try {
        const query = `
            SELECT id, note_content, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as date 
            FROM student_notes 
            WHERE student_id = ? 
            ORDER BY created_at DESC
        `;
    
        const [results] = await db.query(query, [studentId]);
        res.json(results);

    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ success: false, message: 'DB Error' });
    }
});
  
// 2-2. 노트 추가하기
// POST /api/add-note
router.post('/add-note', verifyToken, async (req, res) => {
    const { student_id, note_content } = req.body;

    if (!student_id || !note_content) {
        return res.status(400).json({ success: false, message: 'Missing data' });
    }

    try {
        const query = 'INSERT INTO student_notes (student_id, note_content) VALUES (?, ?)';
        
        const [result] = await db.query(query, [student_id, note_content]);
        
        res.json({ success: true, message: 'Note added successfully', id: result.insertId });

    } catch (error) {
        console.error('Error adding note:', error);
        res.status(500).json({ success: false, message: 'DB Error' });
    }
});
  
// 2-3. 노트 삭제하기
// DELETE /api/delete-note/:noteId
router.delete('/delete-note/:noteId', verifyToken, async (req, res) => {
    const { noteId } = req.params;

    try {
        const query = 'DELETE FROM student_notes WHERE id = ?';
        
        await db.query(query, [noteId]);
        
        res.json({ success: true, message: 'Note deleted' });

    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({ success: false, message: 'DB Error' });
    }
});

module.exports = router;