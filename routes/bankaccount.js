
const fs = require('fs');
const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const { generateOAuthLink, client } = require('../modules/squareClient');
require('dotenv').config();
const { createSquareClientWithToken } = require('../utils/squareClient');


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


     // ✅ Square API 클라이언트 생성
     const squareClient = createSquareClientWithToken(accessToken);

     // ✅ Location 정보 가져오기
     const { result: locationResult } = await squareClient.locationsApi.listLocations();
     const locations = locationResult.locations || [];
 
     if (!locations.length) {
       return res.status(400).json({ success: false, message: "No Square locations found for this account." });
     }
 
     const defaultLocation = locations.find(loc => loc.status === "ACTIVE" && loc.capabilities.includes("CREDIT_CARD_PROCESSING")) || locations[0];
     const locationId = defaultLocation.id;
 

    // ✅ DB에 저장
    await db.query(`
      INSERT INTO owner_bank_accounts (dojang_code, square_access_token, merchant_id, scope, refresh_token, location_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        square_access_token = VALUES(square_access_token),
        merchant_id = VALUES(merchant_id),
        scope = VALUES(scope),
        refresh_token = VALUES(refresh_token),
        location_id = VALUES(location_id);
    `, [dojang_code, accessToken, merchantId, scope, refreshToken, locationId]);

    console.log("✅ Square OAuth Data Successfully Stored in Database");

    // ✅ 딥링크로 앱으로 복귀
    res.redirect("matsapp://oauth-callback");

  } catch (error) {
    console.error('❌ OAuth Error:', error);
    res.status(500).json({ success: false, message: 'Failed to connect Square account' });
  }
});

  





module.exports = router;
