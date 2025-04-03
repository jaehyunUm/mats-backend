// routes/beltsystemRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 가져오기
const verifyToken = require('../middleware/verifyToken');

// 벨트 데이터 저장 API
router.post('/beltsystem', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;;
    const { belt_color, stripe_color, sizes } = req.body;

    console.log("Received Data - Belt Color:", belt_color, "Stripe Color:", stripe_color, "Dojang Code:", dojang_code, "Sizes:", sizes);

    try {
        // 벨트 색상 및 스트라이프 중복 여부 확인
        const duplicateCheckQuery = `
            SELECT COUNT(*) as count FROM beltsystem 
            WHERE belt_color = ? AND stripe_color = ? AND dojang_code = ?
        `;
        const [checkResult] = await db.query(duplicateCheckQuery, [belt_color, stripe_color, dojang_code]);

        if (checkResult[0].count > 0) {
            return res.status(409).json({ message: 'Belt with the same color and stripe already exists' });
        }

        // 현재 최대 랭크 가져오기
        const getMaxRankQuery = 'SELECT MAX(belt_rank) as maxRank FROM beltsystem WHERE dojang_code = ?';
        const [rankResult] = await db.query(getMaxRankQuery, [dojang_code]);

        const maxRank = rankResult[0].maxRank || 0;
        const newRank = maxRank + 1;

        // 벨트 추가
        const insertBeltQuery = `
            INSERT INTO beltsystem (belt_color, stripe_color, belt_rank, dojang_code)
            VALUES (?, ?, ?, ?)
        `;
        const [beltResult] = await db.query(insertBeltQuery, [belt_color, stripe_color, newRank, dojang_code]);

        const beltId = beltResult.insertId; // 새로 추가된 벨트 ID

        // belt_sizes 테이블에 사이즈와 수량 추가 (도장 코드 포함)
        if (sizes && Array.isArray(sizes)) {
            const insertSizesQuery = `
                INSERT INTO belt_sizes (belt_id, size, quantity, dojang_code)
                VALUES ?
            `;
            const sizeValues = sizes.map((size) => [beltId, size.size, size.quantity, dojang_code]); // ✅ dojang_code 추가
            await db.query(insertSizesQuery, [sizeValues]);
        }

        res.status(201).json({ message: 'Belt and sizes added successfully' });

    } catch (error) {
        console.error('Error adding belt and sizes:', error);
        res.status(500).json({ message: 'Failed to add belt and sizes' });
    }
});

  
  
router.patch('/beltsystem/:id', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;;
  const { id } = req.params;
  const { belt_color, updated_sizes, new_sizes, removed_sizes } = req.body;

  console.log("🔵 PATCH Request received for Belt ID:", id);
  console.log("🔵 Received Data:", { belt_color, updated_sizes, new_sizes, removed_sizes });


  try {
      // ✅ 벨트 색상 업데이트
      await db.query(
          `UPDATE beltsystem 
          SET belt_color = ?
          WHERE id = ? AND dojang_code = ?`,
          [belt_color, id, dojang_code]
      );

      console.log(`✅ Belt updated successfully: ID=${id}, Dojang Code=${dojang_code}`);

      // ✅ 삭제할 사이즈 처리
      if (removed_sizes && removed_sizes.length > 0) {
          for (const size of removed_sizes) {
              await db.query(
                  `DELETE FROM belt_sizes WHERE belt_id = ? AND size = ? AND dojang_code = ?`,
                  [id, size.size, dojang_code]
              );
              console.log(`🗑️ Deleted size ${size.size} from belt ID=${id}`);
          }
      }

      // ✅ 기존 사이즈 업데이트
      if (updated_sizes && updated_sizes.length > 0) {
          for (const size of updated_sizes) {
              await db.query(
                  `UPDATE belt_sizes 
                  SET quantity = ? 
                  WHERE belt_id = ? AND size = ? AND dojang_code = ?`,
                  [size.quantity, id, size.size, dojang_code]
              );
              console.log(`🔄 Updated size ${size.size} to quantity ${size.quantity}`);
          }
      }

      // ✅ 새로운 사이즈 삽입
      if (new_sizes && new_sizes.length > 0) {
          const insertSizesQuery = `INSERT INTO belt_sizes (belt_id, size, quantity, dojang_code) VALUES ?`;
          const sizeValues = new_sizes.map((size) => [id, size.size, size.quantity, dojang_code]);
          await db.query(insertSizesQuery, [sizeValues]);
          console.log(`✅ Inserted new sizes:`, new_sizes);
      }

      res.status(200).json({ message: 'Belt updated successfully' });

  } catch (error) {
      console.error('❌ Error updating belt:', error);
      res.status(500).json({ message: 'Failed to update belt' });
  }
});






// 벨트 목록 가져오기 API
router.get('/beltsystem', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;;
  
    try {
      // 벨트와 사이즈 데이터를 조인하여 가져오기
      const query = `
        SELECT 
          b.id AS belt_id,
          b.belt_color,
          b.stripe_color,
          b.belt_rank,
          s.size,
          s.quantity
        FROM beltsystem b
        LEFT JOIN belt_sizes s ON b.id = s.belt_id
        WHERE b.dojang_code = ?
        ORDER BY b.belt_rank ASC
      `;
  
      const [results] = await db.query(query, [dojang_code]);
  
      // 데이터를 벨트별로 그룹화
      const belts = results.reduce((acc, row) => {
        const existingBelt = acc.find((belt) => belt.belt_id === row.belt_id);
        if (existingBelt) {
          existingBelt.sizes.push({ size: row.size, quantity: row.quantity });
        } else {
          acc.push({
            belt_id: row.belt_id,
            belt_color: row.belt_color,
            stripe_color: row.stripe_color,
            belt_rank: row.belt_rank,
            sizes: row.size
              ? [{ size: row.size, quantity: row.quantity }]
              : [],
          });
        }
        return acc;
      }, []);
  
      res.status(200).json(belts);
    } catch (error) {
      console.error('Error fetching belts:', error);
      res.status(500).json({ message: 'Failed to fetch belts' });
    }
  });
  

// 벨트 삭제 API
router.delete('/beltsystem/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { dojang_code } = req.user;;
  
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid belt ID' });
    }
  
    let connection;
    try {
      // 트랜잭션 시작
      connection = await db.getConnection();
      await connection.beginTransaction();
  
      // 1. `belt_sizes` 테이블에서 관련 데이터 삭제
      const deleteSizesQuery = `
        DELETE FROM belt_sizes WHERE belt_id = ?;
      `;
      await connection.query(deleteSizesQuery, [id]);
  
      console.log(`Deleted sizes for belt ID: ${id}`);
  
      // 2. `beltsystem` 테이블에서 벨트 삭제
      const deleteBeltQuery = `
        DELETE FROM beltsystem WHERE id = ? AND dojang_code = ?;
      `;
      const [result] = await connection.query(deleteBeltQuery, [id, dojang_code]);
  
      if (result.affectedRows === 0) {
        await connection.rollback(); // 실패 시 롤백
        return res.status(404).json({ success: false, message: 'Belt not found' });
      }
  
      console.log(`Deleted belt ID: ${id}`);
  
      // 트랜잭션 커밋
      await connection.commit();
      res.status(200).json({ success: true, message: 'Belt deleted successfully' });
    } catch (error) {
      console.error('Error deleting belt:', error);
  
      if (connection) await connection.rollback(); // 오류 발생 시 롤백
  
      res.status(500).json({ success: false, message: 'Server error while deleting belt' });
    } finally {
      if (connection) await connection.release();
    }
  });
  
  

// 벨트 이름 목록을 가져오는 엔드포인트
router.get('/get-belt-names', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;
  const query = 'SELECT belt_rank, stripe_color ,belt_color FROM beltsystem WHERE dojang_code = ?';

  try {
      const [results] = await db.query(query, [dojang_code]);
      res.status(200).json(results);
  } catch (err) {
      console.error('Error fetching belt names:', err);
      res.status(500).json({ message: 'Database error' });
  }
});

// 벨트 색상 조회 API (dojang_code까지 필터링)
router.get('/get-belt-color/:belt_rank', verifyToken, async (req, res) => {
  const { belt_rank } = req.params;
  const { dojang_code } = req.user;

  try {
    const [result] = await db.execute(
      'SELECT belt_color FROM beltsystem WHERE belt_rank = ? AND dojang_code = ?',
      [belt_rank, dojang_code]
    );

    if (result.length > 0) {
      res.json({ belt_color: result[0].belt_color });
    } else {
      res.status(404).json({ message: 'Belt color not found for this rank and dojang' });
    }
  } catch (error) {
    console.error('Error fetching belt color:', error);
    res.status(500).json({ message: 'Failed to fetch belt color' });
  }
});



// 학생의 출석 횟수를 가져오는 엔드포인트 (기존 get-attendance-count를 유지하면서 새 이름으로 추가)
router.get('/get-attendance/:studentId', verifyToken, async (req, res) => {
  const { studentId } = req.params;
  const { dojang_code } = req.user; 
  try {
    const [result] = await db.execute('SELECT COUNT(*) AS count FROM attendance WHERE student_id = ?  AND dojang_code = ?', [studentId ,dojang_code]);
    res.json({ attendance: result[0].count });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ message: 'Failed to fetch attendance' });
  }
});

// 벨트별 테스트 비용을 가져오는 엔드포인트
router.get('/get-test-fee/:belt_rank', verifyToken, async (req, res) => {
  const { belt_rank } = req.params;
  const { dojang_code } = req.user;

  try {
    const query = `
      SELECT fee
      FROM test_fee
      WHERE belt_min_rank <= ? AND belt_max_rank >= ? AND dojang_code = ?
    `;
    const [result] = await db.execute(query, [belt_rank, belt_rank, dojang_code]);

    if (result.length > 0) {
      res.json({ fee: result[0].fee });
    } else {
      res.status(404).json({ message: 'No test fee found for this belt rank' });
    }
  } catch (error) {
    console.error('Error fetching test fee:', error);
    res.status(500).json({ message: 'Failed to fetch test fee' });
  }
});




router.get('/get-attendance-count/:studentId', verifyToken, async (req, res) => {
  const { studentId } = req.params;
  const { dojang_code } = req.user;
  try {
    const [result] = await db.execute('SELECT COUNT(*) AS count FROM attendance WHERE student_id = ? AND dojang_code = ?', [studentId, dojang_code]);
    res.json({ count: result[0].count });
  } catch (error) {
    console.error('Error fetching attendance count:', error);
    res.status(500).json({ message: 'Failed to fetch attendance count' });
  }
});


module.exports = router;
