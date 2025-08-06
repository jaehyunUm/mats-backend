const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const bcrypt = require('bcryptjs');


// POST /api/change-password
router.post('/change-password', verifyToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const { id, role } = req.user;
  
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' });
    }
  
    const tableMap = {
      owner: 'users',
      parent: 'parents',
    };
  
    const tableName = tableMap[role];
  
    if (!tableName) {
      return res.status(400).json({ message: 'Invalid user role.' });
    }
  
    try {
      // 현재 비밀번호 확인
      const [rows] = await db.query(`SELECT password FROM ${tableName} WHERE id = ?`, [id]);
  
      if (rows.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }
  
      const user = rows[0];
      const isMatch = await bcrypt.compare(currentPassword, user.password);
  
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect.' });
      }
  
      // 비밀번호 변경
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.query(`UPDATE ${tableName} SET password = ? WHERE id = ?`, [hashedPassword, id]);
  
      return res.status(200).json({ message: 'Password changed successfully.' });
    } catch (err) {
      console.error('❌ Password Change Error:', err);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  });
  

module.exports = router;
