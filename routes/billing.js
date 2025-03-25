// billing.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');

// 저장된 카드 정보 불러오기 API
router.get('/card-info', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;
  const parentId = req.parentId;

  try {
    const [rows] = await db.query(
      `SELECT card_name, expiration, card_token
       FROM saved_cards
       WHERE dojang_code = ? AND parent_id = ?`,
      [dojang_code, parentId]
    );

    if (rows.length > 0) {
      const cardInfo = rows[0];
      res.json(cardInfo);
    } else {
      res.status(404).json({ message: 'No saved card found' });
    }
  } catch (error) {
    console.error('Error fetching saved card information:', error);
    res.status(500).json({ message: 'Error fetching saved card information' });
  }
});

module.exports = router;
