const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');

// ✅ 프로그램 결제 내역 조회 (도장 오너)
router.get('/owner/payment-history/program', verifyToken, async (req, res) => {
    try {
        const { dojang_code } = req.user; // ✅ `verifyToken`에서 설정된 값 사용

        console.log("🔹 [PROGRAM] Request Received - Dojang Code:", dojang_code);

        const query = `
            SELECT 
                p.name AS program_name, 
                pp.amount, 
                pp.payment_date, 
                pp.status, 
                s.first_name, 
                s.last_name 
            FROM program_payments pp
            JOIN programs p ON pp.program_id = p.id
            JOIN students s ON pp.student_id = s.id
            WHERE pp.dojang_code = ? 
              AND s.dojang_code = ?
              AND pp.status = 'completed'`;

        const [rows] = await db.query(query, [dojang_code, dojang_code]);

        console.log("✅ [PROGRAM] Query Result:", rows);
        res.json(rows);
    } catch (error) {
        console.error('❌ [PROGRAM] Error fetching payment history:', error);
        res.status(500).json({ success: false, message: 'Error fetching program payment history' });
    }
});

// ✅ 테스트 결제 내역 조회 (도장 오너)
router.get('/owner/payment-history/test', verifyToken, async (req, res) => {
    try {
        const { dojang_code } = req.user;

        console.log("🔹 [TEST] Request Received - Dojang Code:", dojang_code);

        const query = `
            SELECT 
                tp.id AS payment_id, 
                tp.amount, 
                tp.payment_date, 
                tp.status, 
                s.first_name AS student_first_name, 
                s.last_name AS student_last_name 
            FROM test_payments tp
            JOIN students s ON tp.student_id = s.id
            WHERE tp.dojang_code = ? 
              AND s.dojang_code = ?
              AND tp.status = 'completed'`;

        const [rows] = await db.query(query, [dojang_code, dojang_code]);

        console.log("✅ [TEST] Query Result:", rows);
        res.json(rows);
    } catch (error) {
        console.error('❌ [TEST] Error fetching test payment history:', error);
        res.status(500).json({ success: false, message: 'Error fetching test payment history' });
    }
});

// ✅ 상품 주문 결제 내역 조회 (도장 오너)
router.get('/owner/payment-history/order', verifyToken, async (req, res) => {
    try {
        const { dojang_code } = req.user;

        console.log("🔹 [ORDER] Request Received - Dojang Code:", dojang_code);

        const query = `
            SELECT 
                i.name AS item_name, 
                ip.quantity, 
                ip.amount, 
                ip.payment_date, 
                ip.status, 
                s.first_name, 
                s.last_name
            FROM item_payments ip
            JOIN items i ON ip.item_id = i.id
            JOIN students s ON ip.student_id = s.id
            WHERE ip.dojang_code = ? 
              AND s.dojang_code = ?
              AND ip.status = 'completed'`;

        const [rows] = await db.query(query, [dojang_code, dojang_code]);

        console.log("✅ [ORDER] Query Result:", rows);
        res.json(rows);
    } catch (error) {
        console.error('❌ [ORDER] Error fetching order payment history:', error);
        res.status(500).json({ success: false, message: 'Error fetching order payment history' });
    }
});

module.exports = router;
