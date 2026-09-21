const cron = require("node-cron");
const db = require("../db"); // 실제 db 연결 파일 경로
const { sendPushToOwners } = require("../services/pushService");

// 생일자를 찾아, 학부모에게 보낼 문자 "초안"을 만들어 notifications 테이블에 저장하고
// 사장님 휴대폰으로 푸시 알림을 보내는 핵심 로직 (문자는 사장님이 직접 발송)
async function checkAndCreateBirthdayNotifications() {
  try {
    // 학생 id, 부모 전화번호, 도장 이름까지 함께 조회
    const [birthdayStudents] = await db.query(`
      SELECT
        s.id, s.first_name, s.last_name, s.dojang_code,
        p.phone AS parent_phone,
        d.dojang_name
      FROM students s
      LEFT JOIN parents p ON s.parent_id = p.id
      LEFT JOIN dojangs d ON s.dojang_code = d.dojang_code
      WHERE DATE_FORMAT(s.birth_date, '%m-%d') = DATE_FORMAT(CURDATE(), '%m-%d')
        AND s.program_id IS NOT NULL
    `);

    if (birthdayStudents.length === 0) {
      console.log("✅ 오늘 생일인 학생이 없습니다.");
      return;
    }

    let draftCount = 0;
    const dojangCodesNotified = new Set();

    for (const student of birthdayStudents) {
      // ⭐️ 부모님께 보낼 생일 축하 문자 "초안"을 만들어서 저장 (하루에 학생당 한 번만)
      // (예전엔 이거 말고 createNotification()으로 앱 알림 카드를 하나 더 만들었는데,
      //  같은 생일에 "Happy Birthday" 알림이 두 개씩 뜨는 원인이라 제거함. 이제 문자 초안 하나만 생성.)
      const alreadyCreated = await hasAlreadyCreatedToday(student.id, 'birthday_draft');
      if (!alreadyCreated) {
        const draftMessage = `🎉 We just wanted to take a moment to wish ${student.first_name} a very Happy Birthday today. We hope it's filled with family, friends, cake, and maybe a few celebratory kicks and punches! Thank you for being a part of our JC family. 🥋🎂`;

        await db.query(
          `INSERT INTO notifications (dojang_code, message, type, student_id, parent_phone, date, is_read)
           VALUES (?, ?, 'birthday_draft', ?, ?, NOW(), 0)`,
          [student.dojang_code, draftMessage, student.id, student.parent_phone || null]
        );
        draftCount++;
        dojangCodesNotified.add(student.dojang_code);
      } else if (!student.parent_phone) {
        console.log(`ℹ️ No parent phone on file for ${student.first_name} ${student.last_name}.`);
      }
    }

    // 도장별로 푸시 알림 한 번씩만 발송
    for (const dojang_code of dojangCodesNotified) {
      const [[{ cnt }]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM notifications WHERE dojang_code = ? AND type = 'birthday_draft' AND DATE(date) = CURDATE()`,
        [dojang_code]
      );
      await sendPushToOwners(
        dojang_code,
        "생일 축하 문자 초안이 준비됐어요 🎉",
        `오늘 생일인 학생 ${cnt}명의 문자 초안을 확인해보세요.`,
        { type: "birthday_draft" }
      );
    }

    console.log(`✅ 생일자 스케줄러 완료: 문자 초안 ${draftCount}건 생성.`);
  } catch (error) {
    console.error("❌ 생일자 스케줄러 실행 중 오류 발생:", error);
  }
}

// 오늘 이미 해당 type의 초안을 만들었는지 확인 (서버 재시작 등으로 인한 중복 생성 방지)
async function hasAlreadyCreatedToday(studentId, type) {
  try {
    const [rows] = await db.query(
      `SELECT id FROM notifications WHERE student_id = ? AND type = ? AND DATE(date) = CURDATE() LIMIT 1`,
      [studentId, type]
    );
    return rows.length > 0;
  } catch (err) {
    console.error("❌ Error checking duplicate notification:", err);
    return false; // 확인 실패 시에는 안전하게 진행
  }
}

// 스케줄러 실행 함수 (매일 오전 9시 정각에 실행)
const startBirthdayScheduler = () => {
  cron.schedule('0 9 * * *', () => {
    console.log(`[${new Date().toISOString()}] 생일자 스케줄러 실행 중...`);
    checkAndCreateBirthdayNotifications();
  }, {
    scheduled: true,
    timezone: "America/New_York" // 애틀랜타/스머나 시간대
  });
};

module.exports = { startBirthdayScheduler, checkAndCreateBirthdayNotifications };
