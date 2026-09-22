// testEligibilityScheduler.js
// 학생이 등원(출석 체크)할 때, 현재 벨트에서 요구되는 출석 횟수(testcondition.attendance_required)를
// 이번 출석으로 채웠는지 확인해서 사장님께 알림을 보냄.
// - 생일파티 안내와 같은 방식: 출석 체크 직후 실시간으로 확인 (별도 스케줄 없음)
// - 벨트 사이클당(현재 belt_rank 기준) 딱 한 번만 알림 - reminder_log를 "이 학생/이 벨트에서
//   이미 알림을 보냈는지" 체크용 플래그 테이블로 재사용 (ref_date는 의미 없는 고정값 사용)
const db = require("../db");
const { sendPushToOwners } = require("../services/pushService");

const CLAIM_SENTINEL_DATE = "2000-01-01"; // 날짜 단위 중복 방지가 아니라 "한 번만" 체크용 고정값

async function tryClaimOnce(dojang_code, type) {
  try {
    await db.query(
      `INSERT INTO reminder_log (dojang_code, type, ref_date) VALUES (?, ?, ?)`,
      [dojang_code, type, CLAIM_SENTINEL_DATE]
    );
    return true;
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return false; // 이미 이 벨트 사이클에 알림을 보냄
    console.error(`❌ [test-eligibility] reminder_log 기록 실패 (${type}):`, err.message);
    return false;
  }
}

// 출석 체크(mark-attendance) 시 호출.
async function checkTestEligibilityOnAttendance(dojang_code, studentId) {
  try {
    const [studentRows] = await db.query(
      `SELECT id, first_name, last_name, belt_rank FROM students WHERE id = ? AND dojang_code = ?`,
      [studentId, dojang_code]
    );
    const student = studentRows[0];
    if (!student || student.belt_rank === null || student.belt_rank === undefined) return;

    // 현재 벨트 랭크에 해당하는 테스트 조건 조회 (routes/test.js의 get-test-condition과 동일한 방식)
    const [conditionRows] = await db.query(
      `SELECT attendance_required, test_type FROM testcondition
       WHERE ? BETWEEN belt_min_rank AND belt_max_rank AND dojang_code = ?
       LIMIT 1`,
      [student.belt_rank, dojang_code]
    );
    const condition = conditionRows[0];
    if (!condition || !condition.attendance_required) return; // 이 벨트에 설정된 조건이 없음

    // 이 벨트에서의 출석 횟수 (벨트 승급 시 attendance가 초기화되므로 이번 벨트에서의 순수 횟수)
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM attendance WHERE student_id = ? AND belt_rank = ? AND dojang_code = ?`,
      [studentId, student.belt_rank, dojang_code]
    );
    const attendanceCount = countRows[0].cnt;

    if (attendanceCount < condition.attendance_required) return; // 아직 조건 미달

    const claimType = `test_eligible_${studentId}_${student.belt_rank}`;
    const claimed = await tryClaimOnce(dojang_code, claimType);
    if (!claimed) return; // 이번 벨트 사이클에 이미 알림을 보냈음

    const fullName = `${student.first_name} ${student.last_name || ""}`.trim();

    await sendPushToOwners(
      dojang_code,
      "🥋 테스트 조건 달성",
      `${fullName} 학생이 테스트 조건(${condition.attendance_required}회 출석)을 채웠습니다. 테스트 명단에 추가해주세요!`,
      { type: "test_eligible", studentId, beltRank: student.belt_rank, testType: condition.test_type || null }
    );

    console.log(`✅ [test-eligibility] ${dojang_code} / ${fullName}: 테스트 조건 달성 알림 발송 (belt_rank=${student.belt_rank}, ${attendanceCount}/${condition.attendance_required})`);
  } catch (err) {
    console.error("❌ [test-eligibility] 체크 실패:", err.message);
  }
}

module.exports = { checkTestEligibilityOnAttendance };
