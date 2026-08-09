const cron = require("node-cron");
const db = require("../db"); // 실제 db 연결 파일 경로
const createNotification = require("./createNotification"); // ⭐️ 방금 만든 알림 함수 불러오기 (경로 확인 필수!)

// 생일자를 찾아 알림을 생성하는 핵심 로직
async function checkAndCreateBirthdayNotifications() {
  try {
    // 1. 학생 ID도 같이 가져오도록 'id' 추가
    const [birthdayStudents] = await db.query(`
      SELECT id, first_name, last_name, dojang_code 
      FROM students 
      WHERE DATE_FORMAT(birth_date, '%m-%d') = DATE_FORMAT(CURDATE(), '%m-%d')
    `);

    if (birthdayStudents.length === 0) {
      console.log("✅ 오늘 생일인 학생이 없습니다.");
      return;
    }

    let successCount = 0;

    for (const student of birthdayStudents) {
      const message = `🎉 Happy Birthday to ${student.first_name} ${student.last_name}!`;
      
      // ⭐️ 우리가 만든 튼튼한 알림 함수 사용 (type은 'birthday'로 지정)
      await createNotification(
        student.dojang_code, 
        message, 
        'birthday', 
        student.id
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
  // ⭐️ timezone 옵션을 추가하여 조지아주(미국 동부) 시간에 정확히 맞춥니다!
  cron.schedule('0 9 * * *', () => {
    console.log(`[${new Date().toISOString()}] 생일자 스케줄러 실행 중...`);
    checkAndCreateBirthdayNotifications();
  }, {
    scheduled: true,
    timezone: "America/New_York" // 애틀랜타/스머나 시간대
  });
};

module.exports = { startBirthdayScheduler, checkAndCreateBirthdayNotifications };