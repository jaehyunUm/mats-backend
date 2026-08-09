const cron = require('node-cron');
const createNotification = require('./createNotification'); // 경로에 맞게 수정

// ⏰ 매일 아침 9시 정각에 자동 실행되는 백엔드 로직
cron.schedule('0 9 * * *', async () => {
  console.log('⏰ Running daily cash payment check...');
  
  const connection = await db.getConnection();
  try {
    // 1. 현금 결제자 중 다음 결제일이 '딱 3일 남은' 사람 찾기
    const [duePayments] = await connection.query(`
      SELECT m.id, m.student_id, m.dojang_code, m.next_payment_date, s.first_name 
      FROM monthly_payments m
      JOIN students s ON m.student_id = s.id
      WHERE m.source_id = 'cash' 
        AND m.payment_status = 'pending'
        AND m.day_notification_3 = 0
        AND DATEDIFF(m.next_payment_date, CURDATE()) = 3
    `);

    // 2. 찾아낸 학생들에게 각각 알림 쏘기
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
    connection.release();
  }
});