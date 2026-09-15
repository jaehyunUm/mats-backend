// backend/routes/appVersionRoutes.js
// 앱이 실행될 때마다 "최소 필요 버전"을 확인하는 공개(인증 불필요) API.
// 새 버전을 스토어에 출시했는데 예전 버전 사용자가 계속 예전 버전으로 남아있으면
// 강제 업데이트 화면을 띄우기 위한 용도입니다.
//
// 값은 코드 배포 없이 Render 대시보드의 환경 변수만 바꾸면 즉시 적용됩니다:
//   APP_MIN_VERSION_IOS, APP_MIN_VERSION_ANDROID  (예: "1.2.0")
//   APP_STORE_URL_IOS, APP_STORE_URL_ANDROID       (스토어 상세 페이지 링크)
// 환경 변수를 아직 설정하지 않았다면 minVersion이 null로 내려가서,
// 앱에서는 "강제 업데이트 없음"으로 처리됩니다 (기존 사용자 경험에 영향 없음).
const express = require('express');
const router = express.Router();

router.get('/app-version', (req, res) => {
  res.status(200).json({
    ios: {
      minVersion: process.env.APP_MIN_VERSION_IOS || null,
      storeUrl: process.env.APP_STORE_URL_IOS || 'https://apps.apple.com/',
    },
    android: {
      minVersion: process.env.APP_MIN_VERSION_ANDROID || null,
      storeUrl: process.env.APP_STORE_URL_ANDROID || 'https://play.google.com/store',
    },
  });
});

module.exports = router;
