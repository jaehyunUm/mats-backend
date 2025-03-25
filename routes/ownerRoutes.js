// routes/ownerRoutes.js
const express = require('express');
const router = express.Router();
const transporter = require('../modules/mailer'); // mailer 모듈을 분리하여 불러올 수도 있음
const db = require('../db'); // 데이터베이스 연결 가져오기

router.post('/send-owner-code', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const ownerCode = Math.floor(100000 + Math.random() * 900000); // 6자리 랜덤 코드 생성
  const createdAt = new Date(); // 생성 시각

  try {
    // 기존 코드가 있다면 삭제 (중복 방지)
    await db.query('DELETE FROM ownercodes WHERE email = ?', [email]);

    // 새 코드 저장
    await db.query(
      'INSERT INTO ownercodes (email, owner_code, created_at) VALUES (?, ?, ?)',
      [email, ownerCode, createdAt]
    );

    // 이메일 발송
    const mailOptions = {
      from: `"MATS" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Owner Code',
      text: `Dear User,\n\nThank you for registering with us.\n\nYour owner code is: ${ownerCode}\n\nThis code will expire in 30 minutes.\n\nBest regards,\nThe MATS Team`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Email error:', error);
        return res.status(500).json({ message: 'Failed to send email' });
      }
      console.log('Email sent: ' + info.response);
      res.status(200).json({ message: 'Owner code sent successfully' });
    });

  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ message: 'Failed to generate owner code' });
  }
});


module.exports = router;
