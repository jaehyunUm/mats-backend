// routes/accountDeletion.js
// 계정 삭제 (Apple App Store Guideline 5.1.1(v) 대응)
//
//  - 학부모(role = 'parent'): 학부모 계정 + 자녀(학생) 정보와 관련 기록(출석/승급/성장/저장 카드 등)을 삭제한다.
//                            결제 관련 테이블의 행은 도장 회계를 위해 남기되, 개인 식별 컬럼은 비운다(익명 보관).
//  - 원장(role = 'owner'):   원장 계정 + 해당 도장(dojang_code)의 모든 데이터를 삭제한다.
//
//  DELETE /api/delete-account              → 실제 삭제
//  DELETE /api/delete-account?dry_run=1    → 아무것도 지우지 않고, 지워질 행 수만 미리 보여준다 (테스트용)
//
//  테이블 목록은 information_schema 로 찾는다 (student_id / parent_id / dojang_code 컬럼이 있는 테이블).
//  나중에 새 테이블이 추가되어도 같은 컬럼명을 쓰면 자동으로 삭제 대상에 포함된다.

const express = require('express');
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// 결제/회계 성격의 테이블: 행은 보관하고 개인정보 컬럼만 비운다.
const FINANCIAL_RE = /(payment|invoice|receipt|refund|tournament_registration)/i;

// 보관되는 결제 테이블에서 비울 개인정보 컬럼 이름
const PII_COLUMNS = [
  'student_name', 'parent_name', 'first_name', 'last_name', 'full_name',
  'email', 'phone', 'address', 'customer_id', 'card_id',
  'payment_method_id', 'stripe_customer_id', 'card_last4', 'card_brand',
];

async function baseTablesWithColumn(conn, column) {
  const [rows] = await conn.query(
    `SELECT c.TABLE_NAME AS t
       FROM information_schema.COLUMNS c
       JOIN information_schema.TABLES x
         ON x.TABLE_SCHEMA = c.TABLE_SCHEMA AND x.TABLE_NAME = c.TABLE_NAME AND x.TABLE_TYPE = 'BASE TABLE'
      WHERE c.TABLE_SCHEMA = DATABASE() AND c.COLUMN_NAME = ?`,
    [column]
  );
  return rows.map((r) => r.t);
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND TABLE_TYPE = 'BASE TABLE' LIMIT 1`,
    [table]
  );
  return rows.length > 0;
}

// 계획: { table, action: 'delete' | 'scrub', where, params }
async function planForParent(conn, parentId) {
  const [parents] = await conn.query(
    'SELECT id, dojang_code, customer_id FROM parents WHERE id = ? LIMIT 1',
    [parentId]
  );
  if (!parents.length) return null;
  const parent = parents[0];

  const [studentRows] = await conn.query('SELECT id FROM students WHERE parent_id = ?', [parent.id]);
  const studentIds = studentRows.map((r) => r.id);

  const plan = [];

  if (studentIds.length) {
    for (const table of await baseTablesWithColumn(conn, 'student_id')) {
      if (table === 'students') continue;
      plan.push({
        table,
        action: FINANCIAL_RE.test(table) ? 'scrub' : 'delete',
        where: 'student_id IN (?)',
        params: [studentIds],
      });
    }
  }

  for (const table of await baseTablesWithColumn(conn, 'parent_id')) {
    if (table === 'students' || table === 'parents') continue;
    plan.push({
      table,
      action: FINANCIAL_RE.test(table) ? 'scrub' : 'delete',
      where: 'parent_id = ?',
      params: [parent.id],
    });
  }

  if (await tableExists(conn, 'push_tokens')) {
    plan.push({ table: 'push_tokens', action: 'delete', where: "user_id = ? AND role = 'parent'", params: [parent.id] });
  }

  if (studentIds.length) {
    plan.push({ table: 'students', action: 'delete', where: 'id IN (?)', params: [studentIds] });
  }
  plan.push({ table: 'parents', action: 'delete', where: 'id = ?', params: [parent.id] });

  return { plan, customerIds: parent.customer_id ? [parent.customer_id] : [], dojangCode: parent.dojang_code };
}

async function planForOwner(conn, ownerId) {
  const [users] = await conn.query('SELECT id, email, dojang_code FROM users WHERE id = ? LIMIT 1', [ownerId]);
  if (!users.length) return null;
  const owner = users[0];
  const dojangCode = owner.dojang_code;
  // 안전장치: dojang_code 가 비어 있으면 절대 진행하지 않는다 (빈 값으로 WHERE 하면 엉뚱한 행이 지워질 수 있음)
  if (!dojangCode || !String(dojangCode).trim()) return { error: 'This account is not linked to a studio.' };

  const [custRows] = await conn.query(
    'SELECT customer_id FROM parents WHERE dojang_code = ? AND customer_id IS NOT NULL',
    [dojangCode]
  );

  const plan = [];

  // dojang_code 컬럼이 없는 대회 하위 테이블 (대회 → 접수/종목/가격/Wave)
  const tournamentChildren = [
    ['tournament_registration_events', 'registration_id IN (SELECT id FROM tournament_registrations WHERE dojang_code = ?)'],
    ['tournament_events', 'tournament_id IN (SELECT id FROM tournaments WHERE dojang_code = ?)'],
    ['tournament_board_prices', 'tournament_id IN (SELECT id FROM tournaments WHERE dojang_code = ?)'],
    ['tournament_waves', 'tournament_id IN (SELECT id FROM tournaments WHERE dojang_code = ?)'],
  ];
  for (const [table, where] of tournamentChildren) {
    if (await tableExists(conn, table)) plan.push({ table, action: 'delete', where, params: [dojangCode] });
  }

  for (const table of await baseTablesWithColumn(conn, 'dojang_code')) {
    plan.push({ table, action: 'delete', where: 'dojang_code = ?', params: [dojangCode] });
  }

  if (await tableExists(conn, 'ownercodes') && owner.email) {
    plan.push({ table: 'ownercodes', action: 'delete', where: 'email = ?', params: [owner.email] });
  }
  // dojang_code 가 users 에 없는 경우를 대비해 원장 행을 한 번 더 명시적으로 삭제
  plan.push({ table: 'users', action: 'delete', where: 'id = ?', params: [owner.id] });

  return { plan, customerIds: custRows.map((r) => r.customer_id), dojangCode };
}

async function scrubTable(conn, table, where, params) {
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME AS name, IS_NULLABLE AS nullable, DATA_TYPE AS type
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN (?)`,
    [table, PII_COLUMNS]
  );
  const sets = [];
  for (const c of cols) {
    if (c.nullable === 'YES') sets.push(`\`${c.name}\` = NULL`);
    else if (/char|text/i.test(c.type)) sets.push(`\`${c.name}\` = ''`);
    // NOT NULL 이면서 문자열이 아닌 컬럼은 건드리지 않는다
  }
  if (!sets.length) return 0;
  const [res] = await conn.query(`UPDATE ?? SET ${sets.join(', ')} WHERE ${where}`, [table, ...params]);
  return res.affectedRows || 0;
}

async function stripeCleanup(customerIds, connectedAccountId) {
  if (!connectedAccountId || !customerIds.length) return;
  for (const id of customerIds.slice(0, 300)) {
    try {
      await stripe.customers.del(id, { stripeAccount: connectedAccountId });
    } catch (e) {
      console.warn('[delete-account] Stripe customer cleanup skipped:', id, e.message);
    }
  }
}

router.delete('/delete-account', verifyToken, async (req, res) => {
  const { id, role } = req.user || {};
  const dryRun = String(req.query.dry_run || '') === '1';

  if (!id || (role !== 'parent' && role !== 'owner')) {
    return res.status(403).json({ success: false, message: 'This account type cannot be deleted from the app.' });
  }

  const conn = await db.getConnection();
  try {
    const planned = role === 'parent' ? await planForParent(conn, id) : await planForOwner(conn, id);
    if (!planned) return res.status(404).json({ success: false, message: 'Account not found.' });
    if (planned.error) return res.status(400).json({ success: false, message: planned.error });

    const { plan, customerIds, dojangCode } = planned;

    // Stripe 연결 계정 id 는 삭제 전에 읽어 둔다
    let connectedAccountId = null;
    if (dojangCode && (await tableExists(conn, 'owner_bank_accounts'))) {
      const [acc] = await conn.query(
        'SELECT stripe_account_id FROM owner_bank_accounts WHERE dojang_code = ? LIMIT 1',
        [dojangCode]
      );
      connectedAccountId = acc[0]?.stripe_account_id || null;
    }

    if (dryRun) {
      const preview = [];
      for (const step of plan) {
        const [[row]] = await conn.query(`SELECT COUNT(*) AS c FROM ?? WHERE ${step.where}`, [step.table, ...step.params]);
        if (Number(row.c) > 0) preview.push({ table: step.table, action: step.action, rows: Number(row.c) });
      }
      return res.json({ success: true, dry_run: true, role, will_change: preview });
    }

    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const step of plan) {
        if (step.action === 'scrub') {
          await scrubTable(conn, step.table, step.where, step.params);
        } else {
          await conn.query(`DELETE FROM ?? WHERE ${step.where}`, [step.table, ...step.params]);
        }
      }
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      await conn.commit();
    } catch (err) {
      try { await conn.rollback(); } catch (_) { /* ignore */ }
      throw err;
    }

    // DB 삭제가 끝난 뒤 Stripe 고객(저장된 카드) 정리 — 실패해도 계정 삭제 자체는 성공으로 본다
    await stripeCleanup(customerIds, connectedAccountId);

    return res.json({ success: true, message: 'Your account has been deleted.' });
  } catch (err) {
    console.error('[delete-account] failed:', err);
    return res.status(500).json({ success: false, message: 'Could not delete the account. Please try again or contact support.' });
  } finally {
    try { await conn.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (_) { /* ignore */ }
    conn.release();
  }
});

module.exports = router;
