'use strict';

/**
 * 笔记接口
 *
 * GET    /api/notes            列表（支持 ?q= ?tag= ?pinned=1）
 * POST   /api/notes            新建
 * GET    /api/notes/:id        单条
 * PATCH  /api/notes/:id        部分更新（可置顶 / 取消置顶）
 * DELETE /api/notes/:id        删除
 */

const express = require('express');
const { db, nowIso } = require('../db');
const { requireString, optionalString, requireId } = require('../validate');

const router = express.Router();

/** tags 存成逗号串，对外返回数组 */
function splitTags(raw) {
  return String(raw || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeTags(input) {
  if (input === undefined || input === null) return '';
  const list = Array.isArray(input) ? input : String(input).split(',');
  const clean = list
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 20);
  for (const t of clean) {
    if (t.length > 30) throw Object.assign(new Error('单个标签不能超过 30 个字符'), { status: 400, field: 'tags' });
  }
  return clean.join(',');
}

function shape(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: splitTags(row.tags),
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findById(id) {
  return db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
}

// 列表
router.get('/', (req, res) => {
  const where = [];
  const params = [];

  if (req.query.q !== undefined) {
    const kw = requireString(req.query.q, 'q', { max: 100, allowEmpty: true });
    if (kw) {
      where.push('(title LIKE ? OR content LIKE ? OR tags LIKE ?)');
      params.push(`%${kw}%`, `%${kw}%`, `%${kw}%`);
    }
  }
  if (req.query.tag !== undefined) {
    const tag = requireString(req.query.tag, 'tag', { max: 30, allowEmpty: true });
    if (tag) {
      where.push('tags LIKE ?');
      params.push(`%${tag}%`);
    }
  }
  if (req.query.pinned === '1') {
    where.push('pinned = 1');
  }

  let sql = 'SELECT * FROM notes';
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY pinned DESC, updated_at DESC';

  const rows = db.prepare(sql).all(...params);
  res.json({ count: rows.length, items: rows.map(shape) });
});

// 新建
router.post('/', (req, res) => {
  const body = req.body || {};
  const title = requireString(body.title, 'title', { max: 200 });
  const content = optionalString(body.content, 'content', '', { max: 200000 });
  const tags = normalizeTags(body.tags);
  const pinned = body.pinned === true || body.pinned === 1 ? 1 : 0;
  const now = nowIso();

  const info = db
    .prepare('INSERT INTO notes (title, content, tags, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(title, content, tags, pinned, now, now);

  res.status(201).json(shape(findById(Number(info.lastInsertRowid))));
});

// 单条
router.get('/:id', (req, res) => {
  const id = requireId(req.params.id);
  const row = findById(id);
  if (!row) return res.status(404).json({ error: '这篇笔记不存在' });
  res.json(shape(row));
});

// 部分更新
router.patch('/:id', (req, res) => {
  const id = requireId(req.params.id);
  const row = findById(id);
  if (!row) return res.status(404).json({ error: '这篇笔记不存在' });

  const body = req.body || {};
  const next = {
    title: body.title === undefined ? row.title : requireString(body.title, 'title', { max: 200 }),
    content: body.content === undefined ? row.content : optionalString(body.content, 'content', '', { max: 200000 }),
    tags: body.tags === undefined ? row.tags : normalizeTags(body.tags),
    pinned:
      body.pinned === undefined ? row.pinned : body.pinned === true || body.pinned === 1 ? 1 : 0,
  };

  db.prepare('UPDATE notes SET title = ?, content = ?, tags = ?, pinned = ?, updated_at = ? WHERE id = ?').run(
    next.title,
    next.content,
    next.tags,
    next.pinned,
    nowIso(),
    id
  );

  res.json(shape(findById(id)));
});

// 删除
router.delete('/:id', (req, res) => {
  const id = requireId(req.params.id);
  if (!findById(id)) return res.status(404).json({ error: '这篇笔记不存在' });
  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
