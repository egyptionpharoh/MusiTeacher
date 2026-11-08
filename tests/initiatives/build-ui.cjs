// يبني الواجهة للاختبار خارج Next:  node tests/initiatives/build-ui.cjs  ثم  node tests/initiatives/harness.mjs
const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '../..'); const out = path.join(__dirname, '_dist');
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require(process.env.ESBUILD_PATH || '/opt/npm-tools/node_modules/esbuild'); }
fs.mkdirSync(out, { recursive: true });
esbuild.build({
  entryPoints: [path.join(__dirname, 'ui-entry.js')], bundle: true, outdir: out, entryNames: 'app', format: 'esm', splitting: true, jsx: 'automatic', loader: { '.js': 'jsx' },
  define: { 'process.env.NODE_ENV': '"development"' }, nodePaths: [path.join(root, 'node_modules'), '/opt/npm-tools/node_modules'], logLevel: 'warning',
  plugins: [{ name: 'alias', setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(root, 'tests/audio-separator/stubs/link.js') }));
    b.onResolve({ filter: /^@\/lib\/firebase$/ }, () => ({ path: path.join(root, 'tests/audio-separator/stubs/firebase.js') }));
    b.onResolve({ filter: /^@\// }, (a) => { const p = path.join(root, 'src', a.path.slice(2)); for (const e of ['', '.js', '.jsx']) if (fs.existsSync(p + e) && fs.statSync(p + e).isFile()) return { path: p + e }; return { path: p }; });
  } }],
}).then(() => {
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').split('\n').filter((l) => !/^@import/.test(l)).join('\n');
  fs.writeFileSync(path.join(out, 'globals.css'), css);
  fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مبادرات تعليمية</title><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/app.css"></head><body><style>main{padding:1rem}@media(min-width:768px){main{padding:2rem}}</style><main><div id="root"></div></main><script type="module" src="/app.js"></script></body></html>');
  console.log('built');
}).catch((e) => { console.error(e); process.exit(1); });
