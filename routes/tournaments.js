// tournaments.js
// 자체 대회(예: JC World Taekwondo Olympics) 설정 / 등록 / 결제 API.
//  - 관리자(owner): 대회 설정(참가비 규칙, 종목, 송판값 표) 저장/조회, 참가자 명단 조회
//  - 학부모(parent): 열려 있는 대회 조회, 금액 견적(quote), 등록 + 카드 결제, 내 등록 내역 조회
// 금액은 항상 서버가 설정값으로 직접 계산합니다 (앱이 보낸 금액은 사용하지 않음).
// 결제는 앱에 저장된 카드(Stripe)로만 가능하며, 도장 오너의 Stripe 연결 계정으로 직접 결제(Direct Charge)됩니다.
const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const EVENT_BOARD_TYPES = ['none', 'power', 'speed'];
const PRICE_BOARD_TYPES = ['power', 'speed'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const todayNY = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const toCents = (v) => Math.round(Number(v || 0) * 100);
const fromCents = (c) => Math.round(c) / 100;

// 'YYYY-MM-DD' 두 개로 만 나이 계산 (대회 당일 기준)
function ageOnDate(birthDate, onDate) {
  const [by, bm, bd] = birthDate.slice(0, 10).split('-').map(Number);
  const [y, m, d] = onDate.slice(0, 10).split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

const requireOwner = (req, res, next) =>
  req.user.role === 'owner' ? next() : res.status(403).json({ success: false, message: 'Owner access only.' });
const requireParent = (req, res, next) =>
  req.user.role === 'parent' ? next() : res.status(403).json({ success: false, message: 'Parent access only.' });

async function loadEvents(tournamentId, { onlyActive }) {
  const [rows] = await db.query(
    `SELECT id, name, description, board_type, sort_order, is_active
     FROM tournament_events
     WHERE tournament_id = ? ${onlyActive ? 'AND is_active = 1' : ''}
     ORDER BY sort_order ASC, id ASC`,
    [tournamentId]
  );
  return rows;
}

async function loadBoardPrices(tournamentId) {
  const [rows] = await db.query(
    `SELECT id, board_type, age_min, age_max, max_boards, board_size, price
     FROM tournament_board_prices
     WHERE tournament_id = ?
     ORDER BY board_type ASC, age_min ASC, age_max ASC`,
    [tournamentId]
  );
  return rows;
}

async function loadWaves(tournamentId) {
  const [rows] = await db.query(
    `SELECT id, name, age_min, age_max, schedule, sort_order
     FROM tournament_waves
     WHERE tournament_id = ?
     ORDER BY sort_order ASC, age_min ASC, id ASC`,
    [tournamentId]
  );
  return rows;
}

// 대회 당일 나이로 Wave 찾기 (구간이 겹치면 먼저 나오는 Wave)
const findWave = (waves, age) => waves.find((w) => age >= w.age_min && age <= w.age_max) || null;

async function loadTournamentRow(id, dojangCode) {
  const [rows] = await db.query(
    `SELECT id, dojang_code, name, event_date, location, registration_deadline, is_open,
            fee_one_event, fee_two_events, fee_additional, description, waiver_text
     FROM tournaments WHERE id = ? AND dojang_code = ?`,
    [id, dojangCode]
  );
  return rows[0] || null;
}

// 선택한 종목들과 나이로 참가비 + 송판값 계산
function computeQuote(tournament, activeEvents, boardPrices, rawEventIds, age) {
  const eventIds = [...new Set((rawEventIds || []).map((x) => Number(x)))].filter((x) => Number.isInteger(x));
  if (eventIds.length === 0) return { error: 'Please select at least one event.' };

  const selected = activeEvents.filter((e) => eventIds.includes(e.id));
  if (selected.length !== eventIds.length) return { error: 'One or more selected events are not available.' };

  const n = selected.length;
  let entryCents;
  if (n === 1) {
    if (tournament.fee_one_event === null || tournament.fee_one_event === undefined) {
      return { error: 'Please select at least 2 events.' };
    }
    entryCents = toCents(tournament.fee_one_event);
  } else {
    entryCents = toCents(tournament.fee_two_events) + (n - 2) * toCents(tournament.fee_additional);
  }

  const boardLines = [];
  let boardCents = 0;
  for (const ev of selected) {
    if (ev.board_type === 'none') continue;
    const row = boardPrices.find(
      (b) => b.board_type === ev.board_type && age >= b.age_min && age <= b.age_max
    );
    if (!row) {
      return { error: `Board price is not set for age ${age} (${ev.name}). Please contact the studio.` };
    }
    const cents = toCents(row.price);
    boardCents += cents;
    boardLines.push({
      event_id: ev.id,
      event_name: ev.name,
      board_type: ev.board_type,
      max_boards: row.max_boards,
      board_size: row.board_size,
      price: fromCents(cents),
    });
  }

  return {
    eventIds,
    selected,
    entryCents,
    boardCents,
    totalCents: entryCents + boardCents,
    boardLines,
  };
}

function quoteResponse(q, age) {
  return {
    success: true,
    age,
    entry_fee: fromCents(q.entryCents),
    board_lines: q.boardLines,
    board_fee: fromCents(q.boardCents),
    total: fromCents(q.totalCents),
  };
}

// ───────────────────────── 관리자: 대회 설정 ─────────────────────────

// 가장 최근 대회 설정 조회 (없으면 tournament: null → 앱에서 기본값으로 새로 작성)
router.get('/tournaments/settings', verifyToken, requireOwner, async (req, res) => {
  const { dojang_code } = req.user;
  try {
    const [rows] = await db.query(
      `SELECT id FROM tournaments WHERE dojang_code = ? ORDER BY event_date DESC, id DESC LIMIT 1`,
      [dojang_code]
    );
    if (rows.length === 0) return res.json({ success: true, tournament: null });

    const tournament = await loadTournamentRow(rows[0].id, dojang_code);
    const events = await loadEvents(tournament.id, { onlyActive: false });
    const board_prices = await loadBoardPrices(tournament.id);
    const waves = await loadWaves(tournament.id);
    res.json({ success: true, tournament: { ...tournament, events, board_prices, waves } });
  } catch (err) {
    console.error('❌ [tournaments] settings 조회 실패:', err);
    res.status(500).json({ success: false, message: 'Failed to load tournament settings.' });
  }
});

// 대회 설정 저장 (id가 있으면 수정, 없으면 새로 생성). 종목/송판값 표는 한 번에 같이 저장.
router.put('/tournaments/settings', verifyToken, requireOwner, async (req, res) => {
  const { dojang_code } = req.user;
  const b = req.body || {};

  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: 'Tournament name is required.' });
  if (!DATE_RE.test(b.event_date || '')) return res.status(400).json({ success: false, message: 'Tournament date is required (YYYY-MM-DD).' });
  if (!DATE_RE.test(b.registration_deadline || '')) return res.status(400).json({ success: false, message: 'Registration deadline is required (YYYY-MM-DD).' });

  const parseMoney = (v, label, { allowNull } = {}) => {
    if ((v === null || v === undefined || v === '') && allowNull) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a number of 0 or more.`);
    return Math.round(n * 100) / 100;
  };

  let feeOne, feeTwo, feeAdd;
  const events = Array.isArray(b.events) ? b.events : [];
  const boardPrices = Array.isArray(b.board_prices) ? b.board_prices : [];
  const waves = Array.isArray(b.waves) ? b.waves : [];
  try {
    feeOne = parseMoney(b.fee_one_event, '1-event fee', { allowNull: true });
    feeTwo = parseMoney(b.fee_two_events, '2-event fee');
    feeAdd = parseMoney(b.fee_additional, 'Additional event fee');

    if (events.length === 0) throw new Error('Please add at least one event.');
    for (const e of events) {
      if (!String(e.name || '').trim()) throw new Error('Every event needs a name.');
      if (!EVENT_BOARD_TYPES.includes(e.board_type || 'none')) throw new Error('Invalid board type on an event.');
    }
    for (const r of boardPrices) {
      if (!PRICE_BOARD_TYPES.includes(r.board_type)) throw new Error('Invalid board type in the board price table.');
      const mn = Number(r.age_min);
      const mx = Number(r.age_max);
      if (!Number.isInteger(mn) || !Number.isInteger(mx) || mn < 0 || mx < mn) {
        throw new Error('Board price table: age range is invalid (min must be ≤ max).');
      }
      parseMoney(r.price, 'Board price');
    }
    for (const w of waves) {
      if (!String(w.name || '').trim()) throw new Error('Every wave needs a name.');
      const mn = Number(w.age_min);
      const mx = Number(w.age_max);
      if (!Number.isInteger(mn) || !Number.isInteger(mx) || mn < 0 || mx < mn) {
        throw new Error('Waves: age range is invalid (min must be ≤ max).');
      }
    }
  } catch (validationError) {
    return res.status(400).json({ success: false, message: validationError.message });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let tournamentId = b.id ? Number(b.id) : null;
    const fields = [
      name, b.event_date, (b.location || '').trim() || null, b.registration_deadline,
      b.is_open ? 1 : 0, feeOne, feeTwo, feeAdd,
      (b.description || '').trim() || null, (b.waiver_text || '').trim() || null,
    ];

    if (tournamentId) {
      const [owned] = await connection.query(
        `SELECT id FROM tournaments WHERE id = ? AND dojang_code = ?`, [tournamentId, dojang_code]
      );
      if (owned.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Tournament not found.' });
      }
      await connection.query(
        `UPDATE tournaments SET name = ?, event_date = ?, location = ?, registration_deadline = ?, is_open = ?,
           fee_one_event = ?, fee_two_events = ?, fee_additional = ?, description = ?, waiver_text = ?
         WHERE id = ? AND dojang_code = ?`,
        [...fields, tournamentId, dojang_code]
      );
    } else {
      const [ins] = await connection.query(
        `INSERT INTO tournaments (dojang_code, name, event_date, location, registration_deadline, is_open,
           fee_one_event, fee_two_events, fee_additional, description, waiver_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dojang_code, ...fields]
      );
      tournamentId = ins.insertId;
    }

    // 종목: id가 있으면 수정, 없으면 추가. 빠진 종목은 (이미 등록에 쓰였으면 비활성화, 아니면 삭제)
    const [existing] = await connection.query(
      `SELECT id FROM tournament_events WHERE tournament_id = ?`, [tournamentId]
    );
    const existingIds = existing.map((e) => e.id);
    const keptIds = [];
    let order = 0;
    for (const e of events) {
      order += 1;
      const eventName = String(e.name).trim();
      const desc = (e.description || '').trim() || null;
      const boardType = e.board_type || 'none';
      const active = e.is_active === 0 || e.is_active === false ? 0 : 1;
      if (e.id && existingIds.includes(Number(e.id))) {
        await connection.query(
          `UPDATE tournament_events SET name = ?, description = ?, board_type = ?, sort_order = ?, is_active = ?
           WHERE id = ? AND tournament_id = ?`,
          [eventName, desc, boardType, order, active, Number(e.id), tournamentId]
        );
        keptIds.push(Number(e.id));
      } else {
        const [ins] = await connection.query(
          `INSERT INTO tournament_events (tournament_id, name, description, board_type, sort_order, is_active)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [tournamentId, eventName, desc, boardType, order, active]
        );
        keptIds.push(ins.insertId);
      }
    }
    for (const id of existingIds.filter((x) => !keptIds.includes(x))) {
      const [used] = await connection.query(
        `SELECT 1 FROM tournament_registration_events WHERE event_id = ? LIMIT 1`, [id]
      );
      if (used.length > 0) {
        await connection.query(`UPDATE tournament_events SET is_active = 0 WHERE id = ?`, [id]);
      } else {
        await connection.query(`DELETE FROM tournament_events WHERE id = ?`, [id]);
      }
    }

    // 송판값 표는 통째로 교체 (등록 내역에는 그 시점 가격이 따로 저장되어 있어 영향 없음)
    await connection.query(`DELETE FROM tournament_board_prices WHERE tournament_id = ?`, [tournamentId]);
    for (const r of boardPrices) {
      await connection.query(
        `INSERT INTO tournament_board_prices (tournament_id, board_type, age_min, age_max, max_boards, board_size, price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tournamentId, r.board_type, Number(r.age_min), Number(r.age_max),
          r.max_boards === '' || r.max_boards === null || r.max_boards === undefined ? null : Number(r.max_boards),
          (r.board_size || '').toString().trim() || null,
          Math.round(Number(r.price || 0) * 100) / 100,
        ]
      );
    }

    // Wave 구간도 통째로 교체 (학생의 Wave는 나이로 계산하므로 등록 내역에는 영향 없음)
    await connection.query(`DELETE FROM tournament_waves WHERE tournament_id = ?`, [tournamentId]);
    let waveOrder = 0;
    for (const w of waves) {
      waveOrder += 1;
      await connection.query(
        `INSERT INTO tournament_waves (tournament_id, name, age_min, age_max, schedule, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tournamentId, String(w.name).trim(), Number(w.age_min), Number(w.age_max), (w.schedule || '').toString().trim() || null, waveOrder]
      );
    }

    await connection.commit();

    const tournament = await loadTournamentRow(tournamentId, dojang_code);
    res.json({
      success: true,
      tournament: {
        ...tournament,
        events: await loadEvents(tournamentId, { onlyActive: false }),
        board_prices: await loadBoardPrices(tournamentId),
        waves: await loadWaves(tournamentId),
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ [tournaments] settings 저장 실패:', err);
    res.status(500).json({ success: false, message: 'Failed to save tournament settings.' });
  } finally {
    connection.release();
  }
});

// 참가자 명단 + 종목별 인원 + 송판 수량 요약 (결제 완료된 등록만)
router.get('/tournaments/:id/registrations', verifyToken, requireOwner, async (req, res) => {
  const { dojang_code } = req.user;
  try {
    const tournament = await loadTournamentRow(req.params.id, dojang_code);
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found.' });

    const [regs] = await db.query(
      `SELECT r.id, r.student_id, r.age_at_event, r.belt, r.gender, r.weight, r.height,
              r.entry_fee, r.board_fee, r.total, r.payment_status, r.created_at,
              s.first_name, s.last_name, p.phone AS parent_phone
       FROM tournament_registrations r
       JOIN students s ON s.id = r.student_id
       LEFT JOIN parents p ON p.id = r.parent_id
       WHERE r.tournament_id = ? AND r.dojang_code = ? AND r.payment_status = 'paid'
       ORDER BY s.first_name ASC, s.last_name ASC`,
      [tournament.id, dojang_code]
    );

    const [evRows] = await db.query(
      `SELECT re.registration_id, re.event_id, re.board_price, re.max_boards, re.board_size, e.name, e.board_type
       FROM tournament_registration_events re
       JOIN tournament_events e ON e.id = re.event_id
       JOIN tournament_registrations r ON r.id = re.registration_id
       WHERE r.tournament_id = ? AND r.dojang_code = ? AND r.payment_status = 'paid'
       ORDER BY e.sort_order ASC, e.id ASC`,
      [tournament.id, dojang_code]
    );

    const waves = await loadWaves(tournament.id);
    const allEvents = await loadEvents(tournament.id, { onlyActive: false });

    const eventsByReg = {};
    const eventIdsByReg = {};
    const byEvent = {};
    const boards = {};
    for (const row of evRows) {
      (eventsByReg[row.registration_id] = eventsByReg[row.registration_id] || []).push(row.name);
      (eventIdsByReg[row.registration_id] = eventIdsByReg[row.registration_id] || []).push(row.event_id);
      byEvent[row.event_id] = byEvent[row.event_id] || { event_id: row.event_id, name: row.name, count: 0 };
      byEvent[row.event_id].count += 1;
      if (row.board_type !== 'none') {
        const key = `${row.board_type}|${row.board_size || ''}|${row.max_boards || 0}`;
        boards[key] = boards[key] || {
          board_type: row.board_type,
          board_size: row.board_size,
          max_boards: row.max_boards,
          students: 0,
          total_boards: 0,
        };
        boards[key].students += 1;
        boards[key].total_boards += Number(row.max_boards || 0);
      }
    }

    const registrations = regs.map((r) => {
      const wave = findWave(waves, r.age_at_event);
      return {
        ...r,
        student_name: `${r.first_name} ${r.last_name}`.trim(),
        events: eventsByReg[r.id] || [],
        event_ids: eventIdsByReg[r.id] || [],
        wave_id: wave ? wave.id : null,
        wave_name: wave ? wave.name : null,
      };
    });
    const total_collected = registrations.reduce((sum, r) => sum + Number(r.total || 0), 0);

    res.json({
      success: true,
      tournament: { id: tournament.id, name: tournament.name, event_date: tournament.event_date },
      waves,
      events: allEvents.map((e) => ({ id: e.id, name: e.name })),
      registrations,
      summary_by_event: Object.values(byEvent),
      board_summary: Object.values(boards),
      total_collected: Math.round(total_collected * 100) / 100,
    });
  } catch (err) {
    console.error('❌ [tournaments] registrations 조회 실패:', err);
    res.status(500).json({ success: false, message: 'Failed to load registrations.' });
  }
});

// ───────────────────────── 학부모: 조회 / 견적 / 등록 ─────────────────────────

// 현재 접수 중(열려 있는) 대회 조회. 없으면 tournament: null
router.get('/tournaments/active', verifyToken, async (req, res) => {
  const { dojang_code } = req.user;
  try {
    const [rows] = await db.query(
      `SELECT id FROM tournaments WHERE dojang_code = ? AND is_open = 1 ORDER BY event_date DESC, id DESC LIMIT 1`,
      [dojang_code]
    );
    if (rows.length === 0) return res.json({ success: true, tournament: null });

    const tournament = await loadTournamentRow(rows[0].id, dojang_code);
    const events = await loadEvents(tournament.id, { onlyActive: true });
    const board_prices = await loadBoardPrices(tournament.id);
    const waves = await loadWaves(tournament.id);
    res.json({
      success: true,
      tournament: {
        ...tournament,
        events,
        board_prices,
        waves,
        registration_closed: todayNY() > tournament.registration_deadline,
      },
    });
  } catch (err) {
    console.error('❌ [tournaments] active 조회 실패:', err);
    res.status(500).json({ success: false, message: 'Failed to load tournament.' });
  }
});

// 내 아이들의 등록 내역
router.get('/tournaments/my-registrations', verifyToken, requireParent, async (req, res) => {
  const { dojang_code, id: parentId } = req.user;
  try {
    const [regs] = await db.query(
      `SELECT r.id, r.tournament_id, r.student_id, r.age_at_event, r.entry_fee, r.board_fee, r.total,
              r.payment_status, r.created_at, s.first_name, s.last_name
       FROM tournament_registrations r
       JOIN students s ON s.id = r.student_id
       WHERE r.parent_id = ? AND r.dojang_code = ? AND r.payment_status = 'paid'
       ORDER BY r.created_at DESC`,
      [parentId, dojang_code]
    );
    if (regs.length === 0) return res.json({ success: true, registrations: [] });

    const ids = regs.map((r) => r.id);
    const [evRows] = await db.query(
      `SELECT re.registration_id, e.name
       FROM tournament_registration_events re
       JOIN tournament_events e ON e.id = re.event_id
       WHERE re.registration_id IN (?)
       ORDER BY e.sort_order ASC, e.id ASC`,
      [ids]
    );
    const eventsByReg = {};
    for (const row of evRows) (eventsByReg[row.registration_id] = eventsByReg[row.registration_id] || []).push(row.name);

    const [tRows] = await db.query(
      `SELECT id, name, event_date FROM tournaments WHERE id IN (?)`,
      [[...new Set(regs.map((r) => r.tournament_id))]]
    );
    const tById = Object.fromEntries(tRows.map((t) => [t.id, t]));

    const wavesByTournament = {};
    for (const tid of new Set(regs.map((r) => r.tournament_id))) {
      wavesByTournament[tid] = await loadWaves(tid);
    }

    res.json({
      success: true,
      registrations: regs.map((r) => {
        const wave = findWave(wavesByTournament[r.tournament_id] || [], r.age_at_event);
        return {
          ...r,
          student_name: `${r.first_name} ${r.last_name}`.trim(),
          tournament_name: tById[r.tournament_id]?.name || '',
          tournament_date: tById[r.tournament_id]?.event_date || null,
          events: eventsByReg[r.id] || [],
          wave_name: wave ? wave.name : null,
          wave_schedule: wave ? wave.schedule : null,
        };
      }),
    });
  } catch (err) {
    console.error('❌ [tournaments] my-registrations 조회 실패:', err);
    res.status(500).json({ success: false, message: 'Failed to load registrations.' });
  }
});

// 학생 정보 + 소유 확인 (내 아이만 등록 가능)
async function loadOwnStudent(studentId, parentId, dojangCode) {
  const [rows] = await db.query(
    `SELECT s.id, s.first_name, s.last_name, s.birth_date, s.gender, s.belt_rank,
            b.belt_color, b.stripe_color
     FROM students s
     LEFT JOIN beltsystem b ON s.belt_rank = b.belt_rank AND s.dojang_code = b.dojang_code
     WHERE s.id = ? AND s.parent_id = ? AND s.dojang_code = ?`,
    [studentId, parentId, dojangCode]
  );
  return rows[0] || null;
}

// 금액 견적 (앱 화면의 실시간 금액 표시용)
router.post('/tournaments/:id/quote', verifyToken, requireParent, async (req, res) => {
  const { dojang_code, id: parentId } = req.user;
  const { student_id, event_ids } = req.body || {};
  try {
    const tournament = await loadTournamentRow(req.params.id, dojang_code);
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found.' });

    const student = await loadOwnStudent(student_id, parentId, dojang_code);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    if (!student.birth_date) return res.status(400).json({ success: false, message: "Student's birth date is missing. Please update the profile first." });

    const age = ageOnDate(student.birth_date, tournament.event_date);
    const events = await loadEvents(tournament.id, { onlyActive: true });
    const boards = await loadBoardPrices(tournament.id);
    const q = computeQuote(tournament, events, boards, event_ids, age);
    if (q.error) return res.status(400).json({ success: false, message: q.error, age });

    const [dup] = await db.query(
      `SELECT 1 FROM tournament_registrations WHERE tournament_id = ? AND student_id = ? AND payment_status = 'paid' LIMIT 1`,
      [tournament.id, student.id]
    );
    const wave = findWave(await loadWaves(tournament.id), age);
    res.json({
      ...quoteResponse(q, age),
      wave: wave ? { name: wave.name, schedule: wave.schedule } : null,
      already_registered: dup.length > 0,
    });
  } catch (err) {
    console.error('❌ [tournaments] quote 실패:', err);
    res.status(500).json({ success: false, message: 'Failed to calculate the total.' });
  }
});

// 등록 + 카드 결제
router.post('/tournaments/:id/register', verifyToken, requireParent, async (req, res) => {
  const { dojang_code, id: parentId } = req.user;
  const b = req.body || {};

  try {
    const tournament = await loadTournamentRow(req.params.id, dojang_code);
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found.' });
    if (!tournament.is_open) return res.status(403).json({ success: false, message: 'Registration is closed.' });
    if (todayNY() > tournament.registration_deadline) {
      return res.status(403).json({ success: false, message: 'The registration deadline has passed. No exceptions.' });
    }

    const student = await loadOwnStudent(b.student_id, parentId, dojang_code);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    if (!student.birth_date) return res.status(400).json({ success: false, message: "Student's birth date is missing. Please update the profile first." });

    const weight = String(b.weight || '').trim();
    const height = String(b.height || '').trim();
    if (!weight || !height) return res.status(400).json({ success: false, message: 'Please enter weight and height.' });
    if (b.accept_waiver !== true) return res.status(400).json({ success: false, message: 'You must accept the release and covenant not to sue.' });
    const signedName = String(b.signed_name || '').trim();
    if (!signedName) return res.status(400).json({ success: false, message: 'Parent/guardian signature (full name) is required.' });
    if (!b.medical || typeof b.medical !== 'object' || Array.isArray(b.medical)) {
      return res.status(400).json({ success: false, message: 'Please complete the medical questionnaire.' });
    }
    const medicalJson = JSON.stringify(b.medical);
    if (medicalJson.length > 8000) return res.status(400).json({ success: false, message: 'Medical questionnaire is too long.' });
    if (!b.card_id) return res.status(400).json({ success: false, message: 'Please select a payment card.' });

    const age = ageOnDate(student.birth_date, tournament.event_date);
    const events = await loadEvents(tournament.id, { onlyActive: true });
    const boards = await loadBoardPrices(tournament.id);
    const q = computeQuote(tournament, events, boards, b.event_ids, age);
    if (q.error) return res.status(400).json({ success: false, message: q.error });
    if (q.totalCents > 0 && q.totalCents < 50) {
      return res.status(400).json({ success: false, message: 'Total must be at least $0.50.' });
    }

    // 카드/고객 검증: customer_id는 앱이 보낸 값이 아니라 DB에서 직접 조회
    let customerId = null;
    let connectedAccountId = null;
    if (q.totalCents > 0) {
      const [pRows] = await db.query(
        `SELECT customer_id FROM parents WHERE id = ? AND dojang_code = ?`, [parentId, dojang_code]
      );
      customerId = pRows[0]?.customer_id || null;
      if (!customerId) return res.status(400).json({ success: false, message: 'No saved card found for this account.' });

      const [ownerInfo] = await db.query(
        `SELECT stripe_account_id FROM owner_bank_accounts WHERE dojang_code = ?`, [dojang_code]
      );
      connectedAccountId = ownerInfo[0]?.stripe_account_id || null;
      if (!connectedAccountId) return res.status(400).json({ success: false, message: 'No Stripe account connected for this dojang.' });

      try {
        const pm = await stripe.paymentMethods.retrieve(b.card_id, { stripeAccount: connectedAccountId });
        if (!pm || pm.customer !== customerId) {
          return res.status(400).json({ success: false, message: 'The selected card does not belong to this account.' });
        }
      } catch (e) {
        return res.status(400).json({ success: false, message: 'The selected card could not be verified.' });
      }
    }

    // 중복 등록 방지: 오래된 미완료 시도는 정리하고, 이미 결제 완료된 학생이면 거절
    await db.query(
      `DELETE re FROM tournament_registration_events re
         JOIN tournament_registrations r ON r.id = re.registration_id
        WHERE r.tournament_id = ? AND r.student_id = ? AND r.payment_status <> 'paid'
          AND r.created_at < (NOW() - INTERVAL 10 MINUTE)`,
      [tournament.id, student.id]
    );
    await db.query(
      `DELETE FROM tournament_registrations
        WHERE tournament_id = ? AND student_id = ? AND payment_status <> 'paid'
          AND created_at < (NOW() - INTERVAL 10 MINUTE)`,
      [tournament.id, student.id]
    );

    const beltName = student.belt_color
      ? `${student.belt_color}${student.stripe_color ? ` (${student.stripe_color} Stripe)` : ''}`
      : null;

    let registrationId;
    try {
      const [ins] = await db.query(
        `INSERT INTO tournament_registrations
           (tournament_id, dojang_code, student_id, parent_id, age_at_event, belt, gender, weight, height,
            medical_json, signed_name, signed_at, entry_fee, board_fee, total, payment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, 'pending')`,
        [
          tournament.id, dojang_code, student.id, parentId, age, beltName, student.gender || null, weight, height,
          medicalJson, signedName, fromCents(q.entryCents), fromCents(q.boardCents), fromCents(q.totalCents),
        ]
      );
      registrationId = ins.insertId;
    } catch (e) {
      if (e && e.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'This student is already registered (or a payment is in progress).' });
      }
      throw e;
    }

    const cleanupAttempt = async () => {
      try {
        await db.query(`DELETE FROM tournament_registration_events WHERE registration_id = ?`, [registrationId]);
        await db.query(`DELETE FROM tournament_registrations WHERE id = ? AND payment_status <> 'paid'`, [registrationId]);
      } catch (cleanupErr) {
        console.error('⚠️ [tournaments] 실패한 등록 정리 중 오류:', cleanupErr.message);
      }
    };

    try {
      for (const evId of q.eventIds) {
        const line = q.boardLines.find((l) => l.event_id === evId);
        await db.query(
          `INSERT INTO tournament_registration_events (registration_id, event_id, board_price, max_boards, board_size)
           VALUES (?, ?, ?, ?, ?)`,
          [registrationId, evId, line ? line.price : 0, line ? line.max_boards : null, line ? line.board_size : null]
        );
      }

      let paymentIntentId = null;
      if (q.totalCents > 0) {
        const paymentIntent = await stripe.paymentIntents.create(
          {
            amount: q.totalCents,
            currency: 'usd',
            customer: customerId,
            payment_method: b.card_id,
            confirm: true,
            off_session: true,
            metadata: {
              payment_type: 'tournament_registration',
              tournament_id: String(tournament.id),
              registration_id: String(registrationId),
              student_id: String(student.id),
              parent_id: String(parentId),
              dojang_code,
            },
          },
          { stripeAccount: connectedAccountId, idempotencyKey: `tournament-reg-${registrationId}` }
        );
        if (!paymentIntent || paymentIntent.status !== 'succeeded') {
          throw new Error(`Stripe payment failed. Status: ${paymentIntent?.status || 'unknown'}`);
        }
        paymentIntentId = paymentIntent.id;
      }

      await db.query(
        `UPDATE tournament_registrations SET payment_status = 'paid', payment_intent_id = ? WHERE id = ?`,
        [paymentIntentId, registrationId]
      );
    } catch (payErr) {
      await cleanupAttempt();
      console.error('❌ [tournaments] 결제 실패:', payErr.message);
      if (payErr.type === 'StripeCardError') {
        return res.status(400).json({ success: false, message: 'Card was declined.', error: payErr.message });
      }
      return res.status(500).json({ success: false, message: 'Payment processing failed. You were not charged for a registration.' });
    }

    // 관리자 알림 (실패해도 등록 자체에는 영향 없음)
    try {
      const eventNames = q.selected.map((e) => e.name).join(', ');
      await db.query(
        `INSERT INTO notifications (dojang_code, message, type, student_id) VALUES (?, ?, 'tournament_registration', ?)`,
        [
          dojang_code,
          `${tournament.name}: ${student.first_name} ${student.last_name} registered (${eventNames}) - $${fromCents(q.totalCents).toFixed(2)} paid.`,
          student.id,
        ]
      );
    } catch (notifyErr) {
      console.error('⚠️ [tournaments] 관리자 알림 저장 실패 (무시):', notifyErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Registration complete.',
      registration_id: registrationId,
      ...quoteResponse(q, age),
    });
  } catch (err) {
    console.error('❌ [tournaments] register 실패:', err);
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

module.exports = router;
