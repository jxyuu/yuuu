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

// ---------------------------------------------------------------
// 食物热量参考表
// 数值是「一份（unit × grams）」的近似热量，来源为常见食物成分表，
// 实际会因做法、油量、分量而差很多，只作为填写时的参考起点。
// ---------------------------------------------------------------
const FOODS = require('../data/foods.json');

/** 归一化：去空格、标点，转小写，便于模糊匹配 */
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\s·、,，。.．\-_/\\()（）【】\[\]]/g, '');
}

/** 中文没有空格，用二元组重叠度做相似度 */
function bigrams(s) {
  const set = new Set();
  for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
  return set;
}

function scoreFood(query, food) {
  const q = normalize(query);
  if (!q) return 0;

  let best = 0;
  for (const raw of [food.name, ...(food.aliases || [])]) {
    const n = normalize(raw);
    if (!n) continue;

    if (n === q) {
      best = Math.max(best, 100);
    } else if (n.startsWith(q) || n.includes(q)) {
      // 命中的关键词越长越可信
      best = Math.max(best, 75 + Math.min(20, q.length));
    } else if (q.includes(n)) {
      best = Math.max(best, 70 + Math.min(20, n.length));
    } else {
      const a = bigrams(q);
      const b = bigrams(n);
      if (a.size && b.size) {
        let hit = 0;
        for (const g of a) if (b.has(g)) hit += 1;
        const overlap = hit / Math.min(a.size, b.size);
        if (overlap >= 0.5) best = Math.max(best, Math.round(40 + overlap * 35));
      }
    }
  }
  return best;
}

function shapeFood(food, match) {
  return {
    name: food.name,
    unit: food.unit,
    grams: food.grams,
    kcal: food.kcal,
    // 每 100 g 的参考值，方便手动换算分量
    kcalPer100g: Math.round((food.kcal / food.grams) * 100),
    match,
  };
}

// 查热量（自动补全用）。必须放在 /:id 之前（这里没有 GET /:id，但保持好习惯）
router.get('/lookup', (req, res) => {
  const q = requireString(req.query.q, 'q', { max: 50, allowEmpty: true });
  if (!q) return res.json({ query: '', matches: [] });

  const limit = req.query.limit === undefined ? 8 : requireInt(req.query.limit, 'limit', { min: 1, max: 30 });

  const scored = FOODS.map((f) => ({ food: f, match: scoreFood(q, f) }))
    .filter((x) => x.match >= 50)
    .sort((a, b) => b.match - a.match || a.food.name.length - b.food.name.length)
    .slice(0, limit);

  res.json({
    query: q,
    matches: scored.map((x) => shapeFood(x.food, x.match)),
    // 没有匹配时前端可以提示「未收录，请手动填写」
    found: scored.length > 0,
  });
});

// 列出全部参考食物（可选，方便以后做「食物库」页面）
router.get('/foods', (req, res) => {
  res.json({ count: FOODS.length, items: FOODS.map((f) => shapeFood(f, 100)) });
});

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
