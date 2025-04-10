require('dotenv').config(); // 👈 꼭 추가!
const db = require('../db');

async function checkPayInFullNotifications() {
  const connection = await db.getConnection();

  try {
    console.log("🔔 Checking Pay In Full notifications...");

    // 수업 횟수 기준 알림 (3개, 1개)
    const [classAlerts] = await connection.query(`
      SELECT p.id AS payment_id, p.*, s.first_name, s.last_name
      FROM payinfull_payment p
      JOIN students s ON p.student_id = s.id
      WHERE 
        (p.remaining_classes = 3 AND p.class_notification_3 = 0)
        OR 
        (p.remaining_classes = 1 AND p.class_notification_1 = 0)
    `);
    

    console.log("📌 Class Alerts Found:", classAlerts); // ✅ 여기!

    for (const student of classAlerts) {
      const message = `[${student.first_name}] has ${student.remaining_classes} classes remaining.`;
      
      console.log("📩 Sending alert for:", student.first_name, student.last_name, "-", student.remaining_classes, "classes left");

      await createNotification(connection, student.dojang_code, message);

      // 알림 보낸 후 플래그 true로 업데이트
      const flagColumn = student.remaining_classes === 3 ? 'class_notification_3' : 'class_notification_1';
      await connection.query(`
        UPDATE payinfull_payment 
        SET ${flagColumn} = TRUE 
        WHERE id = ?
      `, [student.payment_id]);
    }

    // 종료일 기준 알림 (30일, 14일, 7일)
    const [dateAlerts] = await connection.query(`
      SELECT p.*, s.first_name, s.last_name, DATEDIFF(p.end_date, CURDATE()) AS days_left
      FROM payinfull_payment p
      JOIN students s ON p.student_id = s.id
      WHERE DATEDIFF(p.end_date, CURDATE()) IN (30, 14, 7)
    `);

    for (const student of dateAlerts) {
      const daysLeft = student.days_left;

      // 해당 알림 이미 보냈는지 확인
      let shouldSend = false;
      let flagColumn = "";

      if (daysLeft === 30 && !student.month_notification_1) {
        shouldSend = true;
        flagColumn = 'month_notification_1';
      } else if (daysLeft === 14 && !student.week_notification_2) {
        shouldSend = true;
        flagColumn = 'week_notification_2';
      } else if (daysLeft === 7 && !student.week_notification_1) {
        shouldSend = true;
        flagColumn = 'week_notification_1';
      }

      if (shouldSend) {
        const message = `[${student.first_name}]’s subscription expires in ${daysLeft} days.`;
        await createNotification(connection, student.dojang_code, message);

        await connection.query(`
          UPDATE payinfull_payment 
          SET ${flagColumn} = TRUE 
          WHERE id = ?
        `, [student.id]);
      }
    }

    console.log("✅ Notification check completed.");
  } catch (err) {
    console.error("❌ Error in notification checker:", err);
  } finally {
    connection.release();
  }
}

async function createNotification(connection, dojang_code, message) {
  await connection.query(`
    INSERT INTO notifications (dojang_code, message, date, is_read)
    VALUES (?, ?, NOW(), 0)
  `, [dojang_code, message]);
}

module.exports = { checkPayInFullNotifications };
