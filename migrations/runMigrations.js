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
  //    ⚠️ "ADD COLUMN IF NOT EXISTS ... AFTER ..." 조합이 일부 MySQL/MariaDB 버전에서
  //    조용히 실패하는 경우가 있어서(실제로 발생: 컬럼이 안 생겨서 INSERT가
  //    "Unknown column 'event_end_date'" 에러로 실패했음), INFORMATION_SCHEMA로
  //    컬럼 존재 여부를 직접 확인한 뒤 plain ALTER TABLE을 실행하는 방식으로 변경.
  try {
    const [existingCols] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_schedule' AND COLUMN_NAME = 'event_end_date'`
    );
    if (existingCols.length === 0) {
      await db.query(`ALTER TABLE event_schedule ADD COLUMN event_end_date DATE NULL AFTER event_date`);
      console.log("✅ [migration] event_schedule.event_end_date 컬럼 추가 완료");
    } else {
      console.log("✅ [migration] event_schedule.event_end_date 컬럼 이미 존재");
    }
  } catch (err) {
    console.error("⚠️ [migration] event_schedule.event_end_date 컬럼 추가 실패 (무시하고 계속 진행):", err.message);
  }

  // 8. 대회(Tournament) 관련 테이블 생성
  //    관리자가 앱에서 직접 대회 설정(참가비 규칙, 종목, 송판값 표)을 하고,
  //    학부모가 종목을 골라 카드로 등록/결제하는 기능을 위한 테이블들.
  //    기존 이벤트(event_schedule, 캘린더용)와는 완전히 별개라 접두어 tournament_ 를 사용합니다.
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id INT NOT NULL AUTO_INCREMENT,
        dojang_code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        event_date DATE NOT NULL,
        location VARCHAR(255) NULL,
        registration_deadline DATE NOT NULL,
        is_open TINYINT(1) NOT NULL DEFAULT 0,
        fee_one_event DECIMAL(10,2) NULL,
        fee_two_events DECIMAL(10,2) NOT NULL DEFAULT 0,
        fee_additional DECIMAL(10,2) NOT NULL DEFAULT 0,
        description TEXT NULL,
        waiver_text TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_tournament_dojang (dojang_code, event_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS tournament_events (
        id INT NOT NULL AUTO_INCREMENT,
        tournament_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description VARCHAR(500) NULL,
        board_type VARCHAR(10) NOT NULL DEFAULT 'none',
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        KEY idx_tevent_tournament (tournament_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS tournament_board_prices (
        id INT NOT NULL AUTO_INCREMENT,
        tournament_id INT NOT NULL,
        board_type VARCHAR(10) NOT NULL,
        age_min INT NOT NULL,
        age_max INT NOT NULL,
        max_boards INT NULL,
        board_size VARCHAR(50) NULL,
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        KEY idx_tboard_tournament (tournament_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS tournament_registrations (
        id INT NOT NULL AUTO_INCREMENT,
        tournament_id INT NOT NULL,
        dojang_code VARCHAR(50) NOT NULL,
        student_id INT NOT NULL,
        parent_id INT NOT NULL,
        age_at_event INT NOT NULL,
        belt VARCHAR(100) NULL,
        gender VARCHAR(20) NULL,
        weight VARCHAR(20) NULL,
        height VARCHAR(20) NULL,
        medical_json TEXT NULL,
        signed_name VARCHAR(255) NULL,
        signed_at DATETIME NULL,
        entry_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        board_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        total DECIMAL(10,2) NOT NULL DEFAULT 0,
        payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
        payment_intent_id VARCHAR(255) NULL,
        idempotency_key VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_tournament_student (tournament_id, student_id),
        KEY idx_treg_dojang (dojang_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS tournament_registration_events (
        id INT NOT NULL AUTO_INCREMENT,
        registration_id INT NOT NULL,
        event_id INT NOT NULL,
        board_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        max_boards INT NULL,
        board_size VARCHAR(50) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_reg_event (registration_id, event_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    console.log("✅ [migration] tournament_* 테이블 확인/생성 완료");
  } catch (err) {
    console.error("⚠️ [migration] tournament_* 테이블 생성 실패 (무시하고 계속 진행):", err.message);
  }

  // 9. 대회 Wave(시간대/나이대 그룹) 테이블 생성
  //    예: Wave I (4~5세, 9:00am~11:00am), Wave II (6~8세), Wave III (9세 이상).
  //    학생의 Wave는 별도로 저장하지 않고 "대회 당일 나이"로 그때그때 계산하므로,
  //    나중에 구간을 고쳐도 명단이 자동으로 다시 나뉩니다.
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tournament_waves (
        id INT NOT NULL AUTO_INCREMENT,
        tournament_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        age_min INT NOT NULL,
        age_max INT NOT NULL,
        schedule VARCHAR(255) NULL,
        sort_order INT NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        KEY idx_twave_tournament (tournament_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    console.log("✅ [migration] tournament_waves 테이블 확인/생성 완료");
  } catch (err) {
    console.error("⚠️ [migration] tournament_waves 테이블 생성 실패 (무시하고 계속 진행):", err.message);
  }
}

module.exports = runMigrations;
