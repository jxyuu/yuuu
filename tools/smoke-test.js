'use strict';

/**
 * 接口冒烟测试（自带独立数据库，可反复运行）
 *
 * 用法：
 *   npm test
 *
 * 它会自己在 3100 端口起一个临时服务，用 data/test.db，
 * 跑完自动关掉并删除，不会污染你平时用的 data/yuuu.db。
 *
 * 如果已经有服务在跑、想测那一个：
 *   set BASE=http://127.0.0.1:3000 && npm test
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TEST_DB = path.join(ROOT, 'data', 'test.db');
const TEST_PORT = process.env.TEST_PORT || '3100';
const EXTERNAL_BASE = process.env.BASE || null;
const BASE = EXTERNAL_BASE || `http://127.0.0.1:${TEST_PORT}`;

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, extra = '') {
  pass += 1;
  console.log(`  \u2713 ${name}${extra ? '  ' + extra : ''}`);
}

function bad(name, detail) {
  fail += 1;
  failures.push(`${name} — ${detail}`);
  console.log(`  \u2717 ${name}  ${detail}`);
}

async function req(method, pathname, body) {
  const res = await fetch(BASE + pathname, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

function checkEq(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    ok(name, `= ${JSON.stringify(actual)}`);
  } else {
    bad(name, `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  }
}

function removeTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(TEST_DB + suffix, { force: true });
    } catch {
      /* ignore */
    }
  }
}

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

/** 启动临时服务；返回 stop() */
async function startTempServer() {
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  removeTestDb();

  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: TEST_PORT, YUUU_DB: TEST_DB },
    // stdio: 'ignore' 而不是 'pipe'：受限沙箱下管道会 EPERM
    stdio: 'ignore',
  });

  const up = await waitForHealth();
  if (!up) {
    child.kill();
    throw new Error(`临时服务启动失败（端口 ${TEST_PORT} 可能被占用）`);
  }

  return {
    stop() {
      child.kill('SIGTERM');
      removeTestDb();
    },
  };
}

async function runTests() {
  console.log(`\n接口测试 → ${BASE}${EXTERNAL_BASE ? '（外部服务）' : '（临时服务 + 独立数据库）'}\n`);

  // ---------- health ----------
  console.log('[健康检查]');
  const health = await req('GET', '/api/health');
  checkEq('GET /api/health 状态码', health.status, 200);
  checkEq('健康检查 ok', health.body.ok, true);
  checkEq('返回版本号', typeof health.body.version, 'string');

  // ---------- todos ----------
  console.log('\n[Todo List]');
  const t1 = await req('POST', '/api/todos', { title: '写周报', priority: 1, dueDate: '2026-12-31' });
  checkEq('新建 Todo 状态码', t1.status, 201);
  checkEq('新建 Todo 标题', t1.body.title, '写周报');
  checkEq('优先级标签', t1.body.priorityLabel, '高');
  checkEq('默认未完成', t1.body.done, false);
  const todoId = t1.body.id;

  await req('POST', '/api/todos', { title: '买牛奶', priority: 3 });
  await req('POST', '/api/todos', { title: '还书', priority: 2 });

  const list = await req('GET', '/api/todos');
  checkEq('列表数量', list.body.count, 3);
  checkEq('排序：高优先级在最前', list.body.items[0].title, '写周报');
  checkEq('排序：低优先级在最后', list.body.items[2].title, '买牛奶');

  const patched = await req('PATCH', `/api/todos/${todoId}`, { done: true });
  checkEq('勾选完成状态码', patched.status, 200);
  checkEq('勾选后 done', patched.body.done, true);

  checkEq('按已完成筛选', (await req('GET', '/api/todos?done=1')).body.count, 1);
  checkEq('按未完成筛选', (await req('GET', '/api/todos?done=0')).body.count, 2);
  checkEq('关键词搜索', (await req('GET', '/api/todos?q=牛奶')).body.count, 1);

  const badTodo = await req('POST', '/api/todos', { title: '' });
  checkEq('空标题被拒绝', badTodo.status, 400);
  checkEq('错误带字段名', badTodo.body.field, 'title');
  checkEq('非法优先级被拒绝', (await req('POST', '/api/todos', { title: 'x', priority: 9 })).status, 400);
  checkEq('不存在的 Todo', (await req('GET', '/api/todos/999999')).status, 404);

  checkEq('删除 Todo 状态码', (await req('DELETE', `/api/todos/${todoId}`)).status, 204);
  checkEq('删除后取不到', (await req('GET', `/api/todos/${todoId}`)).status, 404);

  // ---------- expenses ----------
  console.log('\n[记账]');
  const e1 = await req('POST', '/api/expenses', { amount: 12.5, category: '餐饮', note: '午饭', spentAt: '2026-10-20' });
  checkEq('记一笔状态码', e1.status, 201);
  checkEq('金额', e1.body.amount, 12.5);
  checkEq('分类', e1.body.category, '餐饮');

  await req('POST', '/api/expenses', { amount: 30, category: '交通', spentAt: '2026-10-20' });
  await req('POST', '/api/expenses', { amount: 8, category: '餐饮', spentAt: '2026-10-21' });

  checkEq('记账列表数量', (await req('GET', '/api/expenses')).body.count, 3);

  const sum = await req('GET', '/api/expenses/summary');
  checkEq('汇总总额', sum.body.total, 50.5);
  checkEq('汇总笔数', sum.body.count, 3);
  // 交通 30 > 餐饮 20.5，所以 DESC 第一项是交通
  checkEq('分类聚合第一项（金额最大）', sum.body.byCategory[0].category, '交通');
  checkEq('分类聚合第一项金额', sum.body.byCategory[0].total, 30);
  checkEq('分类聚合第二项', sum.body.byCategory[1].category, '餐饮');
  checkEq('分类聚合第二项金额', sum.body.byCategory[1].total, 20.5);

  checkEq('按分类筛选', (await req('GET', '/api/expenses?category=交通')).body.count, 1);
  checkEq('按日期区间筛选', (await req('GET', '/api/expenses?from=2026-10-21&to=2026-10-21')).body.count, 1);
  checkEq('金额必须大于 0', (await req('POST', '/api/expenses', { amount: 0 })).status, 400);
  checkEq('日期格式校验', (await req('POST', '/api/expenses', { amount: 5, spentAt: '2026/10/21' })).status, 400);

  // ---------- events ----------
  console.log('\n[日程]');
  const ev = await req('POST', '/api/events', {
    title: '社团例会',
    startsAt: '2026-12-01T14:00:00+08:00',
    endsAt: '2026-12-01T16:00:00+08:00',
    location: 'B203',
  });
  checkEq('新建日程状态码', ev.status, 201);
  checkEq('日程标题', ev.body.title, '社团例会');
  checkEq('地点', ev.body.location, 'B203');
  const evId = ev.body.id;

  await req('POST', '/api/events', { title: '交作业', startsAt: '2026-12-05' });

  const evList = await req('GET', '/api/events');
  checkEq('日程列表数量', evList.body.count, 2);
  checkEq('按时间升序', evList.body.items[0].title, '社团例会');

  checkEq('更新日程地点', (await req('PATCH', `/api/events/${evId}`, { location: 'A101' })).body.location, 'A101');
  checkEq('按日期筛选日程', (await req('GET', '/api/events?from=2026-12-01&to=2026-12-01')).body.count, 1);
  checkEq('非法时间被拒绝', (await req('POST', '/api/events', { title: 'x', startsAt: '不是时间' })).status, 400);
  checkEq('删除日程', (await req('DELETE', `/api/events/${evId}`)).status, 204);

  // ---------- journal ----------
  console.log('\n[日记]');
  const j1 = await req('POST', '/api/journal', {
    title: '今天的收获',
    content: '学会了 node:sqlite。',
    mood: '不错',
    entryDate: '2026-10-25',
  });
  checkEq('写日记状态码', j1.status, 201);
  checkEq('日记标题', j1.body.title, '今天的收获');
  checkEq('心情', j1.body.mood, '不错');
  const jId = j1.body.id;

  await req('POST', '/api/journal', { title: '第二篇', content: '随便写写', entryDate: '2026-10-26' });

  const jList = await req('GET', '/api/journal');
  checkEq('日记数量', jList.body.count, 2);
  checkEq('按日期倒序', jList.body.items[0].title, '第二篇');
  checkEq('日记全文搜索', (await req('GET', '/api/journal?q=sqlite')).body.count, 1);
  checkEq('limit 生效', (await req('GET', '/api/journal?limit=1')).body.count, 1);
  checkEq('更新日记内容', (await req('PATCH', `/api/journal/${jId}`, { content: '改过的内容' })).body.content, '改过的内容');
  checkEq('删除日记', (await req('DELETE', `/api/journal/${jId}`)).status, 204);

  // ---------- 笔记 ----------
  console.log('\n[笔记]');
  const n1 = await req('POST', '/api/notes', { title: '读书摘录', content: '好的设计是尽可能少的设计。', tags: '读书,设计' });
  checkEq('新建笔记状态码', n1.status, 201);
  checkEq('标签解析成数组', n1.body.tags, ['读书', '设计']);
  const n2 = await req('POST', '/api/notes', { title: '临时想法', content: '给博客加一个书单页。' });
  checkEq('默认不置顶', n2.body.pinned, false);

  checkEq('笔记列表数量', (await req('GET', '/api/notes')).body.count, 2);
  checkEq('笔记关键词搜索', (await req('GET', '/api/notes?q=设计')).body.count, 1);
  checkEq('按标签筛选', (await req('GET', '/api/notes?tag=读书')).body.count, 1);

  const pinned = await req('PATCH', `/api/notes/${n1.body.id}`, { pinned: true });
  checkEq('置顶成功', pinned.body.pinned, true);
  checkEq('置顶排在最前', (await req('GET', '/api/notes')).body.items[0].title, '读书摘录');

  checkEq('删除笔记', (await req('DELETE', `/api/notes/${n2.body.id}`)).status, 204);
  checkEq('删除后剩 1 篇', (await req('GET', '/api/notes')).body.count, 1);
  checkEq('空标题被拒绝', (await req('POST', '/api/notes', { title: '' })).status, 400);

  // ---------- 考试 ----------
  console.log('\n[考试]');
  const pad2 = (n) => String(n).padStart(2, '0');
  const dstr = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  const todayStr = dstr(0);

  const ex1 = await req('POST', '/api/exams', {
    name: '中国历史导论 期末',
    subject: '历史',
    examAt: dstr(5) + 'T09:00:00+08:00',
    location: 'B203',
    seat: '17',
  });
  checkEq('新建考试状态码', ex1.status, 201);
  checkEq('考试名称', ex1.body.name, '中国历史导论 期末');
  checkEq('剩余天数计算', ex1.body.daysLeft, 5);
  checkEq('默认待考', ex1.body.status, 'planned');

  const ex2 = await req('POST', '/api/exams', { name: '现代汉语 小测', examAt: dstr(-3) });
  checkEq('过去的考试 daysLeft 为负', ex2.body.daysLeft, -3);

  checkEq('全部考试 2 场', (await req('GET', '/api/exams')).body.count, 2);
  checkEq('待考筛选只含未来', (await req('GET', '/api/exams?upcoming=1')).body.count, 1);

  const graded = await req('PATCH', `/api/exams/${ex2.body.id}`, { status: 'done', score: 88 });
  checkEq('标记已考', graded.body.status, 'done');
  checkEq('成绩保存', graded.body.score, 88);
  checkEq('按已考筛选', (await req('GET', '/api/exams?status=done')).body.count, 1);
  checkEq('非法状态被拒绝', (await req('PATCH', `/api/exams/${ex2.body.id}`, { status: 'nope' })).status, 400);
  checkEq('缺 examAt 被拒绝', (await req('POST', '/api/exams', { name: 'x' })).status, 400);

  checkEq('删除考试', (await req('DELETE', `/api/exams/${ex2.body.id}`)).status, 204);

  // ---------- 饮食 ----------
  console.log('\n[饮食]');
  const m1 = await req('POST', '/api/meals', { name: '番茄牛腩饭', mealType: '午餐', calories: 620, eatenAt: todayStr });
  checkEq('记一顿状态码', m1.status, 201);
  checkEq('餐次', m1.body.mealType, '午餐');
  checkEq('热量', m1.body.calories, 620);

  await req('POST', '/api/meals', { name: '豆浆油条', mealType: '早餐', calories: 380, eatenAt: todayStr });
  await req('POST', '/api/meals', { name: '苹果', mealType: '加餐', calories: 90, eatenAt: dstr(-1) });

  const mealSum = await req('GET', '/api/meals/summary');
  checkEq('今日热量合计', mealSum.body.today.calories, 1000);
  checkEq('今日餐数', mealSum.body.today.count, 2);
  checkEq('按餐次分布含 4 项', mealSum.body.byType.length, 4);
  checkEq('午餐热量', mealSum.body.byType.find((t) => t.mealType === '午餐').calories, 620);

  checkEq('按餐次筛选', (await req('GET', '/api/meals?type=早餐')).body.count, 1);
  checkEq('非法餐次被拒绝', (await req('POST', '/api/meals', { name: 'x', mealType: '夜宵' })).status, 400);
  checkEq('缺名称被拒绝', (await req('POST', '/api/meals', { calories: 100 })).status, 400);
  checkEq('删除饮食记录', (await req('DELETE', `/api/meals/${m1.body.id}`)).status, 204);

  // ---------- 运动 ----------
  console.log('\n[运动]');
  const w1 = await req('POST', '/api/workouts', { kind: '跑步', durationMin: 30, calories: 260, doneAt: todayStr });
  checkEq('记一次运动状态码', w1.status, 201);
  checkEq('运动类型', w1.body.kind, '跑步');
  checkEq('时长', w1.body.durationMin, 30);

  await req('POST', '/api/workouts', { kind: '力量', durationMin: 45, doneAt: dstr(-1) });

  const wSum = await req('GET', '/api/workouts/summary');
  checkEq('本周总时长', wSum.body.thisWeek.minutes, 75);
  checkEq('今日时长', wSum.body.today.minutes, 30);
  checkEq('连续天数至少 2', wSum.body.streakDays >= 2, true);

  checkEq('按类型筛选', (await req('GET', '/api/workouts?kind=力量')).body.count, 1);
  checkEq('时长必须为正', (await req('POST', '/api/workouts', { kind: '跑步', durationMin: 0 })).status, 400);
  checkEq('非法类型被拒绝', (await req('POST', '/api/workouts', { kind: '爬山', durationMin: 30 })).status, 400);
  checkEq('删除运动记录', (await req('DELETE', `/api/workouts/${w1.body.id}`)).status, 204);

  // ---------- summary ----------
  console.log('\n[首页汇总]');
  const summ = await req('GET', '/api/summary');
  checkEq('汇总接口状态码', summ.status, 200);
  checkEq('待办总数（3 建 1 删）', summ.body.todos.total, 2);
  checkEq('未完成数', summ.body.todos.open, 2);
  checkEq('本月支出字段存在', typeof summ.body.expenses.thisMonth, 'number');
  checkEq('汇总含笔记数', summ.body.notes.total, 1);
  checkEq('汇总含下一场考试', summ.body.exams.next.name, '中国历史导论 期末');
  checkEq('汇总考试剩余天数', summ.body.exams.next.daysLeft, 5);
  checkEq('汇总今日摄入（删掉 620 后剩 380）', summ.body.meals.todayCalories, 380);
  checkEq('汇总本周运动（删掉 30 后剩 45）', summ.body.workouts.weekMinutes, 45);

  // ---------- 错误处理 ----------
  console.log('\n[错误处理]');
  checkEq('未知接口返回 404', (await req('GET', '/api/nope')).status, 404);
  checkEq('非法 JSON 返回 400', (await fetch(BASE + '/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{坏掉的 JSON',
  })).status, 400);
}

async function main() {
  let server = null;

  if (!EXTERNAL_BASE) {
    console.log('启动临时测试服务…');
    server = await startTempServer();
  }

  try {
    await runTests();
  } finally {
    if (server) server.stop();
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`通过 ${pass} 项，失败 ${fail} 项`);
  if (fail > 0) {
    console.log('\n失败明细：');
    for (const f of failures) console.log('  · ' + f);
    process.exitCode = 1;
  } else {
    console.log('全部通过 \u2705');
  }
}

main().catch((err) => {
  console.error('\n测试无法完成：', err.message);
  process.exitCode = 1;
});
