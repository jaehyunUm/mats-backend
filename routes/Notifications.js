const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyToken = require('../middleware/verifyToken');

// 알림 가져오기
router.get("/notifications", verifyToken, async (req, res) => {
  const { dojang_code } = req.user;

  try {
    const [rows] = await db.query(
      `SELECT id, message, is_read, date FROM notifications WHERE dojang_code = ? ORDER BY date DESC`,
      [dojang_code]
    );
    res.status(200).json({ success: true, notifications: rows });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// 알림 생성하기
router.post("/notifications",verifyToken , async (req, res) => {
  const { dojang_code } = req.user;
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, message: "Message is required" });
  }

  try {
    await db.query(
      `INSERT INTO notifications (dojang_code, message) VALUES (?, ?)`,
      [dojang_code, message]
    );
    res.status(200).json({ success: true, message: "Notification created successfully" });
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ success: false, message: "Failed to create notification" });
  }
});

router.put('/notifications/:id/mark-read', async (req, res) => {
    const { id } = req.params;
  
    if (!id) {
      return res.status(400).json({ success: false, message: "Notification ID is required" });
    }
  
    try {
      await db.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
      res.json({ success: true, message: "Notification marked as read" });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ message: 'Error marking notification as read' });
    }
  });
  
  
  
  
  // 알림 삭제
  router.delete('/notifications/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
  
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid notification ID" });
    }
  
    try {
      const [result] = await db.query('DELETE FROM notifications WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Notification not found" });
      }
      res.json({ success: true, message: "Notification deleted successfully" });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ message: 'Error deleting notification' });
    }
  });
  
  router.get('/notifications/unread-count', verifyToken, async (req, res) => {
    try {
      const userId = req.user.id; // ✅ 객체에서 id를 꺼내야 함


        if (!userId) {
            return res.status(400).json({ message: "User ID is missing in the token" });
        }

        const query = `
        SELECT COUNT(*) AS unread_count
        FROM notifications
        WHERE dojang_code = ? AND user_id = ? AND is_read = 0`;
      const [rows] = await db.query(query, [req.user.dojang_code, userId]);

        res.status(200).json({ count: rows[0].unread_count });

    } catch (error) {
        console.error("❌ Error fetching unread notifications:", error);
        res.status(500).json({ message: "Failed to fetch unread notifications", error: error.message });
    }
});


module.exports = router;
