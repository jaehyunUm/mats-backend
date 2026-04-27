const express = require('express');
const router = express.Router();
const db = require('../db'); // ✅ MySQL 연결
const verifyToken = require('../middleware/verifyToken');

router.get('/growth/history', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;
  if (!dojang_code) {
    return res.status(400).json({ success: false, message: 'Dojang code is required.' });
  }

  const TIMEZONE = '-04:00'; // 필요 시 환경변수나 유저 정보에서 가져옴

  try {
    // 1. [차트용] 프로그램별 등록/변경 집계
    const [programStats] = await db.query(
      `
      SELECT 
        p.id AS program_id,
        p.name AS program_name,
        DATE_FORMAT(CONVERT_TZ(g.created_at, '+00:00', ?), '%Y-%m-01') AS month_key, 
        COUNT(*) AS student_count
      FROM student_growth g
      JOIN programs p ON g.program_id = p.id
      WHERE g.dojang_code = ?
        AND g.status IN ('registered', 'updated')
      GROUP BY p.id, p.name, month_key
      ORDER BY p.id, month_key ASC
      `,
      [TIMEZONE, dojang_code]
    );

    // 2. [차트용] 취소 건수 집계 (단순 건수)
    const [cancellationData] = await db.query(
      `
      SELECT 
        DATE_FORMAT(CONVERT_TZ(g.created_at, '+00:00', ?), '%Y-%m-01') AS month_key, 
        COUNT(*) AS canceled_count
      FROM student_growth g
      LEFT JOIN programs p ON g.program_id = p.id
      WHERE g.dojang_code = ?
        AND g.status = 'canceled'
        AND g.student_id IS NOT NULL
        AND (p.name IS NULL OR LOWER(p.name) NOT LIKE '%free trial%')
      GROUP BY month_key
      ORDER BY month_key ASC;
      `,
      [TIMEZONE, dojang_code]
    );

    // 3. 🚀 [핵심 수정] 월별 실제 누적 인원 (스냅샷 방식)
    // 데이터가 존재하는 모든 월을 가져온 뒤, 각 월의 마지막 날 기준 활성 학생수를 계산합니다.
    const [monthsResult] = await db.query(
      `
      SELECT DISTINCT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', ?), '%Y-%m-01') AS month_key
      FROM student_growth
      WHERE dojang_code = ?
      ORDER BY month_key ASC
      `,
      [TIMEZONE, dojang_code]
    );

    const history = [];
    for (const row of monthsResult) {
      const month = row.month_key;
      
      // 해당 월의 마지막 날짜 구하기 (YYYY-MM-DD 23:59:59 기준)
      const lastDayOfMonth = `${month.substring(0, 7)}-31 23:59:59`; 

      const [activeCount] = await db.query(
        `
        SELECT COUNT(*) AS total_students
        FROM (
          SELECT 
            g.student_id,
            g.status,
            ROW_NUMBER() OVER(PARTITION BY g.student_id ORDER BY g.created_at DESC) as rn
          FROM student_growth g
          JOIN programs p ON g.program_id = p.id
          WHERE g.dojang_code = ?
            AND CONVERT_TZ(g.created_at, '+00:00', ?) <= LAST_DAY(STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s'))
            AND LOWER(p.name) NOT LIKE '%free%'
        ) t
        WHERE t.rn = 1 AND t.status IN ('registered', 'updated')
        `,
        [dojang_code, TIMEZONE, lastDayOfMonth]
      );

      // 이번 달의 신규 등록(최초 등록) 수 추출
      const [newCount] = await db.query(
        `
        SELECT COUNT(student_id) AS new_registrations
        FROM (
          SELECT student_id, MIN(CONVERT_TZ(created_at, '+00:00', ?)) as first_reg
          FROM student_growth g
          JOIN programs p ON g.program_id = p.id
          WHERE g.dojang_code = ? 
            AND status IN ('registered', 'updated')
            AND LOWER(p.name) NOT LIKE '%free%'
          GROUP BY student_id
        ) first_times
        WHERE DATE_FORMAT(first_reg, '%Y-%m-01') = ?
        `,
        [TIMEZONE, dojang_code, month]
      );

      const canceledThisMonth = cancellationData.find(c => c.month_key === month)?.canceled_count || 0;

      history.push({
        month,
        registered: newCount[0].new_registrations, // 해당 월에 처음 시작한 순수 신규 학생
        canceled: canceledThisMonth,               // 해당 월에 발생한 취소 건수
        total_students: activeCount[0].total_students // 해당 월 말 기준 실제 총원 (오차 없음)
      });
    }

    res.status(200).json({ 
      success: true, 
      programStats,
      cancellationData,
      history
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
  
  router.get('/growth/canceled-students-list', verifyToken, async (req, res) => {
    const { year } = req.query;
    const { dojang_code } = req.user;
  
    if (!year) {
      return res.status(400).json({ success: false, message: 'Year is required' });
    }
  
    try {
      const query = `
        SELECT 
          sg.id,
          sg.created_at as cancel_date,
          s.first_name,
          s.last_name,
          p.name AS program_name 
        FROM student_growth sg
        JOIN students s ON sg.student_id = s.id
        LEFT JOIN programs p ON sg.program_id = p.id
        WHERE sg.status = 'canceled'
          AND sg.dojang_code = ?
          AND YEAR(sg.created_at) = ?
          -- ✨ [추가됨] 프로그램 이름에 'Free' 또는 'Trial'이 포함된 경우 제외
          AND p.name NOT LIKE '%Free%'
          AND p.name NOT LIKE '%Trial%'
        ORDER BY sg.created_at DESC
      `;
  
      const [rows] = await db.query(query, [dojang_code, year]);
      
      // 날짜 포맷팅 (YYYY-MM-DD)
      const formattedRows = rows.map(row => ({
        ...row,
        cancel_date: new Date(row.cancel_date).toISOString().split('T')[0]
      }));
  
      res.json({ success: true, data: formattedRows });
  
    } catch (error) {
      console.error('Error fetching canceled students:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
  
module.exports = router; // ✅ 라우터 내보내기
