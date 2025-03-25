const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 파일
const verifyToken = require('../middleware/verifyToken');
const { upload } = require('../index'); // index.js에서 가져온 upload
const { uploadFileToS3 } = require('../modules/s3Service'); // S3 업로드 유틸리티 함수
const { deleteFileFromS3 } = require('../modules/s3Service');

router.post('/items', verifyToken, upload.single('image'), async (req, res) => {
  try {
    console.log("🚀 DEBUG: Raw Request Body:", req.body);
    
    const { name, price, category_id } = req.body;
    let sizes = [];

    // ✅ sizes가 undefined일 경우 빈 배열로 설정
    if (req.body.sizes) {
      try {
        sizes = JSON.parse(req.body.sizes);
      } catch (error) {
        console.error("❌ ERROR: Failed to parse sizes JSON", error);
        return res.status(400).json({ message: "Invalid sizes format" });
      }
    }

    console.log("✅ Parsed sizes:", sizes);

    // ✅ 필수 필드 확인
    if (!name || !price || !category_id || sizes.length === 0) {
      console.error("❌ ERROR: Missing required fields", { name, price, category_id, sizes });
      return res.status(400).json({ message: 'Missing required fields or sizes' });
    }

    const { dojang_code } = req.user;

    // ✅ 이미지 업로드 처리
    const fileName = req.file
      ? await uploadFileToS3(req.file.originalname, req.file.buffer, dojang_code)
      : null;

    console.log("✅ Uploading image:", fileName ? `Uploaded as ${fileName}` : "No image uploaded");

    // ✅ items 테이블에 기본 정보 저장
    const [result] = await db.query(
      'INSERT INTO items (name, price, category_id, image_url, dojang_code) VALUES (?, ?, ?, ?, ?)',
      [name, price, category_id, fileName, dojang_code]
    );
    const itemId = result.insertId;
    console.log("✅ Inserted item ID:", itemId);

    // ✅ item_sizes 테이블에 사이즈별 수량 저장 (dojang_code 추가)
const sizeQuery = 'INSERT INTO item_sizes (item_id, size, quantity, dojang_code) VALUES (?, ?, ?, ?)';
for (const { size, quantity } of sizes) {
  if (!size || !quantity) {
    console.error("❌ ERROR: Invalid size or quantity detected:", { size, quantity });
    continue;
  }
  await db.query(sizeQuery, [itemId, size, quantity, dojang_code]);
  console.log("✅ Inserted size and quantity:", { itemId, size, quantity, dojang_code });
}


    res.status(201).json({ success: true, message: 'Item added successfully with sizes' });
  } catch (err) {
    console.error("❌ ERROR: Failed to add item:", err);
    res.status(500).json({ message: 'Database error', error: err });
  }
});



router.get('/items/:itemId?', verifyToken, async (req, res) => {
  const { itemId } = req.params;
  const { dojang_code } = req.user;

  console.log("Fetching items. Item ID:", itemId);
  console.log("Dojang code:", dojang_code);

  try {
    if (itemId) {
      // 특정 itemId의 상세 정보를 가져오기
      const query = `
     SELECT 
  i.id, i.name, i.price, i.image_url, 
  s.size, s.quantity
FROM items i
LEFT JOIN item_sizes s 
  ON i.id = s.item_id AND s.dojang_code = ?
WHERE i.dojang_code = ? AND i.id = ?

    `;
    const [rows] = await db.query(query, [dojang_code, dojang_code, itemId]); 


      if (rows.length === 0) {
        console.log("Item not found");
        return res.status(404).json({ message: 'Item not found' });
      }

      // 데이터 그룹화 (단일 아이템)
      const item = {
        id: rows[0].id,
        name: rows[0].name,
        price: rows[0].price,
        image_url: rows[0].image_url,
        sizes: rows
          .filter(row => row.size && row.quantity)
          .map(row => ({ size: row.size, quantity: row.quantity })),
      };

      console.log("Fetched item details:", item);
      return res.status(200).json(item);
    } else {
      // 모든 아이템 가져오기
      const query = `
        SELECT 
          i.id, i.name, i.price, i.image_url, 
          s.size, s.quantity
        FROM items i
        LEFT JOIN item_sizes s ON i.id = s.item_id
        WHERE i.dojang_code = ?
      `;
      const [rows] = await db.query(query, [dojang_code]);

      // 데이터를 items 형태로 그룹화
      const items = rows.reduce((acc, row) => {
        const existingItem = acc.find((item) => item.id === row.id);

        if (existingItem) {
          // 기존 아이템에 사이즈 추가
          if (row.size && row.quantity) {
            existingItem.sizes.push({ size: row.size, quantity: row.quantity });
          }
        } else {
          // 새로운 아이템 추가
          acc.push({
            id: row.id,
            name: row.name,
            price: row.price,
            image_url: row.image_url,
            sizes: row.size ? [{ size: row.size, quantity: row.quantity }] : [],
          });
        }

        return acc;
      }, []);

      console.log("Fetched all items:", JSON.stringify(items, null, 2));

      return res.status(200).json(items);
    }
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({ message: "Database error", error: err });
  }
});



// 특정 카테고리의 아이템 조회 API
router.get('/items/category/:category_id', verifyToken, async (req, res) => {
  const categoryId = req.params.category_id;
  const { dojang_code } = req.user; // 미들웨어를 통해 추출된 도장 코드

  try {
    const query = `
      SELECT 
        i.id, i.name, i.price, i.image_url, 
        s.size, s.quantity
      FROM items i
      LEFT JOIN item_sizes s ON i.id = s.item_id
      WHERE i.category_id = ? AND i.dojang_code = ?
    `;
    const [rows] = await db.query(query, [categoryId, dojang_code]);

    // 데이터를 items 형태로 그룹화
    const items = rows.reduce((acc, row) => {
      const existingItem = acc.find((item) => item.id === row.id);

      if (existingItem) {
        // 기존 아이템에 사이즈 추가
        if (row.size && row.quantity) {
          existingItem.sizes.push({ size: row.size, quantity: row.quantity });
        }
      } else {
        // 새로운 아이템 추가
        acc.push({
          id: row.id,
          name: row.name,
          price: row.price,
          image_url: row.image_url,
          sizes: row.size ? [{ size: row.size, quantity: row.quantity }] : [],
        });
      }

      return acc;
    }, []);

    res.status(200).json(items);
  } catch (err) {
    console.error("Error fetching category items:", err);
    res.status(500).json({ message: 'Database error', error: err });
  }
});


  
  // 아이템 삭제 API
  router.delete('/items/:id', verifyToken, async (req, res) => {
    const itemId = req.params.id;
    const { dojang_code } = req.user;
  
    try {
      // 데이터베이스에서 아이템의 image_url을 먼저 조회
      const [item] = await db.query('SELECT image_url FROM items WHERE id = ? AND dojang_code = ?', [itemId, dojang_code]);
  
      if (item.length === 0) {
        return res.status(404).json({ message: 'Item not found or unauthorized access' });
      }
  
      // S3에서 파일 삭제
if (item[0].image_url) {
    const fileName = item[0].image_url.split('/').pop(); // S3 파일 이름 추출
    
    try {
      await deleteFileFromS3(fileName, dojang_code); // deleteFileFromS3 함수 사용
      console.log(`S3 file deleted: ${fileName}`);
    } catch (s3Error) {
      console.error('Error deleting file from S3:', s3Error);
    }
  }
  
  
      // 데이터베이스에서 아이템 삭제
      await db.query('DELETE FROM items WHERE id = ? AND dojang_code = ?', [itemId, dojang_code]);
  
      res.status(200).json({ message: 'Item deleted successfully' });
    } catch (err) {
      console.error('Error deleting item:', err);
      res.status(500).json({ message: 'Database error', error: err });
    }
  });

// 아이템 수정 API
router.put('/items/:id', verifyToken, async (req, res) => {
  console.log('Request received:', req.params, req.body);
  
  const { id } = req.params; // 아이템 ID
  const { dojang_code } = req.user; // 토큰에서 추출한 도장 코드
  const { name, price, sizes } = req.body; // 수정할 데이터

  try {
    console.log('Request Params:', req.params);
    console.log('Request Body:', req.body);

    // 데이터베이스에서 아이템 업데이트
    const [result] = await db.query(
      `UPDATE items 
       SET name = ?, price = ?
       WHERE id = ? AND dojang_code = ?`,
      [name, price, id, dojang_code]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Item not found or unauthorized.' });
    }

    // item_sizes 테이블 업데이트
    if (Array.isArray(sizes)) {
      // 기존 사이즈 데이터 삭제
      await db.query(`DELETE FROM item_sizes WHERE item_id = ?`, [id]);

      // 새 사이즈 데이터 삽입
      const sizeInsertQuery = `INSERT INTO item_sizes (item_id, size, quantity, dojang_code) VALUES (?, ?, ?, ?)
`;
      for (const { size, quantity } of sizes) {
        if (size && quantity) {
          await db.query(sizeInsertQuery, [id, size, quantity, dojang_code]);

          console.log(`Updated size and quantity for item_id ${id}:`, { size, quantity });
        } else {
          console.warn('Invalid size or quantity skipped:', { size, quantity });
        }
      }
    }

    res.status(200).json({ message: 'Item and sizes updated successfully.' });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ message: 'Failed to update item.' });
  }
});


module.exports = router;
