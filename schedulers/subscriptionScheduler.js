const { processPaymentForSubscription, createNotification } = require("../services/paymentService"); 
const cron = require("node-cron");
const db = require("../db");

// 구독 처리 로직을 함수로 추출하여 코드 중복 제거
async function processSubscriptions() {
  try {
    const [subscriptions] = await db.execute(`
      SELECT
        mp.id, mp.parent_id, mp.student_id, mp.program_id, mp.program_fee, mp.dojang_code,
        mp.source_id, mp.idempotency_key, mp.payment_id, mp.customer_id,
        mp.next_payment_date   /* 👈👈👈 바로 이 줄이 꼭 추가되어야 합니다! */
      FROM monthly_payments mp
      WHERE mp.next_payment_date <= CURDATE()
      AND (mp.payment_status = 'pending' OR mp.payment_status = 'failed');
    `);

    if (subscriptions.length === 0) {
      console.log("✅ No active subscriptions found.");
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const subscription of subscriptions) {
      console.log(`Processing subscription ID: ${subscription.id}`);

      // ⭐️ source_id 누락 시 알림 추가
      if (!subscription.source_id) {
        const msg = `Payment skipped for Subscription #${subscription.id}: Missing payment method (Source ID).`;
        console.error(`❌ ${msg}`);
        // 알림 생성
        await createNotification(subscription.dojang_code, msg); // paymentService에서 import 필요
        failCount++;
        continue;
      }

      try {
        // 결과값을 받아서 처리 (선택사항, 이미 내부에서 알림을 보냄)
        const result = await processPaymentForSubscription(subscription);
        
        if (result.success) {
            successCount++;
        } else {
            failCount++;
            // 여기서 별도로 알림을 보낼 필요는 없습니다. (함수 내부에서 처리됨)
        }
      } catch (error) {
        console.error(`❌ Error processing subscription ID ${subscription.id}:`, error.message);
        failCount++;
      }
    }

    console.log(`✅ Subscription job completed. Success: ${successCount}, Failed: ${failCount}`);
    return { success: successCount, failed: failCount };
  } catch (error) {
    console.error("❌ Error running subscription job:", error);
    throw error; // 상위 호출자에게 오류 전달
  }
}

// ✅ 즉시 실행 (테스트용)
(async () => {
  console.log("🚀 Running subscription job...");
  try {
    await processSubscriptions();
  } catch (error) {
    console.error("❌ Fatal error running subscription job:", error);
  }
})();

cron.schedule('0 3 * * *', () => { 
  console.log(`[${new Date().toISOString()}] Running scheduled subscription job...`);
  try {
    processSubscriptions()
      .then(() => console.log("✅ Scheduled subscription job completed successfully."))
      .catch(error => console.error("❌ Error running scheduled subscription job:", error));
  } catch (error) {
    console.error("❌ Error running scheduled subscription job:", error);
  }
});

// 함수 export 추가
module.exports = {
  processSubscriptions
};
