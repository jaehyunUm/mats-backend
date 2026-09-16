// backend/schedulers/reminderScheduler.js
// 스파링/휴일 일정을 "7일 전"에 자동으로 알려주는 스케줄러.
//  - 스파링: 해당 요일에 실제로 클래스가 있는 학생의 학부모에게만 개별 발송 (전체 도장 방송 X)
//  - 휴일: 도장 전체에 한 번만 발송 (모두에게 해당되는 공지이므로)
const cron = require("node-cron");
const db = require("../db");
const { sendPushToDojang, sendPushToOwners, sendPushToUserIds } = require("../services/pushService");

// class_details.day 컬럼에 저장된 형식과 반드시 동일해야 함 ("Thu"가 아니라 "Thur")
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thur", "Fri", "Sat"];

// 뉴욕(애틀랜타/스머나) 시간 기준으로 오늘부터 daysAhead일 뒤 날짜를 'YYYY-MM-DD'로 반환
function getTargetDateString(daysAhead) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  now.setDate(now.getDate() + daysAhead);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateReadable(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

// 같은 알림을 두 번 보내지 않도록 reminder_log에 (dojang_code, type, ref_date) 유니크 기록을 시도.
// 이미 보낸 적이 있으면(=중복 키 에러) false를 반환해서 건너뛰게 함.
async function tryClaimReminder(dojang_code, type, refDate) {
  try {
    await db.query(
      `INSERT INTO reminder_log (dojang_code, type, ref_date) VALUES (?, ?, ?)`,
      [dojang_code, type, refDate]
    );
    return true;
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return false;
    console.error(`❌ [reminder] reminder_log 기록 실패 (${type}, ${dojang_code}, ${refDate}):`, err.message);
    return false;
  }
}

// ===== 스파링: 7일 뒤가 스파링 날이면, 그 요일에 클래스가 있는 학생의 학부모에게만 발송 =====
async function checkSparringReminders() {
  const targetDate = getTargetDateString(7);
  try {
    const [rows] = await db.query(
      `SELECT sp.dojang_code, d.dojang_name
       FROM sparring_schedule sp
       LEFT JOIN dojangs d ON sp.dojang_code = d.dojang_code
       WHERE sp.date = ?`,
      [targetDate]
    );

    for (const row of rows) {
      const { dojang_code } = row;
      const studioName = row.dojang_name || "our studio";

      const claimed = await tryClaimReminder(dojang_code, "sparring", targetDate);
      if (!claimed) continue; // 이미 오늘 보냄 (서버 재시작 등으로 인한 중복 방지)

      const dayOfWeek = new Date(targetDate + "T00:00:00").getDay();
      const dayColumn = DAYS[dayOfWeek];
      const dateLabel = formatDateReadable(targetDate);

      // 그 요일에 실제로 클래스가 있는 학생들의 학부모만 조회
      const [parentRows] = await db.query(
        `SELECT DISTINCT p.id AS parent_id
         FROM class_details cd
         JOIN student_classes sc ON sc.class_id = cd.class_id AND sc.dojang_code = cd.dojang_code
         JOIN students s ON s.id = sc.student_id
         JOIN parents p ON p.id = s.parent_id
         WHERE cd.dojang_code = ? AND cd.day = ?`,
        [dojang_code, dayColumn]
      );

      const message = `${studioName}: This week is sparring week! Class on ${dateLabel} - please wear Arm gear, Leg gear, Hand gear, and Feet gear before coming to class so we can run the class smoothly.`;

      if (parentRows.length > 0) {
        const parentIds = parentRows.map((p) => p.parent_id);
        await sendPushToUserIds(
          parentIds,
          dojang_code,
          "🥋 Sparring Week Reminder",
          message,
          { type: "sparring_reminder", date: targetDate },
          "parent"
        );
      } else {
        console.log(`ℹ️ [sparring reminder] ${dojang_code}: ${dayColumn}요일에 등록된 클래스가 없어 학부모 대상 발송을 건너뜁니다.`);
      }

      // 사장님께 요약 알림
      await sendPushToOwners(
        dojang_code,
        "🥋 Sparring Reminder Sent",
        `${dateLabel} sparring day reminder was sent to ${parentRows.length} parent(s) with class on ${dayColumn}.`,
        { type: "sparring_reminder_summary", date: targetDate }
      );

      console.log(`✅ [sparring reminder] ${dojang_code} / ${targetDate}(${dayColumn}) - 학부모 ${parentRows.length}명 대상 발송 완료`);
    }
  } catch (error) {
    console.error("❌ 스파링 리마인더 스케줄러 오류:", error);
  }
}

// ===== 휴일: 7일 뒤가 휴일이면, 도장 전체에 한 번만 발송 =====
async function checkHolidayReminders() {
  const targetDate = getTargetDateString(7);
  try {
    const [rows] = await db.query(
      `SELECT h.dojang_code, d.dojang_name
       FROM holiday_schedule h
       LEFT JOIN dojangs d ON h.dojang_code = d.dojang_code
       WHERE h.date = ?`,
      [targetDate]
    );

    for (const row of rows) {
      const { dojang_code } = row;
      const studioName = row.dojang_name || "our studio";

      const claimed = await tryClaimReminder(dojang_code, "holiday", targetDate);
      if (!claimed) continue;

      const dateLabel = formatDateReadable(targetDate);
      const message = `${studioName}: ${dateLabel} is scheduled as a holiday - there will be no class. If you're regularly scheduled that day, please reschedule or make up your class the following week.`;

      await sendPushToDojang(
        dojang_code,
        "📅 Holiday Reminder",
        message,
        { type: "holiday_reminder", date: targetDate }
      );

      console.log(`✅ [holiday reminder] ${dojang_code} / ${targetDate} - 도장 전체 발송 완료`);
    }
  } catch (error) {
    console.error("❌ 휴일 리마인더 스케줄러 오류:", error);
  }
}

// 매일 아침 9시(뉴욕 시간)에 "7일 뒤" 스파링/휴일 일정을 확인해서 알림
const startReminderScheduler = () => {
  cron.schedule(
    "0 9 * * *",
    () => {
      console.log(`[${new Date().toISOString()}] 스파링/휴일 리마인더 스케줄러 실행 중...`);
      checkSparringReminders();
      checkHolidayReminders();
    },
    {
      scheduled: true,
      timezone: "America/New_York",
    }
  );
};

module.exports = { startReminderScheduler, checkSparringReminders, checkHolidayReminders };
