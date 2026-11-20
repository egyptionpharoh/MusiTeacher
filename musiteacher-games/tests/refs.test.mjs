// اختبارات فحص المراجع ومحاكي توجيه Vercel
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkGame } from '../scripts/check-refs.mjs';
import { makeRouter } from '../scripts/vercel-router.mjs';

function tree(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mtg-'));
  for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), c); }
  return d;
}

test('فحص المراجع يكتشف: اختلاف حالة الأحرف، ملف ناقص، مسار يخرج من مجلد اللعبة، مسار مطلق', () => {
  const root = tree({
    'games/demo/index.html': '<link rel="stylesheet" href="./src/UI/style.css"><script src="../_shared/x.js"></script><script src="/abs.js"></script><script type="module" src="./src/main.js"></script>',
    'games/demo/src/ui/style.css': 'body{background:url(../img/bg.png)}',
    'games/demo/src/main.js': "import { a } from './missing.js'; import b from './ok.js'; const m = './_shared/models/m.fbx';",
    'games/demo/src/ok.js': 'export default 1',
    'games/_shared/x.js': '', 'games/_shared/models/m.fbx': '',
  });
  const files = ['index.html', 'src/ui/style.css', 'src/main.js', 'src/ok.js'];
  const p = checkGame(path.join(root, 'games/demo'), path.join(root, 'games/_shared'), files).map((x) => x.ref);
  assert.ok(p.includes('./src/UI/style.css'), 'حالة الأحرف');
  assert.ok(p.includes('../_shared/x.js'), 'خروج من مجلد اللعبة');
  assert.ok(p.includes('/abs.js'), 'مسار مطلق');
  assert.ok(p.includes('../img/bg.png'), 'صورة ناقصة في CSS');
  assert.ok(p.includes('./missing.js'), 'استيراد ناقص');
  assert.ok(!p.includes('./ok.js') && !p.includes('./_shared/models/m.fbx'), 'لا إنذار كاذب');
});

test('محاكي Vercel: الإعدادات الحالية لا تغيّر مسارات الألعاب، والقديمة كانت تكسرها', () => {
  const root = tree({ 'public/games/demo.html': 'x', 'public/index.html': 'x' });
  const route = (cfg, u) => { fs.writeFileSync(path.join(root, 'vercel.json'), JSON.stringify(cfg)); return makeRouter(root).route(u); };
  const now = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(route(now, '/g/demo/index.html').fn, 'play');
  assert.equal(route(now, '/g/demo/index.html').query.get('p'), 'index.html');
  assert.equal(route(now, '/g/demo/src/ui/style.css').query.get('p'), 'src/ui/style.css');
  assert.ok(route(now, '/games/demo').file.endsWith('demo.html'));
  assert.ok(route(now, '/').file.endsWith('index.html'));
  // إعدادات النشر الأولى (سبب عطل الألعاب الثقيلة): كانت تحوّل الروابط فتضيع مجلدات الألعاب
  const old = { ...now, cleanUrls: true, trailingSlash: false };
  assert.equal(route(old, '/g/demo/').redirect, '/g/demo');
  assert.equal(route(old, '/g/demo/index.html').redirect, '/g/demo');
});
