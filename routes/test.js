const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 파일
const verifyToken = require('../middleware/verifyToken');
const client = require('../modules/squareClient'); // Square 클라이언트 가져오기
const paymentsApi = client.paymentsApi; // paymentsApi 사용
const { createSquareClientWithToken } = require('../modules/squareClient'); // ✅ 오너별 Square 클라이언트 생성 함수

// 벨트별 테스트 조건을 가져오는 엔드포인트
router.get('/get-test-condition/:belt_rank', verifyToken, async (req, res) => {
  const { belt_rank } = req.params;
  const belt_rank_num = parseInt(belt_rank, 10); // 문자열을 숫자로 변환
  const { dojang_code } = req.user; // 토큰에서 도장 코드 추출
  
  try {
    // belt_rank가 belt_min_rank와 belt_max_rank 사이에 있는지 확인
    const [result] = await db.execute(
      'SELECT attendance_required, test_type FROM testcondition WHERE ? BETWEEN belt_min_rank AND belt_max_rank AND dojang_code = ?',
      [belt_rank_num, dojang_code]
    );
    
    if (result.length > 0) {
      // 디버깅을 위한 로그 추가
      console.log('테스트 조건 DB 결과:', result[0]);
      // 출석 일수와 테스트 타입을 함께 반환 (test_type이 null이면 'standard'를 기본값으로)
      res.json({
        attendance_required: result[0].attendance_required,
        test_type: result[0].test_type || 'standard' // null이면 기본값 설정
      });
    } else {
      res.status(404).json({ message: 'Test condition not found for this belt rank and dojang code' });
    }
  } catch (error) {
    console.error('Error fetching test condition:', error);
    res.status(500).json({ message: 'Failed to fetch test condition' });
  }
});


// 자녀 목록 가져오기 API
router.get('/child', verifyToken, async (req, res) => {
    const { dojang_code } = req.user; // 토큰에서 도장 코드 추출
  
    try {
      const query = `
        SELECT id, parent_id, first_name, last_name, birth_date, gender, belt_rank
        FROM students
        WHERE dojang_code = ?
      `;
      const [rows] = await db.query(query, [dojang_code]);
      res.status(200).json(rows);
    } catch (error) {
      console.error("Error fetching children data:", error);
      res.status(500).json({ message: "Failed to fetch children data" });
    }
  });

// 특정 벨트에서 출석한 횟수 조회 API
router.get('/get-attendance/:childId/:beltRank', verifyToken, async (req, res) => {
  const { childId, beltRank } = req.params;
  const { dojang_code } = req.user; // 토큰에서 도장 코드 추출

  try {
    const query = `
      SELECT COUNT(*) AS attendance_count
      FROM attendance
      WHERE student_id = ? AND belt_rank = ? AND dojang_code = ?
    `;
    const [rows] = await db.query(query, [childId, beltRank, dojang_code]);

    res.status(200).json({ attendance: rows[0].attendance_count });
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    res.status(500).json({ message: "Failed to fetch attendance data" });
  }
});



router.get('/get-test-schedule/:testType', verifyToken, async (req, res) => {
  const { testType } = req.params;
  const { dojang_code } = req.user;

  try {
    // class_details에서 testType과 dojangCode에 맞는 day와 time을 조회
    const [classDetailResult] = await db.execute(
      'SELECT day, time FROM class_details WHERE classname = ? AND dojang_code = ? LIMIT 1',
      [testType, dojang_code]
    );

    // 일치하는 class_detail이 없는 경우
    if (classDetailResult.length === 0) {
      return res.status(404).json({ message: 'No matching class schedule found for the given test type and dojang code' });
    }

    const { day, time } = classDetailResult[0];

    // day와 time을 포함하여 응답
    res.json({ day, time });
  } catch (error) {
    console.error('Error fetching test schedule:', error);
    res.status(500).json({ message: 'Failed to fetch test schedule' });
  }
});


router.post('/submit-test-payment', verifyToken, async (req, res) => {
  const {
    card_id,
    student_id,
    amount,
    idempotencyKey,
    currency,
    parent_id,
    customer_id,
  } = req.body;
  const { dojang_code } = req.user;

  if (!card_id || !amount || !customer_id) {
    return res.status(400).json({ message: 'Missing required fields: card_id, amount, or customer_id.' });
  }

  try {
    // ✅ 도장 오너의 Square access_token과 location_id 가져오기
    const [ownerInfo] = await db.query(
      "SELECT square_access_token, location_id FROM owner_bank_accounts WHERE dojang_code = ?",
      [dojang_code]
    );

    if (!ownerInfo.length) {
      return res.status(400).json({ message: "No Square account connected for this dojang." });
    }

    const ownerAccessToken = ownerInfo[0].square_access_token;
    const locationId = ownerInfo[0].location_id;

    // ✅ 오너의 Access Token으로 Square Client 생성
    const squareClient = createSquareClientWithToken(ownerAccessToken);
    const paymentsApi = squareClient.paymentsApi;

    // ✅ Square 결제 요청
    const paymentRequest = {
      sourceId: card_id,
      amountMoney: {
        amount: Math.round(amount), // 센트 단위
        currency: currency || 'USD',
      },
      idempotencyKey,
      customerId: customer_id,
      locationId: locationId, // ✅ 위치 정보도 포함!
    };

    console.log("🔁 Square Payment Request:", paymentRequest);

    const paymentResponse = await paymentsApi.createPayment(paymentRequest);

    if (!paymentResponse.result.payment || paymentResponse.result.payment.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'Square payment failed', details: paymentResponse.result });
    }

    console.log('✅ Square Payment Response:', paymentResponse.result);

    // ✅ DB에 결제 정보 저장
    const [result] = await db.execute(
      'INSERT INTO test_payments (student_id, amount, idempotency_key, currency, status, dojang_code, parent_id, card_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        student_id,
        amount / 100, // 달러 단위로 저장
        idempotencyKey,
        currency || 'USD',
        'completed',
        dojang_code,
        parent_id,
        card_id,
      ]
    );

    res.status(201).json({ message: 'Payment successful and data saved' });
  } catch (error) {
    console.error('❌ Error processing test payment:', error);
    res.status(500).json({ message: 'Payment processing failed', error: error.message });
  }
});








router.post('/add-test-entry', verifyToken, async (req, res) => {
  const { student_id, test_name, test_time } = req.body;
  const { dojang_code } = req.user;
  console.log("Received test_name:", req.body.test_name);
  try {
    const [result] = await db.execute(
      'INSERT INTO testlist (student_id, test_name, test_time, dojang_code) VALUES (?, ?, ?, ?)',
      [student_id, test_name, test_time, dojang_code]
    );

    if (result.affectedRows > 0) {
      res.status(201).json({ message: 'Test entry added successfully!' });
    } else {
      res.status(500).json({ message: 'Failed to add test entry' });
    }
  } catch (error) {
    console.error('Error adding test entry:', error);
    res.status(500).json({ message: 'Failed to add test entry' });
  }
});

// test_type 목록 가져오기
router.get('/get-test-names', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;

  try {
    // `class_details` 테이블에서 `type = 'test'`인 경우 `classname` 가져오기
    const [classDetailsResults] = await db.execute(
      'SELECT DISTINCT classname FROM class_details WHERE dojang_code = ? AND type = "test"',
      [dojang_code]
    );

    // 가져온 `classname` 목록을 반환
    const testNames = classDetailsResults.map(row => row.classname);

    res.json(testNames);
  } catch (error) {
    console.error('Error fetching test names:', error);
    res.status(500).json({ message: 'Failed to fetch test types' });
  }
});


// 특정 test_type에 속한 학생 목록 가져오기
router.get('/get-students-by-test-type/:testType', verifyToken, async (req, res) => {
  let { testType } = req.params;
  const { dojang_code } = req.user;

  // ✅ testType이 undefined이면 400 에러 반환
  if (!testType || testType === "undefined") {
    return res.status(400).json({ message: "Invalid test type provided" });
  }

  try {
    // ✅ 학생의 현재 벨트, 다음 벨트 색상 및 벨트 사이즈 정보를 가져오는 쿼리
    const [students] = await db.execute(
      `SELECT DISTINCT 
          t.student_id, 
          s.first_name, 
          s.last_name, 
          s.belt_rank, 
          s.belt_size, 
          b_current.belt_color AS current_belt,
          b_next.belt_color AS test_belt
       FROM testlist t 
       INNER JOIN students s ON t.student_id = s.id 
       INNER JOIN testcondition tc ON t.test_name = tc.test_type 
       LEFT JOIN beltsystem b_current ON s.belt_rank = b_current.belt_rank AND b_current.dojang_code = ?
       LEFT JOIN beltsystem b_next ON s.belt_rank + 1 = b_next.belt_rank AND b_next.dojang_code = ?
       WHERE tc.test_type = ? 
       AND t.dojang_code = ? 
       AND tc.dojang_code = ?`,
      [dojang_code, dojang_code, testType || null, dojang_code, dojang_code] // ✅ `testType || null`로 `undefined` 방지
    );

    // ✅ 학생 목록이 비어 있을 경우 메시지 반환
    if (students.length === 0) {
      return res.status(200).json({ message: "No students found for this test type." });
    }

    // ✅ 결과를 클라이언트로 전송
    res.json(students);
  } catch (error) {
    console.error('Error fetching students for test type:', error);
    res.status(500).json({ message: 'Failed to fetch students for test type' });
  }
});




// 특정 학생의 평가 완료 시 testlist에서 삭제하는 API
router.delete('/delete-student/:studentId/:testType', verifyToken, async (req, res) => {
  const { studentId, testType } = req.params;
  const { dojang_code } = req.user;

  try {
    // 해당 학생의 데이터를 testlist에서 삭제
    const [result] = await db.execute(
      'DELETE FROM testlist WHERE student_id = ? AND test_name = ? AND dojang_code = ?',
      [studentId, testType, dojang_code]
    );

    if (result.affectedRows > 0) {
      res.json({ message: 'Student evaluation completed and removed from test list.' });
    } else {
      res.status(404).json({ message: 'Student not found in test list.' });
    }
  } catch (error) {
    console.error('Error removing student from test list:', error);
    res.status(500).json({ message: 'Failed to remove student from test list' });
  }
});

router.post('/save-evaluation', verifyToken, async (req, res) => {
  const { student_id, evaluationData } = req.body;
  const { dojang_code } = req.user;

  // ✅ 요청 데이터 로그 추가
  console.log("📢 Received student_id:", student_id);
  console.log("📢 Received evaluationData:", evaluationData);

  if (!student_id || !evaluationData || !Array.isArray(evaluationData)) {
    console.error("🚨 Invalid evaluation data received:", req.body);
    return res.status(400).json({ message: 'Invalid evaluation data' });
  }

  try {
    const values = evaluationData.map(({ test_template_id, result_value }) => {
      if (!test_template_id || result_value === undefined) {
        console.error("🚨 Missing test_template_id or result_value:", { test_template_id, result_value });
        throw new Error("Invalid evaluation data format");
      }
      return [student_id, test_template_id, result_value, dojang_code];
    });

    console.log("✅ Processed values for INSERT:", values);

    // ✅ 평가 데이터 저장
    await db.query(
      `INSERT INTO testresult (student_id, test_template_id, result_value, dojang_code) VALUES ?`,
      [values]
    );

    res.json({ message: 'Evaluation saved successfully' });
  } catch (error) {
    console.error('❌ Error saving evaluation:', error);
    res.status(500).json({ message: 'Failed to save evaluation', error: error.message });
  }
});



// 학생 삭제 API
router.delete('/delete-student/:studentId/:testType', verifyToken, async (req, res) => {
  const { studentId, testType } = req.params;
  const { dojang_code } = req.user;

  try {
    // testlist 테이블에서 해당 학생 삭제
    await db.execute(
      `DELETE FROM testlist WHERE student_id = ? AND test_name = ? AND dojang_code = ?`,
      [studentId, testType, dojang_code]
    );
    res.json({ message: 'Student removed from test list' });
  } catch (error) {
    console.error('Error deleting student from test list:', error);
    res.status(500).json({ message: 'Failed to remove student from test list' });
  }
});

// 벨트 랭크 업데이트 API
router.put('/update-belt-rank', verifyToken, async (req, res) => {
  const { student_id } = req.body; // student_id만 필요
  const { dojang_code } = req.user;

  try {
    const [result] = await db.execute(
      `UPDATE students SET belt_rank = belt_rank + 1 WHERE id = ? AND dojang_code = ?`,
      [student_id, dojang_code]
    );

    if (result.affectedRows > 0) {
      res.json({ message: 'Belt rank updated successfully' });
    } else {
      res.status(404).json({ message: 'Student not found or not associated with this dojang' });
    }
  } catch (error) {
    console.error('Error updating belt rank:', error);
    res.status(500).json({ message: 'Failed to update belt rank' });
  }
});

// 벨트 수량 감소 API (테스트 완료 후 다음 벨트의 수량 감소)
router.put('/update-belt-quantity', verifyToken, async (req, res) => {
  const { student_id } = req.body;
  const { dojang_code } = req.user;

  try {
    console.log(`🔎 Received belt update request for student ${student_id} in dojang ${dojang_code}`);

    // ✅ 1️⃣ 학생의 현재 belt_rank 및 belt_size 가져오기
    const [student] = await db.query(
      `SELECT belt_rank, belt_size FROM students WHERE id = ? AND dojang_code = ?`,
      [student_id, dojang_code]
    );

    if (student.length === 0) {
      console.log(`⚠️ No student found with ID ${student_id}`);
      return res.status(404).json({ message: 'Student not found' });
    }

    let { belt_rank, belt_size } = student[0];

    console.log(`✅ Student ${student_id} has new belt_rank ${belt_rank} and belt_size ${belt_size}`);

    // ✅ 2️⃣ 승급한 벨트의 `belt_id` 가져오기
    const [promotedBelt] = await db.query(
      `SELECT id FROM beltsystem WHERE belt_rank = ? AND dojang_code = ? LIMIT 1`,
      [belt_rank, dojang_code]
    );

    if (promotedBelt.length === 0 || !promotedBelt[0]?.id) {
      console.log(`⚠️ Promoted belt rank ${belt_rank} not found in beltsystem`);
      return res.status(404).json({ message: `Promoted belt rank ${belt_rank} not found in beltsystem` });
    }

    const promotedBeltId = promotedBelt[0].id;
    console.log(`✅ Promoted belt ID: ${promotedBeltId}`);

    // ✅ 3️⃣ belt_sizes 테이블에서 해당 벨트 사이즈 존재 여부 확인
    const [beltSizeData] = await db.query(
      `SELECT quantity FROM belt_sizes WHERE belt_id = ? AND size = ? AND dojang_code = ? LIMIT 1`,
      [promotedBeltId, belt_size, dojang_code]
    );

    if (beltSizeData.length === 0) {
      console.log(`⚠️ No matching belt size found for belt ID ${promotedBeltId} with size ${belt_size} in dojang ${dojang_code}`);
      return res.status(404).json({ message: 'No matching belt size found in belt_sizes' });
    }

    const currentQuantity = beltSizeData[0].quantity;

    // ✅ 4️⃣ 벨트 수량이 0이면 업데이트 방지
    if (currentQuantity <= 0) {
      console.log(`⚠️ Belt size ${belt_size} for belt ID ${promotedBeltId} has no available stock.`);
      return res.status(400).json({ message: 'Insufficient belt stock' });
    }

    // ✅ 5️⃣ belt_sizes 테이블에서 해당 벨트 사이즈의 quantity 감소
    const updateQuery = `
      UPDATE belt_sizes 
      SET quantity = quantity - 1
      WHERE belt_id = ? AND size = ? AND dojang_code = ? AND quantity > 0
    `;

    const [updateResult] = await db.query(updateQuery, [promotedBeltId, belt_size, dojang_code]);

    if (updateResult.affectedRows === 0) {
      console.log(`⚠️ Failed to update belt quantity for belt ID ${promotedBeltId} and size ${belt_size} in dojang ${dojang_code}`);
      return res.status(400).json({ message: 'Failed to update belt quantity' });
    }

    console.log(`✅ Belt quantity updated successfully for belt ID ${promotedBeltId} and size ${belt_size} in dojang ${dojang_code}`);
    res.status(200).json({ success: true, message: 'Belt quantity updated successfully' });
  } catch (error) {
    console.error('❌ Error updating belt quantity:', error);
    res.status(500).json({ message: 'Error updating belt quantity' });
  }
});

// test-template 생성 API
router.post('/test-template', verifyToken, async (req, res) => {
  const { test_name, evaluation_type, test_type, duration, target_count } = req.body;
  const { dojang_code } = req.user;
  
  try {
    const [result] = await db.query(
      `INSERT INTO test_template (dojang_code, test_name, evaluation_type, test_type, duration, target_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dojang_code, test_name, evaluation_type, test_type, 
       evaluation_type === 'count' ? duration : null, 
       evaluation_type === 'time' ? target_count : null]
    );
    
    res.json({ message: 'Test template created successfully', id: result.insertId });
  } catch (error) {
    console.error('❌ Error creating test template:', error);
    res.status(500).json({ message: 'Failed to create test template' });
  }
});

// 도장 오너가 생성한 평가 기준 목록 가져오기
router.get('/test-templates', verifyToken, async (req, res) => {
  const { dojang_code } = req.user; // 토큰에서 추출된 도장 코드
  const { test_type } = req.query; // URL에서 test_type 가져오기
  
  try {
    let query = `
      SELECT
        id,
        test_name,
        evaluation_type,
        test_type,
        CASE
          WHEN evaluation_type = 'count' THEN duration
          WHEN evaluation_type = 'time' THEN target_count
          ELSE NULL
        END AS value,
        created_at
      FROM test_template
      WHERE dojang_code = ?
    `;
    
    const queryParams = [dojang_code];
    
    // test_type 필터가 있으면 WHERE 조건 추가
    if (test_type) {
      query += ` AND test_type = ?`;
      queryParams.push(test_type);
    }
    
    query += ` ORDER BY id ASC`;
    
    const [testTemplates] = await db.query(query, queryParams);
    res.json(testTemplates);
  } catch (error) {
    console.error('❌ Error fetching test templates:', error);
    res.status(500).json({ message: 'Failed to fetch test templates' });
  }
});

// test-template 업데이트 API
router.put('/test-template/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { test_name, evaluation_type, test_type, duration, target_count } = req.body;
  const { dojang_code } = req.user;
  
  // ✅ 필수 값 검증
  if (!test_name || !evaluation_type) {
    return res.status(400).json({ message: 'Name and evaluation type are required' });
  }
  
  // ✅ `count`일 경우 `duration` 필수, `time`일 경우 `target_count` 필수
  if (evaluation_type === 'count' && (duration === undefined || duration === null)) {
    return res.status(400).json({ message: 'Duration is required for count-based tests' });
  }
  
  if (evaluation_type === 'time' && (target_count === undefined || target_count === null)) {
    return res.status(400).json({ message: 'Target count is required for time-based tests' });
  }
  
  try {
    console.log("📢 Updating Test Template:", { id, test_name, evaluation_type, test_type, duration, target_count, dojang_code });
    
    const [result] = await db.query(
      `UPDATE test_template
       SET test_name = ?, evaluation_type = ?, test_type = ?, duration = ?, target_count = ?
       WHERE id = ? AND dojang_code = ?`,
      [test_name, evaluation_type, test_type, 
       evaluation_type === 'count' ? duration : null, 
       evaluation_type === 'time' ? target_count : null, 
       id, dojang_code]
    );
    
    // ✅ 업데이트된 행이 없는 경우 (예: 존재하지 않는 id)
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Test template not found or no changes made' });
    }
    
    res.json({ message: 'Test template updated successfully' });
  } catch (error) {
    console.error('❌ Error updating test template:', error);
    res.status(500).json({ message: 'Failed to update test template' });
  }
});

// test-template 삭제 API
router.delete('/test-template/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { dojang_code } = req.user;
  
  console.log('👉 DELETE 요청: ', { id, dojang_code });
  
  try {
    await db.query(`DELETE FROM test_template WHERE id = ? AND dojang_code = ?`, [id, dojang_code]);
    res.json({ message: 'Test template deleted successfully' });
  } catch (error) {
    console.error('Error deleting test template:', error);
    res.status(500).json({ message: 'Failed to delete test template' });
  }
});



module.exports = router;
