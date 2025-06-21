const axios = require('axios');

const verifyWithApple = async (receipt) => {
  const payload = {
    'receipt-data': receipt,
    'password': process.env.APP_STORE_SHARED_SECRET,
    'exclude-old-transactions': true
  };

  let environmentUsed = 'production';
  let response = await axios.post('https://buy.itunes.apple.com/verifyReceipt', payload);
  let data = response.data;

  if (data.status === 21007) {
    console.log('🔁 Detected sandbox receipt in production → switching to sandbox');
    environmentUsed = 'sandbox';
    response = await axios.post('https://sandbox.itunes.apple.com/verifyReceipt', payload);
    data = response.data;
  }

  return { ...data, _environmentUsed: environmentUsed };
};


module.exports = { verifyWithApple };