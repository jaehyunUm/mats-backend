// holiday.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 파일
const verifyToken = require('../middleware/verifyToken');
const { sendPushToDojang } = require('../services/pushService');

function formatDateReadable(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
}

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

        // ✅ 새로 추가된 휴일이 있으면, 학부모+사장님 휴대폰으로 푸시 알림 발송
        //    (응답을 이미 보낸 뒤이므로, 여기서 에러가 나도 res를 절대 건드리지 않고 로그만 남깁니다)
        if (dates.length > 0) {
            try {
                const [[dojangRow]] = await db.execute(
                    'SELECT dojang_name FROM dojangs WHERE dojang_code = ?',
                    [dojang_code]
                );
                const studioName = dojangRow?.dojang_name || 'our studio';
                const dateList = dates.map(formatDateReadable).join(', ');
                await sendPushToDojang(
                    dojang_code,
                    `📅 Holiday Scheduled`,
                    `${studioName}: Please note that ${dateList} ${dates.length > 1 ? 'are' : 'is'} scheduled as a holiday - there will be no class. Enjoy your time off!`,
                    { type: 'holiday_schedule', dates }
                );
            } catch (pushError) {
                console.error('❌ Error sending holiday schedule push:', pushError);
            }
        }
    } catch (error) {
        console.error('Error saving or removing holiday dates:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to save or remove holiday dates.' });
        }
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
