# 个人生活助手

一个本地运行的个人生活管理应用：**Todo List、记账、日程、日记**四合一。
数据保存在你自己的电脑上（SQLite），不经过任何服务器。

技术栈按 XTECH Project Lab 的建议：
**后端 Express + 数据库 SQLite + 前端 Vue / Electron 套壳**。

> 当前进度：**后端已完成并通过 59 项接口测试**。前端与 Electron 打包是下一步。

---

## 功能范围

| 模块 | 已实现 |
| --- | --- |
| **Todo List** | 增删改查、勾选完成、优先级（高/中/低）、截止日期、逾期标记、关键词搜索 |
| **记账** | 记录金额/分类/备注/日期、按分类与日期区间筛选、汇总（总额、本月、按分类、按天） |
| **日程** | 增删改、起止时间、地点、备注、按日期区间筛选、即将到来 |
| **日记** | 增删改、心情标签、按日期倒序、全文搜索、条数限制 |

---

## 快速开始

### 环境要求

- **Node.js ≥ 22**（本项目用到内置的 `node:sqlite`，Node 22.5 起提供）

检查版本：

```bash
node -v
npm -v
```

### 安装与启动

```bash
npm install     # 只装了 Express，其它全是 Node 内置能力
npm start       # 打开 http://127.0.0.1:3000
```

开发时想改代码自动重启：

```bash
npm run dev
```

启动后浏览器打开 <http://127.0.0.1:3000> 会看到一个接口占位页。

### 跑测试

```bash
npm test
```

测试会自己在 3100 端口起一个临时服务、用独立的 `data/test.db`，跑完自动清理，
**不会动你平时用的 `data/yuuu.db`**。

```
通过 59 项，失败 0 项
全部通过 ✅
```

---

## 目录结构

```
.
├── package.json
├── server/
│   ├── index.js        # 入口：Express 装配、汇总接口、错误处理
│   ├── db.js           # SQLite 连接 + 建表（node:sqlite）
│   ├── validate.js     # 参数校验与错误类型
│   └── routes/
│       ├── todos.js
│       ├── expenses.js
│       ├── events.js
│       └── journal.js
├── public/
│   └── index.html      # 接口占位页（前端做完后替换）
├── tools/
│   └── smoke-test.js   # 接口冒烟测试
└── data/
    └── yuuu.db         # SQLite 数据文件（自动生成，已在 .gitignore 中）
```

---

## 接口文档

默认地址 `http://127.0.0.1:3000`。

### 通用

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查：版本、数据库路径、运行时长 |
| GET | `/api/summary` | 首页汇总：待办统计、今日/本月支出、今日日程、日记状态 |

### Todo List

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/todos` | 列表，支持 `?done=0\|1`、`?q=关键词` |
| POST | `/api/todos` | 新建 |
| GET | `/api/todos/:id` | 单条 |
| PATCH | `/api/todos/:id` | 部分更新（可只传 `done` 做勾选） |
| DELETE | `/api/todos/:id` | 删除 |

```bash
curl -X POST http://127.0.0.1:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"写周报","priority":1,"dueDate":"2026-12-31"}'
```

字段：`title`（必填）、`notes`、`priority`（1 高 / 2 中 / 3 低）、`dueDate`（`YYYY-MM-DD`）。

### 记账

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/expenses` | 列表，支持 `?from=`、`?to=`、`?category=` |
| GET | `/api/expenses/summary` | 汇总：总额、笔数、本月、按分类、按天 |
| POST | `/api/expenses` | 记一笔 |
| DELETE | `/api/expenses/:id` | 删除 |

```bash
curl -X POST http://127.0.0.1:3000/api/expenses \
  -H "Content-Type: application/json" \
  -d '{"amount":12.5,"category":"餐饮","note":"午饭","spentAt":"2026-10-20"}'
```

字段：`amount`（必填，> 0）、`category`、`note`、`spentAt`（`YYYY-MM-DD`，默认今天）。

### 日程

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/events` | 列表，支持 `?from=`、`?to=`、`?upcoming=1` |
| POST | `/api/events` | 新建 |
| GET | `/api/events/:id` | 单条 |
| PATCH | `/api/events/:id` | 部分更新 |
| DELETE | `/api/events/:id` | 删除 |

```bash
curl -X POST http://127.0.0.1:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"title":"社团例会","startsAt":"2026-12-01T14:00:00+08:00","location":"B203"}'
```

字段：`title`、`startsAt`（必填，`YYYY-MM-DD` 或 ISO 8601）、`endsAt`、`location`、`note`。

### 日记

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/journal` | 列表，支持 `?from=`、`?to=`、`?q=`、`?limit=` |
| POST | `/api/journal` | 写一篇 |
| GET | `/api/journal/:id` | 单篇 |
| PATCH | `/api/journal/:id` | 部分更新 |
| DELETE | `/api/journal/:id` | 删除 |

```bash
curl -X POST http://127.0.0.1:3000/api/journal \
  -H "Content-Type: application/json" \
  -d '{"title":"今天的收获","content":"学会了 node:sqlite。","mood":"不错"}'
```

字段：`title`（必填）、`content`、`mood`、`entryDate`（`YYYY-MM-DD`，默认今天）。

### 错误响应

校验失败返回 `400`，并指出出错字段：

```json
{ "error": "title 不能为空", "field": "title" }
```

记录不存在返回 `404`，未知接口返回 `404`，服务器异常返回 `500`。

---

## 技术说明

### 为什么用 `node:sqlite` 而不是 `better-sqlite3`

`better-sqlite3` 是原生模块，装的时候需要编译，Windows 上通常要装 Visual Studio
C++ 构建工具，对新手是最大的坑。Node.js 22.5+ 内置了 `node:sqlite`，
纯内置、零编译，够这个项目用。

前提是 Node 版本 ≥ 22：

```js
const { DatabaseSync } = require('node:sqlite');
```

### 数据存在哪

`data/yuuu.db`（SQLite 单文件）。`data/` 已加入 `.gitignore`，
**你的个人数据不会被提交到 GitHub**。

想备份就直接复制这个文件。

### 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址（只允许本机访问） |
| `YUUU_DB` | `data/yuuu.db` | 数据库文件路径 |

---

## 下一步

- [ ] **前端**：Vue 页面（Todo / 记账 / 日程 / 日记 四个视图 + 首页汇总）
- [ ] **Electron 套壳**：打包成桌面应用
- [ ] 数据导出 / 导入（JSON 或 CSV）
- [ ] 记账的月度图表

---

## 开发约定

- 每个模块一个 `routes/*.js`，统一挂在 `/api/<模块>` 下
- 所有入参都过 `validate.js`，不要直接信任 `req.body`
- 时间统一 ISO 8601 字符串，纯日期统一 `YYYY-MM-DD`
- 改动后跑 `npm test`，必须全绿再提交
