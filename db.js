// db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER, // 환경 변수로 데이터베이스 사용자 설정
  password: process.env.DB_PASS, // 환경 변수로 데이터베이스 비밀번호 설정
  database: process.env.DB_NAME, // 환경 변수로 데이터베이스 이름 설정
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  bigNumberStrings: true, // ✅ BigInt를 자동으로 문자열로 변환
  dateStrings: true, // ⭐️ 이 한 줄만 추가해 주세요!
});

console.log("👉 DB_HOST:", process.env.DB_HOST);

// 연결 풀에서 연결 가져오는 함수 재정의
const originalGetConnection = pool.getConnection;
pool.getConnection = async function(...args) {
  const connection = await originalGetConnection.apply(this, args);
  
  // 각 연결에 시간대 설정
  await connection.query('SET time_zone = "America/New_York"');
  
  return connection;
};

// 데이터베이스 연결 테스트
pool.getConnection()
  .then(connection => {
    console.log('Database connected successfully');
    connection.release(); // 연결 해제
  })
  .catch(err => {
    console.error('Database connection failed:', err);
  });

module.exports = pool;