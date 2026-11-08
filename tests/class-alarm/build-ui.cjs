// يبني الأداة للاختبار خارج Next:  node tests/class-alarm/build-ui.cjs  ثم  node tests/class-alarm/serve.cjs
// يستخدم esbuild إن وُجد في node_modules، وإلا Bun (bun tests/class-alarm/build-ui.cjs)
const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '../..'); const out = path.join(__dirname, '_dist');
fs.mkdirSync(out, { recursive: true });
const entry = path.join(__dirname, 'ui-entry.js');
const finish = () => {
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').split('\n').filter((l) => !/^@import/.test(l)).join('\n');
  fs.writeFileSync(path.join(out, 'globals.css'), css);
  for (const f of ['class-alarm-sw.js', 'class-alarm.webmanifest']) fs.copyFileSync(path.join(root, 'public', f), path.join(out, f));
  fs.mkdirSync(path.join(out, 'class-alarm'), { recursive: true });
  for (const f of fs.readdirSync(path.join(root, 'public/class-alarm'))) fs.copyFileSync(path.join(root, 'public/class-alarm', f), path.join(out, 'class-alarm', f));
  fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>منبّه الحصص الذكي</title><link rel="manifest" href="/class-alarm.webmanifest"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/ui-entry.css"></head><body><main style="padding:1rem"><div id="root"></div></main><script type="module" src="/ui-entry.js"></script></body></html>');
  console.log('built');
};
let esbuild = null; try { esbuild = require('esbuild'); } catch { /* */ }
if (esbuild) {
  esbuild.build({ entryPoints: [entry], bundle: true, outdir: out, format: 'esm', splitting: true, jsx: 'automatic', loader: { '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"development"' }, nodePaths: [path.join(root, 'node_modules')], logLevel: 'warning' }).then(finish).catch((e) => { console.error(e); process.exit(1); });
} else if (typeof Bun !== 'undefined') {
  Bun.build({ entrypoints: [entry], outdir: out, target: 'browser', splitting: true, define: { 'process.env.NODE_ENV': '"development"' }, loader: { '.js': 'jsx' } }).then((r) => { if (!r.success) { console.error(r.logs); process.exit(1); } finish(); });
} else { console.error('يلزم esbuild أو Bun'); process.exit(1); }
