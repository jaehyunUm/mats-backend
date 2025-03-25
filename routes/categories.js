const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 파일
const verifyToken = require('../middleware/verifyToken');

// 카테고리 추가 API
router.post('/', verifyToken, async (req, res) => {
  const { name } = req.body;
  const { dojang_code } = req.user;

  if (!name) {
    return res.status(400).json({ message: 'Category name is required' });
  }

  try {
    const query = 'INSERT INTO categories (name, dojang_code) VALUES (?, ?)';
    const [result] = await db.query(query, [name, dojang_code]);
    res.status(201).json({ message: 'Category added successfully', categoryId: result.insertId });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ message: 'Database error', error: err });
  }
});

// 도장 코드에 따른 카테고리 조회 API
router.get('/', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;
  
    try {
      const query = 'SELECT * FROM categories WHERE dojang_code = ?';
      const [results] = await db.query(query, [dojang_code]);
      res.status(200).json(results);
    } catch (err) {
      res.status(500).json({ message: 'Database error', error: err });
    }
  });

// 선택된 카테고리 삭제 API
router.delete('/:id', verifyToken, async (req, res) => {
    const categoryId = req.params.id;
    const { dojang_code } = req.user; // 미들웨어를 통해 추출된 도장 코드
  
    try {
      // 삭제 요청에 대한 권한 검증 (도장 코드 확인)
      const checkQuery = 'SELECT * FROM categories WHERE id = ? AND dojang_code = ?';
      const [category] = await db.query(checkQuery, [categoryId, dojang_code]);
  
      // 카테고리가 존재하지 않거나 다른 도장 코드에 속할 경우 에러 반환
      if (category.length === 0) {
        return res.status(404).json({ message: 'Category not found or not authorized' });
      }
  
      // 카테고리 삭제
      const deleteQuery = 'DELETE FROM categories WHERE id = ? AND dojang_code = ?';
      await db.query(deleteQuery, [categoryId, dojang_code]);
  
      res.status(200).json({ message: 'Category deleted successfully' });
    } catch (err) {
      res.status(500).json({ message: 'Database error', error: err });
    }
  });

module.exports = router;
