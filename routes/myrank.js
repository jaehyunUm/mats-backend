// mygrowth.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // MySQL 연결 파일을 설정한 위치에 맞게 변경
const verifyToken = require('../middleware/verifyToken');



router.get('/ranking/:groupId', verifyToken, async (req, res) => {
  const { groupId } = req.params;
  const { dojang_code } = req.user;
  const dojangOnly = req.query.dojang_code === 'true';
  const useSimilar = req.query.similar === 'true';
  const additionalGroupIds = req.query.group_ids ? req.query.group_ids.split(',') : [];
  
  try {
    // 디버깅 로그 추가
    console.log("그룹 ID:", groupId);
    console.log("추가 그룹 ID:", additionalGroupIds);
    console.log("도장 코드:", dojang_code);
    console.log("내 도장만:", dojangOnly);
    
    // group_id에서 정보 추출
    const parts = groupId.split('-');
    if (parts.length < 3) {
      return res.status(400).json({ message: 'Invalid group ID format' });
    }
    
    const lastPart = parts[parts.length - 1];
    const secondLastPart = parts[parts.length - 2];
    
    let evaluation_type, value;
    
    if (!isNaN(lastPart)) {
      evaluation_type = secondLastPart;
      value = parseInt(lastPart);
    } else {
      evaluation_type = lastPart;
      value = null;
    }
    
    const testNameParts = parts.slice(0, -2);
    const test_name = testNameParts.join(' ');
    
    // 해당 group_id에 맞는 test_template_id들 찾기
    const [testTemplates] = await db.execute(
      `SELECT id, test_name, evaluation_type 
       FROM test_template 
       WHERE evaluation_type = ? 
         AND (
           (evaluation_type = 'count' AND duration = ?) OR
           (evaluation_type = 'time' AND target_count = ?) OR
           (evaluation_type = 'attempt' AND target_count = ?) OR
           (evaluation_type = 'break' AND target_count = ?)
         )`,
      [evaluation_type, value, value, value, value]
    );
    
    if (!testTemplates.length) {
      return res.status(400).json({ message: 'No tests found for this group' });
    }
    
    const testTemplateIds = testTemplates.map(t => t.id);
    const evaluation_type_from_db = testTemplates[0].evaluation_type;
    
    // evaluation_type 체크
    if (evaluation_type_from_db !== 'count' && evaluation_type_from_db !== 'time' && 
        evaluation_type_from_db !== 'attempt' && evaluation_type_from_db !== 'break') {
      return res.status(400).json({ message: 'Invalid test type' });
    }
    
    // 모든 테스트 ID 결정
    let allTestIds = [...testTemplateIds];
    
    // 유사 테스트 포함이 활성화된 경우에만 추가 ID를 포함
    if (useSimilar && additionalGroupIds.length > 0) {
      // 추가 group_id들에 대한 test_template_id들도 찾기
      for (const additionalGroupId of additionalGroupIds) {
        const additionalParts = additionalGroupId.split('-');
        if (additionalParts.length >= 3) {
          const additionalLastPart = additionalParts[additionalParts.length - 1];
          const additionalSecondLastPart = additionalParts[additionalParts.length - 2];
          
          let additionalEvaluationType, additionalValue;
          
          if (!isNaN(additionalLastPart)) {
            additionalEvaluationType = additionalSecondLastPart;
            additionalValue = parseInt(additionalLastPart);
          } else {
            additionalEvaluationType = additionalLastPart;
            additionalValue = null;
          }
          
          const [additionalTestTemplates] = await db.execute(
            `SELECT id FROM test_template 
             WHERE evaluation_type = ? 
               AND (
                 (evaluation_type = 'count' AND duration = ?) OR
                 (evaluation_type = 'time' AND target_count = ?) OR
                 (evaluation_type = 'attempt' AND target_count = ?) OR
                 (evaluation_type = 'break' AND target_count = ?)
               )`,
            [additionalEvaluationType, additionalValue, additionalValue, additionalValue, additionalValue]
          );
          
          const additionalIds = additionalTestTemplates.map(t => t.id);
          allTestIds = [...allTestIds, ...additionalIds];
        }
      }
    }
    
    console.log("최종 테스트 ID 목록:", allTestIds);
    
    const query = `
    WITH latest_tests AS (
    SELECT
      tr.student_id,
      tr.test_template_id,
      tr.result_value,
      tr.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY tr.student_id, tr.test_template_id
        ORDER BY tr.created_at DESC
      ) AS rn
    FROM testresult tr
    WHERE tr.test_template_id IN (${allTestIds.map(() => '?').join(',')})
    )
    SELECT
      s.id AS student_id,
      CONCAT(s.last_name, ' ', s.first_name) AS name,
      s.dojang_code AS dojang_code,
      d.dojang_name AS studio_name,
      YEAR(CURDATE()) - YEAR(s.birth_date) AS age,
      s.belt_rank AS belt_rank,
      b.belt_color AS belt_color,
      CASE
        WHEN tt.evaluation_type = 'time' THEN
          CONCAT(
            FLOOR(latest_tests.result_value / 60), 
            "'", 
            LPAD(MOD(latest_tests.result_value, 60), 2, '0'), 
            '"'
          )
        ELSE latest_tests.result_value
      END AS count,
      tt.test_name,
      tt.evaluation_type
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
      CASE
        WHEN tt.evaluation_type = 'time' THEN latest_tests.result_value
        ELSE -latest_tests.result_value
      END
  `;
  
    
    // 파라미터 형식 주의
    const params = dojangOnly
    ? [...allTestIds, dojang_code]  // 각 ID를 개별 파라미터로 전달
    : [...allTestIds];
    
    console.log("실행할 쿼리:", query);
    console.log("파라미터:", params);
    
    const [rankingData] = await db.execute(query, params);
    
    console.log("결과 데이터 개수:", rankingData.length);
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
          WHEN evaluation_type = 'attempt' AND target_count IS NOT NULL
            THEN CONCAT(test_name, ' ', target_count, ' attempts')
          WHEN evaluation_type = 'break' AND target_count IS NOT NULL
            THEN CONCAT(test_name, ' ', target_count, ' boards')
          ELSE test_name
        END AS standardized_test_name
      FROM test_template
      WHERE evaluation_type IN ('count', 'time', 'attempt', 'break')
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


router.get('/similar-tests', verifyToken, async (req, res) => {
  try {
    const { group_id } = req.query;
    
    if (!group_id) {
      return res.status(400).json({ message: 'Group ID is required' });
    }
    
    // group_id에서 정보 추출 (예: "agility-forward-time-22" -> test_name: "agility forward", evaluation_type: "time", target_count: 22)
    const parts = group_id.split('-');
    if (parts.length < 3) {
      return res.status(400).json({ message: 'Invalid group ID format' });
    }
    
    // 마지막 부분이 숫자인지 확인
    const lastPart = parts[parts.length - 1];
    const secondLastPart = parts[parts.length - 2];
    
    let evaluation_type, value;
    
    // evaluation_type과 value 추출
    if (!isNaN(lastPart)) {
      // 마지막이 숫자인 경우 (예: "agility-forward-time-22")
      evaluation_type = secondLastPart;
      value = parseInt(lastPart);
    } else {
      // 마지막이 숫자가 아닌 경우 (예: "agility-forward-time")
      evaluation_type = lastPart;
      value = null;
    }
    
    // test_name 추출 (evaluation_type과 value 부분 제외)
    const testNameParts = parts.slice(0, -2); // evaluation_type과 value 제외
    const test_name = testNameParts.join(' ');
    
    // 2. 유사한 테스트 찾기 (평가 유형과 value가 동일)
    const similarTestsQuery = `
      SELECT id, dojang_code, test_name, evaluation_type, duration, target_count,
      CASE
        WHEN evaluation_type = 'count' AND duration IS NOT NULL
          THEN CONCAT(test_name, ' for ', duration, ' Seconds')
        WHEN evaluation_type = 'time' AND target_count IS NOT NULL
          THEN CONCAT(test_name, ' ', target_count, ' times')
        WHEN evaluation_type = 'attempt' AND target_count IS NOT NULL
          THEN CONCAT(test_name, ' ', target_count, ' attempts')
        WHEN evaluation_type = 'break' AND target_count IS NOT NULL
          THEN CONCAT(test_name, ' ', target_count, ' boards')
        ELSE test_name
      END AS standardized_test_name
      FROM test_template
      WHERE evaluation_type = ?
        AND (
          (evaluation_type = 'count' AND duration = ?) OR
          (evaluation_type = 'time' AND target_count = ?) OR
          (evaluation_type = 'attempt' AND target_count = ?) OR
          (evaluation_type = 'break' AND target_count = ?)
        )
    `;
    
    const [similarTests] = await db.query(
      similarTestsQuery,
      [evaluation_type, value, value, value, value]
    );
    
    // 3. 이름 유사도 비교를 위한 처리
    const normalizeTestName = (name) => {
      return name.toLowerCase()
        .replace(/[^\w\s]/g, '')  // 특수문자 제거
        .replace(/\s+/g, ' ')     // 여분 공백 제거
        .trim();                  // 앞뒤 공백 제거
    };
    
    const normalizedSelectedName = normalizeTestName(test_name);
    
    // 유사한 테스트 필터링 (이름 유사도 확인)
    const matchingTests = similarTests.filter(t => {
      const normalizedName = normalizeTestName(t.test_name);
      
      // 1. 정확히 일치
      if (normalizedName === normalizedSelectedName) return true;
      
      // 2. 부분 문자열 포함
      if (normalizedName.includes(normalizedSelectedName) || 
          normalizedSelectedName.includes(normalizedName)) return true;
      
      // 3. 키워드 매칭 (kick, punch 등 주요 키워드 포함)
      const keywords = ['kick', 'punch', 'push', 'squat', 'jump', 'run', 'agility'];
      const matchedKeywords = keywords.filter(keyword => 
        normalizedName.includes(keyword) && normalizedSelectedName.includes(keyword)
      );
      
      return matchedKeywords.length > 0;
    });
    
    res.json(matchingTests);
    
  } catch (error) {
    console.error('Error finding similar tests:', error);
    res.status(500).json({ message: 'Failed to find similar tests' });
  }
});

router.get('/grouped-objective-tests', verifyToken, async (req, res) => {
  try {
    const { dojang_code } = req.user;

    // 1. 테스트 항목 가져오기
    const [tests] = await db.query(`
      SELECT id, test_name, evaluation_type, duration, target_count,
        CASE
          WHEN evaluation_type = 'count' AND duration IS NOT NULL
            THEN CONCAT(test_name, ' for ', duration, ' Seconds')
          WHEN evaluation_type = 'time' AND target_count IS NOT NULL
            THEN CONCAT(test_name, ' ', target_count, ' times')
          WHEN evaluation_type = 'attempt' AND target_count IS NOT NULL
            THEN CONCAT(test_name, ' ', target_count, ' attempts')
          WHEN evaluation_type = 'break' AND target_count IS NOT NULL
            THEN CONCAT(test_name, ' ', target_count, ' boards')
          ELSE test_name
        END AS standardized_test_name
      FROM test_template
      WHERE evaluation_type IN ('count', 'time', 'attempt', 'break')
        AND dojang_code = ?
      ORDER BY standardized_test_name ASC
    `, [dojang_code]);

    // 이름 정규화 함수
    const normalize = (str) => str.toLowerCase()
      .replace(/[^\w\s]/g, '') // 특수문자 제거
      .replace(/\s+/g, ' ')    // 여분 공백 제거
      .trim();

    // group_id 생성
    const createGroupId = (name, type, duration, target_count) => {
      const value = duration !== null ? duration : target_count;
      return `${normalize(name)}-${type}-${value}`.replace(/\s+/g, '-');
    };

    const groups = [];

    for (const test of tests) {
      const normName = normalize(test.test_name);

      const existingGroup = groups.find(group =>
        group.evaluation_type === test.evaluation_type &&
        group.duration === test.duration &&
        group.target_count === test.target_count &&
        normalize(group.test_name) === normName
      );

      if (existingGroup) {
        existingGroup.items.push(test);
      } else {
        groups.push({
          group_id: createGroupId(test.test_name, test.evaluation_type, test.duration, test.target_count),
          test_name: test.test_name,
          evaluation_type: test.evaluation_type,
          duration: test.duration,
          target_count: test.target_count,
          standardized_name: test.standardized_test_name,
          items: [test]
        });
      }
    }

    res.json(groups);
  } catch (error) {
    console.error('Error grouping tests:', error);
    res.status(500).json({ message: 'Failed to group objective tests' });
  }
});






module.exports = router;
