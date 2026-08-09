const db = require('../db');

// ⭐️ type과 studentId 파라미터 추가! (기본값 설정으로 기존 코드와 충돌 없음)
async function createNotification(dojang_code, message, type = 'general', studentId = null) {
  try {
    const connection = await db.getConnection();

    // ⭐️ 데이터베이스 INSERT 구문에 type과 student_id 추가
    await connection.query(`
      INSERT INTO notifications (dojang_code, message, type, student_id, date, is_read)
      VALUES (?, ?, ?, ?, NOW(), 0)
    `, [dojang_code, message, type, studentId]);

    connection.release();
  } catch (err) {
    console.error("❌ Failed to insert notification:", err);
  }
}

module.exports = createNotification;