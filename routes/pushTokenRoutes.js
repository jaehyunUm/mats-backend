// backend/routes/pushTokenRoutes.js
// 앱(관리자)이 실행될 때 Expo 푸시 토큰을 발급받아 서버에 등록/갱신하는 라우트
const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');

router.post('/push-token', verifyToken, async (req, res) => {
  const { id: user_id, dojang_code } = req.user;
  const { expo_push_token, platform } = req.body;

  if (!expo_push_token) {
    return res.status(400).json({ success: false, message: 'expo_push_token is required' });
  }

  try {
    await db.query(
      `INSERT INTO push_tokens (user_id, dojang_code, expo_push_token, platform)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), dojang_code = VALUES(dojang_code), platform = VALUES(platform)`,
      [user_id, dojang_code, expo_push_token, platform || null]
    );
    res.status(200).json({ success: true, message: 'Push token registered' });
  } catch (error) {
    console.error('❌ Error saving push token:', error);
    res.status(500).json({ success: false, message: 'Failed to save push token' });
  }
});

module.exports = router;
