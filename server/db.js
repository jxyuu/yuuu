'use strict';

/**
 * 数据库层
 *
 * 使用 Node.js 内置的 node:sqlite（Node 22.5+ 提供），
 * 所以不需要 better-sqlite3 这类原生模块，也就不用安装
 * Visual Studio C++ 构建工具。
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = process.env.YUUU_DB || path.join(DATA_DIR, 'yuuu.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// ---------------------------------------------------------------
// Schema
// 时间统一存 ISO 8601 文本；日期类字段存 YYYY-MM-DD。
// ---------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    notes      TEXT    NOT NULL DEFAULT '',
    done       INTEGER NOT NULL DEFAULT 0,   -- 0 未完成 / 1 已完成
    priority   INTEGER NOT NULL DEFAULT 2,   -- 1 高 / 2 中 / 3 低
    due_date   TEXT,                         -- YYYY-MM-DD，可为空
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    amount     REAL    NOT NULL,             -- 金额（元），正数
    category   TEXT    NOT NULL DEFAULT '其他',
    note       TEXT    NOT NULL DEFAULT '',
    spent_at   TEXT    NOT NULL,             -- YYYY-MM-DD
    created_at TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    starts_at  TEXT    NOT NULL,             -- ISO 时间，或 YYYY-MM-DD
    ends_at    TEXT,
    location   TEXT    NOT NULL DEFAULT '',
    note       TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS journal (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    content    TEXT    NOT NULL DEFAULT '',
    mood       TEXT    NOT NULL DEFAULT '',
    entry_date TEXT    NOT NULL,             -- YYYY-MM-DD
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_todos_done     ON todos (done);
  CREATE INDEX IF NOT EXISTS idx_todos_due      ON todos (due_date);
  CREATE INDEX IF NOT EXISTS idx_expenses_when  ON expenses (spent_at);
  CREATE INDEX IF NOT EXISTS idx_events_start   ON events (starts_at);
  CREATE INDEX IF NOT EXISTS idx_journal_date   ON journal (entry_date);
`);

/** 当前时间的 ISO 字符串 */
function nowIso() {
  return new Date().toISOString();
}

/** 把 SQLite 的 0/1 转成布尔值，便于前端使用 */
function toBool(v) {
  return v === 1 || v === true || v === '1';
}

module.exports = { db, DB_FILE, DATA_DIR, nowIso, toBool };
