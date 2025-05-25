// createOrderTemplate.js
const { ordersApi} = require('../modules/stripeClient');
require('dotenv').config();
const { v4: uuidv4 } = require("uuid");

/**
 * @param {string} quantity  - 주문할 상품 개수
 * @param {string} name      - 라인아이템(상품) 이름
 * @param {number} price     - 상품 가격 (소수점 없는 금액, 예: 100 => $1.00)
 * @param {string} currency  - 통화 (예: 'USD')
 * @returns {Promise<object>} - Square Orders API의 createOrder 응답
 */
async function createOrderTemplate(quantity, name, price, currency) {
  try {
    const { result } = await ordersApi.createOrder({
      idempotencyKey: uuidv4(),
      order: {
        locationId: process.env.SQUARE_LOCATION_ID_PRODUCTION,
        state: 'DRAFT', // 임시 주문으로 생성
        lineItems: [
          {
            quantity, 
            name,     
            basePriceMoney: {
              amount: BigInt(price), // 예: 100 => $1.00
              currency // 예: "USD"
            }
          }
        ]
      }
    });
    console.log("✅ DEBUG: Order Template created:", result);
    return result; // result.order.id가 주문 ID
  } catch (error) {
    console.error("❌ ERROR creating order template:", error);
    throw error;
  }
}

module.exports = { createOrderTemplate };
