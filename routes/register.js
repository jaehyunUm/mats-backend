const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db'); // 데이터베이스 연결 파일
const router = express.Router();
const uuidv4 = require('uuid').v4;
const {client, createSquareClientWithToken} = require('../modules/squareClient');
const paymentsApi = client.paymentsApi;
const verifyToken = require('../middleware/verifyToken');
const locationId = process.env.SQUARE_LOCATION_ID_PRODUCTION; // Location ID

  
router.post("/register-student", verifyToken, async (req, res) => {
  try {
    console.log("📢 Received student registration request:", req.body);
    console.log("🛠️ DEBUG: dojang_code from middleware:", req.dojang_code);

    const { first_name, last_name, birth_date, gender, belt_rank, belt_size, parent_id, profile_image, program_id } = req.body;
    const { dojang_code } = req.user;

    // ✅ `dojang_code`가 없으면 오류 반환
    if (!dojang_code) {
      console.error("❌ ERROR: Dojang code is missing");
      return res.status(400).json({ success: false, message: "Dojang code is missing" });
    }

    // ✅ 값 검증 및 `null` 처리
    const safeFirstName = first_name || null;
    const safeLastName = last_name || null;
    const safeBirthDate = birth_date || null;
    const safeGender = gender || null;
    const safeBeltRank = belt_rank !== undefined ? belt_rank.toString() : null;
    const safeBeltSize = belt_size !== undefined ? belt_size : null;
    const safeParentId = parent_id !== undefined && parent_id !== null ? parent_id : null;
    const safeProgramId = program_id !== undefined ? program_id : null;
    const safeProfileImage = profile_image !== undefined ? profile_image : null;

    console.log("✅ DEBUG: Parent ID:", safeParentId);
    console.log("✅ DEBUG: Dojang Code:", dojang_code);

    // ✅ 필수 필드 체크
    if (!safeFirstName || !safeLastName || !safeBirthDate || !safeGender || safeParentId === null) {
      console.error("❌ ERROR: Missing required student fields:", req.body);
      return res.status(400).json({ success: false, message: "Missing required student fields" });
    }
    console.log("🛠️ DEBUG: Inserting into students table with values:", [
      safeFirstName, safeLastName, safeBirthDate, safeGender, safeBeltRank, 
      safeBeltSize, safeParentId, safeProfileImage, safeProgramId, dojang_code
  ]);
    // ✅ MySQL에 데이터 삽입
    const [result] = await db.execute(
      `INSERT INTO students (first_name, last_name, birth_date, gender, belt_rank, belt_size, parent_id, profile_image, program_id, dojang_code) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [safeFirstName, safeLastName, safeBirthDate, safeGender, safeBeltRank, safeBeltSize, safeParentId, safeProfileImage, safeProgramId, dojang_code]
    );
    console.log("✅ DEBUG: Student inserted successfully. Insert ID:", result.insertId);
    // ✅ 새로 생성된 student_id 반환
    const student_id = result.insertId;
    console.log("✅ Student registered successfully:", student_id);

    return res.status(201).json({ success: true, student_id });

  } catch (error) {
    console.error("❌ ERROR: Failed to register student:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error. Please try again.", 
      error: error.message || "Unknown error"
  });
  }
});





// 결제 및 등록 처리 API
router.post('/process-payment', verifyToken, async (req, res) => {
  console.log("Process-payment route called");
  console.log("받은 결제 요청 데이터:", req.body);

  const {
    student,
    program,
    classes,
    amount,
    currency,
    idempotencyKey,
    parent_id,
    customer_id,
    cardId,
    student_id
  } = req.body;

  const paymentType = program.paymentType;
  const program_fee = program.program_fee;

  // ✅ amount 정수화 및 유효성 검사
  const amountValue = parseFloat(amount);

  console.log("🚀 DEBUG: Checking program_fee:", program_fee);
  if (typeof program_fee === "undefined" || program_fee === null) {
    console.error("❌ ERROR: `program_fee` is missing in request body");
  }

  if (
    !student_id ||
    !student ||
    !program ||
    !classes ||
    isNaN(amountValue) ||
    amountValue <= 0 ||
    !currency ||
    !parent_id ||
    !cardId ||
    typeof program.paymentType === 'undefined'
  ) {
    console.error("❌ ERROR: Missing required fields in request body", req.body);
    return res.status(400).json({ message: "Missing or invalid fields in request body" });
  }

  const { dojang_code } = req.user;
  if (!dojang_code) {
    return res.status(400).json({ message: "Dojang code is missing from the request" });
  }

  const [ownerInfo] = await db.query(
    "SELECT square_access_token, location_id FROM owner_bank_accounts WHERE dojang_code = ?",
    [dojang_code]
  );

  if (!ownerInfo.length) {
    return res.status(400).json({ success: false, message: "No Square account connected for this dojang." });
  }

  const ownerAccessToken = ownerInfo[0].square_access_token;
  const locationId = ownerInfo[0].location_id;

  const squareClient = createSquareClientWithToken(ownerAccessToken);
  const paymentsApi = squareClient.paymentsApi;

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    let studentId;
    const [existingStudent] = await connection.query(`
      SELECT id FROM students WHERE first_name = ? AND last_name = ? AND DATE(birth_date) = ? AND dojang_code = ?
    `, [student.firstName, student.lastName, student.dateOfBirth, dojang_code]);

    if (existingStudent.length > 0) {
      studentId = existingStudent[0].id;
      await connection.query(`
        UPDATE students 
        SET program_id = ?, belt_rank = ?, gender = ?, belt_size = ?, parent_id = ? 
        WHERE id = ?
      `, [
        program.id,
        student.belt_rank,
        student.gender,
        student.beltSize || null,
        parent_id || null,
        studentId
      ]);
    } else {
      return res.status(400).json({ success: false, message: "Student not found. Please register first." });
    }

    console.log("✅ Student ID found:", studentId);

    const [existingClasses] = await connection.query(`
      SELECT class_id FROM student_classes WHERE student_id = ? AND dojang_code  = ?
    `, [studentId, dojang_code]);

    const existingClassIds = new Set(existingClasses.map(row => row.class_id));

    for (const class_id of classes) {
      if (!existingClassIds.has(class_id)) {
        await connection.query(`
          INSERT INTO student_classes (student_id, class_id, dojang_code )
          VALUES (?, ?, ?)
        `, [studentId, class_id, dojang_code]);
      }
    }

    const paymentId = uuidv4();
    const finalIdempotencyKey = idempotencyKey || uuidv4();

    console.log("🛠️ DEBUG: Payment Data to be inserted into program_payments:", {
      paymentId,
      program_id: program.id,
      amount: amountValue.toFixed(2),
      dojang_code,
      idempotencyKey: finalIdempotencyKey,
      cardId,
      parent_id
    });

    await connection.query(`
      INSERT INTO program_payments (payment_id, student_id, program_id, amount, status, dojang_code , idempotency_key, source_id, parent_id) 
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `, [
      paymentId,
      studentId,
      program.id,
      amountValue.toFixed(2),
      dojang_code,
      finalIdempotencyKey,
      cardId,
      parent_id
    ]);

    // ✅ 정기 결제 처리
    if (paymentType === "monthly_pay") {
      const paymentDate = new Date().toISOString().split('T')[0];
      const nextPaymentDate = new Date();
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      const nextPaymentDateString = nextPaymentDate.toISOString().split('T')[0];
      const monthlyIdempotencyKey = uuidv4();
      const monthlyPaymentId = uuidv4();

      const [existingPayment] = await connection.query(`
        SELECT id FROM monthly_payments 
        WHERE student_id = ? AND parent_id = ? AND dojang_code  = ?
      `, [studentId, parent_id, dojang_code]);

      if (existingPayment.length > 0) {
        console.log("🟡 Existing subscription found. Updating instead of inserting.");

        await connection.query(`
          UPDATE monthly_payments 
          SET program_id = ?, payment_date = ?, next_payment_date = ?, program_fee = ?, 
              status = 'pending', source_id = ?, customer_id = ?, idempotency_key = ?, payment_id = ?
          WHERE student_id = ? AND parent_id = ? AND dojang_code  = ?
        `, [
          program.id,
          paymentDate,
          nextPaymentDateString,
          parseFloat(program_fee),
          cardId,
          customer_id || null,
          monthlyIdempotencyKey,
          monthlyPaymentId,
          studentId,
          parent_id,
          dojang_code
        ]);

        console.log("✅ Monthly payment record updated.");
      } else {
        console.log("🟢 No existing subscription. Inserting new record.");

        await connection.query(`
          INSERT INTO monthly_payments 
          (parent_id, student_id, program_id, payment_date, next_payment_date, last_payment_date, program_fee, status, dojang_code , source_id, customer_id, idempotency_key, payment_id)
          VALUES (?, ?, ?, ?, ?, NULL, ?, 'pending', ?, ?, ?, ?, ?)
        `, [
          parent_id,
          studentId,
          program.id,
          paymentDate,
          nextPaymentDateString,
          parseFloat(program_fee),
          dojang_code,
          cardId,
          customer_id || null,
          monthlyIdempotencyKey,
          monthlyPaymentId
        ]);

        console.log("✅ New monthly payment record inserted.");
      }
    }

    // ✅ Square 결제 처리
    const paymentBody = {
      sourceId: cardId,
      amountMoney: {
        amount: Math.round(amountValue * 100),
        currency,
      },
      idempotencyKey: finalIdempotencyKey,
      locationId: locationId,
      customerId: customer_id,
    };

    console.log("Requesting payment with body:", paymentBody);

    const { result } = await paymentsApi.createPayment(paymentBody);

    if (result && result.payment && result.payment.status === "COMPLETED") {
      console.log("✅ Payment completed successfully.");

      await connection.query(`
        UPDATE program_payments SET status = 'completed' WHERE payment_id = ?
      `, [paymentId]);

      await connection.commit();

      return res.status(200).json({ success: true, message: "Student registered and payment processed successfully" });
    } else {
      throw new Error("Payment not completed");
    }

  } catch (error) {
    await connection.rollback();
    console.error("❌ Error processing payment:", error);
    return res.status(500).json({ success: false, message: "Error processing payment", error: error.message });
  } finally {
    connection.release();
  }
});



router.get('/belt-sizes', verifyToken, async (req, res) => {
  try {
    const { dojang_code } = req.user; // ✅ req.dojangCode로 수정

    if (!dojang_code) {
      return res.status(400).json({ message: 'Dojang code is missing' });
    }

    const query = `
      SELECT DISTINCT size
      FROM belt_sizes
      WHERE dojang_code = ?
      ORDER BY size ASC;
    `;
    
    const [results] = await db.query(query, [dojang_code]);

    return res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching distinct sizes:', error);
    return res.status(500).json({ message: 'Failed to fetch sizes' });
  }
});



router.post('/recommend-classes', verifyToken, async (req, res) => {
  const { dojang_code } = req.user; // ✅ 여기서 꺼내야 함

  try {

      const { age, belt_rank } = req.body;

      console.log("Received age:", age);
      console.log("Received belt_rank:", belt_rank);

      const numericBeltRank = parseInt(belt_rank, 10);

      if (isNaN(numericBeltRank)) {
          return res.status(400).json({ message: 'Invalid belt_rank value' });
      }

      // 클래스 조건 필터링
      const classQuery = `
          SELECT class_name
          FROM classconditions
          WHERE age_min <= ? AND age_max >= ?
          AND belt_min_rank <= ? AND belt_max_rank >= ?
          AND dojang_code = ?
      `;
      const [classConditions] = await db.query(classQuery, [age, age, numericBeltRank, numericBeltRank, dojang_code]);

      if (classConditions.length === 0) {
          return res.status(404).json({ message: 'No classes match the given conditions.' });
      }

      const classNames = classConditions.map(cls => cls.class_name);
      const classNamesString = classNames.map(name => `'${name}'`).join(",");

      console.log("Class names for schedule filtering:", classNamesString);

       // **🔥 변경된 요일 필드명 반영**
       const scheduleQuery = `
       SELECT time,
           CASE WHEN Mon IN (${classNamesString}) THEN Mon ELSE '' END AS Mon,
           CASE WHEN Tue IN (${classNamesString}) THEN Tue ELSE '' END AS Tue,
           CASE WHEN Wed IN (${classNamesString}) THEN Wed ELSE '' END AS Wed,
           CASE WHEN Thur IN (${classNamesString}) THEN Thur ELSE '' END AS Thur,
           CASE WHEN Fri IN (${classNamesString}) THEN Fri ELSE '' END AS Fri,
           CASE WHEN Sat IN (${classNamesString}) THEN Sat ELSE '' END AS Sat
       FROM schedule
       WHERE dojang_code = ?
       AND (
           Mon IN (${classNamesString}) OR
           Tue IN (${classNamesString}) OR
           Wed IN (${classNamesString}) OR
           Thur IN (${classNamesString}) OR
           Fri IN (${classNamesString}) OR
           Sat IN (${classNamesString})
       );
   `;
      const [schedule] = await db.query(scheduleQuery, [dojang_code]);

      if (schedule.length === 0) {
          console.log("No matching schedule for the selected classes.");
          return res.status(404).json({ message: 'No schedule found for the selected classes.' });
      }

       // 정상 응답
  res.json({ schedule });
} catch (error) {
console.error("Error processing request:", error);
res.status(500).json({ message: "Server error", error: error.message });
}
});


router.post("/update-stock", verifyToken, async (req, res) => {
  try {
      console.log("📥 Received stock update request:", req.body);
      console.log("📥 Extracted Dojang Code from Token:", req.user.dojang_code); // ✅ 미들웨어에서 가져오기

      const { itemId, size, quantity } = req.body;
      const { dojang_code } = req.user;;  // ✅ 미들웨어에서 설정한 값 사용

      if (!itemId || !size || !quantity || !dojang_code) {
          console.error("❌ Missing required fields:", { itemId, size, quantity, dojang_code });
          return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const [rows] = await db.query(
          `SELECT quantity FROM item_sizes WHERE item_id = ? AND size = ? AND dojang_code = ?`,
          [itemId, size, dojang_code]
      );

      if (rows.length === 0) {
          return res.status(404).json({ success: false, message: "Item not found" });
      }

      const currentQuantity = rows[0].quantity;

      if (currentQuantity < quantity) {
          return res.status(400).json({ success: false, message: "Not enough stock available" });
      }

      const [updateResult] = await db.query(
          `UPDATE item_sizes SET quantity = quantity - ? WHERE item_id = ? AND size = ? AND dojang_code = ?`,
          [quantity, itemId, size, dojang_code]
      );

      if (updateResult.affectedRows > 0) {
          return res.status(200).json({ success: true, message: "Stock updated successfully" });
      } else {
          return res.status(500).json({ success: false, message: "Failed to update stock" });
      }
  } catch (error) {
      console.error("❌ Stock update error:", error);
      return res.status(500).json({ success: false, message: "Server error", error });
  }
});









  

module.exports = router;
