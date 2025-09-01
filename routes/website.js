const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 파일
const nodemailer = require('nodemailer');

// 인증 없이 누구나 접근 가능한 스케줄 API
router.get('/public-get-schedule', async (req, res) => {
  const { dojang_code } = req.query;
  if (!dojang_code) {
    return res.status(400).json({ message: 'dojang_code is required' });
  }

  try {
    const query = `
      SELECT id, time, Mon, Tue, Wed, Thur, Fri, Sat, dojang_code, sort_order
      FROM schedule
      WHERE dojang_code = ?
      ORDER BY sort_order ASC, id ASC
    `;
    const [results] = await db.query(query, [dojang_code]);

    // 빈 배열도 200으로
    res.setHeader('Cache-Control', 'public, max-age=60'); // 선택: 60초 캐시
    return res.status(200).json(results || []);
  } catch (err) {
    console.error('Error fetching schedule:', err);
    return res.status(500).json({ message: 'Error fetching schedule' });
  }
});

  router.post('/send-trial-email', async (req, res) => {
    const { name, age, experience, belt, phone } = req.body;
  
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
  
      const mailOptions = {
        from: 'saehan.jh@gmail.com',
        to: 'jcworldtkd.jh@gmail.com',
        subject: 'New Free Trial Class Request',
        text: `
New Trial Request:
- Name: ${name}
- Age: ${age}
- Phone: ${phone || 'N/A'}
- Experience: ${experience}
- Belt: ${belt || 'N/A'}
        `
      };
  
      await transporter.sendMail(mailOptions);
  
      res.status(200).json({ message: 'Email sent' });
    } catch (err) {
      console.error('Error sending email:', err);
      res.status(500).json({ message: 'Email failed', error: err.message });
    }
  });

  module.exports = router;