'use strict';

/**
 * Todo List 接口
 *
 * GET    /api/todos            列出（支持 ?done=0|1、?q=关键词）
 * POST   /api/todos            新建
 * GET    /api/todos/:id        单条
 * PATCH  /api/todos/:id        部分更新（可只传 done 做勾选）
 * DELETE /api/todos/:id        删除
 */

const express = require('express');
const { db, nowIso } = require('../db');
const {
  requireString,
  optionalString,
  requireInt,
  optionalDate,
  requireId,
  today,
} = require('../validate');

const router = express.Router();

const PRIORITY_LABEL = { 1: '高', 2: '中', 3: '低' };

/** 把数据库行整理成对外结构 */
function shape(row) {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    done: row.done === 1,
    priority: row.priority,
    priorityLabel: PRIORITY_LABEL[row.priority] || '中',
    dueDate: row.due_date,
    overdue: row.done === 0 && row.due_date !== null && row.due_date < today(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findById(id) {
  return db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
}

// 列表
router.get('/', (req, res) => {
  const where = [];
  const params = [];

  const { done, q } = req.query;
  if (done === '0' || done === '1') {
    where.push('done = ?');
    params.push(Number(done));
  }
  if (q !== undefined) {
    const kw = requireString(q, 'q', { max: 100, allowEmpty: true });
    if (kw !== '') {
      where.push('(title LIKE ? OR notes LIKE ?)');
      params.push(`%${kw}%`, `%${kw}%`);
    }
  }

  let sql = 'SELECT * FROM todos';
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  // 未完成在前 → 优先级高在前 → 截止日期近在前 → 新建在前
  sql += ` ORDER BY done ASC, priority ASC,
           COALESCE(due_date, '9999-12-31') ASC, id DESC`;

  const rows = db.prepare(sql).all(...params);
  res.json({ count: rows.length, items: rows.map(shape) });
});

// 新建
router.post('/', (req, res) => {
  const body = req.body || {};
  const title = requireString(body.title, 'title', { max: 200 });
  const notes = optionalString(body.notes, 'notes', '', { max: 5000 });
  const priority = body.priority === undefined ? 2 : requireInt(body.priority, 'priority', { min: 1, max: 3 });
  const dueDate = optionalDate(body.dueDate, 'dueDate');
  const now = nowIso();

  const info = db
    .prepare(
      `INSERT INTO todos (title, notes, done, priority, due_date, created_at, updated_at)
       VALUES (?, ?, 0, ?, ?, ?, ?)`
    )
    .run(title, notes, priority, dueDate, now, now);

  const row = findById(Number(info.lastInsertRowid));
  res.status(201).json(shape(row));
});

// 单条
router.get('/:id', (req, res) => {
  const id = requireId(req.params.id);
  const row = findById(id);
  if (!row) return res.status(404).json({ error: '这条 Todo 不存在' });
  res.json(shape(row));
});

// 部分更新
router.patch('/:id', (req, res) => {
  const id = requireId(req.params.id);
  const row = findById(id);
  if (!row) return res.status(404).json({ error: '这条 Todo 不存在' });

  const body = req.body || {};
  const next = {
    title: body.title === undefined ? row.title : requireString(body.title, 'title', { max: 200 }),
    notes: body.notes === undefined ? row.notes : optionalString(body.notes, 'notes', '', { max: 5000 }),
    done:
      body.done === undefined
        ? row.done
        : typeof body.done === 'boolean'
          ? (body.done ? 1 : 0)
          : requireInt(body.done, 'done', { min: 0, max: 1 }),
    priority:
      body.priority === undefined ? row.priority : requireInt(body.priority, 'priority', { min: 1, max: 3 }),
    due_date: body.dueDate === undefined ? row.due_date : optionalDate(body.dueDate, 'dueDate'),
  };

  db.prepare(
    `UPDATE todos
        SET title = ?, notes = ?, done = ?, priority = ?, due_date = ?, updated_at = ?
      WHERE id = ?`
  ).run(next.title, next.notes, next.done, next.priority, next.due_date, nowIso(), id);

  res.json(shape(findById(id)));
});

// 删除
router.delete('/:id', (req, res) => {
  const id = requireId(req.params.id);
  const row = findById(id);
  if (!row) return res.status(404).json({ error: '这条 Todo 不存在' });
  db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
