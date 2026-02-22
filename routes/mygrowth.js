// mygrowth.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // MySQL 연결 파일을 설정한 위치에 맞게 변경
const verifyToken = require('../middleware/verifyToken');


// 부모 계정과 연결된 자녀 목록을 가져오는 엔드포인트
router.get('/students/:parentId', verifyToken, async (req, res) => {
  const { dojang_code } = req.user; // 도장 코드는 미들웨어에서 추출
  const { parentId } = req.params; // URL 파라미터에서 부모 ID를 가져옴

  try {
    const query = `
      SELECT 
        students.id,
        students.first_name,
        students.last_name,
        students.birth_date,
        students.belt_rank,
        programs.classes_per_week
      FROM students
      LEFT JOIN programs ON students.program_id = programs.id
      WHERE students.parent_id = ? AND students.dojang_code = ?
    `;

    const [children] = await db.execute(query, [parentId, dojang_code]);

    res.json(children); // 부모와 연결된 자녀 목록 반환
  } catch (error) {
    console.error('Error fetching children with classes_per_week:', error);
    res.status(500).json({ message: 'Failed to fetch children' });
  }
});

router.get('/test-results/:studentId', verifyToken, async (req, res) => {
  const { studentId } = req.params;
  const { dojang_code } = req.user;
  
  try {
    const [testResults] = await db.query(
      `SELECT
        r.student_id,
        r.test_template_id,
        t.test_name,
        t.evaluation_type,
        r.result_value,
        r.test_type,
        DATE_FORMAT(r.created_at, '%Y-%m-%d') AS date,
        -- 이전 기록 (전회차 비교용)
        LAG(r.result_value) OVER (PARTITION BY r.student_id, t.test_name ORDER BY r.created_at) AS previous_result,
        -- ⭐️ 최초 기록 (누적 비교용) 추가!
        FIRST_VALUE(r.result_value) OVER (PARTITION BY r.student_id, t.test_name ORDER BY r.created_at) AS initial_result
      FROM testresult r
      JOIN test_template t ON r.test_template_id = t.id
      WHERE r.student_id = ? AND t.dojang_code = ?
      ORDER BY r.test_template_id, r.created_at ASC`,
      [studentId, dojang_code]
    );

    // 성장률 및 누적성장률 계산
    const processedResults = testResults.map((result) => {
      const previous = result.previous_result;
      const initial = result.initial_result; // 최초 기록
      const current = result.result_value;
      
      let growthRate;
      let cumulativeGrowthRate; // 누적 성장률
      
      // 첫 번째 테스트가 아닌 경우(previous가 있는 경우)에만 계산
      if (previous !== null && previous !== undefined) {
        if (result.evaluation_type === 'time') {
          // time 타입인 경우 (시간이 줄어들면 성장)
          growthRate = (((previous - current) / previous) * 100).toFixed(1);
          // ⭐️ 누적 성장률: (최초기록 - 현재기록) / 최초기록
          cumulativeGrowthRate = (((initial - current) / initial) * 100).toFixed(1); 
        } else {
          // 다른 타입 (숫자가 커지면 성장)
          growthRate = (((current - previous) / previous) * 100).toFixed(1);
          // ⭐️ 누적 성장률: (현재기록 - 최초기록) / 최초기록
          cumulativeGrowthRate = (((current - initial) / initial) * 100).toFixed(1);
        }
      } else {
        // 첫 번째 기록일 경우 비교 대상이 없으므로 N/A 처리
        growthRate = 'N/A';
        cumulativeGrowthRate = 'N/A';
      }
      
      return {
        ...result,
        growth_rate: growthRate,
        cumulative_growth_rate: cumulativeGrowthRate, // API 응답에 추가
      };
    });

    console.log('Processed Test Results with Growth Rates:', processedResults);
    res.json(processedResults);
  } catch (error) {
    console.error('Error fetching test results:', error);
    res.status(500).json({ message: 'Failed to fetch test results' });
  }
});






module.exports = router;
