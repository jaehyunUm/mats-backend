const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db'); // 데이터베이스 연결 불러오기
const router = express.Router();

// ✅ 로그인 엔드포인트
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    let user;
    let role;

    const queryUsers = `SELECT * FROM Users WHERE email = ?`;
    const [userResults] = await db.query(queryUsers, [email]);

    if (userResults.length > 0) {
      user = userResults[0];
      role = 'owner';
    } else {
      const queryParents = `SELECT * FROM Parents WHERE email = ?`;
      const [parentResults] = await db.query(queryParents, [email]);

      if (parentResults.length === 0) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      user = parentResults[0];
      role = 'parent';
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    let subscriptionStatus = 'active';
    if (role === 'owner') {
      const createdAt = new Date(user.created_at);
      const now = new Date();
      const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    
      if (diffDays <= 60) {
        subscriptionStatus = 'trial';
        console.log('🟢 DEBUG: subscriptionStatus set to trial');
      } else {
        const [subscriptions] = await db.query(
          'SELECT status FROM subscriptions WHERE dojang_code = ? ORDER BY next_billing_date DESC LIMIT 1',
          [user.dojang_code]
        );
    
        console.log('🟢 DEBUG: subscription record from DB:', subscriptions);
    
        if (!subscriptions || subscriptions.length === 0) {
          subscriptionStatus = 'no_subscription';
          console.log('🟢 DEBUG: subscriptionStatus set to no_subscription');
        } else if (subscriptions[0].status !== 'active') {
          subscriptionStatus = subscriptions[0].status.toLowerCase();
          console.log(`🟢 DEBUG: subscriptionStatus set to ${subscriptionStatus}`);
        } else {
          subscriptionStatus = 'active';
          console.log('🟢 DEBUG: subscriptionStatus confirmed as active');
        }
      }
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
      { expiresIn: '1h' }
    );

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
    console.error('Database connection error:', error);
    return res.status(500).json({ message: 'Database connection error' });
  }
});


module.exports = router;
