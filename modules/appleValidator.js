const axios = require('axios');

const verifyWithApple = async (receipt, environment = 'production') => {
  const url = environment === 'production'
    ? 'https://buy.itunes.apple.com/verifyReceipt'
    : 'https://sandbox.itunes.apple.com/verifyReceipt';

  const payload = {
    'receipt-data': receipt,
    'password': process.env.APP_STORE_SHARED_SECRET,
    'exclude-old-transactions': true
  };

  const response = await axios.post(url, payload);
  return response.data;
};

module.exports = { verifyWithApple };