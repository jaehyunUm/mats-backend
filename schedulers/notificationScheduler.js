const cron = require('node-cron');
const { checkPayInFullNotifications } = require('./checkNotifications');

cron.schedule('* * * * *', () => {
  
  console.log("📆 Running Pay In Full notification check every minute...");
  checkPayInFullNotifications();
});