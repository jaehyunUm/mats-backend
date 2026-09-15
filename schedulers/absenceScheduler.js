const cron = require("node-cron");
const db = require("../db");
const { sendPushToDojang } = require("../services/pushService");

// gender 컬럼(male/female/그 외)에 따라 자연스러운 대명사(주격/목적격)를 골라줌
function getPronouns(gender) {
  if (gender === "male") return { subject: "he", object: "him" };
  if (gender === "female") return { subject: "she", object: "her" };
  return { subject: "they", object: "them" };
}

function formatDateReadable(date) {
  return new Date(date).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
  });
}

// 오늘 결석 처리된 학생을 찾아서, 학부모에게 보낼 문자 "초안"을 만들어 notifications 테이블에 저장하고
// 사장님 휴대폰으로 "문자 초안이 준비됐어요" 푸시 알림을 보내는 로직 (문자는 사장님이 직접 발송)
async function checkAndPrepareAbsenceDrafts() {
  try {
    // 같은 학생이 하루에 여러 수업을 결석해도 초안은 한 번만 만들도록 DISTINCT 처리
    const [absentStudents] = await db.query(`
      SELECT DISTINCT
        s.id, s.first_name, s.last_name, s.gender, a.dojang_code,
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

    let createdCount = 0;
    const dojangCodesNotified = new Set();

    for (const student of absentStudents) {
      // 같은 날 이미 결석 초안을 만들었다면 건너뜀 (서버 재시작 등으로 인한 중복 생성 방지)
      const alreadyCreated = await hasAlreadyCreatedToday(student.id, "absence_draft");
      if (alreadyCreated) {
        continue;
      }

      const studioName = student.dojang_name || "our studio";
      const { subject, object } = getPronouns(student.gender);
      const dateStr = formatDateReadable(new Date());
      const draftMessage = `Hi, this is ${studioName}. We missed ${student.first_name} today (${dateStr}) - just checking in to see if everything is okay. ${student.first_name} was marked absent from class, and we want to make sure ${subject} is doing well. If there's anything going on or any questions at all, please don't hesitate to reach out. We hope to see ${object} again soon!`;

      await db.query(
        `INSERT INTO notifications (dojang_code, message, type, student_id, parent_phone, date, is_read)
         VALUES (?, ?, 'absence_draft', ?, ?, NOW(), 0)`,
        [student.dojang_code, draftMessage, student.id, student.parent_phone || null]
      );

      createdCount++;
      dojangCodesNotified.add(student.dojang_code);
    }

    // 도장별로 푸시 알림 한 번씩만 발송 (학생 10명이 결석해도 사장님한테 문자가 10번 오지 않도록)
    for (const dojang_code of dojangCodesNotified) {
      const [[{ cnt }]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM notifications WHERE dojang_code = ? AND type = 'absence_draft' AND DATE(date) = CURDATE()`,
        [dojang_code]
      );
      await sendPushToDojang(
        dojang_code,
        "결석 안내 문자 초안이 준비됐어요",
        `오늘 결석한 학생 ${cnt}명의 문자 초안을 확인해보세요.`,
        { type: "absence_draft" }
      );
    }

    console.log(`✅ 결석 문자 초안 생성 완료: 총 ${createdCount}건.`);
  } catch (error) {
    console.error("❌ 결석 알림 스케줄러 실행 중 오류 발생:", error);
  }
}

// 오늘 이미 해당 type의 초안을 만들었는지 확인
async function hasAlreadyCreatedToday(studentId, type) {
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
    console.log(`[${new Date().toISOString()}] 결석 문자 초안 스케줄러 실행 중...`);
    checkAndPrepareAbsenceDrafts();
  }, {
    scheduled: true,
    timezone: "America/New_York" // 애틀랜타/스머나 시간대
  });
};

module.exports = { startAbsenceScheduler, checkAndPrepareAbsenceDrafts };
