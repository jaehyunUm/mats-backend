const Stripe = require('stripe');

const secretKey = process.env.STRIPE_SECRET_KEY;

// 서버가 시작될 때 키가 있는지 확인
if (!secretKey) {
  console.error("❌ CRITICAL: STRIPE_SECRET_KEY is not defined in environment variables.");
  // 앱을 즉시 종료시켜서 잘못된 상태로 실행되는 것을 방지
  process.exit(1);
}

// Stripe 인스턴스를 단 한 번만 생성
const stripe = new Stripe(secretKey, {
  apiVersion: '2024-06-20', // 항상 최신 API 버전을 명시하는 것이 좋습니다.
});

console.log("✅ Stripe service initialized successfully.");

// 생성된 인스턴스를 외부에서 사용할 수 있도록 내보내기
module.exports = stripe;