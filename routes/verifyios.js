const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();

async function validateReceipt(receiptData, retry = false) {
  const url = retry
    ? 'https://sandbox.itunes.apple.com/verifyReceipt'
    : 'https://buy.itunes.apple.com/verifyReceipt';

  const payload = {
    'receipt-data': receiptData,
    'password': process.env.APP_STORE_SHARED_SECRET, // App-Specific Shared Secret
    'exclude-old-transactions': true
  };

  try {
    const response = await axios.post(url, payload);
    const { status } = response.data;

    if (status === 21007 && !retry) {
      // Retry with sandbox
      return validateReceipt(receiptData, true);
    }

    return response.data;
  } catch (err) {
    console.error('Receipt validation failed:', err.message);
    throw err;
  }
}

router.post('/verify-receipt', async (req, res) => {
  const { receiptData } = req.body;

  if (!receiptData) {
    return res.status(400).json({ message: 'No receipt data provided' });
  }

  try {
    const result = await validateReceipt(receiptData);

    if (result.status === 0) {
      // ✅ 유효한 영수증 처리
      return res.status(200).json({
        valid: true,
        latest_receipt_info: result.latest_receipt_info,
        renewal_info: result.pending_renewal_info
      });
    } else {
      return res.status(400).json({ valid: false, status: result.status });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Internal error validating receipt.' });
  }
});

module.exports = router;
