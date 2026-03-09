const cron = require("node-cron");
const db = require("../db"); // 실제 db 연결 파일 경로에 맞게 수정해주세요.

// 생일자를 찾아 알림을 생성하는 핵심 로직
async function checkAndCreateBirthdayNotifications() {
  try {
    // 1. students 테이블에서 오늘 날짜(월-일)와 birth_date(월-일)가 일치하는 학생 조회
    const [birthdayStudents] = await db.query(`
      SELECT first_name, last_name, dojang_code 
      FROM students 
      WHERE DATE_FORMAT(birth_date, '%m-%d') = DATE_FORMAT(CURDATE(), '%m-%d')
    `);

    // 오늘 생일인 학생이 없으면 종료
    if (birthdayStudents.length === 0) {
      console.log("✅ 오늘 생일인 학생이 없습니다.");
      return;
    }

    let successCount = 0;

    // 2. 생일인 학생들을 순회하며 notifications 테이블에 알림 추가
    for (const student of birthdayStudents) {
      // 알림 메시지 생성 (원하시는 문구로 자유롭게 수정 가능합니다)
      const message = `🎉 Happy Birthday to ${student.first_name} ${student.last_name}!`;
      
      await db.query(
        `INSERT INTO notifications (dojang_code, message) VALUES (?, ?)`,
        [student.dojang_code, message]
      );
      successCount++;
    }

    console.log(`✅ 생일자 스케줄러 완료: 총 ${successCount}명의 생일 알림이 생성되었습니다.`);
  } catch (error) {
    console.error("❌ 생일자 스케줄러 실행 중 오류 발생:", error);
  }
}

// 스케줄러 실행 함수 (매일 오전 9시 정각에 실행)
const startBirthdayScheduler = () => {
  cron.schedule('0 9 * * *', () => {
    console.log(`[${new Date().toISOString()}] 생일자 스케줄러 실행 중...`);
    checkAndCreateBirthdayNotifications();
  });
};

module.exports = { startBirthdayScheduler, checkAndCreateBirthdayNotifications };