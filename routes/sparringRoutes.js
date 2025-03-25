const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');

// 스파링 스케줄 가져오기
router.get('/sparring_schedule', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;

  if (!dojang_code) {
    return res.status(400).json({ message: 'Dojang code not found.' });
  }

  try {
      const [sparringDays] = await db.execute(
        'SELECT date FROM sparring_schedule WHERE dojang_code = ?',
        [dojang_code]
      );
      res.status(200).json(sparringDays);
  } catch (error) {
      console.error('Error fetching sparring dates:', error);
      res.status(500).json({ message: 'Failed to fetch sparring dates.' });
  }
});

// 스파링 스케줄 저장 및 삭제 API
router.post('/sparring-schedule', verifyToken, async (req, res) => {
  const { dates, datesToRemove } = req.body;
  const { dojang_code } = req.user;

  try {
    // 날짜 삽입 쿼리
    if (dates.length > 0) {
      const insertSql = `INSERT IGNORE INTO sparring_schedule (date, dojang_code) VALUES ${dates.map(() => '(?, ?)').join(',')}`;
      const insertValues = dates.flatMap(date => [date, dojang_code]);
      await db.execute(insertSql, insertValues);
    }

    // 날짜 삭제 쿼리
    if (datesToRemove.length > 0) {
      const deleteSql = `DELETE FROM sparring_schedule WHERE date IN (${datesToRemove.map(() => '?').join(',')}) AND dojang_code = ?`;
      const deleteValues = [...datesToRemove, dojang_code];
      await db.execute(deleteSql, deleteValues);
    }

    // 성공 메시지 반환
    res.status(200).json({ message: 'Sparring dates saved and removed successfully' });
  } catch (error) {
    console.error('Error saving or removing sparring dates:', error);
    res.status(500).json({ message: 'Failed to save or remove sparring dates.' });
  }
});


  

module.exports = router;
