// paymentService.js
const { createSquareClientWithToken } = require('../modules/squareClient');
const db = require('../db');
const uuidv4 = require('uuid').v4;
const dayjs = require('dayjs');

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
            return { success: false, error: 'No Square access token found' };
        }

        const ownerAccessToken = ownerRows[0].square_access_token;
        const locationId = ownerRows[0].location_id;

        // ✅ 해당 오너의 액세스 토큰으로 Square 클라이언트 생성
        const squareClient = createSquareClientWithToken(ownerAccessToken);
        
        if (!subscription.source_id || !subscription.customer_id) {
            console.error(`❌ Missing source_id or customer_id for payment ID ${subscription.id}. Skipping...`);
            await connection.query(`UPDATE monthly_payments SET payment_status = 'failed' WHERE id = ?`, [subscription.id]);
            return { success: false, error: 'Missing required payment information' };
        }

        console.log(`🔄 Using owner's Square token for dojang: ${subscription.dojang_code}`);

        // ✅ 오너의 토큰으로 결제 요청
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
                (parent_id, program_id, amount, payment_date, status, dojang_code, source_id, idempotency_key, payment_id) 
                VALUES (?, ?, ?, NOW(), 'completed', ?, ?, ?, ?);
            `;
            await connection.query(insertProgramPaymentQuery, [
                subscription.parent_id, 
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
            
            return { success: false, error: 'Payment failed' };
        }
    } catch (error) {
        console.error(`❌ Error processing payment for subscription ID: ${subscription.id}`, error.message);
        await connection.rollback();
        await connection.query(`UPDATE monthly_payments SET payment_status = 'failed' WHERE id = ?`, [subscription.id]);
        
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
};

module.exports = { processPaymentForSubscription };