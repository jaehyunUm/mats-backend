
const fs = require('fs');
const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const { generateOAuthLink, client, checkOAuthScopes } = require('../modules/squareClient');
require('dotenv').config();



router.get('/bank-account/connect', verifyToken, (req, res) => {
  const { dojang_code } = req.user; // token에서 추출
  const redirectUri = "matsapp://oauth-callback"; // ✅ 여기 수정
  const authLink = generateOAuthLink(redirectUri, dojang_code);
  res.json({ success: true, url: authLink });
});

const base64urlDecode = (str) => {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return JSON.parse(Buffer.from(str, 'base64').toString());
};

// ✅ Step 2: OAuth 콜백
router.get('/bank-account/callback', async (req, res) => {
  const { code, state } = req.query;
  console.log("🔹 Authorization Code:", code);
  console.log("🔹 State:", state);

  let dojang_code, codeVerifier;
  try {
    const decoded = base64urlDecode(state);
    dojang_code = decoded.dojang_code;
    codeVerifier = decoded.code_verifier;
    console.log("✅ Callback received with dojang_code:", dojang_code);
  } catch (err) {
    console.error("❌ Invalid state format:", err);
    return res.status(400).json({ success: false, message: 'Invalid state format' });
  }

  try {
    const response = await client.oAuthApi.obtainToken({
      clientId: process.env.SQUARE_APPLICATION_ID_PRODUCTION,
      code,
      grantType: 'authorization_code',
      redirectUri: "https://mats-backend.onrender.com/api/bank-account/callback",
      codeVerifier: codeVerifier
    });

    const { accessToken, merchantId, refreshToken } = response.result;

    if (!accessToken || !merchantId) {
      return res.status(500).json({ success: false, message: 'Square API response missing required fields' });
    }

    const scope = "BANK_ACCOUNTS_READ, BANK_ACCOUNTS_WRITE, CUSTOMERS_READ, CUSTOMERS_WRITE, PAYMENTS_READ, PAYMENTS_WRITE";

    // ✅ DB 저장
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

    console.log("✅ Square OAuth Data Successfully Stored in Database");

    res.redirect("matsapp://oauth-callback");

  } catch (error) {
    console.error('❌ OAuth Error:', error);
    res.status(500).json({ success: false, message: 'Failed to connect Square account' });
  }
});

  





module.exports = router;
