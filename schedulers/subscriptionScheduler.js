const { processPaymentForSubscription } = require("../services/paymentService");
const cron = require("node-cron");
const db = require("../db");

// ✅ 즉시 실행 (테스트용)
(async () => {
  console.log("🚀 Running subscription job...");
  try {
    const [subscriptions] = await db.execute(`
      SELECT 
          mp.id, mp.parent_id, mp.program_id, mp.program_fee, mp.dojang_code, 
          mp.source_id, mp.idempotency_key, mp.payment_id
      FROM monthly_payments mp
      WHERE mp.next_payment_date <= CURDATE() 
      AND (mp.payment_status = 'pending' OR mp.payment_status = 'failed');
  `);
  

    if (subscriptions.length === 0) {
      console.log("✅ No active subscriptions found.");
      return;
    }

    for (const subscription of subscriptions) {
      console.log(`Processing subscription ID: ${subscription.id} for Parent ID: ${subscription.parent_id}`);
      console.log("source_id:", subscription.source_id);

      if (!subscription.source_id) {
        console.error(`❌ Missing source_id for subscription ID ${subscription.id}. Skipping payment.`);
        continue;
      }

      await processPaymentForSubscription(subscription);
    }
    
    console.log("✅ Subscription job completed successfully.");
  } catch (error) {
    console.error("❌ Error running subscription job:", error);
  }
})();

// ✅ 매일 정오 (12:00)에 실행
cron.schedule('0 12 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Running scheduled subscription job...`);

  try {
    const [subscriptions] = await db.execute(`
      SELECT 
        mp.id, mp.parent_id, mp.program_id, mp.program_fee, mp.dojang_code, 
        mp.source_id, mp.idempotency_key, mp.payment_id
      FROM monthly_payments mp
      WHERE mp.next_payment_date <= CURDATE() 
      AND (mp.payment_status = 'pending' OR mp.payment_status = 'failed');
    `);

    if (subscriptions.length === 0) {
      console.log("✅ No active subscriptions found.");
      return;
    }

    for (const subscription of subscriptions) {
      console.log(`Processing subscription ID: ${subscription.id} for Parent ID: ${subscription.parent_id}`);
      console.log("source_id:", subscription.source_id);

      if (!subscription.source_id) {
        console.error(`❌ Missing source_id for subscription ID ${subscription.id}. Skipping payment.`);
        continue;
      }

      await processPaymentForSubscription(subscription);
    }

    console.log("✅ Scheduled subscription job completed successfully.");
  } catch (error) {
    console.error("❌ Error running scheduled subscription job:", error);
  }
});
