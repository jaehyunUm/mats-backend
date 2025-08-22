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
   // 1. 프로그램별 등록/변경 집계 (student_growth + programs 조인)
   const [programStats] = await db.query(
    `
    SELECT 
      p.id AS program_id,
      p.name AS program_name,
      DATE_FORMAT(g.created_at, '%Y-%m-01') AS month_key, 
      COUNT(*) AS student_count
    FROM student_growth g
    JOIN programs p ON g.program_id = p.id
    WHERE g.dojang_code = ?
      AND g.status IN ('registered', 'updated')   -- ✅ 변경된 부분
    GROUP BY p.id, p.name, month_key
    ORDER BY p.id, month_key ASC
    `,
    [dojang_code]
  );

    // 2. 취소 집계 (student_growth 에서 status=canceled)
    const [cancellationData] = await db.query(
      `
   SELECT 
  DATE_FORMAT(CONVERT_TZ(g.created_at, '+00:00', '-04:00'), '%Y-%m-01') AS month_key, 
  COUNT(*) AS canceled_students
FROM student_growth g
LEFT JOIN programs p ON g.program_id = p.id
WHERE g.dojang_code = ?
  AND g.status = 'canceled'
  AND (p.name IS NULL OR LOWER(p.name) NOT LIKE '%free trial%')
GROUP BY month_key
ORDER BY month_key ASC;
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

    // 4. 총 집계 (Free Trial 제외 + 취소 반영 → 누적 인원수)
    let cumulativeTotal = 0;

    const history = months.map(month => {
      const canceled = cancellationData.find(r => r.month_key === month)?.canceled_students || 0;

      const newRegistrations = programStats
        .filter(r => r.month_key === month && !r.program_name.toLowerCase().includes('free'))
        .reduce((sum, r) => sum + r.student_count, 0);

      const netThisMonth = newRegistrations - canceled;
      cumulativeTotal += netThisMonth;

      return {
        month,
        registered: newRegistrations,
        canceled,
        total_students: cumulativeTotal < 0 ? 0 : cumulativeTotal
      };
    });

    // 5. 응답
    res.status(200).json({ 
      success: true, 
      programStats,     // 프로그램별 월별 등록
      cancellationData, // 월별 취소
      history           // Free Trial 제외 + 취소 반영된 누적 학생 수
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
