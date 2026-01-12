const { createStripeClientWithKey } = require('../modules/stripeClient');
const db = require('../db');
const uuidv4 = require('uuid').v4;
const dayjs = require('dayjs');
const process = require('process');

// ✅ 알림 생성 함수
const createNotification = async (dojangCode, message, connection) => {
  try {
    // connection이 있으면 사용하고, 없으면 새로 만듭니다.
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

const processPaymentForSubscription = async (subscription) => {
  let connection;
  let transactionStarted = false;

  let studentName = `Student ID: ${subscription.student_id}`;
  const fee = parseFloat(subscription.program_fee);

  try {
    connection = await db.getConnection();
    console.log(`🚀 Processing Subscription ID: ${subscription.id} (Fee: $${fee})`);

    // 0. 학생 이름 조회 (알림 메시지용)
    try {
      const [studentInfo] = await connection.query(`SELECT first_name, last_name FROM students WHERE id = ?`, [subscription.student_id]);
      if (studentInfo.length) studentName = `${studentInfo[0].first_name} ${studentInfo[0].last_name}`;
    } catch (e) {
        // 이름 조회 실패해도 로직은 계속 진행
    }

    // 1. 유효성 검사
    if (isNaN(fee) || fee < 0) {
      const errorMsg = `Payment failed for ${studentName}: Invalid fee amount ($${fee}).`;
      await createNotification(subscription.dojang_code, errorMsg); // 🔔 알림 생성
      return { success: false, error: 'Invalid fee (negative)' };
    }

    let paymentIntentId = `family_bundle_${uuidv4()}`; // 0원 결제 시 사용할 기본 ID

    // 2. Stripe 결제 시도 (금액이 0보다 클 때만)
    if (fee > 0) {
        const [ownerRows] = await connection.query(
          `SELECT stripe_access_token, stripe_account_id FROM owner_bank_accounts WHERE dojang_code = ? LIMIT 1`,
          [subscription.dojang_code]
        );

        if (!ownerRows || ownerRows.length === 0) {
             const noBankMsg = `Payment failed for ${studentName}: Dojo bank account not found.`;
             await createNotification(subscription.dojang_code, noBankMsg);
             return { success: false, error: 'No bank account' };
        }
    
        const stripe = createStripeClientWithKey(ownerRows[0].stripe_access_token);

        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(fee * 100),
                currency: "usd",
                customer: subscription.customer_id,
                payment_method: subscription.source_id,
                off_session: true,
                confirm: true,
                metadata: {
                  subscription_id: subscription.id,
                  student_id: subscription.student_id,
                  note: "Family Bundle Payment" 
                },
              },
              { idempotencyKey: subscription.idempotency_key || uuidv4(), stripeAccount: ownerRows[0].stripe_account_id }
            );
        
            // Stripe 결제 실패 (상태가 succeeded가 아닐 때)
            if (paymentIntent.status !== 'succeeded') {
               const failMsg = `Payment failed for ${studentName}: Stripe status is ${paymentIntent.status}`;
               await createNotification(subscription.dojang_code, failMsg); // 🔔 알림 생성
               return { success: false, error: 'Failed' };
            }
            paymentIntentId = paymentIntent.id;

        } catch (stripeError) {
            // Stripe 자체 에러 (카드 거절, 잔액 부족 등)
            console.error("Stripe Error:", stripeError.message);
            const stripeFailMsg = `Payment declined for ${studentName}: ${stripeError.message}`;
            
            await createNotification(subscription.dojang_code, stripeFailMsg); // 🔔 알림 생성
            
            // ⭐️ 중요: 여기서 throw 하지 않고 return false로 함수를 종료합니다.
            // throw를 하면 아래 메인 catch 블록으로 넘어가서 'System Error' 알림이 중복으로 발생할 수 있습니다.
            return { success: false, error: stripeError.message };
        }
    }

// 3. DB 업데이트 (트랜잭션 시작)
await connection.beginTransaction();
transactionStarted = true;

// 결제 이력 남기기 (이건 좋습니다)
await connection.query(`
  INSERT INTO program_payments (parent_id, student_id, program_id, amount, payment_date, status, dojang_code, source_id, idempotency_key, payment_id)
  VALUES (?, ?, ?, ?, NOW(), 'completed', ?, ?, ?, ?)`,
  [
      subscription.parent_id, 
      subscription.student_id, 
      subscription.program_id, 
      fee, 
      subscription.dojang_code, 
      subscription.source_id || 'bundle_system', 
      subscription.idempotency_key || uuidv4(), 
      paymentIntentId
  ]
);

// 다음 결제일 계산
const currentDate = dayjs(subscription.next_payment_date);
const nextDate = currentDate.add(1, 'month');
const correctedNextDate = (currentDate.date() >= 28 ? nextDate.endOf('month') : nextDate.date(currentDate.date())).format('YYYY-MM-DD');

// ✨ [핵심 수정] 다음 달을 위해 '새로운 키'를 생성해서 저장하거나, NULL로 초기화해야 합니다.
const nextMonthIdempotencyKey = uuidv4(); 

await connection.query(`
  UPDATE monthly_payments 
  SET 
    last_payment_date = CURDATE(), 
    next_payment_date = ?, 
    payment_status = 'pending', 
    status = 'completed',
    idempotency_key = ?  -- 👈 여기에 새로운 키를 넣어줘야 합니다!
  WHERE id = ?`,
  [correctedNextDate, nextMonthIdempotencyKey, subscription.id]
);

await connection.commit();
return { success: true };

  } catch (error) {
     // 4. 시스템 에러 처리 (DB 연결 실패, 쿼리 오류 등)
     if (transactionStarted) await connection.rollback();
     
     console.error(`❌ System Error processing payment:`, error);
     const systemErrorMsg = `System error processing payment for ${studentName}: ${error.message}`;
     
     // 🔔 시스템 에러 알림 생성
     await createNotification(subscription.dojang_code, systemErrorMsg);

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