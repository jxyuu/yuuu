# 个人生活助手

一个本地运行的个人生活管理应用：**待办、记账、日程、日记、笔记、考试、饮食、运动**八个模块。
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
| **笔记** | 标题/正文/标签、置顶、按标签筛选、标题正文标签全文搜索 |
| **考试** | 名称/科目/时间/地点/座位、倒计时天数、待考与已考切换、出分后填成绩 |
| **饮食** | 名称/餐次/热量/日期、今日摄入、近 7 天柱状图、餐次分布、按餐次筛选 |
| **运动** | 类型/时长/消耗/备注/日期、本周与今日时长、连续打卡天数、近 7 天柱状图、类型分布 |
| **总览** | 8 个关键数字 + 待办、日程、花销去向、最近日记 |

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
│           ├── Journal.vue     日记
│           ├── Notes.vue       笔记
│           ├── Exams.vue       考试
│           ├── Meals.vue       饮食
│           └── Workouts.vue    运动
├── server/                 后端（Express）
│   ├── index.js            入口：装配、汇总接口、静态托管、错误处理
│   ├── db.js               SQLite 连接 + 建表（node:sqlite）
│   ├── validate.js         参数校验与错误类型
│   └── routes/
│       ├── todos.js  expenses.js  events.js  journal.js
│       └── notes.js  exams.js  meals.js  workouts.js
├── desktop/
│   └── main.js             Electron 主进程（打包桌面版用）
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
| `/#notes` | 笔记 |
| `/#exams` | 考试 |
| `/#meals` | 饮食 |
| `/#workouts` | 运动 |

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

### 笔记

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/notes` | 列表，支持 `?q=`、`?tag=`、`?pinned=1` |
| POST | `/api/notes` | 新建 |
| GET | `/api/notes/:id` | 单条 |
| PATCH | `/api/notes/:id` | 部分更新（可只传 `pinned` 置顶） |
| DELETE | `/api/notes/:id` | 删除 |

字段：`title`（必填）、`content`、`tags`（数组或逗号分隔串）、`pinned`（布尔）。
标签对外返回数组，存储时用逗号串。

### 考试

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/exams` | 列表，支持 `?upcoming=1`、`?status=planned\|done`、`?from=`、`?to=` |
| POST | `/api/exams` | 新建 |
| GET | `/api/exams/:id` | 单条 |
| PATCH | `/api/exams/:id` | 部分更新（可填 `score`、改 `status`） |
| DELETE | `/api/exams/:id` | 删除 |

字段：`name`（必填）、`subject`、`examAt`（必填，`YYYY-MM-DD` 或 ISO 8601）、
`location`、`seat`、`score`、`status`（`planned` / `done`）。
返回里带 `daysLeft`（距今天数，负数表示已过期）。

### 饮食

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/meals` | 列表，支持 `?from=`、`?to=`、`?type=` |
| GET | `/api/meals/summary` | 今日摄入、累计、按餐次、近 7 天 |
| POST | `/api/meals` | 记一顿 |
| DELETE | `/api/meals/:id` | 删除 |

字段：`name`（必填）、`mealType`（`早餐`/`午餐`/`晚餐`/`加餐`，默认午餐）、
`calories`（可填 0）、`note`、`eatenAt`（`YYYY-MM-DD`，默认今天）。

### 运动

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/workouts` | 列表，支持 `?from=`、`?to=`、`?kind=` |
| GET | `/api/workouts/summary` | 今日/本周时长、连续打卡天数、按类型、近 7 天 |
| POST | `/api/workouts` | 记一次 |
| DELETE | `/api/workouts/:id` | 删除 |

字段：`kind`（`跑步`/`力量`/`球类`/`游泳`/`骑行`/`拉伸`/`其他`）、
`durationMin`（必填，1–1440）、`calories`、`note`、`doneAt`（`YYYY-MM-DD`，默认今天）。

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

## 桌面版（Electron）

打包成双击就能用的桌面应用。

```bash
npm run desktop    # 开发模式：直接以桌面应用启动（需要 Electron 已安装）
npm run package    # 打包：生成 release/Life Assistant-win32-x64/
```

打包产物在 `release/Life Assistant-win32-x64/`，双击里面的 **`Life Assistant.exe`** 即可。
`release/` 已加入 `.gitignore`，不会进仓库。

### 打包后数据存哪

桌面版**不会**把数据库写在安装目录（打包成 asar 后那里是只读的），而是写在系统用户目录：

```text
%APPDATA%\yuuu-life-assistant\yuuu.db
```

想验证打包产物是否真的能跑，可以用无界面自检模式：

```bash
"release\Life Assistant-win32-x64\Life Assistant.exe" --smoke
```

它会：启动内置后端 → 请求一次 `/api/health` → 打印结果 → 退出。
配合 `YUUU_SMOKE_OUT=<文件路径>` 还能把结果写成 JSON 文件。

### 相关环境变量

| 变量 | 说明 |
| --- | --- |
| `YUUU_PORT` | 桌面版内部端口，默认 `4317` |
| `YUUU_USER_DATA` | 覆盖用户数据目录（测试用） |
| `YUUU_SMOKE_OUT` | `--smoke` 模式下把结果写入指定文件 |

---

## 下一步

- [ ] **Electron 打包**：主进程 `desktop/main.js` 已写好并能启动，
      打包脚本与安装包尚未完成
- [ ] 数据导出 / 导入（JSON 或 CSV）
- [ ] 记账的月度趋势图
- [ ] 日记的日历视图
- [ ] 饮食：常用食物快速录入
- [ ] 运动：周目标与达成率
- [ ] 深色模式

---

## 开发约定

- 每个模块一个 `server/routes/*.js`，统一挂在 `/api/<模块>` 下
- 所有入参都过 `server/validate.js`，不要直接信任 `req.body`
- 时间统一 ISO 8601 字符串，纯日期统一 `YYYY-MM-DD`
- 改完跑 `npm test`，必须全绿再提交
- 改前端后要 `npm run build` 才会进入 `public/`（开发模式用 5173 端口则不用）
