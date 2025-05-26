// squareClient.js
const stripe = require('stripe');
require('dotenv').config();
const crypto = require("crypto");

// Stripe 클라이언트 초기화
const client = stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const createStripeClientWithKey = (secretKey) => {
  return stripe(secretKey, {
    apiVersion: '2023-10-16',
  });
};

// Stripe Connect OAuth 링크 생성
const generateOAuthLink = (redirectUri, dojangCode) => {
  const clientId = process.env.STRIPE_CLIENT_ID;
  console.log('🔑 Using STRIPE_CLIENT_ID:', clientId); // 클라이언트 ID 로깅
  
  const scope = "read_write"; // Stripe Connect 기본 스코프

  // state에 dojang_code 담기 (base64url 인코딩)
  const state = Buffer.from(
    JSON.stringify({ dojang_code: dojangCode })
  ).toString("base64url");

  console.log("💡 Generating Stripe Connect Link for Dojang:", dojangCode);
  console.log("🔐 Encoded state:", state);

  const authUrl = `https://connect.stripe.com/oauth/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  console.log('🔗 Final Auth URL:', authUrl); // 최종 URL 로깅
  return authUrl;
};

// Stripe 계정 토큰 갱신
const refreshStripeAccessToken = async (ownerId) => {
  try {
    // 현재 저장된 refresh_token 가져오기
    const [rows] = await db.query("SELECT refresh_token FROM owner_bank_accounts WHERE id = ?", [ownerId]);

    if (!rows.length || !rows[0].refresh_token) {
      console.error("❌ No refresh token found for owner:", ownerId);
      return null;
    }

    const refreshToken = rows[0].refresh_token;

    // Stripe OAuth 토큰 갱신
    const response = await stripe.oauth.token({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    console.log("✅ New Stripe Access Token:", response.access_token);

    // 새 토큰을 DB에 업데이트
    await db.query(
      `UPDATE owner_bank_accounts SET stripe_access_token = ?, refresh_token = ? WHERE id = ?`,
      [response.access_token, response.refresh_token, ownerId]
    );

    return response.access_token;
  } catch (error) {
    console.error("❌ Error refreshing Stripe access token:", error);
    return null;
  }
};

// Stripe 계정 권한 확인
const checkStripeScopes = async (accessToken) => {
  try {
    const account = await stripe.accounts.retrieve(accessToken);
    console.log("🔹 Stripe Account Scopes:", account.scopes);
    return account.scopes;
  } catch (error) {
    console.error("❌ Error checking Stripe scopes:", error);
    return null;
  }
};

// 필요한 Stripe API 모듈 추출
const { accounts, customers, paymentMethods, subscriptions, charges } = client;

// 모듈 내보내기
module.exports = {
  client,
  accounts,
  customers,
  paymentMethods,
  subscriptions,
  charges,
  refreshStripeAccessToken,
  generateOAuthLink,
  checkStripeScopes,
  createStripeClientWithKey,
};
