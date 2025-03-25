const express = require('express');
const router = express.Router();
const db = require('../db'); // ✅ MySQL 연결
const verifyToken = require('../middleware/verifyToken');


// ✅ 학생 성장 기록 및 구독 취소 내역 반영 API
router.get('/growth/history', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;

  if (!dojang_code) {
    return res.status(400).json({ success: false, message: 'Dojang code is required.' });
  }

  try {
    // ✅ student_growth에서 등록 데이터 + 누적값 가져오기
    const [growthData] = await db.query(
      `SELECT 
         month, 
         SUM(registered_students) AS registered_students,
         MAX(cumulative_students) AS cumulative_students
       FROM student_growth
       WHERE dojang_code = ?
       GROUP BY month
       ORDER BY month ASC`,
      [dojang_code]
    );

    // ✅ 취소 데이터는 그대로 월별로 가져오기
    const [cancellationData] = await db.query(
      `SELECT 
         DATE_FORMAT(canceled_at, '%Y-%m') AS month, 
         COUNT(*) AS canceled_students
       FROM subscription_cancellations
       WHERE dojang_code = ?
       GROUP BY DATE_FORMAT(canceled_at, '%Y-%m')
       ORDER BY month ASC`,
      [dojang_code]
    );

    // 취소 데이터를 Map으로 변환
    const cancellationsMap = new Map();
    cancellationData.forEach((entry) => {
      cancellationsMap.set(entry.month, entry.canceled_students);
    });

    // ✅ 누적은 DB에서 가져온 값 사용
    const history = growthData.map((entry) => ({
      month: entry.month,
      registered_students: entry.registered_students,
      canceled_students: cancellationsMap.get(entry.month) || 0,
      cumulative_students: entry.cumulative_students // 👉 DB 값 그대로 사용
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
