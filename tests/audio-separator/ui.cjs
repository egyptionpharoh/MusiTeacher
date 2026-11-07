// اختبار الواجهة من البداية للنهاية في متصفح حقيقي (Playwright) مقابل خادم الاختبار:
//   node tests/audio-separator/build-ui.cjs && node tests/audio-separator/ui.cjs
// الخادم يستعمل معالجات الإنتاج الحقيقية؛ فقط التخزين ومزوّد الفصل بدائل في الذاكرة (لا تكلفة ولا اتصال خارجي).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const assert = require('assert/strict');
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const SHOTS = process.env.SHOTS_DIR || require('os').tmpdir();
const FIX = path.resolve('tests/audio-separator/fixtures');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const out = []; const ok = (n) => { out.push('✅ ' + n); console.log('✅ ' + n); };

function harness(port, env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['tests/audio-separator/harness.mjs'], { env: { ...process.env, PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'inherit'] });
    p.stdout.on('data', (d) => { if (/harness on/.test(String(d))) resolve(p); });
    p.on('exit', (c) => reject(new Error('harness exited ' + c)));
  });
}

(async () => {
  const procs = []; global.__procs = procs;
  const SONG = path.join(SHOTS, 'أغنية الاختبار.mp3');
  fs.copyFileSync(path.join(FIX, 'tone-vbr.mp3'), SONG);
  const songHash = sha(SONG);
  const SONG_FILE = { name: 'أغنية الاختبار.mp3', mimeType: 'audio/mpeg', buffer: fs.readFileSync(SONG) };
  procs.push(await harness(5311, { HARNESS_SPEED: '2' }));
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    const B = 'http://127.0.0.1:5311';
    const state = async () => (await (await fetch(B + '/__state')).json());

    // ---------- 1) الإعداد
    await page.goto(B + '/');
    await page.waitForSelector('.as-drop');
    const startBtn = page.locator('.as-primary');
    assert.equal(await startBtn.isDisabled(), true);
    await page.screenshot({ path: path.join(SHOTS, 'as_desktop_setup_empty.png'), fullPage: true });
    await page.setInputFiles('.as-drop input[type=file]', SONG_FILE);
    await page.waitForSelector('.as-file');
    const metaTxt = await page.locator('.as-file-meta').innerText();
    assert.match(await page.locator('.as-file-name').innerText(), /أغنية الاختبار\.mp3/);
    assert.match(metaTxt, /MP3/); assert.match(metaTxt, /0:04/); assert.match(metaTxt, /KB/);
    ok('رفع ملف MP3: يظهر الاسم والحجم والمدة ومعدل البت التقريبي');
    assert.equal(await startBtn.isDisabled(), true);
    assert.match(await page.locator('.as-cta-hint').innerText(), /حدّد النتيجة المطلوبة/);
    await page.click('.as-mode-music');
    assert.equal(await page.locator('.as-mode-music').getAttribute('aria-checked'), 'true');
    assert.equal(await page.locator('.as-lane-voice').getAttribute('class').then((c) => /is-dim/.test(c)), true);
    ok('اختيار «الموسيقى فقط» يضيء مسار الموسيقى في الموجة ويخفت مسار الصوت');
    assert.equal(await startBtn.isDisabled(), true, 'لا يبدأ قبل الإقرارين');
    const checks = page.locator('.as-check input'); await checks.nth(0).check(); await checks.nth(1).check();
    assert.equal(await startBtn.isDisabled(), false);
    assert.match(await startBtn.innerText(), /ابدأ استخراج الموسيقى/);
    assert.match(await page.locator('.as-note').innerText(), /لا يعيد تفاصيل غير موجودة/);
    ok('زر البدء معطّل حتى يكتمل الملف والاختيار والإقراران، وتنبيه صادق عن معدل 320');
    await page.screenshot({ path: path.join(SHOTS, 'as_desktop_setup_ready.png'), fullPage: true });

    // ---------- 2) التنفيذ (نقر مزدوج لا يكرر الطلب)
    await startBtn.dblclick();
    await page.waitForSelector('.as-progress');
    await page.waitForFunction(() => /فصل الصوت بالذكاء/.test(document.querySelector('.as-stages li.is-now')?.innerText || ''), null, { timeout: 15000 });
    await page.waitForFunction(() => /\d+%/.test(document.querySelector('.as-stages li.is-now .as-stage-detail')?.innerText || ''), null, { timeout: 15000 });
    const pctTxt = await page.locator('.as-stages li.is-now .as-stage-detail').innerText();
    ok(`مراحل المعالجة الحقيقية تظهر، مع نسبة من سجل النموذج: ${pctTxt}`);
    await page.screenshot({ path: path.join(SHOTS, 'as_desktop_processing.png'), fullPage: true });
    let st = await state();
    assert.equal(st.creates, 1); assert.equal(st.jobs.length, 1);
    ok('النقر المزدوج على «ابدأ» أنشأ عملية واحدة فقط');

    // ---------- 3) انقطاع الاتصال أثناء المعالجة ثم عودته
    await page.route('**/api/audio-separator/jobs/*', (r) => r.abort('internetdisconnected'));
    await page.waitForSelector('.as-progress .as-inline-err', { timeout: 15000 });
    ok('انقطاع الاتصال أثناء المعالجة: رسالة واضحة دون إفشال العملية');
    await page.unroute('**/api/audio-separator/jobs/*');

    // ---------- 4) النتيجة
    await page.waitForSelector('.as-result', { timeout: 40000 });
    ok('عاد الاتصال وتابعت الواجهة حتى اكتمال الفصل');
    st = await state();
    const job = st.jobs[0];
    assert.equal(job.status, 'ready');
    assert.ok(!st.objects.includes(job.inputKey), 'الأصل حُذف من التخزين'); assert.ok(st.objects.includes(job.outputKey));
    ok('بعد الانتهاء: الملف الأصلي حُذف من التخزين، والنتيجة وحدها محفوظة');
    assert.match(await page.locator('.as-result-head .as-muted').innerText(), /أغنية_الاختبار_Instrumental\.mp3/);
    await page.click('.as-playbtn');
    await page.waitForFunction(() => { const a = document.querySelector('.as-player audio'); return a && a.currentTime > 0.6 && !a.paused; }, null, { timeout: 8000 });
    const dur = await page.locator('.as-transport .as-time').nth(1).innerText();
    assert.equal(dur, '0:04');
    ok('المشغّل: تشغيل فعلي للنتيجة ومعرفة المدة (0:04)');
    await page.click('.as-playbtn');
    assert.equal(await page.evaluate(() => document.querySelector('.as-player audio').paused), true);
    await page.locator('.as-seek').fill('2.5');
    assert.ok(Math.abs(await page.evaluate(() => document.querySelector('.as-player audio').currentTime) - 2.5) < 0.2);
    await page.locator('.as-vol input').fill('0.3');
    assert.ok(Math.abs(await page.evaluate(() => document.querySelector('.as-player audio').volume) - 0.3) < 0.01);
    await page.click('.as-vol .as-iconbtn');
    assert.equal(await page.evaluate(() => document.querySelector('.as-player audio').muted), true);
    await page.click('.as-vol .as-iconbtn');
    await page.click('text=إعادة الاستماع من البداية');
    await page.waitForFunction(() => { const a = document.querySelector('.as-player audio'); return !a.paused && a.currentTime < 1.5; });
    ok('إيقاف، تنقل داخل التسجيل، التحكم في الصوت والكتم، وإعادة الاستماع من البداية');
    await page.click('.as-ab button:nth-child(2)');
    await page.waitForFunction(() => document.querySelector('.as-player audio').src.startsWith('blob:'));
    await page.click('.as-ab button:nth-child(1)');
    await page.waitForFunction(() => !document.querySelector('.as-player audio').src.startsWith('blob:'));
    ok('المقارنة بين النتيجة والتسجيل الأصلي من النقطة الزمنية نفسها');
    await page.click('.as-playbtn').catch(() => {});
    await page.screenshot({ path: path.join(SHOTS, 'as_desktop_result.png'), fullPage: true });

    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.as-downloads a.as-primary')]);
    const dlPath = path.join(SHOTS, 'dl_' + dl.suggestedFilename());
    await dl.saveAs(dlPath);
    assert.equal(dl.suggestedFilename(), 'أغنية_الاختبار_Instrumental.mp3');
    assert.equal(sha(dlPath), sha(path.join(FIX, 'tone-cbr.mp3')));
    ok(`التنزيل باسم واضح: ${dl.suggestedFilename()} (المحتوى مطابق لما أنتجه المزوّد بايتًا ببايت)`);
    assert.equal(sha(SONG), songHash);
    ok('الملف الأصلي على الجهاز لم يتغير (بصمة SHA-256 مطابقة)');
    fs.writeFileSync(path.join(SHOTS, 'downloaded_path.txt'), dlPath);

    // ---------- 5) استئناف بعد تحديث الصفحة ثم الحذف
    await page.reload();
    await page.waitForSelector('.as-result');
    assert.match(await page.locator('.as-banner').innerText(), /آخر نتيجة لك/);
    ok('بعد تحديث الصفحة: تعود النتيجة المتاحة تلقائيًا');
    await page.click('text=حذف النتيجة الآن');
    await page.waitForSelector('.as-drop');
    st = await state();
    assert.equal(st.objects.length, 0); assert.equal(st.jobs[0].status, 'deleted');
    ok('«حذف النتيجة الآن» يحذف الملف من التخزين فورًا');

    // ---------- 6) الصوت البشري فقط بصيغة WAV + استئناف أثناء المعالجة
    await page.setInputFiles('.as-drop input[type=file]', SONG_FILE);
    await page.click('.as-mode-voice');
    await page.click('.as-quality button:has-text("WAV")');
    await checks.nth(0).check(); await checks.nth(1).check();
    assert.match(await startBtn.innerText(), /ابدأ استخراج الصوت البشري/);
    await startBtn.click();
    await page.waitForFunction(() => /تجهيز خادم|فصل الصوت/.test(document.querySelector('.as-stages li.is-now')?.innerText || ''), null, { timeout: 15000 });
    await page.reload();
    await page.waitForSelector('.as-progress', { timeout: 8000 });
    assert.match(await page.locator('.as-banner').innerText(), /تابعنا عملية الفصل/);
    ok('تحديث الصفحة أثناء المعالجة: تُستأنف المتابعة تلقائيًا');
    await page.waitForSelector('.as-result', { timeout: 40000 });
    st = await state();
    const j2 = st.jobs.find((j) => j.mode === 'vocals');
    assert.equal(j2.format, 'wav'); assert.equal(j2.outputFileName, 'أغنية_الاختبار_Vocals.wav');
    assert.match(await page.locator('.as-downloads a.as-primary').innerText(), /تنزيل WAV/);
    ok('استخراج الصوت البشري فقط بصيغة WAV: اسم الملف أغنية_الاختبار_Vocals.wav');
    await page.click('text=فصل ملف آخر');

    // ---------- 7) ملفات غير صالحة
    const bad = path.join(SHOTS, 'notes.txt'); fs.writeFileSync(bad, 'hello');
    await page.setInputFiles('.as-drop input[type=file]', bad);
    assert.match(await page.locator('.as-inline-err').innerText(), /غير مدعومة/);
    const big = path.join(SHOTS, 'big.wav'); const fd = fs.openSync(big, 'w'); fs.ftruncateSync(fd, 130 * 1024 * 1024); fs.closeSync(fd);
    await page.setInputFiles('.as-drop input[type=file]', big);
    assert.match(await page.locator('.as-inline-err').innerText(), /الحد الأقصى 120 MB/);
    fs.unlinkSync(big);
    ok('ملف بصيغة غير مدعومة وملف أكبر من 120MB: رفض فوري قبل أي رفع');
    const fake = path.join(SHOTS, 'fake-song.mp3'); fs.copyFileSync(path.join(FIX, 'fake.mp3'), fake);
    await page.setInputFiles('.as-drop input[type=file]', fake);
    await page.waitForSelector('.as-file');
    await page.click('.as-mode-music'); await checks.nth(0).check(); await checks.nth(1).check();
    const before = (await state()).creates;
    await startBtn.click();
    await page.waitForSelector('.as-error');
    assert.match(await page.locator('.as-error').innerText(), /ليس ملفًا صوتيًا مدعومًا/);
    assert.equal((await state()).creates, before, 'لم يُرسل للمزوّد');
    ok('ملف مزيّف بامتداد .mp3: يكشفه الخادم من محتواه ويرفضه دون إرساله للمعالجة');
    await page.screenshot({ path: path.join(SHOTS, 'as_desktop_error.png'), fullPage: true });
    assert.deepEqual(errors, []);
    ok('لا أخطاء JavaScript في الصفحة طوال الاختبار');

    // ---------- 8) الهاتف + الوضع الداكن
    const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const mp = await m.newPage();
    await mp.goto(B + '/?dark=1&uid=sub-mobile');
    await mp.waitForSelector('.as-drop');
    await mp.setInputFiles('.as-drop input[type=file]', SONG_FILE);
    await mp.click('.as-mode-voice');
    const ov = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(ov <= 0, 'لا تمرير أفقي على الهاتف: ' + ov);
    await mp.screenshot({ path: path.join(SHOTS, 'as_mobile_dark_setup.png'), fullPage: true });
    const mc = mp.locator('.as-check input'); await mc.nth(0).check(); await mc.nth(1).check();
    await mp.click('.as-primary');
    await mp.waitForSelector('.as-progress');
    await mp.screenshot({ path: path.join(SHOTS, 'as_mobile_dark_processing.png'), fullPage: true });
    await mp.waitForSelector('.as-result', { timeout: 40000 });
    assert.ok(await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0);
    await mp.screenshot({ path: path.join(SHOTS, 'as_mobile_dark_result.png'), fullPage: true });
    const tb = await mp.locator('.as-playbtn').boundingBox(); assert.ok(tb.width >= 44);
    ok('الهاتف (390px) بالوضع الداكن: كل المراحل تعمل بلا تمرير أفقي، وأزرار بحجم لمس مناسب');
    const lt = await b.newContext({ viewport: { width: 820, height: 1180 } }); const tp = await lt.newPage();
    await tp.goto(B + '/?uid=sub-tablet'); await tp.waitForSelector('.as-drop');
    await tp.screenshot({ path: path.join(SHOTS, 'as_tablet_light.png'), fullPage: true });
    ok('الجهاز اللوحي (820px) بالوضع الفاتح');
  } finally { await b.close(); }

  // ---------- 9) الخدمة غير مهيأة · رفض التخزين للرفع · فشل المزوّد
  procs.push(await harness(5312, { HARNESS_MODE: 'unconfigured' }));
  procs.push(await harness(5313, { FAIL_UPLOAD: '1' }));
  procs.push(await harness(5314, { HARNESS_MODE: 'fail', HARNESS_SPEED: '4' }));
  const b2 = await chromium.launch();
  try {
    const ctx = await b2.newContext({ viewport: { width: 1280, height: 860 } });
    const prep = async (port) => {
      const p = await ctx.newPage(); await p.goto(`http://127.0.0.1:${port}/`); await p.waitForSelector('.as-drop');
      await p.setInputFiles('.as-drop input[type=file]', SONG_FILE); await p.click('.as-mode-music');
      const c = p.locator('.as-check input'); await c.nth(0).check(); await c.nth(1).check(); return p;
    };
    const u = await prep(5312);
    await u.waitForSelector('.as-banner-warn');
    assert.equal(await u.locator('.as-primary').isDisabled(), true);
    await u.screenshot({ path: path.join(SHOTS, 'as_unconfigured.png'), fullPage: true });
    ok('بلا مفتاح خدمة المعالجة: تنبيه صريح «الأداة غير مفعّلة بعد» وزر البدء معطّل (لا نتائج وهمية)');
    const f = await prep(5313);
    await f.click('.as-primary'); await f.waitForSelector('.as-error');
    assert.match(await f.locator('.as-error').innerText(), /رفض التخزين استلام الملف/);
    ok('رفض التخزين للرفع: رسالة واضحة وزر للعودة');
    const pf = await prep(5314);
    await pf.click('.as-primary'); await pf.waitForSelector('.as-error', { timeout: 20000 });
    assert.match(await pf.locator('.as-error').innerText(), /تعذّر على النموذج فصل هذا الملف/);
    const s = await (await fetch('http://127.0.0.1:5314/__state')).json();
    assert.equal(s.objects.length, 0);
    ok('فشل المعالجة لدى المزوّد: رسالة واضحة وحذف الملف المرفوع');
  } finally { await b2.close(); procs.forEach((p) => p.kill()); }
  console.log('\n' + out.join('\n'));
})().catch((e) => { console.error("❌", e); for (const p of (global.__procs || [])) p.kill(); process.exit(1); });
