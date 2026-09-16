// backend/services/pushService.js
// 사장님(관장님) 및 학부모 휴대폰으로 Expo 푸시 알림을 보내는 역할을 합니다.
// Expo Push API(https://exp.host/--/api/v2/push/send)를 그냥 https 모듈로 직접 호출하기 때문에
// 별도 SDK 설치 없이도 바로 동작합니다.
const https = require("https");
const db = require("../db");

function postJSON(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch (e) {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function sendExpoPush(tokens, title, body, data) {
  if (tokens.length === 0) {
    return { success: false, skipped: true, reason: "no_tokens" };
  }
  const messages = tokens.map((t) => ({
    to: t,
    sound: "default",
    title,
    body,
    data,
  }));
  const result = await postJSON("exp.host", "/--/api/v2/push/send", messages);
  return { success: true, result, count: messages.length };
}

// 특정 도장(dojang_code)에 등록된 휴대폰으로 푸시 발송.
// role을 지정하면 그 역할(예: 'owner', 'parent')의 토큰에게만 보내고,
// role을 생략하면 (기존 동작 그대로) 도장에 등록된 모든 토큰에게 보냅니다.
async function sendPushToDojang(dojang_code, title, body, data = {}, role = null) {
  try {
    const [tokens] = role
      ? await db.query(
          `SELECT expo_push_token FROM push_tokens WHERE dojang_code = ? AND role = ?`,
          [dojang_code, role]
        )
      : await db.query(
          `SELECT expo_push_token FROM push_tokens WHERE dojang_code = ?`,
          [dojang_code]
        );

    if (tokens.length === 0) {
      console.log(`ℹ️ [push] ${dojang_code}에 등록된 푸시 토큰이 없어 알림을 건너뜁니다. (앱에서 알림 권한 설정 필요)`);
      return { success: false, skipped: true, reason: "no_tokens" };
    }

    const result = await sendExpoPush(tokens.map((t) => t.expo_push_token), title, body, data);
    console.log(`✅ [push] ${dojang_code}로 푸시 ${tokens.length}건 발송 요청 완료${role ? ` (role=${role})` : ""}`);
    return result;
  } catch (err) {
    console.error("❌ [push] 푸시 발송 중 오류:", err.message);
    return { success: false, error: err.message };
  }
}

// 도장 사장님/스태프에게만 보내는 편의 함수 (문자 초안 검토 알림 등 owner 전용 알림에 사용)
async function sendPushToOwners(dojang_code, title, body, data = {}) {
  return sendPushToDojang(dojang_code, title, body, data, "owner");
}

// 특정 사용자 id 목록(예: 특정 요일 클래스에 등록된 학생들의 학부모 id 목록)에게만 푸시 발송.
// parents.id와 users.id는 서로 다른 테이블의 별도 auto-increment 값이라 값이 겹칠 수 있으므로,
// role로 반드시 필터링해서 엉뚱한 사람에게 가지 않도록 합니다. (기본값 'parent')
async function sendPushToUserIds(userIds, dojang_code, title, body, data = {}, role = "parent") {
  try {
    if (!userIds || userIds.length === 0) {
      return { success: false, skipped: true, reason: "no_user_ids" };
    }
    const placeholders = userIds.map(() => "?").join(",");
    const [tokens] = await db.query(
      `SELECT expo_push_token FROM push_tokens WHERE dojang_code = ? AND role = ? AND user_id IN (${placeholders})`,
      [dojang_code, role, ...userIds]
    );

    if (tokens.length === 0) {
      console.log(`ℹ️ [push] ${dojang_code}에서 지정된 ${userIds.length}명(role=${role})의 푸시 토큰을 찾지 못해 건너뜁니다.`);
      return { success: false, skipped: true, reason: "no_tokens" };
    }

    const result = await sendExpoPush(tokens.map((t) => t.expo_push_token), title, body, data);
    console.log(`✅ [push] ${dojang_code}의 지정된 ${userIds.length}명(role=${role}) 중 ${tokens.length}건 발송 요청 완료`);
    return result;
  } catch (err) {
    console.error("❌ [push] 대상 지정 푸시 발송 중 오류:", err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendPushToDojang, sendPushToOwners, sendPushToUserIds };
