const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);


// ✅ CORS 설정
const whitelist = [
  'http://localhost:3000',
  'http://localhost:8000', // ✅ 여기에 추가
  'http://192.168.12.144:4000',
  null,
  undefined
];
const corsOptions = {
  origin: (origin, callback) => {
    if (whitelist.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`❌ CORS Error: ${origin} is not allowed`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
};
app.use(cors());


// ✅ WebSocket 서버 설정
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('🔗 WebSocket connection established');

  ws.on('message', (message) => {
    console.log(`📩 Received: ${message}`);
  });

  ws.on('close', () => {
    console.log('❌ WebSocket connection closed');
  });

  ws.send('Connected to WebSocket server');
});

require('dotenv').config(); // 환경 변수 설정
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken'); // jwt 모듈 가져오기
const crypto = require('crypto'); // ✅ 올바른 import 방식
// 모듈 가져오기
const db = require('./db'); 
const verifyToken = require('./middleware/verifyToken');
const multer = require('multer');
// Multer 설정
const storage = multer.memoryStorage(); // 메모리 저장소를 사용하여 파일 데이터를 버퍼에 저장
const upload = multer({ storage: storage });
module.exports = { upload };
require('./schedulers/subscriptionScheduler'); // 스케줄러 로드
const { birthdayScheduler } = require('./schedulers/birthdayScheduler'); // 👈 실제 파일이 있는 경로로 맞춰주세요! (예: './schedulers/birthdayScheduler')
birthdayScheduler();
app.options("*", cors(corsOptions)); // ✅ 모든 경로에 대한 OPTIONS 요청 허용
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // form-urlencoded 지원

app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf.toString(); } })); 

app.use(bodyParser.json({ limit: '50mb' })); // 여기서 '50mb'로 크기 제한 설정
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true })); // URL-encoded 데이터에 대한 크기 제한
app.use('/uploads', express.static('uploads'));  // 정적 파일 경로 설정


// 본문 크기 초과 오류 처리
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request entity too large. Max size is 50MB.' });
  }
  next();
});

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});


const ownerRoutes = require('./routes/ownerRoutes'); // 분리된 라우트 불러오기
app.use('/api', ownerRoutes);
const signupRoutes = require('./routes/signupRoutes'); // signup 라우트 불러오기
app.use('/api', signupRoutes);
const dojangRoutes = require('./routes/dojangRoutes'); // dojangRoutes 불러오기
app.use('/api', dojangRoutes); // Dojangs 관련 경로 추가
const registerParentRoutes = require('./routes/registerParentRoutes'); // 학부모 회원가입 경로 추가
app.use('/api', registerParentRoutes);
const loginRoutes = require('./routes/loginRoutes'); // login 라우트 가져오기
app.use('/api', loginRoutes);
const program = require('./routes/program'); // 프로그램 라우트 가져오기
app.use('/api', program);
const belt = require('./routes/belt'); // beltsystem 라우트 가져오기
app.use('/api', belt); // beltsystem 관련 경로 추가
const classschedule = require('./routes/classschedule'); // 스케줄 라우트 가져오기
app.use('/api', classschedule); // 스케줄 경로 추가
const classConditionsRoutes = require('./routes/classConditionsRoutes'); // 클래스 조건 라우트 가져오기
app.use('/api', classConditionsRoutes); // 클래스 조건 관련 API 경로 설정
const sparringRoutes = require('./routes/sparringRoutes'); // sparring 라우트 추가
app.use('/api', sparringRoutes);
const categoriesRouter = require('./routes/categories'); // 카테고리 라우터 가져오기
app.use('/api/categories', categoriesRouter); // /api/categories 경로에 연결
const itemsRouter = require('./routes/items'); // 아이템 라우터 가져오기
app.use('/api', itemsRouter); // /api/items 경로에 연결
const testFeesRouter = require('./routes/testFees'); // 테스트 비용 라우트 가져오기
app.use('/api', testFeesRouter); // /api/test-fees 경로에 연결
const childrenRouter = require('./routes/children');
app.use('/api', childrenRouter); // /api 경로에 연결
const registerRouter = require('./routes/register'); // 학생 등록 라우터 가져오기
app.use('/api', registerRouter); // /api 경로에 연결
const holidayRouter = require('./routes/holiday');
app.use('/api', holidayRouter);
const testRouter = require('./routes/test'); // test 라우터 가져오기
app.use('/api', testRouter); // /api 경로에 연결
const attendanceRouter = require('./routes/attendance');
app.use('/api', attendanceRouter);
const testConditionRouter = require('./routes/testcondition'); // 정확한 경로 확인
app.use('/api', testConditionRouter); // '/api'로 모든 라우트 경로 연결
const mygrowthRouter = require('./routes/mygrowth');
app.use('/api', mygrowthRouter);
const myrankRoutes = require('./routes/myrank');
app.use('/api', myrankRoutes);
const myBadgeRoutes = require('./routes/mybadge');
app.use('/api', myBadgeRoutes);
const paymentHistoryRouter = require('./routes/paymentHistory'); // 결제 내역 라우터 가져오기
app.use('/api', paymentHistoryRouter); // 결제 내역 라우터 설정
const paymentRouter = require('./routes/payment'); // 결제 라우터 가져오기
app.use('/api', paymentRouter); // 결제 라우터 설정
const billingRoutes = require('./routes/billing'); // 새로 만든 billing 라우트 가져오기
app.use('/api/billing', billingRoutes);
const membershipRoutes = require('./routes/membership'); // 파일 경로에 맞게 설정
app.use('/api', membershipRoutes);
const profitRoutes = require('./routes/profit'); // profit.js 경로에 맞게 설정
app.use('/api', profitRoutes);
const studentRoutes = require('./routes/students');
app.use('/api', studentRoutes);
const studentManagementRoutes = require('./routes/studentmanagement'); // studentmanagement.js 파일 import
app.use('/api', studentManagementRoutes);
const customerRoutes = require('./routes/customer'); // customer.js 파일 경로
app.use('/api', customerRoutes);
const myclassRoutes = require('./routes/myclass'); // myclass.js 라우터 가져오기
app.use('/api', myclassRoutes); // '/api/myclass' 경로 연결
const subscriptionRoutes = require("./routes/subscription");
app.use("/api", subscriptionRoutes);
const growthRoutes = require('./routes/growth'); // ✅ 학생 성장 기록 라우터
app.use('/api', growthRoutes); // 성장 기록 라우터 등록
const bankaccountRoute = require('./routes/bankaccount');
app.use('/api', bankaccountRoute);
const websiteRoutes = require('./routes/website');
app.use('/api', websiteRoutes);
const changePasswordRoutes = require('./routes/changepassword');
app.use('/api', changePasswordRoutes);
const goalRoutes = require('./routes/goalRoutes'); // ✅ 1. 목표(Goal) 라우트 불러오기
app.use('/api', goalRoutes); // ✅ 2. 목표(Goal) 라우트 등록
const notificationRoutes = require('./routes/notificationRoutes'); 
app.use('/api', notificationRoutes);
const lessonPlanRoutes = require('./routes/lessonplan'); // 파일명이 정확한지 확인!
app.use('/api', lessonPlanRoutes); // 여기서 '/api'를 이미 붙였습니다.

// Webhook 엔드포인트 설정
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-square-hmacsha256-signature']; // Square가 보낸 서명
  const webhookURL = "https://a5d5-2607-fb90-d726-580-bda1-742b-7e79-dd83.ngrok-free.app/webhook"; // 설정한 Webhook URL

  // ✅ 서명 검증
  const hmac = crypto.createHmac('sha256', SQUARE_SIGNATURE_KEY);
  hmac.update(webhookURL + req.rawBody);
  const expectedSignature = hmac.digest('base64');

  if (signature !== expectedSignature) {
      console.error("❌ Invalid signature. Webhook request might not be from Square.");
      return res.status(400).send('Invalid signature');
  }

  console.log("✅ Webhook verified successfully:", req.body);
  res.status(200).send('Webhook received successfully');
});


// 비밀번호 재설정 코드 전송
app.post('/api/send-reset-code', async (req, res) => {
  const { email } = req.body;

  console.log("📢 DEBUG: Password reset requested for email:", email);

  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    console.error("❌ ERROR: Invalid email address received:", email);
    return res.status(400).json({ message: 'Invalid email address' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let user = null;
  let tableName = null;

  try {
    console.log("📢 DEBUG: Checking 'users' table for email:", normalizedEmail);
    const [userResults] = await db.query(
      'SELECT * FROM users WHERE LOWER(email) = ?', 
      [normalizedEmail]
    );

    if (userResults.length > 0) {
      user = userResults[0];
      tableName = 'users';
    } else {
      console.log("📢 DEBUG: Checking 'parents' table for email:", normalizedEmail);
      const [parentResults] = await db.query(
        'SELECT * FROM parents WHERE LOWER(email) = ?', 
        [normalizedEmail]
      );

      if (parentResults.length > 0) {
        user = parentResults[0];
        tableName = 'parents';
      }
    }

    if (!user) {
      console.error("❌ ERROR: No user found with email:", normalizedEmail);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log("✅ User found:", user);

    // 1. 6자리 무작위 인증 코드 생성
    const resetCode = Math.floor(100000 + Math.random() * 900000); 
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분 후 만료

    // 2. 데이터베이스에 코드와 만료 시간 저장
    console.log("📢 DEBUG: Saving reset code to DB for table:", tableName);
    await db.query(
      `UPDATE ${tableName} SET reset_code = ?, reset_code_expires = ? WHERE email = ?`,
      [resetCode.toString(), expiresAt, normalizedEmail]
    );

    // 3. 사용자에게 인증 코드를 포함한 이메일 전송
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@example.com',
      to: user.email,
      subject: 'Password Reset Code',
      text: `Your password reset code is: ${resetCode}\n\nThis code is valid for 10 minutes.`,
      html: `
        <p>Your password reset code is: <strong>${resetCode}</strong></p>
        <p>This code is valid for 10 minutes. If you did not request a password reset, please ignore this email.</p>
      `,
    };

    console.log("📢 DEBUG: Sending email to:", user.email);

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("❌ ERROR: Failed to send email:", error);
        return res.status(500).json({ message: 'Error sending email' });
      }

      console.log("✅ Email sent:", info.response);
      return res.status(200).json({ message: "Password reset code sent successfully" });
    });

  } catch (err) {
    console.error("❌ ERROR: Database error:", err);
    return res.status(500).json({ message: "Database error", error: err.message });
  }
});

// 비밀번호 재설정
app.post('/api/reset-password', async (req, res) => {
  const { email, resetCode, newPassword } = req.body;

  if (!email || !resetCode || !newPassword) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let user = null;
  let tableName = null;

  try {
    // 1. DB에서 이메일, 코드, 만료 시간 확인
    const [userResults] = await db.query(
      `SELECT * FROM users WHERE LOWER(email) = ? AND reset_code = ? AND reset_code_expires > NOW()`,
      [normalizedEmail, resetCode]
    );

    if (userResults.length > 0) {
      user = userResults[0];
      tableName = 'users';
    } else {
      const [parentResults] = await db.query(
        `SELECT * FROM parents WHERE LOWER(email) = ? AND reset_code = ? AND reset_code_expires > NOW()`,
        [normalizedEmail, resetCode]
      );
      if (parentResults.length > 0) {
        user = parentResults[0];
        tableName = 'parents';
      }
    }

    if (!user) {
      console.error("❌ ERROR: Invalid or expired reset code for email:", normalizedEmail);
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }

    console.log("✅ User found with valid code:", user);

    // 2. 새 비밀번호를 해시하여 업데이트
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    console.log("📢 DEBUG: Updating password for table:", tableName);
    await db.query(
      `UPDATE ${tableName} SET password = ?, reset_code = NULL, reset_code_expires = NULL WHERE email = ?`,
      [hashedPassword, normalizedEmail]
    );

    console.log("✅ Password reset successfully for:", normalizedEmail);
    return res.status(200).json({ message: 'Password reset successfully!' });

  } catch (err) {
    console.error("❌ ERROR: Database or bcrypt error:", err);
    return res.status(500).json({ message: "Error resetting password", error: err.message });
  }
});





// ✅ 백엔드 서버 상태 확인을 위한 라우터
app.get('/api/status', (req, res) => {
  res.send('✅ Backend server is running with WebSocket!');
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
});
