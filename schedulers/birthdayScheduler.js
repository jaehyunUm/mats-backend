const cron = require("node-cron");
const db = require("../db"); // 실제 db 연결 파일 경로
const createNotification = require("./createNotification"); // ⭐️ 방금 만든 알림 함수 불러오기 (경로 확인 필수!)
const { sendSMS } = require("../services/smsService");

// 생일자를 찾아 알림을 생성하는 핵심 로직
async function checkAndCreateBirthdayNotifications() {
  try {
    // 1. 학생 id, 부모 전화번호, 도장 이름까지 함께 조회
    const [birthdayStudents] = await db.query(`
      SELECT
        s.id, s.first_name, s.last_name, s.dojang_code,
        p.phone AS parent_phone,
        d.dojang_name
      FROM students s
      LEFT JOIN parents p ON s.parent_id = p.id
      LEFT JOIN dojangs d ON s.dojang_code = d.dojang_code
      WHERE DATE_FORMAT(s.birth_date, '%m-%d') = DATE_FORMAT(CURDATE(), '%m-%d')
    `);

    if (birthdayStudents.length === 0) {
      console.log("✅ 오늘 생일인 학생이 없습니다.");
      return;
    }

    let successCount = 0;
    let smsSentCount = 0;

    for (const student of birthdayStudents) {
      const message = `🎉 Happy Birthday to ${student.first_name} ${student.last_name}!`;

      // ⭐️ 우리가 만든 튼튼한 알림 함수 사용 (type은 'birthday'로 지정, 앱 내 알림)
      await createNotification(
        student.dojang_code,
        message,
        'birthday',
        student.id
      );

      successCount++;

      // ⭐️ 부모님께 생일 축하 SMS 발송 (하루에 학생당 한 번만 — 중복 발송 방지)
      const alreadySentSms = await hasAlreadySentToday(student.id, 'birthday_sms');
      if (!alreadySentSms && student.parent_phone) {
        const studioName = student.dojang_name || "our studio";
        const smsBody = `Hi, this is ${studioName}! 🎉 We just wanted to take a moment to wish ${student.first_name} a very Happy Birthday today. We hope it's filled with family, friends, cake, and maybe a few celebratory kicks and punches! Thank you for being such a wonderful part of our ${studioName} family - we're so glad to have ${student.first_name} with us. 🥋🎂`;
        const result = await sendSMS(student.parent_phone, smsBody);
        if (result.success) {
          smsSentCount++;
          await createNotification(student.dojang_code, `Birthday SMS sent for ${student.first_name} ${student.last_name}`, 'birthday_sms', student.id);
        }
      } else if (!student.parent_phone) {
        console.log(`ℹ️ No parent phone on file for ${student.first_name} ${student.last_name} — skipping birthday SMS.`);
      }
    }

    console.log(`✅ 생일자 스케줄러 완료: 총 ${successCount}명의 생일 알림이 생성되었습니다. (SMS 발송: ${smsSentCount}건)`);
  } catch (error) {
    console.error("❌ 생일자 스케줄러 실행 중 오류 발생:", error);
  }
}

// 오늘 이미 해당 type의 알림(SMS 발송 기록)을 보냈는지 확인 — 서버 재시작 등으로 인한 중복 문자 발송을 막기 위함
async function hasAlreadySentToday(studentId, type) {
  try {
    const [rows] = await db.query(
      `SELECT id FROM notifications WHERE student_id = ? AND type = ? AND DATE(date) = CURDATE() LIMIT 1`,
      [studentId, type]
    );
    return rows.length > 0;
  } catch (err) {
    console.error("❌ Error checking duplicate notification:", err);
    return false; // 확인 실패 시에는 안전하게 발송을 계속 진행
  }
}

// 스케줄러 실행 함수 (매일 오전 9시 정각에 실행)
const startBirthdayScheduler = () => {
  // ⭐️ timezone 옵션을 추가하여 조지아주(미국 동부) 시간에 정확히 맞춥니다!
  cron.schedule('0 9 * * *', () => {
    console.log(`[${new Date().toISOString()}] 생일자 스케줄러 실행 중...`);
    checkAndCreateBirthdayNotifications();
  }, {
    scheduled: true,
    timezone: "America/New_York" // 애틀랜타/스머나 시간대
  });
};

module.exports = { startBirthdayScheduler, checkAndCreateBirthdayNotifications };
