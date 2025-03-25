// mygrowth.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // MySQL 연결 파일을 설정한 위치에 맞게 변경
const verifyToken = require('../middleware/verifyToken');



router.get('/ranking/:testId', verifyToken, async (req, res) => {
  const { testId } = req.params; // 프론트에서 넘어오는 test.id
  const { dojang_code: queryDojangCode } = req.query; // 내 도장 필터 여부
  const dojang_code = queryDojangCode === 'true' ? req.user.dojang_code : null;

  try {
    // 선택한 testId가 실제 test_template에 존재하는지 확인
    const [testTemplate] = await db.execute(
      `SELECT id, test_name, test_type FROM test_template WHERE id = ? LIMIT 1`,
      [testId] // 이제 testId = 숫자 id
    );

    if (!testTemplate.length) {
      return res.status(400).json({ message: 'Invalid test id' });
    }

    const { id: testTemplateId, test_type } = testTemplate[0];

    // `test_type` 체크
    if (test_type !== 'count' && test_type !== 'time') {
      return res.status(400).json({ message: 'Invalid test type' });
    }

    // 랭킹 쿼리 실행
    const query = `
      WITH latest_tests AS (
          SELECT 
              t1.student_id, 
              t1.test_template_id, 
              t1.result_value, 
              t1.created_at,
              ROW_NUMBER() OVER (
                  PARTITION BY t1.student_id 
                  ORDER BY t1.created_at DESC
              ) AS rn
          FROM testresult t1
          WHERE t1.test_template_id = ?
      )
      SELECT 
          s.id AS student_id, 
          CONCAT(s.last_name, ' ', s.first_name) AS name, 
          s.dojang_code AS dojang_code,
          d.dojang_name AS studio_name, 
          YEAR(CURDATE()) - YEAR(s.birth_date) AS age,  
          s.belt_rank AS belt_rank, 
          b.belt_color AS belt_color,
          latest_tests.result_value AS count 
      FROM 
          students s
      JOIN 
          latest_tests ON s.id = latest_tests.student_id AND latest_tests.rn = 1  
      JOIN 
          test_template tt ON latest_tests.test_template_id = tt.id  
      JOIN 
          beltsystem b ON s.belt_rank = b.belt_rank AND s.dojang_code = b.dojang_code  
      JOIN 
          dojangs d ON s.dojang_code = d.dojang_code
      ${dojang_code ? 'WHERE s.dojang_code = ?' : ''} 
      ORDER BY 
          count DESC
    `;

    const params = dojang_code ? [testTemplateId, dojang_code] : [testTemplateId];
    console.log('Generated Query:', query, 'Params:', params);

    const [rankingData] = await db.execute(query, params);

    res.json(rankingData);
  } catch (error) {
    console.error('Error fetching ranking data:', error);
    res.status(500).json({ message: 'Failed to fetch ranking data' });
  }
});



// 객관적인 평가 항목 조회 API
router.get('/objective-tests', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT 
          id,
          dojang_code,
          CASE 
              WHEN test_type = 'count' AND duration IS NOT NULL 
                  THEN CONCAT(test_name, ' for ', duration, ' Seconds')
              WHEN test_type = 'time' AND target_count IS NOT NULL 
                  THEN CONCAT(test_name, ' ', target_count, ' times')
              ELSE test_name
          END AS standardized_test_name
      FROM test_template
      WHERE test_type IN ('count', 'time');
    `;

    const [result] = await db.execute(query);
    res.json(result);
  } catch (error) {
    console.error('Error fetching objective test data:', error);
    res.status(500).json({ message: 'Failed to fetch objective test data' });
  }
});










module.exports = router;
