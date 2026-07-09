const express = require('express');
const router = express.Router();
const db = require('../db'); // ✅ MySQL 연결
const verifyToken = require('../middleware/verifyToken');

router.get('/growth/history', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;
  if (!dojang_code) {
    return res.status(400).json({ success: false, message: 'Dojang code is required.' });
  }

  const TIMEZONE = '-04:00'; // 또는 req.user.timezone 등에서 가져옵니다.

  try {
    // 1. 프로그램별 등록/변경 집계 (기존과 동일 - 차트용)
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

    // 2. 취소 집계 (기존과 동일 - 차트 및 히스토리용)
    const [cancellationData] = await db.query(
      `
      SELECT 
        DATE_FORMAT(CONVERT_TZ(g.created_at, '+00:00', ?), '%Y-%m-01') AS month_key, 
        COUNT(*) AS canceled_students
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

    // 3. 월별 *순수* 신규 유료 학생 집계 (기존과 동일 - 히스토리의 'registered' 표기용)
    const [newStudentData] = await db.query(
      `
      WITH StudentFirstPaidMonth AS (
        SELECT
          g.student_id,
          MIN(DATE_FORMAT(CONVERT_TZ(g.created_at, '+00:00', ?), '%Y-%m-01')) AS first_month_key
        FROM student_growth g
        JOIN programs p ON g.program_id = p.id
        WHERE g.dojang_code = ?
          AND g.status IN ('registered', 'updated')
          AND LOWER(p.name) NOT LIKE '%free%'
          AND g.student_id IS NOT NULL
        GROUP BY g.student_id
      )
      SELECT
        first_month_key AS month_key,
        COUNT(student_id) AS new_students
      FROM StudentFirstPaidMonth
      GROUP BY first_month_key
      ORDER BY first_month_key ASC;
      `,
      [TIMEZONE, dojang_code]
    );

    // 4. 🚀 [신규 추가] 매월 기준 "실제 등록 상태인 총 학생 수" 집계
    // 데이터베이스 버전 호환성을 위해 RECURSIVE 대신 안전한 방식으로 쿼리를 작성했습니다.
    const [monthlyActiveData] = await db.query(
      `
      WITH ExistingMonths AS (
        SELECT DISTINCT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', ?), '%Y-%m-01') AS month_key
        FROM student_growth
        WHERE dojang_code = ?
      ),
      StudentLastStatus AS (
        SELECT 
          m.month_key,
          g.student_id,
          SUBSTRING_INDEX(GROUP_CONCAT(g.status ORDER BY g.created_at DESC), ',', 1) AS last_status
        FROM ExistingMonths m
        JOIN student_growth g ON g.dojang_code = ?
          AND DATE_FORMAT(CONVERT_TZ(g.created_at, '+00:00', ?), '%Y-%m-01') <= m.month_key
        WHERE g.student_id IS NOT NULL
        GROUP BY m.month_key, g.student_id
      )
      SELECT 
        month_key,
        COUNT(DISTINCT CASE WHEN last_status IN ('registered', 'updated') THEN student_id END) AS exact_total_students
      FROM StudentLastStatus
      GROUP BY month_key
      ORDER BY month_key ASC;
      `,
      [TIMEZONE, dojang_code, dojang_code, TIMEZONE]
    );

    // 5. 모든 month_key 모으기 (monthlyActiveData 결과도 배열에 포함)
    const months = [
      ...new Set([
        ...programStats.map(r => r.month_key),
        ...cancellationData.map(r => r.month_key),
        ...newStudentData.map(r => r.month_key), 
        ...monthlyActiveData.map(r => r.month_key), // 🚀 4번 쿼리 달력 추가
      ])
    ].sort();

    // 6. 🚀 [핵심 수정] 덧셈 뺄셈 로직(cumulativeTotal)을 버리고, 4번 쿼리 결과를 그대로 매핑합니다.
    const history = months.map(month => {
      const canceled = cancellationData.find(r => r.month_key === month)?.canceled_students || 0;
      const newRegistrations = newStudentData.find(r => r.month_key === month)?.new_students || 0;
      
      // 4번 쿼리에서 가져온 "해당 월의 실제 총 인원"
      const exactTotal = monthlyActiveData.find(r => r.month_key === month)?.exact_total_students || 0;

      return {
        month,
        registered: newRegistrations, // 이번 달 순수 신규 가입자
        canceled,                     // 이번 달 취소자
        total_students: exactTotal    // 🚀 오류 없는 그 달의 "진짜" 총 학생 수
      };
    });

    // 7. 응답
    res.status(200).json({ 
      success: true, 
      programStats,     
      cancellationData, 
      history           // 앱 화면에 완벽하게 일치하는 데이터가 전달됩니다.
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
