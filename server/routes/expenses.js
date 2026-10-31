'use strict';

/**
 * 记账接口
 *
 * GET    /api/expenses            列出（支持 ?from= ?to= ?category=）
 * GET    /api/expenses/summary    汇总（总计、按分类、按天）
 * POST   /api/expenses            记一笔
 * DELETE /api/expenses/:id        删除
 */

const express = require('express');
const { db, nowIso } = require('../db');
const {
  requireString,
  optionalString,
  requireNumber,
  requireDate,
  optionalDate,
  requireId,
  today,
} = require('../validate');

const router = express.Router();

function shape(row) {
  return {
    id: row.id,
    amount: row.amount,
    category: row.category,
    note: row.note,
    spentAt: row.spent_at,
    createdAt: row.created_at,
  };
}

// 注意：/summary 必须写在 /:id 之前（这里没有 GET /:id，但保持好习惯）
// 汇总
router.get('/summary', (req, res) => {
  const from = optionalDate(req.query.from, 'from');
  const to = optionalDate(req.query.to, 'to');

  const where = [];
  const params = [];
  if (from) {
    where.push('spent_at >= ?');
    params.push(from);
  }
  if (to) {
    where.push('spent_at <= ?');
    params.push(to);
  }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS s, COUNT(*) AS c FROM expenses${clause}`).get(...params);

  const byCategory = db
    .prepare(
      `SELECT category, SUM(amount) AS total, COUNT(*) AS count
         FROM expenses${clause}
        GROUP BY category
        ORDER BY total DESC`
    )
    .all(...params);

  const byDay = db
    .prepare(
      `SELECT spent_at AS date, SUM(amount) AS total, COUNT(*) AS count
         FROM expenses${clause}
        GROUP BY spent_at
        ORDER BY spent_at DESC
        LIMIT 31`
    )
    .all(...params);

  const thisMonth = today().slice(0, 7);
  const monthTotal = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS s FROM expenses WHERE substr(spent_at, 1, 7) = ?`)
    .get(thisMonth);

  res.json({
    range: { from: from || null, to: to || null },
    total: Number(total.s),
    count: Number(total.c),
    thisMonth: { month: thisMonth, total: Number(monthTotal.s) },
    byCategory: byCategory.map((r) => ({ category: r.category, total: Number(r.total), count: Number(r.count) })),
    byDay: byDay.map((r) => ({ date: r.date, total: Number(r.total), count: Number(r.count) })),
  });
});

// 列表
router.get('/', (req, res) => {
  const where = [];
  const params = [];

  const from = optionalDate(req.query.from, 'from');
  const to = optionalDate(req.query.to, 'to');
  if (from) {
    where.push('spent_at >= ?');
    params.push(from);
  }
  if (to) {
    where.push('spent_at <= ?');
    params.push(to);
  }
  if (req.query.category !== undefined) {
    const cat = requireString(req.query.category, 'category', { max: 50, allowEmpty: true });
    if (cat) {
      where.push('category = ?');
      params.push(cat);
    }
  }

  let sql = 'SELECT * FROM expenses';
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY spent_at DESC, id DESC';

  const rows = db.prepare(sql).all(...params);
  res.json({ count: rows.length, items: rows.map(shape) });
});

// 记一笔
router.post('/', (req, res) => {
  const body = req.body || {};
  const amount = requireNumber(body.amount, 'amount', { min: 0.01, max: 1e9 });
  const category = body.category === undefined ? '其他' : requireString(body.category, 'category', { max: 50 });
  const note = optionalString(body.note, 'note', '', { max: 1000 });
  const spentAt = body.spentAt === undefined ? today() : requireDate(body.spentAt, 'spentAt');

  const info = db
    .prepare(
      `INSERT INTO expenses (amount, category, note, spent_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(amount, category, note, spentAt, nowIso());

  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json(shape(row));
});

// 删除
router.delete('/:id', (req, res) => {
  const id = requireId(req.params.id);
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: '这笔记录不存在' });
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
