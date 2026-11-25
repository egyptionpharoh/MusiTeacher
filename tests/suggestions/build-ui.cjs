// يبني واجهتي «صندوق الاقتراحات» للاختبار خارج Next:  bun tests/suggestions/build-ui.cjs  ثم  node tests/suggestions/serve.mjs
const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '../..'); const out = path.join(__dirname, '_dist');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const alias = {
  name: 'alias', setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(root, 'tests/stubs/link.js') }));
    b.onResolve({ filter: /^@\// }, (a) => { let p = path.join(root, 'src', a.path.slice(2)); for (const ext of ['', '.js', '.jsx']) if (fs.existsSync(p + ext) && fs.statSync(p + ext).isFile()) return { path: p + ext }; return { path: p }; });
  },
};
Bun.build({ entrypoints: [path.join(__dirname, 'ui-entry.js')], outdir: out, target: 'browser', define: { 'process.env.NODE_ENV': '"development"' }, loader: { '.js': 'jsx' }, plugins: [alias] })
  .then((r) => {
    if (!r.success) { console.error(r.logs); process.exit(1); }
    fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>صندوق الاقتراحات</title><link rel="stylesheet" href="/ui-entry.css"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/ui-entry.js"></script></body></html>');
    console.log('built');
  });
