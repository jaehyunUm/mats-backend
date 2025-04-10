const cron = require('node-cron');
const { checkPayInFullNotifications } = require('./checkNotifications');

// 새 코드: 1분마다 실행
cron.schedule('* * * * *', () => {
  console.log("📆 Running Pay In Full notification check every minute...");
  checkPayInFullNotifications();
});
