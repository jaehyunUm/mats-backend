// routes/student.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // MySQL 데이터베이스 연결
const verifyToken = require('../middleware/verifyToken');

// 특정 프로그램의 학생 목록과 학생 수를 가져오는 API
router.get('/students/program/:programName', verifyToken, async (req, res) => {
    const programName = req.params.programName.trim();
    const { dojang_code } = req.user;
  
    try {
      console.log("Received programName:", programName);
      console.log("Received dojang_code:", dojang_code);
  
      const programSql = `SELECT id FROM programs WHERE name = ? COLLATE utf8mb4_general_ci AND dojang_code = ?`;
      const [programResult] = await db.query(programSql, [programName, dojang_code]);
  
      // 프로그램 조회 결과 출력
      console.log("Program Result:", programResult);
  
      if (programResult.length === 0) {
        console.error("Program not found with given name and dojang code:", { programName, dojang_code });
        return res.status(404).json({ error: 'Program not found' });
      }
  
      const programId = programResult[0].id;
  
      console.log("Fetched Program ID:", programId);
  
      const studentSql = `SELECT * FROM students WHERE program_id = ? AND dojang_code = ?`;
      const [students] = await db.query(studentSql, [programId, dojang_code]);
      const studentCount = students.length;
  
      res.json({ students, studentCount });
    } catch (error) {
      console.error(`Error fetching students for program ${programName} with dojang code ${dojang_code}:`, error);
      res.status(500).json({ error: 'Failed to fetch students for the program' });
    }
  });
  
  

// 전체 학생 목록 가져오기
router.get('/students', verifyToken, async (req, res) => {
    try {
      const sql = `SELECT * FROM students WHERE dojang_code = ?`;
      const [students] = await db.query(sql, [req.user.dojang_code]);
      res.status(200).json(students);
    } catch (err) {
      console.error('Error fetching students:', err);
      res.status(500).json({ message: 'Database error', error: err });
    }
  });

  router.get('/studentmanagement', verifyToken, async (req, res) => {
    try {
      // dojang_code를 변수로 추출하여 SQL injection 방지 및 가독성 향상
      const dojangCode = req.user.dojang_code; 
      
      const sql = `
        SELECT
          s.id,
          s.parent_id,
          s.first_name,
          s.last_name,
          s.gender,
          s.birth_date,
          TIMESTAMPDIFF(YEAR, s.birth_date, CURDATE()) AS age,
          s.belt_rank,
          b.belt_color,
          b.stripe_color,
          s.program_id,
          p.name AS program_name,
          s.profile_image,
          s.belt_size,
          s.dojang_code,
          s.created_at,
          
          -- ⭐ 1. 현재 출석 횟수 (attendance_records 테이블 사용)
          COALESCE(att.attendance_count, 0) AS attendance,
          
          -- ⭐ 2. 테스트 필요 출석 횟수 (testcondition 테이블 사용)
          COALESCE(tc.attendance_required, 0) AS required_attendance 
          
        FROM
          students s
        LEFT JOIN
          beltsystem b ON s.belt_rank = b.belt_rank AND s.dojang_code = b.dojang_code
        LEFT JOIN
          programs p ON s.program_id = p.id
          
        -- ⭐ 3. 현재 출석 횟수를 가져오는 서브쿼리 조인
        LEFT JOIN
          ( 
            SELECT 
              student_id, 
              COUNT(id) AS attendance_count
            FROM 
              attendance_records 
            WHERE 
              dojang_code = ? 
            GROUP BY 
              student_id
          ) AS att ON s.id = att.student_id
          
        -- ⭐ 4. 테스트 조건을 가져오는 테이블 조인
        LEFT JOIN
          testcondition tc ON 
          s.belt_rank BETWEEN tc.belt_min_rank AND tc.belt_max_rank 
          AND s.dojang_code = tc.dojang_code
          
        WHERE
          s.dojang_code = ?
      `;
      
      // SQL 쿼리에 dojangCode 변수를 두 번 바인딩합니다 (att 서브쿼리 및 메인 WHERE 절)
      const [students] = await db.query(sql, [dojangCode, dojangCode]);
      res.status(200).json(students);
    } catch (err) {
      console.error('Error fetching students:', err);
      // 에러가 발생한 경우 클라이언트에서 에러를 처리할 수 있도록 응답합니다.
      res.status(500).json({ message: 'Database error', error: err.message });
    }
});


router.get('/programs/basic', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;
  
    try {
      const sql = `
        SELECT p.id, p.name, COUNT(s.id) AS student_count
        FROM programs p
        LEFT JOIN students s ON p.id = s.program_id AND s.dojang_code = p.dojang_code
        WHERE p.dojang_code = ?
        GROUP BY p.id
      `;
  
      const [programs] = await db.query(sql, [dojang_code]);
      res.status(200).json(programs);
    } catch (err) {
      console.error('Error fetching programs with student count:', err);
      res.status(500).json({ message: 'Database error', error: err });
    }
  });
  
  

module.exports = router;
