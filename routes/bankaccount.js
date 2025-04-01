
const fs = require('fs');
const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const { generateOAuthLink, client } = require('../modules/squareClient');
require('dotenv').config();



// ✅ router: /bank-account/connect
router.get('/bank-account/connect', verifyToken, (req, res) => {
  const dojang_code = req.user.dojang_code;
  const redirectUri = "https://mats-backend.onrender.com/api/bank-account/callback";
  const authLink = generateOAuthLink(redirectUri, dojang_code);
  res.json({ success: true, url: authLink });
});


const base64urlDecode = (str) => {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return JSON.parse(Buffer.from(str, 'base64').toString());
};

// ✅ router: /bank-account/callback
router.get('/bank-account/callback', async (req, res) => {
  const { code, state } = req.query;
  console.log("🔹 Authorization Code:", code);
  console.log("🔹 State:", state);

  let dojang_code, codeVerifier;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
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
    const scope = "BANK_ACCOUNTS_READ, BANK_ACCOUNTS_WRITE, CUSTOMERS_READ, CUSTOMERS_WRITE, PAYMENTS_READ, PAYMENTS_WRITE";

    await db.query(`
      INSERT INTO owner_bank_accounts (dojang_code, square_access_token, merchant_id, scope, refresh_token)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        square_access_token = VALUES(square_access_token),
        merchant_id = VALUES(merchant_id),
        scope = VALUES(scope),
        refresh_token = VALUES(refresh_token);
    `, [dojang_code, accessToken, merchantId, scope, refreshToken]);

    console.log("✅ Square OAuth Data Successfully Stored in Database");

    // ✅ 딥링크로 앱으로 복귀
    res.redirect("matsapp://oauth-callback");

  } catch (error) {
    console.error('❌ OAuth Error:', error);
    res.status(500).json({ success: false, message: 'Failed to connect Square account' });
  }
});

  





module.exports = router;
