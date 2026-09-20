// backend/modules/paymentDeclineReasons.js
// Stripe 결제 실패 사유를 (1) 원장님이 보는 정확한 사유 문구, (2) 학부모에게 보낼 문자 초안 문구로 매핑.
//
// 예전엔 stripeError.message를 그대로 원장님께 보여줬는데, 잔액 부족(insufficient_funds) 같은
// 경우는 Stripe 메시지 자체가 이해하기 쉬워서 괜찮았지만, "카드가 없어진" 경우
// (부모가 카드를 변경/삭제해서 저장된 결제수단 ID가 더 이상 유효하지 않음)는
// "No such PaymentMethod: 'pm_xxx'" 같은 기술적인 메시지가 그대로 떠서 무슨 뜻인지 알기 어려웠음.
// 여기서 Stripe의 code/decline_code를 보고 사람이 읽을 수 있는 사유로 바꿔줌.

const REASONS = {
  insufficient_funds: {
    owner: "Card declined - insufficient funds",
    parent: (name) =>
      `Hi, this is regarding ${name}'s monthly payment - the card on file was declined due to insufficient funds. Could you please make sure there are sufficient funds or update your payment method and let us know? Thank you!`,
  },
  no_payment_method: {
    owner: "No valid card on file (removed, changed, or never added)",
    parent: (name) =>
      `Hi, this is regarding ${name}'s monthly payment - we don't have a valid card on file (it may have been removed or changed). Could you please send over an updated card when you get a chance? Thank you!`,
  },
  expired_card: {
    owner: "Card declined - card has expired",
    parent: (name) =>
      `Hi, this is regarding ${name}'s monthly payment - the card on file has expired. Could you please send over an updated card? Thank you!`,
  },
  incorrect_cvc: {
    owner: "Card declined - incorrect CVC/security code",
    parent: (name) =>
      `Hi, this is regarding ${name}'s monthly payment - the card's security code didn't match, so the charge couldn't go through. Could you please double check and send over the updated card info? Thank you!`,
  },
  incorrect_number: {
    owner: "Card declined - invalid card number",
    parent: (name) =>
      `Hi, this is regarding ${name}'s monthly payment - the card number on file doesn't seem to be valid anymore. Could you please send over an updated card? Thank you!`,
  },
  lost_or_stolen_card: {
    owner: "Card declined - reported lost or stolen",
    parent: (name) =>
      `Hi, this is regarding ${name}'s monthly payment - the card on file was declined. Could you please send over an updated card when you get a chance? Thank you!`,
  },
  authentication_required: {
    owner: "Card declined - bank requires additional verification (3D Secure) we can't complete automatically",
    parent: (name) =>
      `Hi, this is regarding ${name}'s monthly payment - your bank needs extra verification for this card that we can't complete automatically. Could you please reach out to your bank or send over a different card? Thank you!`,
  },
  processing_error: {
    owner: "Card declined - temporary processing error from the bank",
    parent: (name) =>
      `Hi, this is regarding ${name}'s monthly payment - there was a temporary error processing the card. Could you let us know if it happens again, or send over an updated card? Thank you!`,
  },
  generic_decline: {
    owner: "Card declined by the bank (no specific reason given)",
    parent: (name) =>
      `Hi, this is regarding ${name}'s monthly payment - the card on file was declined by the bank. Could you please check with your bank or send over an updated card? Thank you!`,
  },
};

// Stripe decline_code / code 값 -> 위 REASONS 키로 매핑
// (참고: https://docs.stripe.com/declines/codes)
const CODE_TO_REASON_KEY = {
  insufficient_funds: "insufficient_funds",
  expired_card: "expired_card",
  incorrect_cvc: "incorrect_cvc",
  invalid_cvc: "incorrect_cvc",
  incorrect_number: "incorrect_number",
  invalid_number: "incorrect_number",
  invalid_expiry_month: "expired_card",
  invalid_expiry_year: "expired_card",
  lost_card: "lost_or_stolen_card",
  stolen_card: "lost_or_stolen_card",
  pickup_card: "lost_or_stolen_card",
  fraudulent: "lost_or_stolen_card",
  authentication_required: "authentication_required",
  processing_error: "processing_error",
  issuer_not_available: "processing_error",
  reenter_transaction: "processing_error",
  try_again_later: "processing_error",
  do_not_honor: "generic_decline",
  generic_decline: "generic_decline",
  card_not_supported: "generic_decline",
  card_velocity_exceeded: "generic_decline",
  currency_not_supported: "generic_decline",
  transaction_not_allowed: "generic_decline",
  restricted_card: "generic_decline",
};

// Stripe 에러 객체를 보고 사유를 분류. { key, owner, parent(name) } 반환.
function classifyStripeError(stripeError) {
  const code = stripeError && stripeError.code;
  const declineCode = stripeError && stripeError.decline_code;
  const message = (stripeError && stripeError.message) || "";

  // 1) 카드/결제수단 자체가 더 이상 존재하지 않는 경우 (부모가 삭제/변경) - "카드가 없어" 케이스
  if (code === "resource_missing" || /no such (payment_?method|source|card)/i.test(message)) {
    return { key: "no_payment_method", ...REASONS.no_payment_method };
  }

  // 2) decline_code가 제일 구체적인 사유이므로 우선 사용
  if (declineCode && CODE_TO_REASON_KEY[declineCode]) {
    const key = CODE_TO_REASON_KEY[declineCode];
    return { key, ...REASONS[key] };
  }

  // 3) code 기준 (decline_code가 없는 경우 - 예: expired_card, incorrect_cvc는 code로도 옴)
  if (code && CODE_TO_REASON_KEY[code]) {
    const key = CODE_TO_REASON_KEY[code];
    return { key, ...REASONS[key] };
  }

  // 4) 그 외 - Stripe 원문 메시지를 원장님껜 그대로 보여주되(정보 손실 방지), 학부모용은 안전한 일반 문구
  return {
    key: "unknown",
    owner: message || "Card declined (unknown reason)",
    parent: REASONS.generic_decline.parent,
  };
}

// Stripe를 호출하기도 전에, DB에 저장된 결제수단(source_id) 자체가 없는 경우
function noCardOnFile() {
  return { key: "no_payment_method", ...REASONS.no_payment_method };
}

module.exports = { classifyStripeError, noCardOnFile, REASONS };
