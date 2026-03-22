const express = require('express');
const db = require('../db'); // 데이터베이스 연결 파일
const router = express.Router();
const uuidv4 = require('uuid').v4;
const verifyToken = require('../middleware/verifyToken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


// 안전한 날짜 정규화: YYYY-MM-DD만 최종 허용, YYYY-MM/YY/MM은 1일로 보정
const toSqlDate = (v) => {
  if (v == null || v === '') return null;

  // Date 객체
  if (v instanceof Date && !isNaN(v)) {
    return v.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  }

  if (typeof v === 'string') {
    const s = v.trim();

    // YYYY-MM-DD (정확히 일치)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d) && d.toISOString().slice(0, 10) === s) return s;
      return null;
    }

    // YYYY-MM → YYYY-MM-01
    if (/^\d{4}-\d{2}$/.test(s)) {
      const [y, m] = s.split('-');
      const mn = Number(m);
      if (mn >= 1 && mn <= 12) return `${y}-${m.padStart(2, '0')}-01`;
      return null;
    }

    // YYYY/MM/DD → YYYY-MM-DD
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) {
      const norm = s.replace(/\//g, '-');
      const d = new Date(norm);
      if (!isNaN(d) && d.toISOString().slice(0, 10) === norm) return norm;
      return null;
    }

    // YYYY/MM → YYYY-MM-01
    if (/^\d{4}\/\d{2}$/.test(s)) {
      const [y, m] = s.split('/');
      const mn = Number(m);
      if (mn >= 1 && mn <= 12) return `${y}-${m.padStart(2, '0')}-01`;
      return null;
    }
  }

  return null;
};

router.post("/register-student", verifyToken, async (req, res) => {
  try {
    const {
      first_name, last_name, birth_date, gender,
      belt_rank, belt_size, parent_id, profile_image, program_id, is_paid_flow
    } = req.body || {};
    const dojang_code = req.user?.dojang_code ?? null;

    // 정규화
    const firstName = String(first_name ?? "").trim();
    const lastName  = String(last_name ?? "").trim();
    const genderNorm = String(gender ?? "").toLowerCase().trim();
    const beltRank   = String(belt_rank ?? "");
    const beltSize   = belt_size ?? null;
    const parentId   = parent_id != null ? Number(parent_id) : null;
    const programId  = program_id != null ? Number(program_id) : null;
    const profileImg = profile_image ?? null;
    const birthSQL   = toSqlDate(birth_date) ?? null;

    console.log("🔍 [register-student] Raw body:", req.body);
    console.log("🔍 [register-student] Normalized values:", {
      firstName, lastName, genderNorm, beltRank, beltSize,
      parentId, programId, profileImg, birthSQL, dojang_code
    });

    if (!dojang_code) return res.status(400).json({ success:false, message:"Dojang code is missing" });
    if (!firstName || !lastName || !genderNorm || parentId == null)
      return res.status(400).json({ success:false, message:"Missing required student fields" });

    // ✅ 부모 존재 확인
    const [[parentRow]] = await db.query("SELECT id FROM parents WHERE id = ?", [parentId]);
    if (!parentRow) {
      return res.status(400).json({ success:false, message:"Parent not found" });
    }

    // 기존 학생 조회
    let existing;
    if (birthSQL === null) {
      [existing] = await db.query(
        `SELECT id FROM students
         WHERE first_name=? AND last_name=? AND birth_date IS NULL
           AND parent_id=? AND dojang_code=?`,
        [firstName, lastName, parentId, dojang_code]
      );
    } else {
      [existing] = await db.query(
        `SELECT id FROM students
         WHERE first_name=? AND last_name=? AND birth_date=?
           AND parent_id=? AND dojang_code=?`,
        [firstName, lastName, birthSQL, parentId, dojang_code]
      );
    }

    let student_id;
    if (existing.length > 0) {
      student_id = existing[0].id;
      console.log("🔄 UPDATE student with:", {
        genderNorm, beltRank, beltSize, profileImg, programId, birthSQL, student_id
      });
      await db.query(
        `UPDATE students
           SET gender=?, 
               belt_rank=?, 
               belt_size=?, 
               program_id=?, 
               birth_date=?,
               profile_image = COALESCE(?, profile_image) 
         WHERE id=?`,
        [
          genderNorm, 
          beltRank, 
          beltSize, 
          programId ?? null, 
          birthSQL, 
          profileImg, // 👈 COALESCE의 첫 번째 인자로 profileImg(NULL일 수 있음)를 전달
          student_id
        ]
      );
    } else {
      console.log("🆕 INSERT student with:", {
        firstName, lastName, birthSQL, genderNorm, beltRank, beltSize,
        parentId, profileImg, programId, dojang_code
      });
      const [result] = await db.execute(
        `INSERT INTO students
           (first_name, last_name, birth_date, gender, belt_rank, belt_size,
            parent_id, profile_image, program_id, dojang_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [firstName, lastName, birthSQL, genderNorm, beltRank, beltSize,
         parentId, profileImg, programId ?? null, dojang_code]
      );
      student_id = result.insertId;

      if (!is_paid_flow) { // 👈 is_paid_flow가 true가 아닐 때만 실행
        try {
          const programName = program_id ? `(Program ID: ${program_id})` : '';
          const notificationMessage = `New free trial registered: ${firstName} ${lastName} ${programName}.`;

          await db.query(
            `INSERT INTO notifications (dojang_code, message) VALUES (?, ?)`,
            [dojang_code, notificationMessage]
          );
          console.log("✅ Notification created for new free trial student.");

        } catch (notificationError) {
          console.error("⚠️ Failed to create notification, but student was registered:", notificationError);
        }
      }

    }

    return res.status(201).json({ success:true, student_id });
  } catch (error) {
    if (error?.errno === 1452) {
      console.error("❌ FK ERROR:", error?.sqlMessage);
      return res.status(400).json({ success:false, message:"Invalid parent_id (not found in parents)" });
    }
    console.error("❌ ERROR /register-student:", error);
    return res.status(500).json({ success:false, message:"Server error. Please try again." });
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
    // !student_id, // 👈 제거
    !student ||
    !student.firstName || // 👈 학생 이름 등으로 대체
    !student.lastName ||
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

   // ⭐️ [시작] /register-student 로직 통합 (삽입할 코드) ⭐️
    // (student_id는 req.body에서 오지만, 신규 등록 시 null일 수 있습니다)
    let studentId = student_id; 
    
    const { 
      firstName, lastName, dateOfBirth, gender, 
      belt_rank, beltSize, profileImage 
    } = student; // 'student' 객체에서 모든 정보 추출
    const programId = program.id; // 결제하려는 프로그램 ID

    // 데이터 정규화
    const dobSQL = toSqlDate(dateOfBirth) ?? null;
    const genderNorm = String(gender ?? "").toLowerCase().trim();
    const beltRank = String(belt_rank ?? "");
    const beltSizeNorm = beltSize ?? null;
    const profileImg = profileImage ?? null;

    console.log("🔍 [process-payment] 학생 정보 처리 시작.");

    // 1. 기존 학생 조회 (이름, 생년월일, 부모ID, 도장코드로)
    const [existingStudent] = await connection.query(
      `SELECT id FROM students
        WHERE first_name = ? AND last_name = ?
          AND birth_date <=> ?         -- NULL-safe equality
          AND parent_id = ?
          AND dojang_code = ?`,
      [firstName, lastName, dobSQL, parent_id, dojang_code]
    );

    if (existingStudent.length > 0) {
      // 2a. [업데이트]
      studentId = existingStudent[0].id;
      console.log("🔄 [process-payment] 기존 학생 업데이트:", studentId);
      
      // /register-student의 상세 업데이트 로직 사용
      await connection.query(
        `UPDATE students
           SET gender=?, 
               belt_rank=?, 
               belt_size=?, 
               program_id=?, 
               birth_date=?,
               profile_image = COALESCE(?, profile_image) 
         WHERE id=?`,
        [
          genderNorm, 
          beltRank, 
          beltSizeNorm, 
          programId, 
          dobSQL, 
          profileImg, 
          studentId
        ]
      );
    } else {
      // 2b. [신규 삽입]
      console.log("🆕 [process-payment] 신규 학생 삽입...");
      const [result] = await connection.query(
        `INSERT INTO students
           (first_name, last_name, birth_date, gender, belt_rank, belt_size,
            parent_id, profile_image, program_id, dojang_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          firstName, lastName, dobSQL, genderNorm, beltRank, beltSizeNorm,
          parent_id, profileImg, programId, dojang_code
        ]
      );
      studentId = result.insertId;
      console.log("✅ [process-payment] 신규 학생 생성 완료:", studentId);
    }
    
    // 3. studentId가 확정되었는지 최종 확인
    if (!studentId) {
        // 이 경우는 로직상 발생하면 안 됨
        throw new Error("Student ID could not be determined after insert/update.");
    }

    console.log("✅ Student ID confirmed for transaction:", studentId);
    // ⭐️ [로직 통합 끝] ⭐️

   // ⭐⭐⭐ 수업 등록 처리: 기존 클래스 전체 삭제 후 새 클래스 전체 등록 ⭐⭐⭐

    // 1. 기존 클래스 연결 모두 삭제
    await connection.query(`
      DELETE FROM student_classes 
      WHERE student_id = ? AND dojang_code = ?
    `, [studentId, dojang_code]);
    console.log(`✅ Cleared all previous classes for student ${studentId}.`);

    // 2. 새 클래스 전체 등록
    if (classes && classes.length > 0) {
      const classInsertValues = classes.map(class_id => [studentId, class_id, dojang_code]);
      
      // Bulk Insert를 위한 SQL 구문 준비
      const insertSQL = `
        INSERT INTO student_classes (student_id, class_id, dojang_code)
        VALUES ?
      `;
      await connection.query(insertSQL, [classInsertValues]);
      console.log(`✅ New classes (${classes.length}) successfully enrolled.`);
    } else {
      console.log("⚠️ No new classes provided for enrollment.");
    }
    
    // ⭐⭐⭐ 수업 등록 처리 종료 ⭐⭐⭐

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
      
      // ⭐️ 1단계: 이 학생이 이전에 Pay in full을 결제한 기록이 있는지 찾습니다.
      const [existingPayInFull] = await connection.query(`
        SELECT id FROM payinfull_payment 
        WHERE student_id = ? AND dojang_code = ?
      `, [studentId, dojang_code]);

      if (existingPayInFull.length > 0) {
        // ⭐️ 2-A단계 (덮어쓰기 로직): 기존 기록이 있으면 새로운 값으로 모두 덮어씌웁니다 (UPDATE)
        // 기존 횟수에 더하는 것(remaining_classes + ?)이 아니라, 새로운 횟수(?)로 완전히 교체합니다.
        console.log("🟡 기존 Pay in full 기록 발견. 새 결제 정보로 덮어씌웁니다.");
        
        await connection.query(`
          UPDATE payinfull_payment
          SET payment_id = ?, 
              total_classes = ?, 
              remaining_classes = ?, 
              start_date = ?, 
              end_date = ?
          WHERE student_id = ? AND dojang_code = ?
        `, [
          mainPaymentId,     // 새로운 결제 영수증 ID로 덮어쓰기
          totalClasses,      // 새 프로그램의 총 횟수로 덮어쓰기
          remainingClasses,  // 새 프로그램의 남은 횟수로 덮어쓰기
          startDate,         // 새 프로그램의 시작일로 덮어쓰기
          endDateStr,        // 새 프로그램의 종료일로 덮어쓰기
          studentId,
          dojang_code
        ]);
        console.log("✅ Pay in full 기존 데이터 덮어쓰기(UPDATE) 완료");
      } else {
        // ⭐️ 2-B단계 (신규 등록): 기존 기록이 없으면 처음으로 줄을 만듭니다 (INSERT)
        console.log("🟢 기존 기록 없음. 신규 삽입합니다.");
        await connection.query(`
          INSERT INTO payinfull_payment
          (student_id, payment_id, total_classes, remaining_classes, 
           start_date, end_date, dojang_code)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          studentId,
          mainPaymentId, 
          totalClasses,
          remainingClasses,
          startDate,
          endDateStr,
          dojang_code
        ]);
        console.log("✅ Pay in full 신규 데이터 삽입(INSERT) 완료");
      }
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
      setup_future_usage: 'off_session', 
      metadata: {
        student_id: String(studentId),
        program: program.name
      }
    },
    {
      stripeAccount: connectedAccountId,
      idempotencyKey: finalIdempotencyKey // 👈 이 줄이 반드시 있어야 중복 결제가 방지됩니다!
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

      try {
        // req.body에서 학생 이름과 프로그램 이름을 가져옵니다.
        const studentName = `${student.firstName || ''} ${student.lastName || ''}`;
        const programName = program.name || 'Unknown Program';
        
        // ✅ [수정] 메시지 생성 로직 변경
        let notificationMessage = ` registration: ${studentName} joined ${programName}`;

        // 유니폼이 있으면 메시지 뒤에 내용을 추가합니다.
        if (uniforms && uniforms.length > 0) {
          // 예: " and purchased uniform(s): V-Neck Uniform, T-Shirt"
          const uniformNames = uniforms.map(u => u.name).join(', ');
          notificationMessage += ` and purchased uniform(s): ${uniformNames}`;
        }

        notificationMessage += `.`; // 마침표로 마무리

        await connection.query(
          `INSERT INTO notifications (dojang_code, message) VALUES (?, ?)`,
          [dojang_code, notificationMessage]
        );
        console.log("✅ Notification created for new payment.");

      } catch (notificationError) {
        // 알림이 실패해도 결제는 롤백하지 않도록 별도 try/catch로 감쌉니다.
        console.error("⚠️ Failed to create notification, but payment was successful:", notificationError);
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
    
    // 💡 [수정] Stripe나 DB에서 발생한 실제 오류 메시지를 사용합니다.
    const specificErrorMessage = error.message || "Error processing payment";
    console.error("❌ Payment processing failed:", specificErrorMessage); // 서버 로그에 구체적인 오류 기록

    return res.status(500).json({ 
      success: false, 
      message: specificErrorMessage // ⭐️ 'message' 필드에 구체적인 오류를 담아 전송
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
  const { dojang_code } = req.user; 

  try {
      const { age, belt_rank } = req.body;

      console.log("Received age:", age);
      console.log("Received belt_rank:", belt_rank);

      const numericBeltRank = parseInt(belt_rank, 10);

      if (isNaN(numericBeltRank)) {
          return res.status(400).json({ message: 'Invalid belt_rank value' });
      }

      // 1️⃣ 클래스 조건 필터링 (나이, 벨트 기준)
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
      // SQL IN 절에 넣기 위해 문자열 포맷팅 ('Level 1', 'Level 2' ...)
      const classNamesString = classNames.map(name => `'${name}'`).join(",");

      console.log("Class names for schedule filtering:", classNamesString);

      // 2️⃣ 스케줄 조회 (조건에 맞는 클래스만 필터링)
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

      // ============================================================
      // 🔥 [추가된 부분] 학생 수 카운트 및 병합 로직 시작
      // ============================================================

      // 3️⃣ 각 수업별 등록된 학생 수 카운트하기
      const countQuery = `
        SELECT cd.day, cd.time, COUNT(sc.student_id) as student_count
        FROM class_details cd
        LEFT JOIN student_classes sc ON cd.class_id = sc.class_id
        WHERE cd.dojang_code = ?
        GROUP BY cd.class_id, cd.day, cd.time
      `;
      const [counts] = await db.query(countQuery, [dojang_code]);

      // 4️⃣ 카운트 데이터를 검색하기 쉽게 맵(Map)으로 변환
      const countMap = {};
      counts.forEach(row => {
        const key = `${row.day}_${row.time}`;
        countMap[key] = row.student_count;
      });

      // 5️⃣ 필터링된 스케줄 데이터에 학생 수(Count) 붙이기
      const days = ['Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];
      
      const finalSchedule = schedule.map(row => {
        const newRow = { ...row }; // 원본 객체 복사

        days.forEach(day => {
          const className = newRow[day]; 
          
          // 클래스 이름이 존재할 때만 카운트 표시
          if (className && className.trim() !== '') {
            const key = `${day}_${row.time}`; 
            const count = countMap[key] || 0; 

            // 학생 수가 0명 이상일 때만 뒤에 (N) 붙이기
            if (count > 0) {
              newRow[day] = `${className} (${count})`; 
            }
          }
        });

        return newRow;
      });

      // ============================================================
      // 🔥 [추가된 부분] 끝
      // ============================================================

      // 정상 응답 (수정된 finalSchedule 반환)
      res.json({ schedule: finalSchedule });

  } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({ message: "Server error", error: error.message });
  }
});







  

module.exports = router;
