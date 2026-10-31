'use strict';

/**
 * 日记接口
 *
 * GET    /api/journal          列出（支持 ?from= ?to= ?q= ?limit=）
 * POST   /api/journal          写一篇
 * GET    /api/journal/:id      单篇
 * PATCH  /api/journal/:id      部分更新
 * DELETE /api/journal/:id      删除
 */

const express = require('express');
const { db, nowIso } = require('../db');
const {
  requireString,
  optionalString,
  requireDate,
  optionalDate,
  requireInt,
  requireId,
  today,
} = require('../validate');

const router = express.Router();

function shape(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    mood: row.mood,
    entryDate: row.entry_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findById(id) {
  return db.prepare('SELECT * FROM journal WHERE id = ?').get(id);
}

// 列表
router.get('/', (req, res) => {
  const where = [];
  const params = [];

  const from = optionalDate(req.query.from, 'from');
  const to = optionalDate(req.query.to, 'to');
  if (from) {
    where.push('entry_date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('entry_date <= ?');
    params.push(to);
  }
  if (req.query.q !== undefined) {
    const kw = requireString(req.query.q, 'q', { max: 100, allowEmpty: true });
    if (kw) {
      where.push('(title LIKE ? OR content LIKE ?)');
      params.push(`%${kw}%`, `%${kw}%`);
    }
  }

  let sql = 'SELECT * FROM journal';
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY entry_date DESC, id DESC';

  const limit = req.query.limit === undefined ? null : requireInt(req.query.limit, 'limit', { min: 1, max: 200 });
  if (limit !== null) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const rows = db.prepare(sql).all(...params);
  res.json({ count: rows.length, items: rows.map(shape) });
});

// 写一篇
router.post('/', (req, res) => {
  const body = req.body || {};
  const title = requireString(body.title, 'title', { max: 200 });
  const content = optionalString(body.content, 'content', '', { max: 100000 });
  const mood = optionalString(body.mood, 'mood', '', { max: 50 });
  const entryDate = body.entryDate === undefined ? today() : requireDate(body.entryDate, 'entryDate');
  const now = nowIso();

  const info = db
    .prepare(
      `INSERT INTO journal (title, content, mood, entry_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(title, content, mood, entryDate, now, now);

  res.status(201).json(shape(findById(Number(info.lastInsertRowid))));
});

// 单篇
router.get('/:id', (req, res) => {
  const id = requireId(req.params.id);
  const row = findById(id);
  if (!row) return res.status(404).json({ error: '这篇日记不存在' });
  res.json(shape(row));
});

// 部分更新
router.patch('/:id', (req, res) => {
  const id = requireId(req.params.id);
  const row = findById(id);
  if (!row) return res.status(404).json({ error: '这篇日记不存在' });

  const body = req.body || {};
  const next = {
    title: body.title === undefined ? row.title : requireString(body.title, 'title', { max: 200 }),
    content: body.content === undefined ? row.content : optionalString(body.content, 'content', '', { max: 100000 }),
    mood: body.mood === undefined ? row.mood : optionalString(body.mood, 'mood', '', { max: 50 }),
    entry_date: body.entryDate === undefined ? row.entry_date : requireDate(body.entryDate, 'entryDate'),
  };

  db.prepare(
    `UPDATE journal
        SET title = ?, content = ?, mood = ?, entry_date = ?, updated_at = ?
      WHERE id = ?`
  ).run(next.title, next.content, next.mood, next.entry_date, nowIso(), id);

  res.json(shape(findById(id)));
});

// 删除
router.delete('/:id', (req, res) => {
  const id = requireId(req.params.id);
  const row = findById(id);
  if (!row) return res.status(404).json({ error: '这篇日记不存在' });
  db.prepare('DELETE FROM journal WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
