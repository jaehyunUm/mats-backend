const { client } = require('../modules/squareClient');
const db = require('../db');
const uuidv4 = require('uuid').v4;
const dayjs = require('dayjs');


const processPaymentForSubscription = async () => {
    const connection = await db.getConnection();

    try {
        console.log("🚀 Starting subscription payment processing...");

        const query = `
            SELECT id, parent_id, program_id, program_fee AS amount, dojang_code, 
                   source_id, idempotency_key, payment_id, customer_id, next_payment_date
            FROM monthly_payments 
            WHERE next_payment_date <= CURDATE() 
            AND (payment_status = 'pending' OR payment_status = 'failed');
        `;
        const [rows] = await connection.query(query);

        console.log(`🔍 Found ${rows.length} pending payments.`);

        for (const payment of rows) {
            const { id, parent_id, program_id, amount, dojang_code, source_id, idempotency_key, payment_id, customer_id, next_payment_date } = payment;

            if (!source_id || !customer_id) {
                console.error(`❌ Missing source_id or customer_id for payment ID ${id}. Skipping...`);
                continue;
            }

            try {
                console.log(`🔄 Processing payment ID: ${id} for Parent ID: ${parent_id}`);

                // ✅ Square 결제 요청
                const paymentResult = await client.paymentsApi.createPayment({
                    sourceId: source_id,
                    amountMoney: {
                        amount: Math.round(parseFloat(amount) * 100), // Convert to cents
                        currency: "USD",
                    },
                    idempotencyKey: idempotency_key || uuidv4(),
                    customerId: customer_id,
                    locationId: process.env.SQUARE_LOCATION_ID_PRODUCTION,
                });

                if (paymentResult.result.payment && paymentResult.result.payment.status === 'COMPLETED') {
                    console.log(`✅ Payment successful for payment ID: ${id}`);

                    await connection.beginTransaction();

                    // ✅ program_payments 테이블에 결제 기록 추가
                    const insertProgramPaymentQuery = `
                        INSERT INTO program_payments 
                        (parent_id, program_id, amount, payment_date, status, dojang_code, source_id, idempotency_key, payment_id) 
                        VALUES (?, ?, ?, NOW(), 'completed', ?, ?, ?, ?);
                    `;
                    await connection.query(insertProgramPaymentQuery, [
                        parent_id, program_id, amount, dojang_code, source_id, idempotency_key, paymentResult.result.payment.id
                    ]);

                    // ✅ "보정된 다음달 날짜" 계산
                    const currentDate = dayjs(next_payment_date);
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
                    await connection.query(updateQuery, [correctedNextDate, id]);

                    await connection.commit();
                    console.log(`🔄 Next payment scheduled on ${correctedNextDate} for Parent ID: ${parent_id}`);

                } else {
                    console.error(`❌ Payment failed for payment ID: ${id}`, paymentResult);

                    const failQuery = `
                        UPDATE monthly_payments 
                        SET payment_status = 'failed' 
                        WHERE id = ?;
                    `;
                    await connection.query(failQuery, [id]);
                }
            } catch (error) {
                console.error(`❌ Error processing payment for subscription ID: ${id}`, error.message);
                await connection.rollback();
                await connection.query(`UPDATE monthly_payments SET payment_status = 'failed' WHERE id = ?`, [id]);
            }
        }
    } catch (error) {
        console.error("❌ Error processing subscription payments:", error.message);
    } finally {
        connection.release();
        console.log("✅ Subscription payment processing completed.");
    }
};

module.exports = { processPaymentForSubscription };
