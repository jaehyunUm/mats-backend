const cron = require("node-cron");
const db = require("../db");
const { sendPushToOwners } = require("../services/pushService");

// 생일파티 안내 "대상 구간": 생일 34일 전 ~ 28일 전 (구간 마지막 날 = 생일에 가장 가까운 28일 전)
const WINDOW_START_DAYS = 34;
const WINDOW_END_DAYS = 28;

// 뉴욕(애틀랜타/스머나) 시간 기준 현재 시각
function getNowInNewYork() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
}

// 시:분:초를 버리고 날짜만 남김 (날짜 단위 비교용)
function toDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function diffInDays(a, b) {
  return Math.round((toDateOnly(a).getTime() - toDateOnly(b).getTime()) / 86400000);
}

// 'YYYY-MM-DD' (SQL 조건용)
function toSqlDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 생년월일(month/day)만 보고 "오늘 이후 가장 가까운 다음 생일"을 계산
// (가입일은 신경 쓰지 않고 항상 다음 생일 기준으로 계산)
function getNextBirthday(birthDate, today) {
  const bd = new Date(birthDate);
  let next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < today) {
    next = new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate());
  }
  return next;
}

// 오늘이 이 학생의 "생일파티 안내 구간"(생일 34~28일 전) 안에 있는지 확인
function getWindowIfInside(birthDate, today) {
  const nextBirthday = getNextBirthday(birthDate, today);
  const windowStart = addDays(nextBirthday, -WINDOW_START_DAYS);
  const windowEnd = addDays(nextBirthday, -WINDOW_END_DAYS);
  if (today >= windowStart && today <= windowEnd) {
    return { nextBirthday, windowStart, windowEnd };
  }
  return null;
}

// 이번 생일 주기(windowStart 이후)에 이미 "안내 완료(Sent)" 처리된 초안이 있는지 확인
// -> 있으면 이미 안내를 마쳤다는 뜻이므로 더 이상 반복 알림을 띄우지 않음
async function alreadyConfirmedThisCycle(studentId, windowStart) {
  const [rows] = await db.query(
    `SELECT id FROM notifications
     WHERE student_id = ? AND type = 'birthday_party_draft' AND is_read = 1 AND date >= ?
     LIMIT 1`,
    [studentId, toSqlDateString(windowStart)]
  );
  return rows.length > 0;
}

// 이번 생일 주기에 초안이 (확인 여부와 상관없이) 한 번이라도 만들어졌는지 확인
// -> 등원 트리거로 이미 한 번이라도 떴었다면, "구간 마지막 날 강제 알림"은 불필요
async function anyDraftThisCycle(studentId, windowStart) {
  const [rows] = await db.query(
    `SELECT id FROM notifications
     WHERE student_id = ? AND type = 'birthday_party_draft' AND date >= ?
     LIMIT 1`,
    [studentId, toSqlDateString(windowStart)]
  );
  return rows.length > 0;
}

// 오늘 이미 이 학생 초안을 만들었는지 (하루 중복 방지 - 같은 학생이 하루에 여러 수업 등원해도 1건만)
async function alreadyCreatedToday(studentId) {
  const [rows] = await db.query(
    `SELECT id FROM notifications WHERE student_id = ? AND type = 'birthday_party_draft' AND DATE(date) = CURDATE() LIMIT 1`,
    [studentId]
  );
  return rows.length > 0;
}

function buildDraftMessage(student, nextBirthday) {
  const dateLabel = nextBirthday.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `${student.first_name}'s birthday is coming up on ${dateLabel}! We'd love to celebrate with a free birthday party at the studio - feel free to bring friends along, we'll give them a free mini taekwondo lesson too. Let us know if you'd like to book a date!`;
}

async function createDraftAndPush(dojang_code, student, nextBirthday) {
  const message = buildDraftMessage(student, nextBirthday);

  await db.query(
    `INSERT INTO notifications (dojang_code, message, type, student_id, parent_phone, date, is_read)
     VALUES (?, ?, 'birthday_party_draft', ?, ?, NOW(), 0)`,
    [dojang_code, message, student.id, student.parent_phone || null]
  );

  await sendPushToOwners(
    dojang_code,
    "🎂 생일파티 안내 타이밍이에요",
    `${student.first_name} 학생이 오늘 등원했어요 - 무료 생일파티 혜택을 안내해주세요!`,
    { type: "birthday_party_draft" }
  );
}

// ===== 1) 실시간 훅: 출석 체크(mark-attendance) 시 호출 =====
// 학생이 "생일 34~28일 전" 구간 안에 있고, 이번 생일 주기에 아직 안내를 마치지 않았다면
// 오늘 등원한 김에(=학부모를 직접 마주칠 가능성이 높은 날) 문자 초안 + 푸시를 띄움.
async function checkBirthdayPartyOnAttendance(dojang_code, studentId) {
  try {
    const [rows] = await db.query(
      `SELECT s.id, s.first_name, s.last_name, s.birth_date, p.phone AS parent_phone
       FROM students s
       LEFT JOIN parents p ON s.parent_id = p.id
       WHERE s.id = ? AND s.dojang_code = ?`,
      [studentId, dojang_code]
    );
    const student = rows[0];
    if (!student || !student.birth_date) return;

    const today = toDateOnly(getNowInNewYork());
    const window = getWindowIfInside(student.birth_date, today);
    if (!window) return; // 구간 밖이면 상관없음

    if (await alreadyConfirmedThisCycle(studentId, window.windowStart)) return; // 이미 안내 완료 처리됨
    if (await alreadyCreatedToday(studentId)) return; // 오늘 이미 만듦 (같은 날 여러 수업 등원 등)

    await createDraftAndPush(dojang_code, student, window.nextBirthday);
    console.log(`✅ [birthday-party] ${dojang_code} / ${student.first_name}: 등원 트리거로 생일파티 안내 초안 생성`);
  } catch (err) {
    console.error("❌ [birthday-party] 실시간 체크 실패:", err.message);
  }
}

// ===== 2) 매일 1회: 구간이 오늘로 끝나는데 그동안 한 번도 등원 기록이 없었던 학생 강제 처리 =====
// (휴원/장기 결석 등으로 등원 트리거가 한 번도 안 걸린 경우, 놓치지 않도록 구간 마지막 날 강제로 알림)
async function forceNotifyStudentsWithNoAttendanceInWindow() {
  try {
    const today = toDateOnly(getNowInNewYork());

    const [students] = await db.query(
      `SELECT s.id, s.first_name, s.last_name, s.birth_date, s.dojang_code, p.phone AS parent_phone
       FROM students s
       LEFT JOIN parents p ON s.parent_id = p.id
       WHERE s.birth_date IS NOT NULL`
    );

    for (const student of students) {
      const nextBirthday = getNextBirthday(student.birth_date, today);
      const windowStart = addDays(nextBirthday, -WINDOW_START_DAYS);
      const windowEnd = addDays(nextBirthday, -WINDOW_END_DAYS);

      if (diffInDays(today, windowEnd) !== 0) continue; // 오늘이 구간 마지막 날이 아니면 스킵

      const hasDraft = await anyDraftThisCycle(student.id, windowStart);
      if (hasDraft) continue; // 등원 트리거로 이미 한 번 이상 떴었음 -> 강제 알림 불필요

      await createDraftAndPush(student.dojang_code, student, nextBirthday);
      console.log(
        `✅ [birthday-party] ${student.dojang_code} / ${student.first_name}: 구간 내 등원 기록이 없어 마지막 날 강제 알림`
      );
    }
  } catch (err) {
    console.error("❌ [birthday-party] 강제 알림 체크 실패:", err.message);
  }
}

// 매일 아침 9시(뉴욕 시간)에 "구간 마지막 날인데 등원 기록이 없는" 학생을 확인
const startBirthdayPartyScheduler = () => {
  cron.schedule(
    "0 9 * * *",
    () => {
      console.log(`[${new Date().toISOString()}] 생일파티 안내 강제 체크 스케줄러 실행 중...`);
      forceNotifyStudentsWithNoAttendanceInWindow();
    },
    {
      scheduled: true,
      timezone: "America/New_York",
    }
  );
};

module.exports = {
  startBirthdayPartyScheduler,
  checkBirthdayPartyOnAttendance,
  forceNotifyStudentsWithNoAttendanceInWindow,
};
