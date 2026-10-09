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

// ─────────────────────────────────────────────────────────────
// 정지 이력 (student_pause_history)
// monthly_payments는 "재개"하면 정지 정보가 지워지기 때문에, 성장 화면(Growth)에서
// "이번 해에 누가 언제 정지했고 언제 돌아왔는지" 볼 수 있도록 별도 이력 테이블에 기록합니다.
// 이력 기록이 실패해도 정지/재개 자체는 절대 막지 않습니다(에러는 로그만 남김).
// ─────────────────────────────────────────────────────────────
let historyPromise = null;

function ensurePauseHistoryTable() {
  if (!historyPromise) {
    historyPromise = (async () => {
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS student_pause_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_id INT NOT NULL,
            dojang_code VARCHAR(64) NOT NULL,
            paused_at DATETIME NOT NULL,
            resume_date DATE NULL,
            reason VARCHAR(255) NULL,
            resumed_at DATETIME NULL,
            INDEX idx_pause_hist_dojang (dojang_code, paused_at),
            INDEX idx_pause_hist_student (student_id, resumed_at)
          )
        `);
        return true;
      } catch (err) {
        console.error("⚠️ [migration] student_pause_history 테이블 확인/생성 실패:", err.message);
        historyPromise = null;
        return false;
      }
    })();
  }
  return historyPromise;
}

// 정지 시작(또는 이미 정지 중이면 복귀 예정일/사유 갱신) 기록
async function logPauseStart(studentId, dojangCode, resumeDate, reason) {
  try {
    if (!(await ensurePauseHistoryTable())) return;
    const [open] = await db.query(
      `SELECT id FROM student_pause_history WHERE student_id = ? AND dojang_code = ? AND resumed_at IS NULL ORDER BY id DESC LIMIT 1`,
      [studentId, dojangCode]
    );
    if (open.length > 0) {
      await db.query(`UPDATE student_pause_history SET resume_date = ?, reason = ? WHERE id = ?`, [
        resumeDate || null,
        reason || null,
        open[0].id,
      ]);
    } else {
      await db.query(
        `INSERT INTO student_pause_history (student_id, dojang_code, paused_at, resume_date, reason) VALUES (?, ?, NOW(), ?, ?)`,
        [studentId, dojangCode, resumeDate || null, reason || null]
      );
    }
  } catch (err) {
    console.error("⚠️ [pause-history] 정지 기록 실패:", err.message);
  }
}

// 재개(수동/자동) 기록 - 열려 있는 정지 이력을 닫음
async function logPauseEnd(studentId, dojangCode) {
  try {
    if (!(await ensurePauseHistoryTable())) return;
    await db.query(
      `UPDATE student_pause_history SET resumed_at = NOW() WHERE student_id = ? AND dojang_code = ? AND resumed_at IS NULL`,
      [studentId, dojangCode]
    );
  } catch (err) {
    console.error("⚠️ [pause-history] 재개 기록 실패:", err.message);
  }
}

module.exports = { ensurePauseColumns, pausedExclusionClause, ensurePauseHistoryTable, logPauseStart, logPauseEnd };
