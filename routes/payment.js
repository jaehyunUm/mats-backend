const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결
const verifyToken = require('../middleware/verifyToken');
const client = require('../modules/squareClient');
const paymentsApi = client.paymentsApi;

router.post('/payment', verifyToken, async (req, res) => {
  const { student_id, amount, idempotencyKey, card_id, itemId, size, quantity, customer_id, parent_id } = req.body;
  const { dojang_code } = req.user;

  if (!itemId || !size || !amount || !card_id || !customer_id) {
    return res.status(400).json({ message: 'Missing required fields: itemId, size, amount, card_id, or customer_id.' });
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Square 결제 요청 데이터
    const paymentRequest = {
      sourceId: card_id,
      amountMoney: {
        amount: Math.round(amount * 100), // 금액을 센트 단위로 변환
        currency: 'USD',
      },
      idempotencyKey,
      customerId: customer_id, // Square 결제에서 필요한 customer_id
    };

    const paymentResponse = await paymentsApi.createPayment(paymentRequest);

    if (!paymentResponse.result.payment || paymentResponse.result.payment.status !== 'COMPLETED') {
      throw new Error('Square payment failed');
    }

    // 결제 정보 데이터베이스 저장
    await connection.execute(
      `INSERT INTO item_payments (
        student_id, 
        amount, 
        idempotency_key, 
        payment_method, 
        currency, 
        status, 
        dojang_code, 
        parent_id, 
        card_id, 
        item_id, 
        size, 
        quantity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student_id,
        amount,
        idempotencyKey,
        'card',
        'USD',
        'completed',
        dojang_code,
        parent_id,
        card_id,
        itemId,
        size, // 추가된 size
        quantity,
      ]
    );

    // 재고 업데이트
    const updateItemQuery = `
      UPDATE item_sizes
      SET quantity = quantity - ?
      WHERE item_id = ? AND size = ? AND quantity >= ?
    `;
    const [updateResult] = await connection.execute(updateItemQuery, [quantity, itemId, size, quantity]);

    if (updateResult.affectedRows === 0) {
      throw new Error('Insufficient stock or invalid item ID/size');
    }

    await connection.commit();
    res.status(201).json({
      success: true,
      message: 'Payment successful, stock updated, and data saved',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error processing payment:', error);
    res.status(500).json({ success: false, message: 'Payment processing failed', error: error.message });
  } finally {
    connection.release();
  }
});







module.exports = router;
