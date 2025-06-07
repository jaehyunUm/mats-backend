const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyToken = require('../middleware/verifyToken');
const { cardsApi, platformStripe} = require('../modules/stripeClient'); // ✅ Square API 가져오기
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);



router.post('/subscription/cancel', verifyToken, async (req, res) => {
  const { subscriptionId } = req.body;

  if (!subscriptionId) {
    return res.status(400).json({ success: false, message: 'Subscription ID is required.' });
  }

  try {
    // ✅ 1️⃣ Stripe API 호출 → 구독 취소
    const deletedSubscription = await platformStripe.subscriptions.del(subscriptionId);

    // ✅ 2️⃣ 도장 코드 확인
    const [rows] = await db.query(
      'SELECT dojang_code FROM owner_bank_accounts WHERE stripe_account_id = (SELECT stripe_account_id FROM owner_bank_accounts WHERE stripe_access_token IS NOT NULL AND status = "active" AND stripe_account_id = ? LIMIT 1)',
      [subscriptionId]
    );

    const dojang_code = rows[0]?.dojang_code;

    // ✅ 3️⃣ 해당 owner_bank_accounts 행 삭제
    if (dojang_code) {
      await db.query(
        'DELETE FROM owner_bank_accounts WHERE dojang_code = ?',
        [dojang_code]
      );
    }

    res.status(200).json({
      success: true,
      message: 'Stripe subscription cancelled and owner bank account deleted.',
      subscription: deletedSubscription,
    });

  } catch (error) {
    console.error('❌ Stripe Cancel Error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel subscription.' });
  }
});



// 서버 라우터 코드
router.get('/subscription/list', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;
  console.log('🔑 도장 코드:', dojang_code);

  if (!dojang_code) {
    return res.status(400).json({ success: false, message: 'Dojang code is required' });
  }

  try {
    const [subscriptions] = await db.query(
      `SELECT 
         stripe_account_id AS subscription_id, 
         status, 
         next_billing_date 
       FROM owner_bank_accounts 
       WHERE dojang_code = ?`,
      [dojang_code]
    );

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({
        success: true,
        subscriptions: [],
        message: 'No subscription records found for this dojang',
      });
    }

    res.status(200).json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error('❌ Error fetching subscriptions from owner_bank_accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscriptions',
      error: error.message,
    });
  }
});

  
router.post("/stripe/subscription/create", verifyToken, async (req, res) => {
  try {
    const { paymentMethodId, planId } = req.body;
    const userId = req.user.id; // 토큰에서 추출

    // DB에서 customer_id 조회
    const [rows] = await db.query(
      "SELECT customer_id FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    if (!rows || rows.length === 0 || !rows[0].customer_id) {
      return res.status(400).json({ success: false, message: "Stripe customer_id not found for this user" });
    }
    const customerId = rows[0].customer_id;

    // 필수값 체크
    if (!customerId || !paymentMethodId || !planId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Stripe 구독 생성
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: planId }],
      default_payment_method: paymentMethodId,
      expand: ['latest_invoice.payment_intent'],
    });

    res.status(200).json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      current_period_end: subscription.current_period_end,
      latest_invoice: subscription.latest_invoice,
    });
  } catch (error) {
    console.error("❌ ERROR creating Stripe Subscription:", error);
    res.status(500).json({ success: false, message: "Error creating Stripe Subscription", error: error.message });
  }
});

  router.get("/update-subscription", verifyToken, async (req, res) => {
    try {
      const { dojang_code } = req.user;
      if (!dojang_code) {
        return res.status(400).json({ success: false, message: "Dojang code is missing in token" });
      }
      
      // ✅ DB에서 도장 코드에 해당하는 구독 ID 조회
      const [subscriptions] = await db.query(
        "SELECT subscription_id FROM subscriptions WHERE dojang_code = ? ORDER BY id DESC LIMIT 1",
        [dojang_code]
      );
      
      if (subscriptions.length === 0) {
        return res.status(404).json({ success: false, message: "No subscription found" });
      }
      
      const subscriptionId = subscriptions[0].subscription_id;
      
      // ✅ Square에서 최신 구독 정보 가져오기
      const response = await fetch(`https://connect.squareup.com/v2/subscriptions/${subscriptionId}`, {
        method: "GET",
        headers: {
          "Square-Version": "2024-01-18",
          "Authorization": `Bearer ${process.env.stripe_access_token_PRODUCTION}`,
          "Content-Type": "application/json",
        },
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.subscription) {
        console.error("❌ Square API error:", data);
        return res.status(400).json({ success: false, message: "Failed to fetch subscription data", details: data });
      }
      
      const nextBillingDate = data.subscription.charged_through_date;
      
      // ✅ DB 업데이트 - 도장 코드로만 조건 지정
      await db.query(
        "UPDATE subscriptions SET next_billing_date = ? WHERE dojang_code = ? AND subscription_id = ?",
        [nextBillingDate, dojang_code, subscriptionId]
      );
      
      res.json({ success: true, nextBillingDate });
    } catch (error) {
      console.error("❌ ERROR updating subscription:", error);
      res.status(500).json({ success: false, message: "Error updating subscription", error: error.message });
    }
  });
  
  router.get("/subscription-status", verifyToken, async (req, res) => {
    try {
      const { dojang_code } = req.user;
  
      // owner_bank_accounts 테이블에서 구독 상태와 다음 결제일 조회
      const [rows] = await db.query(
        "SELECT status, next_billing_date FROM owner_bank_accounts WHERE dojang_code = ? ORDER BY id DESC LIMIT 1",
        [dojang_code]
      );
  
      if (rows.length === 0) {
        return res.status(200).json({
          success: true,
          status: "Inactive",
          subscriptionId: null,
          nextBillingDate: null
        });
      }
  
      const { status, next_billing_date } = rows[0];
  
      res.json({
        success: true,
        subscriptionId: null, // subscription_id는 더 이상 사용하지 않음
        status,
        nextBillingDate: next_billing_date,
      });
    } catch (error) {
      console.error("❌ Error fetching subscription status from DB:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });
  

// 📌 Stripe 계정 상태 체크 API
router.get("/stripe/status", verifyToken, async (req, res) => {
  try {
    const { dojang_code } = req.user;

    if (!dojang_code) {
      return res.status(400).json({ success: false, message: "Missing dojang_code" });
    }

    // 1. 해당 도장의 Stripe 계정 ID 조회
    const [rows] = await db.query(
      "SELECT stripe_account_id FROM owner_bank_accounts WHERE dojang_code = ?",
      [dojang_code]
    );

    if (rows.length === 0 || !rows[0].stripe_account_id) {
      return res.status(404).json({ success: false, message: "No Stripe account found" });
    }

    const stripeAccountId = rows[0].stripe_account_id;

    // 2. Stripe 계정 정보 조회
    const account = await stripe.accounts.retrieve(stripeAccountId);

    // 3. 은행 계좌 연결 여부 확인
    const hasBankLinked = account.external_accounts && account.external_accounts.total_count > 0;

    // 4. 카드 결제 활성화 여부(카드 결제 capability)
    const hasCardProcessing = account.capabilities && account.capabilities.card_payments === 'active';

    // 5. 비즈니스 계정 여부(개인/비즈니스 타입)
    const isBusinessAccount = account.business_type === 'company' || account.business_type === 'corporation';

    res.json({
      success: true,
      isBusinessAccount,
      hasBankLinked,
      hasCardProcessing,
    });

  } catch (error) {
    console.error("❌ Error checking Stripe account status:", error);
    res.status(500).json({ success: false, message: "Failed to check Stripe status" });
  }
});
  

router.get('/stripe/plans', async (req, res) => {
  try {
    const products = await stripe.products.list({ active: true });

    // 모든 가격 가져오기
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product']
    });

    // 하나의 Product당 가장 최근 Price만 추출
    const latestPricePerProduct = {};

    for (const price of prices.data) {
      const productId = price.product.id;
      if (
        !latestPricePerProduct[productId] ||
        new Date(price.created * 1000) > new Date(latestPricePerProduct[productId].created * 1000)
      ) {
        latestPricePerProduct[productId] = price;
      }
    }

    const items = Object.values(latestPricePerProduct).map((price) => ({
      id: price.product.id,
      name: price.product.name,
      description: price.product.description,
      price: price.unit_amount,
      priceId: price.id,
      interval: price.recurring?.interval,
    }));

    res.json({ items });
  } catch (error) {
    console.error('❌ Stripe Plans Fetch Error:', error);
    res.status(500).json({ error: error.message });
  }
});

  


router.get("/customer/:ownerId" ,verifyToken,  async (req, res) => {
    const { ownerId } = req.params;

    if (!ownerId) {
        return res.status(400).send("Missing ownerId"); // ✅ send() 사용 가능
    }

    try {

        // ✅ 기존 customer_id 조회
        const [rows] = await db.query(
            "SELECT customer_id FROM saved_cards WHERE owner_id = ? AND customer_id IS NOT NULL LIMIT 1",
            [ownerId]
        );

        if (!rows || rows.length === 0 || !rows[0].customer_id) {
            console.warn("⚠️ WARNING: No customer ID found for this owner.");
            return res.status(404).send("Customer ID not found for this owner."); // ✅ send() 사용
        }

       
        // ✅ 데이터를 JSON 변환 없이 반환
        res.send({ success: true, customerId: rows[0].customer_id });

    } catch (error) {
        console.error("❌ ERROR fetching customer ID:", error);
        res.status(500).send("Failed to retrieve customer ID");
    }
});


router.get("/customer/cards/:customerId", verifyToken, async (req, res) => {
  const { customerId } = req.params;
  if (!customerId) {
    return res.status(400).json({ success: false, message: "Missing customerId" });
  }
  
  try {
    // ✅ Square API에서 고객 카드 목록 가져오기
    const squareApiResponse = await cardsApi.listCards(undefined, customerId);
    
    // 카드가 없는 경우 빈 배열 반환 (오류 대신)
    if (!squareApiResponse.result.cards || squareApiResponse.result.cards.length === 0) {
      return res.status(200).json({ success: true, cards: [] });
    }
    
    // ✅ `BigInt` 값을 문자열로 변환하여 JSON 직렬화 오류 방지
    const sanitizedData = squareApiResponse.result.cards.map(card => {
      return Object.fromEntries(
        Object.entries(card).map(([key, value]) => {
          if (typeof value === "bigint") {
            return [key, value.toString()];
          }
          return [key, value];
        })
      );
    });
    
    res.status(200).json({ success: true, cards: sanitizedData });
  } catch (error) {
    console.error("❌ ERROR fetching customer cards:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve customer cards", error: error.message });
  }
});


router.post('/owner/customer/create', verifyToken, async (req, res) => {
  const { email, cardholderName } = req.body;

  if (!email || !cardholderName) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // 플랫폼 계정용 키

    // 먼저 기존 고객 확인
    const [existing] = await db.query(
      `SELECT customer_id FROM users WHERE email = ? AND customer_id IS NOT NULL`,
      [email]
    );

    if (existing.length > 0) {
      return res.status(200).json({ success: true, customerId: existing[0].customer_id });
    }

    // Stripe 고객 생성 (플랫폼 계정에 저장됨)
    const customer = await stripe.customers.create({
      name: cardholderName,
      email,
      metadata: { role: 'owner' }
    });

    // DB 저장
    await db.query(
      `UPDATE users SET customer_id = ? WHERE email = ?`,
      [customer.id, email]
    );

    return res.status(200).json({ success: true, customerId: customer.id });

  } catch (error) {
    console.error("❌ Error creating Stripe customer:", error);
    return res.status(500).json({ success: false, message: "Failed to create Stripe customer" });
  }
});

router.post('/stripe/setup/intent', verifyToken, async (req, res) => {
  const { customerId } = req.body;

  if (!customerId) {
    return res.status(400).json({ success: false, message: "Missing customerId" });
  }

  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: 'off_session'
    });

    console.log("✅ [Platform] SetupIntent created:", setupIntent.id);

    res.json({
      success: true,
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      status: setupIntent.status
    });
  } catch (err) {
    console.error('❌ [SetupIntent] Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create SetupIntent',
      error: err.message
    });
  }
});

router.post('/card-save', verifyToken, async (req, res) => {
  const { paymentMethodId, customerId, billingInfo, payment_policy_agreed } = req.body;
  const { id: ownerId, dojang_code } = req.user;

  if (!paymentMethodId || !customerId || !billingInfo || !ownerId) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const {
    cardholderName,
    addressLine1,
    locality,
    administrativeDistrictLevel1,
    postalCode,
    country
  } = billingInfo;

  if (!cardholderName || !addressLine1 || !locality || !administrativeDistrictLevel1 || !postalCode || !country) {
    return res.status(400).json({ success: false, message: 'Missing billing address info' });
  }

  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    // 카드 attach (플랫폼 계정에)
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });

    // 기본 결제 수단 설정
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // 카드 정보 가져오기
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    const card = paymentMethod.card;

    const expiration = `${card.exp_month}/${card.exp_year}`;
    const lastFour = card.last4;
    const cardBrand = card.brand;

    // DB 저장
    const query = `
      INSERT INTO saved_cards (
        owner_id,
        card_name,
        expiration,
        card_token,
        card_id,
        card_brand,
        last_four,
        dojang_code,
        customer_id,
        payment_policy_agreed,
        payment_policy_agreed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const queryParams = [
      ownerId,
      cardholderName,
      expiration,
      paymentMethodId,
      paymentMethodId,
      cardBrand,
      lastFour,
      dojang_code,
      customerId,
      payment_policy_agreed ? 1 : 0,
      payment_policy_agreed ? new Date() : null
    ];

    await db.execute(query, queryParams);

    return res.status(200).json({
      success: true,
      cardId: paymentMethodId,
      message: "Card saved successfully."
    });
  } catch (error) {
    console.error("❌ Stripe card save error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save card.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});



// Apple IAP receipt verification endpoint
router.post('/verify-receipt', verifyToken, async (req, res) => {
  const { receipt, productId } = req.body;
  const { dojang_code } = req.user;

  if (!receipt || !productId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Receipt and product ID are required' 
    });
  }

  try {
    // Verify receipt with Apple's servers
    const verifyUrl = process.env.NODE_ENV === 'production'
      ? 'https://buy.itunes.apple.com/verifyReceipt'
      : 'https://sandbox.itunes.apple.com/verifyReceipt';

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receipt,
        'password': process.env.APPLE_SHARED_SECRET,
        'exclude-old-transactions': true
      })
    });

    const data = await response.json();

    if (data.status !== 0) {
      console.error('Apple receipt verification failed:', data);
      return res.status(400).json({
        success: false,
        message: 'Invalid receipt'
      });
    }

    // Find the latest subscription purchase
    const latestReceipt = data.latest_receipt_info
      ? data.latest_receipt_info[data.latest_receipt_info.length - 1]
      : null;

    if (!latestReceipt) {
      return res.status(400).json({
        success: false,
        message: 'No valid subscription found'
      });
    }

    // Check if the subscription is active
    const expiresDate = new Date(parseInt(latestReceipt.expires_date_ms));
    const isActive = expiresDate > new Date();

    if (!isActive) {
      return res.status(400).json({
        success: false,
        message: 'Subscription has expired'
      });
    }

    // Update user's subscription status in database
    await db.query(
      `INSERT INTO subscriptions (
        dojang_code, 
        subscription_id, 
        status, 
        next_billing_date,
        payment_method
      ) VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        next_billing_date = VALUES(next_billing_date),
        payment_method = VALUES(payment_method)`,
      [
        dojang_code,
        latestReceipt.transaction_id,
        'active',
        expiresDate.toISOString().split('T')[0],
        'apple_iap'
      ]
    );

    res.json({
      success: true,
      subscriptionActive: true,
      expiresDate: expiresDate.toISOString()
    });

  } catch (error) {
    console.error('Error verifying receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying receipt'
    });
  }
});

router.delete('/delete-account', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting account' });
  }
});

module.exports = router;
