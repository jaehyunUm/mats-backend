const express = require('express');
const router = express.Router();
const db = require('../db'); // DB 연결

/**
 * POST /api/update-payment-status
 * 결제 상태 업데이트 API
 */
router.post('/update-payment-status', async (req, res) => {
  const { paymentId, status, nextPaymentDate } = req.body;

  // 필수 필드 확인
  if (!paymentId || !status || !nextPaymentDate) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const query = `
      UPDATE monthly_payments 
      SET status = ?, payment_date = ?, updated_at = NOW() 
      WHERE id = ?
    `;

    const [result] = await db.query(query, [status, nextPaymentDate, paymentId]);

    if (result.affectedRows > 0) {
      return res.status(200).json({ success: true, message: "Payment status updated successfully" });
    } else {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
