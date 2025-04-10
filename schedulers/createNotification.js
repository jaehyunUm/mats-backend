
const db = require('../db');

async function createNotification(dojang_code, message) {
  try {
    const connection = await db.getConnection();

    await connection.query(`
      INSERT INTO notifications (dojang_code, message, date, is_read)
      VALUES (?, ?, NOW(), 0)
    `, [dojang_code, message]);

    connection.release();
  } catch (err) {
    console.error("❌ Failed to insert notification:", err);
  }
}

module.exports = createNotification;
