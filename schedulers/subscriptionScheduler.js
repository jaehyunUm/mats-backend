const { processPaymentForSubscription } = require("../services/paymentService");
const cron = require("node-cron");
const db = require("../db");

// 구독 처리 로직을 함수로 추출하여 코드 중복 제거
async function processSubscriptions() {
  try {
    const [subscriptions] = await db.execute(`
      SELECT
        mp.id, mp.parent_id, mp.student_id, mp.program_id, mp.program_fee, mp.dojang_code,
        mp.source_id, mp.idempotency_key, mp.payment_id, mp.customer_id
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
      console.log(`Processing subscription ID: ${subscription.id} for Parent ID: ${subscription.parent_id}`);
      console.log("source_id:", subscription.source_id);

      if (!subscription.source_id) {
        console.error(`❌ Missing source_id for subscription ID ${subscription.id}. Skipping payment.`);
        failCount++;
        continue;
      }

      try {
        await processPaymentForSubscription(subscription);
        successCount++;
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

cron.schedule('*/5 * * * *', () => {
  console.log(`[${new Date().toISOString()}] Running scheduled subscription job...`);
  try {
    processSubscriptions()
      .then(() => console.log("✅ Scheduled subscription job completed successfully."))
      .catch(error => console.error("❌ Error running scheduled subscription job:", error));
  } catch (error) {
    console.error("❌ Error running scheduled subscription job:", error);
  }
});