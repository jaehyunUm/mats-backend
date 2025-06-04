// routes/signupRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const router = express.Router();
const saltRounds = 10; // 비밀번호 해싱 강도


router.post('/signup', async (req, res) => {
  const { first_name, last_name, email, password, owner_code, role, studio_name, privacy_policy_agreed } = req.body;

  if (!first_name || !last_name || !email || !password || !owner_code || !studio_name) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // 오너 코드 검증
    const [codeResult] = await db.query('SELECT * FROM ownercodes WHERE email = ? AND owner_code = ?', [email, owner_code]);

    if (codeResult.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired owner code' });
    }

    // 30분 유효기간 체크
    const createdAt = new Date(codeResult[0].created_at);
    const now = new Date();
    const diffMinutes = Math.floor((now - createdAt) / (1000 * 60));

    if (diffMinutes > 30) {
      await db.query('DELETE FROM ownercodes WHERE email = ?', [email]);
      return res.status(400).json({ message: 'Owner code has expired' });
    }

    // 이메일 중복 확인
    const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Email is already in use' });
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 고유한 도장 코드 생성
    const dojang_code = `DJ${Date.now()}`;

    // 도장 정보 저장
    await db.query(
      'INSERT INTO dojangs (dojang_code, dojang_name) VALUES (?, ?)',
      [dojang_code, studio_name.trim()]
    );

    // ✅ 사용자 등록 (privacy_policy_agreed 및 동의 일시 포함)
    await db.query(
      `INSERT INTO users 
      (first_name, last_name, email, password, role, owner_code, dojang_code, privacy_policy_agreed, privacy_policy_agreed_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        first_name.trim(), 
        last_name.trim(), 
        email.trim(), 
        hashedPassword, 
        role.trim(), 
        owner_code, 
        dojang_code, 
        privacy_policy_agreed ? 1 : 0, 
        privacy_policy_agreed ? new Date() : null
      ]
    );

    await db.query('DELETE FROM ownercodes WHERE email = ?', [email]);

    res.status(201).json({ message: 'Owner signed up successfully' });

  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).json({ message: 'Server error, please try again later' });
  }
});

router.delete('/delete-account', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting account' });
  }
});



module.exports = router;
