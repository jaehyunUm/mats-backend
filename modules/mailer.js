// routes/mailer.js
require('dotenv').config();
const nodemailer = require('nodemailer'); // nodemailer를 추가


// Nodemailer를 사용한 이메일 전송 설정
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // 발신자 이메일 (환경 변수 사용)
    pass: process.env.EMAIL_PASS, // 발신자 비밀번호 (환경 변수 사용)
  },
});

module.exports = transporter;
