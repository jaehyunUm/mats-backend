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
    // 1. 프로그램별 등록 집계 (students + programs 조인)
    const [programStats] = await db.query(
      `
      SELECT 
        p.id AS program_id,
        p.name AS program_name,
        DATE_FORMAT(s.created_at, '%Y-%m-01') AS month_key,
        COUNT(s.id) AS student_count
      FROM students s
      JOIN programs p ON s.program_id = p.id
      WHERE s.dojang_code = ?
      GROUP BY p.id, p.name, DATE_FORMAT(s.created_at, '%Y-%m-01')
      ORDER BY p.id, month_key ASC
      `,
      [dojang_code]
    );

    // 2. 취소 집계
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

    // 3. 모든 month_key 모으기
    const months = [
      ...new Set([
        ...programStats.map(r => r.month_key),
        ...cancellationData.map(r => r.month_key),
      ])
    ].sort();

    // 4. 총 집계 (Free 제외)
    const history = months.map(month => {
      const canceled = cancellationData.find(r => r.month_key === month)?.canceled_students || 0;

      const totalWithoutFree = programStats
        .filter(r => r.month_key === month && !r.program_name.toLowerCase().includes('free'))
        .reduce((sum, r) => sum + r.student_count, 0);

      return {
        month,                                // "YYYY-MM-01"
        canceled_students: canceled,          // 취소 수
        total_students: totalWithoutFree      // Free 제외한 전체 합산
      };
    });

    // 5. 응답 (요청하신 순서대로)
    res.status(200).json({ 
      success: true, 
      programStats,     // 1. 프로그램별 집계
      cancellationData, // 2. 취소 집계
      history           // 3. Free 제외한 총 집계
    });

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
