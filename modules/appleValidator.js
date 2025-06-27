const axios = require('axios');

const verifyWithApple = async (receipt) => {
  console.log('🍎 [appleValidator] Apple receipt 검증 시작');
  console.log('📏 [appleValidator] Receipt 길이:', receipt?.length || 0);
  
  const payload = {
    'receipt-data': receipt,
    'password': process.env.APP_STORE_SHARED_SECRET,
    'exclude-old-transactions': true
  };

  console.log('🔑 [appleValidator] APP_STORE_SHARED_SECRET 존재:', !!process.env.APP_STORE_SHARED_SECRET);

  let environmentUsed = 'production';
  
  try {
    console.log('🌐 [appleValidator] Production 서버로 요청 중...');
    let response = await axios.post('https://buy.itunes.apple.com/verifyReceipt', payload);
    let data = response.data;
    
    console.log('📡 [appleValidator] Production 응답 status:', data.status);

    if (data.status === 21007) {
      console.log('🔁 [appleValidator] Detected sandbox receipt in production → switching to sandbox');
      environmentUsed = 'sandbox';
      response = await axios.post('https://sandbox.itunes.apple.com/verifyReceipt', payload);
      data = response.data;
      console.log('📡 [appleValidator] Sandbox 응답 status:', data.status);
    }

    console.log('✅ [appleValidator] Apple 검증 완료');
    return { ...data, _environmentUsed: environmentUsed };
    
  } catch (error) {
    console.error('❌ [appleValidator] Apple 검증 오류:', error.message);
    console.error('🔧 [appleValidator] 오류 상세:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    throw error;
  }
};

module.exports = { verifyWithApple };