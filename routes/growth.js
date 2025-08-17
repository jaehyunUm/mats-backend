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
    // 등록/누적(월 스냅샷)
    const [growthData] = await db.query(
      `
      SELECT 
        DATE_FORMAT(month, '%Y-%m-01') AS month_key,
        SUM(registered_students) AS registered_students,
        MAX(cumulative_students) AS cumulative_students
      FROM student_growth
      WHERE dojang_code = ?
      GROUP BY DATE_FORMAT(month, '%Y-%m-01')
      ORDER BY DATE_FORMAT(month, '%Y-%m-01') ASC
      `,
      [dojang_code]
    );

    // 취소 집계(월별)
    const [cancellationData] = await db.query(
      `
      SELECT 
        DATE_FORMAT(canceled_at, '%Y-%m-01') AS month_key,
        COUNT(*) AS canceled_students
      FROM subscription_cancellations
      WHERE dojang_code = ?
      GROUP BY DATE_FORMAT(canceled_at, '%Y-%m-01')
      ORDER BY DATE_FORMAT(canceled_at, '%Y-%m-01') ASC
      `,
      [dojang_code]
    );

    // 취소 Map
    const cancMap = new Map(
      cancellationData.map(({ month_key, canceled_students }) => [month_key, canceled_students])
    );

    // 머지
    const history = growthData.map((g) => ({
      month: g.month_key, // 'YYYY-MM-01'
      registered_students: Number(g.registered_students) || 0,
      canceled_students: cancMap.get(g.month_key) || 0,
      cumulative_students: Number(g.cumulative_students) || 0,
    }));

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
