'use strict';

/**
 * 日程接口
 *
 * GET    /api/events            列出（支持 ?from= ?to= ?upcoming=1）
 * POST   /api/events            新建
 * GET    /api/events/:id        单条
 * PATCH  /api/events/:id        部分更新
 * DELETE /api/events/:id        删除
 */

const express = require('express');
const { db, nowIso } = require('../db');
const {
  requireString,
  optionalString,
  requireDateTime,
  optionalDate,
  requireId,
} = require('../validate');

const router = express.Router();

function shape(row) {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findById(id) {
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id);
}

// 列表
router.get('/', (req, res) => {
  const where = [];
  const params = [];

  const from = optionalDate(req.query.from, 'from');
  const to = optionalDate(req.query.to, 'to');
  if (from) {
    where.push('substr(starts_at, 1, 10) >= ?');
    params.push(from);
  }
  if (to) {
    where.push('substr(starts_at, 1, 10) <= ?');
    params.push(to);
  }
  if (req.query.upcoming === '1') {
    where.push('starts_at >= ?');
    params.push(new Date().toISOString().slice(0, 19));
  }

  let sql = 'SELECT * FROM events';
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY starts_at ASC, id ASC';

  const rows = db.prepare(sql).all(...params);
  res.json({ count: rows.length, items: rows.map(shape) });
});

// 新建
router.post('/', (req, res) => {
  const body = req.body || {};
  const title = requireString(body.title, 'title', { max: 200 });
  const startsAt = requireDateTime(body.startsAt, 'startsAt');
  const endsAt = body.endsAt === undefined || body.endsAt === null || body.endsAt === ''
    ? null
    : requireDateTime(body.endsAt, 'endsAt');
  const location = optionalString(body.location, 'location', '', { max: 200 });
  const note = optionalString(body.note, 'note', '', { max: 2000 });
  const now = nowIso();

  const info = db
    .prepare(
      `INSERT INTO events (title, starts_at, ends_at, location, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(title, startsAt, endsAt, location, note, now, now);

  res.status(201).json(shape(findById(Number(info.lastInsertRowid))));
});

// 单条
router.get('/:id', (req, res) => {
  const id = requireId(req.params.id);
  const row = findById(id);
  if (!row) return res.status(404).json({ error: '这个日程不存在' });
  res.json(shape(row));
});

// 部分更新
router.patch('/:id', (req, res) => {
  const id = requireId(req.params.id);
  const row = findById(id);
  if (!row) return res.status(404).json({ error: '这个日程不存在' });

  const body = req.body || {};
  const next = {
    title: body.title === undefined ? row.title : requireString(body.title, 'title', { max: 200 }),
    starts_at: body.startsAt === undefined ? row.starts_at : requireDateTime(body.startsAt, 'startsAt'),
    ends_at:
      body.endsAt === undefined
        ? row.ends_at
        : body.endsAt === null || body.endsAt === ''
          ? null
          : requireDateTime(body.endsAt, 'endsAt'),
    location: body.location === undefined ? row.location : optionalString(body.location, 'location', '', { max: 200 }),
    note: body.note === undefined ? row.note : optionalString(body.note, 'note', '', { max: 2000 }),
  };

  db.prepare(
    `UPDATE events
        SET title = ?, starts_at = ?, ends_at = ?, location = ?, note = ?, updated_at = ?
      WHERE id = ?`
  ).run(next.title, next.starts_at, next.ends_at, next.location, next.note, nowIso(), id);

  res.json(shape(findById(id)));
});

// 删除
router.delete('/:id', (req, res) => {
  const id = requireId(req.params.id);
  const row = findById(id);
  if (!row) return res.status(404).json({ error: '这个日程不存在' });
  db.prepare('DELETE FROM events WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
