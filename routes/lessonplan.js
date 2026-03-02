const express = require('express');
const router = express.Router();
const db = require('../db'); 
const verifyToken = require('../middleware/verifyToken');


router.get('/lessonplan/categories', verifyToken, async (req, res) => {
    const { dojang_code } = req.user; 
    
    try {
      const [categories] = await db.query(
        'SELECT id, name as label, color FROM lesson_categories WHERE dojang_code = ?',
        [dojang_code]
      );
      res.json({ success: true, categories });
    } catch (err) {
      console.error('Category fetch error:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
  
  // [POST] /api/lessonplan/categories
  router.post('/lessonplan/categories', verifyToken, async (req, res) => {
    const { id: userId, dojang_code } = req.user; 
    const { label, color } = req.body;
    
    try {
      // DESC 결과에 맞춰 user_id와 dojang_code를 모두 저장합니다.
      const [result] = await db.query(
        'INSERT INTO lesson_categories (user_id, dojang_code, name, color) VALUES (?, ?, ?, ?)',
        [userId, dojang_code, label, color]
      );
      res.json({ 
        success: true, 
        category: { id: result.insertId, label, color } 
      });
    } catch (err) {
      console.error('Category creation error:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
  
  // ==========================================
  // 2. 레슨 플랜 (Lesson Plans) API
  // ==========================================
  
  // [GET] /api/lessonplan
// [GET] 특정 기간 레슨 플랜 불러오기
router.get('/lessonplan', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;
    const { startDate, endDate } = req.query; // 앱에서 요청한 이번 주 월요일(startDate), 토요일(endDate)
    
    try {
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
        WHERE p.dojang_code = ? 
          -- 🌟 [핵심] 정확히 일치(=)가 아니라, 기간이 조금이라도 겹치면 다 가져오도록 수정!
          AND p.start_date <= ? 
          AND p.end_date >= ?
        ORDER BY p.start_time ASC
      `;
      
      // 🌟 주의: ? 에 들어갈 순서가 endDate, startDate 순서로 바뀝니다.
      const [plans] = await db.query(query, [dojang_code, endDate, startDate]);
      res.json({ success: true, plans });
    } catch (err) {
      console.error('Plan fetch error:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
  
  // [POST] /api/lessonplan
  router.post('/lessonplan', verifyToken, async (req, res) => {
    const { id: userId, dojang_code } = req.user;
    const { categoryId, startDate, endDate, startTime, endTime, title } = req.body;
    
    try {
      const [result] = await db.query(
        `INSERT INTO lesson_plans 
        (user_id, dojang_code, category_id, start_date, end_date, start_time, end_time, title) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, dojang_code, categoryId, startDate, endDate, startTime, endTime, title]
      );
      
      res.json({ success: true, planId: result.insertId });
    } catch (err) {
      console.error('Plan save error:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
  
  // [DELETE] /api/lessonplan/:id
  router.delete('/lessonplan/:id', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;
    const planId = req.params.id;
    
    try {
      await db.query('DELETE FROM lesson_plans WHERE id = ? AND dojang_code = ?', [planId, dojang_code]);
      res.json({ success: true });
    } catch (err) {
      console.error('Delete error:', err);
      res.status(500).json({ success: false });
    }
  });

  router.delete('/lessonplan/categories/:id', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;
    const categoryId = req.params.id;
    
    try {
      // 보안을 위해 dojang_code가 일치하는 카테고리만 삭제
      const [result] = await db.query(
        'DELETE FROM lesson_categories WHERE id = ? AND dojang_code = ?', 
        [categoryId, dojang_code]
      );
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Category not found or access denied.' });
      }
  
      res.json({ success: true, message: 'Category deleted successfully.' });
    } catch (err) {
      console.error('Delete category error:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
  
  module.exports = router;