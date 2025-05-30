const Stripe = require('stripe');
require('dotenv').config();
const crypto = require("crypto");

// ✅ 플랫폼 Stripe 인스턴스
const platformStripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});



const generateOAuthLink = (redirectUri, dojangCode) => {
  const clientId = process.env.STRIPE_CLIENT_ID;
  const scope = "read_write";
  const responseType = "code";

  const state = Buffer.from(
    JSON.stringify({ dojang_code: dojangCode })
  ).toString("base64url");

  const params = new URLSearchParams({
    response_type: responseType,
    client_id: clientId,
    scope: scope,
    redirect_uri: redirectUri,
    state: state,
  });

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
};

const refreshStripeAccessToken = async (ownerId) => {
  try {
    const [rows] = await db.query("SELECT refresh_token FROM owner_bank_accounts WHERE id = ?", [ownerId]);
    if (!rows.length || !rows[0].refresh_token) {
      console.error("❌ No refresh token found for owner:", ownerId);
      return null;
    }

    const refreshToken = rows[0].refresh_token;

    const response = await platformStripe.oauth.token({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

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

const checkStripeScopes = async (accessToken) => {
  try {
    const account = await platformStripe.accounts.retrieve(accessToken);
    console.log("🔹 Stripe Account Scopes:", account.scopes);
    return account.scopes;
  } catch (error) {
    console.error("❌ Error checking Stripe scopes:", error);
    return null;
  }
};

const createSetupIntentForConnectedAccount = async (customerId, stripeAccountId) => {
  try {
    const setupIntent = await platformStripe.setupIntents.create(
      {
        customer: customerId,
        usage: 'off_session',
      },
      {
        stripeAccount: stripeAccountId,
      }
    );
    console.log("✅ SetupIntent created:", setupIntent.id);
    return setupIntent;
  } catch (error) {
    console.error("❌ Failed to create SetupIntent:", error);
    throw error;
  }
};

module.exports = {
  platformStripe,
  generateOAuthLink,
  refreshStripeAccessToken,
  checkStripeScopes,
  createSetupIntentForConnectedAccount,
};
