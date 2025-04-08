const express = require('express');
const router = express.Router();
const db = require('../db'); // DB 연결 파일
const verifyToken = require('../middleware/verifyToken');
const { uploadFileToS3 } = require('../modules/s3Service');
const multer = require('multer');

// multer를 사용해 메모리 스토리지 설정
const upload = multer({ storage: multer.memoryStorage() });


// students.js 파일 내 이미지 업로드 API
router.post('/students/upload-image/:studentId', verifyToken, upload.single('image'), async (req, res) => {
    const { studentId } = req.params;
    const { dojang_code } = req.user; // 인증 미들웨어에서 추출된 도장 코드
  
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }
  
      // S3에 이미지 업로드
      const uniqueFilename = `student_${studentId}_${Date.now()}.jpg`;
      const imageUrl = await uploadFileToS3(uniqueFilename, req.file.buffer, dojang_code);
      
      // students 테이블에 이미지 URL 업데이트
      const updateQuery = `UPDATE students SET profile_image = ? WHERE id = ? AND dojang_code = ?`;
      await db.query(updateQuery, [imageUrl, studentId, dojang_code]);
  
      res.json({ message: 'Image uploaded and URL saved', imageUrl });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

// 학생 정보와 클래스 정보 불러오기
router.get('/students/profile/:studentId', verifyToken, async (req, res) => {
  const { studentId } = req.params;
  const { dojang_code } = req.user;

  try {
    // ✅ 학생 정보 조회 (belt_size 추가)
    const studentQuery = `
      SELECT 
        s.first_name AS firstName,
        s.last_name AS lastName,
        s.birth_date AS dateOfBirth,
        s.gender,
        COALESCE(b.belt_color, 'Unknown') AS beltColor,
        s.belt_size,  -- ✅ belt_size 추가
        COALESCE(p.name, 'None') AS programName,
        s.profile_image AS imageUrl,
        s.parent_id AS parentId
      FROM students s
      LEFT JOIN programs p ON s.program_id = p.id
      LEFT JOIN beltsystem b ON s.belt_rank = b.belt_rank AND s.dojang_code = b.dojang_code
      WHERE s.id = ? AND s.dojang_code = ?;
    `;
    const [studentResult] = await db.query(studentQuery, [studentId, dojang_code]);

    if (studentResult.length === 0) {
      console.error(`Student not found for ID: ${studentId} and Dojang Code: ${dojang_code}`);
      return res.status(404).json({ message: 'Student not found' });
    }
    const student = studentResult[0];
    console.log('Student Data:', student); // 디버깅 로그

    // ✅ 학부모 정보 조회
    let parent = null;
    if (student.parentId) {
      const parentQuery = `
        SELECT 
          first_name AS firstName,
          last_name AS lastName,
          birth_date AS dateOfBirth,
          gender,
          phone AS phoneNumber
        FROM parents
        WHERE id = ? AND dojang_code = ?;
      `;
      const [parentResult] = await db.query(parentQuery, [student.parentId, dojang_code]);
      parent = parentResult.length > 0 ? parentResult[0] : null;
      console.log('Parent Data:', parent); // 디버깅 로그
    }

    // ✅ 학생의 클래스 정보 조회
    const classQuery = `
      SELECT 
        cd.time,
        cd.day,
        cd.classname AS className
      FROM student_classes sc
      JOIN class_details cd ON sc.class_id = cd.class_id AND sc.dojang_code = cd.dojang_code
      WHERE sc.student_id = ? AND sc.dojang_code = ?;
    `;
    const [classResults] = await db.query(classQuery, [studentId, dojang_code]);
    console.log('Class Data:', classResults); // 디버깅 로그

    // ✅ 결제 정보 조회 (students_id 기반 조회)
    const paymentQuery = `
      SELECT 
        next_payment_date
      FROM monthly_payments
      WHERE student_id = ? AND dojang_code = ? 
      ORDER BY next_payment_date ASC LIMIT 1;  -- ✅ 가장 빠른 결제 날짜 1개만 조회
    `;
    const [paymentResult] = await db.query(paymentQuery, [studentId, dojang_code]);
    const nextPaymentDate = paymentResult.length > 0 ? paymentResult[0].next_payment_date : null;
    console.log('Payment Data:', nextPaymentDate); // 디버깅 로그

    // ✅ 최종 데이터 반환
    res.json({
      student,
      parent,
      classes: classResults, // 클래스 정보 포함
      payment: {
        nextPaymentDate, // ✅ 다음 결제 날짜 포함
      },
    });
  } catch (error) {
    console.error('Error fetching student, parent, and class information:', error);
    res.status(500).json({ message: 'Server error' });
  }
});




  
// 학생 정보 업데이트 API
router.put('/students/:id', verifyToken, async (req, res) => {
  const studentId = req.params.id;
  const { student } = req.body;
  const { dojang_code } = req.user;

  try {
    console.log('Received beltColor:', student.beltColor); // 디버깅 로그 추가

    // 벨트 색상과 stripe 색상을 분리
    const [beltColor, stripeColor] = student.beltColor.split(' (');
    const cleanBeltColor = beltColor.trim();
    const cleanStripeColor = stripeColor ? stripeColor.replace(')', '').trim() : null;

    console.log('Parsed belt info:', { cleanBeltColor, cleanStripeColor }); // 디버깅 로그 추가

    // 1. beltsystem에서 belt_color와 stripe_color로 belt_rank 조회
    const [beltResult] = await db.query(
      `SELECT belt_rank FROM beltsystem 
       WHERE belt_color = ? 
       AND (stripe_color = ? OR (? IS NULL AND stripe_color IS NULL))
       AND dojang_code = ?`,
      [cleanBeltColor, cleanStripeColor, cleanStripeColor, dojang_code]
    );

    console.log('Belt query result:', beltResult); // 디버깅 로그 추가

    // belt_rank 조회 실패 시 에러 처리
    if (beltResult.length === 0) {
      console.log('No matching belt found'); // 디버깅 로그 추가
      return res.status(404).json({ message: "Invalid belt color or stripe combination" });
    }

    const beltRank = beltResult[0].belt_rank;
    console.log('Selected belt rank:', beltRank); // 디버깅 로그 추가

    // 2. programs 테이블에서 name과 dojang_code로 program_id 조회
    let programId = null;
    if (student.programName) {
      const [programResult] = await db.query(
        `SELECT id FROM programs WHERE name = ? AND dojang_code = ?`,
        [student.programName, dojang_code]
      );

      if (programResult.length === 0) {
        return res.status(404).json({ message: "Invalid program name" });
      }

      programId = programResult[0].id;
    }

    // 3. students 테이블 업데이트
    const updateQuery = `
      UPDATE students 
      SET 
        first_name = ?, 
        last_name = ?, 
        birth_date = ?, 
        gender = ?, 
        belt_rank = ?,
        belt_color = ?,
        stripe_color = ?,
        belt_size = ?,
        program_id = ?,
        profile_image = ?
      WHERE id = ? AND dojang_code = ?
    `;

    const updateParams = [
      student.firstName || null,
      student.lastName || null,
      student.birthDate || null,
      student.gender || null,
      beltRank,
      cleanBeltColor,
      cleanStripeColor,
      student.beltSize || null,
      programId,
      student.profileImage || null,
      studentId,
      dojang_code,
    ];

    console.log('Update params:', updateParams); // 디버깅 로그 추가

    await db.execute(updateQuery, updateParams);

    res.status(200).json({ success: true, message: 'Student information updated successfully' });
  } catch (error) {
    console.error("Error updating student information:", error);
    res.status(500).json({ message: 'Error updating student information' });
  }
});



// 부모 정보 업데이트 API
router.put('/students/parents/:id', verifyToken, async (req, res) => {
  const parentId = req.params.id;
  const { parent } = req.body;
  const { dojang_code } = req.user; // 미들웨어에서 추출된 도장 코드

  try {
    const updateQuery = `
      UPDATE parents 
      SET 
        first_name = ?, 
        last_name = ?, 
        birth_date = ?, 
        gender = ?, 
        phone = ?
      WHERE id = ? AND dojang_code = ?
    `;

    await db.execute(updateQuery, [
      parent.firstName || null,
      parent.lastName || null,
      parent.birthDate || null,
      parent.gender || null,
      parent.phone || null,
      parentId,
      dojang_code,
    ]);

    res.status(200).json({ success: true, message: 'Parent information updated successfully' }); // ✅ 수정됨
  } catch (error) {
    console.error("Error updating parent information:", error);
    res.status(500).json({ message: 'Error updating parent information' });
  }
});


//monthly 결제 정보 업데이트
router.put('/students/payments/:studentId', verifyToken, async (req, res) => {
  const { studentId } = req.params; // URL에서 studentId 가져오기
  const { nextPaymentDate } = req.body; // 요청 바디에서 nextPaymentDate 가져오기
  const { dojang_code } = req.user; // 토큰에서 추출한 도장 코드

  try {
    // ✅ `nextPaymentDate`가 유효한지 확인
    if (!nextPaymentDate) {
      return res.status(400).json({ success: false, message: 'Next payment date is required' });
    }

    // ✅ 특정 학생의 `next_payment_date`만 업데이트
    const updateQuery = `
      UPDATE monthly_payments
      SET next_payment_date = ?
      WHERE student_id = ? AND dojang_code = ?;
    `;

    const [result] = await db.query(updateQuery, [nextPaymentDate, studentId, dojang_code]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'No payment record found for the given student' });
    }

    res.status(200).json({ success: true, message: 'Next payment date updated successfully' });
  } catch (error) {
    console.error('Error updating next payment date:', error);
    res.status(500).json({ success: false, message: 'Server error while updating payment information' });
  }
});


router.delete('/students/:studentId', verifyToken, async (req, res) => {
  const { studentId } = req.params;
  const { dojang_code } = req.user; // 토큰에서 추출한 도장 코드

  try {
    console.log(`Received delete request for student ID: ${studentId}, dojang_code: ${dojang_code}`);

    // ✅ 학생 존재 여부 확인
    const checkStudentQuery = `SELECT id FROM students WHERE id = ? AND dojang_code = ?`;
    const [studentResult] = await db.query(checkStudentQuery, [studentId, dojang_code]);

    if (studentResult.length === 0) {
      console.warn(`⚠️ Student with ID ${studentId} not found in dojang ${dojang_code}`);
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // ✅ 학생 삭제 전에 연관된 데이터 삭제 (foreign key constraints 해결)
    console.log(`Deleting related data for student ID: ${studentId}`);

    // 1️⃣ 학생 출석 기록 삭제 (`attendance` 테이블)
    await db.query(`DELETE FROM attendance WHERE student_id = ? AND dojang_code = ?`, [studentId, dojang_code]);

    // 2️⃣ 학생이 등록한 클래스 삭제 (`student_classes` 테이블)
    await db.query(`DELETE FROM student_classes WHERE student_id = ? AND dojang_code = ?`, [studentId, dojang_code]);

    // 3️⃣ 학생의 결제 기록 삭제 (`monthly_payments` 테이블)
    await db.query(`DELETE FROM monthly_payments WHERE student_id = ? AND dojang_code = ?`, [studentId, dojang_code]);

    // 4️⃣ 학생이 신청한 테스트 기록 삭제 (`testlist` 테이블)
    await db.query(`DELETE FROM testlist WHERE student_id = ? AND dojang_code = ?`, [studentId, dojang_code]);
    
    await db.query(`DELETE FROM testresult WHERE student_id = ? AND dojang_code = ?`, [studentId, dojang_code]); // ✅ 추가
    
    // 5️⃣ 학생 삭제 (`students` 테이블)
    const deleteStudentQuery = `DELETE FROM students WHERE id = ? AND dojang_code = ?`;
    const [deleteResult] = await db.query(deleteStudentQuery, [studentId, dojang_code]);

    if (deleteResult.affectedRows === 0) {
      console.warn(`⚠️ No student deleted for ID: ${studentId} in dojang ${dojang_code}`);
      return res.status(404).json({ success: false, message: 'Failed to delete student' });
    }

    console.log(`✅ Student ID: ${studentId} successfully deleted.`);
    res.status(200).json({ success: true, message: 'Student deleted successfully' });

  } catch (error) {
    console.error('❌ Error deleting student:', error);
    res.status(500).json({ success: false, message: 'An error occurred while deleting the student' });
  }
});





  

module.exports = router;
