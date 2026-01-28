const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 파일
const nodemailer = require('nodemailer');

// 인증 없이 누구나 접근 가능한 스케줄 API
router.get('/public-get-schedule', async (req, res) => {
  const { dojang_code } = req.query;
  if (!dojang_code) {
    return res.status(400).json({ message: 'dojang_code is required' });
  }

  try {
    const query = `
      SELECT id, time, Mon, Tue, Wed, Thur, Fri, Sat, dojang_code, sort_order
      FROM schedule
      WHERE dojang_code = ?
      ORDER BY sort_order ASC, id ASC
    `;
    const [results] = await db.query(query, [dojang_code]);

    // 빈 배열도 200으로
    res.setHeader('Cache-Control', 'public, max-age=60'); // 선택: 60초 캐시
    return res.status(200).json(results || []);
  } catch (err) {
    console.error('Error fetching schedule:', err);
    return res.status(500).json({ message: 'Error fetching schedule' });
  }
});

  router.post('/send-trial-email', async (req, res) => {
    const { name, age, experience, belt, phone } = req.body;
  
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
  
      const mailOptions = {
        from: 'saehan.jh@gmail.com',
        to: 'jcworldtkd.jh@gmail.com',
        subject: 'New Free Trial Class Request',
        text: `
New Trial Request:
- Name: ${name}
- Age: ${age}
- Phone: ${phone || 'N/A'}
- Experience: ${experience}
- Belt: ${belt || 'N/A'}
        `
      };
  
      await transporter.sendMail(mailOptions);
  
      res.status(200).json({ message: 'Email sent' });
    } catch (err) {
      console.error('Error sending email:', err);
      res.status(500).json({ message: 'Email failed', error: err.message });
    }
  });

  router.get('/public/grouped-objective-tests', async (req, res) => {
    const { dojang_code } = req.query;
  
    if (!dojang_code) {
      return res.status(400).json({ message: 'Dojang code is required' });
    }
  
    try {
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
  
      // 그룹화 로직 (유사한 테스트끼리 묶기)
      // 대소문자 구분을 없애기 위해 toLowerCase() 추가 권장
      const normalize = (str) => (str || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      
      const createGroupId = (name, type, duration, target_count) => {
          const value = duration !== null ? duration : target_count;
          return `${normalize(name)}-${type}-${value}`.replace(/\s+/g, '-');
      };
  
      const groups = [];
      for (const test of tests) {
        const normName = normalize(test.test_name);
        
        // 기존 그룹 찾기
        const existingGroup = groups.find(group =>
          group.evaluation_type === test.evaluation_type &&
          group.duration === test.duration &&
          group.target_count === test.target_count &&
          normalize(group.test_name) === normName
        );

        if (existingGroup) {
          existingGroup.items.push(test);
        } else {
          // 🔥 [수정됨] 그룹을 생성할 때, 비교에 필요한 기준 데이터들을 꼭 같이 저장해야 합니다!
          groups.push({
            group_id: createGroupId(test.test_name, test.evaluation_type, test.duration, test.target_count),
            standardized_name: test.standardized_test_name,
            
            // 아래 4가지 필드가 없어서 비교가 불가능했었습니다. 추가해주세요.
            test_name: test.test_name,
            evaluation_type: test.evaluation_type,
            duration: test.duration,
            target_count: test.target_count,

            items: [test]
          });
        }
      }
      res.json(groups);
    } catch (error) {
      console.error('Error fetching public tests:', error);
      res.status(500).json({ message: 'Failed to fetch public tests' });
    }
  });
  
  // ==========================================
  // 4. [공개용] 실제 랭킹 데이터 조회 (신규 추가)
  // ==========================================
  router.get('/public/ranking/:groupId', async (req, res) => {
    const { groupId } = req.params;
    const { dojang_code } = req.query;
  
    if (!dojang_code) {
      return res.status(400).json({ message: 'Dojang code is required' });
    }
  
    try {
      // 1. group_id 파싱
      const parts = groupId.split('-');
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
      
      const test_name = parts.slice(0, -2).join(' ');
      const normalize = (str) => str.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      const normalizedTestName = normalize(test_name);
  
      // 2. 해당하는 모든 test_template_id 찾기
      const testTemplateQuery = `
        SELECT id FROM test_template 
        WHERE evaluation_type = ? 
          AND LOWER(REPLACE(test_name, ' ', '')) = LOWER(REPLACE(?, ' ', ''))
          AND (
            (evaluation_type = 'count' AND duration = ?) OR
            (evaluation_type = 'time' AND target_count = ?) OR
            (evaluation_type = 'attempt' AND target_count = ?) OR
            (evaluation_type = 'break' AND target_count = ?)
          )
      `;
      
      // db.query 사용 (db.execute 대신)
      const [testTemplates] = await db.query(testTemplateQuery, [evaluation_type, normalizedTestName, value, value, value, value]);
      
      if (!testTemplates.length) {
          // 테스트가 없으면 빈 배열 반환 (에러 아님)
          return res.json([]); 
      }
      
      const allTestIds = testTemplates.map(t => t.id);
  
      // 3. 랭킹 데이터 조회 (이름 마스킹 처리됨)
      const query = `
      WITH latest_tests AS (
        SELECT tr.student_id, tr.test_template_id, tr.result_value, tr.created_at,
          ROW_NUMBER() OVER (PARTITION BY tr.student_id, tr.test_template_id ORDER BY tr.created_at DESC) AS rn
        FROM testresult tr
        WHERE tr.test_template_id IN (?)
      )
      SELECT
        s.id AS student_id,
        CONCAT(s.last_name, ' ', s.first_name) AS name, 
        YEAR(CURDATE()) - YEAR(s.birth_date) AS age,
        b.belt_color AS belt_color,
        d.dojang_name AS studio_name,
        CASE
          WHEN tt.evaluation_type = 'time' THEN
            CONCAT(FLOOR(latest_tests.result_value / 60), "'", LPAD(MOD(latest_tests.result_value, 60), 2, '0'), '"')
          ELSE latest_tests.result_value
        END AS count,
        tt.evaluation_type
      FROM students s
      JOIN latest_tests ON s.id = latest_tests.student_id AND latest_tests.rn = 1
      JOIN test_template tt ON latest_tests.test_template_id = tt.id
      JOIN beltsystem b ON s.belt_rank = b.belt_rank AND s.dojang_code = b.dojang_code
      JOIN dojangs d ON s.dojang_code = d.dojang_code
      WHERE s.dojang_code = ? 
      ORDER BY
        CASE WHEN tt.evaluation_type = 'time' THEN latest_tests.result_value ELSE -latest_tests.result_value END
      LIMIT 50
      `;
  
      // IN (?) 에 배열을 넣기 위해 [allTestIds] 로 감쌈
      const params = [allTestIds, dojang_code];
      
      const [rankingData] = await db.query(query, params);
      res.json(rankingData);
  
    } catch (error) {
      console.error('Error fetching public ranking:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  module.exports = router;