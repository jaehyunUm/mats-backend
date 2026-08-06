// routes/programRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 모듈 불러오기
const verifyToken = require('../middleware/verifyToken');

// 프로그램 생성 API
// 프로그램 생성 API
router.post('/create-program', verifyToken, async (req, res) => {
  let { // ⚠️ const 대신 let으로 변경 (값을 수정할 수 있게)
    name,
    description,
    paymentType,
    operationType,
    price,
    totalClasses,
    durationMonths,
    classesPerWeek,
    registrationFee,
  } = req.body;

  const { dojang_code } = req.user;
  
  // ✅ 등록비 기본값 설정
  const formattedRegistrationFee = registrationFee !== undefined && registrationFee !== null
      ? parseFloat(registrationFee) || 0
      : 0;

  // 🛡️ [안전장치 추가] Cash Pay일 경우 operationType과 totalClasses는 필요 없으므로 강제 null 처리
  if (paymentType === 'cash_pay') {
      operationType = null;
      totalClasses = null;
  }

  try {
    await db.query(
      `INSERT INTO programs (
           name, description, payment_type, operation_type, price,
          total_classes, duration_months, classes_per_week, registration_fee, dojang_code
      ) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description,
        paymentType,
        operationType || null,
        price || null,
        totalClasses || null,
        durationMonths || null,
        classesPerWeek || null,
        formattedRegistrationFee,
        dojang_code,
      ]
    );

    res.status(201).json({ message: 'Program created successfully!' });
  } catch (error) {
    console.error('Error creating program:', error);
    res.status(500).json({ message: 'Failed to create program', error: error.message });
  }
});


// 모든 프로그램 정보를 가져오는 API
router.get('/programs/details', verifyToken, async (req, res) => {
  const { paymentType, operationType } = req.query;
  const { dojang_code } = req.user;

  let sql = `
      SELECT 
          id, 
          name, 
          description, 
          total_classes, 
          classes_per_week, 
          payment_type, 
          operation_type, 
          duration_months, 
          price,
          registration_fee
      FROM programs
      WHERE dojang_code = ?
  `;
  
  const queryParams = [dojang_code];

  if (paymentType) {
      sql += ` AND payment_type = ?`;
      queryParams.push(paymentType);
  }
  if (operationType) {
      sql += ` AND operation_type = ?`;
      queryParams.push(operationType);
  }

  // ✅ ID 순서로 정렬하는 구문 추가
  sql += ` ORDER BY id ASC`;

  try {
      const [results] = await db.query(sql, queryParams);

      const programs = results.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          totalClasses: row.total_classes,
          classesPerWeek: row.classes_per_week,
          paymentType: row.payment_type,
          operationType: row.operation_type,
          durationMonths: row.duration_months,
          price: row.price,
          registrationFee: row.registration_fee,
      }));

      res.status(200).json(programs);
  } catch (err) {
      console.error('Error fetching program details:', err);
      res.status(500).json({ message: 'Database error', error: err });
  }
});

// 프로그램 삭제 API
router.delete('/programs/:programId', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;;
    const programId = parseInt(req.params.programId);

    if (isNaN(programId)) {
        return res.status(400).json({ message: 'Invalid program ID' });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        // 1️⃣ 프로그램 존재 여부 확인
        const checkQuery = 'SELECT id FROM programs WHERE id = ? AND dojang_code = ?';
        const [checkResult] = await connection.query(checkQuery, [programId, dojang_code]);

        if (checkResult.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Program not found or unauthorized' });
        }

        // 2️⃣ `monthly_payments`에서 관련 데이터 삭제
        const deleteMonthlyPaymentsQuery = 'DELETE FROM monthly_payments WHERE program_id = ? AND dojang_code = ?';
        await connection.query(deleteMonthlyPaymentsQuery, [programId, dojang_code]);

        // 3️⃣ `programs` 테이블에서 프로그램 삭제
        const deleteProgramQuery = 'DELETE FROM programs WHERE id = ? AND dojang_code = ?';
        const [result] = await connection.query(deleteProgramQuery, [programId, dojang_code]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Program not found or already deleted' });
        }

        // 4️⃣ 트랜잭션 커밋 및 응답 반환
        await connection.commit();
        res.status(200).json({ success: true, message: 'Program deleted successfully' });

    } catch (err) {
        console.error('❌ Error deleting program:', err);
        await connection.rollback();
        res.status(500).json({ success: false, message: 'Failed to delete program', error: err.message });
    } finally {
        connection.release();
    }
});


router.get('/programs/:programId', verifyToken, async (req, res) => {
    const { programId } = req.params;
    const { dojang_code } = req.user;;
  
    const sql = `
        SELECT 
            id AS programId, 
            name, 
            description, 
            payment_type AS paymentType, 
            operation_type AS operationType, 
            price, 
            total_classes AS totalClasses, 
            classes_per_week AS classesPerWeek, 
            duration_months AS durationMonths, 
            registration_fee AS registrationFee
        FROM programs
        WHERE id = ? AND dojang_code = ?
    `;
  
    try {
      const [results] = await db.query(sql, [programId, dojang_code]);
      if (results.length === 0) {
        return res.status(404).json({ message: 'Program not found' });
      }
  
      res.status(200).json({ success: true, program: results[0] });
    } catch (err) {
      console.error('Error fetching program:', err);
      res.status(500).json({ message: 'Database error', error: err });
    }
  });
  
  



  router.put('/programs/:programId', verifyToken, async (req, res) => {
    const { programId } = req.params;
    const { dojang_code } = req.user;;
  
    let { // ⚠️ const 대신 let으로 변경
      name,
      description,
      paymentType,
      operationType,
      price,
      totalClasses,
      durationMonths,
      classesPerWeek,
      registrationFee
    } = req.body;
  
    // 🛡️ [안전장치 추가] Cash Pay일 경우 불필요한 데이터 강제 초기화
    if (paymentType === 'cash_pay') {
        operationType = null;
        totalClasses = null;
    }
  
    const sql = `
      UPDATE programs SET
        name = ?,
        description = ?,
        payment_type = ?,
        operation_type = ?,
        price = ?,
        total_classes = ?,
        classes_per_week = ?,
        duration_months = ?,
        registration_fee = ?
      WHERE id = ? AND dojang_code = ?
    `;
  
    try {
      await db.query(sql, [
        name,
        description,
        paymentType,
        operationType || null,
        price || null,
        totalClasses || null,
        classesPerWeek || null,
        durationMonths || null,
        registrationFee || 0,
        programId,
        dojang_code
      ]);
  
      res.status(200).json({ success: true, message: 'Program updated successfully' });
    } catch (err) {
      console.error('Error updating program:', err);
      res.status(500).json({ success: false, message: 'Database error', error: err });
    }
  });
  



  router.get('/programs', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;
  
    if (!dojang_code) {
      return res.status(400).json({ message: 'Missing dojang_code' });
    }
  
    try {
      // 🚀 SELECT id, name을 SELECT * 로 변경했습니다.
      const [programs] = await db.query(
        'SELECT * FROM programs WHERE dojang_code = ?',
        [dojang_code]
      );
  
      res.json(programs);
    } catch (error) {
      console.error('Error fetching programs:', error);
      res.status(500).json({ message: 'Failed to fetch programs' });
    }
  });





module.exports = router;
