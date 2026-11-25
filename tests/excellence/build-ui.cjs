// يبني صفحة اختبار «كوبون التميز» + قسم المبادرات:  bun tests/excellence/build-ui.cjs  ثم  node tests/excellence/serve.cjs
const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '../..'); const out = path.join(__dirname, '_dist');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const stub = { '@/lib/firebase': 'tests/excellence/stub-firebase.js', '@/modules/class-alarm/adapters/musiteacherClient': 'tests/excellence/stub-client.js', 'next/link': 'tests/stubs/link.js' };
const alias = { name: 'alias', setup(b) {
  b.onResolve({ filter: /^(next\/link|@\/lib\/firebase|@\/modules\/class-alarm\/adapters\/musiteacherClient)$/ }, (a) => ({ path: path.join(root, stub[a.path]) }));
  b.onResolve({ filter: /^@\// }, (a) => { const p = path.join(root, 'src', a.path.slice(2)); for (const e of ['', '.js', '.jsx']) if (fs.existsSync(p + e) && fs.statSync(p + e).isFile()) return { path: p + e }; return { path: p }; });
} };
Bun.build({ entrypoints: [path.join(__dirname, 'ui-entry.js')], outdir: out, target: 'browser', define: { 'process.env.NODE_ENV': '"development"' }, loader: { '.js': 'jsx' }, plugins: [alias] }).then((r) => {
  if (!r.success) { console.error(r.logs.map(String).join('\n')); process.exit(1); }
  fs.copyFileSync(path.join(root, 'src/app/globals.css'), path.join(out, 'globals.css'));
  // خط Cairo المحلي من المشروع (بيئة الاختبار بلا إنترنت) حتى تطابق القياسات ما يراه المعلم
  fs.copyFileSync(path.join(root, 'public/games/musiteacher-randomizer/fonts/Cairo.woff'), path.join(out, 'Cairo.woff'));
  fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>كوبون التميز</title><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/ui-entry.css"><style>@font-face{font-family:Cairo;src:url(/Cairo.woff) format("woff");font-weight:200 1000;font-display:block}body{margin:0}.mt-dash-main{padding:1rem}@media (min-width:768px){.mt-dash-main{padding:2rem}}</style></head><body><div id="root"></div><script type="module" src="/ui-entry.js"></script></body></html>');
  console.log('built');
});
