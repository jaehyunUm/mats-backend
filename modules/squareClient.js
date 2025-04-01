// squareClient.js
const { Client, Environment } = require('square');
require('dotenv').config();
const crypto = require("crypto");

// Square 클라이언트 초기화
const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN_PRODUCTION,
  environment:
    process.env.NODE_ENV === 'production'
      ? Environment.Production
      : Environment.Sandbox, // 환경 설정
});

const createSquareClientWithToken = (accessToken) => {
  return new Client({
    accessToken: accessToken, // ✅ 동적으로 `accessToken` 적용
    environment:
      process.env.NODE_ENV === 'production'
        ? Environment.Production
        : Environment.Sandbox,
  });
};


// ✅ PKCE: `code_verifier`와 `code_challenge` 생성 함수
const generateCodeVerifier = () => {
    return crypto.randomBytes(32).toString('base64url');
};

const generateCodeChallenge = (codeVerifier) => {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
};

const base64urlEncode = (obj) => {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

// ✅ generateOAuthLink.js
const generateOAuthLink = (redirectUri, dojangCode) => {
  const clientId = process.env.SQUARE_APPLICATION_ID_PRODUCTION;
  const scope = "BANK_ACCOUNTS_READ BANK_ACCOUNTS_WRITE CUSTOMERS_READ CUSTOMERS_WRITE PAYMENTS_READ PAYMENTS_WRITE";

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // ✅ state에 dojang_code와 code_verifier 함께 담기 (base64url 인코딩)
  const state = Buffer.from(
    JSON.stringify({ dojang_code: dojangCode, code_verifier: codeVerifier })
  ).toString("base64url");

  console.log("💡 Generating OAuth Link for Dojang:", dojangCode);
  console.log("🔐 Encoded state:", state);

  return `https://connect.squareup.com/oauth2/authorize?client_id=${clientId}&scope=${encodeURIComponent(scope)}&session=false&redirect_uri=https://mats-backend.onrender.com/api/bank-account/callback&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
};



// ✅ Access Token 자동 갱신 함수 추가
const refreshSquareAccessToken = async (ownerId) => {
  try {
    // ✅ 현재 저장된 refresh_token 가져오기
    const [rows] = await db.query("SELECT refresh_token FROM owner_bank_accounts WHERE id = ?", [ownerId]);

    if (!rows.length || !rows[0].refresh_token) {
      console.error("❌ No refresh token found for owner:", ownerId);
      return null;
    }

    const refreshToken = rows[0].refresh_token;

    // ✅ Square API에 새 Access Token 요청
    const response = await client.oAuthApi.obtainToken({
      clientId: process.env.SQUARE_APPLICATION_ID_PRODUCTION,
      clientSecret: process.env.SQUARE_APPLICATION_SECRET_PRODUCTION,
      grantType: "refresh_token",
      refreshToken: refreshToken,
    });

    console.log("✅ New Access Token:", response.result.accessToken);

    // ✅ 새 Access Token 및 refresh_token을 DB에 업데이트
    await db.query(
      `UPDATE owner_bank_accounts SET square_access_token = ?, refresh_token = ?, short_lived = ? WHERE id = ?`,
      [response.result.accessToken, response.result.refreshToken, response.result.shortLived, ownerId]
    );

    return response.result.accessToken;
  } catch (error) {
    console.error("❌ Error refreshing access token:", error);
    return null;
  }
};

const checkOAuthScopes = async (accessToken) => {
  try {
      const response = await fetch('https://connect.squareup.com/v2/oauth2/scopes', {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Square-Version': '2024-11-20'
          }
      });

      const data = await response.json();
      console.log("🔹 Square OAuth Scopes Response:", data);

      if (data.scopes) {
          return data.scopes;
      } else {
          console.error("❌ No scopes found in response:", data);
          return null;
      }
  } catch (error) {
      console.error("❌ Error checking OAuth scopes:", error);
      return null;
  }
};



// 필요한 Square API 모듈 추출
const { paymentsApi, customersApi, subscriptionsApi, cardsApi, ordersApi } = client;

// 모듈 내보내기
module.exports = {
  client,
  ordersApi,
  paymentsApi,
  refreshSquareAccessToken,
  generateOAuthLink,
  checkOAuthScopes,
  createSquareClientWithToken,
  customersApi,
  cardsApi,
  subscriptionsApi,
};
