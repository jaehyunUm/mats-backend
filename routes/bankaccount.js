const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const { platformStripe, stripeClient } = require('../modules/stripeClient');
require('dotenv').config();

// 환경 변수 로깅 추가
console.log('🔑 Environment Variables:');
console.log('STRIPE_CLIENT_ID:', process.env.STRIPE_CLIENT_ID);
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'Set' : 'Not Set');

// Stripe Connect 시작
router.get('/bank-account/connect', verifyToken, (req, res) => {
  const dojang_code = req.user.dojang_code;
  const redirectUri = "https://mats-backend.onrender.com/api/bank-account/callback";
  
  // stripeClient 모듈 확인
  console.log('🔍 stripeClient module:', stripeClient);
  
  const authLink = stripeClient.generateOAuthLink(redirectUri, dojang_code);
  console.log('🔗 Generated Auth Link:', authLink);
  res.json({ success: true, url: authLink });
});


router.get('/bank-account/callback', async (req, res) => {
  const { code, state } = req.query;
  console.log("🔹 Authorization Code:", code);
  console.log("🔹 State:", state);

  let dojang_code;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    dojang_code = decoded.dojang_code;
    console.log("✅ Callback received with dojang_code:", dojang_code);
  } catch (err) {
    console.error("❌ Invalid state format:", err);
    return res.status(400).json({ success: false, message: 'Invalid state format' });
  }

  try {
    // 1️⃣ Stripe OAuth 토큰 요청
    const response = await platformStripe.oauth.token({
      grant_type: 'authorization_code',
      code: code,
    });

    const { access_token, refresh_token, stripe_user_id } = response;

    // 2️⃣ Stripe 계정 정보 가져오기 (선택 사항)
    const account = await platformStripe.accounts.retrieve(stripe_user_id);

    // 3️⃣ 해당 계정에서 구독 조회
    let status = 'inactive';
    let nextBillingDate = null;
    let subscriptionId = null;

    // ❗ 관리형 구독 ID를 플랫폼이 알고 있어야 함 (보통 dojang_code로 저장되어 있거나, 리스트 중 첫 번째 사용)
    const subscriptions = await platformStripe.subscriptions.list({
      limit: 1,
      status: 'all',
    });

    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      status = subscription.status;
      nextBillingDate = new Date(subscription.current_period_end * 1000);
      subscriptionId = subscription.id;  // 구독 ID 저장
    }

    // 4️⃣ owner_bank_accounts에 저장 또는 업데이트
    await db.query(`
      INSERT INTO owner_bank_accounts (
        dojang_code, 
        stripe_access_token, 
        stripe_account_id, 
        refresh_token,
        status,
        next_billing_date,
        subscription_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        stripe_access_token = VALUES(stripe_access_token),
        stripe_account_id = VALUES(stripe_account_id),
        refresh_token = VALUES(refresh_token),
        status = VALUES(status),
        next_billing_date = VALUES(next_billing_date),
        subscription_id = VALUES(subscription_id);
    `, [dojang_code, access_token, stripe_user_id, refresh_token, status, nextBillingDate, subscriptionId]);

    console.log("✅ Bank account + subscription data saved");

    // 5️⃣ 앱으로 리디렉션
    res.send(`
      <html>
        <head>
          <title>Stripe Connection Complete</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; }
            h2 { color: #2ecc71; }
          </style>
        </head>
        <body>
          <h2>✅ Stripe connection completed!</h2>
          <p>Returning to the app...</p>
          <script>
            setTimeout(function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage('mats://stripe-connect-success');
              } else {
                window.location = 'mats://stripe-connect-success';
              }
            }, 500);
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('❌ Stripe OAuth Error:', error);
    res.status(500).json({ success: false, message: 'Failed to connect Stripe account' });
  }
});


module.exports = router;
