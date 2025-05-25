// paymentService.js
const { createSquareClientWithToken } = require('../modules/stripeClient');
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
        `INSERT INTO notifications (dojang_code, message, created_at) VALUES (?, ?, NOW())`,
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

    try {
        console.log(`🚀 Processing payment for subscription ID: ${subscription.id}, Dojang Code: ${subscription.dojang_code}`);

        // ✅ 해당 도장 코드에 대한 Square 액세스 토큰 조회
        const [ownerRows] = await connection.query(
            `SELECT square_access_token, location_id FROM owner_bank_accounts WHERE dojang_code = ? LIMIT 1`,
            [subscription.dojang_code]
        );

        if (!ownerRows.length || !ownerRows[0].square_access_token) {
            console.error(`❌ No Square access token found for dojang code: ${subscription.dojang_code}`);
            await connection.query(`UPDATE monthly_payments SET payment_status = 'failed' WHERE id = ?`, [subscription.id]);
            
            // 알림 생성: Square 토큰 없음
            await createNotification(
                subscription.dojang_code, 
                `⚠️ 결제 오류: Square 계정 연결에 문제가 있습니다. 결제 ID: ${subscription.id}`,
                connection
            );
            
            return { success: false, error: 'No Square access token found' };
        }

        const ownerAccessToken = ownerRows[0].square_access_token;
        const locationId = ownerRows[0].location_id;

        // ✅ 해당 오너의 액세스 토큰으로 Square 클라이언트 생성
        const squareClient = createSquareClientWithToken(ownerAccessToken);
        
        if (!subscription.source_id || !subscription.customer_id) {
            console.error(`❌ Missing source_id or customer_id for payment ID ${subscription.id}. Skipping...`);
            await connection.query(`UPDATE monthly_payments SET payment_status = 'failed' WHERE id = ?`, [subscription.id]);
            
            // 알림 생성: 결제 정보 부족
            await createNotification(
                subscription.dojang_code, 
                `⚠️ 결제 오류: 결제 정보가 충분하지 않습니다. 결제 ID: ${subscription.id}`,
                connection
            );
            
            return { success: false, error: 'Missing required payment information' };
        }

        console.log(`🔄 Using owner's Square token for dojang: ${subscription.dojang_code}`);

        // 학생 정보 조회 (알림용)
        const [studentInfo] = await connection.query(
            `SELECT first_name, last_name FROM students WHERE id = ?`,
            [subscription.student_id]
        );
        
        // 프로그램 정보 조회 (알림용)
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

        // ✅ 오너의 토큰으로 결제 요청
        try {
            const paymentResult = await squareClient.paymentsApi.createPayment({
                sourceId: subscription.source_id,
                amountMoney: {
                    amount: Math.round(parseFloat(subscription.program_fee) * 100), // Convert to cents
                    currency: "USD",
                },
                idempotencyKey: subscription.idempotency_key || uuidv4(),
                customerId: subscription.customer_id,
                locationId: locationId,  // 해당 오너의 location_id 사용
            });

            if (paymentResult.result.payment && paymentResult.result.payment.status === 'COMPLETED') {
                console.log(`✅ Payment successful for payment ID: ${subscription.id}`);

                await connection.beginTransaction();

                // ✅ program_payments 테이블에 결제 기록 추가
                const insertProgramPaymentQuery = `
                    INSERT INTO program_payments 
                    (parent_id, student_id, program_id, amount, payment_date, status, dojang_code, source_id, idempotency_key, payment_id) 
                    VALUES (?, ?, ?, ?, NOW(), 'completed', ?, ?, ?, ?);
                `;
                await connection.query(insertProgramPaymentQuery, [
                    subscription.parent_id,
                    subscription.student_id,
                    subscription.program_id, 
                    subscription.program_fee, 
                    subscription.dojang_code, 
                    subscription.source_id, 
                    subscription.idempotency_key, 
                    paymentResult.result.payment.id
                ]);

                // ✅ "보정된 다음달 날짜" 계산
                const currentDate = dayjs(subscription.next_payment_date);
                const nextDate = currentDate.add(1, 'month');

                const correctedNextDate = currentDate.date() >= 28
                    ? nextDate.endOf('month').format('YYYY-MM-DD')
                    : nextDate.date(currentDate.date()).format('YYYY-MM-DD');

                // ✅ monthly_payments 업데이트 (보정된 next_payment_date)
                const updateQuery = `
                    UPDATE monthly_payments 
                    SET 
                        last_payment_date = CURDATE(), 
                        next_payment_date = ?, 
                        payment_status = 'pending',
                        status = 'completed'
                    WHERE id = ?;
                `;
                await connection.query(updateQuery, [correctedNextDate, subscription.id]);

        

                await connection.commit();
                console.log(`🔄 Next payment scheduled on ${correctedNextDate} for Parent ID: ${subscription.parent_id}`);
                
                return { success: true };
            } else {
                console.error(`❌ Payment failed for payment ID: ${subscription.id}`, paymentResult);

                const failQuery = `
                    UPDATE monthly_payments 
                    SET payment_status = 'failed' 
                    WHERE id = ?;
                `;
                await connection.query(failQuery, [subscription.id]);
                
                // 실패 알림 생성
                await createNotification(
                    subscription.dojang_code, 
                    `⚠️ 결제 실패: ${studentName}님의 ${programName} 프로그램 결제($${subscription.program_fee})가 실패했습니다.`,
                    connection
                );
                
                return { success: false, error: 'Payment failed' };
            }
        } catch (error) {
            console.error(`❌ Square API error for payment ID: ${subscription.id}`, error.message);
            
            const failQuery = `
                UPDATE monthly_payments 
                SET payment_status = 'failed' 
                WHERE id = ?;
            `;
            await connection.query(failQuery, [subscription.id]);
            
       // More specific error message in English
let errorMessage = 'Card authorization was declined';
if (error.message.includes('CARD_DECLINED')) {
    errorMessage = 'Card was declined';
} else if (error.message.includes('CARD_EXPIRED')) {
    errorMessage = 'Card has expired';
} else if (error.message.includes('INSUFFICIENT_FUNDS')) {
    errorMessage = 'Insufficient funds on the card';
} else if (error.message.includes('INVALID_CARD')) {
    errorMessage = 'Invalid card information';
} else if (error.message.includes('CVV_FAILURE')) {
    errorMessage = 'CVV verification failed';
} else if (error.message.includes('ADDRESS_VERIFICATION_FAILURE')) {
    errorMessage = 'Address verification failed';
}
            
await createNotification(
    subscription.dojang_code,
    `⚠️ Payment Failed: Payment for ${studentName}'s ${programName} program ($${subscription.program_fee}) has failed. Reason: ${errorMessage}`,
    connection
  );
            
            return { success: false, error: error.message };
        }
    } catch (error) {
        console.error(`❌ Error processing payment for subscription ID: ${subscription.id}`, error.message);
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error('Rollback failed:', rollbackError);
        }
        
        await connection.query(`UPDATE monthly_payments SET payment_status = 'failed' WHERE id = ?`, [subscription.id]);
        
        // 시스템 오류 알림
        await createNotification(
            subscription.dojang_code,
            `🔴 System Error: A problem occurred while processing payment. Payment ID: ${subscription.id}`,
            connection
           );
        
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
};

module.exports = { 
    processPaymentForSubscription,
    createNotification
};