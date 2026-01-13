// routes/notificationRoutes.js

const express = require('express');
const router = express.Router();
const db = require('../db'); // ⚠️ DB 연결 파일 경로 확인 필요
const transporter = require('../modules/mailer'); // ⚠️ 위에서 만든 mailer.js 경로 확인 필요
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
      // user_id 필드가 없으므로 제거하고 dojang_code만 사용
      const query = `
        SELECT COUNT(*) AS unread_count
        FROM notifications
        WHERE dojang_code = ? AND is_read = 0`;
      
      const [rows] = await db.query(query, [req.user.dojang_code]);
      res.status(200).json({ count: rows[0].unread_count });
    } catch (error) {
      console.error("❌ Error fetching unread notifications:", error);
      res.status(500).json({ message: "Failed to fetch unread notifications", error: error.message });
    }
  });


module.exports = router;


router.post('/notify-eligible-students', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;
  
  try {
    // 1. 도장 이름 가져오기
    const [dojangRows] = await db.execute(
        'SELECT dojang_name FROM dojangs WHERE dojang_code = ?', 
        [dojang_code]
    );
    const dojangName = dojangRows.length > 0 ? dojangRows[0].dojang_name : "Martial Arts Studio";

    // 2. 테스트 자격 학생 찾기 (+ last_test_notice_date 추가 조회 ⭐️)
    const [students] = await db.execute(
        `SELECT id AS student_id, parent_id, CONCAT(first_name, ' ', last_name) AS student_name, 
                belt_rank, last_test_notice_date 
         FROM students WHERE dojang_code = ?`,
        [dojang_code]
    );

    const [conditions] = await db.execute(
        'SELECT belt_min_rank, belt_max_rank, attendance_required FROM testcondition WHERE dojang_code = ?',
        [dojang_code]
    );

    const eligibleStudents = [];
    
    // ✅ [쿨타임 설정] 30일 이내에 알림을 받은 적이 있으면 제외하기 위한 기준 날짜
    const COOLDOWN_DAYS = 30; 
    const now = new Date();
    
    for (const student of students) {
        // 🛑 [신규 로직] 이미 최근에 보냈는지 확인
        if (student.last_test_notice_date) {
            const lastSentDate = new Date(student.last_test_notice_date);
            const diffTime = Math.abs(now - lastSentDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

            // 30일이 안 지났으면 스킵 (다음 심사 때까지 알림 금지)
            if (diffDays < COOLDOWN_DAYS) {
                continue; 
            }
        }

        const nextBeltRank = student.belt_rank + 1;
        const requiredCondition = conditions.find(c => nextBeltRank >= c.belt_min_rank && nextBeltRank <= c.belt_max_rank);
        
        if (requiredCondition) {
            const [attendanceResult] = await db.execute(
                'SELECT COUNT(*) AS count FROM attendance WHERE student_id = ? AND dojang_code = ?',
                [student.student_id, dojang_code]
            );
            if (attendanceResult[0].count >= requiredCondition.attendance_required) {
                eligibleStudents.push(student);
            }
        }
    }

    // 3. 이메일 발송 로직
    let sentCount = 0;

    for (const student of eligibleStudents) {
        if (!student.parent_id) continue;

        const [parents] = await db.execute(
            `SELECT email, first_name FROM parents WHERE id = ?`, 
            [student.parent_id]
        );

        if (parents.length === 0 || !parents[0].email) continue;

        const parentEmail = parents[0].email;
        const parentName = parents[0].first_name;

        const mailOptions = {
            from: `"${dojangName}" <${process.env.EMAIL_USER}>`, 
            to: parentEmail,
            subject: `🥋 Belt Test Eligibility Notice for ${student.student_name}`,
            html: `
                <h3>Hello ${parentName},</h3>
                <p>We are excited to inform you that <strong>${student.student_name}</strong> is eligible for the upcoming Belt Test!</p>
                <p>Please open the <strong>'Martial Arts Studio' App</strong> to register for the test.</p>
                <br>
                <p>Best regards,</p>
                <p><strong>${dojangName}</strong></p>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            sentCount++;

            // ✅ [DB 업데이트 1] students 테이블에 '오늘 보냈다'고 날짜 찍기
            await db.execute(
                `UPDATE students SET last_test_notice_date = NOW() WHERE id = ?`,
                [student.student_id]
            );

            // ✅ [DB 업데이트 2] 기존 알림 내역 저장 (히스토리용)
            await db.execute(
                `INSERT INTO notifications (dojang_code, message, type, recipient_id, is_read, created_at) 
                 VALUES (?, ?, 'test_invite', ?, 0, NOW())`,
                [dojang_code, `Emailed test notice to ${parentEmail}`, student.parent_id]
            );

        } catch (emailError) {
            console.error(`[Email Fail] Could not send to ${parentEmail}:`, emailError);
        }
    }

    res.json({ 
        success: true, 
        message: `Sent Email notices to ${sentCount} parents from ${dojangName}.`,
        eligibleCount: eligibleStudents.length
    });

  } catch (error) {
    console.error('Error sending emails:', error);
    res.status(500).json({ message: 'Failed to send emails' });
  }
});

// 라우터 내보내기
module.exports = router;