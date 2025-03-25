const express = require('express');
const router = express.Router();
const db = require('../db'); // 데이터베이스 연결 설정 파일
const verifyToken = require('../middleware/verifyToken');

// Program 결제 내역 조회
router.get('/payment-history/program', verifyToken, async (req, res) => {
    const parentId = req.query.parent_id;
    const { dojang_code } = req.user;

    try  {
        const [rows] = await db.query(
            `SELECT 
                p.name AS program_name, 
                pp.amount, 
                pp.payment_date, 
                pp.status, 
                s.first_name, 
                s.last_name 
             FROM program_payments pp
             JOIN programs p ON pp.program_id = p.id
             JOIN students s ON pp.student_id = s.id  -- ✅ students 테이블 조인
             WHERE pp.parent_id = ? 
             AND pp.dojang_code = ? 
             AND pp.status = 'completed'`,
            [parentId, dojang_code]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching program payment history:', error);
        res.status(500).json({ message: 'Error fetching program payment history' });
    }
});

// Test 결제 내역 조회
router.get('/payment-history/test', verifyToken, async (req, res) => {
    const parentId = req.query.parent_id;
    const { dojang_code } = req.user;

    try {
        const [rows] = await db.query(
            `SELECT 
                tp.id AS payment_id, 
                tp.amount, 
                tp.payment_date, 
                tp.status, 
                s.first_name AS student_first_name, 
                s.last_name AS student_last_name 
             FROM test_payments tp
             JOIN students s ON tp.student_id = s.id
             WHERE tp.parent_id = ? 
               AND tp.dojang_code = ? 
               AND s.dojang_code = ?
               AND tp.status = 'completed'`,
            [parentId, dojang_code, dojang_code]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error fetching test payment history:', error);
        res.status(500).json({ message: 'Error fetching test payment history' });
    }
});

// Order 결제 내역 조회
router.get('/payment-history/order', verifyToken, async (req, res) => {
    const parentId = req.query.parent_id;
    const { dojang_code } = req.user;

    try {
        const [rows] = await db.query(
            `SELECT 
                i.name AS item_name, 
                ip.quantity, 
                ip.amount, 
                ip.payment_date, 
                ip.status, 
                s.first_name, 
                s.last_name
             FROM item_payments ip
             JOIN items i ON ip.item_id = i.id
             JOIN students s ON ip.student_id = s.id  -- ✅ students 테이블 조인
             WHERE ip.parent_id = ? 
             AND ip.dojang_code = ? 
             AND ip.status = 'completed'`,
            [parentId, dojang_code]
        );
        

        res.json(rows);
    } catch (error) {
        console.error('Error fetching order payment history:', error);
        res.status(500).json({ message: 'Error fetching order payment history' });
    }
});

module.exports = router;
