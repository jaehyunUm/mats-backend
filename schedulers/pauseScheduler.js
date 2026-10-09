// backend/schedulers/pauseScheduler.js
// 일시정지(Pause) 회원 자동 관리 - 매일 오전 9시(뉴욕 시간)
//
// 1) 복귀 7일 전 안내: 원장님께 푸시 + 학부모께 보낼 문자 초안(pause_ending_draft) 생성
//    → 학부모가 "언제 결제가 다시 시작되는지" 미리 알 수 있어서, 갑자기 결제돼서 그만두는 일을 막습니다.
// 2) 복귀 예정일 도래: 자동 재개 (복귀 예정일을 새 결제 기준일로 설정) + 원장님께 알림
// 3) 복귀일 미정(resume_date 없음)인 회원: 30일마다 "아직 정지 중이에요" 알림 (잊혀지지 않게)
//
// 모든 단계는 플래그(pause_notice_sent / pause_checkin_at)와 상태 변경으로 중복 실행에 안전합니다.
const cron = require("node-cron");
const db = require("../db");
const { sendPushToOwners } = require("../services/pushService");
const { ensurePauseColumns, logPauseEnd } = require("../migrations/pauseColumns");

const NOTICE_DAYS_BEFORE = 7; // 복귀 며칠 전에 안내할지
const CHECKIN_EVERY_DAYS = 30; // 복귀일 미정 회원 점검 주기

function getTodayNY() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  return toDateString(now);
}

function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 'YYYY-MM-DD' 문자열에 days를 더/뺀 'YYYY-MM-DD' (시간대 영향을 받지 않도록 UTC로 계산)
function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatReadable(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function insertNotification(dojangCode, message, type, studentId, parentPhone = null) {
  await db.query(
    `INSERT INTO notifications (dojang_code, message, type, student_id, parent_phone, date, is_read)
     VALUES (?, ?, ?, ?, ?, NOW(), 0)`,
    [dojangCode, message, type, studentId, parentPhone]
  );
}

// 같은 학생이 monthly_payments 행을 여러 개 가지고 있어도 학생당 한 번만 처리하도록 묶음
function groupByStudent(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.student_id)) map.set(row.student_id, { ...row, ids: [row.id] });
    else map.get(row.student_id).ids.push(row.id);
  }
  return [...map.values()];
}

function countByDojang(items) {
  const counts = {};
  for (const item of items) counts[item.dojang_code] = (counts[item.dojang_code] || 0) + 1;
  return counts;
}

// 2) 복귀 예정일이 된(또는 지난) 회원 자동 재개 — 안내 전에 먼저 처리해서 같은 날 중복 안내를 막음
async function autoResumeDueMembers(today) {
  const [rows] = await db.query(
    `SELECT mp.id, mp.student_id, mp.dojang_code,
            DATE_FORMAT(mp.resume_date, '%Y-%m-%d') AS resume_date,
            s.first_name, s.last_name
     FROM monthly_payments mp
     JOIN students s ON s.id = mp.student_id
     WHERE mp.pause_status = 'paused' AND mp.resume_date IS NOT NULL AND mp.resume_date <= ?`,
    [today]
  );
  if (rows.length === 0) return 0;

  for (const row of rows) {
    try {
      await db.query(
        `UPDATE monthly_payments
         SET pause_status = 'none', paused_at = NULL, resume_date = NULL, pause_reason = NULL,
             pause_notice_sent = 0, pause_checkin_at = NULL,
             next_payment_date = ?, payment_status = 'pending', day_notification_3 = 0
         WHERE id = ? AND pause_status = 'paused'`,
        [row.resume_date, row.id]
      );
      await logPauseEnd(row.student_id, row.dojang_code); // 정지 이력에 복귀 기록
    } catch (err) {
      console.error(`❌ [pause] 자동 재개 실패 (monthly_payments #${row.id}):`, err.message);
    }
  }

  const students = groupByStudent(rows);
  for (const st of students) {
    try {
      await insertNotification(
        st.dojang_code,
        `▶️ ${st.first_name} ${st.last_name}'s pause has ended. Billing has restarted (next charge: ${st.resume_date}).`,
        "pause_ended",
        st.student_id
      );
    } catch (err) {
      console.error("❌ [pause] 재개 알림 생성 실패:", err.message);
    }
  }

  for (const [dojangCode, count] of Object.entries(countByDojang(students))) {
    await sendPushToOwners(
      dojangCode,
      "▶️ 일시정지 회원이 복귀했어요",
      `정지가 끝나 결제가 다시 시작되는 회원이 ${count}명 있어요.`,
      { type: "pause_ended" }
    );
  }
  return students.length;
}

// 1) 복귀 7일 전 안내
async function sendUpcomingResumeNotices(today) {
  const limit = addDays(today, NOTICE_DAYS_BEFORE);
  const [rows] = await db.query(
    `SELECT mp.id, mp.student_id, mp.dojang_code,
            DATE_FORMAT(mp.resume_date, '%Y-%m-%d') AS resume_date,
            s.first_name, s.last_name, p.phone AS parent_phone
     FROM monthly_payments mp
     JOIN students s ON s.id = mp.student_id
     LEFT JOIN parents p ON p.id = s.parent_id
     WHERE mp.pause_status = 'paused' AND mp.resume_date IS NOT NULL
       AND mp.pause_notice_sent = 0
       AND mp.resume_date > ? AND mp.resume_date <= ?`,
    [today, limit]
  );
  if (rows.length === 0) return 0;

  const students = groupByStudent(rows);
  for (const st of students) {
    try {
      const dateText = formatReadable(st.resume_date);
      const draft = `Hi! Just a friendly heads-up that ${st.first_name}'s membership pause ends on ${dateText}, and monthly billing will restart on that date. If you'd like to extend the pause or change anything before then, please let us know. We're looking forward to seeing ${st.first_name} back on the mat!`;

      await insertNotification(st.dojang_code, draft, "pause_ending_draft", st.student_id, st.parent_phone || null);

      await db.query(`UPDATE monthly_payments SET pause_notice_sent = 1 WHERE id IN (?)`, [st.ids]);
    } catch (err) {
      console.error(`❌ [pause] 복귀 안내 생성 실패 (student ${st.student_id}):`, err.message);
    }
  }

  for (const [dojangCode, count] of Object.entries(countByDojang(students))) {
    await sendPushToOwners(
      dojangCode,
      "⏸️ 곧 정지가 끝나는 회원이 있어요",
      `복귀가 일주일 이내인 회원 ${count}명의 안내 문자 초안이 준비됐어요. 학부모께 결제 재개를 미리 알려주세요.`,
      { type: "pause_ending_draft" }
    );
  }
  return students.length;
}

// 3) 복귀일 미정 회원 점검 (30일마다)
async function sendOpenEndedCheckins(today) {
  const threshold = addDays(today, -CHECKIN_EVERY_DAYS);
  const [rows] = await db.query(
    `SELECT mp.id, mp.student_id, mp.dojang_code,
            DATE_FORMAT(mp.paused_at, '%Y-%m-%d') AS paused_at,
            s.first_name, s.last_name
     FROM monthly_payments mp
     JOIN students s ON s.id = mp.student_id
     WHERE mp.pause_status = 'paused' AND mp.resume_date IS NULL
       AND DATE(mp.paused_at) <= ?
       AND (mp.pause_checkin_at IS NULL OR mp.pause_checkin_at <= ?)`,
    [threshold, threshold]
  );
  if (rows.length === 0) return 0;

  const students = groupByStudent(rows);
  for (const st of students) {
    try {
      await insertNotification(
        st.dojang_code,
        `⏸️ ${st.first_name} ${st.last_name} has been on pause since ${st.paused_at} with no return date. Planning to return? You can resume or cancel the membership from the student's profile.`,
        "pause_checkin",
        st.student_id
      );
      await db.query(`UPDATE monthly_payments SET pause_checkin_at = ? WHERE id IN (?)`, [today, st.ids]);
    } catch (err) {
      console.error(`❌ [pause] 점검 알림 생성 실패 (student ${st.student_id}):`, err.message);
    }
  }

  for (const [dojangCode, count] of Object.entries(countByDojang(students))) {
    await sendPushToOwners(
      dojangCode,
      "⏸️ 오래 정지 중인 회원이 있어요",
      `복귀일이 정해지지 않은 채 한 달 넘게 정지 중인 회원이 ${count}명 있어요. 복귀 여부를 확인해보세요.`,
      { type: "pause_checkin" }
    );
  }
  return students.length;
}

async function runPauseJobs() {
  try {
    if (!(await ensurePauseColumns())) {
      console.log("⏭️ [pause] 정지 컬럼이 아직 없어 건너뜁니다.");
      return;
    }
    const today = getTodayNY();
    const resumed = await autoResumeDueMembers(today);
    const notified = await sendUpcomingResumeNotices(today);
    const checkins = await sendOpenEndedCheckins(today);
    console.log(`✅ [pause] 자동 재개 ${resumed}명 / 복귀 안내 ${notified}명 / 장기 정지 점검 ${checkins}명`);
  } catch (err) {
    console.error("❌ [pause] 스케줄러 실행 중 오류:", err);
  }
}

const startPauseScheduler = () => {
  // 매일 오전 9시 (뉴욕 시간)
  cron.schedule("0 9 * * *", () => runPauseJobs(), { scheduled: true, timezone: "America/New_York" });

  // 서버가 9시에 꺼져 있었던 경우를 대비해 켜진 뒤 1분 후 한 번 더 확인 (플래그 덕분에 중복 안내는 없음)
  setTimeout(() => runPauseJobs(), 60 * 1000);
};

module.exports = { startPauseScheduler, runPauseJobs };
