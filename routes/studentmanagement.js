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
  
  

// 학생 검색 및 전체 목록 조회 API
router.get('/students', verifyToken, async (req, res) => {
  // 1. 프론트엔드에서 보낸 검색어(?search=...)를 받습니다.
  const { search } = req.query;
  const { dojang_code } = req.user; // 토큰에서 도장 코드 추출

  try {
    // 2. SQL 쿼리 작성
    // - students 테이블(s)을 기준
    // - programs 테이블(p)을 LEFT JOIN하여 프로그램 이름 가져오기
    // - [핵심] 서브쿼리를 사용하여 attendance 테이블에서 'present' 상태인 출석 수 카운트
    let sql = `
      SELECT 
        s.*, 
        p.name AS program_name,
        (
          SELECT COUNT(*) 
          FROM attendance AS a 
          WHERE a.student_id = s.id 
            AND a.status = 'present' 
            AND a.dojang_code = s.dojang_code
        ) AS attendance_count
      FROM 
        students AS s
      LEFT JOIN 
        programs AS p ON s.program_id = p.id
      WHERE 
        s.dojang_code = ?
    `;
    
    // 기본 파라미터 (도장 코드)
    const params = [dojang_code];

    // 3. 만약 'search' 쿼리 파라미터가 존재하면, 검색 조건(AND)을 추가
    if (search) {
      sql += `
        AND (
          s.first_name LIKE ? OR
          s.last_name LIKE ? OR
          p.name LIKE ?
        )
      `;
      // 검색어 앞뒤에 %를 붙여 부분 일치 검색 ('John' -> '%John%')
      const searchTerm = `%${search}%`;
      // 이름(성, 이름) 또는 프로그램 이름에 검색어가 포함되는지 확인
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    // 4. 최신순 정렬 (선택 사항, 필요 없으면 제거 가능)
    sql += ` ORDER BY s.first_name ASC`;

    // 5. 최종 SQL 실행
    const [students] = await db.query(sql, params);
    
    // 6. 결과 전송
    res.status(200).json(students);

  } catch (err) {
    console.error('❌ Error fetching students:', err);
    res.status(500).json({ message: 'Database error', error: err });
  }
});

  router.get('/studentmanagement', verifyToken, async (req, res) => {
    try {
      const dojangCode = req.user.dojang_code; 
      
      const sql = `
        SELECT
          s.*,
          TIMESTAMPDIFF(YEAR, s.birth_date, CURDATE()) AS age,
          b.belt_color,
          b.stripe_color,
          p.name AS program_name,
          
          -- 1. 현재 출석 횟수 집계
          COALESCE(att.attendance_count, 0) AS attendance,
          
          -- 2. 테스트 필요 출석 횟수
          COALESCE(
            (
              SELECT tc.attendance_required
              FROM testcondition tc
              WHERE s.belt_rank BETWEEN tc.belt_min_rank AND tc.belt_max_rank 
                AND tc.dojang_code = s.dojang_code
              ORDER BY tc.belt_min_rank DESC 
              LIMIT 1
            ), 0) AS required_attendance
          
        FROM
          students s
        LEFT JOIN
          beltsystem b ON s.belt_rank = b.belt_rank AND s.dojang_code = b.dojang_code
        LEFT JOIN
          programs p ON s.program_id = p.id
          
        -- 3. 현재 출석 횟수를 가져오는 서브쿼리 조인
        LEFT JOIN
          ( 
            SELECT 
              student_id, 
              COUNT(id) AS attendance_count
            FROM 
              attendance  /* ⭐⭐⭐ 이 부분이 'attendance'로 수정됨! ⭐⭐⭐ */
            WHERE 
              dojang_code = ? 
            GROUP BY 
              student_id
          ) AS att ON s.id = att.student_id
          
        WHERE
          s.dojang_code = ?
          AND s.program_id IS NOT NULL -- ⭐️ 이 줄을 추가
      `;
      
      // SQL 쿼리에 dojangCode 변수를 두 번 바인딩
      const [students] = await db.query(sql, [dojangCode, dojangCode]);
      res.status(200).json(students);
    } catch (err) {
      console.error('Error fetching students:', err);
      // 최종적으로 에러 메시지를 간결하게 반환합니다.
      res.status(500).json({ message: 'Database error occurred while fetching students.' });
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
