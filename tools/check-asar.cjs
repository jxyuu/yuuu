'use strict';
// 校验打包产物里的 app.asar 是否包含运行所需的文件
const asar = require('@electron/asar');

const p = process.argv[2];
const files = asar.listPackage(p).map((f) => f.replace(/\\/g, '/'));

const want = [
  '/server/index.js',
  '/server/db.js',
  '/server/validate.js',
  '/server/routes/todos.js',
  '/server/routes/expenses.js',
  '/server/routes/events.js',
  '/server/routes/journal.js',
  '/server/routes/notes.js',
  '/server/routes/exams.js',
  '/server/routes/meals.js',
  '/server/routes/workouts.js',
  '/public/index.html',
  '/package.json',
  '/desktop/main.js',
];

let missing = 0;
for (const w of want) {
  const hit = files.some((f) => f.toLowerCase().endsWith(w.toLowerCase()));
  if (!hit) missing += 1;
  console.log((hit ? 'OK   ' : 'MISS ') + w);
}

// 应当被忽略的
const mustNotHave = [
  ['client/src', '/client/src/'],
  ['client/node_modules', '/client/node_modules/'],
  ['release', '/release/'],
  ['data', '/data/'],
];
for (const [label, frag] of mustNotHave) {
  const bad = files.some((f) => f.includes(frag));
  console.log((bad ? 'BAD  ' : 'OK   ') + `不应包含 ${label}`);
  if (bad) missing += 1;
}

// express 是否打进去了
const hasExpress = files.some((f) => f.includes('/node_modules/express/index.js'));
console.log((hasExpress ? 'OK   ' : 'MISS ') + 'node_modules/express（运行时依赖）');
if (!hasExpress) missing += 1;

console.log(`\n条目总数: ${files.length}   问题: ${missing}`);
process.exit(missing ? 1 : 0);
