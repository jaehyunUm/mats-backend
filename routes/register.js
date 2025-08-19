const express = require('express');
const db = require('../db'); // 데이터베이스 연결 파일
const router = express.Router();
const uuidv4 = require('uuid').v4;
const verifyToken = require('../middleware/verifyToken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


const toSqlDate = (v) => {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);

  if (typeof v === 'string') {
    const s = v.trim();
    
    // 완전한 날짜 형식 (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      // 유효한 날짜인지 확인
      const date = new Date(s);
      if (!isNaN(date) && date.toISOString().slice(0, 10) === s) {
        return s;
      }
    }
    
    // 년-월 형식 (YYYY-MM) -> 해당 월의 첫째 날로 설정
    if (/^\d{4}-\d{2}$/.test(s)) {
      const [year, month] = s.split('-');
      const monthNum = parseInt(month, 10);
      if (monthNum >= 1 && monthNum <= 12) {
        return `${s}-01`;
      }
    }
    
    // 슬래시 형식 (YYYY/MM/DD)
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) {
      const normalized = s.replace(/\//g, '-');
      const date = new Date(normalized);
      if (!isNaN(date) && date.toISOString().slice(0, 10) === normalized) {
        return normalized;
      }
    }
    
    // 슬래시 형식 (YYYY/MM) -> 해당 월의 첫째 날로 설정
    if (/^\d{4}\/\d{2}$/.test(s)) {
      const [year, month] = s.split('/');
      const monthNum = parseInt(month, 10);
      if (monthNum >= 1 && monthNum <= 12) {
        return `${year}-${month.padStart(2, '0')}-01`;
      }
    }
    
    // 기타 형식 시도
    const d = new Date(s);
    if (!isNaN(d)) {
      const isoDate = d.toISOString().slice(0, 10);
      // 유효한 날짜 범위 확인 (1900년 이후, 2100년 이전)
      const year = parseInt(isoDate.split('-')[0], 10);
      if (year >= 1900 && year <= 2100) {
        return isoDate;
      }
    }
  }
  
  console.warn(`⚠️ Invalid date format: ${v}, returning null`);
  return null; // 도저히 못 맞추면 NULL
};

router.post("/register-student", verifyToken, async (req, res) => {
  try {
    console.log("[register-student] received body:", req.body);
    console.log("[register-student] user from token:", req.user);

    const {
      first_name, last_name, birth_date, gender,
      belt_rank, belt_size, parent_id, profile_image, program_id
    } = req.body;
    const { dojang_code } = req.user;

    const birthDateSQL = toSqlDate(birth_date);
    console.log('[register-student] birth_date raw =', birth_date, '→ normalized =', birthDateSQL);

    // 필수값 체크 (생일 필수면 birthDateSQL도 검사)
    if (!dojang_code) return res.status(400).json({ success:false, message:"Dojang code is missing" });
    if (!first_name || !last_name || !gender || parent_id == null) {
      return res.status(400).json({ success:false, message:"Missing required student fields" });
    }

    // 기존 학생 조회 (birth_date가 NULL일 수도 있으므로 분기)
    let existing;
    if (birthDateSQL === null) {
      [existing] = await db.query(
        `SELECT id FROM students
         WHERE first_name=? AND last_name=? AND birth_date IS NULL
           AND parent_id=? AND dojang_code=?`,
        [first_name, last_name, parent_id, dojang_code]
      );
    } else {
      [existing] = await db.query(
        `SELECT id FROM students
         WHERE first_name=? AND last_name=? AND birth_date=?
           AND parent_id=? AND dojang_code=?`,
        [first_name, last_name, birthDateSQL, parent_id, dojang_code]   // ← 여기도 normalized 사용
      );
    }

    let student_id;
    if (existing.length > 0) {
      student_id = existing[0].id;
      
      // birthDateSQL 최종 검증 (UPDATE용)
      if (birthDateSQL && !/^\d{4}-\d{2}-\d{2}$/.test(birthDateSQL)) {
        console.error(`❌ Invalid birthDateSQL format for UPDATE: ${birthDateSQL}`);
        return res.status(400).json({ 
          success: false, 
          message: "Invalid birth date format. Please provide a valid date (YYYY-MM-DD)." 
        });
      }
      
      await db.query(
        `UPDATE students
         SET gender=?, belt_rank=?, belt_size=?, profile_image=?, program_id=?, birth_date=?
         WHERE id=?`,
        [gender, String(belt_rank ?? ''), belt_size ?? null, profile_image ?? null, program_id ?? null, birthDateSQL, student_id]
      );
    } else {
      // birthDateSQL 최종 검증
      if (birthDateSQL && !/^\d{4}-\d{2}-\d{2}$/.test(birthDateSQL)) {
        console.error(`❌ Invalid birthDateSQL format: ${birthDateSQL}`);
        return res.status(400).json({ 
          success: false, 
          message: "Invalid birth date format. Please provide a valid date (YYYY-MM-DD)." 
        });
      }
      
      const [result] = await db.execute(
        `INSERT INTO students
         (first_name, last_name, birth_date, gender, belt_rank, belt_size, parent_id, profile_image, program_id, dojang_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [first_name, last_name, birthDateSQL, gender, String(belt_rank ?? ''), belt_size ?? null, parent_id, profile_image ?? null, program_id ?? null, dojang_code] // ← ★ 세 번째 파라미터가 birthDateSQL
      );
      student_id = result.insertId;
    }

    return res.status(201).json({ success:true, student_id });
  } catch (error) {
    console.error("❌ ERROR: Failed to register or update student:", error);
    return res.status(500).json({ success:false, message:"Server error. Please try again.", error: error.message || "Unknown error" });
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
    student_id,
    uniforms // 유니폼 정보 추가
  } = req.body;

  const paymentType = program?.paymentType || program?.payment_type;
  const program_fee = program?.program_fee;
  const registration_fee = program?.registration_fee || 0;

  if (!paymentType || (paymentType !== "monthly_pay" && paymentType !== "pay_in_full")) {
    return res.status(400).json({ success: false, message: "Invalid payment type" });
  }

  const amountValue = parseFloat(amount);
  if (typeof program_fee === "undefined" || program_fee === null) {
    return res.status(400).json({ success: false, message: "Program fee is missing in request body" });
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
    !cardId
  ) {
    return res.status(400).json({ success: false, message: "Missing or invalid fields in request body" });
  }

  const { dojang_code } = req.user;
  if (!dojang_code) {
    return res.status(400).json({ success: false, message: "Dojang code is missing from the request" });
  }

  // 트랜잭션 시작
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 학생 정보 처리
    let studentId = student_id;
    const dobSQL = toSqlDate(student?.dateOfBirth);
     console.log('[process-payment] DOB raw =', student?.dateOfBirth, '→', dobSQL);
    
     const [existingStudent] = await connection.query(
       `SELECT id FROM students
          WHERE first_name = ? AND last_name = ?
            AND birth_date <=> ?         -- NULL-safe equality, 인덱스 사용
            AND dojang_code = ?`,
       [student.firstName, student.lastName, dobSQL, dojang_code]
     );
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
      console.log("✅ Student record updated:", studentId);
    } else {
      console.error("❌ Student not found with provided information");
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: "Student not found. Please register first." });
    }

    console.log("✅ Student ID confirmed:", studentId);

    // 수업 등록 처리
    const [existingClasses] = await connection.query(`
      SELECT class_id FROM student_classes WHERE student_id = ? AND dojang_code = ?
    `, [studentId, dojang_code]);

    const existingClassIds = new Set(existingClasses.map(row => row.class_id));

    for (const class_id of classes) {
      if (!existingClassIds.has(class_id)) {
        await connection.query(`
          INSERT INTO student_classes (student_id, class_id, dojang_code)
          VALUES (?, ?, ?)
        `, [studentId, class_id, dojang_code]);
      }
    }
    console.log("✅ Classes enrollment completed");

    // 결제 ID 및 idempotencyKey 생성
    const mainPaymentId = uuidv4();
    const finalIdempotencyKey = idempotencyKey || uuidv4();

    // 프로그램 요금 계산 
    const programFeeValue = parseFloat(program.program_fee || 0);
    const registrationFeeValue = parseFloat(program.registration_fee || 0);
    const totalProgramFee = programFeeValue + registrationFeeValue;
    
    console.log("🔍 계산된 프로그램 요금:", programFeeValue);
    console.log("🔍 계산된 등록 요금:", registrationFeeValue);
    console.log("🔍 총 프로그램 요금:", totalProgramFee);
    
    // 프로그램 비용 저장 (program_payments 테이블)
    if (totalProgramFee > 0) {
      console.log("🛠️ DEBUG: Saving program payment record:", {
        payment_id: mainPaymentId,
        program_id: program.id,
        amount: totalProgramFee.toFixed(2),
        fee_type: 'program',
        dojang_code
      });

      await connection.query(`
        INSERT INTO program_payments (
          payment_id, student_id, program_id, amount, fee_type, status, 
          dojang_code, idempotency_key, source_id, parent_id
        ) VALUES (?, ?, ?, ?, 'program', 'pending', ?, ?, ?, ?)
      `, [
        mainPaymentId,
        studentId,
        program.id,
        totalProgramFee.toFixed(2),
        dojang_code,
        finalIdempotencyKey,
        cardId,
        parent_id
      ]);
      console.log("✅ Program payment record inserted");
    }

    // 유니폼 처리 (item_payments 테이블)
    if (uniforms && uniforms.length > 0) {
      console.log("🧵 Processing uniform purchase:", uniforms);
      for (const uniform of uniforms) {
        const itemId = uniform.id;
        const { size, quantity } = uniform;

        if (!itemId || !size || !quantity || quantity <= 0) {
          throw new Error("Invalid uniform data: missing required fields or invalid quantity");
        }

        // 재고 확인
        const [stockCheck] = await connection.query(`
          SELECT quantity FROM item_sizes WHERE item_id = ? AND size = ?
        `, [itemId, size]);

        if (stockCheck.length === 0 || stockCheck[0].quantity < quantity) {
          const availableQuantity = stockCheck.length > 0 ? stockCheck[0].quantity : 0;
          const errorMsg = `Insufficient stock for uniform (ID: ${itemId}, Size: ${size}). Requested: ${quantity}, Available: ${availableQuantity}`;
          console.error("❌ " + errorMsg);
          throw new Error(errorMsg);
        }

        // 재고 업데이트
        await connection.query(`
          UPDATE item_sizes SET quantity = quantity - ? WHERE item_id = ? AND size = ?
        `, [quantity, itemId, size]);

        // 유니폼 구매 정보 저장 (item_payments 테이블)
        await connection.query(`
          INSERT INTO item_payments 
          (student_id, item_id, size, quantity, amount, idempotency_key, payment_method, currency, payment_date, status, dojang_code, parent_id, card_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'pending', ?, ?, ?)
        `, [
          studentId,
          itemId,
          size,
          quantity,
          uniform.price || 0,
          `uniform-${itemId}-${Date.now()}`,
          'card',
          currency,
          dojang_code,
          parent_id,
          cardId
        ]);
      }
      console.log("✅ Uniform purchase processed");
    }

    if (paymentType === "pay_in_full") {
      // 프로그램 정보 조회
      const [programDetails] = await connection.query(`
        SELECT id, payment_type, operation_type, total_classes, classes_per_week, duration_months
        FROM programs 
        WHERE id = ?
      `, [program.id]);
      
      if (!programDetails.length) {
        throw new Error(`Program with id ${program.id} not found`);
      }
      
      const programInfo = programDetails[0];
      console.log("DB에서 가져온 프로그램 정보:", programInfo);
      
      // 기본 변수 설정 - 모두 NULL로 초기화
      let totalClasses = null;
      let remainingClasses = null;
      let startDate = null;
      let endDateStr = null;
      
      if (programInfo.operation_type === 'class_based') {
        // class_based는 total_classes 값만 사용
        totalClasses = programInfo.total_classes;
        remainingClasses = programInfo.total_classes;
        console.log(`Class-based 계산: 총 ${totalClasses}회`);
      } else if (programInfo.operation_type === 'duration_based') {
        // duration_based는 시작일과 종료일만 설정
        startDate = new Date().toISOString().split('T')[0];
        
        try {
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + (programInfo.duration_months || 1));
          endDateStr = endDate.toISOString().split('T')[0];
        } catch (error) {
          console.error("날짜 계산 오류:", error);
          endDateStr = null;
        }
        
        console.log(`Duration-based: 시작일 ${startDate}, 종료일 ${endDateStr}`);
      } else {
        console.error(`알 수 없는 operation_type: ${programInfo.operation_type}`);
      }
      
      // 이제 NULL 값을 허용하므로 그대로 쿼리 실행
      await connection.query(`
        INSERT INTO payinfull_payment
        (student_id, payment_id, total_classes, remaining_classes, 
         start_date, end_date, dojang_code)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        studentId,
        mainPaymentId, // 프로그램 결제 ID 사용
        totalClasses,
        remainingClasses,
        startDate,
        endDateStr,
        dojang_code
      ]);
      
      console.log("✅ Pay in full 등록 완료");
    }

    // 월간 결제 처리
    if (paymentType === "monthly_pay") {
      console.log("🔄 월간 결제 처리 시작...");
      try {
        // 프로그램 정보 조회
        const [programDetails] = await connection.query(`
          SELECT id, payment_type, operation_type, total_classes, classes_per_week, duration_months
          FROM programs
          WHERE id = ?
        `, [program.id]);
        
        if (!programDetails.length) {
          throw new Error(`Program with id ${program.id} not found`);
        }
        
        const programInfo = programDetails[0];
        console.log("DB에서 가져온 프로그램 정보:", programInfo);
        
        const today = new Date();
        const paymentDate = today.toISOString().split('T')[0];
        const nextPaymentDate = new Date(today);
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        const nextPaymentDateString = nextPaymentDate.toISOString().split('T')[0];
        
        // 시작일을 오늘로 설정
        const startDate = paymentDate;
        
        // duration 기반으로 종료일 계산
        const endDate = new Date(today);
        
        // programInfo에서 duration_months를 사용
        if (programInfo.duration_months) {
          // duration_months가 제공되면, 이를 사용하여 종료일 계산
          endDate.setMonth(endDate.getMonth() + parseInt(programInfo.duration_months));
        } else {
          // duration_months가 지정되지 않으면 기본값으로 1개월 설정
          endDate.setMonth(endDate.getMonth() + 1);
        }
        
        const endDateString = endDate.toISOString().split('T')[0];
        const monthlyIdempotencyKey = uuidv4();
        const monthlyPaymentId = uuidv4();
        
        // 기존 월간 결제 정보 확인
        const [existingPayment] = await connection.query(`
          SELECT id FROM monthly_payments
          WHERE student_id = ? AND parent_id = ? AND dojang_code = ?
        `, [studentId, parent_id, dojang_code]);
        
        const programFeeValue = parseFloat(program_fee);
        if (isNaN(programFeeValue) || programFeeValue <= 0) {
          throw new Error("월간 결제를 위한 유효하지 않은 프로그램 비용");
        }
        
        if (existingPayment.length > 0) {
          console.log("🟡 기존 구독이 발견되었습니다. 삽입 대신 업데이트합니다.");
          // 업데이트 쿼리 수정: start_date와 end_date 추가
          await connection.query(`
            UPDATE monthly_payments
            SET program_id = ?, payment_date = ?, next_payment_date = ?, program_fee = ?,
            payment_status = 'pending', status = 'pending', source_id = ?,
            customer_id = ?, idempotency_key = ?, payment_id = ?,
            start_date = ?, end_date = ?
            WHERE student_id = ? AND parent_id = ? AND dojang_code = ?
          `, [
            program.id,
            paymentDate,
            nextPaymentDateString,
            programFeeValue,
            cardId,
            customer_id || null,
            monthlyIdempotencyKey,
            mainPaymentId, // 메인 결제 ID 사용
            startDate,
            endDateString,
            studentId,
            parent_id,
            dojang_code
          ]);
          console.log("✅ 월간 결제 기록이 업데이트되었습니다.");
        } else {
          console.log("🟢 기존 구독이 없습니다. 새 기록을 삽입합니다.");
          // 삽입 쿼리 수정: start_date와 end_date 추가
          await connection.query(`
            INSERT INTO monthly_payments
            (parent_id, student_id, program_id, payment_date, next_payment_date, last_payment_date,
            program_fee, payment_status, status, dojang_code, source_id, customer_id, idempotency_key, payment_id,
            start_date, end_date)
            VALUES (?, ?, ?, ?, ?, NULL, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, ?)
          `, [
            parent_id,
            studentId,
            program.id,
            paymentDate,
            nextPaymentDateString,
            programFeeValue,
            dojang_code,
            cardId,
            customer_id || null,
            monthlyIdempotencyKey,
            mainPaymentId, // 메인 결제 ID 사용
            startDate,
            endDateString
          ]);
          console.log("✅ 새 월간 결제 기록이 삽입되었습니다.");
        }
      } catch (monthlyError) {
        console.error("❌ 월간 결제 처리 중 오류:", monthlyError);
        throw monthlyError; // 상위 try-catch로 전달
      }
    } else if (paymentType === "pay_in_full") {
      console.log("✅ 이것은 pay_in_full 프로그램입니다. 월간 결제 처리를 건너뜁니다.");
    } else {
      console.warn("⚠️ 알 수 없는 결제 유형이 감지되었습니다:", paymentType);
    }

   

    // DB에서 stripe_account_id 조회
  const [rows] = await db.execute(
    'SELECT stripe_account_id FROM owner_bank_accounts WHERE dojang_code = ?',
    [dojang_code]
  );

  if (rows.length === 0) {
    return res.status(400).json({ success: false, message: 'No connected Stripe account found.' });
  }

  const connectedAccountId = rows[0].stripe_account_id;

  // Stripe 결제
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: Math.round(amountValue * 100),
      currency: 'usd',
      customer: customer_id,
      payment_method: cardId,
      confirm: true,
      off_session: true,
      metadata: { /* ... */ }
    },
    {
      stripeAccount: connectedAccountId
    }
  );
    

    if (paymentIntent && paymentIntent.status === "succeeded") {
      // 결제 성공 후 DB 상태 업데이트
      await connection.query(`
        UPDATE program_payments SET status = 'completed' WHERE payment_id LIKE ?
      `, [`${mainPaymentId}%`]);

      // 아이템 결제 상태 업데이트
      if (uniforms && uniforms.length > 0) {
        await connection.query(`
          UPDATE item_payments SET status = 'completed' 
          WHERE student_id = ? AND status = 'pending'
        `, [studentId]);
      }

      // 월간 결제인 경우 월간 결제 상태도 업데이트
      if (paymentType === "monthly_pay") {
        await connection.query(`
          UPDATE monthly_payments 
          SET payment_status = 'pending', status = 'completed', 
              last_payment_date = payment_date
          WHERE payment_id = ?
        `, [mainPaymentId]);
      }

      // 트랜잭션 커밋
      await connection.commit();
      return res.status(200).json({ 
        success: true, 
        message: "Student registered and payment processed successfully",
        payment_id: mainPaymentId
      });
    } else {
      throw new Error("Payment not completed by Stripe");
    }

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    return res.status(500).json({ 
      success: false, 
      message: "Error processing payment", 
      error: error.message 
    });
  } finally {
    if (connection) {
      connection.release();
    }
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










  

module.exports = router;
