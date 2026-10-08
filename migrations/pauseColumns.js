// backend/migrations/pauseColumns.js
// 회원 일시정지(Pause) 기능에 필요한 monthly_payments 컬럼을 자동으로 확인/추가합니다.
//
// - pause_status       : 'none' (정상) | 'paused' (일시정지 중). 'paused'면 자동결제/현금 알림/결석 문자에서 제외됩니다.
// - paused_at          : 정지를 시작한 시각
// - resume_date        : 복귀 예정일 (NULL이면 "복귀일 미정" - 원장님이 직접 Resume 할 때까지 정지 유지)
// - pause_reason       : 정지 사유 (선택)
// - pause_notice_sent  : 복귀 7일 전 안내(원장 알림 + 학부모 문자 초안)를 이미 보냈는지
// - pause_checkin_at   : "복귀일 미정" 회원에 대해 마지막으로 "아직 정지 중이에요" 알림을 보낸 날짜
//
// 결과는 한 번만 계산해서 재사용하고(메모이제이션), 실패하면 false를 돌려줍니다.
// → 컬럼 추가에 실패해도 기존 결제 로직은 "정지 필터 없이" 그대로 동작해서 결제가 멈추는 일이 없습니다.
const db = require("../db");

const PAUSE_COLUMNS = [
  ["pause_status", "VARCHAR(10) NOT NULL DEFAULT 'none'"],
  ["paused_at", "DATETIME NULL"],
  ["resume_date", "DATE NULL"],
  ["pause_reason", "VARCHAR(255) NULL"],
  ["pause_notice_sent", "TINYINT(1) NOT NULL DEFAULT 0"],
  ["pause_checkin_at", "DATE NULL"],
];

let cachedPromise = null;

async function runEnsure() {
  try {
    const [existing] = await db.query(
      `SELECT COLUMN_NAME AS col FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'monthly_payments'`
    );
    const have = new Set(existing.map((r) => r.col));

    for (const [name, definition] of PAUSE_COLUMNS) {
      if (!have.has(name)) {
        await db.query(`ALTER TABLE monthly_payments ADD COLUMN ${name} ${definition}`);
        console.log(`✅ [migration] monthly_payments.${name} 컬럼 추가 완료`);
      }
    }
    console.log("✅ [migration] monthly_payments 일시정지 컬럼 확인 완료");
    return true;
  } catch (err) {
    console.error("⚠️ [migration] monthly_payments 일시정지 컬럼 확인/추가 실패:", err.message);
    cachedPromise = null; // 다음 호출 때 다시 시도
    return false;
  }
}

function ensurePauseColumns() {
  if (!cachedPromise) cachedPromise = runEnsure();
  return cachedPromise;
}

// 자동결제 등 "정지된 회원 제외" SQL 조각. 컬럼이 없으면 빈 문자열(= 기존 동작 그대로).
async function pausedExclusionClause(alias = "mp") {
  return (await ensurePauseColumns()) ? `AND ${alias}.pause_status <> 'paused'` : "";
}

module.exports = { ensurePauseColumns, pausedExclusionClause };
