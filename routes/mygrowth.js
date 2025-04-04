// mygrowth.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // MySQL 연결 파일을 설정한 위치에 맞게 변경
const verifyToken = require('../middleware/verifyToken');


// 부모 계정과 연결된 자녀 목록을 가져오는 엔드포인트
router.get('/students/:parentId', verifyToken, async (req, res) => {
  const { dojang_code } = req.user; // 도장 코드는 미들웨어에서 추출
  const { parentId } = req.params; // URL 파라미터에서 부모 ID를 가져옴

  try {
    const query = `
      SELECT 
        students.id,
        students.first_name,
        students.last_name,
        students.birth_date,
        students.belt_rank,
        programs.classes_per_week
      FROM students
      LEFT JOIN programs ON students.program_id = programs.id
      WHERE students.parent_id = ? AND students.dojang_code = ?
    `;

    const [children] = await db.execute(query, [parentId, dojang_code]);

    res.json(children); // 부모와 연결된 자녀 목록 반환
  } catch (error) {
    console.error('Error fetching children with classes_per_week:', error);
    res.status(500).json({ message: 'Failed to fetch children' });
  }
});

router.get('/test-results/:studentId', verifyToken, async (req, res) => {
  const { studentId } = req.params;
  const { dojang_code } = req.user;
  
  try {
    const [testResults] = await db.query(
      `SELECT
        r.student_id,
        r.test_template_id,
        t.test_name,
        r.result_value,
        r.test_type,
        DATE_FORMAT(r.created_at, '%Y-%m-%d') AS date,
        LAG(r.result_value) OVER (PARTITION BY r.student_id, t.test_name ORDER BY r.created_at) AS previous_result
      FROM testresult r
      JOIN test_template t ON r.test_template_id = t.id
      WHERE r.student_id = ? AND t.dojang_code = ?
      ORDER BY r.test_template_id, r.created_at ASC`,
      [studentId, dojang_code]
    );

    // 성장률 계산 추가
    const processedResults = testResults.map((result) => {
      const previous = result.previous_result;
      const current = result.result_value;
      const growthRate = previous ? (((current - previous) / previous) * 100).toFixed(1) : 'N/A';
      return {
        ...result,
        growth_rate: growthRate,
      };
    });

    console.log('Processed Test Results with Growth Rate:', processedResults);
    res.json(processedResults);
  } catch (error) {
    console.error('Error fetching test results:', error);
    res.status(500).json({ message: 'Failed to fetch test results' });
  }
});






module.exports = router;
