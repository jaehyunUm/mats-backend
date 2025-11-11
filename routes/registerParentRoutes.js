// routes/registerParentRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db'); // 데이터베이스 연결 가져오기

router.post('/register-parent', async (req, res) => {
    // 1. req.body에서 변수를 'let'으로 받습니다. (수정해야 하므로)
    let { firstName, lastName, selectedDojang, email, phone } = req.body;
    // 수정하지 않을 변수는 'const'로 받아도 됩니다.
    const { password, privacy_policy_agreed } = req.body;

    // ✅ 2. 데이터베이스 저장 전 공백 제거
    // .trim() : 문자열 앞뒤의 공백만 제거 (이름, 이메일 등에 적합)
    if (firstName) firstName = firstName.trim();
    if (lastName) lastName = lastName.trim();
    if (selectedDojang) selectedDojang = selectedDojang.trim();
    if (email) email = email.trim();

    // .replace(/\s/g, '') : 모든 공백(중간 공백 포함) 제거 (전화번호에 적합)
    // 사용자의 전화번호 정규식(/^\d{10,15}$/)이 숫자만 허용하므로,
    // "123 456 7890" 같은 입력을 "1234567890"으로 바꿔줍니다.
    if (phone) phone = phone.replace(/\s/g, '');

    // password는 사용자가 의도적으로 공백을 넣을 수 있으므로 절대 .trim() 하지 않습니다.


    // ✅ 3. 공백 제거된 데이터로 유효성 검사
    if (!firstName || !lastName || !selectedDojang || !email || !password || !phone) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(phone)) { // 공백 제거된 phone으로 검사
        return res.status(400).json({ message: 'Invalid phone number. Please enter a valid phone number.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // 원본 password

        // ✅ 4. 공백 제거된 데이터로 INSERT
        const query = `
            INSERT INTO parents 
            (first_name, last_name, dojang_code, email, password, phone, role, privacy_policy_agreed, privacy_policy_agreed_at)
            VALUES (?, ?, ?, ?, ?, ?,'parent', ?, ?)
        `;

        const [result] = await db.query(query, [
            firstName, // (Trimmed)
            lastName,  // (Trimmed)
            selectedDojang, // (Trimmed)
            email,     // (Trimmed)
            hashedPassword,
            phone,     // (All spaces removed)
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
