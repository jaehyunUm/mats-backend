const express = require('express');
const router = express.Router();
const db = require('../db'); // DB 연결 파일
const verifyToken = require('../middleware/verifyToken');
const { uploadFileToS3 } = require('../modules/s3Service');
const { deleteFileFromS3 } = require('../modules/s3Service');
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

      // ✅ 기존 이미지 URL 조회
      const [currentStudent] = await db.query(
        'SELECT profile_image FROM students WHERE id = ? AND dojang_code = ?',
        [studentId, dojang_code]
      );

      let oldImageUrl = null;
      if (currentStudent.length > 0) {
        oldImageUrl = currentStudent[0].profile_image;
      }
  
      // S3에 새 이미지 업로드
      const uniqueFilename = `student_${studentId}_${Date.now()}.jpg`;
      const imageUrl = await uploadFileToS3(uniqueFilename, req.file.buffer, dojang_code);
      
      // ✅ 기존 이미지가 있으면 S3에서 삭제
      if (oldImageUrl) {
        try {
          const oldFileName = oldImageUrl.split('/').pop();
          await deleteFileFromS3(oldFileName, dojang_code);
          console.log(`✅ 기존 이미지 삭제 완료: ${oldFileName}`);
        } catch (deleteError) {
          console.error('⚠️ 기존 이미지 삭제 실패:', deleteError);
          // 삭제 실패 시에도 새 이미지 업로드는 계속 진행
        }
      }
      
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
    // ✅ 학생 정보 조회 (payment 정보 포함)
    const studentQuery = `
      SELECT
        s.first_name AS firstName,
        s.last_name AS lastName,
        s.birth_date AS dateOfBirth,
        s.gender,
        COALESCE(b.belt_color, 'Unknown') AS beltColor,
        COALESCE(b.stripe_color, NULL) AS stripeColor,
        s.belt_size,
        COALESCE(p.name, 'None') AS programName,
        s.profile_image AS imageUrl,
        s.parent_id AS parentId,
        p.payment_type,
        p.operation_type,
        CASE 
          WHEN p.payment_type = 'pay_in_full' THEN pf.total_classes
          ELSE NULL
        END AS total_classes,
        CASE 
          WHEN p.payment_type = 'pay_in_full' THEN pf.remaining_classes
          ELSE NULL
        END AS remaining_classes,
        CASE 
          WHEN p.payment_type = 'pay_in_full' THEN pf.start_date
          WHEN p.payment_type = 'monthly_pay' THEN mp.start_date 
          ELSE NULL
        END AS start_date,
        CASE 
          WHEN p.payment_type = 'pay_in_full' THEN pf.end_date
          WHEN p.payment_type = 'monthly_pay' THEN mp.end_date
          ELSE NULL
        END AS end_date,
        CASE 
          WHEN p.payment_type = 'monthly_pay' THEN mp.payment_status
          ELSE NULL
        END AS payment_status,
        CASE 
          WHEN p.payment_type = 'monthly_pay' THEN mp.next_payment_date
          ELSE NULL
        END AS next_payment_date,
        CASE 
          WHEN p.payment_type = 'monthly_pay' THEN mp.program_fee
          ELSE NULL
        END AS program_fee
      FROM students s
      LEFT JOIN programs p ON s.program_id = p.id
      LEFT JOIN beltsystem b ON s.belt_rank = b.belt_rank AND s.dojang_code = b.dojang_code
      LEFT JOIN payinfull_payment pf ON s.id = pf.student_id AND p.payment_type = 'pay_in_full'
      LEFT JOIN monthly_payments mp ON s.id = mp.student_id AND p.payment_type = 'monthly_pay'
      WHERE s.id = ? AND s.dojang_code = ?;
    `;
    
    const [studentResult] = await db.query(studentQuery, [studentId, dojang_code]);
    
    if (studentResult.length === 0) {
      console.error(`Student not found for ID: ${studentId} and Dojang Code: ${dojang_code}`);
      return res.status(404).json({ message: 'Student not found' });
    }
    
    const student = studentResult[0];
    console.log('Student Data:', student); // 디버깅 로그
    
    // 결제 정보 구성
    const paymentInfo = {
      type: student.payment_type,
      operationType: student.operation_type
    };
    
    // payment_type에 따라 추가 정보 설정
    if (student.payment_type === 'monthly_pay') {
      paymentInfo.nextPaymentDate = student.next_payment_date;
      paymentInfo.paymentStatus = student.payment_status;
      paymentInfo.startDate = student.start_date;
      paymentInfo.endDate = student.end_date;
      paymentInfo.programFee = student.program_fee;
    } else if (student.payment_type === 'pay_in_full') {
      if (student.operation_type === 'class_based') {
        paymentInfo.totalClasses = student.total_classes;
        paymentInfo.remainingClasses = student.remaining_classes;
      } else {
        paymentInfo.startDate = student.start_date;
        paymentInfo.endDate = student.end_date;
      }
    }
    
    // ✅ 학부모 정보 조회
    let parent = null;
    if (student.parentId) {
      const parentQuery = `
        SELECT
          first_name AS firstName,
          last_name AS lastName,
          phone AS phoneNumber
        FROM parents
        WHERE id = ? AND dojang_code = ?;
      `;
      
      const [parentResult] = await db.query(parentQuery, [student.parentId, dojang_code]);
      parent = parentResult.length > 0 ? parentResult[0] : null;
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
    
    // ✅ 최종 데이터 반환
    res.json({
      student,
      parent,
      classes: classResults,
      payment: paymentInfo,
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
  const { nextPaymentDate, startDate, endDate, programFee } = req.body; // 요청 바디에서 데이터 가져오기
  const { dojang_code } = req.user; // 토큰에서 추출한 도장 코드

  try {
    // ✅ 업데이트할 필드들을 동적으로 구성
    const updateFields = [];
    const updateValues = [];

    if (nextPaymentDate !== undefined) {
      updateFields.push('next_payment_date = ?');
      updateValues.push(nextPaymentDate);
    }

    if (startDate !== undefined) {
      updateFields.push('start_date = ?');
      updateValues.push(startDate);
    }

    if (endDate !== undefined) {
      updateFields.push('end_date = ?');
      updateValues.push(endDate);
    }

    if (programFee !== undefined) {
      updateFields.push('program_fee = ?');
      updateValues.push(programFee);
    }

    // ✅ 업데이트할 필드가 없으면 에러 반환
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    // ✅ WHERE 조건 추가
    updateValues.push(studentId, dojang_code);

    const updateQuery = `
      UPDATE monthly_payments
      SET ${updateFields.join(', ')}
      WHERE student_id = ? AND dojang_code = ?;
    `;

    const [result] = await db.query(updateQuery, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'No payment record found for the given student' });
    }

    res.status(200).json({ success: true, message: 'Payment information updated successfully' });
  } catch (error) {
    console.error('Error updating payment information:', error);
    res.status(500).json({ success: false, message: 'Server error while updating payment information' });
  }
});


router.delete('/students/:studentId', verifyToken, async (req, res) => {
  const { studentId } = req.params;
  const { dojang_code } = req.user; // 토큰에서 추출한 도장 코드

  try {
    console.log(`Received delete request for student ID: ${studentId}, dojang_code: ${dojang_code}`);

    // ✅ 학생 존재 여부 및 이미지 URL 조회
    const [studentResult] = await db.query(
      `SELECT id, profile_image FROM students WHERE id = ? AND dojang_code = ?`,
      [studentId, dojang_code]
    );

    if (studentResult.length === 0) {
      console.warn(`⚠️ Student with ID ${studentId} not found in dojang ${dojang_code}`);
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const imageUrl = studentResult[0].profile_image;
    
    // ✅ S3에서 이미지 삭제
    if (imageUrl) {
      const fileName = imageUrl.split('/').pop();
      try {
        await deleteFileFromS3(fileName, dojang_code);
        console.log(`🧹 S3 file deleted: ${fileName}`);
      } catch (s3Error) {
        console.error('⚠️ Failed to delete student image from S3:', s3Error);
        // 삭제 실패 시에도 학생 삭제는 계속 진행
      }
    }

    // ✅ 학생 삭제 전에 연관된 데이터 삭제
    console.log(`Deleting related data for student ID: ${studentId}`);

    await db.query(`DELETE FROM attendance WHERE student_id = ? AND dojang_code = ?`, [studentId, dojang_code]);
    await db.query(`DELETE FROM student_classes WHERE student_id = ? AND dojang_code = ?`, [studentId, dojang_code]);
    await db.query(`DELETE FROM monthly_payments WHERE student_id = ? AND dojang_code = ?`, [studentId, dojang_code]);
    await db.query(`DELETE FROM testlist WHERE student_id = ? AND dojang_code = ?`, [studentId, dojang_code]);
    await db.query(`DELETE FROM testresult WHERE student_id = ? AND dojang_code = ?`, [studentId, dojang_code]);

    // ✅ 학생 자체 삭제
    const [deleteResult] = await db.query(
      `DELETE FROM students WHERE id = ? AND dojang_code = ?`,
      [studentId, dojang_code]
    );

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

router.get('/students/:parentId', verifyToken, async (req, res) => {
  const { parentId } = req.params;
  const { dojang_code } = req.user;

  try {
    const query = `
      SELECT 
        s.id, 
        s.first_name, 
        s.last_name, 
        s.birth_date, 
        s.gender,
        s.belt_rank, 
        s.belt_size,
        b.belt_color,
        b.stripe_color
      FROM students s
      LEFT JOIN beltsystem b 
        ON s.belt_rank = b.belt_rank AND s.dojang_code = b.dojang_code
      WHERE s.parent_id = ? AND s.dojang_code = ?
    `;
    
    const [children] = await db.query(query, [parentId, dojang_code]);

    if (children.length === 0) {
      return res.status(404).json({ message: 'No children found for this parent.' });
    }
    
    res.json(children);
  } catch (error) {
    console.error('Error fetching children data:', error);
    res.status(500).json({ message: 'Error fetching children data.' });
  }
});

module.exports = router;
