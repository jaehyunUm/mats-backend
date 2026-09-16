// backend/migrations/runMigrations.js
// 서버가 켜질 때 한 번 실행되는 아주 가벼운 자체 마이그레이션.
// 이미 적용된 변경사항이면 조용히 건너뛰도록 IF NOT EXISTS / try-catch로 안전하게 처리합니다.
const db = require("../db");

async function runMigrations() {
  // 1. notifications 테이블에 parent_phone 컬럼 추가
  //    (반자동 문자 초안에서 "이 번호로 보내세요"를 보여주기 위해 필요)
  try {
    await db.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(20) NULL`);
    console.log("✅ [migration] notifications.parent_phone 컬럼 확인/추가 완료");
  } catch (err) {
    console.error("⚠️ [migration] notifications.parent_phone 컬럼 추가 실패 (무시하고 계속 진행):", err.message);
  }

  // 2. push_tokens 테이블 생성
  //    (사장님/스태프 휴대폰의 Expo 푸시 토큰을 저장 — 문자 초안이 준비되면 여기로 푸시를 보냅니다)
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS push_tokens (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        dojang_code VARCHAR(50) NOT NULL,
        expo_push_token VARCHAR(255) NOT NULL,
        platform VARCHAR(20) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_expo_push_token (expo_push_token),
        KEY idx_dojang_code (dojang_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    console.log("✅ [migration] push_tokens 테이블 확인/생성 완료");
  } catch (err) {
    console.error("⚠️ [migration] push_tokens 테이블 생성 실패 (무시하고 계속 진행):", err.message);
  }

  // 3. push_tokens 테이블에 role 컬럼 추가
  //    (같은 앱을 사장님/학부모가 함께 쓰기 때문에, user_id만으로는 users.id와 parents.id가
  //     서로 겹칠 수 있어 role로 반드시 구분해야 스파링 알림을 엉뚱한 사람에게 보내지 않습니다)
  try {
    await db.query(`ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS role VARCHAR(20) NULL`);
    console.log("✅ [migration] push_tokens.role 컬럼 확인/추가 완료");
  } catch (err) {
    console.error("⚠️ [migration] push_tokens.role 컬럼 추가 실패 (무시하고 계속 진행):", err.message);
  }

  // 4. reminder_log 테이블 생성
  //    (스파링/휴일 "7일 전" 알림을 도장당 하루에 한 번만 보내도록 중복 방지용으로 사용)
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS reminder_log (
        id INT NOT NULL AUTO_INCREMENT,
        dojang_code VARCHAR(50) NOT NULL,
        type VARCHAR(20) NOT NULL,
        ref_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_reminder (dojang_code, type, ref_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    console.log("✅ [migration] reminder_log 테이블 확인/생성 완료");
  } catch (err) {
    console.error("⚠️ [migration] reminder_log 테이블 생성 실패 (무시하고 계속 진행):", err.message);
  }
}

module.exports = runMigrations;
