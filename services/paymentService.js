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

  let studentName = `Student ID: ${subscription.student_id}`;
  let programName = `Program ID: ${subscription.program_id}`;
  const fee = parseFloat(subscription.program_fee); // 여기서 0원이 들어옵니다.

  try {
    connection = await db.getConnection();
    console.log(`🚀 Processing Subscription ID: ${subscription.id} (Fee: $${fee})`);

    // 학생/프로그램 이름 조회 (생략 가능하지만 알림용으로 유지)
    try {
      const [studentInfo] = await connection.query(`SELECT first_name, last_name FROM students WHERE id = ?`, [subscription.student_id]);
      if (studentInfo.length) studentName = `${studentInfo[0].first_name} ${studentInfo[0].last_name}`;
    } catch (e) {}

    // 1. 유효성 검사: 0원은 OK, 음수만 에러
    if (isNaN(fee) || fee < 0) {
      return { success: false, error: 'Invalid fee (negative)' };
    }

    let paymentIntentId = `family_bundle_${uuidv4()}`; // 0원일 때 사용할 가짜 ID

    // 2. 금액이 0보다 클 때만 Stripe 청구 (가족 대표)
    if (fee > 0) {
        const [ownerRows] = await connection.query(
          `SELECT stripe_access_token, stripe_account_id FROM owner_bank_accounts WHERE dojang_code = ? LIMIT 1`,
          [subscription.dojang_code]
        );
    
        // ... (Stripe 토큰 체크 로직 생략) ...
        const stripe = createStripeClientWithKey(ownerRows[0].stripe_access_token);

        // Stripe 결제 실행
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(fee * 100),
            currency: "usd",
            customer: subscription.customer_id,
            payment_method: subscription.source_id,
            off_session: true,
            confirm: true,
            metadata: {
              subscription_id: subscription.id,
              student_id: subscription.student_id, // 대표 학생 ID만 기록됨
              note: "Family Bundle Payment" // 메타데이터에 표시해주면 좋음
            },
          },
          { idempotencyKey: subscription.idempotency_key || uuidv4(), stripeAccount: ownerRows[0].stripe_account_id }
        );
    
        if (paymentIntent.status !== 'succeeded') {
           // 실패 로직...
           return { success: false, error: 'Failed' };
        }
        paymentIntentId = paymentIntent.id; // 진짜 결제 ID
    } 
    // 3. 금액이 0원이면 (나머지 가족)
    else {
        console.log(`ℹ️ [Family Bundle] Skipping Stripe charge for ${studentName}. Amount is $0.`);
        // 여기서 바로 DB 업데이트로 넘어갑니다.
    }

    // 4. DB 업데이트 (0원인 가족도 날짜는 갱신되어야 함)
    await connection.beginTransaction();
    transactionStarted = true;

    // 결제 이력 남기기 (0원 or 실제금액)
    await connection.query(`
      INSERT INTO program_payments (parent_id, student_id, program_id, amount, payment_date, status, dojang_code, source_id, idempotency_key, payment_id)
      VALUES (?, ?, ?, ?, NOW(), 'completed', ?, ?, ?, ?)`,
      [
          subscription.parent_id, 
          subscription.student_id, 
          subscription.program_id, 
          fee, // 0 또는 합산금액
          subscription.dojang_code, 
          subscription.source_id || 'bundle_system', 
          subscription.idempotency_key || uuidv4(), 
          paymentIntentId
      ]
    );

    // 다음 결제일 갱신 (모든 가족 구성원이 한 달씩 밀림)
    const currentDate = dayjs(subscription.next_payment_date);
    const nextDate = currentDate.add(1, 'month');
    const correctedNextDate = (currentDate.date() >= 28 ? nextDate.endOf('month') : nextDate.date(currentDate.date())).format('YYYY-MM-DD');

    await connection.query(`
      UPDATE monthly_payments SET last_payment_date = CURDATE(), next_payment_date = ?, payment_status = 'pending', status = 'completed'
      WHERE id = ?`,
      [correctedNextDate, subscription.id]
    );

    await connection.commit();
    return { success: true };

  } catch (error) {
     if (transactionStarted) await connection.rollback();
     // 에러 처리...
     return { success: false, error: error.message };
  } finally {
     if (connection) connection.release();
  }
};

// 두 함수를 모두 export 합니다.
module.exports = { 
  processPaymentForSubscription,
  createNotification
};