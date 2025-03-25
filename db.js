// db.js
const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,       // 환경 변수로 데이터베이스 사용자 설정
  password: process.env.DB_PASS,   // 환경 변수로 데이터베이스 비밀번호 설정
  database: process.env.DB_NAME,   // 환경 변수로 데이터베이스 이름 설정
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  bigNumberStrings: true,  // ✅ BigInt를 자동으로 문자열로 변환
});

// 데이터베이스 연결 테스트
db.getConnection()
  .then(connection => {
    console.log('Database connected successfully');
    connection.release(); // 연결 해제
  })
  .catch(err => {
    console.error('Database connection failed:', err);
  });

module.exports = db;