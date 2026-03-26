// routes/registerParentRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db'); // 데이터베이스 연결 가져오기

router.post('/register-parent', async (req, res) => {
    // ✅ 1. req.body에서 referral_source 추가로 받기
    let { firstName, lastName, selectedDojang, email, phone, referral_source } = req.body;
    const { password, privacy_policy_agreed } = req.body;

    // 데이터베이스 저장 전 공백 제거
    if (firstName) firstName = firstName.trim();
    if (lastName) lastName = lastName.trim();
    if (selectedDojang) selectedDojang = selectedDojang.trim();
    if (email) email = email.trim();
    
    // ✅ (선택사항) 전달받은 경로 데이터도 공백 제거
    if (referral_source) referral_source = referral_source.trim();

    if (phone) phone = phone.replace(/\s/g, '');

    // 유효성 검사 (가입 경로는 필수가 아니어도 가입되게 두거나, 필수로 만들고 싶다면 여기에 조건을 추가할 수 있습니다)
    if (!firstName || !lastName || !selectedDojang || !email || !password || !phone) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({ message: 'Invalid phone number. Please enter a valid phone number.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); 

        // ✅ 2. 쿼리에 referral_source 컬럼 및 VALUES의 ? 추가
        const query = `
            INSERT INTO parents 
            (first_name, last_name, dojang_code, email, password, phone, role, privacy_policy_agreed, privacy_policy_agreed_at, referral_source)
            VALUES (?, ?, ?, ?, ?, ?, 'parent', ?, ?, ?)
        `;

        // ✅ 3. 배열 마지막에 referral_source 값 추가 (값이 없을 경우 대비해 null 처리)
        const [result] = await db.query(query, [
            firstName,
            lastName,  
            selectedDojang, 
            email,     
            hashedPassword,
            phone,     
            privacy_policy_agreed ? 1 : 0,
            privacy_policy_agreed ? new Date() : null,
            referral_source || null 
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
