// holiday.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 파일
const verifyToken = require('../middleware/verifyToken');

// 휴일 날짜 저장 및 삭제 API
router.post('/holiday-schedule', verifyToken, async (req, res) => {
    const { dates = [], datesToRemove = [] } = req.body;
    const { dojang_code } = req.user;

    try {
        if (dates.length > 0) {
            // 날짜 삽입 쿼리
            const insertSql = `INSERT IGNORE INTO holiday_schedule (date, dojang_code) VALUES ${dates.map(() => '(?, ?)').join(',')}`;
            const insertValues = dates.flatMap(date => [date, dojang_code]);
            await db.execute(insertSql, insertValues);
        }

        if (datesToRemove.length > 0) {
            // 날짜 삭제 쿼리
            const deleteSql = `DELETE FROM holiday_schedule WHERE date IN (${datesToRemove.map(() => '?').join(',')}) AND dojang_code = ?`;
            const deleteValues = [...datesToRemove, dojang_code];
            await db.execute(deleteSql, deleteValues);
        }

        res.status(200).json({ message: 'Holiday dates saved and removed successfully' });
    } catch (error) {
        console.error('Error saving or removing holiday dates:', error);
        res.status(500).json({ message: 'Failed to save or remove holiday dates.' });
    }
});


// 휴일 날짜 조회 API
router.get('/holiday-schedule', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;

    try {
        const [holidays] = await db.execute('SELECT date FROM holiday_schedule WHERE dojang_code = ?', [dojang_code]);
        res.status(200).json(holidays);
    } catch (error) {
        console.error('Error fetching holiday dates:', error);
        res.status(500).json({ message: 'Failed to fetch holiday dates.' });
    }
});

module.exports = router;
