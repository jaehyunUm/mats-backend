const cron = require('node-cron');
const { checkPayInFullNotifications } = require('./checkNotifications');

cron.schedule('0 9 * * *', () => {
  console.log("📆 Running daily Pay In Full notification check...");
  checkPayInFullNotifications();
});
