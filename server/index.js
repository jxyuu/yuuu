'use strict';

/**
 * 个人生活助手 —— 后端入口
 *
 * 技术栈（照 PPT 第 3 页的建议）：
 *   前端 Vue + Electron 套壳  ← 之后再写
 *   后端 Express              ← 就是本文件
 *   数据库 SQLite             ← node:sqlite 内置模块
 *
 * 启动：npm start        （默认 http://127.0.0.1:3000）
 */

const express = require('express');
const path = require('node:path');

const { db, DB_FILE } = require('./db');
const { today } = require('./validate');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// 简单的请求日志，方便开发时看清每个调用
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.originalUrl}`);
  next();
});

// ---------------------------------------------------------------
// 健康检查
// ---------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'yuuu-life-assistant',
    version: require('../package.json').version,
    today: today(),
    database: DB_FILE,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// ---------------------------------------------------------------
// 首页汇总：一眼看到今天要做什么、花了多少
// ---------------------------------------------------------------
app.get('/api/summary', (_req, res) => {
  const t = today();

  const todos = db
    .prepare(
      `SELECT
         COUNT(*)                                            AS total,
         COALESCE(SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END), 0) AS done,
         COALESCE(SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END), 0) AS open,
         COALESCE(SUM(CASE WHEN done = 0 AND due_date IS NOT NULL AND due_date < ? THEN 1 ELSE 0 END), 0) AS overdue
       FROM todos`
    )
    .get(t);

  const spentToday = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM expenses WHERE spent_at = ?')
    .get(t);

  const spentMonth = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM expenses WHERE substr(spent_at, 1, 7) = ?')
    .get(t.slice(0, 7));

  const eventsToday = db
    .prepare('SELECT COUNT(*) AS c FROM events WHERE substr(starts_at, 1, 10) = ?')
    .get(t);

  const journalCount = db.prepare('SELECT COUNT(*) AS c FROM journal').get();
  const journalToday = db
    .prepare('SELECT COUNT(*) AS c FROM journal WHERE entry_date = ?')
    .get(t);

  // ---- 扩展模块 ----
  const notesCount = db.prepare('SELECT COUNT(*) AS c FROM notes').get();

  const nextExamRow = db
    .prepare('SELECT * FROM exams WHERE substr(exam_at, 1, 10) >= ? ORDER BY exam_at ASC LIMIT 1')
    .get(t);
  let nextExam = null;
  if (nextExamRow) {
    const day = String(nextExamRow.exam_at).slice(0, 10);
    nextExam = {
      id: nextExamRow.id,
      name: nextExamRow.name,
      subject: nextExamRow.subject,
      examAt: nextExamRow.exam_at,
      daysLeft: Math.round((new Date(day + 'T00:00:00Z') - new Date(t + 'T00:00:00Z')) / 86400000),
    };
  }

  const mealsToday = db
    .prepare('SELECT COALESCE(SUM(calories), 0) AS kcal, COUNT(*) AS c FROM meals WHERE eaten_at = ?')
    .get(t);

  const monday = (() => {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  const workoutsWeek = db
    .prepare('SELECT COALESCE(SUM(duration_min), 0) AS min, COUNT(*) AS c FROM workouts WHERE done_at >= ?')
    .get(monday);

  res.json({
    today: t,
    todos: {
      total: Number(todos.total),
      done: Number(todos.done),
      open: Number(todos.open),
      overdue: Number(todos.overdue),
    },
    expenses: {
      today: Number(spentToday.s),
      thisMonth: Number(spentMonth.s),
    },
    eventsToday: Number(eventsToday.c),
    journal: {
      total: Number(journalCount.c),
      writtenToday: Number(journalToday.c) > 0,
    },
    notes: { total: Number(notesCount.c) },
    exams: { next: nextExam },
    meals: { todayCalories: Number(mealsToday.kcal), todayCount: Number(mealsToday.c) },
    workouts: { weekMinutes: Number(workoutsWeek.min), weekCount: Number(workoutsWeek.c) },
  });
});

// ---------------------------------------------------------------
// 业务接口
// ---------------------------------------------------------------
app.use('/api/todos', require('./routes/todos'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/events', require('./routes/events'));
app.use('/api/journal', require('./routes/journal'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/exams', require('./routes/exams'));
app.use('/api/meals', require('./routes/meals'));
app.use('/api/workouts', require('./routes/workouts'));

// 前端静态资源（Vue 构建产物以后放这里）
app.use(express.static(path.join(__dirname, '..', 'public')));

// /api 下未匹配到的路径
app.use('/api', (req, res) => {
  res.status(404).json({ error: `接口不存在：${req.method} ${req.originalUrl}` });
});

// 统一错误处理
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error('[ERROR]', err);
  }
  res.status(status).json({
    error: err.message || '服务器内部错误',
    ...(err.field ? { field: err.field } : {}),
  });
});

// ---------------------------------------------------------------
// 启动
// ---------------------------------------------------------------
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';

const server = app.listen(PORT, HOST, () => {
  console.log('');
  console.log('  个人生活助手 · 后端已启动');
  console.log(`  地址：http://${HOST}:${PORT}`);
  console.log(`  数据：${DB_FILE}`);
  console.log('');
  console.log('  可用接口：');
  console.log('    GET    /api/health');
  console.log('    GET    /api/summary');
  console.log('    GET/POST        /api/todos        PATCH/DELETE /api/todos/:id');
  console.log('    GET/POST        /api/expenses     DELETE       /api/expenses/:id');
  console.log('    GET             /api/expenses/summary');
  console.log('    GET/POST        /api/events       PATCH/DELETE /api/events/:id');
  console.log('    GET/POST        /api/journal      PATCH/DELETE /api/journal/:id');
  console.log('    GET/POST        /api/notes        PATCH/DELETE /api/notes/:id');
  console.log('    GET/POST        /api/exams        PATCH/DELETE /api/exams/:id');
  console.log('    GET/POST        /api/meals        GET /api/meals/summary   DELETE /api/meals/:id');
  console.log('    GET/POST        /api/workouts     GET /api/workouts/summary DELETE /api/workouts/:id');
  console.log('');
});

// 优雅退出，确保 SQLite 写入落盘
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n收到 ${sig}，正在关闭…`);
    server.close(() => {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      process.exit(0);
    });
  });
}
