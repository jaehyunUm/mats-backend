const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 파일
const verifyToken = require('../middleware/verifyToken');
const { v4: uuidv4 } = require('uuid');

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


// 자녀 목록 가져오기 API (부모 전용)
router.get('/child/:parentId', verifyToken, async (req, res) => {
  const { parentId } = req.params;
  const { dojang_code } = req.user;

  try {
    const query = `
      SELECT id, parent_id, first_name, last_name, birth_date, gender, belt_rank
      FROM students
      WHERE dojang_code = ? AND parent_id = ?
    `;
    const [rows] = await db.query(query, [dojang_code, parentId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "No children found for this parent." });
    }

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
  console.log("Submit-test-payment route called");
  
  const {
    card_id,
    payment_method_id,
    student_id,
    amount,
    idempotencyKey,
    currency,
    parent_id,
    customer_id,
    boards 
  } = req.body;

  const paymentMethodId = payment_method_id || card_id;
  const amountValue = parseFloat(amount);

  if (!student_id || isNaN(amountValue) || amountValue <= 0 || !currency || !parent_id || !paymentMethodId) {
    return res.status(400).json({ success: false, message: "Missing or invalid fields" });
  }

  const { dojang_code } = req.user;
  
  // Stripe 계정 정보 확인
  const [ownerInfo] = await db.query(
    "SELECT stripe_account_id FROM owner_bank_accounts WHERE dojang_code = ?",
    [dojang_code]
  );

  if (!ownerInfo.length) {
    return res.status(400).json({ success: false, message: "No Stripe account connected." });
  }

  const connectedAccountId = ownerInfo[0].stripe_account_id;
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 학생 확인
    const [existingStudent] = await connection.query(`
      SELECT id FROM students WHERE id = ? AND dojang_code = ?
    `, [student_id, dojang_code]);

    if (!existingStudent.length) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: "Student not found" });
    }

    // ID 생성
    const mainPaymentId = uuidv4();
    const finalIdempotencyKey = idempotencyKey || uuidv4();
    const tempSourceId = `temp_${Date.now()}_${mainPaymentId}`;

    // ⭐️ 1. 송판(아이템) 총 금액 계산
    let totalBoardAmount = 0;
    if (boards && boards.length > 0) {
      for (const board of boards) {
        totalBoardAmount += parseFloat(board.price || 0);
      }
    }

    // ⭐️ 2. 전체 금액(달러)에서 송판 총 금액을 빼서 '순수 심사비' 계산
    const totalAmountDollars = amountValue / 100; 
    const pureTestFee = (totalAmountDollars - totalBoardAmount).toFixed(2); 

    // 3. 테스트 심사비 기록 (Pending) - 💡 여기서 pureTestFee 변수를 사용합니다!
    await connection.query(`
      INSERT INTO test_payments (
        student_id, amount, status, 
        dojang_code, idempotency_key, source_id, parent_id, card_id,
        payment_method, currency, payment_date
      ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, 'card', ?, NOW())
    `, [student_id, pureTestFee, dojang_code, finalIdempotencyKey, tempSourceId, parent_id, paymentMethodId, currency]);

    // 4. 송판(Board) 재고 차감 및 기록 (Pending)
    if (boards && boards.length > 0) {
      for (const board of boards) {
        const itemId = board.id;
        const { size, quantity } = board;

        // 재고 확인
        const [stockCheck] = await connection.query(`
          SELECT quantity FROM item_sizes WHERE item_id = ? AND size = ?
        `, [itemId, size]);

        if (stockCheck.length === 0 || stockCheck[0].quantity < quantity) {
          throw new Error(`Insufficient stock for board ID: ${itemId}`);
        }

        // 재고 차감
        await connection.query(`
          UPDATE item_sizes SET quantity = quantity - ? WHERE item_id = ? AND size = ?
        `, [quantity, itemId, size]);

        // 구매 기록
        await connection.query(`
          INSERT INTO item_payments 
          (student_id, item_id, size, quantity, amount, idempotency_key, source_id, payment_method, currency, payment_date, status, dojang_code, parent_id, card_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'card', ?, NOW(), 'pending', ?, ?, ?)
        `, [
          student_id, itemId, size, quantity, board.price || 0, 
          finalIdempotencyKey, 
          `temp_board_${itemId}`, 
          currency, dojang_code, parent_id, paymentMethodId
        ]);
      }
    }

    // 5. Stripe 결제 요청 - 💡 Stripe에는 전체 금액(amountValue)으로 청구합니다!
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(amountValue), 
        currency: currency.toLowerCase(),
        payment_method: paymentMethodId,
        customer: customer_id,
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' }
      },
      {
        stripeAccount: connectedAccountId,
        idempotencyKey: finalIdempotencyKey
      }
    );

    if (paymentIntent && paymentIntent.status === "succeeded") {
      // 6. 결제 성공 후 DB 상태 업데이트 (Pending -> Completed)
      
      // A. 심사비 업데이트
      await connection.query(`
        UPDATE test_payments 
        SET status = 'completed', source_id = ? 
        WHERE source_id = ? AND student_id = ?
      `, [paymentIntent.id, tempSourceId, student_id]);

      // B. 송판 구매 업데이트
      if (boards && boards.length > 0) {
        await connection.query(`
          UPDATE item_payments 
          SET status = 'completed', source_id = ? 
          WHERE idempotency_key = ? AND dojang_code = ?
        `, [paymentIntent.id, finalIdempotencyKey, dojang_code]);
      }

      await connection.commit(); // 트랜잭션 확정

      return res.status(200).json({ 
        success: true, 
        message: "Payment successful",
        payment_id: mainPaymentId
      });

    } else {
      throw new Error(`Payment failed: ${paymentIntent.status}`);
    }

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Payment Error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
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
    // ⭐️ [수정] 쿼리 맨 끝에 ORDER BY classname ASC 를 추가했습니다.
    const [classDetailsResults] = await db.execute(
      `SELECT DISTINCT classname 
       FROM class_details 
       WHERE dojang_code = ? AND type = 'test' 
       ORDER BY classname ASC`,
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
  const { student_id, evaluationData, test_type } = req.body;
  const { dojang_code } = req.user;
  
  // 요청 데이터 로그 추가
  console.log("📢 Received student_id:", student_id);
  console.log("📢 Received evaluationData:", evaluationData);
  console.log("📢 Received test_type:", test_type);
  
  if (!student_id || !evaluationData || !Array.isArray(evaluationData) || evaluationData.length === 0) {
    console.error("🚨 Invalid evaluation data received:", req.body);
    return res.status(400).json({ message: 'Invalid evaluation data' });
  }
  
  try {
    // 트랜잭션 시작
    await db.query('START TRANSACTION');
    
    // 기존 데이터 삭제하는 코드 제거 (데이터를 누적하기 위해)
    
    // 새 데이터 삽입
    const values = evaluationData.map(({ test_template_id, result_value }) => {
      // 타입 검증 및 변환
      const templateId = Number(test_template_id);
      const resultValue = String(result_value).trim(); // 문자열로 통일
      
      if (isNaN(templateId) || !resultValue) {
        console.error("🚨 Invalid data format:", { test_template_id, result_value });
        throw new Error("Invalid evaluation data format");
      }
      
      return [student_id, templateId, resultValue, dojang_code, test_type];
    });
    
    console.log("✅ Processed values for INSERT:", values);
    
    // 평가 데이터 저장
    await db.query(
      `INSERT INTO testresult (student_id, test_template_id, result_value, dojang_code, test_type)
       VALUES ?`,
      [values]
    );
    
    // 트랜잭션 커밋
    await db.query('COMMIT');
    res.status(200).json({ message: 'Evaluation saved successfully' });
  } catch (error) {
    // 트랜잭션 롤백
    await db.query('ROLLBACK');
    console.error('❌ Error saving evaluation:', error);
    res.status(500).json({ message: 'Failed to save evaluation', error: error.message });
  }
});



// 벨트 랭크 업데이트 및 출석 초기화 API
router.put('/update-belt-rank', verifyToken, async (req, res) => {
  const { student_id } = req.body; // 프론트에서 받은 학생 ID
  const { dojang_code } = req.user;

  // 1. 유효성 검사
  if (!student_id) {
    return res.status(400).json({ message: 'Student ID is required' });
  }

  try {
    // 2. 트랜잭션 시작: 두 개 이상의 작업을 한 묶음으로 처리
    await db.query('START TRANSACTION');

    // 3. (기존 로직) 학생의 벨트 랭크 + 1
    const [updateResult] = await db.execute(
      `UPDATE students SET belt_rank = belt_rank + 1 
       WHERE id = ? AND dojang_code = ?`,
      [student_id, dojang_code]
    );

    // 4. 벨트 업데이트가 성공했는지 확인
    if (updateResult.affectedRows > 0) {
      // 5. ✨ (추가된 로직) 해당 학생의 출석(attendance) 기록 삭제
      await db.execute(
        `DELETE FROM attendance 
         WHERE student_id = ? AND dojang_code = ?`,
        [student_id, dojang_code]
      );
      
      // 6. 모든 작업이 성공했으므로 트랜잭션 완료
      await db.query('COMMIT');
      res.json({ message: 'Belt rank updated and attendance reset successfully' });

    } else {
      // 7. 벨트를 업데이트할 학생이 없음 (롤백하고 404 반환)
      await db.query('ROLLBACK');
      res.status(404).json({ message: 'Student not found or not associated with this dojang' });
    }
  } catch (error) {
    // 8. 중간에 에러 발생 시 모든 변경 사항 되돌리기
    await db.query('ROLLBACK');
    console.error('Error during belt update and attendance reset:', error);
    res.status(500).json({ message: 'Failed to update belt rank and reset attendance' });
  }
});

router.put('/update-belt-quantity', verifyToken, async (req, res) => {
  const { student_id } = req.body;
  const { dojang_code } = req.user;
  
  try {
    console.log(`🔎 Received belt update request for student ${student_id} in dojang ${dojang_code}`);
    
    // 1️⃣ 학생 벨트 정보 가져오기
    const [student] = await db.query(
      `SELECT belt_rank, belt_size FROM students WHERE id = ? AND dojang_code = ?`,
      [student_id, dojang_code]
    );
    
    if (student.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    let { belt_rank, belt_size } = student[0];
    
    // 2️⃣ 해당 벨트 ID 찾기
    const [promotedBelt] = await db.query(
      `SELECT id FROM beltsystem WHERE belt_rank = ? AND dojang_code = ? LIMIT 1`,
      [belt_rank, dojang_code]
    );
    
    if (promotedBelt.length === 0) {
      return res.status(404).json({ message: `Promoted belt rank ${belt_rank} not found in beltsystem` });
    }
    
    const promotedBeltId = promotedBelt[0].id;

    // 3️⃣ belt_sizes 테이블 확인 (없으면 그냥 통과)
    const [beltSizeData] = await db.query(
      `SELECT id, quantity FROM belt_sizes WHERE belt_id = ? AND size = ? AND dojang_code = ? LIMIT 1`,
      [promotedBeltId, belt_size, dojang_code]
    );

    if (beltSizeData.length === 0) {
      console.log(`ℹ️ No matching belt size found for belt ID ${promotedBeltId}, skipping stock update.`);
      return res.status(200).json({ success: true, message: 'Belt promoted but no size tracking required' });
    }

    const currentQuantity = beltSizeData[0].quantity;

    // 4️⃣ 수량 확인 후 감소
    if (currentQuantity <= 0) {
      return res.status(400).json({ message: 'Insufficient belt stock' });
    }

    const updateQuery = `
      UPDATE belt_sizes
      SET quantity = quantity - 1
      WHERE belt_id = ? AND size = ? AND dojang_code = ? AND quantity > 0
    `;
    
    await db.query(updateQuery, [promotedBeltId, belt_size, dojang_code]);

    res.status(200).json({ success: true, message: 'Belt quantity updated successfully' });
    
  } catch (error) {
    console.error('❌ Error updating belt quantity:', error);
    res.status(500).json({ message: 'Error updating belt quantity', details: error.toString() });
  }
});


router.post('/test-template', verifyToken, async (req, res) => {
  const { test_name, evaluation_type, test_type, duration, target_count } = req.body;
  const { dojang_code } = req.user;

  // group_id 생성 함수 (Node.js와 동일하게)
  const normalize = (str) => str
    .replace(/[^\w\s]/g, '') // 특수문자 제거 (대소문자 유지)
    .replace(/\s+/g, ' ')    // 여분 공백 제거
    .trim();

  const createGroupId = (name, type, duration, target_count) => {
    const value = duration !== null ? duration : target_count;
    return `${normalize(name).toLowerCase()}-${type}-${value}`.replace(/\s+/g, '-');
  };

  console.log('📥 POST /test-template - Received data:', {
    test_name,
    evaluation_type,
    test_type,
    duration,
    target_count,
    target_count_type: typeof target_count
  });

  const type = (evaluation_type || '').trim();
  if (!type) {
    return res.status(400).json({ message: 'evaluation_type is required' });
  }

  try {
    // 1. 현재 최대 order 값 조회
    const [rows] = await db.query(
      'SELECT MAX(`order`) AS maxOrder FROM test_template WHERE dojang_code = ? AND test_type = ?',
      [dojang_code, test_type]
    );
    const nextOrder = (rows[0].maxOrder || 0) + 1;

    // 2. 저장할 값들 계산
    const durationValue = type === 'count' ? duration : null;
    const targetCountValue = (type === 'time' || type === 'attempt' || type === 'break') ? target_count : null;

    // group_id 생성
    const group_id = createGroupId(test_name, type, durationValue, targetCountValue);

    console.log('💾 POST /test-template - Values to insert:', {
      dojang_code,
      test_name,
      type,
      test_type,
      durationValue,
      targetCountValue,
      nextOrder,
      group_id
    });

    // 3. 새 row 저장 (order, group_id 포함)
    // test_name도 정규화해서 저장 (group_id와 일치시키기 위해)
    const normalizedTestName = normalize(test_name);
    
    const [result] = await db.query(
      `INSERT INTO test_template 
        (dojang_code, test_name, evaluation_type, test_type, duration, target_count, \`order\`, group_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dojang_code,
        normalizedTestName, // 정규화된 이름 저장
        type,
        test_type,
        durationValue,
        targetCountValue,
        nextOrder,
        group_id
      ]
    );

    console.log('✅ POST /test-template - Insert result:', result);

    // 4. 실제로 저장된 데이터 확인
    const [savedData] = await db.query(
      'SELECT * FROM test_template WHERE id = ?',
      [result.insertId]
    );
    console.log('🔍 POST /test-template - Saved data:', savedData[0]);

    res.json({ message: 'Test template created successfully', id: result.insertId });
  } catch (error) {
    console.error('❌ Error creating test template:', error);
    res.status(500).json({ message: 'Failed to create test template' });
  }
});

router.put('/test-template/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { test_name, evaluation_type, test_type, duration, target_count, order } = req.body;
  const { dojang_code } = req.user;

  // group_id 생성 함수 (Node.js와 동일하게)
  const normalize = (str) => str
    .replace(/[^\w\s]/g, '') // 특수문자 제거 (대소문자 유지)
    .replace(/\s+/g, ' ')    // 여분 공백 제거
    .trim();

  const createGroupId = (name, type, duration, target_count) => {
    const value = duration !== null ? duration : target_count;
    return `${normalize(name).toLowerCase()}-${type}-${value}`.replace(/\s+/g, '-');
  };

  console.log('📥 PUT /test-template/:id - Received data:', {
    id,
    test_name,
    evaluation_type,
    test_type,
    duration,
    target_count,
    target_count_type: typeof target_count,
    order
  });

  // 1. order만 수정하는 경우
  if (
    order !== undefined &&
    test_name === undefined &&
    evaluation_type === undefined &&
    test_type === undefined &&
    duration === undefined &&
    target_count === undefined
  ) {
    try {
      console.log('🔄 [ORDER UPDATE] id:', id, 'order:', order, 'dojang_code:', dojang_code);
      const [result] = await db.query(
        "UPDATE test_template SET `order` = ? WHERE id = ? AND dojang_code = ?",
        [order, id, dojang_code]
      );
      console.log('🔄 [ORDER UPDATE RESULT]', result);
      if (result.affectedRows === 0) {
        console.warn('⚠️ [ORDER UPDATE] No rows affected for id:', id);
        return res.status(404).json({ message: 'Test template not found or no changes made' });
      }
      return res.json({ message: 'Order updated successfully' });
    } catch (error) {
      console.error('❌ Error updating order:', error);
      return res.status(500).json({ message: 'Failed to update order' });
    }
  }

  // 2. 전체 필드 수정 (group_id 포함)
  // ✅ 필수 값 검증
  if (!test_name || !evaluation_type) {
    return res.status(400).json({ message: 'Name and evaluation type are required' });
  }
  if (evaluation_type === 'count' && (duration === undefined || duration === null)) {
    return res.status(400).json({ message: 'Duration is required for count-based tests' });
  }
  if ((evaluation_type === 'time' || evaluation_type === 'attempt' || evaluation_type === 'break') && 
      (target_count === undefined || target_count === null)) {
    return res.status(400).json({ message: 'Target count is required for time-based, attempt-based, or break tests' });
  }

  try {
    // 저장할 값들 계산
    const durationValue = evaluation_type === 'count' ? duration : null;
    const targetCountValue = (evaluation_type === 'time' || evaluation_type === 'attempt' || evaluation_type === 'break') ? target_count : null;

    // group_id 생성
    const group_id = createGroupId(test_name, evaluation_type, durationValue, targetCountValue);

    // test_name도 정규화해서 저장 (group_id와 일치시키기 위해)
    const normalizedTestName = normalize(test_name);

    console.log('💾 PUT /test-template/:id - Values to update:', {
      test_name,
      normalizedTestName,
      evaluation_type,
      test_type,
      durationValue,
      targetCountValue,
      group_id
    });

    const [result] = await db.query(
      `UPDATE test_template
       SET test_name = ?, evaluation_type = ?, test_type = ?, duration = ?, target_count = ?, group_id = ?
       WHERE id = ? AND dojang_code = ?`,
      [
        normalizedTestName, // 정규화된 이름 저장
        evaluation_type,
        test_type,
        durationValue,
        targetCountValue,
        group_id,
        id,
        dojang_code
      ]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Test template not found or no changes made' });
    }
    res.json({ message: 'Test template updated successfully' });
  } catch (error) {
    console.error('❌ Error updating test template:', error);
    res.status(500).json({ message: 'Failed to update test template' });
  }
});


// 도장 오너가 생성한 평가 기준 목록 가져오기 (다중 선택 지원)
router.get('/test-templates', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;
  const { test_types } = req.query; // ⭐️ test_type -> test_types (복수형으로 변경)

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
          WHEN evaluation_type = 'attempt' THEN target_count
          WHEN evaluation_type = 'break' THEN target_count
          ELSE NULL
        END AS value,
        created_at
      FROM test_template
      WHERE dojang_code = ?
    `;

    const queryParams = [dojang_code];

    if (test_types) {
      // ⭐️ 쉼표(,)로 구분된 문자열을 배열로 변환하여 IN 절에 사용
      const typesArray = test_types.split(',');
      query += ` AND test_type IN (?)`;
      queryParams.push(typesArray);
    }

    query += ` ORDER BY \`order\` ASC, id ASC`;

    const [testTemplates] = await db.query(query, queryParams);

    res.status(200).json(testTemplates);
  } catch (error) {
    console.error('❌ Error fetching test templates:', error);
    res.status(500).json({ message: 'Failed to fetch test templates' });
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
