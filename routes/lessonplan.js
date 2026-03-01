const express = require('express');
const router = express.Router();
const db = require('../db'); // 관장님의 MySQL 연결 파일 경로에 맞게 수정해주세요
const verifyToken = require('../middleware/verifyToken');
// ==========================================
// 1. 카테고리 (Lesson Categories) API
// ==========================================

// [GET] 관장님만의 카테고리 목록 불러오기
router.get('/lessonplan/categories', verifyToken, async (req, res) => {
  const userId = req.user.id;
  
  try {
    const [categories] = await db.query(
      'SELECT id, name as label, color FROM lesson_categories WHERE user_id = ?',
      [userId]
    );
    res.json({ success: true, categories });
  } catch (err) {
    console.error('카테고리 불러오기 에러:', err);
    res.status(500).json({ success: false, message: '서버 에러가 발생했습니다.' });
  }
});

// [DELETE] 카테고리 삭제하기
router.delete('/lessonplan/categories/:id', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const categoryId = req.params.id;
    
    try {
      // 보안: 반드시 본인(user_id)이 만든 카테고리만 삭제되도록 확인합니다.
      const [result] = await db.query(
        'DELETE FROM lesson_categories WHERE id = ? AND user_id = ?', 
        [categoryId, userId]
      );
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '카테고리를 찾을 수 없거나 삭제 권한이 없습니다.' });
      }
  
      res.json({ success: true, message: '카테고리가 삭제되었습니다.' });
    } catch (err) {
      console.error('카테고리 삭제 에러:', err);
      res.status(500).json({ success: false, message: '서버 에러가 발생했습니다.' });
    }
  });

// [POST] 새 카테고리 만들기
router.post('/lessonplan/categories', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { label, color } = req.body;
  
  try {
    const [result] = await db.query(
      'INSERT INTO lesson_categories (user_id, name, color) VALUES (?, ?, ?)',
      [userId, label, color]
    );
    res.json({ 
      success: true, 
      category: { id: result.insertId, label, color } 
    });
  } catch (err) {
    console.error('카테고리 생성 에러:', err);
    res.status(500).json({ success: false, message: '서버 에러가 발생했습니다.' });
  }
});

// ==========================================
// 2. 레슨 플랜 (Lesson Plans) API
// ==========================================

// [GET] 특정 기간(start_date ~ end_date)의 레슨 플랜 불러오기
router.get('/lessonplan', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { startDate, endDate } = req.query; // 예: ?startDate=2026-03-02&endDate=2026-03-07
  
  try {
    // 레슨 플랜과 카테고리 테이블을 JOIN해서 색상과 이름까지 한 번에 가져옵니다.
    const query = `
      SELECT 
        p.id, 
        p.category_id, 
        DATE_FORMAT(p.start_date, '%Y-%m-%d') as start_date, 
        DATE_FORMAT(p.end_date, '%Y-%m-%d') as end_date, 
        p.start_time as start, 
        p.end_time as end, 
        p.title, 
        c.name as type, 
        c.color 
      FROM lesson_plans p
      LEFT JOIN lesson_categories c ON p.category_id = c.id
      WHERE p.user_id = ? AND p.start_date = ? AND p.end_date = ?
      ORDER BY p.start_time ASC
    `;
    
    const [plans] = await db.query(query, [userId, startDate, endDate]);
    res.json({ success: true, plans });
  } catch (err) {
    console.error('레슨 플랜 불러오기 에러:', err);
    res.status(500).json({ success: false, message: '서버 에러가 발생했습니다.' });
  }
});

// [POST] 새로운 훈련 조각(Segment) 추가하기
router.post('/lessonplan', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { categoryId, startDate, endDate, startTime, endTime, title } = req.body;
  
  try {
    const [result] = await db.query(
      `INSERT INTO lesson_plans 
      (user_id, category_id, start_date, end_date, start_time, end_time, title) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, categoryId, startDate, endDate, startTime, endTime, title]
    );
    
    res.json({ 
      success: true, 
      message: '성공적으로 추가되었습니다.',
      planId: result.insertId
    });
  } catch (err) {
    console.error('레슨 플랜 저장 에러:', err);
    res.status(500).json({ success: false, message: '서버 에러가 발생했습니다.' });
  }
});

// [DELETE] 훈련 조각(Segment) 삭제하기
router.delete('/lessonplan/:id', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const planId = req.params.id;
  
  try {
    // 보안: 반드시 본인(user_id)이 작성한 글만 삭제되도록 확인합니다.
    await db.query('DELETE FROM lesson_plans WHERE id = ? AND user_id = ?', [planId, userId]);
    res.json({ success: true, message: '삭제되었습니다.' });
  } catch (err) {
    console.error('레슨 플랜 삭제 에러:', err);
    res.status(500).json({ success: false, message: '서버 에러가 발생했습니다.' });
  }
});

module.exports = router;