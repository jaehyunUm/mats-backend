const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 가져오기
const verifyToken = require('../middleware/verifyToken');
const { upload } = require('../index'); // index.js에서 가져온 upload
const { uploadFileToS3 } = require('../modules/s3Service'); // S3 업로드 유틸리티 함수
const { deleteFileFromS3 } = require('../modules/s3Service');



router.post('/badges', verifyToken, upload.single('image'), async (req, res) => {
  console.log("📥 Received request body:", req.body); // ✅ 디버깅 로그 추가
  console.log("📂 Received file:", req.file); // ✅ 파일 데이터 확인
  
  const { name, test_template_id, condition_value } = req.body;
  const { dojang_code } = req.user;
  
  // 필수 필드 체크
  if (!name || !test_template_id || !condition_value) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  
  try {
    let fileName = null;
    
    // ✅ S3에 이미지 업로드 (파일이 있을 경우)
    if (req.file) {
      // 파일명에 타임스탬프 추가하여 고유한 파일명 생성
      const timestamp = Date.now();
      const originalname = req.file.originalname; // originalname 정의
      const fileExtension = originalname.split('.').pop();
      const uniqueFileName = `badge_${timestamp}.${fileExtension}`;
      
      // 업로드 함수에 고유한 파일명 전달
      fileName = await uploadFileToS3(uniqueFileName, req.file.buffer, dojang_code);
    }
    
    // ✅ 배지 정보 저장 쿼리
    const query = `
      INSERT INTO badges (name, image_url, dojang_code, test_template_id, condition_value)
      VALUES (?, ?, ?, ?, ?)
    `;
    await db.query(query, [name, fileName, dojang_code, test_template_id, condition_value]);
    
    console.log("✔ Badge added successfully:", { name, test_template_id, condition_value });
    res.status(201).json({ message: 'Badge added successfully' });
  } catch (err) {
    console.error("❌ Error adding badge:", err);
    res.status(500).json({ message: 'Database error', error: err });
  }
});



// 도장의 모든 배지를 조회하는 API
router.get('/badges/all', verifyToken, async (req, res) => {
  const { dojang_code } = req.user; // 미들웨어에서 추출된 도장 코드

  try {
      const query = 'SELECT * FROM badges WHERE dojang_code = ?';
      const [results] = await db.query(query, [dojang_code]);
      
      res.status(200).json(results);
  } catch (err) {
      console.error('Error fetching all badges:', err);
      res.status(500).json({ message: 'Database error', error: err });
  }
});


// 배지 삭제 API
router.delete('/badge/:id', verifyToken, async (req, res) => {
    const badgeId = req.params.id;
    const { dojang_code } = req.user;
  
    try {
      // 데이터베이스에서 배지의 image_url을 먼저 조회
      const [badge] = await db.query('SELECT image_url FROM badges WHERE id = ? AND dojang_code = ?', [badgeId, dojang_code]);
  
      if (badge.length === 0) {
        return res.status(404).json({ message: 'Badge not found or unauthorized access' });
      }
  
      // S3에서 파일 삭제
      if (badge[0].image_url) {
        const fileName = badge[0].image_url.split('/').pop(); // S3 파일 이름 추출
        
        try {
          await deleteFileFromS3(fileName, dojang_code); // deleteFileFromS3 함수 사용
          console.log(`S3 file deleted: ${fileName}`);
        } catch (s3Error) {
          console.error('Error deleting file from S3:', s3Error);
        }
      }
  
      // 데이터베이스에서 배지 삭제
      await db.query('DELETE FROM badges WHERE id = ? AND dojang_code = ?', [badgeId, dojang_code]);
  
      res.status(200).json({ message: 'Badge deleted successfully' });
    } catch (err) {
      console.error('Error deleting badge:', err);
      res.status(500).json({ message: 'Database error', error: err });
    }
  });
  
// 통합 API
router.get('/testresult', verifyToken, async (req, res) => {
    const { condition_type } = req.query;
    const { dojang_code } = req.user;

    try {
        if (condition_type) {
            // 특정 평가항목 기준으로 데이터 조회, id와 student_id 제외
            const query = `
                SELECT 
                    tr.speed_kick, tr.push_up, tr.sit_up, tr.squat, tr.punch_combo, tr.kick_combo, tr.form, tr.board_breaking 
                FROM testresult tr
                WHERE tr.${condition_type} IS NOT NULL 
                AND tr.dojang_code = ?
            `;
            const [results] = await db.query(query, [dojang_code]);
            return res.status(200).json(results);
        } else {
            // 숫자형 컬럼명 조회 (id와 student_id 제외)
            const columnQuery = `
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'testresult'
                AND COLUMN_NAME NOT IN ('id', 'student_id')
                AND DATA_TYPE IN ('int', 'float', 'double', 'decimal');
            `;
            const [columns] = await db.query(columnQuery);
            const columnNames = columns.map(col => col.COLUMN_NAME);
            return res.status(200).json(columnNames);
        }
    } catch (error) {
        console.error('Error in testresult API:', error);
        res.status(500).json({ message: 'Database error', error });
    }
});



router.get('/badges-with-results/:childId', verifyToken, async (req, res) => {
  const { childId } = req.params;
  const { dojang_code } = req.user;

  console.log(`🔍 Fetching badges with test results for childId: ${childId}, dojang_code: ${dojang_code}`);

  try {
      const query = `
          SELECT 
              b.id AS badge_id,
              b.name AS badge_name,
              b.image_url,
              b.dojang_code,
              b.test_template_id,
              b.condition_value,
              t.test_name,
              t.evaluation_type, 
              MAX(r.result_value) AS result_value,  -- ✅ 최신 테스트 결과 가져오기
              DATE_FORMAT(MAX(r.created_at), '%Y-%m-%d') AS test_date  -- ✅ 최신 테스트 날짜 가져오기
          FROM badges b
          LEFT JOIN test_template t ON b.test_template_id = t.id
          LEFT JOIN testresult r ON b.test_template_id = r.test_template_id AND r.student_id = ?
          WHERE b.dojang_code = ?
          GROUP BY b.id, b.name, b.image_url, b.dojang_code, b.test_template_id, 
                   b.condition_value, t.test_name
          ORDER BY b.id ASC;
      `;

      const [results] = await db.query(query, [childId, dojang_code]);

      if (results.length === 0) {
          console.warn(`⚠ No badges found for childId: ${childId}`);
          return res.status(404).json({ message: `No badges found for childId: ${childId}` });
      }

      console.log(`✔ Fetched badges with test results:`, results);
      res.status(200).json(results);
  } catch (error) {
      console.error('❌ Error fetching badges with test results:', error);
      res.status(500).json({ message: 'Database error', error });
  }
});




router.get('/badge-condition-types', verifyToken, async (req, res) => {
  try {
    // 토큰에서 도장 코드 추출
    const { dojang_code } = req.user;
    
    const query = `
      SELECT id, test_name, evaluation_type,
      CASE
        WHEN evaluation_type = 'time' THEN target_count
        WHEN evaluation_type = 'count' THEN duration
        ELSE NULL
      END AS value
      FROM test_template
      WHERE evaluation_type IN ('count', 'time')
      AND dojang_code = ?
      ORDER BY test_name ASC;
    `;
    
    const [results] = await db.query(query, [dojang_code]);
    
    if (results.length === 0) {
      console.warn(`⚠ No condition types found for dojang_code: ${dojang_code}`);
      return res.status(404).json({ message: 'No condition types found for your dojang.' });
    }
    
    console.log(`🔍 Fetched Badge Condition Types for dojang_code ${dojang_code}:`, results);
    res.status(200).json(results);
  } catch (error) {
    console.error("❌ Error fetching badge condition types:", error);
    res.status(500).json({ message: 'Database error', error });
  }
});

router.patch('/badge/:id', verifyToken, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, test_template_id, condition_value } = req.body;
  const { dojang_code } = req.user;

  try {
    // 기존 배지 정보 조회
    const [badgeRows] = await db.query('SELECT image_url FROM badges WHERE id = ? AND dojang_code = ?', [id, dojang_code]);
    if (badgeRows.length === 0) {
      return res.status(404).json({ message: 'Badge not found or unauthorized access' });
    }
    let imageUrl = badgeRows[0].image_url;

    // 새 이미지가 업로드된 경우 S3에 업로드
    if (req.file) {
      const timestamp = Date.now();
      const originalname = req.file.originalname;
      const fileExtension = originalname.split('.').pop();
      const uniqueFileName = `badge_${timestamp}.${fileExtension}`;
      imageUrl = await uploadFileToS3(uniqueFileName, req.file.buffer, dojang_code);

      // 기존 이미지가 있으면 S3에서 삭제
      if (badgeRows[0].image_url) {
        const oldFileName = badgeRows[0].image_url.split('/').pop();
        await deleteFileFromS3(oldFileName, dojang_code);
      }
    }

    // DB 업데이트
    await db.query(
      'UPDATE badges SET name = ?, test_template_id = ?, condition_value = ?, image_url = ? WHERE id = ? AND dojang_code = ?',
      [name, test_template_id, condition_value, imageUrl, id, dojang_code]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error updating badge:', err);
    res.status(500).json({ message: 'Database error', error: err });
  }
});


module.exports = router;
