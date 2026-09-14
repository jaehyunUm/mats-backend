// backend/services/smsService.js
// Thin wrapper around Twilio so the rest of the app never touches the SDK directly.
// If Twilio credentials aren't set yet (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER
// env vars missing), sendSMS() logs a warning and no-ops instead of crashing the server.

let twilioClient = null;
let twilioInitError = null;

function getClient() {
  if (twilioClient || twilioInitError) return twilioClient;

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    twilioInitError = "Twilio credentials are not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing).";
    return null;
  }

  try {
    const twilio = require("twilio");
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    return twilioClient;
  } catch (err) {
    twilioInitError = `Failed to initialize Twilio client: ${err.message}`;
    return null;
  }
}

// Normalizes a US phone number stored in any common format ("(770) 123-4567",
// "770-123-4567", "7701234567", "+17701234567", ...) into E.164 (+1XXXXXXXXXX).
// Returns null if the number can't be confidently normalized.
function toE164(rawPhone) {
  if (!rawPhone) return null;
  const digits = String(rawPhone).replace(/\D/g, "");

  if (String(rawPhone).trim().startsWith("+")) {
    // Already looks like it was given in international format — just strip spaces/dashes.
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return null;
}

// Sends a single SMS. Never throws — always resolves with { success, error?, skipped? }
// so a scheduler's for-loop can keep going even if one message fails.
async function sendSMS(toRawPhone, message) {
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const client = getClient();

  if (!client || !fromNumber) {
    const reason = twilioInitError || "TWILIO_PHONE_NUMBER is not configured.";
    console.warn(`⚠️ SMS skipped (Twilio not configured): ${reason}`);
    return { success: false, skipped: true, error: reason };
  }

  const toNumber = toE164(toRawPhone);
  if (!toNumber) {
    console.warn(`⚠️ SMS skipped: could not normalize phone number "${toRawPhone}" to E.164.`);
    return { success: false, skipped: true, error: "Invalid/unnormalizable phone number" };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber,
    });
    console.log(`✅ SMS sent to ${toNumber} (sid: ${result.sid})`);
    return { success: true, sid: result.sid };
  } catch (err) {
    console.error(`❌ Failed to send SMS to ${toNumber}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendSMS, toE164 };
