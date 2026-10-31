# 个人生活助手

一个本地运行的个人生活管理应用：**待办、记账、日程、日记**四合一。
数据保存在你自己的电脑上（SQLite 单文件），不经过任何服务器。

技术栈按 XTECH Project Lab 的建议：
**前端 Vue 3 + Vite，后端 Express，数据库 SQLite**（下一步用 Electron 套壳成桌面应用）。

![界面预览](docs/preview.png)

---

## 功能

| 模块 | 能力 |
| --- | --- |
| **待办** | 增删改、勾选完成、优先级（高/中/低）、截止日期、逾期标记、关键词搜索、按状态筛选 |
| **记账** | 金额/分类/备注/日期、分类占比条、本月与累计与今日汇总、按分类与日期区间筛选 |
| **日程** | 增删改、起止时间、地点、备注、即将到来 / 全部切换 |
| **日记** | 标题/正文/心情、全文搜索、按日期倒序、展开阅读 |
| **总览** | 待办统计、今日与本月支出、今日日程数、日记状态、最近日程与最近日记 |

界面风格：**简约、温馨、高级 ins 风** —— 暖米白纸感底色、低饱和奶咖与豆沙色、衬线标题、大留白、超柔阴影。

---

## 快速开始

### 环境要求

- **Node.js ≥ 22**（用到内置的 `node:sqlite`，Node 22.5 起提供）

```bash
node -v    # 需要 >= 22
npm -v
```

### 安装

```bash
npm install              # 后端依赖（只有 Express）
npm --prefix client install   # 前端依赖（Vue + Vite）
```

### 开发模式（推荐日常使用）

需要两个终端：

```bash
# 终端 1：后端，http://127.0.0.1:3000
npm run dev

# 终端 2：前端，http://127.0.0.1:5173（改代码自动热更新）
npm run dev:client
```

打开 **http://127.0.0.1:5173**。Vite 会把 `/api` 自动转发到 3000 端口，所以没有跨域问题。

### 生产模式（一个端口）

```bash
npm run build     # 把前端编译进 public/
npm start         # 只开 http://127.0.0.1:3000，前后端同一个地址
```

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
├── client/                 前端（Vue 3 + Vite）
│   ├── index.html
│   ├── vite.config.js      构建到 ../public，开发时代理 /api
│   └── src/
│       ├── main.js
│       ├── App.vue         侧栏导航 + 视图切换（用 URL hash 记住当前页）
│       ├── api.js          接口封装、金额与时间格式化
│       ├── styles.css      全部样式（暖米白 + 莫兰迪配色）
│       └── views/
│           ├── Dashboard.vue   总览
│           ├── Todos.vue       待办
│           ├── Expenses.vue    记账
│           ├── Events.vue      日程
│           └── Journal.vue     日记
├── server/                 后端（Express）
│   ├── index.js            入口：装配、汇总接口、静态托管、错误处理
│   ├── db.js               SQLite 连接 + 建表（node:sqlite）
│   ├── validate.js         参数校验与错误类型
│   └── routes/
│       ├── todos.js  expenses.js  events.js  journal.js
├── public/                 前端构建产物（npm run build 生成，由 Express 托管）
├── tools/
│   └── smoke-test.js       接口冒烟测试
└── data/
    └── yuuu.db             SQLite 数据文件（自动生成，已 gitignore）
```

---

## 页面地址

前端用 URL hash 记住当前页，刷新或收藏都能回到同一处：

| 地址 | 页面 |
| --- | --- |
| `/` 或 `/#dashboard` | 总览 |
| `/#todos` | 待办 |
| `/#expenses` | 记账 |
| `/#events` | 日程 |
| `/#journal` | 日记 |

---

## 接口文档

默认地址 `http://127.0.0.1:3000`。

### 通用

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查：版本、数据库路径、运行时长 |
| GET | `/api/summary` | 首页汇总 |

### 待办

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

`better-sqlite3` 是原生模块，安装时需要编译，Windows 上通常要装 Visual Studio
C++ 构建工具——这是新手最容易卡住的地方。Node.js 22.5+ 内置了 `node:sqlite`，
纯内置、零编译。

```js
const { DatabaseSync } = require('node:sqlite');
```

### 配色方案

全部颜色集中在 `client/src/styles.css` 顶部的变量里：

```css
:root {
  --paper:  #f8f5f0;   /* 暖米白底 */
  --card:   #fffdfa;   /* 卡片 */
  --ink:    #3b332c;   /* 暖褐灰正文 */
  --muted:  #a1958a;   /* 次要文字 */
  --accent: #a9886f;   /* 奶咖强调色 */
  --accent-2: #c79a8f; /* 豆沙辅助色 */
}
```

标题用衬线字体（宋体系），正文用无衬线；卡片无硬边框，靠极淡描边与超柔阴影分层。

### 数据存在哪

`data/yuuu.db`（SQLite 单文件）。`data/` 已加入 `.gitignore`，
**个人数据不会被提交到 GitHub**。备份直接复制这个文件即可。

### 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 后端端口 |
| `HOST` | `127.0.0.1` | 只允许本机访问 |
| `YUUU_DB` | `data/yuuu.db` | 数据库文件路径 |

---

## 下一步

- [ ] **Electron 套壳**：打包成桌面应用
- [ ] 数据导出 / 导入（JSON 或 CSV）
- [ ] 记账的月度趋势图
- [ ] 日记的日历视图
- [ ] 深色模式

---

## 开发约定

- 每个模块一个 `server/routes/*.js`，统一挂在 `/api/<模块>` 下
- 所有入参都过 `server/validate.js`，不要直接信任 `req.body`
- 时间统一 ISO 8601 字符串，纯日期统一 `YYYY-MM-DD`
- 改完跑 `npm test`，必须全绿再提交
- 改前端后要 `npm run build` 才会进入 `public/`（开发模式用 5173 端口则不用）
