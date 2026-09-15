// backend/services/pushService.js
// 사장님(관장님) 휴대폰으로 "문자 초안이 준비됐어요" 푸시 알림을 보내는 역할만 합니다.
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

// 특정 도장(dojang_code)에 등록된 모든 관리자 휴대폰으로 푸시 발송
async function sendPushToDojang(dojang_code, title, body, data = {}) {
  try {
    const [tokens] = await db.query(
      `SELECT expo_push_token FROM push_tokens WHERE dojang_code = ?`,
      [dojang_code]
    );

    if (tokens.length === 0) {
      console.log(`ℹ️ [push] ${dojang_code}에 등록된 푸시 토큰이 없어 알림을 건너뜁니다. (앱에서 알림 권한 설정 필요)`);
      return { success: false, skipped: true, reason: "no_tokens" };
    }

    const messages = tokens.map((t) => ({
      to: t.expo_push_token,
      sound: "default",
      title,
      body,
      data,
    }));

    const result = await postJSON("exp.host", "/--/api/v2/push/send", messages);
    console.log(`✅ [push] ${dojang_code}로 푸시 ${messages.length}건 발송 요청 완료`);
    return { success: true, result };
  } catch (err) {
    console.error("❌ [push] 푸시 발송 중 오류:", err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendPushToDojang };
