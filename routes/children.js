const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');

router.get('/children/:parentId', verifyToken, async (req, res) => {
  const { parentId } = req.params;
  const { dojang_code } = req.user;

  try {
    const query = `
      SELECT id, first_name, last_name, birth_date, gender, belt_rank, belt_size
      FROM students
      WHERE parent_id = ? AND dojang_code = ?
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
