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

  // 4. notifications 테이블에 type / student_id / recipient_id / created_at 컬럼 추가
  //    (스케줄러들(absenceScheduler, birthdayScheduler, createNotification.js)과
  //     test-invite 라우트가 INSERT할 때 이 컬럼들을 사용하는데, 실제 DB에는 없어서
  //     INSERT/SELECT가 전부 "Unknown column" 에러로 조용히 실패하고 있었음.
  //     (관리자 앱에서 "안읽은 알림 7개"라고 뜨는데 알림 목록 화면은 텅 비어 보이는 버그의 원인:
  //      unread-count 쿼리는 COUNT(*)만 쓰기 때문에 안 걸리고, 목록을 가져오는
  //      GET /notifications 쿼리는 SELECT ...type, student_id... 를 쓰기 때문에 에러가 났던 것.)
  try {
    await db.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) NULL`);
    await db.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS student_id INT NULL`);
    await db.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_id INT NULL`);
    await db.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP`);
    console.log("✅ [migration] notifications.type / student_id / recipient_id / created_at 컬럼 확인/추가 완료");
  } catch (err) {
    console.error("⚠️ [migration] notifications 컬럼 추가 실패 (무시하고 계속 진행):", err.message);
  }

  // 5. reminder_log 테이블 생성
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

  // 6. event_schedule 테이블 생성
  //    (휴일/스파링과 달리 이벤트는 날짜만이 아니라 이름/시간/가격까지 필요해서 별도 테이블로 관리.
  //     7일 전 알림은 reminderScheduler.js의 checkEventReminders()에서 처리)
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS event_schedule (
        id INT NOT NULL AUTO_INCREMENT,
        dojang_code VARCHAR(50) NOT NULL,
        event_name VARCHAR(255) NOT NULL,
        event_date DATE NOT NULL,
        event_time VARCHAR(20) NULL,
        price DECIMAL(10,2) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_dojang_date (dojang_code, event_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    console.log("✅ [migration] event_schedule 테이블 확인/생성 완료");
  } catch (err) {
    console.error("⚠️ [migration] event_schedule 테이블 생성 실패 (무시하고 계속 진행):", err.message);
  }

  // 7. event_schedule 테이블에 event_end_date 컬럼 추가
  //    (여러 날 이어지는 이벤트(예: 6일짜리 캠프)를 한 번에 등록할 수 있도록 날짜 범위 지원.
  //     단일 날짜 이벤트는 NULL로 두고 event_date 하나만 사용)
  try {
    await db.query(`ALTER TABLE event_schedule ADD COLUMN IF NOT EXISTS event_end_date DATE NULL AFTER event_date`);
    console.log("✅ [migration] event_schedule.event_end_date 컬럼 확인/추가 완료");
  } catch (err) {
    console.error("⚠️ [migration] event_schedule.event_end_date 컬럼 추가 실패 (무시하고 계속 진행):", err.message);
  }
}

module.exports = runMigrations;
