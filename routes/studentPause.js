// backend/routes/studentPause.js
// 회원 일시정지(Pause) / 재개(Resume) API (원장 전용)
//
// 동작 요약
// - Pause : monthly_payments.pause_status = 'paused'. 정지 중에는 자동결제/현금 알림/결석 문자가 모두 멈춥니다. 요금 없음.
//           resume_date를 주면 "복귀 예정일 있음"(7일 전 안내 후 자동 재개), 안 주면 "복귀일 미정"(원장님이 Resume 누를 때까지 유지).
// - Resume: 정지 해제 + 복귀한 날(또는 지정한 날)을 새로운 결제 기준일(next_payment_date)로 설정.
//           (원래 결제 주기를 이어가지 않고, 돌아온 날부터 다시 시작)
const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyToken = require("../middleware/verifyToken");
const { ensurePauseColumns, logPauseStart, logPauseEnd } = require("../migrations/pauseColumns");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 뉴욕(애틀랜타/스머나) 시간 기준 오늘 날짜 'YYYY-MM-DD'
function getTodayNY() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isValidDateString(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function requireOwner(req, res) {
  if (req.user?.role !== "owner") {
    res.status(403).json({ success: false, message: "Only the studio owner can pause or resume memberships." });
    return false;
  }
  return true;
}

async function requireColumns(res) {
  const ok = await ensurePauseColumns();
  if (!ok) {
    res.status(503).json({ success: false, message: "Pause feature is not ready yet. Please try again in a moment." });
    return false;
  }
  return true;
}

async function studentBelongsToDojang(studentId, dojangCode) {
  const [rows] = await db.query(`SELECT id FROM students WHERE id = ? AND dojang_code = ? LIMIT 1`, [
    studentId,
    dojangCode,
  ]);
  return rows.length > 0;
}

// ✅ 정지 상태 조회 (학생 프로필 화면용)
router.get("/students/:studentId/pause-status", verifyToken, async (req, res) => {
  if (!requireOwner(req, res)) return;
  if (!(await requireColumns(res))) return;

  const studentId = parseInt(req.params.studentId, 10);
  const { dojang_code } = req.user;
  if (!studentId) return res.status(400).json({ success: false, message: "Invalid student id." });

  try {
    const [rows] = await db.query(
      `SELECT id, pause_status, pause_reason,
              DATE_FORMAT(paused_at, '%Y-%m-%d') AS paused_at,
              DATE_FORMAT(resume_date, '%Y-%m-%d') AS resume_date
       FROM monthly_payments
       WHERE student_id = ? AND dojang_code = ?
       ORDER BY id DESC`,
      [studentId, dojang_code]
    );

    // 월 결제/현금 결제 회원만 정지 대상 (전액 선결제 회원은 해당 없음)
    if (rows.length === 0) {
      return res.json({ success: true, eligible: false, paused: false });
    }

    const pausedRow = rows.find((r) => r.pause_status === "paused");
    return res.json({
      success: true,
      eligible: true,
      paused: !!pausedRow,
      paused_at: pausedRow ? pausedRow.paused_at : null,
      resume_date: pausedRow ? pausedRow.resume_date : null,
      reason: pausedRow ? pausedRow.pause_reason : null,
    });
  } catch (err) {
    console.error("❌ [pause-status] error:", err);
    return res.status(500).json({ success: false, message: "Failed to load pause status." });
  }
});

// ✅ 일시정지 (resume_date 선택: 없으면 "복귀일 미정")
router.post("/students/:studentId/pause", verifyToken, async (req, res) => {
  if (!requireOwner(req, res)) return;
  if (!(await requireColumns(res))) return;

  const studentId = parseInt(req.params.studentId, 10);
  const { dojang_code } = req.user;
  const rawResumeDate = req.body?.resume_date || null;
  const reason = req.body?.reason ? String(req.body.reason).trim().slice(0, 255) : null;

  if (!studentId) return res.status(400).json({ success: false, message: "Invalid student id." });

  let resumeDate = null;
  if (rawResumeDate) {
    if (!isValidDateString(rawResumeDate)) {
      return res.status(400).json({ success: false, message: "Return date must be in YYYY-MM-DD format." });
    }
    if (rawResumeDate <= getTodayNY()) {
      return res.status(400).json({ success: false, message: "Return date must be after today." });
    }
    resumeDate = rawResumeDate;
  }

  try {
    if (!(await studentBelongsToDojang(studentId, dojang_code))) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const [result] = await db.query(
      `UPDATE monthly_payments
       SET paused_at = IF(pause_status = 'paused', paused_at, NOW()),
           pause_status = 'paused',
           resume_date = ?,
           pause_reason = ?,
           pause_notice_sent = 0,
           pause_checkin_at = NULL
       WHERE student_id = ? AND dojang_code = ?`,
      [resumeDate, reason, studentId, dojang_code]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Pause is available for monthly or cash payment members only.",
      });
    }

    await logPauseStart(studentId, dojang_code, resumeDate, reason); // 성장 화면용 정지 이력

    return res.json({
      success: true,
      paused: true,
      resume_date: resumeDate,
      message: resumeDate
        ? `Membership paused until ${resumeDate}. No charges during the pause.`
        : "Membership paused with no return date. Press Resume when the student comes back.",
    });
  } catch (err) {
    console.error("❌ [pause] error:", err);
    return res.status(500).json({ success: false, message: "Failed to pause membership." });
  }
});

// ✅ 재개 (billing_date 선택: 없으면 오늘부터 새 결제 주기 시작)
router.post("/students/:studentId/resume", verifyToken, async (req, res) => {
  if (!requireOwner(req, res)) return;
  if (!(await requireColumns(res))) return;

  const studentId = parseInt(req.params.studentId, 10);
  const { dojang_code } = req.user;
  const today = getTodayNY();
  const rawBillingDate = req.body?.next_payment_date || today;

  if (!studentId) return res.status(400).json({ success: false, message: "Invalid student id." });
  if (!isValidDateString(rawBillingDate)) {
    return res.status(400).json({ success: false, message: "Billing date must be in YYYY-MM-DD format." });
  }

  try {
    if (!(await studentBelongsToDojang(studentId, dojang_code))) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const [result] = await db.query(
      `UPDATE monthly_payments
       SET pause_status = 'none',
           paused_at = NULL,
           resume_date = NULL,
           pause_reason = NULL,
           pause_notice_sent = 0,
           pause_checkin_at = NULL,
           next_payment_date = ?,
           payment_status = 'pending',
           day_notification_3 = 0
       WHERE student_id = ? AND dojang_code = ? AND pause_status = 'paused'`,
      [rawBillingDate, studentId, dojang_code]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: "This member is not paused." });
    }

    await logPauseEnd(studentId, dojang_code); // 성장 화면용 정지 이력(복귀 시각)

    return res.json({
      success: true,
      paused: false,
      next_payment_date: rawBillingDate,
      message: `Membership resumed. Billing restarts on ${rawBillingDate}.`,
    });
  } catch (err) {
    console.error("❌ [resume] error:", err);
    return res.status(500).json({ success: false, message: "Failed to resume membership." });
  }
});

module.exports = router;
