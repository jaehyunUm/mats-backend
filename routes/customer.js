const express = require('express');
const router = express.Router();
const { client} = require('../modules/stripeClient');
const { v4: uuidv4 } = require('uuid');
const db = require('../db'); // DB 모듈 확인
const verifyToken = require('../middleware/verifyToken');
const normalizeBrandName = (brand) => {
  // brand가 undefined 또는 null인 경우 처리
  if (!brand) return "Unknown";
  
  switch (brand.toUpperCase()) {
    case "VISA":
      return "Visa";
    case "MASTERCARD":
      return "Mastercard";
    case "DISCOVER":
      return "Discover";
    case "AMERICAN_EXPRESS":
      return "AmericanExpress";
    default:
      return "Unknown";
  }
};
  


  router.post('/customer/create', verifyToken, async (req, res) => {
    const { email, cardholderName } = req.body;
    const { dojang_code } = req.user;
  
    if (!email || !cardholderName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
  
    try {
      // ✅ 도장 오너의 Stripe Access Token 가져오기
      const [ownerRow] = await db.query(
        "SELECT stripe_access_token, stripe_account_id FROM owner_bank_accounts WHERE dojang_code = ?",
        [dojang_code]
      );
  
      if (!ownerRow.length || !ownerRow[0].stripe_access_token || !ownerRow[0].stripe_account_id) {
        return res.status(400).json({ success: false, message: "Dojang owner has not connected Stripe OAuth" });
      }
  
      const stripeAccessToken = ownerRow[0].stripe_access_token;
      const stripeAccountId = ownerRow[0].stripe_account_id;
      const Stripe = require('stripe');
      const stripe = new Stripe(stripeAccessToken);
  
      // ✅ 먼저 DB에서 해당 이메일로 등록된 customer_id 있는지 확인
      const [existing] = await db.query(
        `SELECT customer_id FROM parents WHERE email = ? AND dojang_code = ? AND customer_id IS NOT NULL`,
        [email, dojang_code]
      );
  
      if (existing.length > 0 && existing[0].customer_id) {
        console.log("✅ Existing customer found, skipping Stripe creation:", existing[0].customer_id);
        return res.status(200).json({ success: true, customerId: existing[0].customer_id });
      }
  
      console.log("🔍 Stripe customer create 요청:", { name: cardholderName, email });
      const customer = await stripe.customers.create({
        name: cardholderName,
        email: email,
        metadata: { dojang_code },
      });
      console.log("✅ Stripe customer 생성 완료:", customer.id);
  
      const customerId = customer.id;
  
      console.log("🔍 DB 업데이트 시도:", { customerId, email, dojang_code });
      await db.query(
        `UPDATE parents SET customer_id = ? WHERE email = ? AND dojang_code = ?`,
        [customerId, email, dojang_code]
      );
      console.log("✅ DB 업데이트 완료");
  
      res.status(200).json({ success: true, customerId });
    } catch (error) {
      console.error("❌ Error creating customer (Stripe):", error);
      res.status(500).json({ success: false, message: "Failed to create customer (Stripe)." });
    }
  });
  
  


  router.post('/card/save', verifyToken, async (req, res) => {
    const { paymentMethodId, parentId, ownerId, billingInfo, payment_policy_agreed } = req.body;
    const { id: userId, dojang_code } = req.user;
    // parentId는 프론트에서 오면 사용, 없으면 userId 사용
    const parent_id = parentId || userId;

    if (!paymentMethodId || !billingInfo) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const { cardholderName, addressLine1, locality, administrativeDistrictLevel1, postalCode, country } = billingInfo;
    if (!cardholderName || !addressLine1 || !locality || !administrativeDistrictLevel1 || !postalCode || !country) {
      return res.status(400).json({ success: false, message: 'Missing required billing info fields' });
    }

    try {
      // 1. 도장 오너의 Stripe Access Token 가져오기
      const [ownerRow] = await db.query(
        "SELECT stripe_access_token, stripe_account_id FROM owner_bank_accounts WHERE dojang_code = ?",
        [dojang_code]
      );
      if (!ownerRow.length || !ownerRow[0].stripe_access_token || !ownerRow[0].stripe_account_id) {
        return res.status(400).json({ success: false, message: "Dojang owner has not connected Stripe OAuth" });
      }
      const stripeAccessToken = ownerRow[0].stripe_access_token;
      const stripeAccountId = ownerRow[0].stripe_account_id;

      // 2. Stripe SDK 인스턴스 생성 (Connected Account)
      const Stripe = require('stripe');
      const stripe = new Stripe(stripeAccessToken);

      // 3. paymentMethod를 해당 오너(도장)의 Stripe 계정의 customer에 attach
      //    (customerId는 프론트에서 오거나, DB에서 찾아야 함)
      let customerId = req.body.customerId;
      if (!customerId) {
        // parents 테이블에서 parent_id로 customer_id 찾기
        const [parentRow] = await db.query(
          'SELECT customer_id FROM parents WHERE id = ? AND dojang_code = ?',
          [parent_id, dojang_code]
        );
        if (!parentRow.length || !parentRow[0].customer_id) {
          return res.status(400).json({ success: false, message: 'No Stripe customer found for this parent.' });
        }
        customerId = parentRow[0].customer_id;
      }

      // 4. paymentMethod attach
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      // 5. paymentMethod를 default로 설정 (선택사항)
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      // 6. 카드 정보 조회
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      const card = paymentMethod.card;
      const expiration = `${card.exp_month}/${card.exp_year}`;
      const lastFour = card.last4;
      const cardBrand = card.brand;

      // 7. DB에 저장
      const query = `
        INSERT INTO saved_cards (
          parent_id,
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
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const queryParams = [
        parent_id,
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

      res.status(200).json({ success: true, cardId: paymentMethodId });
    } catch (error) {
      console.error("❌ ERROR saving card (Stripe):", error);
      res.status(500).json({ success: false, message: "Failed to save card (Stripe)." });
    }
  });

  
  
  router.get('/card/list', verifyToken, async (req, res) => {
    try {
      const user = req.user;
      const parentId = req.query.parent_id || (user.role === 'parent' ? user.id : null);
      const ownerId = req.query.owner_id || (user.role === 'owner' ? user.id : null);
  
      if (!parentId && !ownerId) {
        return res.status(400).json({ success: false, message: 'Parent ID or Owner ID is required.' });
      }
  
      let query = '';
      let params = [];
  
      const dojang_code = user.dojang_code;

      if (parentId && ownerId) {
        query = 'SELECT * FROM saved_cards WHERE (parent_id = ? OR owner_id = ?) AND dojang_code = ?';
        params = [parentId, ownerId, dojang_code];
      } else if (parentId) {
        query = 'SELECT * FROM saved_cards WHERE parent_id = ? AND dojang_code = ?';
        params = [parentId, dojang_code];
      } else {
        query = 'SELECT * FROM saved_cards WHERE owner_id = ? AND dojang_code = ?';
        params = [ownerId, dojang_code];
      }
  
      const [cards] = await db.execute(query, params);
  
      if (!cards.length) {
        return res.json({ success: true, cards: [] });
      }

      // Stripe로 카드 정보 enrich (선택, 없으면 DB 정보만 반환)
      // 아래는 DB 정보만 반환하는 버전
      return res.json({ success: true, cards });

      /*
      // Stripe에서 카드 brand, last4 등 최신 정보 가져오려면 아래처럼 Stripe SDK 사용 가능
      const [ownerRow] = await db.query(
        'SELECT stripe_access_token FROM owner_bank_accounts WHERE dojang_code = ?',
        [dojang_code]
      );
      if (!ownerRow.length) throw new Error('No Stripe token found for this dojang');
      const stripeAccessToken = ownerRow[0].stripe_access_token;
      const Stripe = require('stripe');
      const stripe = new Stripe(stripeAccessToken);
      const cardDetails = await Promise.all(cards.map(async (card) => {
        try {
          const paymentMethod = await stripe.paymentMethods.retrieve(card.card_id);
          return {
            ...card,
            brand: paymentMethod.card.brand,
            last4: paymentMethod.card.last4,
          };
        } catch (error) {
          return { ...card, brand: 'Unknown', last4: '****' };
        }
      }));
      return res.json({ success: true, cards: cardDetails });
      */
    } catch (err) {
      console.error('❌ ERROR fetching cards:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch cards' });
    }
  });
  
  
  
  
  
  
router.get("/card/details/:cardId", verifyToken, async (req, res) => {
    const { cardId } = req.params;
  
    if (!cardId) {
        console.error("Card ID is missing in the request.")
      return res.status(400).json({ success: false, message: "Card ID is required." });
    }
    console.log("Fetching card details for Card ID:", cardId);

    try {
      const [card] = await db.query(
        "SELECT card_name, expiration, card_id FROM saved_cards WHERE card_id = ? AND parent_id = ?",
        [cardId, req.parentId]
      );
  
      if (!card) {
        return res.status(404).json({ success: false, message: "Card not found." });
      }
  
      // Square API를 통해 추가 카드 세부 정보 가져오기
      try {
        const { result } = await client.cardsApi.retrieveCard(card.card_id);
        console.log("Square API Response:", result.card);

       
        return res.status(200).json({
          success: true,
          card: {
            ...card,
            brand: normalizeBrandName(result.card.cardBrand),
            last4: result.card.last4,
          },
        });
      } catch (error) {
        console.error(`Failed to fetch card details from Square API for card ID ${cardId}:`, error);
        return res.status(500).json({ success: false, message: "Failed to fetch card details." });
      }
    } catch (error) {
      console.error("Error fetching card details:", error);
      res.status(500).json({ success: false, message: "Failed to fetch card details." });
    }
  });
  
  // ✅ 카드 삭제 API
  router.delete("/cards/:card_id", verifyToken, async (req, res) => {
    const { card_id } = req.params;
    const { id: parentId, dojang_code } = req.user;
  
    try {
      // ✅ Square OAuth Access Token 가져오기
      const [ownerRow] = await db.query("SELECT stripe_access_token FROM owner_bank_accounts WHERE dojang_code = ?", [dojang_code]);
      if (!ownerRow.length || !ownerRow[0].stripe_access_token) {
        return res.status(400).json({ success: false, message: "Dojang owner has not connected Square OAuth" });
      }
      const squareAccessToken = ownerRow[0].stripe_access_token;
  

     // ✅ Square 카드 삭제 요청
const deleteResponse = await fetch(`https://connect.squareup.com/v2/cards/${card_id}`, {
  method: "DELETE",
  headers: {
    "Authorization": `Bearer ${squareAccessToken}`,
    "Content-Type": "application/json",
  },
});

const responseData = await deleteResponse.json();
console.log("🔹 Square API Response:", responseData);

// 🔁 카드가 이미 없어도 DB에서는 삭제 진행
if (!deleteResponse.ok && deleteResponse.status !== 404) {
  return res.status(400).json({
    success: false,
    message: "Failed to delete card from Square",
    squareError: responseData,
  });
}

  
      // ✅ 데이터베이스에서도 삭제
      const deleteQuery = "DELETE FROM saved_cards WHERE card_id = ? AND parent_id = ?";
      const [result] = await db.query(deleteQuery, [card_id, parentId]);
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Card not found in database" });
      }
  
      res.json({ success: true, message: "Card deleted successfully" });
    } catch (error) {
      console.error("❌ Error deleting card:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });
  
  
  router.delete("/owner-cards/:card_id", verifyToken, async (req, res) => {
    const { card_id } = req.params;
    const { owner_id } = req.body; // ✅ 프론트엔드에서 보낸 owner_id 가져오기
  
    if (!owner_id) {
      return res.status(400).json({ success: false, message: "Missing owner ID in request body" });
    }
  
    try {
      console.log("🛠 Deleting card with ID:", card_id, "for Owner ID:", owner_id);
  
      // 1️⃣ ✅ DB에서 카드가 owner_id에 속해 있는지 확인
      const [rows] = await db.query(
        "SELECT customer_id FROM saved_cards WHERE card_id = ? AND owner_id = ?",
        [card_id, owner_id]
      );
  
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: "Card not found for this owner" });
      }
  
      const { customer_id } = rows[0];
  
      // 2️⃣ ✅ Square API에서 카드 존재 여부 확인
      const checkCardResponse = await fetch(`https://connect.squareup.com/v2/cards/${card_id}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${process.env.stripe_access_token_PRODUCTION}`,
          "Content-Type": "application/json",
        },
      });
  
      const cardData = await checkCardResponse.json();
      console.log("🔹 Square API Card Lookup Response:", cardData);
  
      if (!checkCardResponse.ok) {
        return res.status(400).json({ success: false, message: "Card not found in Square", squareError: cardData });
      }
  
      const disableResponse = await fetch(`https://connect.squareup.com/v2/cards/${card_id}/disable`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.stripe_access_token_PRODUCTION}`,
          "Content-Type": "application/json",
        },
      });
      
      const responseData = await disableResponse.json();
      console.log("🔹 Square API Disable Response:", responseData);
      
      if (!disableResponse.ok) {
        return res.status(400).json({ success: false, message: "Failed to disable card in Square", squareError: responseData });
      }
      
  
     // 4️⃣ ✅ MySQL에서 카드 삭제
const deleteQuery = "DELETE FROM saved_cards WHERE card_id = ? AND owner_id = ?";
const [result] = await db.query(deleteQuery, [card_id, owner_id]);

console.log("🗑️ Deleting card from DB:", card_id, "for Owner ID:", owner_id); // ✅ 로그 추가

if (result.affectedRows === 0) {
  console.error("❌ Card not found in database, unable to delete:", card_id);
  return res.status(404).json({ success: false, message: "Card not found in database" });
}

console.log("✅ Card successfully deleted from database:", card_id);

      res.json({ success: true, message: "Card deleted successfully" });
    } catch (error) {
      console.error("❌ Error deleting card:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });
  



module.exports = router;
