const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 파일
const nodemailer = require('nodemailer');

// 인증 없이 누구나 접근 가능한 스케줄 API
// 백엔드 API
router.get('/public-get-schedule', async (req, res) => {
  const { dojang_code } = req.query;
  if (!dojang_code) {
    return res.status(400).json({ message: 'dojang_code is required' });
  }

  try {
    // 🔥 중요: DB 컬럼명이 Thur 이므로, 여기서도 반드시 Thur 라고 써야 합니다.
    const query = `
      SELECT id, time, Mon, Tue, Wed, Thur, Fri, Sat, dojang_code, sort_order
      FROM schedule
      WHERE dojang_code = ?
      ORDER BY sort_order ASC, id ASC
    `;
    const [results] = await db.query(query, [dojang_code]);

    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json(results || []);
  } catch (err) {
    console.error('Error fetching schedule:', err);
    return res.status(500).json({ message: 'Error fetching schedule' });
  }
});

  router.post('/send-trial-email', async (req, res) => {
    const { name, age, experience, belt, phone, className, classDay, classTime, classDate } = req.body;
  
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
  
      const classLine = className
        ? `- Requested Class: ${className} (${classDay || ''} ${classTime || ''})\n- Requested Date: ${classDate || 'N/A'}`
        : '- Requested Class: N/A (no matching class selected)';

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
${classLine}
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
  // 4. [공개용] 실제 랭킹 데이터 조회 (수정됨)
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
      
      const [testTemplates] = await db.query(testTemplateQuery, [evaluation_type, normalizedTestName, value, value, value, value]);
      
      if (!testTemplates.length) {
          return res.json([]); 
      }
      
      const allTestIds = testTemplates.map(t => t.id);
  
      // 3. 랭킹 데이터 조회
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
        latest_tests.result_value AS raw_score,
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
      LIMIT 10  -- [수정 완료] 50 -> 10으로 변경하여 상위 10명만 가져옴
      `;
  
      const params = [allTestIds, dojang_code];
      
      const [rankingData] = await db.query(query, params);
  
      // 4. 공동 순위 계산
      const rankedData = [];
  
      for (let i = 0; i < rankingData.length; i++) {
        const item = { ...rankingData[i] };
        
        if (i === 0) {
          item.rank = 1;
        } else {
          const prevItem = rankedData[i - 1];
          
          // 원본 점수(raw_score) 비교
          if (Number(item.raw_score) === Number(prevItem.raw_score)) {
            item.rank = prevItem.rank; 
          } else {
            item.rank = i + 1; 
          }
        }
        
        rankedData.push(item);
      }
  
      res.json(rankedData);
  
    } catch (error) {
      console.error('Error fetching public ranking:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

// ==========================================
// [공개용] 벨트 목록 조회 (무료 체험 신청 폼에서 사용)
// ==========================================
router.get('/public/belt-levels', async (req, res) => {
  const { dojang_code } = req.query;

  if (!dojang_code) {
    return res.status(400).json({ message: 'dojang_code is required' });
  }

  try {
    const [belts] = await db.query(
      `SELECT belt_color, belt_rank FROM beltsystem WHERE dojang_code = ? ORDER BY belt_rank ASC`,
      [dojang_code]
    );

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(belts);
  } catch (err) {
    console.error('Error fetching belt levels:', err);
    return res.status(500).json({ message: 'Error fetching belt levels' });
  }
});

// ==========================================
// [공개용] 무료 체험 신청자를 위한 클래스 추천 (로그인 불필요)
// register.js의 /recommend-classes 와 동일한 로직(classconditions + schedule 매칭)을
// 인증 없이 사용할 수 있도록 만든 공개 버전입니다.
// ==========================================
router.post('/public/recommend-classes', async (req, res) => {
  const { dojang_code, age, belt_name } = req.body;

  if (!dojang_code || age === undefined || age === null || age === '') {
    return res.status(400).json({ message: 'dojang_code and age are required' });
  }

  const numericAge = parseInt(age, 10);
  if (isNaN(numericAge)) {
    return res.status(400).json({ message: 'Invalid age value' });
  }

  try {
    // belt_name이 주어지면 belt_rank로 변환하고, 없으면 초보자(가장 낮은 랭크)로 간주합니다.
    let numericBeltRank = 1;
    if (belt_name) {
      const [beltRows] = await db.query(
        `SELECT belt_rank FROM beltsystem WHERE dojang_code = ? AND belt_color = ? LIMIT 1`,
        [dojang_code, belt_name]
      );
      if (beltRows.length > 0) {
        numericBeltRank = beltRows[0].belt_rank;
      }
    }

    // 1) 나이 / 벨트 조건에 맞는 클래스 이름 조회
    const [classConditions] = await db.query(
      `SELECT class_name FROM classconditions
       WHERE age_min <= ? AND age_max >= ?
         AND belt_min_rank <= ? AND belt_max_rank >= ?
         AND dojang_code = ?`,
      [numericAge, numericAge, numericBeltRank, numericBeltRank, dojang_code]
    );

    if (classConditions.length === 0) {
      return res.status(200).json({ classes: [] });
    }

    const classNames = classConditions.map((c) => c.class_name);

    // 2) 해당 클래스가 배정된 요일/시간(스케줄) 조회
    const [scheduleRows] = await db.query(
      `SELECT time, Mon, Tue, Wed, Thur, Fri, Sat FROM schedule WHERE dojang_code = ?`,
      [dojang_code]
    );

    const days = ['Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];
    const classes = [];

    for (const row of scheduleRows) {
      for (const day of days) {
        const cellValue = row[day];
        if (cellValue && classNames.includes(cellValue)) {
          classes.push({ class_name: cellValue, day, time: row.time });
        }
      }
    }

    return res.status(200).json({ classes });
  } catch (error) {
    console.error('Error recommending classes:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
