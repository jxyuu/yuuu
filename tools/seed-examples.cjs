'use strict';

/**
 * 重置数据：清空全部记录，并写入一套「教学示例」。
 *
 * 用法：
 *   npm run demo             清空后重新写入示例
 *   npm run demo -- --empty  只清空，不写示例
 *
 * 示例统一用「示例 ·」开头，方便你之后一眼认出并逐条删除。
 * 直接操作 SQLite 文件，不需要先启动服务。
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DB_FILE = process.env.YUUU_DB || path.join(ROOT, 'data', 'yuuu.db');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const pad = (n) => String(n).padStart(2, '0');
const ymd = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const now = () => new Date().toISOString();
const at = (offsetDays, hour, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL;');

// 必须先建表（如果库是新的）
db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
    done INTEGER NOT NULL DEFAULT 0, priority INTEGER NOT NULL DEFAULT 2, due_date TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL NOT NULL, category TEXT NOT NULL DEFAULT '其他',
    note TEXT NOT NULL DEFAULT '', spent_at TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT,
    location TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '',
    mood TEXT NOT NULL DEFAULT '', entry_date TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '', pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '',
    exam_at TEXT NOT NULL, location TEXT NOT NULL DEFAULT '', seat TEXT NOT NULL DEFAULT '',
    score REAL, status TEXT NOT NULL DEFAULT 'planned', note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, meal_type TEXT NOT NULL DEFAULT '午餐',
    calories REAL NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '',
    eaten_at TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT '其他',
    duration_min INTEGER NOT NULL DEFAULT 0, calories REAL NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '', done_at TEXT NOT NULL, created_at TEXT NOT NULL);
`);

// ---------- 清空 ----------
const tables = ['todos', 'expenses', 'events', 'journal', 'notes', 'exams', 'meals', 'workouts'];
const before = {};
for (const t of tables) {
  before[t] = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
  db.exec(`DELETE FROM ${t}`);
  db.exec(`DELETE FROM sqlite_sequence WHERE name = '${t}'`);
}
console.log('已清空：');
for (const t of tables) console.log(`  ${t.padEnd(9)} ${before[t]} 条 → 0`);

if (process.argv.includes('--empty')) {
  console.log('\n只清空，未写入示例。');
  db.close();
  process.exit(0);
}

// ---------- 写入教学示例 ----------
const t = now();

const todo = db.prepare(
  'INSERT INTO todos (title, notes, done, priority, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
todo.run('示例 · 勾选左边的小方框表示「完成」', '这一条是示例，看懂后可以点右侧「删除」删掉。', 0, 2, ymd(0), t, t);
todo.run('示例 · 优先级高的会排在前面', '添加时「优先级」可以选高 / 中 / 低，高优先级自动排最前。', 0, 1, ymd(2), t, t);
todo.run('示例 · 这条已经完成了', '完成后会变灰并加删除线，可以在「已完成」里看到。', 1, 3, ymd(0), t, t);

const exp = db.prepare('INSERT INTO expenses (amount, category, note, spent_at, created_at) VALUES (?, ?, ?, ?, ?)');
exp.run(8.5, '餐饮', '示例 · 早饭', ymd(0), t);
exp.run(6, '交通', '示例 · 地铁', ymd(0), t);
exp.run(42, '学习', '示例 · 一本二手书', ymd(-1), t);

const ev = db.prepare(
  'INSERT INTO events (title, starts_at, ends_at, location, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
ev.run('示例 · 社团例会', at(1, 14), at(1, 16), 'B203', '示例：地点和备注都可以留空，只填标题和时间也行。', t, t);

const jr = db.prepare(
  'INSERT INTO journal (title, content, mood, entry_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
);
jr.run(
  '示例 · 今天的心情',
  '示例：日记正文随便写，换行会原样保留。\n\n- 早上跑了 3 公里\n- 下午读完一章\n\n写完后点「展开」可以看全文。',
  '平静',
  ymd(0),
  t,
  t
);

const nt = db.prepare('INSERT INTO notes (title, content, tags, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
nt.run(
  '示例 · 笔记可以打标签、置顶',
  '标签用逗号分隔，例如：读书,摘录。\n置顶的笔记会一直排在最前面，适合放常用的东西。\n\n试试点右边的「置顶」。',
  '示例,用法',
  1,
  t,
  t
);
nt.run('示例 · 这是一篇没置顶的笔记', '置顶的排在它前面。可以按标签筛选，也能搜索标题、正文和标签。', '示例', 0, t, t);

const ex = db.prepare(
  'INSERT INTO exams (name, subject, exam_at, location, seat, score, status, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
ex.run('示例 · 期末考（出分后回来填成绩）', '历史', at(7, 9), 'B203', '17', null, 'planned', '示例：把状态勾成「已考」后，右侧会出现输入成绩的框。', t, t);

const ml = db.prepare('INSERT INTO meals (name, meal_type, calories, note, eaten_at, created_at) VALUES (?, ?, ?, ?, ?, ?)');
ml.run('示例 · 早饭（豆浆油条）', '早餐', 380, '', ymd(0), t);
ml.run('示例 · 午饭（番茄牛腩饭）', '午餐', 620, '', ymd(0), t);

const wk = db.prepare(
  'INSERT INTO workouts (kind, duration_min, calories, note, done_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
);
wk.run('跑步', 30, 260, '示例 · 时长必填，消耗可留空', ymd(0), t);

console.log('\n已写入教学示例：');
const after = {};
for (const tb of tables) after[tb] = db.prepare(`SELECT COUNT(*) AS c FROM ${tb}`).get().c;
for (const tb of tables) console.log(`  ${tb.padEnd(9)} ${after[tb]} 条`);

db.close();
console.log(`\n数据库：${DB_FILE}`);
console.log('示例都以「示例 ·」开头，看完直接删掉即可。');
