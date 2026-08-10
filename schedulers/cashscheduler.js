const cron = require('node-cron');
const createNotification = require('./createNotification'); // 경로에 맞게 수정

// ⏰ 1분마다 실행 (테스트용, 테스트 끝나면 '0 9 * * *' 로 변경)
cron.schedule('* * * * *', async () => {
    console.log('⏰ Running daily cash payment check...');
    
    let connection;
    try {
      connection = await db.getConnection();
  
      // 1️⃣ 서버에서 '미국 동부 시간(America/New_York)' 기준으로 현재 날짜를 가져옵니다.
      const todayNY = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
      
      // 2️⃣ 동부 시간 기준 '오늘(8/9)'에서 딱 3일을 더합니다. (8/12 생성)
      todayNY.setDate(todayNY.getDate() + 3);
      
      // 3️⃣ 날짜를 'YYYY-MM-DD' 형식의 문자로 만듭니다.
      const targetDateStr = todayNY.getFullYear() + '-' + 
                            String(todayNY.getMonth() + 1).padStart(2, '0') + '-' + 
                            String(todayNY.getDate()).padStart(2, '0');
                            
      console.log(`🔍 Target date for 3-day notice (NY Time): ${targetDateStr}`);
  
      // 4️⃣ MySQL의 CURDATE() 대신, 우리가 똑똑하게 계산한 날짜(targetDateStr)를 넣습니다!
      const [duePayments] = await connection.query(`
        SELECT m.id, m.student_id, m.dojang_code, m.next_payment_date, s.first_name 
        FROM monthly_payments m
        JOIN students s ON m.student_id = s.id
        WHERE m.source_id = 'cash' 
          AND m.payment_status = 'pending'
          AND m.day_notification_3 = 0
          AND DATE(m.next_payment_date) = ?
      `, [targetDateStr]);
  
      console.log(`🔍 Found ${duePayments.length} students due for cash payment.`);
  
      // 5️⃣ 찾아낸 학생들에게 각각 알림 쏘기
      for (const payment of duePayments) {
        const nextDate = new Date(payment.next_payment_date).toISOString().split('T')[0];
        
        // ⭐️ 알림 생성 (앱에 띄우기)
        await createNotification(
          payment.dojang_code, 
          `💵 [${payment.first_name}]'s cash payment is due in 3 days. (Next: ${nextDate})`,
          'cash_due',
          payment.student_id
        );
  
        // ⭐️ 알림 보냈다고 표시 (중복 발송 방지)
        await connection.query(
          `UPDATE monthly_payments SET day_notification_3 = 1 WHERE id = ?`,
          [payment.id]
        );
        
        console.log(`✅ Cash notification sent for student: ${payment.first_name}`);
      }
    } catch (error) {
      console.error('❌ Error in daily cash payment cron job:', error);
    } finally {
      if (connection) connection.release();
    }
  });