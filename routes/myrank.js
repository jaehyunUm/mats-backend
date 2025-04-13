// mygrowth.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // MySQL 연결 파일을 설정한 위치에 맞게 변경
const verifyToken = require('../middleware/verifyToken');



router.get('/ranking/:testId', verifyToken, async (req, res) => {
  const { testId } = req.params;
  const { dojang_code } = req.user;
  const dojangOnly = req.query.dojang_code === 'true';
  const useSimilar = req.query.similar === 'true';
  const additionalTestIds = req.query.test_ids ? req.query.test_ids.split(',') : [];
  
  try {
    // 선택한 testId가 실제 test_template에 존재하는지 확인
    const [testTemplate] = await db.execute(
      `SELECT id, test_name, evaluation_type FROM test_template WHERE id = ? LIMIT 1`,
      [testId]
    );
    
    if (!testTemplate.length) {
      return res.status(400).json({ message: 'Invalid test id' });
    }
    
    const { id: testTemplateId, evaluation_type } = testTemplate[0];
    
    // `evaluation_type` 체크
    if (evaluation_type !== 'count' && evaluation_type !== 'time') {
      return res.status(400).json({ message: 'Invalid test type' });
    }
    
    // 모든 테스트 ID 결정
    let testIds = [testTemplateId];
    
    // 유사 테스트 포함이 활성화된 경우에만 추가 ID를 포함
    if (useSimilar && additionalTestIds.length > 0) {
      testIds = [...testIds, ...additionalTestIds];
    }


    // 쿼리 수정 - WHERE 절 조건을 IN으로 변경
    const query = `
      WITH latest_tests AS (
        SELECT
          t1.student_id,
          t1.test_template_id,
          t1.result_value,
          t1.created_at,
          ROW_NUMBER() OVER (
            PARTITION BY t1.student_id, t1.test_template_id
            ORDER BY t1.created_at DESC
          ) AS rn
        FROM testresult t1
        WHERE t1.test_template_id IN (?)
      )
      SELECT
        s.id AS student_id,
        CONCAT(s.last_name, ' ', s.first_name) AS name,
        s.dojang_code AS dojang_code,
        d.dojang_name AS studio_name,
        YEAR(CURDATE()) - YEAR(s.birth_date) AS age,
        s.belt_rank AS belt_rank,
        b.belt_color AS belt_color,
        latest_tests.result_value AS count,
        tt.test_name
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
      ${dojangOnly ? 'WHERE s.dojang_code = ?' : ''}
      ORDER BY
        count DESC
    `;
    
    const params = dojangOnly 
      ? [allTestIds, dojang_code] 
      : [allTestIds];
    
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
    const { dojang_code } = req.user;
    
    const query = `
      SELECT
        id,
        dojang_code,
        CASE
          WHEN evaluation_type = 'count' AND duration IS NOT NULL
            THEN CONCAT(test_name, ' for ', duration, ' Seconds')
          WHEN evaluation_type = 'time' AND target_count IS NOT NULL
            THEN CONCAT(test_name, ' ', target_count, ' times')
          ELSE test_name
        END AS standardized_test_name
      FROM test_template
      WHERE evaluation_type IN ('count', 'time')
      AND dojang_code = ?
    `;
    
    const [result] = await db.execute(query, [dojang_code]);
    res.json(result);
  } catch (error) {
    console.error('Error fetching objective test data:', error);
    res.status(500).json({ message: 'Failed to fetch objective test data' });
  }
});

// 새로운 엔드포인트: /global-rankings?test_ids=123,456,789
router.get('/global-rankings', verifyToken, async (req, res) => {
  const { test_ids } = req.query;
  const { dojang_code } = req.user;
  const dojangOnly = req.query.dojang_code === 'true';
  
  if (!test_ids) {
    return res.status(400).json({ message: 'test_ids parameter is required' });
  }
  
  const testIdArray = test_ids.split(',');
  
  try {
    // 쿼리는 기존과 유사하지만 IN 조건 사용
    const query = `
      WITH latest_tests AS (
        SELECT
          t1.student_id,
          t1.test_template_id,
          t1.result_value,
          t1.created_at,
          ROW_NUMBER() OVER (
            PARTITION BY t1.student_id, t1.test_template_id
            ORDER BY t1.created_at DESC
          ) AS rn
        FROM testresult t1
        WHERE t1.test_template_id IN (?)
      )
      SELECT
        s.id AS student_id,
        CONCAT(s.last_name, ' ', s.first_name) AS name,
        s.dojang_code AS dojang_code,
        d.dojang_name AS studio_name,
        YEAR(CURDATE()) - YEAR(s.birth_date) AS age,
        s.belt_rank AS belt_rank,
        b.belt_color AS belt_color,
        latest_tests.result_value AS count,
        tt.test_name,
        tt.id AS test_id
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
      ${dojangOnly ? 'WHERE s.dojang_code = ?' : ''}
      ORDER BY
        count DESC
    `;
    
    const params = dojangOnly 
      ? [testIdArray, dojang_code] 
      : [testIdArray];
    
    const [rankingData] = await db.execute(query, params);
    res.json(rankingData);
  } catch (error) {
    console.error('Error fetching global ranking data:', error);
    res.status(500).json({ message: 'Failed to fetch global ranking data' });
  }
});







module.exports = router;
