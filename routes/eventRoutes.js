// eventRoutes.js
// 이벤트(예: Movie Night) 관리 API. 휴일/스파링과 달리 특정 날짜 하나에
// 이름/시간/가격을 함께 저장해야 해서 캘린더 토글 방식이 아니라 개별 등록/삭제 방식입니다.
// (참고: 학부모/사장님 푸시 알림은 즉시 발송하지 않고, 매일 아침 자동으로 도는
//  reminderScheduler.js에서 "이벤트 7일 전"에 한 번만 보냅니다)
const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');

// 이벤트 목록 조회 (오늘 이후 이벤트만, 날짜순)
router.get('/event-schedule', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;

  try {
    const [events] = await db.execute(
      `SELECT id, event_name, event_date, event_time, price
       FROM event_schedule
       WHERE dojang_code = ? AND event_date >= CURDATE()
       ORDER BY event_date ASC, event_time ASC`,
      [dojang_code]
    );
    res.status(200).json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Failed to fetch events.' });
  }
});

// 이벤트 등록
router.post('/event-schedule', verifyToken, async (req, res) => {
  const { event_name, event_date, event_time, price } = req.body;
  const { dojang_code } = req.user;

  if (!event_name || !event_date) {
    return res.status(400).json({ message: 'event_name and event_date are required.' });
  }

  try {
    const [result] = await db.execute(
      `INSERT INTO event_schedule (dojang_code, event_name, event_date, event_time, price)
       VALUES (?, ?, ?, ?, ?)`,
      [dojang_code, event_name, event_date, event_time || null, price !== undefined && price !== '' ? price : null]
    );
    res.status(200).json({ message: 'Event saved successfully', id: result.insertId });
  } catch (error) {
    console.error('Error saving event:', error);
    res.status(500).json({ message: 'Failed to save event.' });
  }
});

// 이벤트 삭제
router.delete('/event-schedule/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { dojang_code } = req.user;

  try {
    const [result] = await db.execute(
      `DELETE FROM event_schedule WHERE id = ? AND dojang_code = ?`,
      [id, dojang_code]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Event not found.' });
    }
    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ message: 'Failed to delete event.' });
  }
});

module.exports = router;
