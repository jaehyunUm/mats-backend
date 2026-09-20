const { createStripeClientWithKey } = require('../modules/stripeClient');
const { classifyStripeError } = require('../modules/paymentDeclineReasons');
const { sendPushToOwners } = require('./pushService');
const db = require('../db');
const uuidv4 = require('uuid').v4;
const dayjs = require('dayjs');

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

// ✅ 결제 디클라인 처리: (1) 원장님께 정확한 사유의 알림 + (2) 학부모께 바로 보낼 수 있는 문자 초안 생성
// reason은 modules/paymentDeclineReasons.js의 classifyStripeError()/noCardOnFile()이 반환하는
// { key, owner, parent(name) } 형태.
const handlePaymentDecline = async (subscription, reason) => {
  try {
    // 학생 이름 조회
    let studentName = `Student ID: ${subscription.student_id}`;
    try {
      const [studentInfo] = await db.query(
        `SELECT first_name, last_name FROM students WHERE id = ?`,
        [subscription.student_id]
      );
      if (studentInfo.length) studentName = `${studentInfo[0].first_name} ${studentInfo[0].last_name}`;
    } catch (e) {
      // 무시 (학생 이름 조회 실패해도 알림은 보내야 함)
    }

    // 1) 원장님용: 정확한 디클라인 사유
    await createNotification(subscription.dojang_code, `Payment declined for ${studentName}: ${reason.owner}`);

    // 2) 학부모용 문자 초안 (같은 학생, 같은 날 중복 생성 방지)
    const [existingToday] = await db.query(
      `SELECT id FROM notifications WHERE student_id = ? AND type = 'payment_decline_draft' AND DATE(date) = CURDATE() LIMIT 1`,
      [subscription.student_id]
    );

    if (existingToday.length === 0) {
      let parentPhone = null;
      try {
        const [parentRows] = await db.query(`SELECT phone FROM parents WHERE id = ?`, [subscription.parent_id]);
        if (parentRows.length) parentPhone = parentRows[0].phone;
      } catch (e) {
        // 무시
      }

      const draftMessage = reason.parent(studentName);

      await db.query(
        `INSERT INTO notifications (dojang_code, message, type, student_id, parent_phone, date, is_read)
         VALUES (?, ?, 'payment_decline_draft', ?, ?, NOW(), 0)`,
        [subscription.dojang_code, draftMessage, subscription.student_id, parentPhone]
      );

      await sendPushToOwners(
        subscription.dojang_code,
        "💳 결제 실패 문자 초안이 준비됐어요",
        `${studentName} 학생 결제가 실패했어요 (${reason.owner}). 학부모께 보낼 문자 초안을 확인해보세요.`,
        { type: "payment_decline_draft" }
      );
    }
  } catch (error) {
    console.error(`❌ Failed to handle payment decline notification:`, error);
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
    
    // 💡 1️⃣ 결제 고유 키를 여기서 먼저 선언합니다! (그래야 DB 저장할 때도 쓸 수 있습니다)
    let currentAttemptKey = uuidv4();

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
            // 💡 2️⃣ 방금 만든 currentAttemptKey를 사용해 결제!
            { idempotencyKey: currentAttemptKey, stripeAccount: ownerRows[0].stripe_account_id }
          );
        
            if (paymentIntent.status !== 'succeeded') {
               const failMsg = `Payment failed for ${studentName}: Stripe status is ${paymentIntent.status}`;
               await createNotification(subscription.dojang_code, failMsg);
               return { success: false, error: 'Failed' };
            }
            paymentIntentId = paymentIntent.id;

        } catch (stripeError) {
            console.error("Stripe Error:", stripeError.message);
            const reason = classifyStripeError(stripeError);
            await handlePaymentDecline(subscription, reason);
            return { success: false, error: stripeError.message, declineReason: reason.key };
        }
    }

    // 3. DB 업데이트 (트랜잭션 시작)
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
          currentAttemptKey, // 💡 3️⃣ 결제에 성공한 바로 그 키를 DB 역사에 정확히 남겨둡니다!
          paymentIntentId
      ]
    );

    // (2) 다음 결제일 계산
    const scheduledDate = dayjs(subscription.next_payment_date); 
    const formattedNextDate = scheduledDate.add(1, 'month').format('YYYY-MM-DD');

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
  createNotification,
  handlePaymentDecline
};