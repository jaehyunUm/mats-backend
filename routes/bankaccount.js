
const fs = require('fs');
const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const { generateOAuthLink, client, checkOAuthScopes } = require('../modules/squareClient');
require('dotenv').config();



router.get('/bank-account/connect', verifyToken, (req, res) => {
  const { dojang_code } = req.user; // token에서 추출
  const redirectUri = 'https://mats-backend.onrender.com/api/bank-account/callback';
  const authLink = generateOAuthLink(redirectUri, dojang_code);
  res.json({ success: true, url: authLink });
});


router.get('/bank-account/callback', async (req, res) => {
  const { code, state } = req.query;

  console.log("🔹 Authorization Code:", code);
  console.log("🔹 State:", state);

  if (!code || !state) {
    return res.status(400).json({ success: false, message: "Missing authorization code or state" });
  }

  // state는 dojang_code로 사용
const dojang_code = state;

// 여기서 dojang_code 로그 찍어보기
console.log("✅ Callback received with dojang_code (state):", dojang_code);


  try {
    const response = await client.oAuthApi.obtainToken({
      clientId: process.env.SQUARE_APPLICATION_ID_PRODUCTION,
      code,
      grantType: 'authorization_code',
      redirectUri: process.env.SQUARE_REDIRECT_URI,
      codeVerifier,
    });

    console.log('✅ Square API Response:', response.result);

    const { accessToken, merchantId, refreshToken } = response.result;
    const scope = "BANK_ACCOUNTS_READ, BANK_ACCOUNTS_WRITE, CUSTOMERS_READ, CUSTOMERS_WRITE, PAYMENTS_READ, PAYMENTS_WRITE";

    const query = `
      INSERT INTO owner_bank_accounts (dojang_code, square_access_token, merchant_id, scope, refresh_token)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        square_access_token = VALUES(square_access_token),
        merchant_id = VALUES(merchant_id),
        scope = VALUES(scope),
        refresh_token = VALUES(refresh_token);
    `;

    await db.query(query, [dojang_code, accessToken, merchantId, scope, refreshToken]);

    console.log("✅ OAuth data stored successfully");

    res.send("✅ Your Square account has been connected. You can close this page.");
  } catch (error) {
    console.error("❌ OAuth error:", error);
    res.status(500).json({ success: false, message: "Failed to connect Square account" });
  }
});

  





module.exports = router;
