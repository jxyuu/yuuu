'use strict';

/**
 * 考试接口
 *
 * GET    /api/exams            列表（支持 ?from= ?to= ?upcoming=1 ?status=）
 * POST   /api/exams            新建
 * GET    /api/exams/:id        单条
 * PATCH  /api/exams/:id        部分更新（含填成绩、改状态）
 * DELETE /api/exams/:id        删除
 */

const express = require('express');
const { db, nowIso } = require('../db');
const { requireString, optionalString, requireNumber, requireDateTime, optionalDate, requireId } = require('../validate');

const router = express.Router();

const STATUSES = ['planned', 'done'];

function shape(row, todayStr) {
  const day = String(row.exam_at).slice(0, 10);
  let daysLeft = null;
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day) && todayStr) {
    const diff = Math.round((new Date(day + 'T00:00:00Z') - new Date(todayStr + 'T00:00:00Z')) / 86400000);
    daysLeft = diff;
  }
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    examAt: row.exam_at,
    location: row.location,
    seat: row.seat,
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    status: row.status,
    note: row.note,
    daysLeft,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function findById(id) {
  return db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
}

// 列表
router.get('/', (req, res) => {
  const where = [];
  const params = [];

  const from = optionalDate(req.query.from, 'from');
  const to = optionalDate(req.query.to, 'to');
  if (from) {
    where.push('substr(exam_at, 1, 10) >= ?');
    params.push(from);
  }
  if (to) {
    where.push('substr(exam_at, 1, 10) <= ?');
    params.push(to);
  }
  if (req.query.upcoming === '1') {
    where.push('substr(exam_at, 1, 10) >= ?');
    params.push(todayStr());
  }
  if (req.query.status !== undefined) {
    const st = requireString(req.query.status, 'status', { max: 20 });
    if (!STATUSES.includes(st)) {
      return res.status(400).json({ error: `status 只能是 ${STATUSES.join(' 或 ')}`, field: 'status' });
    }
    where.push('status = ?');
    params.push(st);
  }

  let sql = 'SELECT * FROM exams';
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY exam_at ASC, id ASC';

  const t = todayStr();
  const rows = db.prepare(sql).all(...params);
  res.json({ count: rows.length, items: rows.map((r) => shape(r, t)) });
});

// 新建
router.post('/', (req, res) => {
  const body = req.body || {};
  const name = requireString(body.name, 'name', { max: 200 });
  const subject = optionalString(body.subject, 'subject', '', { max: 100 });
  const examAt = requireDateTime(body.examAt, 'examAt');
  const location = optionalString(body.location, 'location', '', { max: 200 });
  const seat = optionalString(body.seat, 'seat', '', { max: 50 });
  const note = optionalString(body.note, 'note', '', { max: 2000 });
  const now = nowIso();

  const info = db
    .prepare(
      `INSERT INTO exams (name, subject, exam_at, location, seat, score, status, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, 'planned', ?, ?, ?)`
    )
    .run(name, subject, examAt, location, seat, note, now, now);

  res.status(201).json(shape(findById(Number(info.lastInsertRowid)), todayStr()));
});

// 单条
router.get('/:id', (req, res) => {
  const id = requireId(req.params.id);
  const row = findById(id);
  if (!row) return res.status(404).json({ error: '这场考试不存在' });
  res.json(shape(row, todayStr()));
});

// 部分更新
router.patch('/:id', (req, res) => {
  const id = requireId(req.params.id);
  const row = findById(id);
  if (!row) return res.status(404).json({ error: '这场考试不存在' });

  const body = req.body || {};
  let status = row.status;
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return res.status(400).json({ error: `status 只能是 ${STATUSES.join(' 或 ')}`, field: 'status' });
    }
    status = body.status;
  }
  let score = row.score;
  if (body.score !== undefined) {
    score = body.score === null || body.score === '' ? null : requireNumber(body.score, 'score', { min: 0, max: 1000 });
  }

  const next = {
    name: body.name === undefined ? row.name : requireString(body.name, 'name', { max: 200 }),
    subject: body.subject === undefined ? row.subject : optionalString(body.subject, 'subject', '', { max: 100 }),
    exam_at: body.examAt === undefined ? row.exam_at : requireDateTime(body.examAt, 'examAt'),
    location: body.location === undefined ? row.location : optionalString(body.location, 'location', '', { max: 200 }),
    seat: body.seat === undefined ? row.seat : optionalString(body.seat, 'seat', '', { max: 50 }),
    note: body.note === undefined ? row.note : optionalString(body.note, 'note', '', { max: 2000 }),
    status,
    score,
  };

  db.prepare(
    `UPDATE exams
        SET name = ?, subject = ?, exam_at = ?, location = ?, seat = ?, score = ?, status = ?, note = ?, updated_at = ?
      WHERE id = ?`
  ).run(next.name, next.subject, next.exam_at, next.location, next.seat, next.score, next.status, next.note, nowIso(), id);

  res.json(shape(findById(id), todayStr()));
});

// 删除
router.delete('/:id', (req, res) => {
  const id = requireId(req.params.id);
  if (!findById(id)) return res.status(404).json({ error: '这场考试不存在' });
  db.prepare('DELETE FROM exams WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
