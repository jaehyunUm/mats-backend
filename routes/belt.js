// routes/beltsystemRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 가져오기
const verifyToken = require('../middleware/verifyToken');

// 벨트 데이터 저장 API
router.post('/beltsystem', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;
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

      // ✅ belt_sizes 입력은 sizes가 있고 배열에 값이 있을 때만 실행
      if (sizes && Array.isArray(sizes) && sizes.length > 0) {
          const insertSizesQuery = `
              INSERT INTO belt_sizes (belt_id, size, quantity, dojang_code)
              VALUES ?
          `;
          const sizeValues = sizes.map((size) => [beltId, size.size, size.quantity, dojang_code]);
          await db.query(insertSizesQuery, [sizeValues]);
      }

      res.status(201).json({ message: 'Belt added successfully' });

  } catch (error) {
      console.error('Error adding belt and sizes:', error);
      res.status(500).json({ message: 'Failed to add belt' });
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


router.get('/eligible-test-students', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;

  try {
      // 1. 해당 도장의 모든 '활동중인' 학생 정보를 가져옵니다.
      // (학생 테이블에 is_active 같은 컬럼이 있다고 가정)
      const [students] = await db.execute(
          'SELECT student_id, student_name, belt_rank, last_promotion_date FROM students WHERE dojang_code = ? AND is_active = 1',
          [dojang_code]
      );

      // 2. 해당 도장의 모든 테스트 조건을 미리 가져옵니다.
      const [conditions] = await db.execute(
          'SELECT belt_min_rank, belt_max_rank, attendance_required FROM testcondition WHERE dojang_code = ?',
          [dojang_code]
      );

      if (students.length === 0) {
          return res.json([]); // 학생이 없으면 빈 배열 반환
      }
      if (conditions.length === 0) {
          return res.status(404).json({ message: 'Test conditions not set for this dojang' });
      }

      // 3. 각 학생의 자격 요건을 비동기적으로 확인합니다.
      const eligibilityChecks = students.map(async (student) => {
          const nextBeltRank = student.belt_rank + 1;

          // 학생의 다음 벨트 랭크에 해당하는 조건을 찾습니다.
          const requiredCondition = conditions.find(c => nextBeltRank >= c.belt_min_rank && nextBeltRank <= c.belt_max_rank);

          // 조건이 없으면 자격 미달로 처리
          if (!requiredCondition) {
              return null;
          }
          
          // 4. (중요) 마지막 승급일 이후의 출석 횟수를 계산합니다.
          // last_promotion_date가 없다면, 총 출석일수로 계산할 수밖에 없습니다.
          // 정확성을 위해 'students' 테이블에 last_promotion_date 컬럼을 추가하는 것을 강력히 추천합니다.
          const [attendanceResult] = await db.execute(
              'SELECT COUNT(*) AS count FROM attendance WHERE student_id = ? AND dojang_code = ? AND attendance_date > ?',
              [student.student_id, dojang_code, student.last_promotion_date || '1970-01-01']
          );
          const currentAttendance = attendanceResult[0].count;

          // 5. 출석 조건을 만족하는지 확인합니다.
          if (currentAttendance >= requiredCondition.attendance_required) {
              return {
                  studentId: student.student_id,
                  studentName: student.student_name,
                  currentBeltRank: student.belt_rank,
                  currentAttendance: currentAttendance,
                  requiredAttendance: requiredCondition.attendance_required,
                  isEligible: true
              };
          } else {
              // (선택사항) 조건에 맞지 않는 학생 정보도 포함하고 싶다면 아래 주석을 해제하세요.
              /*
              return {
                  studentId: student.student_id,
                  studentName: student.student_name,
                  currentBeltRank: student.belt_rank,
                  currentAttendance: currentAttendance,
                  requiredAttendance: requiredCondition.attendance_required,
                  isEligible: false
              };
              */
             return null;
          }
      });

      // 모든 학생의 자격 요건 확인이 끝날 때까지 기다립니다.
      const results = await Promise.all(eligibilityChecks);
      
      // null 값(자격 미달)을 제거하고 최종 목록을 반환합니다.
      const eligibleStudents = results.filter(student => student !== null);
      
      res.json(eligibleStudents);

  } catch (error) {
      console.error('Error fetching eligible students:', error);
      res.status(500).json({ message: 'Failed to fetch eligible students' });
  }
});


module.exports = router;
