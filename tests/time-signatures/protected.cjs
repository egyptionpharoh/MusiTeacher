// تشغيل اللعبة عبر طبقة الحماية الحقيقية (جلسة موقّعة + /play/) داخل صفحة تحاكي مشغّل المنصة (iframe بنفس sandbox)
const { chromium } = require('playwright');
const assert = require('assert/strict');
const SP = require('os').tmpdir() + '/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const out = []; const ok = (n) => { out.push('✅ ' + n); console.log('✅ ' + n); };
  const open = async (g) => {
    const page = await ctx.newPage(), errors = [], status = {};
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts\.g|ERR_NAME/.test(m.text())) errors.push(m.text()); });
    page.on('response', (r) => { const u = r.url(); if (/\/play\//.test(u)) status[u.replace(/^.*\/play\//, '')] = r.status(); });
    await page.goto('http://127.0.0.1:5300/stage.html?g=' + g);
    await page.waitForFunction(() => window.__sess, null, { timeout: 8000 });
    const sess = await page.evaluate(() => window.__sess);
    let fr; for (let i = 0; i < 100 && !(fr = page.frames().find((f) => /\/play\//.test(f.url()))); i++) await page.waitForTimeout(100);
    await fr.waitForLoadState('load');
    return { page, fr, sess, errors, status };
  };

  // ---------- طريقة أداء الموازين ----------
  const T = await open('time-signatures');
  assert.equal(T.sess.ok, true); assert.equal(T.sess.playUrl, '/play/time-signatures/index.html'); ok('الجلسة الموقّعة للمشترك: ' + T.sess.playUrl);
  await T.fr.waitForFunction(() => window.conductorViewer && window.conductorViewer.ready, null, { timeout: 120000 });
  assert.equal(await T.fr.locator('#mt-ip-mark').count(), 1); ok('اللعبة تعمل داخل المشغّل المحمي، وعلامة الملكية محقونة من الخادم');
  const fbx = Object.entries(T.status).find(([k]) => /character-girl\.fbx/.test(k));
  assert.ok(fbx && fbx[1] === 200); assert.equal(T.status['time-signatures/_shared/3d/vendor/three/three.module.js'], 200);
  ok('النموذج المشترك وthree.js يُحمَّلان عبر /play/time-signatures/_shared/ بكوكي هذه اللعبة (200)');
  await T.fr.click('#stages [data-stage=pulse]');
  await T.fr.click('#btnPlay'); await T.page.waitForTimeout(2500);
  const st = await T.fr.evaluate(() => ({ playing: window.conductorViewer.engine.transport.playing, loaded: window.conductorViewer.engine.audio.loaded, n: window.conductorViewer.engine.audio.stats.scheduled }));
  assert.ok(st.playing && st.loaded && st.n >= 2); ok(`الأداء والنبض المسموع يعملان داخل الإطار المحمي (أصوات حقيقية محمّلة، ${st.n} نقرات مجدولة)`);
  assert.ok(['wood-a.mp3', 'wood-1.mp3'].every((f) => T.status['time-signatures/audio/' + f] === 200));
  await T.fr.click('#btnPlay');
  await T.fr.click('#btnFull');
  await T.page.waitForFunction(() => document.fullscreenElement && document.fullscreenElement.classList.contains('vlp-stage'), null, { timeout: 4000 });
  ok('ملء الشاشة يكبّر منصة اللعبة في الصفحة الأم (.vlp-stage) كبقية الألعاب');
  await T.page.waitForTimeout(400); await T.page.screenshot({ path: SP + 'p_full.png' });
  await T.fr.click('#btnFull');
  await T.page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 4000 }); ok('العودة من ملء الشاشة');
  // الإغلاق: إزالة الإطار (كما يفعل زر الرجوع/الإغلاق في المنصة) لا تترك أخطاء
  await T.fr.click('#btnPlay'); await T.page.waitForTimeout(500);
  await T.page.evaluate(() => document.getElementById('f').remove()); await T.page.waitForTimeout(500);
  assert.deepEqual(T.errors, []); ok('إغلاق اللعبة أثناء الأداء (إزالة الإطار): لا أخطاء، ولا شيء يعمل بعدها');
  // فتح الرابط مباشرة
  const p2 = await ctx.newPage();
  assert.equal((await p2.goto('http://127.0.0.1:5300' + T.sess.playUrl)).status(), 403); ok('فتح رابط اللعبة مباشرة في تبويب (حتى مع الكوكي) → 403');
  const ctx2 = await b.newContext(); const p3 = await ctx2.newPage();
  assert.equal((await p3.goto('http://127.0.0.1:5300/play/time-signatures/src/patterns.js')).status(), 401);
  assert.equal((await p3.goto('http://127.0.0.1:5300/play/time-signatures/_shared/3d/models/character-girl.fbx')).status(), 401);
  ok('ملفات اللعبة والنموذج بدون جلسة → 401');

  // ---------- الأكورديون كما هو ----------
  const A = await open('accordion-3d');
  await A.fr.waitForFunction(() => window.accordionViewer && window.accordionViewer.ready, null, { timeout: 120000 });
  const acc = await A.fr.evaluate(() => { const V = window.accordionViewer; return { performer: V.performer, qa: Object.keys(V.qa() || {}).length, keys: V.acc && V.acc.keys ? V.acc.keys.length : null }; });
  await A.page.waitForTimeout(1500);
  await A.page.screenshot({ path: SP + 'p_accordion.png' });
  assert.deepEqual(A.errors, []);
  ok(`عازفة الأكورديون ثلاثية الأبعاد تعمل كما هي في المشغّل المحمي (الشخصية: ${acc.performer}، بلا أخطاء)`);
  console.log('\n' + out.join('\n'));
  await b.close();
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
