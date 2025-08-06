const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const db = require('../db');

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
        END AS next_payment_date
      FROM
        students s
      JOIN
        programs p ON s.program_id = p.id
   LEFT JOIN payinfull_payment pf 
  ON pf.student_id = s.id AND pf.program_id = p.id AND p.payment_type = 'pay_in_full'

LEFT JOIN program_payments pp 
  ON pp.student_id = s.id AND pp.program_id = p.id 
  AND pp.status = 'completed' 
  AND pp.dojang_code = s.dojang_code
      LEFT JOIN
        monthly_payments mp ON s.id = mp.student_id AND p.payment_type = 'monthly_pay'
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

  
  module.exports = router;