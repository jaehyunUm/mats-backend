// classConditionsRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // DB 모듈
const verifyToken = require('../middleware/verifyToken');

// 클래스 이름 중복 확인 API
router.post('/check-class-name', verifyToken, async (req, res) => {
    const { className } = req.body;
    const { dojang_code } = req.user;

    const query = 'SELECT id FROM classconditions WHERE class_name = ? AND dojang_code = ?';

    try {
        const [results] = await db.query(query, [className, dojang_code]);

        if (results.length > 0) {
            return res.status(200).json({ exists: true, id: results[0].id });
        } else {
            return res.status(200).json({ exists: false });
        }
    } catch (err) {
        console.error('Error checking class name:', err);
        res.status(500).json({ message: 'Database error' });
    }
});

// 클래스 조건 수정 API
router.post('/edit-condition', verifyToken, async (req, res) => {
    const { id, className, beltMin, beltMax, ageMin, ageMax, maxCapacity } = req.body;
    const { dojang_code } = req.user;

    try {
        const checkQuery = 'SELECT * FROM classconditions WHERE class_name = ? AND id != ? AND dojang_code = ?';
        const [results] = await db.query(checkQuery, [className, id, dojang_code]);

        if (results.length > 0) {
            return res.status(400).json({ message: 'Class name already exists' });
        }

        const query = `
            UPDATE classconditions
            SET class_name = ?, belt_min_rank = ?, belt_max_rank = ?, age_min = ?, age_max = ?, class_max_capacity = ?
            WHERE id = ? AND dojang_code = ?
        `;

        const values = [className, beltMin, beltMax, ageMin, ageMax, maxCapacity, id, dojang_code];
        await db.query(query, values);
        res.status(200).json({ message: 'Condition updated successfully' });
    } catch (err) {
        console.error('Error updating condition:', err);
        res.status(500).json({ message: 'Database error' });
    }
});

// 조건을 추가하는 엔드포인트
router.post('/add-condition', verifyToken, async (req, res) => {
    const { className, beltMin, beltMax, ageMin, ageMax } = req.body;
    const { dojang_code } = req.user;

    const query = `
        INSERT INTO classconditions (class_name, belt_min_rank, belt_max_rank, age_min, age_max, dojang_code)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [className, beltMin, beltMax, ageMin, ageMax, dojang_code];

    try {
        const [result] = await db.query(query, values);
        res.status(200).json({ message: 'Class condition added successfully', result });
    } catch (err) {
        console.error('Error inserting class condition:', err);
        res.status(500).json({ message: 'Database error' });
    }
});

// 클래스 조건 목록을 가져오는 엔드포인트
router.get('/get-conditions', verifyToken, async (req, res) => {
    const { dojang_code } = req.user;
    const query = 'SELECT * FROM classconditions WHERE dojang_code = ?';

    try {
        const [results] = await db.query(query, [dojang_code]);
        res.status(200).json(results);
    } catch (err) {
        console.error('Error fetching class conditions:', err);
        res.status(500).json({ message: 'Database error' });
    }
});

// 클래스 조건 삭제 API
router.delete('/delete-condition/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { dojang_code } = req.user;

    const query = 'DELETE FROM classconditions WHERE id = ? AND dojang_code = ?';

    try {
        const [result] = await db.query(query, [id, dojang_code]);
        res.status(200).json({ message: 'Condition deleted successfully' });
    } catch (err) {
        console.error('Error deleting condition:', err);
        res.status(500).json({ message: 'Database error' });
    }
});

module.exports = router;
