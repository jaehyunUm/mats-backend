const { classifyStripeError, noCardOnFile } = require('./modules/paymentDeclineReasons');

const cases = [
  { label: "잔액 부족", err: { code: 'card_declined', decline_code: 'insufficient_funds', message: 'Your card has insufficient funds.' } },
  { label: "카드 삭제됨 (resource_missing)", err: { code: 'resource_missing', message: "No such PaymentMethod: 'pm_1abcXYZ'" } },
  { label: "카드 만료", err: { code: 'expired_card', message: 'Your card has expired.' } },
  { label: "CVC 틀림", err: { code: 'card_declined', decline_code: 'incorrect_cvc', message: "Your card's security code is incorrect." } },
  { label: "분실/도난 카드", err: { code: 'card_declined', decline_code: 'stolen_card', message: 'Your card was declined.' } },
  { label: "은행 일반 거절", err: { code: 'card_declined', decline_code: 'do_not_honor', message: 'Your card was declined.' } },
  { label: "알 수 없는 이유", err: { code: 'weird_unknown_code', message: 'Something unusual happened.' } },
];

for (const c of cases) {
  const r = classifyStripeError(c.err);
  console.log(`--- ${c.label} ---`);
  console.log("  key:", r.key);
  console.log("  owner:", r.owner);
  console.log("  parent:", r.parent("Jimin"));
}

console.log("--- DB에 카드 정보 자체가 없음 ---");
const nc = noCardOnFile();
console.log("  key:", nc.key);
console.log("  owner:", nc.owner);
console.log("  parent:", nc.parent("Jimin"));
