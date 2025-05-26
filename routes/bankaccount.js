const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const stripeClient = require('../modules/stripeClient');
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

// Stripe Connect 콜백 처리
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
    // Stripe OAuth 토큰 교환
    const response = await stripeClient.client.oauth.token({
      grant_type: 'authorization_code',
      code: code,
    });

    const { access_token, refresh_token, stripe_user_id } = response;

    // Stripe 계정 정보 가져오기
    const account = await stripeClient.client.accounts.retrieve(stripe_user_id);

    // DB에 저장
    await db.query(`
      INSERT INTO owner_bank_accounts (
        dojang_code, 
        stripe_access_token, 
        stripe_account_id, 
        refresh_token
      )
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        stripe_access_token = VALUES(stripe_access_token),
        stripe_account_id = VALUES(stripe_account_id),
        refresh_token = VALUES(refresh_token);
    `, [dojang_code, access_token, stripe_user_id, refresh_token]);

    console.log("✅ Stripe Connect Data Successfully Stored in Database");

    // 딥링크로 앱으로 복귀
   // 딥링크 대신 HTML 페이지 응답
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
