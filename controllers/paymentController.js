const { paymentsApi } = require('../modules/squareClient'); // Square 클라이언트 가져오기
const { v4: uuidv4 } = require('uuid');

const processPayment = async (req, res) => {
  const { amount, currency, paymentToken, idempotencyKey, customer_id, saveCard } = req.body;

  try {
    console.log('Processing payment with:', {
      amount,
      currency,
      paymentToken,
      idempotencyKey,
      customer_id,
    });

    // Square Payment API 호출
    const { result } = await paymentsApi.createPayment({
      sourceId: paymentToken,
      amountMoney: {
        amount: Math.round(amount * 100), // 금액 설정 (USD 기준)
        currency,
      },
      idempotencyKey,
      customerId: customer_id,
      cardOptions: saveCard ? { saveCard: true } : undefined,
    });

    console.log('Payment result:', result);

    if (result.payment && result.payment.status === 'COMPLETED') {
      res.status(200).json({ success: true, message: 'Payment processed successfully' });
    } else {
      throw new Error('Payment failed or not completed');
    }
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ success: false, message: 'Error processing payment' });
  }
};

module.exports = { processPayment };
