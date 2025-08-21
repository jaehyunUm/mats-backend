const express = require('express');
const router = express.Router();
const db = require('../db'); // ✅ MySQL 연결
const verifyToken = require('../middleware/verifyToken');


router.get('/growth/history', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;
  if (!dojang_code) {
    return res.status(400).json({ success: false, message: 'Dojang code is required.' });
  }

  try {

   // 1. Monthly 등록 집계
const [monthlyData] = await db.query(
  `
  SELECT DATE_FORMAT(payment_date, '%Y-%m-01') AS month_key, COUNT(*) AS monthly_students
  FROM monthly_payments
  WHERE dojang_code = ?
  GROUP BY DATE_FORMAT(payment_date, '%Y-%m-01')
  ORDER BY DATE_FORMAT(payment_date, '%Y-%m-01') ASC
  `,
  [dojang_code]
);

// 2. Pay-in-full 등록 집계
const [payinfullData] = await db.query(
  `
  SELECT DATE_FORMAT(start_date, '%Y-%m-01') AS month_key, COUNT(*) AS payinfull_students
  FROM payinfull_payment
  WHERE dojang_code = ?
  GROUP BY DATE_FORMAT(start_date, '%Y-%m-01')
  ORDER BY DATE_FORMAT(start_date, '%Y-%m-01') ASC
  `,
  [dojang_code]
);

    // 3. 취소 집계
    const [cancellationData] = await db.query(
      `
      SELECT DATE_FORMAT(canceled_at, '%Y-%m-01') AS month_key, COUNT(*) AS canceled_students
      FROM subscription_cancellations
      WHERE dojang_code = ?
      GROUP BY DATE_FORMAT(canceled_at, '%Y-%m-01')
      ORDER BY DATE_FORMAT(canceled_at, '%Y-%m-01') ASC
      `,
      [dojang_code]
    );

    // 4. 모든 month_key 모으기
    const months = [
      ...new Set([
        ...monthlyData.map(r => r.month_key),
        ...payinfullData.map(r => r.month_key),
        ...cancellationData.map(r => r.month_key),
      ])
    ].sort();

    // 5. 누적 학생 수 계산
    let cumulativeTotal = 0;
    const history = months.map(month => {
      const monthly = monthlyData.find(r => r.month_key === month)?.monthly_students || 0;
      const payinfull = payinfullData.find(r => r.month_key === month)?.payinfull_students || 0;
      const canceled = cancellationData.find(r => r.month_key === month)?.canceled_students || 0;

      const newRegistrations = monthly + payinfull;
      cumulativeTotal += newRegistrations;

      return {
        month,                    // "YYYY-MM-01"
        monthly_students: monthly,
        payinfull_students: payinfull,
        canceled_students: canceled,
        cumulative_students: cumulativeTotal, // ✅ 누적 학생 수
      };
    });

    res.status(200).json({ success: true, history });
  } catch (error) {
    console.error('❌ Error fetching growth history:', error);
    res.status(500).json({ success: false, message: 'Error fetching growth history.' });
  }
});




  
  router.get('/revenue/history', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;
    // ✅ Validation
    if (!dojang_code) {
      return res.status(400).json({ success: false, message: 'Dojang code is required.' });
    }
  
    try {
      // ✅ 프로그램 결제 수익 조회
      const [programRevenue] = await db.query(
        `SELECT 
           DATE_FORMAT(payment_date, '%Y-%m') AS month, 
           SUM(amount) AS revenue
         FROM program_payments
         WHERE dojang_code = ?
         GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
         ORDER BY month ASC`,
        [dojang_code]
      );
  
      // ✅ 아이템 결제 수익 조회
      const [itemRevenue] = await db.query(
        `SELECT 
           DATE_FORMAT(payment_date, '%Y-%m') AS month, 
           SUM(amount) AS revenue
         FROM item_payments
         WHERE dojang_code = ?
         GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
         ORDER BY month ASC`,
        [dojang_code]
      );
  
      // ✅ 테스트 결제 수익 조회
      const [testRevenue] = await db.query(
        `SELECT 
           DATE_FORMAT(payment_date, '%Y-%m') AS month, 
           SUM(amount) AS revenue
         FROM test_payments
         WHERE dojang_code = ?
         GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
         ORDER BY month ASC`,
        [dojang_code]
      );
  
      // ✅ 수익 데이터를 type별로 구성
      const formatRevenueData = (data, type) =>
        data.map((entry) => ({
          month: entry.month,
          total_revenue: parseFloat(entry.revenue),
          type, // 'program', 'item', 'test'
        }));
  
      const programData = formatRevenueData(programRevenue, 'program');
      const itemData = formatRevenueData(itemRevenue, 'item');
      const testData = formatRevenueData(testRevenue, 'test');
  
      // ✅ 모든 데이터를 합치기
      const combinedRevenue = [...programData, ...itemData, ...testData];
  
      if (combinedRevenue.length === 0) {
        return res.status(404).json({ success: false, message: 'No revenue history found for this dojang.' });
      }
  
      // ✅ 월별로 정렬
      combinedRevenue.sort((a, b) => (a.month > b.month ? 1 : -1));
  
      res.status(200).json({ success: true, history: combinedRevenue });
    } catch (error) {
      console.error('❌ Error fetching revenue history:', error);
      res.status(500).json({ success: false, message: 'Error fetching revenue history.' });
    }
  });
  
  
  
module.exports = router; // ✅ 라우터 내보내기
