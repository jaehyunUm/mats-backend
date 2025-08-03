// routes/registerParentRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db'); // 데이터베이스 연결 가져오기

router.post('/register-parent', async (req, res) => {
    const { firstName, lastName, selectedDojang, email, password, phone, privacy_policy_agreed } = req.body;

  // 수정 후:
if (!firstName || !lastName || !selectedDojang || !email || !password || !phone) {
    return res.status(400).json({ message: 'Missing required fields' });
}

    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({ message: 'Invalid phone number. Please enter a valid phone number.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // ✅ 개인정보처리방침 동의 정보 포함하여 INSERT
        const query = `
            INSERT INTO parents 
            (first_name, last_name, dojang_code, email, password, phone, role, privacy_policy_agreed, privacy_policy_agreed_at)
            VALUES (?, ?, ?, ?, ?, ?,'parent', ?, ?)
        `;

        const [result] = await db.query(query, [
            firstName,
            lastName,
            selectedDojang,
            email,
            hashedPassword,
            phone,
            privacy_policy_agreed ? 1 : 0,
            privacy_policy_agreed ? new Date() : null
          ]);
          

        res.status(201).json({ message: 'Parent registered successfully' });
        
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Database error', error: err });
    }
});


module.exports = router;
