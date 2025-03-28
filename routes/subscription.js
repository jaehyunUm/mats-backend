const express = require("express");
const router = express.Router();
const db = require("../db");
const verifySubscription = require('../middleware/verifySubscription');
const verifyToken = require('../middleware/verifyToken');
const { cardsApi, customersApi, subscriptionsApi, locationId , squareClient} = require('../modules/squareClient'); // ✅ Square API 가져오기
const { v4: uuidv4 } = require("uuid");
const { createOrderTemplate } = require('./createOrderTemplate'); // ② 방금 만든 함수

router.post('/subscription/cancel', verifyToken, async (req, res) => {
  const { subscriptionId } = req.body;

  if (!subscriptionId) {
      return res.status(400).json({ success: false, message: 'Subscription ID is required.' });
  }

  try {
      // ✅ 1️⃣ Square API 호출 → 구독 취소 요청
      const response = await fetch(`https://connect.squareup.com/v2/subscriptions/${subscriptionId}/cancel`, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN_PRODUCTION}`, // Square API 토큰
              'Content-Type': 'application/json',
          },
      });

      const data = await response.json();

      // ✅ 2️⃣ Square API 응답이 실패했을 경우
      if (!response.ok) {
          console.error('❌ Square API Error:', data);
          return res.status(response.status).json({ success: false, message: 'Failed to cancel subscription with Square API' });
      }

      // ✅ 3️⃣ 구독 정보에서 도장 코드 가져오기
      const [subscription] = await db.query(
          'SELECT dojang_code FROM subscriptions WHERE subscription_id = ?',
          [subscriptionId]
      );

      if (!subscription || subscription.length === 0) {
          return res.status(404).json({ success: false, message: 'Subscription not found.' });
      }

      const dojang_code = subscription[0].dojang_code;

      // ✅ 4️⃣ 구독 정보 삭제
      await db.query(
          'DELETE FROM subscriptions WHERE subscription_id = ?',
          [subscriptionId]
      );

      // ✅ 5️⃣ 해당 도장 코드에 연결된 은행 계좌 정보 삭제
      await db.query(
          'DELETE FROM owner_bank_accounts WHERE dojang_code = ?',
          [dojang_code]
      );

      // ✅ 6️⃣ 최종 응답 반환
      res.status(200).json({
          success: true,
          message: 'Subscription and associated bank account deleted successfully.',
      });

  } catch (error) {
      console.error('❌ Error cancelling subscription:', error);
      res.status(500).json({
          success: false,
          message: 'An error occurred while cancelling the subscription.',
      });
  }
});

  

  router.get('/subscription/list', verifyToken , async (req, res) => {
    console.log('🔑 Token payload:', req.user); // 토큰 정보 확인
     // ✅ 쿼리스트링에서 받거나, 토큰에서 받거나
  const userId = req.query.userId || req.user.id;

    // ✅ 유효성 검사
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
  
    try {
      // ✅ 해당 사용자의 구독 목록을 데이터베이스에서 가져오기
      const [subscriptions] = await db.query(
        'SELECT subscription_id, status, next_billing_date FROM subscriptions WHERE user_id = ?',
        [userId]
      );
  
      // ✅ 구독 정보가 없는 경우 (200 응답 코드로 처리)
      if (!subscriptions || subscriptions.length === 0) {
        return res.status(200).json({
          success: true,
          subscriptions: [],
          message: 'No subscriptions found for this user',
        });
      }
  
      // ✅ 구독 목록 반환
      res.status(200).json({
        success: true,
        subscriptions,
      });
    } catch (error) {
      console.error('❌ Error fetching subscriptions:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching subscriptions',
        error: error.message,
      });
    }
  });
  
  

router.get("/update-subscription", verifyToken , async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ success: false, message: "User ID is required" });
      }
  
      // ✅ DB에서 해당 사용자의 구독 ID 조회
      const [subscriptions] = await db.query("SELECT subscription_id FROM subscriptions WHERE user_id = ?", [userId]);
  
      if (subscriptions.length === 0) {
        return res.status(404).json({ success: false, message: "No subscription found" });
      }
  
      const subscriptionId = subscriptions[0].subscription_id;
  
      // ✅ Square에서 최신 구독 정보 가져오기
      const response = await fetch(`https://connect.squareup.com/v2/subscriptions/${subscriptionId}`, {
        method: "GET",
        headers: {
          "Square-Version": "2024-01-18",
          "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN_PRODUCTION}`,
          "Content-Type": "application/json",
        },
      });
  
      const data = await response.json();
  
      if (!response.ok || !data.subscription) {
        return res.status(400).json({ success: false, message: "Failed to fetch subscription data" });
      }
  
      const nextBillingDate = data.subscription.charged_through_date;
  
      // ✅ DB 업데이트
      await db.query("UPDATE subscriptions SET next_billing_date = ? WHERE user_id = ?", [nextBillingDate, userId]);
  
      res.json({ success: true, nextBillingDate });
    } catch (error) {
      console.error("❌ ERROR updating subscription:", error);
      res.status(500).json({ success: false, message: "Error updating subscription" });
    }
  });
  

// ✅ 구독 상태 조회 API
router.get('/subscription/status', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;
  
    if (!dojang_code) {
      return res.status(400).json({ success: false, message: 'Dojang code is required.' });
    }
  
    try {
      const [subscriptions] = await db.query(
        'SELECT status, next_billing_date FROM subscriptions WHERE dojang_code = ? ORDER BY next_billing_date DESC LIMIT 1',
        [dojang_code]
      );
  
      if (!subscriptions || subscriptions.length === 0) {
        return res.status(404).json({ success: false, message: 'No subscription found.' });
      }
  
      const subscription = subscriptions[0];
      res.status(200).json({
        success: true,
        status: subscription.status,
        next_billing_date: subscription.next_billing_date,
      });
    } catch (error) {
      console.error('❌ Error fetching subscription status:', error);
      res.status(500).json({ success: false, message: 'Error fetching subscription status.' });
    }
  });


// 📌 ✅ 구독 상태 조회 API
router.get("/subscription-status", verifyToken, async (req, res) => {
  try {
    const { id: userId, dojang_code } = req.user;

    if (!userId) {
      return res.status(400).json({ success: false, message: "Missing userId" });
    }

    const [rows] = await db.query(
      "SELECT subscription_id, status, next_billing_date FROM subscriptions WHERE user_id = ? AND dojang_code = ?",
      [userId, dojang_code]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "No active subscription found" });
    }

    const { subscription_id, status, next_billing_date } = rows[0];

    res.json({
      success: true,
      subscriptionId: subscription_id,
      status,
      nextBillingDate: next_billing_date,
    });
  } catch (error) {
    console.error("❌ Error fetching subscription status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
  

router.post("/subscription",verifyToken, async (req, res) => {
    try {
      const {
        quantity = "1",
        name = "Dojang Subscription Item",
        price,          
        currency = "USD",
        userId, 
        customerId,
        planVariationId,
        card_id,
        start_date,
        location_id
      } = req.body;
      
          // ✅ 도장 코드 가져오기 (토큰에서 추출)
    const { dojang_code } = req.user;

       // 2️⃣ 필수 필드 검증
    if (!userId || !customerId || !planVariationId || !card_id || !start_date || !location_id || !dojang_code) {
      console.error("❌ ERROR: Missing required fields in subscription request.");
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
  
      // 3️⃣ 먼저 'Order Template'(DRAFT 주문) 생성
      console.log("📢 DEBUG: Creating DRAFT Order (template)...");
      const orderTemplateResult = await createOrderTemplate(quantity, name, price, currency);
      const orderTemplateId = orderTemplateResult.order?.id;
  
      if (!orderTemplateId) {
        console.error("❌ ERROR: Failed to get orderTemplateId.");
        return res.status(400).json({ success: false, message: "Failed to create Order Template." });
      }
  
      console.log("📢 DEBUG: Created Order Template ID:", orderTemplateId);
  
      // 4️⃣ RELATIVE 가격 구독에서 phases[].order_template_id 로 사용
      const idempotencyKey = uuidv4();  // ✅ 올바른 선언 방식
      const subscriptionPayload = {
        idempotency_key: idempotencyKey,
        location_id: location_id,
        plan_variation_id: planVariationId,
        customer_id: customerId,
        start_date: start_date,
        card_id: card_id,
        phases: [
          {
            ordinal: 1,
            order_template_id: orderTemplateId
          }
        ]
      };
  
      console.log("📢 DEBUG: Creating Subscription with Payload:", subscriptionPayload);
  
      // 5️⃣ Square Subscriptions API 호출
      const subscriptionResponse = await fetch("https://connect.squareup.com/v2/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN_PRODUCTION}`
        },
        body: JSON.stringify(subscriptionPayload)
      });
  
      const subscriptionData = await subscriptionResponse.json();
      console.log("📢 DEBUG: Subscription API Response:", JSON.stringify(subscriptionData, null, 2));
  
      if (!subscriptionResponse.ok || !subscriptionData.subscription || !subscriptionData.subscription.id) {
        console.error("❌ ERROR: Failed to create Subscription.", subscriptionData);
        return res.status(subscriptionResponse.status).json(subscriptionData);
      }
  
 // ✅ Square에서 받은 구독 정보 저장
 const subscriptionId = subscriptionData.subscription.id;
 const nextBillingDate = subscriptionData.subscription.charged_through_date;

 console.log("✅ DEBUG: Saving subscription data to database...");

 // 6️⃣ 데이터베이스에 저장 (도장 코드 포함)
 await db.query(
    `INSERT INTO subscriptions (user_id, customer_id, subscription_id, status, next_billing_date, dojang_code)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = ?, next_billing_date = ?, dojang_code = ?`,
    [
      userId,
      customerId,
      subscriptionId,
      "ACTIVE",
      nextBillingDate,
      dojang_code,
      "ACTIVE",
      nextBillingDate,
      dojang_code
    ]
  );


 console.log("✅ DEBUG: Subscription saved successfully!");

      // 6️⃣ 최종 응답
      res.status(200).json({ success: true, subscriptionId: subscriptionData.subscription.id, nextBillingDate });
    } catch (error) {
      console.error("❌ ERROR creating Subscription:", error);
      res.status(500).json({ success: false, message: "Error creating Subscription", error });
    }
  });
  
  


router.get("/square/plans", async (req, res) => {
    try {
        console.log("📢 DEBUG: Fetching Square Subscription Plans...");
        const response = await fetch("https://connect.squareup.com/v2/catalog/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN_PRODUCTION}`
            },
            body: JSON.stringify({
                object_types: ["ITEM", "SUBSCRIPTION_PLAN"]
            })
        });

        const data = await response.json();
        console.log("📢 DEBUG: Square API Raw Response:", JSON.stringify(data, null, 2));

         // ✅ 🔥 [디버깅 코드 추가] 🔥 Square API 전체 응답 확인
         console.log("📢 DEBUG: Full Square API Response:", JSON.stringify(data.objects, null, 2));

         // ✅ Subscription Plan ID 로그 확인
         data.objects.filter(obj => obj.type === "SUBSCRIPTION_PLAN").forEach(plan => {
            console.log(`📢 DEBUG: Plan - ID: ${plan.id}, Name: ${plan.subscription_plan_data.name}, 
                is_deleted: ${plan.is_deleted}, present_at_all_locations: ${plan.present_at_all_locations}, 
                location_ids: ${JSON.stringify(plan.subscription_plan_data.location_ids)}`);
        });
        
 
         // ✅ Subscription Plan의 Variations 로그 확인
         data.objects
             .filter(plan => plan.type === "SUBSCRIPTION_PLAN")
             .forEach(plan => {
                 console.log(`📢 DEBUG: Plan ${plan.subscription_plan_data.name} Variations:`, 
                     JSON.stringify(plan.subscription_plan_data.subscription_plan_variations, null, 2)
                 );
             });
 

        // ✅ 서비스(ITEM) 필터링 및 가격 정보 추출
        const items = data.objects
            .filter(item => item.type === "ITEM" && item.is_deleted === false)
            .map(item => ({
                id: item.id,
                name: item.item_data.name,
                description: item.item_data.description || "No description available",
                variations: item.item_data.variations.map(variation => ({
                    id: variation.id,
                    name: variation.item_variation_data.name,
                    price: variation.item_variation_data.price_money?.amount || 0,
                    currency: variation.item_variation_data.price_money?.currency || "USD",
                    subscription_plan_ids: variation.item_variation_data.subscription_plan_ids || []
                }))
            }));


        // ✅ 활성화된 구독 플랜(SUBSCRIPTION_PLAN)만 필터링
        const plans = data.objects
        .filter(plan => 
            plan.type === "SUBSCRIPTION_PLAN" &&
            !plan.is_deleted &&  
            (!!plan.present_at_all_locations || (plan.subscription_plan_data.location_ids && plan.subscription_plan_data.location_ids.length > 0))
        )
        .map(plan => {
            const variations = (plan.subscription_plan_data.subscription_plan_variations || [])
                .filter(variation => 
                    !variation.is_deleted &&
                    (!!variation.present_at_all_locations || (variation.location_ids && variation.location_ids.length > 0))
                )
                .map(variation => {
                    let priceInfo = variation.subscription_plan_variation_data?.phases?.[0]?.pricing?.price_money || { amount: 0, currency: "USD" };
    
                    if (priceInfo.amount === 0) {
                        const relatedItem = items.find(item =>
                            item.variations.some(variation => variation.subscription_plan_ids.includes(plan.id))
                        );
    
                        if (relatedItem) {
                            const relatedVariation = relatedItem.variations.find(variation => variation.subscription_plan_ids.includes(plan.id));
                            if (relatedVariation) {
                                priceInfo = { amount: relatedVariation.price, currency: relatedVariation.currency };
                            }
                        }
                    }
    
                    return {
                        id: variation.id,
                        name: variation.subscription_plan_variation_data?.name || "Unnamed Variation",
                        price: priceInfo.amount,
                        currency: priceInfo.currency
                    };
                });
    
            return {
                id: plan.id,
                name: plan.subscription_plan_data?.name || "Unnamed Plan",
                variations: variations
            };
        })
        .filter(plan => plan.variations.length > 0);

   // ✅ ORDER_TEMPLATE 데이터 필터링
   const orderTemplates = data.objects
   .filter(obj => obj.type === "ORDER_TEMPLATE")
   .map(template => ({
       id: template.id,
       name: template.order_template_data?.name || "Unnamed Order Template",
       line_items: template.order_template_data?.line_items || []
   }));

// ✅ 디버깅 로그 추가
console.log("📢 DEBUG: Final Plans:", JSON.stringify(plans, null, 2));
console.log("📢 DEBUG: Final Items:", JSON.stringify(items, null, 2));
console.log("📢 DEBUG: Final Order Templates:", JSON.stringify(orderTemplates, null, 2));       
    
    // ✅ 디버깅 로그 추가 (최종 필터링된 구독 플랜 확인)
    plans.forEach(plan => {
        console.log(`📢 DEBUG: Final Plan - ID: ${plan.id}, Name: ${plan.name}, Variations:`, JSON.stringify(plan.variations, null, 2));
    });


    
    
        // ✅ ITEM과 SUBSCRIPTION_PLAN 연결
        const enrichedPlans = plans.map(plan => {
            const relatedItems = items.filter(item =>
                item.variations.some(variation => variation.subscription_plan_ids.includes(plan.id))
            );

            return {
                ...plan,
                relatedItems: relatedItems.map(item => ({
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    price: item.variations[0]?.price || 0,
                    currency: item.variations[0]?.currency || "USD"
                }))
            };
        });

        console.log("✅ Enriched Active Subscription Plans:", JSON.stringify(enrichedPlans, null, 2));
        res.status(200).json({ 
            items: items, 
            subscriptionPlans: data.objects.filter(obj => obj.type === "SUBSCRIPTION_PLAN"), // ✅ 구독 플랜만 반환
            orderTemplates // ✅ 추가된 ORDER_TEMPLATE 데이터
       
        });
    } catch (error) {
        console.error("❌ ERROR fetching Square plans:", error);
        res.status(500).json({ success: false, message: "Failed to fetch Square plans" });
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

       
        if (!squareApiResponse.result.cards || squareApiResponse.result.cards.length === 0) {
            return res.status(404).json({ success: false, message: "No cards found for this customer." });
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


router.post("/customer-create", verifyToken, async (req, res) => {
    
    const { email, cardholderName } = req.body;

    if (!email || !cardholderName) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    try {
        console.log("📢 DEBUG: Creating customer for email:", email);

        const [firstName, ...lastNameParts] = cardholderName.split(" ");
        const lastName = lastNameParts.join(" ") || "Unknown";

        console.log("📢 DEBUG: First Name:", firstName);
        console.log("📢 DEBUG: Last Name:", lastName);

        // ✅ Square API를 사용하여 고객 생성
        const response = await customersApi.createCustomer({
            givenName: firstName,
            familyName: lastName,
            emailAddress: email
        });

        console.log("📢 DEBUG: Raw Square API Response:", JSON.stringify(customersApi, null, 2));
        console.log("✅ Customer created successfully:", response.result);
        res.status(200).json({ success: true, customerId: response.result.customer.id });
    } catch (error) {
        console.error("❌ ERROR creating customer:", error);
        res.status(500).json({ success: false, message: "Failed to create customer", error: error.message });
    }
});

router.post('/card-save', verifyToken, async (req, res) => {
  const { cardToken, customerId, ownerId, billingInfo, payment_policy_agreed } = req.body;
  const { dojang_code } = req.user; // 토큰에서 도장코드

  if (!ownerId) {
    return res.status(400).json({ success: false, message: "Owner ID is required." });
  }

  if (!cardToken || !customerId || !billingInfo) {
    return res.status(400).json({ success: false, message: "Missing required fields." });
  }

  const { cardholderName, addressLine1, locality, administrativeDistrictLevel1, postalCode, country } = billingInfo;

  if (!cardholderName || !addressLine1 || !locality || !administrativeDistrictLevel1 || !postalCode || !country) {
    return res.status(400).json({ success: false, message: "Missing required billing info fields." });
  }

  try {
    const ownerAccessToken = process.env.SQUARE_ACCESS_TOKEN_PRODUCTION;

    if (!ownerAccessToken) {
      return res.status(500).json({ success: false, message: "Square Access Token is not configured." });
    }

    // Square API 호출
    const { result: cardResult } = await cardsApi.createCard({
      idempotencyKey: uuidv4(),
      sourceId: cardToken,
      card: {
        cardholderName,
        billingAddress: {
          addressLine1,
          locality,
          administrativeDistrictLevel1,
          postalCode,
          country,
        },
        customerId,
      },
    });

    if (!cardResult || cardResult.errors) {
      return res.status(400).json({ success: false, message: "Failed to save card. Square API Error", squareError: cardResult.errors });
    }

    const savedCardId = cardResult.card.id;
    const expiration = `${cardResult.card.expMonth}/${cardResult.card.expYear}`;
    const lastFour = cardResult.card.last4;
    const cardBrand = cardResult.card.cardBrand;

    // ✅ MySQL에 카드 + 결제 동의 정보 저장
    const query = `
      INSERT INTO saved_cards (owner_id, card_name, expiration, card_token, card_id, card_brand, last_four, dojang_code, customer_id, payment_policy_agreed, payment_policy_agreed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const queryParams = [
      ownerId, // 오너 ID
      cardholderName,
      expiration,
      cardToken,
      savedCardId,
      cardBrand,
      lastFour,
      dojang_code || null,
      customerId,
      payment_policy_agreed ? 1 : 0, // 동의 여부 저장
      payment_policy_agreed ? new Date() : null // 동의 시간
    ];

    await db.execute(query, queryParams);

    res.status(200).json({ success: true, cardId: savedCardId });
  } catch (error) {
    console.error("❌ ERROR saving card:", error);
    res.status(500).json({ success: false, message: "Failed to save card." });
  }
});



module.exports = router;
