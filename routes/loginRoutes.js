const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db'); // 데이터베이스 연결 불러오기
const router = express.Router();

// ✅ 로그인 엔드포인트
router.post('/login', async (req, res) => {
  console.log('🔐 [login] ====== 로그인 요청 시작 ======');
  console.log('🕒 [login] 요청 시간:', new Date().toISOString());
  console.log('📧 [login] 이메일:', req.body.email);
  
  const { email, password } = req.body;

  if (!email || !password) {
    console.log('❌ [login] 이메일 또는 비밀번호 누락');
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    let user;
    let role;

    const queryUsers = `SELECT * FROM users WHERE email = ?`;
    const [userResults] = await db.query(queryUsers, [email]);

    if (userResults.length > 0) {
      user = userResults[0];
      role = 'owner';
      console.log('👑 [login] Owner 사용자 발견:', user.id);
    } else {
      const queryParents = `SELECT * FROM parents WHERE email = ?`;
      const [parentResults] = await db.query(queryParents, [email]);

      if (parentResults.length === 0) {
        console.log('❌ [login] 사용자를 찾을 수 없음');
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      user = parentResults[0];
      role = 'parent';
      console.log('👨‍👩‍👧‍👦 [login] Parent 사용자 발견:', user.id);
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log('❌ [login] 비밀번호 불일치');
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    let subscriptionStatus = 'active';
    if (role === 'owner') {
      console.log('🔍 [login] Owner 구독 상태 확인 시작');
      console.log('📅 [login] 사용자 생성일:', user.created_at);
      
      const createdAt = new Date(user.created_at);
      const now = new Date();
      const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
      
      console.log('📊 [login] 가입 후 경과일:', diffDays);
    
      if (diffDays <= 30) {
        subscriptionStatus = 'trial';
        console.log('🟢 [login] 30일 이내 - trial 상태로 설정');
      } else {
        console.log('🔍 [login] 30일 초과 - DB에서 구독 상태 확인');
        const [subscriptions] = await db.query(
          'SELECT status FROM owner_bank_accounts WHERE dojang_code = ? ORDER BY created_at DESC LIMIT 1',
          [user.dojang_code]
        );
        
        console.log('📊 [login] owner_bank_accounts 조회 결과:', subscriptions);
        
        if (!subscriptions || subscriptions.length === 0) {
          subscriptionStatus = 'no_subscription';
          console.log('🔴 [login] 구독 기록 없음 - no_subscription으로 설정');
        } else if (subscriptions[0].status !== 'active') {
          subscriptionStatus = subscriptions[0].status.toLowerCase();
          console.log(`🟡 [login] 구독 상태: ${subscriptionStatus}`);
        } else {
          subscriptionStatus = 'active';
          console.log('✅ [login] 활성 구독 확인됨');
        }
      }
    } else {
      console.log('👨‍👩‍👧‍👦 [login] Parent 사용자 - 구독 확인 건너뜀');
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.first_name,
        role,
        dojang_code: user.dojang_code,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        name: user.first_name,
        role,
        dojang_code: user.dojang_code,
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '30d' }
    );

    console.log('✅ [login] 로그인 성공 - 응답 전송');
    console.log('📊 [login] 최종 subscriptionStatus:', subscriptionStatus);
    console.log('👤 [login] 사용자 역할:', role);
    console.log('🔑 [login] dojang_code:', user.dojang_code);

    return res.status(200).json({
      message: 'Login successful',
      token,
      refreshToken,
      subscriptionStatus,
      userData: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        name: `${user.first_name} ${user.last_name}`,
        customer_id: user.customer_id,
        role,
        dojang_code: user.dojang_code,
      }
    });

  } catch (error) {
    console.error('❌ [login] 데이터베이스 연결 오류:', error);
    return res.status(500).json({ message: 'Database connection error' });
  } finally {
    console.log('📤 [login] ====== 로그인 요청 완료 ======');
  }
});

// ✅ Refresh Token으로 새로운 Access Token을 발급하는 엔드포인트
router.post('/refresh-token', (req, res) => {
  const { token: refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh Token is required' });
  }

  // Refresh Token이 유효한지 확인
  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) {
      // Refresh Token이 만료되었거나 유효하지 않으면 재로그인 필요
      console.error('❌ Refresh Token is invalid or expired:', err.message);
      return res.status(403).json({ message: 'Invalid Refresh Token. Please log in again.' });
    }

    // Refresh Token이 유효하면, 새로운 Access Token을 생성
    const newAccessToken = jwt.sign(
      {
        id: user.id,
        name: user.name,
        role: user.role,
        dojang_code: user.dojang_code,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' } // 새로운 Access Token의 유효기간
    );

    console.log('✅ [refresh-token] New Access Token issued for user:', user.id);
    
    res.json({
      accessToken: newAccessToken
    });
  });
});



module.exports = router;
