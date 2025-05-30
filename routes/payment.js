const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결
const verifyToken = require('../middleware/verifyToken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.post('/payment', verifyToken, async (req, res) => {
  const { student_id, amount, idempotencyKey, card_id, itemId, size, quantity, customer_id, parent_id } = req.body;
  const { dojang_code } = req.user;

  if (!itemId || !size || !amount || !card_id || !customer_id) {
    return res.status(400).json({ message: 'Missing required fields: itemId, size, amount, card_id, or customer_id.' });
  }

  // 최소 금액 검증 (Stripe 최소 금액 $0.50)
  const amountValue = parseFloat(amount);
  if (amountValue < 0.50) {
    return res.status(400).json({ 
      success: false, 
      message: `Amount must be at least $0.50. Received: $${amountValue.toFixed(2)}` 
    });
  }

  // ✅ 오너의 Stripe account ID 가져오기
  const [ownerInfo] = await db.query(
    "SELECT stripe_account_id FROM owner_bank_accounts WHERE dojang_code = ?",
    [dojang_code]
  );

  if (!ownerInfo.length || !ownerInfo[0].stripe_account_id) {
    return res.status(400).json({ message: "No Stripe account connected for this dojang." });
  }

  const connectedAccountId = ownerInfo[0].stripe_account_id;

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    console.log("🔍 결제 정보:", {
      amount: amountValue,
      stripeAmount: Math.round(amountValue * 100),
      connectedAccountId,
      customer_id,
      card_id
    });

    // ✅ Stripe 결제 생성
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(amountValue * 100), // 센트 단위로 변환
        currency: 'usd',
        customer: customer_id,
        payment_method: card_id,
        confirm: true,
        off_session: true,
        transfer_data: { 
          destination: connectedAccountId 
        },
        metadata: {
          student_id: student_id.toString(),
          parent_id: parent_id ? parent_id.toString() : '',
          dojang_code,
          item_id: itemId.toString(),
          size,
          quantity: quantity.toString(),
          payment_type: 'item_purchase'
        }
      },
      {
        stripeAccount: connectedAccountId,
        idempotencyKey // Stripe 헤더로 전달
      }
    );

    // 결제 상태 확인
    if (!paymentIntent || paymentIntent.status !== 'succeeded') {
      throw new Error(`Stripe payment failed. Status: ${paymentIntent?.status || 'unknown'}`);
    }

    console.log("✅ Stripe 결제 성공:", paymentIntent.id);

    // ✅ 결제 정보 DB 저장
    await connection.execute(
      `INSERT INTO item_payments (
        student_id, amount, idempotency_key, payment_method, currency, status,
        dojang_code, parent_id, card_id, item_id, size, quantity, payment_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        student_id,
        amountValue, // 달러 단위로 저장
        idempotencyKey,
        'stripe_card',
        'USD',
        'completed',
        dojang_code,
        parent_id,
        card_id,
        itemId,
        size,
        quantity
      ]
    );

    // ✅ 재고 업데이트
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
      payment_intent_id: paymentIntent.id,
      amount_charged: amountValue
    });

  } catch (error) {
    await connection.rollback();
    
    console.error('❌ Error processing Stripe payment:', error);
    
    // Stripe 에러인 경우 더 자세한 정보 제공
    if (error.type === 'StripeCardError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Card was declined', 
        error: error.message,
        decline_code: error.decline_code 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Payment processing failed', 
      error: error.message 
    });
  } finally {
    connection.release();
  }
});






module.exports = router;
