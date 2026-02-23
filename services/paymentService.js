const { createStripeClientWithKey } = require('../modules/stripeClient');
const db = require('../db');
const uuidv4 = require('uuid').v4;
const dayjs = require('dayjs');
// const process = require('process'); // (필요 없다면 제거 가능)

// ✅ 알림 생성 함수
const createNotification = async (dojangCode, message, connection) => {
  try {
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

    // 0. 학생 이름 조회
    try {
      const [studentInfo] = await connection.query(`SELECT first_name, last_name FROM students WHERE id = ?`, [subscription.student_id]);
      if (studentInfo.length) studentName = `${studentInfo[0].first_name} ${studentInfo[0].last_name}`;
    } catch (e) {
        // 무시
    }

    // 1. 유효성 검사
    if (isNaN(fee) || fee < 0) {
      const errorMsg = `Payment failed for ${studentName}: Invalid fee amount ($${fee}).`;
      await createNotification(subscription.dojang_code, errorMsg);
      return { success: false, error: 'Invalid fee (negative)' };
    }

    let paymentIntentId = `family_bundle_${uuidv4()}`;

    // 2. Stripe 결제 시도
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
        
            if (paymentIntent.status !== 'succeeded') {
               const failMsg = `Payment failed for ${studentName}: Stripe status is ${paymentIntent.status}`;
               await createNotification(subscription.dojang_code, failMsg);
               return { success: false, error: 'Failed' };
            }
            paymentIntentId = paymentIntent.id;

        } catch (stripeError) {
            console.error("Stripe Error:", stripeError.message);
            const stripeFailMsg = `Payment declined for ${studentName}: ${stripeError.message}`;
            await createNotification(subscription.dojang_code, stripeFailMsg);
            return { success: false, error: stripeError.message };
        }
    }

    // 3. DB 업데이트 (트랜잭션 시작)
    // ⚠️ (이전 코드에서 여기가 중복되어 있었음, 하나로 통일)
    await connection.beginTransaction();
    transactionStarted = true;

    // (1) 결제 이력 남기기
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

   // ⭐️⭐️⭐️ 여기서부터 덮어씌우시면 됩니다 ⭐️⭐️⭐️
    // (2) 다음 결제일 계산 (절대 밀리지 않는 완벽한 Cycle 로직)
    // 항상 최초 등록일(start_date)의 '일(Day)'을 기억해서 기준을 잡습니다.
    const startDate = dayjs(subscription.start_date);
    const originalDay = startDate.date(); // 예: 31일에 등록했으면 '31'

    const scheduledDate = dayjs(subscription.next_payment_date); 
    let nextMonth = scheduledDate.add(1, 'month'); // 일단 다음 달로 넘김
    
    // 다음 달의 마지막 날짜가 며칠인지 확인 (예: 2월은 28일, 4월은 30일)
    const daysInNextMonth = nextMonth.daysInMonth();
    
    // 원래 등록일과 다음 달의 말일 중 더 '작은' 날짜를 선택
    // (31일에 등록했어도 2월이면 28일, 4월이면 30일로 안전하게 세팅됨)
    const targetDay = Math.min(originalDay, daysInNextMonth);
    
    const formattedNextDate = nextMonth.date(targetDay).format('YYYY-MM-DD');
    // ⭐️⭐️⭐️ 여기까지 ⭐️⭐️⭐️

    // (3) Monthly Payments 정보 갱신 (키 갱신 포함)
    await connection.query(`
      UPDATE monthly_payments 
      SET 
        last_payment_date = CURDATE(),  -- 실제 결제일(오늘)
        next_payment_date = ?,          -- 주기 유지된 다음 예정일
        payment_status = 'pending', 
        status = 'completed',
        idempotency_key = ?             -- ✅ 다음 달을 위해 새로운 키 생성!
      WHERE id = ?`,
      [formattedNextDate, uuidv4(), subscription.id]
    );

    await connection.commit();
    return { success: true };

  } catch (error) {
     // 4. 시스템 에러 처리
     if (transactionStarted) await connection.rollback();
     
     console.error(`❌ System Error processing payment:`, error);
     const systemErrorMsg = `System error processing payment for ${studentName}: ${error.message}`;
     
     await createNotification(subscription.dojang_code, systemErrorMsg);

     return { success: false, error: error.message };
  } finally {
     if (connection) connection.release();
  }
};

module.exports = { 
  processPaymentForSubscription,
  createNotification
};