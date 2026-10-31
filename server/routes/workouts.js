'use strict';

/**
 * 运动记录接口
 *
 * GET    /api/workouts            列表（支持 ?from= ?to= ?kind=）
 * GET    /api/workouts/summary    汇总（今日/本周时长、按类型、最近 7 天）
 * POST   /api/workouts            记一次
 * DELETE /api/workouts/:id        删除
 */

const express = require('express');
const { db, nowIso } = require('../db');
const { requireString, optionalString, requireNumber, requireInt, requireDate, optionalDate, requireId, today } = require('../validate');

const router = express.Router();

const KINDS = ['跑步', '力量', '球类', '游泳', '骑行', '拉伸', '其他'];

function shape(row) {
  return {
    id: row.id,
    kind: row.kind,
    durationMin: row.duration_min,
    calories: Number(row.calories),
    note: row.note,
    doneAt: row.done_at,
    createdAt: row.created_at,
  };
}

function rangeClause(req) {
  const where = [];
  const params = [];
  const from = optionalDate(req.query.from, 'from');
  const to = optionalDate(req.query.to, 'to');
  if (from) {
    where.push('done_at >= ?');
    params.push(from);
  }
  if (to) {
    where.push('done_at <= ?');
    params.push(to);
  }
  return { where, params, from, to };
}

/** 本周一（本地时区）的 YYYY-MM-DD */
function mondayOfThisWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 周一=0
  d.setDate(d.getDate() - day);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 汇总
router.get('/summary', (req, res) => {
  const t = today();
  const monday = mondayOfThisWeek();

  const todayRow = db
    .prepare('SELECT COALESCE(SUM(duration_min), 0) AS min, COALESCE(SUM(calories), 0) AS kcal, COUNT(*) AS c FROM workouts WHERE done_at = ?')
    .get(t);

  const weekRow = db
    .prepare('SELECT COALESCE(SUM(duration_min), 0) AS min, COALESCE(SUM(calories), 0) AS kcal, COUNT(*) AS c FROM workouts WHERE done_at >= ?')
    .get(monday);

  const byKind = db
    .prepare(
      `SELECT kind, SUM(duration_min) AS min, COUNT(*) AS count
         FROM workouts WHERE done_at >= ?
        GROUP BY kind
        ORDER BY min DESC`
    )
    .all(monday);

  const last7 = db
    .prepare(
      `SELECT done_at AS date, COALESCE(SUM(duration_min), 0) AS min
         FROM workouts WHERE done_at >= date(?, '-6 day')
        GROUP BY done_at
        ORDER BY done_at ASC`
    )
    .all(t);

  const streak = db.prepare('SELECT DISTINCT done_at AS date FROM workouts ORDER BY done_at DESC LIMIT 60').all();
  let streakDays = 0;
  {
    const set = new Set(streak.map((r) => r.date));
    const cursor = new Date(`${t}T00:00:00`);
    const pad = (n) => String(n).padStart(2, '0');
    for (;;) {
      const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
      if (!set.has(key)) break;
      streakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  res.json({
    today: { date: t, minutes: Number(todayRow.min), calories: Number(todayRow.kcal), count: Number(todayRow.c) },
    thisWeek: { since: monday, minutes: Number(weekRow.min), calories: Number(weekRow.kcal), count: Number(weekRow.c) },
    streakDays,
    byKind: byKind.map((r) => ({ kind: r.kind, minutes: Number(r.min), count: Number(r.count) })),
    last7Days: last7.map((r) => ({ date: r.date, minutes: Number(r.min) })),
  });
});

// 列表
router.get('/', (req, res) => {
  const { where, params } = rangeClause(req);

  if (req.query.kind !== undefined) {
    const kind = requireString(req.query.kind, 'kind', { max: 20 });
    if (!KINDS.includes(kind)) {
      return res.status(400).json({ error: `kind 只能是 ${KINDS.join(' / ')}`, field: 'kind' });
    }
    where.push('kind = ?');
    params.push(kind);
  }

  let sql = 'SELECT * FROM workouts';
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY done_at DESC, id DESC';

  const rows = db.prepare(sql).all(...params);
  res.json({ count: rows.length, items: rows.map(shape) });
});

// 记一次
router.post('/', (req, res) => {
  const body = req.body || {};
  const kind = body.kind === undefined ? '其他' : requireString(body.kind, 'kind', { max: 20 });
  if (!KINDS.includes(kind)) {
    return res.status(400).json({ error: `kind 只能是 ${KINDS.join(' / ')}`, field: 'kind' });
  }
  const durationMin = requireInt(body.durationMin, 'durationMin', { min: 1, max: 1440 });
  const calories = body.calories === undefined || body.calories === '' ? 0 : requireNumber(body.calories, 'calories', { min: 0, max: 20000 });
  const note = optionalString(body.note, 'note', '', { max: 1000 });
  const doneAt = body.doneAt === undefined ? today() : requireDate(body.doneAt, 'doneAt');

  const info = db
    .prepare('INSERT INTO workouts (kind, duration_min, calories, note, done_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(kind, durationMin, calories, note, doneAt, nowIso());

  res.status(201).json(shape(db.prepare('SELECT * FROM workouts WHERE id = ?').get(Number(info.lastInsertRowid))));
});

// 删除
router.delete('/:id', (req, res) => {
  const id = requireId(req.params.id);
  if (!db.prepare('SELECT * FROM workouts WHERE id = ?').get(id)) {
    return res.status(404).json({ error: '这条运动记录不存在' });
  }
  db.prepare('DELETE FROM workouts WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
