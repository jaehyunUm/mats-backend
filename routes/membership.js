const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const db = require('../db');
const { createStripeClientWithKey } = require('../modules/stripeClient');
// 자녀 정보 API
router.get('/membership-info', verifyToken, async (req, res) => {
  const parentId = req.query.parent_id;
  const { dojang_code } = req.user;
  
  if (!parentId) {
    return res.status(400).json({ message: 'Parent ID가 제공되지 않았습니다.' });
  }
  
  try {
    const [rows] = await db.query(
      `SELECT
        s.first_name,
        s.last_name,
        p.name AS program_name,
        CASE 
          WHEN p.payment_type = 'pay_in_full' THEN pp.amount
          WHEN p.payment_type = 'monthly_pay' THEN mp.program_fee
          ELSE p.price
        END AS program_price,
        p.payment_type,
        p.operation_type,
        CASE 
          WHEN p.payment_type = 'pay_in_full' THEN pf.total_classes
          ELSE NULL
        END AS total_classes,
        CASE 
          WHEN p.payment_type = 'pay_in_full' THEN pf.remaining_classes
          ELSE NULL
        END AS remaining_classes,
        CASE 
          WHEN p.payment_type = 'pay_in_full' THEN pf.start_date
          WHEN p.payment_type = 'monthly_pay' THEN mp.start_date 
          ELSE NULL
        END AS start_date,
        CASE 
          WHEN p.payment_type = 'pay_in_full' THEN pf.end_date
          WHEN p.payment_type = 'monthly_pay' THEN mp.end_date
          ELSE NULL
        END AS end_date,
        CASE 
          WHEN p.payment_type = 'monthly_pay' THEN mp.payment_status
          ELSE NULL
        END AS payment_status,
        CASE 
          WHEN p.payment_type = 'monthly_pay' THEN mp.next_payment_date
          ELSE NULL
        END AS next_payment_date,
        
        -- ===================================
        -- ✨ 이 세 줄이 추가되었습니다.
        -- ===================================
        CASE 
          WHEN p.payment_type = 'monthly_pay' THEN mp.id
          ELSE NULL
        END AS subscription_id, -- 월간 구독 ID (카드 변경 시 '어떤 구독'인지 식별)
        CASE 
          WHEN p.payment_type = 'monthly_pay' THEN mp.source_id
          ELSE NULL
        END AS source_id, -- 현재 등록된 카드 ID (PaymentMethod ID)
        CASE 
          WHEN p.payment_type = 'monthly_pay' THEN mp.customer_id
          ELSE NULL
        END AS customer_id -- Stripe 고객 ID (카드 정보 조회 시 필요)
        -- ===================================
        
      FROM
        students s
      JOIN
        programs p ON s.program_id = p.id
      LEFT JOIN 
        payinfull_payment pf ON pf.student_id = s.id 
          AND pf.dojang_code = s.dojang_code 
          AND p.payment_type = 'pay_in_full'
      LEFT JOIN 
        program_payments pp ON pp.student_id = s.id 
          AND pp.program_id = p.id 
          AND pp.status = 'completed' 
          AND pp.dojang_code = s.dojang_code
      LEFT JOIN
        monthly_payments mp ON s.id = mp.student_id 
          AND p.payment_type = 'monthly_pay'
      WHERE
        s.parent_id = ? AND s.dojang_code = ?`,
      [parentId, dojang_code]
    );
    
    res.status(200).json(rows);
  } catch (error) {
    console.error('자녀 정보 조회 오류:', error);
    res.status(500).json({ message: '자녀 정보 조회 중 오류가 발생했습니다.' });
  }
});

// ✨ [신규 API] 등록된 카드 정보 가져오기
router.get('/card-details', verifyToken, async (req, res) => {
  const { source_id, customer_id } = req.query;
  const { dojang_code } = req.user;

  if (!source_id || !customer_id) {
    return res.status(400).json({ message: 'Source ID and Customer ID are required.' });
  }

  try {
    // 도장(Owner)의 Stripe 연결 정보 조회
    const [ownerRows] = await db.query(
      `SELECT stripe_access_token FROM owner_bank_accounts WHERE dojang_code = ? LIMIT 1`,
      [dojang_code]
    );

    if (!ownerRows.length || !ownerRows[0].stripe_access_token) {
      throw new Error('Stripe account not connected.');
    }
    
    const stripe = createStripeClientWithKey(ownerRows[0].stripe_access_token);

    // Stripe API를 통해 Payment Method(카드) 정보 조회
    const paymentMethod = await stripe.paymentMethods.retrieve(source_id);

    if (paymentMethod && paymentMethod.card) {
      res.json({
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
      });
    } else {
      res.status(404).json({ message: 'Card details not found.' });
    }
  } catch (error) {
    console.error('Error fetching card details:', error);
    res.status(500).json({ message: 'Failed to fetch card details.', error: error.message });
  }
});
  
  module.exports = router;