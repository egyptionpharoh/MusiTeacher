// يبني تطبيق اختبار التنقل في «أدوات المعلم»:  bun tests/tools-nav/build-ui.cjs  ثم  node tests/tools-nav/serve.cjs
const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '../..'); const out = path.join(__dirname, '_dist');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const here = (f) => path.join(__dirname, f);
const STUB = { 'next/link': here('router-stub.js'), 'next/navigation': here('router-stub.js'), 'lucide-react': here('stub-lucide.js'),
  '@/lib/firebase': here('stub-firebase.js'), 'firebase/auth': here('stub-firebase.js'), 'firebase/app': here('stub-firebase.js') };
const missing = new Set();
const alias = { name: 'alias', setup(b) {
  b.onResolve({ filter: /^(next\/link|next\/navigation|lucide-react|@\/lib\/firebase|firebase\/auth|firebase\/app)$/ }, (a) => ({ path: STUB[a.path] }));
  b.onResolve({ filter: /adapters\/musiteacher(Client|Auth)(\.js)?$/ }, () => ({ path: here('stub-client.js') }));
  b.onResolve({ filter: /^@\// }, (a) => { const p = path.join(root, 'src', a.path.slice(2)); for (const e of ['', '.js', '.jsx', '.json', '/index.js']) if (fs.existsSync(p + e) && fs.statSync(p + e).isFile()) return { path: p + e }; missing.add(a.path); return { path: here('stub-firebase.js') }; });
} };
Bun.build({ entrypoints: [here('ui-entry.js')], outdir: out, target: 'browser', define: { 'process.env.NODE_ENV': '"development"' }, loader: { '.js': 'jsx' }, plugins: [alias] }).then((r) => {
  if (missing.size) console.error('MISSING', [...missing]);
  if (!r.success) { console.error(r.logs.map(String).join('\n').slice(0, 3000)); process.exit(1); }
  fs.copyFileSync(path.join(root, 'src/app/globals.css'), path.join(out, 'globals.css'));
  fs.copyFileSync(path.join(root, 'public/games/musiteacher-randomizer/fonts/Cairo.woff'), path.join(out, 'Cairo.woff'));
  fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>أدوات المعلم</title><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/ui-entry.css"><style>@font-face{font-family:Cairo;src:url(/Cairo.woff) format("woff");font-weight:200 1000}body{margin:0;font-family:Cairo,sans-serif}.mt-dash-main{padding:1rem}@media (min-width:768px){.mt-dash-main{padding:2rem}}</style></head><body><div id="root"></div><script type="module" src="/ui-entry.js"></script></body></html>');
  console.log('built');
});
