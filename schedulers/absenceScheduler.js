const cron = require("node-cron");
const db = require("../db");
const createNotification = require("./createNotification");
const { sendSMS } = require("../services/smsService");

// 오늘 결석 처리된 학생을 찾아 학부모에게 SMS를 발송하는 핵심 로직
async function checkAndSendAbsenceNotifications() {
  try {
    // 같은 학생이 하루에 여러 수업을 결석해도 문자는 한 번만 가도록 DISTINCT 처리
    const [absentStudents] = await db.query(`
      SELECT DISTINCT
        s.id, s.first_name, s.last_name, a.dojang_code,
        p.phone AS parent_phone,
        d.dojang_name
      FROM absences a
      JOIN students s ON a.student_id = s.id
      LEFT JOIN parents p ON s.parent_id = p.id
      LEFT JOIN dojangs d ON a.dojang_code = d.dojang_code
      WHERE a.absence_date = CURDATE()
    `);

    if (absentStudents.length === 0) {
      console.log("✅ 오늘 결석 처리된 학생이 없습니다.");
      return;
    }

    let smsSentCount = 0;
    let skippedCount = 0;

    for (const student of absentStudents) {
      // 같은 날 이미 결석 SMS를 보냈다면 건너뜀 (서버 재시작 등으로 인한 중복 발송 방지)
      const alreadySent = await hasAlreadySentToday(student.id, 'absence_sms');
      if (alreadySent) {
        continue;
      }

      if (!student.parent_phone) {
        console.log(`ℹ️ No parent phone on file for ${student.first_name} ${student.last_name} — skipping absence SMS.`);
        skippedCount++;
        continue;
      }

      const studioName = student.dojang_name || "our studio";
      const smsBody = `Hi, this is ${studioName}. This is a note that ${student.first_name} ${student.last_name} was marked absent from today's class. Please let us know if you have any questions.`;

      const result = await sendSMS(student.parent_phone, smsBody);
      if (result.success) {
        smsSentCount++;
        await createNotification(
          student.dojang_code,
          `Absence SMS sent for ${student.first_name} ${student.last_name}`,
          'absence_sms',
          student.id
        );
      } else {
        skippedCount++;
      }
    }

    console.log(`✅ 결석 알림 스케줄러 완료: SMS 발송 ${smsSentCount}건, 건너뜀 ${skippedCount}건 (총 대상 ${absentStudents.length}명).`);
  } catch (error) {
    console.error("❌ 결석 알림 스케줄러 실행 중 오류 발생:", error);
  }
}

// 오늘 이미 해당 type의 알림(SMS 발송 기록)을 보냈는지 확인
async function hasAlreadySentToday(studentId, type) {
  try {
    const [rows] = await db.query(
      `SELECT id FROM notifications WHERE student_id = ? AND type = ? AND DATE(date) = CURDATE() LIMIT 1`,
      [studentId, type]
    );
    return rows.length > 0;
  } catch (err) {
    console.error("❌ Error checking duplicate notification:", err);
    return false;
  }
}

// 스케줄러 실행 함수 (매일 저녁 7시 30분, 하루 수업이 끝난 뒤 실행)
const startAbsenceScheduler = () => {
  cron.schedule('30 19 * * *', () => {
    console.log(`[${new Date().toISOString()}] 결석 알림 스케줄러 실행 중...`);
    checkAndSendAbsenceNotifications();
  }, {
    scheduled: true,
    timezone: "America/New_York" // 애틀랜타/스머나 시간대
  });
};

module.exports = { startAbsenceScheduler, checkAndSendAbsenceNotifications };
