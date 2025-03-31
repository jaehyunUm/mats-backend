
const fs = require('fs');
const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const { generateOAuthLink, client, checkOAuthScopes } = require('../modules/squareClient');
require('dotenv').config();



router.get('/bank-account/connect', (req, res) => {
    const redirectUri = 'https://mats-backend.onrender.com/api/bank-account/callback'; // 콜백 URI 설정
    const authLink = generateOAuthLink(redirectUri);
    res.json({ success: true, url: authLink });
  });

  // ✅ .env 파일 업데이트 함수
const updateEnvFile = (key, value) => {
  const envFilePath = '.env';
  let envVars = fs.readFileSync(envFilePath, 'utf8').split('\n');

  // 기존 값 업데이트 또는 새 값 추가
  let found = false;
  envVars = envVars.map(line => {
      if (line.startsWith(key + '=')) {
          found = true;
          return `${key}=${value}`;
      }
      return line;
  });

  if (!found) {
      envVars.push(`${key}=${value}`);
  }

  fs.writeFileSync(envFilePath, envVars.join('\n'));
};


// ✅ OAuth Scope 확인 테스트 함수
const testScopeCheck = async () => {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
      console.log("❌ No access token found in environment variables.");
      return;
  }

  const scopes = await checkOAuthScopes(accessToken);
  console.log("🔹 Final Square Scope Check:", scopes);
};

router.get('/bank-account/callback', async (req, res) => {
    const { code } = req.query;
    const { dojang_code } = req.user;
    console.log("🔹 Authorization Code from Square:", code);
  
    if (!code) {
      return res.status(400).json({ success: false, message: 'Missing authorization code' });
    }
  
    try {
      // ✅ 환경 변수에서 `code_verifier` 가져오기
      const codeVerifier = process.env.SQUARE_CODE_VERIFIER;
      if (!codeVerifier) {
        console.error("❌ Error: Missing code_verifier for PKCE.");
        return res.status(500).json({ success: false, message: 'Missing code_verifier for PKCE flow.' });
      }
  
      // ✅ Square OAuth 토큰 요청 (PKCE 사용)
      const response = await client.oAuthApi.obtainToken({
        clientId: process.env.SQUARE_APPLICATION_ID_PRODUCTION,
        code,
        grantType: 'authorization_code',
        redirectUri: process.env.SQUARE_REDIRECT_URI,
        codeVerifier: codeVerifier
      });
  
      console.log('✅ Square API Response:', response.result);
  
      const { accessToken, merchantId, refreshToken } = response.result;
  
      if (!accessToken || !merchantId) {
        return res.status(500).json({ success: false, message: 'Square API response missing required fields' });
      }
  
      console.log('🔹 OAuth Access Token:', accessToken);
      console.log('🔹 Merchant ID:', merchantId);
  
      // ✅ OAuth Scope을 DB에도 저장
      const scope = "BANK_ACCOUNTS_READ, BANK_ACCOUNTS_WRITE, CUSTOMERS_READ, CUSTOMERS_WRITE, PAYMENTS_READ, PAYMENTS_WRITE";
      console.log("🔹 Using predefined OAuth Scope:", scope);
  
      // ✅ DB에 저장 (short_lived 제거, dojang_code 유지)
      const query = `
        INSERT INTO owner_bank_accounts (dojang_code, square_access_token, merchant_id, scope, refresh_token)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          square_access_token = VALUES(square_access_token),
          merchant_id = VALUES(merchant_id),
          scope = VALUES(scope),
          refresh_token = VALUES(refresh_token);
      `;
  
      await db.query(query, [
        dojang_code, accessToken, merchantId, scope, refreshToken
      ]);
  
      console.log("✅ Square OAuth Data Successfully Stored in Database");
  
      // ✅ 프론트엔드에서 리디렉트할 수 있도록 JSON 응답 반환
      res.json({ success: true, redirectTo: "https://www.squareup.com/activate" });
  
    } catch (error) {
      console.error('❌ OAuth Error:', error);
      res.status(500).json({ success: false, message: 'Failed to connect Square account' });
    }
  });
  





module.exports = router;
