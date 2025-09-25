// paymentService.js
const { createStripeClientWithKey } = require('../modules/stripeClient');
const db = require('../db');
const uuidv4 = require('uuid').v4;
const dayjs = require('dayjs');
const process = require('process');

// 알림 생성 함수 (This function is already well-written and safe)
const createNotification = async (dojangCode, message, connection) => {
  try {
    // Use the provided connection or create a new one
    const conn = connection || await db.getConnection();
    const useLocalConnection = !connection;
    
    try {
      await conn.query(
        `INSERT INTO notifications (dojang_code, message) VALUES (?, ?)`,
        [dojangCode, message]
      );
      console.log(`✅ Notification created for dojang ${dojangCode}: ${message}`);
      return true;
    } finally {
      // Only release the connection if it was created locally
      if (useLocalConnection) {
        conn.release();
      }
    }
  } catch (error) {
    console.error(`❌ Failed to create notification:`, error);
    return false;
  }
};

/**
 * A safe handler for processing subscription payments.
 * It uses a try-catch-finally block to ensure the database connection is always released,
 * preventing connection leaks and server crashes.
 * @param {object} subscription - The subscription object from the database.
 * @returns {Promise<{success: boolean, error?: string}>} - The result of the payment processing.
 */
const processPaymentForSubscription = async (subscription) => {
    // 1. Declare connection outside the try block to make it accessible in finally
    let connection;
    let transactionStarted = false;
  
    try {
      // 2. Get DB connection inside the try block to catch potential errors
      connection = await db.getConnection();
      console.log(`🚀 Processing payment for subscription ID: ${subscription.id}, Dojang Code: ${subscription.dojang_code}`);
  
      // Stripe account information lookup
      const [ownerRows] = await connection.query(
        `SELECT stripe_access_token, stripe_account_id FROM owner_bank_accounts WHERE dojang_code = ? LIMIT 1`,
        [subscription.dojang_code]
      );
  
      if (!ownerRows.length || !ownerRows[0].stripe_access_token) {
        // No need for handleFailure, just log and return
        console.error(`⚠️ Payment Error for Sub ID ${subscription.id}: Stripe account not properly connected.`);
        return { success: false, error: 'No Stripe access token found' };
      }
  
      const ownerAccessToken = ownerRows[0].stripe_access_token;
      const stripeAccountId = ownerRows[0].stripe_account_id;
      const stripe = createStripeClientWithKey(ownerAccessToken);
  
      // Required information check
      if (!subscription.source_id || !subscription.customer_id) {
        console.error(`⚠️ Payment Error for Sub ID ${subscription.id}: Missing payment information.`);
        return { success: false, error: 'Missing required payment information' };
      }
  
      // Information lookup for notifications
      const [studentInfo] = await connection.query(`SELECT first_name, last_name FROM students WHERE id = ?`, [subscription.student_id]);
      const [programInfo] = await connection.query(`SELECT name FROM programs WHERE id = ? AND dojang_code = ?`, [subscription.program_id, subscription.dojang_code]);
  
      const studentName = studentInfo.length ? `${studentInfo[0].first_name} ${studentInfo[0].last_name}` : `Student ID: ${subscription.student_id}`;
      const programName = programInfo.length ? programInfo[0].name : `Program ID: ${subscription.program_id}`;
  
      // Amount validation
      const fee = parseFloat(subscription.program_fee);
      if (isNaN(fee) || fee <= 0) {
        console.error(`❌ Payment Error for Sub ID ${subscription.id}: Invalid fee amount.`);
        return { success: false, error: 'Invalid program fee' };
      }
  
      // Payment attempt
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: Math.round(fee * 100),
          currency: "usd",
          customer: subscription.customer_id,
          payment_method: subscription.source_id,
          off_session: true,
          confirm: true,
          metadata: {
            subscription_id: subscription.id,
            student_id: subscription.student_id,
            parent_id: subscription.parent_id,
            dojang_code: subscription.dojang_code,
            program_id: subscription.program_id,
          },
        },
        {
          idempotencyKey: subscription.idempotency_key || uuidv4(),
          stripeAccount: stripeAccountId
        }
      );
  
      if (paymentIntent.status !== 'succeeded') {
        console.warn(`⚠️ Payment failed for Sub ID ${subscription.id} for ${studentName}'s ${programName} program ($${fee}).`);
        // Here you might want to call createNotification as well
        return { success: false, error: 'Payment failed' };
      }
  
      // 6. Process successful payment (Transaction)
      await connection.beginTransaction();
      transactionStarted = true;
  
      await connection.query(`
        INSERT INTO program_payments (parent_id, student_id, program_id, amount, payment_date, status, dojang_code, source_id, idempotency_key, payment_id)
        VALUES (?, ?, ?, ?, NOW(), 'completed', ?, ?, ?, ?)`,
        [subscription.parent_id, subscription.student_id, subscription.program_id, fee, subscription.dojang_code, subscription.source_id, subscription.idempotency_key, paymentIntent.id]
      );
  
      const currentDate = dayjs(subscription.next_payment_date);
      const nextDate = currentDate.add(1, 'month');
      const correctedNextDate = (currentDate.date() >= 28 ? nextDate.endOf('month') : nextDate.date(currentDate.date())).format('YYYY-MM-DD');
  
      await connection.query(`
        UPDATE monthly_payments SET last_payment_date = CURDATE(), next_payment_date = ?, payment_status = 'pending', status = 'completed'
        WHERE id = ?`,
        [correctedNextDate, subscription.id]
      );
  
      await connection.commit();
      console.log(`✅ Payment successful for Sub ID ${subscription.id}. Next payment scheduled on ${correctedNextDate}`);
      return { success: true };
    } catch (error) {
      if (transactionStarted && connection) {
        await connection.rollback();
      }
      // Log the specific subscription that failed for easier debugging
      console.error(`❌ CRITICAL ERROR during payment processing for subscription ID ${subscription.id}:`, error);
      return { success: false, error: 'Internal server error' };
    } finally {
      // 3. MOST IMPORTANT: Always release the connection, no matter what happens
      if (connection) {
        connection.release();
        console.log(`🔹 DB Connection released for subscription ID ${subscription.id}.`);
      }
    }
  };

module.exports = { 
  processPaymentForSubscription,
  createNotification
};