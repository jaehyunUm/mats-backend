const express = require('express');
const router = express.Router();
const { client, customersApi, cardsApi, createSquareClientWithToken} = require('../modules/squareClient');
const { v4: uuidv4 } = require('uuid');
const db = require('../db'); // DB 모듈 확인
const verifyToken = require('../middleware/verifyToken');
const normalizeBrandName = (brand) => {
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
        // ✅ 도장 오너의 Square Access Token 가져오기
        const [ownerRow] = await db.query("SELECT square_access_token FROM owner_bank_accounts WHERE dojang_code = ?", [dojang_code]);
  
        if (!ownerRow.length || !ownerRow[0].square_access_token) {
            return res.status(400).json({ success: false, message: "Dojang owner has not connected Square OAuth" });
        }
        const ownerAccessToken = ownerRow[0].square_access_token;
  
        // ✅ Square 클라이언트 동적 생성
        const squareClient = createSquareClientWithToken(ownerAccessToken);
        const customersApi = squareClient.customersApi;
  
        // ✅ 고객 생성
        const { result: customerResult } = await customersApi.createCustomer({
            givenName: cardholderName.split(" ")[0],
            familyName: cardholderName.split(" ").slice(1).join(" ") || "Unknown",
            emailAddress: email,
            metadata: { dojang_code: dojang_code },
        });
  
        const customerId = customerResult.customer.id;
        await db.query(`UPDATE parents SET customer_id = ? WHERE email = ? AND dojang_code = ?`, [customerId, email, dojang_code]);
  
        res.status(200).json({ success: true, customerId });
    } catch (error) {
        console.error("❌ Error creating customer:", error);
        res.status(500).json({ success: false, message: "Failed to create customer." });
    }
  });
  


  router.post('/card/save', verifyToken, async (req, res) => {
    const { cardToken, customerId, ownerId, billingInfo, payment_policy_agreed } = req.body;
    const { id: userId, dojang_code } = req.user;
    const parentId = userId; // ✅ 부모 ID로 수정
  
    if (!cardToken || !customerId || !billingInfo) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
  
    const { cardholderName, addressLine1, locality, administrativeDistrictLevel1, postalCode, country } = billingInfo;
  
    if (!cardholderName || !addressLine1 || !locality || !administrativeDistrictLevel1 || !postalCode || !country) {
        return res.status(400).json({ success: false, message: 'Missing required billing info fields' });
    }
  
    try {
      const [ownerRow] = await db.query("SELECT square_access_token FROM owner_bank_accounts WHERE dojang_code = ?", [dojang_code]);
      if (!ownerRow.length || !ownerRow[0].square_access_token) {
          return res.status(400).json({ success: false, message: "Dojang owner has not connected Square OAuth" });
      }
      const ownerAccessToken = ownerRow[0].square_access_token;
  
      const squareClient = createSquareClientWithToken(ownerAccessToken);
      const cardsApi = squareClient.cardsApi;
  
      const { result: cardResult } = await cardsApi.createCard({
          idempotencyKey: uuidv4(),
          sourceId: cardToken,
          card: {
              cardholderName: billingInfo.cardholderName,
              billingAddress: {
                  addressLine1: billingInfo.addressLine1,
                  locality: billingInfo.locality,
                  administrativeDistrictLevel1: billingInfo.administrativeDistrictLevel1,
                  postalCode: billingInfo.postalCode,
                  country: billingInfo.country,
              },
              customerId,
          },
      });
  
      const savedCardId = cardResult.card.id;
      const expiration = `${cardResult.card.expMonth}/${cardResult.card.expYear}`;
      const lastFour = cardResult.card.last4;
      const cardBrand = cardResult.card.cardBrand;
  
      // ✅ 동의 정보 포함하여 저장
      const query = `
          INSERT INTO saved_cards (parent_id, owner_id, card_name, expiration, card_token, card_id, card_brand, last_four, dojang_code, customer_id, payment_policy_agreed, payment_policy_agreed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
  
      const queryParams = [
          parentId || null,
          ownerId || null,
          cardholderName,
          expiration,
          cardToken,
          savedCardId,
          cardBrand,
          lastFour,
          dojang_code,
          customerId,
          payment_policy_agreed ? 1 : 0,
          payment_policy_agreed ? new Date() : null
      ];
  
      await db.execute(query, queryParams);
  
      res.status(200).json({ success: true, cardId: savedCardId });
    } catch (error) {
        console.error("❌ ERROR saving card:", error);
        res.status(500).json({ success: false, message: "Failed to save card." });
    }
  });

  
  
router.get('/card/list',verifyToken, async (req, res) => {
    try {
      const parentId = req.query.parent_id || req.parentId; // 부모 ID
      const ownerId = req.query.owner_id || req.user.id;

      if (!parentId && !ownerId) {
        return res.status(400).json({ success: false, message: 'Parent ID or Owner ID is required.' });
      }
  
      let cardsQuery = '';
      let queryParams = [];
  
      // ✅ 부모 ID와 오너 ID 둘 중 하나라도 존재하면 카드 조회
      if (parentId && ownerId) {
        cardsQuery = 'SELECT card_name, expiration, card_token, card_id FROM saved_cards WHERE parent_id = ? OR owner_id = ?';
        queryParams = [parentId, ownerId];
      } else if (parentId) {
        cardsQuery = 'SELECT card_name, expiration, card_token, card_id FROM saved_cards WHERE parent_id = ?';
        queryParams = [parentId];
      } else if (ownerId) {
        cardsQuery = 'SELECT card_name, expiration, card_token, card_id FROM saved_cards WHERE owner_id = ?';
        queryParams = [ownerId];
      }
  
      const [cards] = await db.execute(cardsQuery, queryParams);
  
      if (!cards || cards.length === 0) {
        return res.status(200).json({ success: true, cards: [] });
      }
  
      // ✅ Square API에서 카드 정보를 가져오기
      const cardDetails = await Promise.all(
        cards.map(async (card) => {
          try {
            const { result } = await client.cardsApi.retrieveCard(card.card_id);
  
            return {
              ...card,
              brand: normalizeBrandName(result.card.cardBrand),
              last4: result.card.last4,
            };
          } catch (error) {
            console.error(`Error fetching card details for ID ${card.card_id}:`, error);
            return { ...card, brand: "Unknown", last4: "****" };
          }
        })
      );
  
      res.status(200).json({ success: true, cards: cardDetails });
    } catch (error) {
      console.error('❌ ERROR fetching cards:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch cards.' });
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
      const [ownerRow] = await db.query("SELECT square_access_token FROM owner_bank_accounts WHERE dojang_code = ?", [dojang_code]);
      if (!ownerRow.length || !ownerRow[0].square_access_token) {
        return res.status(400).json({ success: false, message: "Dojang owner has not connected Square OAuth" });
      }
      const squareAccessToken = ownerRow[0].square_access_token;
  

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
          "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN_PRODUCTION}`,
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
          "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN_PRODUCTION}`,
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
