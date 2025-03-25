// routes/programRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 모듈 불러오기
const verifyToken = require('../middleware/verifyToken');

// 프로그램 생성 API
router.post('/create-program', verifyToken, async (req, res) => {
    const {
      name,
      description,
      paymentType,
      operationType,
      price,
      totalClasses,
      durationMonths,
      classesPerWeek,
      registrationFee,  // 등록비 추가
    } = req.body;

    const { dojang_code } = req.user;
    
    // ✅ 등록비 값이 null 또는 undefined이면 기본값 0을 설정
    const formattedRegistrationFee = registrationFee !== undefined && registrationFee !== null
        ? parseFloat(registrationFee) || 0
        : 0;

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
          formattedRegistrationFee, // ✅ 등록비 값이 항상 숫자로 저장됨
          dojang_code,
        ]
      );

      res.status(201).json({ message: 'Program created successfully!' });
    } catch (error) {
      console.error('Error inserting program into DB:', error);
      res.status(500).json({ error: 'Failed to create program.' });
    }
});


// 모든 프로그램 정보를 가져오는 API
router.get('/programs/details', verifyToken, async (req, res) => {
    const { paymentType, operationType } = req.query; // programType 삭제
    const { dojang_code } = req.user;;

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
            registration_fee  -- 등록비 추가
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

    try {
        const [results] = await db.query(sql, queryParams);

        // 프로그램 데이터 매핑
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
            registrationFee: row.registration_fee,  // 등록비 추가
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
  
    const {
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
  



// 도장별 프로그램 가져오기
router.get('/programs', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;

  if (!dojang_code) {
    return res.status(400).json({ message: 'Missing dojang_code' });
  }

  try {
    const [programs] = await db.query(
      'SELECT id, name FROM programs WHERE dojang_code = ?',
      [dojang_code]
    );

    res.json(programs);
  } catch (error) {
    console.error('Error fetching programs:', error);
    res.status(500).json({ message: 'Failed to fetch programs' });
  }
});





module.exports = router;
