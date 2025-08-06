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
const notificationRoutes = require('./routes/Notifications'); // notification.js 라우터 가져오기
app.use("/api", notificationRoutes);
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



// 비밀번호 재설정 링크 전송
app.post('/api/send-reset-link', async (req, res) => {
  const { email } = req.body;

  console.log("📢 DEBUG: Password reset requested for email:", email);

  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    console.error("❌ ERROR: Invalid email address received:", email);
    return res.status(400).json({ message: 'Invalid email address' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let user = null;

  try {
    console.log("📢 DEBUG: Checking 'users' table for email:", normalizedEmail);
    const [userResults] = await db.query(
      'SELECT * FROM users WHERE LOWER(email) = ?', 
      [normalizedEmail]
    );

    if (userResults.length > 0) {
      user = userResults[0];
      user.role = 'owner';
    } else {
      console.log("📢 DEBUG: Checking 'parents' table for email:", normalizedEmail);
      const [parentResults] = await db.query(
        'SELECT * FROM parents WHERE LOWER(email) = ?', 
        [normalizedEmail]
      );

      if (parentResults.length > 0) {
        user = parentResults[0];
        user.role = 'parent';
      }
    }

    if (!user) {
      console.error("❌ ERROR: No user found with email:", normalizedEmail);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log("✅ User found:", user);

    // JWT 토큰 생성 (1시간 유효)
    const secretKey = process.env.JWT_SECRET || 'defaultSecretKey';
    const token = jwt.sign({ email: user.email, role: user.role }, secretKey, { expiresIn: '1h' });

    const resetLink = `https://mats-backend.onrender.com/api/reset-password?token=${token}`;
    console.log("📢 DEBUG: Generated Reset Link:", resetLink);

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@example.com',
      to: user.email,
      subject: 'Password Reset',
      text: `Click the link below to reset your password:\n\n${resetLink}`,
      html: `
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>If the link doesn't work, copy and paste it into your app manually.</p>
      `,
    };

    console.log("📢 DEBUG: Sending email to:", user.email);

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("❌ ERROR: Failed to send email:", error);
        return res.status(500).json({ message: 'Error sending email' });
      }

      console.log("✅ Email sent:", info.response);
      return res.status(200).json({ message: "Password reset link sent successfully" });
    });

  } catch (err) {
    console.error("❌ ERROR: Database error:", err);
    return res.status(500).json({ message: "Database error", error: err.message });
  }
});


app.get('/api/reset-password', (req, res) => {
  const { token } = req.query;
  if (!token) return res.send('Invalid or missing token');

  // ✅ 앱으로 리디렉트
  res.redirect(`matsapp://reset-password?token=${token}`);
});

// 패스워드 재설정
app.post("/api/reset-password", async (req, res) => {
  console.log("📢 DEBUG: Received request at /api/reset-password");
  console.log("📢 DEBUG: Request Headers:", req.headers);
  console.log("📢 DEBUG: Request Body:", req.body);

  if (!req.body || !req.body.token || !req.body.newPassword) {
      console.error("❌ ERROR: Invalid request body (req.body is undefined or missing values)");
      return res.status(400).json({ message: "Invalid request. Token and new password are required." });
  }

  const { token, newPassword } = req.body;

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const [results] = await db.query("SELECT * FROM users WHERE email = ?", [decoded.email]);

      if (results.length === 0) {
          return res.status(404).json({ message: "User not found" });
      }

      // ✅ bcrypt를 사용하여 비밀번호 해싱
      const hashedPassword = await bcrypt.hash(newPassword, 10); // ✅ 비밀번호 해싱

      await db.query("UPDATE users SET password = ? WHERE email = ?", [hashedPassword, decoded.email]);

       // ✅ 응답이 정상적으로 반환되는지 확인
       const successResponse = { message: "Password has been reset successfully" };
       console.log("📢 DEBUG: Sending Response:", successResponse);
       return res.json(successResponse);
   } catch (error) {
       console.error("❌ ERROR resetting password:", error);
       if (error.name === "TokenExpiredError") {
           return res.status(400).json({ message: "Token has expired" });
       }
       return res.status(500).json({ message: "Internal server error" });
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
