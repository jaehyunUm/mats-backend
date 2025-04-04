const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결
const verifyToken = require('../middleware/verifyToken');
const { createSquareClientWithToken } = require('../modules/squareClient'); // ✅ 바뀐 부분

router.post('/payment', verifyToken, async (req, res) => {
  const { student_id, amount, idempotencyKey, card_id, itemId, size, quantity, customer_id, parent_id } = req.body;
  const { dojang_code } = req.user;

  if (!itemId || !size || !amount || !card_id || !customer_id) {
    return res.status(400).json({ message: 'Missing required fields: itemId, size, amount, card_id, or customer_id.' });
  }

  // ✅ 오너의 Square access token과 location_id 가져오기
  const [ownerInfo] = await db.query(
    "SELECT square_access_token, location_id FROM owner_bank_accounts WHERE dojang_code = ?",
    [dojang_code]
  );

  if (!ownerInfo.length) {
    return res.status(400).json({ message: "No Square account connected for this dojang." });
  }

  const ownerAccessToken = ownerInfo[0].square_access_token;
  const locationId = ownerInfo[0].location_id;

  // ✅ 오너 accessToken으로 클라이언트 생성
  const squareClient = createSquareClientWithToken(ownerAccessToken);
  const paymentsApi = squareClient.paymentsApi;

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const paymentRequest = {
      sourceId: card_id,
      amountMoney: {
        amount: Math.round(amount * 100),
        currency: 'USD',
      },
      idempotencyKey,
      customerId: customer_id,
      locationId, // ✅ Square location ID도 추가
    };

    const paymentResponse = await paymentsApi.createPayment(paymentRequest);

    if (!paymentResponse.result.payment || paymentResponse.result.payment.status !== 'COMPLETED') {
      throw new Error('Square payment failed');
    }

    await connection.execute(
      `INSERT INTO item_payments (
        student_id, amount, idempotency_key, payment_method, currency, status,
        dojang_code, parent_id, card_id, item_id, size, quantity
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
        size,
        quantity,
      ]
    );

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
    console.error('❌ Error processing payment:', error);
    res.status(500).json({ success: false, message: 'Payment processing failed', error: error.message });
  } finally {
    connection.release();
  }
});






module.exports = router;
