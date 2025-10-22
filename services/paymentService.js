const { createStripeClientWithKey } = require('../modules/stripeClient');
const db = require('../db');
const uuidv4 = require('uuid').v4;
const dayjs = require('dayjs');
const process = require('process');

// ✅ 알림 생성 함수 (기존 코드)
// 이 함수는 이미 알림을 DB에 저장하도록 잘 작성되어 있습니다.
const createNotification = async (dojangCode, message, connection) => {
  try {
    // connection이 있으면 사용하고, 없으면 새로 만듭니다.
    const conn = connection || await db.getConnection();
    const useLocalConnection = !connection;
    
    try {
      // ⭐️ 'date' 컬럼은 DEFAULT CURRENT_TIMESTAMP로 자동 생성되므로 
      // ⭐️ 'is_read'는 DEFAULT 0 (또는 false)로 설정되어 있다고 가정합니다.
      await conn.query(
        `INSERT INTO notifications (dojang_code, message) VALUES (?, ?)`,
        [dojangCode, message]
      );
      console.log(`✅ Notification created for dojang ${dojangCode}: ${message}`);
      return true;
    } finally {
      // 이 함수 내부에서 connection을 생성했을 때만 release 합니다.
      if (useLocalConnection) {
        conn.release();
      }
    }
  } catch (error) {
    console.error(`❌ Failed to create notification:`, error);
    return false;
  }
};

/**
 * 구독 결제를 안전하게 처리하는 핸들러입니다.
 * 결제 실패 시 실패 사유를 포함한 알림을 생성합니다.
 * @param {object} subscription - The subscription object from the database.
 * @returns {Promise<{success: boolean, error?: string}>} - The result of the payment processing.
 */
const processPaymentForSubscription = async (subscription) => {
    let connection;
    let transactionStarted = false;

    // 
    // 💡 알림 메시지에 사용할 변수들을 미리 선언합니다.
    let studentName = `Student ID: ${subscription.student_id}`;
    let programName = `Program ID: ${subscription.program_id}`;
    const fee = parseFloat(subscription.program_fee);
  
    try {
      connection = await db.getConnection();
      console.log(`🚀 Processing payment for subscription ID: ${subscription.id}, Dojang Code: ${subscription.dojang_code}`);
  
      // --- Stripe 계정 정보 조회 ---
      const [ownerRows] = await connection.query(
        `SELECT stripe_access_token, stripe_account_id FROM owner_bank_accounts WHERE dojang_code = ? LIMIT 1`,
        [subscription.dojang_code]
      );
  
      if (!ownerRows.length || !ownerRows[0].stripe_access_token) {
        console.error(`⚠️ Payment Error for Sub ID ${subscription.id}: Stripe account not properly connected.`);
        return { success: false, error: 'No Stripe access token found' };
      }
  
      const ownerAccessToken = ownerRows[0].stripe_access_token;
      const stripeAccountId = ownerRows[0].stripe_account_id;
      const stripe = createStripeClientWithKey(ownerAccessToken);
  
      // --- 필수 정보 확인 ---
      if (!subscription.source_id || !subscription.customer_id) {
        console.error(`⚠️ Payment Error for Sub ID ${subscription.id}: Missing payment information.`);
        return { success: false, error: 'Missing required payment information' };
      }
  
      // --- 알림용 정보 조회 (학생/프로그램 이름) ---
      try {
        const [studentInfo] = await connection.query(`SELECT first_name, last_name FROM students WHERE id = ?`, [subscription.student_id]);
        const [programInfo] = await connection.query(`SELECT name FROM programs WHERE id = ? AND dojang_code = ?`, [subscription.program_id, subscription.dojang_code]);
  
        if (studentInfo.length) {
          studentName = `${studentInfo[0].first_name} ${studentInfo[0].last_name}`;
        }
        if (programInfo.length) {
          programName = programInfo[0].name;
        }
      } catch (infoError) {
        console.warn(`⚠️ Could not fetch student/program name for notification: ${infoError.message}`);
      }
  
      // --- 금액 유효성 검사 ---
      if (isNaN(fee) || fee <= 0) {
        console.error(`❌ Payment Error for Sub ID ${subscription.id}: Invalid fee amount.`);
        return { success: false, error: 'Invalid program fee' };
      }
  
      // --- Stripe 결제 시도 ---
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: Math.round(fee * 100),
          currency: "usd",
          customer: subscription.customer_id,
          payment_method: subscription.source_id,
          off_session: true,
          confirm: true,
          metadata: {
            subscription_id: subscription.id,
            student_id: subscription.student_id,
            parent_id: subscription.parent_id,
            dojang_code: subscription.dojang_code,
            program_id: subscription.program_id,
          },
        },
        {
          idempotencyKey: subscription.idempotency_key || uuidv4(),
          stripeAccount: stripeAccountId
        }
      );
  
      // ‼️ [수정 1] 결제는 시도했으나 실패한 경우 (예: 잔액 부족)
      if (paymentIntent.status !== 'succeeded') {
        // Stripe가 제공하는 실패 메시지를 가져옵니다.
        const failureReason = paymentIntent.last_payment_error?.message || 'Payment failed for an unknown reason.';
        
        console.warn(`⚠️ Payment failed for Sub ID ${subscription.id} for ${studentName}'s ${programName} program ($${fee}). Reason: ${failureReason}`);
        
        // ⭐️ 실패 알림 생성
        await createNotification(
          subscription.dojang_code,
          `Payment Failed: ${studentName}'s ${programName} ($${fee}) was declined. Reason: ${failureReason}`,
          connection // 기존 connection 재사용
        );

        return { success: false, error: failureReason };
      }
  
      // --- 성공 시 DB 처리 (트랜잭션) ---
      await connection.beginTransaction();
      transactionStarted = true;
  
      // program_payments에 기록
      await connection.query(`
        INSERT INTO program_payments (parent_id, student_id, program_id, amount, payment_date, status, dojang_code, source_id, idempotency_key, payment_id)
        VALUES (?, ?, ?, ?, NOW(), 'completed', ?, ?, ?, ?)`,
        [subscription.parent_id, subscription.student_id, subscription.program_id, fee, subscription.dojang_code, subscription.source_id, subscription.idempotency_key, paymentIntent.id]
      );
  
      // monthly_payments 다음 결제일 업데이트
      const currentDate = dayjs(subscription.next_payment_date);
      const nextDate = currentDate.add(1, 'month');
      const correctedNextDate = (currentDate.date() >= 28 ? nextDate.endOf('month') : nextDate.date(currentDate.date())).format('YYYY-MM-DD');
  
      await connection.query(`
        UPDATE monthly_payments SET last_payment_date = CURDATE(), next_payment_date = ?, payment_status = 'pending', status = 'completed'
        WHERE id = ?`,
        [correctedNextDate, subscription.id]
      );
  
      await connection.commit();
      console.log(`✅ Payment successful for Sub ID ${subscription.id}. Next payment scheduled on ${correctedNextDate}`);
      return { success: true };

    } catch (error) {
      if (transactionStarted && connection) {
        await connection.rollback();
      }
      
      // ‼️ [수정 2] 결제 시도 중 오류가 발생한 경우 (예: 만료된 카드)
      let failureReason = 'Internal server error';
      
      // Stripe 오류인지 확인하고, 사용자에게 친절한 메시지를 추출합니다.
      if (error.type === 'StripeCardError') {
        failureReason = error.message; // 예: "Your card has insufficient funds."
      } else if (error.message) {
        failureReason = error.message;
      }
      
      console.error(`❌ CRITICAL ERROR for subscription ID ${subscription.id}:`, failureReason);

      // ⭐️ 실패 알림 생성
      // (connection이 확보된 상태에서만 알림 시도)
      if (connection) {
        await createNotification(
          subscription.dojang_code,
          `Payment Error: ${studentName}'s ${programName} ($${fee}) could not be processed. Reason: ${failureReason}`,
          connection // 기존 connection 재사용
        );
      }

      return { success: false, error: failureReason };

    } finally {
      // 
      // 💡 가장 중요: 어떤 일이 있어도 connection을 반환합니다.
      if (connection) {
        connection.release();
        console.log(`🔹 DB Connection released for subscription ID ${subscription.id}.`);
      }
    }
  };

// 두 함수를 모두 export 합니다.
module.exports = { 
  processPaymentForSubscription,
  createNotification
};