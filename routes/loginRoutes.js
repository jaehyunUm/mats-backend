const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db'); // 데이터베이스 연결 불러오기
const router = express.Router();

// ✅ 로그인 엔드포인트
router.post('/login', async (req, res) => {
  console.log('🔐 [login] ====== 로그인 요청 시작 (V2) ======');
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

    // --- 1. 사용자 조회 (Owner 또는 Parent) ---
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

    // --- 2. 비밀번호 확인 ---
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log('❌ [login] 비밀번호 불일치');
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // --- 3. 상태 변수 초기화 ---
    let subscriptionStatus = 'not_applicable'; // Parent 유저의 기본값
    let stripeConnectionStatus = 'not_applicable'; // Parent 유저의 기본값

    // --- 4. Owner일 경우에만 상태 확인 ---
    if (role === 'owner') {
      
      // ⭐️ [확인 A] 앱 구독 상태 (users 테이블)
      // 30일 무료 평가판 로직
      const createdAt = new Date(user.created_at);
      const now = new Date();
      const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
      
      console.log('📊 [login] 가입 후 경과일:', diffDays);

      if (diffDays <= 30 && (!user.subscription_status || user.subscription_status === 'inactive')) {
        subscriptionStatus = 'trial';
        console.log('🟢 [login] 30일 이내 - trial 상태로 설정');
      } else if (user.subscription_status === 'active' || user.subscription_status === 'trialing') {
        subscriptionStatus = user.subscription_status;
        console.log('✅ [login] users 테이블에서 "active" 또는 "trialing" 상태 확인');
      } else {
        subscriptionStatus = 'no_subscription'; // 30일 지났고, active가 아님
        console.log('🔴 [login] users 테이블 상태 "inactive" 또는 "null" -> no_subscription 설정');
      }

      // ⭐️ [확인 B] Stripe 연동 상태 (owner_bank_accounts 테이블)
      const [bankAccounts] = await db.query(
        'SELECT status FROM owner_bank_accounts WHERE dojang_code = ? LIMIT 1',
        [user.dojang_code]
      );

      if (!bankAccounts || bankAccounts.length === 0) {
        stripeConnectionStatus = 'not_connected'; // ⭐️ Stripe 연동 안 됨
        console.log('🟡 [login] owner_bank_accounts 기록 없음 -> not_connected');
      } else if (bankAccounts[0].status !== 'active') {
        stripeConnectionStatus = 'incomplete'; // ⭐️ 'incomplete' 등
        console.log(`🟡 [login] owner_bank_accounts 상태: ${bankAccounts[0].status} -> incomplete`);
      } else {
        stripeConnectionStatus = 'connected'; // ⭐️ 'active'
        console.log('✅ [login] owner_bank_accounts 상태: active -> connected');
      }
      
    } else {
      console.log('👨‍👩‍👧‍👦 [login] Parent 사용자 - 상태 확인 건너뜀');
    }

    // --- 5. 토큰 생성 ---
    const token = jwt.sign(
      {
        id: user.id,
        name: user.first_name,
        role,
        dojang_code: user.dojang_code,
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
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
    console.log('🔗 [login] 최종 stripeConnectionStatus:', stripeConnectionStatus);

    // --- 6. 최종 응답 전송 ---
    return res.status(200).json({
      message: 'Login successful',
      token,
      refreshToken,
      subscriptionStatus,       // ⭐️ 앱 구독 상태
      stripeConnectionStatus,   // ⭐️ Stripe 연동 상태
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
    console.log('📤 [login] ====== 로그인 요청 완료 (V2) ======');
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

JavaScript
// ✅ (추가된) 이메일 찾기 (아이디 찾기) 엔드포인트
router.post('/find-email', async (req, res) => {
  console.log('🔍 [find-email] ====== 이메일 찾기 요청 시작 ======');
  console.log('🕒 [find-email] 요청 시간:', new Date().toISOString());
  
  const { first_name, last_name, phone } = req.body;
  console.log('📝 [find-email] 요청 정보:', { first_name, last_name, phone });

  // --- 1. 입력값 유효성 검사 ---
  if (!first_name || !last_name || !phone) {
    console.log('❌ [find-email] 필수 정보 누락');
    return res.status(400).json({ message: 'First name, last name, and phone are required' });
  }

  try {
    const queryParams = [first_name, last_name, phone];

    // --- 2. users 테이블(Owner)에서 검색 ---
    const queryUsers = `
      SELECT email FROM users 
      WHERE first_name = ? AND last_name = ? AND phone = ?
    `;
    const [userResults] = await db.query(queryUsers, queryParams);
    
    // --- 3. parents 테이블에서 검색 ---
    const queryParents = `
      SELECT email FROM parents 
      WHERE first_name = ? AND last_name = ? AND phone = ?
    `;
    const [parentResults] = await db.query(queryParents, queryParams);

    // --- 4. 결과 취합 (Set을 사용해 중복 이메일 자동 제거) ---
    const foundEmails = new Set();

    if (userResults.length > 0) {
      userResults.forEach(user => foundEmails.add(user.email));
      console.log('👑 [find-email] users 테이블에서 이메일 발견:', userResults.map(u => u.email));
    }

    if (parentResults.length > 0) {
      parentResults.forEach(parent => foundEmails.add(parent.email));
      console.log('👨‍👩‍👧‍👦 [find-email] parents 테이블에서 이메일 발견:', parentResults.map(p => p.email));
    }

    const emailList = [...foundEmails]; // Set을 배열로 변환

    // --- 5. 최종 응답 ---
    if (emailList.length === 0) {
      // 일치하는 사용자가 없는 경우
      console.log('❌ [find-email] 일치하는 사용자를 찾을 수 없음');
      return res.status(404).json({ message: 'No user found with the provided information' });
    }

    // 일치하는 이메일을 찾은 경우
    console.log('✅ [find-email] 최종 이메일 목록:', emailList);

    // ⭐️ 보안 참고:
    // 실제 운영 환경에서는 이메일 주소 전체를 반환하는 대신,
    // 마스킹 처리된 이메일(e.g., s****n@g***.com)을 반환하거나,
    // "해당 정보와 일치하는 이메일로 안내 메일을 보냈습니다."라고 응답하는 것이 더 안전합니다.
    // 여기서는 요청하신 대로 찾은 이메일 목록을 반환합니다.
    
    return res.status(200).json({
      message: 'Email(s) found successfully',
      emails: emailList // 찾은 이메일 목록을 배열로 반환
    });

  } catch (error) {
    console.error('❌ [find-email] 데이터베이스 오류:', error);
    return res.status(500).json({ message: 'Database error occurred while finding email' });
  } finally {
    console.log('📤 [find-email] ====== 이메일 찾기 요청 완료 ======');
  }
});


module.exports = router;
