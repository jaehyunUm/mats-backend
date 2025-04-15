const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');

router.get('/children/:parentId', verifyToken, async (req, res) => {
  const { parentId } = req.params;
  const { dojang_code } = req.user;

  try {
    const query = `
      SELECT 
        s.id, 
        s.first_name, 
        s.last_name, 
        s.birth_date, 
        s.gender, 
        s.belt_rank, 
        s.belt_size,
        b.belt_color,
        b.stripe_color
      FROM students s
      LEFT JOIN beltsystem b 
        ON s.belt_rank = b.belt_rank AND s.dojang_code = b.dojang_code
      WHERE s.parent_id = ? AND s.dojang_code = ?
    `;
    
    const [children] = await db.query(query, [parentId, dojang_code]);

    if (children.length === 0) {
      return res.status(404).json({ message: 'No children found for this parent.' });
    }
    
    res.json(children);
  } catch (error) {
    console.error('❌ Error fetching children data:', error);
    res.status(500).json({ message: 'Error fetching children data.' });
  }
});




module.exports = router;
