const db = require("../db");

const verifySubscription = async (req, res, next) => {
  const { dojang_code } = req.user;

  if (!dojang_code) {
    return res.status(400).json({ success: false, message: 'Dojang code is required.' });
  }

  try {
    const [subscriptions] = await db.query(
      'SELECT status FROM subscriptions WHERE dojang_code = ? ORDER BY next_billing_date DESC LIMIT 1',
      [dojang_code]
    );

    // ✅ 구독 상태 확인
    if (!subscriptions || subscriptions[0].status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your subscription is not active.' });
    }

    next();
  } catch (error) {
    console.error("❌ Subscription Verification Error:", error);
    res.status(500).json({ success: false, message: "Subscription verification failed" });
  }
};

module.exports = verifySubscription;
