const axios = require('axios');

const verifyWithApple = async (receipt) => {
  const payload = {
    'receipt-data': receipt,
    'password': process.env.APP_STORE_SHARED_SECRET,
    'exclude-old-transactions': true
  };

  // 1차: production
  let response = await axios.post('https://buy.itunes.apple.com/verifyReceipt', payload);
  let data = response.data;

  // 2차: 만약 21007 → sandbox fallback
  if (data.status === 21007) {
    response = await axios.post('https://sandbox.itunes.apple.com/verifyReceipt', payload);
    data = response.data;
  }

  return data;
};


module.exports = { verifyWithApple };