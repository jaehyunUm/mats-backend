// paymentService.js
const { createStripeClientWithKey } = require('../modules/stripeClient');
const db = require('../db');
const uuidv4 = require('uuid').v4;
const dayjs = require('dayjs');

// 알림 생성 함수
const createNotification = async (dojangCode, message, connection) => {
  try {
    // 사용자가 제공한 connection을 사용하거나, 없으면 새로 생성
    const conn = connection || await db.getConnection();
    const useLocalConnection = !connection;
    
    try {
      await conn.query(
        `INSERT INTO notifications (dojang_code, message) VALUES (?, ?)`,
        [dojangCode, message]
      );
      console.log(`✅ Notification created for dojang ${dojangCode}: ${message}`);
      return true;
    } finally {
      // 로컬에서 생성한 connection만 해제
      if (useLocalConnection) {
        conn.release();
      }
    }
  } catch (error) {
    console.error(`❌ Failed to create notification:`, error);
    return false;
  }
};

const processPaymentForSubscription = async (subscription) => {
    const connection = await db.getConnection();
    let transactionStarted = false;
  
    try {
      console.log(`🚀 Processing payment for subscription ID: ${subscription.id}, Dojang Code: ${subscription.dojang_code}`);
  
      // 1. Stripe 계정 정보 조회
      const [ownerRows] = await connection.query(
        `SELECT stripe_access_token, stripe_account_id FROM owner_bank_accounts WHERE dojang_code = ? LIMIT 1`,
        [subscription.dojang_code]
      );
  
      if (!ownerRows.length || !ownerRows[0].stripe_access_token) {
        await handleFailure(connection, subscription, `⚠️ 결제 오류: Stripe 계정 연결에 문제가 있습니다.`);
        return { success: false, error: 'No Stripe access token found' };
      }
  
      const ownerAccessToken = ownerRows[0].stripe_access_token;
      const stripeAccountId = ownerRows[0].stripe_account_id;
      const stripe = createStripeClientWithKey(ownerAccessToken);
  
      // 2. 필수 정보 확인
      if (!subscription.source_id || !subscription.customer_id) {
        await handleFailure(connection, subscription, `⚠️ 결제 오류: 결제 정보가 충분하지 않습니다.`);
        return { success: false, error: 'Missing required payment information' };
      }
  
      // 3. 알림용 정보 조회
      const [studentInfo] = await connection.query(
        `SELECT first_name, last_name FROM students WHERE id = ?`,
        [subscription.student_id]
      );
      const [programInfo] = await connection.query(
        `SELECT name FROM programs WHERE id = ? AND dojang_code = ?`,
        [subscription.program_id, subscription.dojang_code]
      );
  
      const studentName = studentInfo.length > 0
        ? `${studentInfo[0].first_name} ${studentInfo[0].last_name}`
        : `학생 ID: ${subscription.student_id}`;
      const programName = programInfo.length > 0
        ? programInfo[0].name
        : `프로그램 ID: ${subscription.program_id}`;
  
      // 4. 금액 검증
      const fee = parseFloat(subscription.program_fee);
      if (isNaN(fee) || fee <= 0) {
        await handleFailure(connection, subscription, `❌ 결제 오류: 유효하지 않은 결제 금액입니다.`);
        return { success: false, error: 'Invalid program fee' };
      }
  
      const isPlatformAccount = !stripeAccountId || stripeAccountId === '본인 Stripe 계정 ID';
  
      const paymentIntentParams = {
        amount: Math.round(fee * 100),
        currency: "USD",
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
      };
  
      if (stripeAccountId) {
        paymentIntentParams.on_behalf_of = stripeAccountId;
      }
  
      // 5. 결제 시도
      const paymentIntent = await stripe.paymentIntents.create(
        paymentIntentParams,
        { idempotencyKey: subscription.idempotency_key || uuidv4() }
      );
  
      if (paymentIntent.status !== 'succeeded') {
        await handleFailure(connection, subscription, `⚠️ 결제 실패: ${studentName}님의 ${programName} 프로그램 결제($${fee})가 실패했습니다.`);
        return { success: false, error: 'Payment failed' };
      }
  
      // 6. 결제 성공 처리
      await connection.beginTransaction();
      transactionStarted = true;
  
      // program_payments 기록
      await connection.query(`
        INSERT INTO program_payments 
          (parent_id, student_id, program_id, amount, payment_date, status, dojang_code, source_id, idempotency_key, payment_id)
        VALUES (?, ?, ?, ?, NOW(), 'completed', ?, ?, ?, ?)
      `, [
        subscription.parent_id,
        subscription.student_id,
        subscription.program_id,
        fee,
        subscription.dojang_code,
        subscription.source_id,
        subscription.idempotency_key,
        paymentIntent.id
      ]);
  
      // 다음 결제일 계산
      const currentDate = dayjs(subscription.next_payment_date);
      const nextDate = currentDate.add(1, 'month');
      const correctedNextDate = currentDate.date() >= 28
        ? nextDate.endOf('month').format('YYYY-MM-DD')
        : nextDate.date(currentDate.date()).format('YYYY-MM-DD');
  
      // monthly_payments 갱신
      await connection.query(`
        UPDATE monthly_payments
        SET 
          last_payment_date = CURDATE(),
          next_payment_date = ?,
          payment_status = 'pending',
          status = 'completed'
        WHERE id = ?
      `, [correctedNextDate, subscription.id]);
  
      await connection.commit();
      console.log(`✅ Payment successful. Next payment scheduled on ${correctedNextDate}`);
      return { success: true };
  
    } catch (error) {
      console.error(`❌ Error processing payment for subscription ID: ${subscription.id}`, error.message);
  
      if (transactionStarted) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error("❌ Rollback failed:", rollbackError);
        }
      }
  
      await handleFailure(connection, subscription, `🔴 System Error: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      connection.release();
    }
  };
  
  // 실패 처리 공통 함수
  async function handleFailure(connection, subscription, message) {
    try {
      await connection.query(`UPDATE monthly_payments SET payment_status = 'failed' WHERE id = ?`, [subscription.id]);
      await createNotification(subscription.dojang_code, message, connection);
    } catch (error) {
      console.error('❌ Failed to handle failure:', error.message);
    }
  }
  

module.exports = { 
    processPaymentForSubscription,
    createNotification
};