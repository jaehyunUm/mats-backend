const cron = require("node-cron");
const db = require("../db");
const { sendPushToOwners } = require("../services/pushService");

// class_details.day 컬럼 형식과 반드시 동일해야 함 ("Thu"가 아니라 "Thur")
const DAY_COLUMNS = ["Sun", "Mon", "Tue", "Wed", "Thur", "Fri", "Sat"];

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

// 뉴욕(애틀랜타/스머나) 시간 기준 현재 시각
function getNowInNewYork() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
}

// 'YYYY-MM-DD' (뉴욕 시간 기준 오늘 날짜)
function getTodayDateString() {
  const now = getNowInNewYork();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// class_details.time은 "3:20~3:50", "7:10~7:50"처럼 AM/PM 구분 없이 저장되어 있음
// (이 도장은 전부 오후/저녁 수업이라는 전제). 끝나는 시간을 꺼내서
// 1~11시는 오후로 간주해 12를 더한 "HH:MM" 24시간 문자열로 바꿔줌.
function parseClassEndTime24h(timeRange) {
  if (!timeRange || !timeRange.includes("~")) return null;
  const endPart = timeRange.split("~")[1]?.trim();
  const match = endPart && endPart.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  if (hour >= 1 && hour <= 11) hour += 12; // 오후로 간주
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

// 오늘 이 도장에 대해 이미 결석 체크를 실행했는지 확인 (reminder_log 재사용, 서버 재시작 등으로 인한 중복 실행 방지)
async function tryClaimAbsenceCheck(dojang_code, dateStr) {
  try {
    await db.query(
      `INSERT INTO reminder_log (dojang_code, type, ref_date) VALUES (?, 'absence_check', ?)`,
      [dojang_code, dateStr]
    );
    return true;
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return false;
    console.error(`❌ [absence] reminder_log 기록 실패 (${dojang_code}, ${dateStr}):`, err.message);
    return false;
  }
}

// 오늘 이미 해당 type의 초안을 만들었는지 확인 (같은 학생이 오늘 여러 수업을 결석해도 문자 초안은 한 번만)
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

// 매 분마다 실행: 오늘 요일 기준으로 "방금 마지막 수업이 끝난" 도장을 찾아서
// 그 도장의 결석 체크(Attendance 테이블 기준)와 문자 초안 생성을 진행함.
// - 예전엔 사장님이 앱에서 "Absence" 탭을 눌러 수동으로 결석 처리를 해야만 문자 초안이 생겼는데,
//   이제는 수업에 등록됐는데 attendance 기록이 없는 학생을 자동으로 결석 처리함.
// - 도장마다, 그리고 요일마다 마지막 수업 끝나는 시간이 다르므로(월요일 7:10, 수요일 7:50 등),
//   고정된 시각 하나가 아니라 class_details 데이터를 보고 그날그날 실제 마지막 수업이 끝나는
//   시각을 계산해서 그 시각에 맞춰 실행함.
async function checkAndPrepareAbsenceDrafts() {
  try {
    const now = getNowInNewYork();
    const dayColumn = DAY_COLUMNS[now.getDay()];
    const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const todayStr = getTodayDateString();

    // 오늘 요일에 수업이 있는 모든 도장의 수업 시간을 가져와서, 도장별 "마지막 수업 끝나는 시간"을 계산
    const [classRows] = await db.query(
      `SELECT class_id, dojang_code, time FROM class_details WHERE day = ?`,
      [dayColumn]
    );

    if (classRows.length === 0) return;

    const lastEndTimeByDojang = {};
    for (const row of classRows) {
      const endTime = parseClassEndTime24h(row.time);
      if (!endTime) continue;
      if (!lastEndTimeByDojang[row.dojang_code] || endTime > lastEndTimeByDojang[row.dojang_code]) {
        lastEndTimeByDojang[row.dojang_code] = endTime;
      }
    }

    for (const [dojang_code, lastEndTime] of Object.entries(lastEndTimeByDojang)) {
      if (currentHHMM !== lastEndTime) continue; // 아직 마지막 수업 전이거나 이미 지나간 도장은 건너뜀

      const claimed = await tryClaimAbsenceCheck(dojang_code, todayStr);
      if (!claimed) continue; // 오늘 이미 실행함

      await processAbsencesForDojang(dojang_code, dayColumn, todayStr);
    }
  } catch (error) {
    console.error("❌ 결석 알림 스케줄러 실행 중 오류 발생:", error);
  }
}

// 한 도장의 오늘 결석 처리: attendance 테이블 기준으로 결석자를 찾아서
// 1) absences 테이블에 기록하고 연속 결석 카운트를 올리고 (기존 수동 mark-absence와 동일한 효과)
// 2) 학부모에게 보낼 문자 초안(하루 1건/학생)을 만듦
async function processAbsencesForDojang(dojang_code, dayColumn, todayStr) {
  try {
    // 오늘 이 도장에서 열린 수업에 등록됐는데 attendance 기록이 없는 학생 = 결석
    // (수업/학생 조합 단위로 가져와야 연속 결석 카운트를 정확히 올릴 수 있음)
    const [absentRows] = await db.query(
      `SELECT
         s.id AS student_id, s.first_name, s.last_name, s.gender,
         p.phone AS parent_phone,
         cd.class_id
       FROM class_details cd
       JOIN student_classes sc ON sc.class_id = cd.class_id AND sc.dojang_code = cd.dojang_code
       JOIN students s ON s.id = sc.student_id
       LEFT JOIN parents p ON s.parent_id = p.id
       LEFT JOIN attendance a
         ON a.student_id = s.id AND a.class_id = cd.class_id
         AND a.dojang_code = cd.dojang_code AND a.attendance_date = ?
       WHERE cd.dojang_code = ? AND cd.day = ? AND a.student_id IS NULL`,
      [todayStr, dojang_code, dayColumn]
    );

    if (absentRows.length === 0) {
      console.log(`✅ [absence] ${dojang_code}: 오늘(${dayColumn}) 결석한 학생이 없습니다.`);
      return;
    }

    let createdDraftCount = 0;
    const notifiedStudentIds = new Set();

    for (const row of absentRows) {
      // 1) absences 테이블에 기록 + 연속 결석 카운트 (기존 수동 "Absence" 탭과 동일한 동작)
      try {
        await db.query(
          `INSERT INTO absences (student_id, class_id, dojang_code, absence_date)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE absence_date = VALUES(absence_date)`,
          [row.student_id, row.class_id, dojang_code, todayStr]
        );

        await db.query(
          `UPDATE students SET consecutive_absences = consecutive_absences + 1 WHERE id = ? AND dojang_code = ?`,
          [row.student_id, dojang_code]
        );

        const [[updatedStudent]] = await db.query(
          `SELECT consecutive_absences FROM students WHERE id = ? AND dojang_code = ?`,
          [row.student_id, dojang_code]
        );

        if (updatedStudent && updatedStudent.consecutive_absences >= 2) {
          await db.query(
            `INSERT INTO notifications (dojang_code, message) VALUES (?, ?)`,
            [
              dojang_code,
              `Student ${row.first_name} ${row.last_name} has been absent for ${updatedStudent.consecutive_absences} consecutive classes.`,
            ]
          );
        }
      } catch (err) {
        console.error(`❌ [absence] ${dojang_code} / student ${row.student_id} 결석 기록 실패:`, err.message);
      }

      // 2) 학부모께 보낼 문자 초안 (같은 학생이 오늘 여러 수업을 결석해도 하루 1건만)
      if (notifiedStudentIds.has(row.student_id)) continue;
      notifiedStudentIds.add(row.student_id);

      const alreadyCreated = await hasAlreadyCreatedToday(row.student_id, "absence_draft");
      if (alreadyCreated) continue;

      const { subject, object } = getPronouns(row.gender);
      const dateStr = formatDateReadable(new Date());
      const draftMessage = `We missed ${row.first_name} today (${dateStr}) - just checking in to see if everything is okay. ${row.first_name} was marked absent from class, and we want to make sure ${subject} is doing well. If there's anything going on or any questions at all, please don't hesitate to reach out. We hope to see ${object} again soon!`;

      await db.query(
        `INSERT INTO notifications (dojang_code, message, type, student_id, parent_phone, date, is_read)
         VALUES (?, ?, 'absence_draft', ?, ?, NOW(), 0)`,
        [dojang_code, draftMessage, row.student_id, row.parent_phone || null]
      );

      createdDraftCount++;
    }

    if (createdDraftCount > 0) {
      await sendPushToOwners(
        dojang_code,
        "결석 안내 문자 초안이 준비됐어요",
        `오늘 결석한 학생 ${createdDraftCount}명의 문자 초안을 확인해보세요.`,
        { type: "absence_draft" }
      );
    }

    console.log(`✅ [absence] ${dojang_code}: 결석 문자 초안 ${createdDraftCount}건 생성 (오늘 결석 ${notifiedStudentIds.size}명).`);
  } catch (error) {
    console.error(`❌ [absence] ${dojang_code} 결석 처리 중 오류:`, error);
  }
}

// 매 분마다 확인 (도장/요일마다 마지막 수업이 끝나는 시각이 달라서 고정 시각으로 못 돌림)
const startAbsenceScheduler = () => {
  cron.schedule(
    "* * * * *",
    () => {
      checkAndPrepareAbsenceDrafts();
    },
    {
      scheduled: true,
      timezone: "America/New_York",
    }
  );
};

module.exports = { startAbsenceScheduler, checkAndPrepareAbsenceDrafts };
