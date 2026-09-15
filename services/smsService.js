// backend/services/smsService.js
//
// ⚠️ 사용 중단됨 (Deprecated)
// Twilio를 이용한 완전 자동 SMS 발송 방식은 폐기되었습니다.
// 대신 반자동 방식(문자 초안 생성 + 푸시 알림 + 사장님이 직접 발송)을 사용합니다.
// 관련 로직은 backend/services/pushService.js 와
// backend/schedulers/absenceScheduler.js / birthdayScheduler.js 를 참고하세요.
//
// 이 파일은 삭제 권한 문제로 남겨두었을 뿐, 아무 곳에서도 require 되지 않습니다.
module.exports = {};
