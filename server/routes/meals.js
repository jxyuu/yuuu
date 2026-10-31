'use strict';

/**
 * 饮食记录接口
 *
 * GET    /api/meals            列表（支持 ?from= ?to= ?type=）
 * GET    /api/meals/summary    汇总（今日热量、按餐次、最近 7 天）
 * POST   /api/meals            记一顿
 * DELETE /api/meals/:id        删除
 */

const express = require('express');
const { db, nowIso } = require('../db');
const { requireString, optionalString, requireNumber, requireDate, optionalDate, requireId, today } = require('../validate');

const router = express.Router();

const MEAL_TYPES = ['早餐', '午餐', '晚餐', '加餐'];

function shape(row) {
  return {
    id: row.id,
    name: row.name,
    mealType: row.meal_type,
    calories: Number(row.calories),
    note: row.note,
    eatenAt: row.eaten_at,
    createdAt: row.created_at,
  };
}

function rangeClause(req) {
  const where = [];
  const params = [];
  const from = optionalDate(req.query.from, 'from');
  const to = optionalDate(req.query.to, 'to');
  if (from) {
    where.push('eaten_at >= ?');
    params.push(from);
  }
  if (to) {
    where.push('eaten_at <= ?');
    params.push(to);
  }
  return { where, params, from, to };
}

// 汇总（必须写在 /:id 之前）
router.get('/summary', (req, res) => {
  const t = today();
  const { from, to } = rangeClause(req);

  const todayRow = db
    .prepare('SELECT COALESCE(SUM(calories), 0) AS kcal, COUNT(*) AS c FROM meals WHERE eaten_at = ?')
    .get(t);

  const byType = db
    .prepare(
      `SELECT meal_type, COALESCE(SUM(calories), 0) AS kcal, COUNT(*) AS count
         FROM meals WHERE eaten_at = ?
        GROUP BY meal_type`
    )
    .all(t);

  const last7 = db
    .prepare(
      `SELECT eaten_at AS date, COALESCE(SUM(calories), 0) AS kcal, COUNT(*) AS count
         FROM meals
        WHERE eaten_at >= date(?, '-6 day')
        GROUP BY eaten_at
        ORDER BY eaten_at ASC`
    )
    .all(t);

  // 指定区间总量（默认全部）
  const where = [];
  const params = [];
  if (from) {
    where.push('eaten_at >= ?');
    params.push(from);
  }
  if (to) {
    where.push('eaten_at <= ?');
    params.push(to);
  }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COALESCE(SUM(calories), 0) AS kcal, COUNT(*) AS c FROM meals${clause}`).get(...params);

  res.json({
    today: { date: t, calories: Number(todayRow.kcal), count: Number(todayRow.c) },
    total: { calories: Number(total.kcal), count: Number(total.c) },
    byType: MEAL_TYPES.map((type) => {
      const hit = byType.find((r) => r.meal_type === type);
      return { mealType: type, calories: hit ? Number(hit.kcal) : 0, count: hit ? Number(hit.count) : 0 };
    }),
    last7Days: last7.map((r) => ({ date: r.date, calories: Number(r.kcal), count: Number(r.count) })),
  });
});

// 列表
router.get('/', (req, res) => {
  const { where, params } = rangeClause(req);

  if (req.query.type !== undefined) {
    const type = requireString(req.query.type, 'type', { max: 20 });
    if (!MEAL_TYPES.includes(type)) {
      return res.status(400).json({ error: `type 只能是 ${MEAL_TYPES.join(' / ')}`, field: 'type' });
    }
    where.push('meal_type = ?');
    params.push(type);
  }

  let sql = 'SELECT * FROM meals';
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY eaten_at DESC, id DESC';

  const rows = db.prepare(sql).all(...params);
  res.json({ count: rows.length, items: rows.map(shape) });
});

// 记一顿
router.post('/', (req, res) => {
  const body = req.body || {};
  const name = requireString(body.name, 'name', { max: 200 });
  const mealType = body.mealType === undefined ? '午餐' : requireString(body.mealType, 'mealType', { max: 20 });
  if (!MEAL_TYPES.includes(mealType)) {
    return res.status(400).json({ error: `mealType 只能是 ${MEAL_TYPES.join(' / ')}`, field: 'mealType' });
  }
  const calories = body.calories === undefined || body.calories === '' ? 0 : requireNumber(body.calories, 'calories', { min: 0, max: 20000 });
  const note = optionalString(body.note, 'note', '', { max: 1000 });
  const eatenAt = body.eatenAt === undefined ? today() : requireDate(body.eatenAt, 'eatenAt');

  const info = db
    .prepare('INSERT INTO meals (name, meal_type, calories, note, eaten_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, mealType, calories, note, eatenAt, nowIso());

  res.status(201).json(shape(db.prepare('SELECT * FROM meals WHERE id = ?').get(Number(info.lastInsertRowid))));
});

// 删除
router.delete('/:id', (req, res) => {
  const id = requireId(req.params.id);
  if (!db.prepare('SELECT * FROM meals WHERE id = ?').get(id)) {
    return res.status(404).json({ error: '这条饮食记录不存在' });
  }
  db.prepare('DELETE FROM meals WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
