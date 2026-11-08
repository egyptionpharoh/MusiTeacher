// اختبار متصفح كامل لـ«نوتات النشيد والمارشات». يتطلب: node tests/anthem/build-ui.cjs && node tests/anthem/serve.mjs
// NODE_PATH=/opt/npm-tools/node_modules node tests/anthem/e2e.cjs
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:5350/'; const OUT = path.join(__dirname, '_out'); fs.mkdirSync(OUT, { recursive: true });
let failures = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  // ---- المكتبة
  await p.goto(BASE); await p.waitForSelector('.an-songcard');
  ok(await p.locator('.an-songcard').count() === 10, 'المكتبة: 10 بطاقات نوتة تفاعلية');
  ok(await p.locator('.an-files li').count() === 5, 'ملفات المصدر الخمسة السابقة باقية');
  ok(await p.locator('.an-songcard h3', { hasText: 'يا موطني لك الهنا' }).count() === 1 && await p.locator('.an-pending').count() === 0, 'يا موطني لك الهنا في المكتبة، ولا قسم للمعلّق');
  ok(await p.locator('.an-thumb svg').count() === 10, 'صورة مصغرة (SVG) لكل نشيد');
  await p.fill('.an-search input', 'زينه'); ok(await p.locator('.an-songcard').count() === 1, 'البحث يطبّع الهاء/التاء المربوطة'); await p.fill('.an-search input', '');
  await p.click('.an-pill:has-text("6/8")'); ok(await p.locator('.an-songcard').count() === 1, 'تصفية الميزان 6/8'); await p.click('.an-pill:has-text("كل الموازين")');
  await p.click('.an-songcard >> nth=1 >> .an-fav'); await p.reload(); await p.waitForSelector('.an-songcard');
  await p.click('.an-pill:has-text("المفضلة")'); ok(await p.locator('.an-songcard').count() === 1, 'المفضلة تُحفظ بعد إعادة التحميل'); await p.click('.an-pill:has-text("المفضلة")');
  await p.click('.an-songcard >> nth=0 >> button:has-text("تشغيل سريع")'); await wait(1200);
  ok(await p.locator('.an-songcard >> nth=0 >> button:has-text("إيقاف")').count() === 1, 'التشغيل السريع يعمل ويُوقَف'); await p.click('.an-songcard >> nth=0 >> button:has-text("إيقاف")');
  ok(await p.locator('.an-foot-box').count() === 1 && !(await p.locator('.an-foot-box').evaluate((d) => d.open)), 'تذييل المصادر مطوي افتراضيًا');
  await p.click('.an-foot-box > summary'); await p.click('.an-foot-item:has-text("صوت النهضة")');
  ok(/جميل فوزي/.test(await p.locator('.an-work').innerText()) && await p.locator('.an-work .an-srcs a').count() > 0, 'الضغط على اسم العمل يعرض بياناته ومصادره');
  await p.click('.an-btn:has-text("عرض القائمة")'); ok(await p.locator('.an-table tbody tr').count() === 10, 'قائمة المراجعة: 10 أناشيد');
  await p.screenshot({ path: path.join(OUT, 'library-desktop.png'), fullPage: true });

  // ---- النوتة
  await p.goto(BASE + '?song=bilad-al-izz&mode=listen'); await p.waitForSelector('.an-scorebox svg');
  const nNotes = await p.evaluate(() => { const m = window.__an.songs.getSong('bilad-al-izz').music; return m.measures.flatMap((x) => x.events).filter((e) => e.kind === 'note').length; });
  ok(await p.locator('.an-scorebox .an-ev.is-note').count() === nNotes, `كل نغمات النموذج مرسومة (${nNotes})`);
  ok(await p.locator('.an-scorebox .an-mbox').count() === 36, '36 مازورة مرسومة');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.an-score')).direction === 'ltr' && document.documentElement.dir === 'rtl'), 'الصفحة RTL والنوتة LTR');
  // النقر على نغمة: الاسم والقيمة كما في النموذج
  await p.click('[data-ev="23:0"] .an-hit'); const info = await p.locator('.an-noteinfo').innerText();
  ok(info.includes('فا دييز') && info.includes('كروش منقوطة') && info.includes('المازورة 24'), 'النقر على نغمة يعرض الاسم والقيمة والمازورة');
  // التشغيل والمزامنة: الموضع من ساعة الصوت
  const playAt = async () => p.evaluate(() => ({ ms: Number(document.querySelector('.an-mbox.is-now')?.getAttribute('data-ms')), ev: document.querySelector('.an-ev.is-now')?.getAttribute('data-ev'), cx: Number(document.querySelector('.an-cursor')?.getAttribute('x1')) }));
  await p.click('.an-play'); await wait(2600); let s1 = await playAt();
  // 96 ن/د، 2/4: المازورة = 1.25 ث → بعد ~2.5 ث نكون في المازورة الثالثة (فهرس 2)
  ok(s1.ms >= 1 && s1.ms <= 2, `المؤشر في المازورة المتوقعة بعد 2.6 ث (الفهرس ${s1.ms})`);
  ok(s1.ev && s1.ev.startsWith(`${s1.ms}:`), 'إضاءة النغمة الحالية داخل المازورة الحالية');
  // تغيير السرعة أثناء العزف (×2): يتضاعف معدل التقدم ولا يقفز الموضع
  const pos = () => p.evaluate(() => Number(document.querySelector('.an-progress input').value));
  const a1 = await pos(); await wait(1000); const a2 = await pos(); const rate1 = a2 - a1;
  await p.fill('.an-tempo input', '192'); const a3 = await pos(); await wait(1000); const a4 = await pos(); const rate2 = a4 - a3;
  ok(Math.abs(a3 - a2) < 0.8, `لا قفزة في الموضع عند تغيير السرعة (${a2.toFixed(2)} → ${a3.toFixed(2)})`);
  ok(rate2 / rate1 > 1.7 && rate2 / rate1 < 2.3, `معدل التقدم تضاعف مع السرعة (${rate1.toFixed(2)} → ${rate2.toFixed(2)} سوداء/ث)`);
  await p.click('.an-pill:has-text("السرعة الأساسية")'); ok(await p.inputValue('.an-tempo input') === '96', 'زر السرعة الأساسية يعيد 96');
  await p.click('.an-play'); // إيقاف مؤقت
  // التحديد والتكرار: المازورة 5 (فهرس 4)
  await p.click('[data-ms="4"]', { position: { x: 5, y: 5 } }); await p.click('.an-btn:has-text("كرّر التحديد")');
  await p.click('.an-play'); await wait(3500); const s2 = await playAt();
  ok(s2.ms === 4, `التكرار يبقي العزف داخل المازورة المحددة بعد ثلاث دورات تقريبًا (${s2.ms})`);
  await p.click('.an-play'); await p.click('.an-btn:has-text("التكرار يعمل")'); await p.click('.an-link:has-text("إلغاء")');
  // المازورة التالية/السابقة وهو متوقف
  await p.click('[aria-label="من البداية"]'); await wait(200); await p.click('.an-play'); await p.click('[aria-label="المازورة التالية"]'); await p.click('[aria-label="المازورة التالية"]');
  const v = await pos(); ok(Math.abs(v - 4) < 0.6, `زر المازورة التالية يقفز بمازورة كاملة (الموضع ${v.toFixed(2)} سوداء)`);
  await p.click('[aria-label="إيقاف"]');
  // السلم البديل من المصدر
  await p.selectOption('.an-toolbar select', 'C'); await wait(300);
  await p.click('[data-ev="23:0"] .an-hit'); ok((await p.locator('.an-noteinfo').innerText()).includes('ري دييز'), 'النسخة الثانية (دو الكبير): فا دييز ← ري دييز');
  await p.selectOption('.an-toolbar select', '');
  // اختصار المسافة
  await p.keyboard.press('Space'); await wait(700); const sp1 = await pos(); await p.keyboard.press('Space'); ok(sp1 > 0.3, 'المسافة تشغّل وتوقف');
  await p.screenshot({ path: path.join(OUT, 'song-listen.png') });
  await p.click('.an-mode:has-text("القراءة")'); await wait(300); ok(await p.locator('.an-scorebox .an-t-name').count() === nNotes, 'وضع القراءة: اسم تحت كل نغمة');
  await p.screenshot({ path: path.join(OUT, 'song-read.png') });
  await p.click('.an-mode:has-text("وضع المعلم")'); await wait(300); ok(await p.locator('.an-review').count() === 1, 'وضع المعلم: بطاقة المراجعة');
  await p.screenshot({ path: path.join(OUT, 'song-teacher.png') });

  // ---- الأصوات: عرض غير متصل لكل آلة والتحقق من التردد، وثبات التردد مع تغيير السرعة
  const pitchRes = await p.evaluate(async () => {
    const { voice, estimatePitch, INSTRUMENTS } = window.__an.audio; const out = {};
    const render = async (inst, midi, dur) => { const sr = 44100; const oc = new OfflineAudioContext(1, Math.ceil(sr * (dur + 0.6)), sr); voice(oc, oc.destination, inst, midi, 0.02, dur, 0.8); const buf = await oc.startRendering(); return buf.getChannelData(0); };
    for (const it of INSTRUMENTS) {
      const d = await render(it.id, 69, 0.8); const from = it.id === 'drum' ? 0.02 : 0.2; const seg = d.slice(Math.floor(from * 44100), Math.floor(from * 44100) + (it.id === 'drum' ? 4410 : 8192));
      let rms = 0; for (const x of seg) rms += x * x; rms = Math.sqrt(rms / seg.length);
      out[it.id] = { f: estimatePitch(seg, 44100), rms };
    }
    const slow = await render('piano', 64, 1.2); const fast = await render('piano', 64, 0.3);
    const q = await render('violin', 63.5, 0.8); out.quarter = estimatePitch(q.slice(8820, 8820 + 8192), 44100);
    out.tempo = { slow: estimatePitch(slow.slice(4410, 4410 + 8192), 44100), fast: estimatePitch(fast.slice(4410, 4410 + 8192), 44100) };
    return out;
  });
  for (const [id, r] of Object.entries(pitchRes)) {
    if (id === 'tempo' || id === 'quarter') continue;
    if (id === 'drum') ok(r.rms > 0.001, `صوت الإيقاع يُنتج إشارة مسموعة (RMS ${r.rms.toFixed(3)})`);
    else ok(r.rms > 0.01 && Math.abs(r.f - 440) / 440 < 0.015, `${id}: لا 4 = ${r.f.toFixed(1)} هرتز (المتوقع 440)`);
  }
  ok(Math.abs(pitchRes.quarter - 320.24) < 3, `ربع التون: مي نصف بيمول 4 = ${pitchRes.quarter.toFixed(1)} هرتز (المتوقع 320.2)`);
  const e4 = 329.63; ok(Math.abs(pitchRes.tempo.slow - e4) < 4 && Math.abs(pitchRes.tempo.fast - e4) < 4, `التردد لا يتغير مع طول النغمة/السرعة (${pitchRes.tempo.slow.toFixed(1)} / ${pitchRes.tempo.fast.toFixed(1)})`);

  // ---- التمارين
  await p.goto(BASE + '?song=ya-hayyu-ya-qayyum&mode=practice'); await p.waitForSelector('.an-games');
  ok(await p.locator('.an-game').count() === 7, 'سبعة تمارين'); await p.waitForSelector('.an-qscore .an-ev.is-target');
  const expected = await p.evaluate(() => { const g = document.querySelector('.an-qscore .an-ev.is-target'); const [mi, ei] = g.getAttribute('data-ev').split(':').map(Number); const m = window.__an.songs.getSong('ya-hayyu-ya-qayyum').music; return window.__an.notation.noteName(m.measures[mi].events[ei]); });
  await p.click(`.an-opt:has-text("${expected}")`); ok(await p.locator('.an-feedback.is-ok').count() === 1, `تعرّف على النغمة: الإجابة المستخرجة من النموذج (${expected}) تُقبل`);
  await p.click('.an-primary:has-text("سؤال آخر")'); await p.waitForSelector('.an-qscore .an-ev.is-target');
  const wrong = await p.evaluate(() => { const g = document.querySelector('.an-qscore .an-ev.is-target'); const [mi, ei] = g.getAttribute('data-ev').split(':').map(Number); const m = window.__an.songs.getSong('ya-hayyu-ya-qayyum').music; const a = window.__an.notation.noteName(m.measures[mi].events[ei]); return [...document.querySelectorAll('.an-opt')].map((x) => x.textContent).find((t) => t !== a); });
  await p.click(`.an-opt:has-text("${wrong}")`); ok(await p.locator('.an-feedback.is-no').count() === 1 && await p.locator('.an-opt.is-right').count() === 1, 'الإجابة الخاطئة تُرفض ويُظهر الصحيح');
  await p.click('.an-game:has-text("تعرّف على الإيقاع")'); await p.click('.an-btn:has-text("استمع إلى الإيقاع")'); await p.click('.an-ropt >> nth=0'); ok(await p.locator('.an-feedback').count() === 1, 'تعرّف على الإيقاع: تغذية راجعة');
  await p.click('.an-game:has-text("أكمل المازورة")'); await p.click('.an-ropt-main >> nth=0'); const fb = await p.locator('.an-feedback').innerText(); ok(/مجموع|الأصلية/.test(fb), 'أكمل المازورة: التغذية تذكر مجموع القيم');
  await p.click('.an-game:has-text("رتّب النغمات")');
  const orderIds = await p.evaluate(() => { const m = window.__an.songs.getSong('ya-hayyu-ya-qayyum').music; const h = document.querySelector('.an-q h4').textContent; const num = Number(h.match(/\d+/)[0]); const ms = m.measures[num - 1]; return ms.events.map((e) => (e.kind === 'note' ? window.__an.notation.noteName(e) + ' · ' + window.__an.notation.valueName(e) : window.__an.notation.valueName(e))); });
  for (const label of orderIds) await p.locator('.an-tiles .an-tile', { hasText: label }).first().click();
  await p.click('.an-primary:has-text("تحقق")'); ok(await p.locator('.an-feedback.is-ok').count() === 1, 'رتّب النغمات: الترتيب الأصلي يُقبل');
  await p.click('.an-game:has-text("استمع وحدّد")'); await p.click('.an-btn:has-text("استمع")');
  const lq = await p.evaluate(() => [...document.querySelectorAll('.an-qscore .an-mbox')].map((x) => x.getAttribute('data-ms')));
  await p.click(`.an-qscore [data-ms="${lq[0]}"]`, { position: { x: 4, y: 4 } }); ok(await p.locator('.an-feedback').count() === 1 && await p.locator('.an-mbox.is-right').count() === 1, 'استمع وحدّد: تُعلَّم المازورة الصحيحة');
  await p.click('.an-game:has-text("تحدي المارش")');
  for (let i = 0; i < 10; i++) {
    await p.waitForSelector('.an-q'); const opt = p.locator('.an-opt:enabled, .an-ropt:enabled, .an-ropt-main:enabled');
    if (await opt.count()) await opt.first().click(); else await p.locator('.an-qscore .an-mbox').first().click({ position: { x: 4, y: 4 } });
    await wait(1750);
  }
  ok(await p.locator('.an-final').count() === 1, 'تحدي المارش: عشرة أسئلة ثم نتيجة');
  await p.click('.an-game:has-text("تدرّب على مازورة")'); await p.selectOption('.an-measure-pick select >> nth=0', '4');
  await p.click('.an-primary:has-text("ابدأ التمرين")'); await p.waitForSelector('.an-tap'); await wait(3000);
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Space'); await wait(250); }
  await p.waitForSelector('.an-feedback', { timeout: 8000 }); ok(/الدقة/.test(await p.locator('.an-feedback').innerText()), 'تدرّب على مازورة: عدّ تمهيدي ثم تقييم النقرات');
  await p.screenshot({ path: path.join(OUT, 'practice.png'), fullPage: true });
  // تحميل PDF (مع أسماء النغمات)
  await p.goto(BASE + '?song=anshudat-al-watan&mode=read'); await p.waitForSelector('.an-pdfbtn');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('.an-pdfbtn')]);
  const pdfPath = path.join(OUT, 'download-anshudat.pdf'); await dl.saveAs(pdfPath);
  const head = fs.readFileSync(pdfPath).subarray(0, 8).toString('latin1');
  ok(head.startsWith('%PDF') && /أسماء النغمات/.test(dl.suggestedFilename()) && fs.statSync(pdfPath).size > 50000, `زر التحميل ينشئ PDF (${dl.suggestedFilename()}, ${Math.round(fs.statSync(pdfPath).size / 1024)} ك.ب)`);
  // الطباعة: كل سطر نوتة في SVG مستقل، والتوثيق المختصر ظاهر، والأزرار والمشغّل مخفية
  await p.goto(BASE + '?song=ya-mawtini&mode=listen'); await p.waitForSelector('.an-print-sys svg', { state: 'attached' });
  await p.emulateMedia({ media: 'print' });
  const pr = await p.evaluate(() => ({ sys: document.querySelectorAll('.an-print-sys').length, vis: getComputedStyle(document.querySelector('.an-print')).display, foot: getComputedStyle(document.querySelector('.an-foot-print')).display, player: getComputedStyle(document.querySelector('.an-player')).display, box: getComputedStyle(document.querySelector('.an-foot-box')).display }));
  ok(pr.sys >= 5 && pr.vis === 'block' && pr.foot === 'block' && pr.player === 'none' && pr.box === 'none', `نسخة الطباعة: ${pr.sys} سطرًا مستقلًا، والتوثيق المختصر ظاهر، والعناصر التفاعلية مخفية`);
  await p.pdf({ path: path.join(OUT, 'print-ya-mawtini.pdf'), format: 'A4' }); await p.emulateMedia({ media: 'screen' });
  await p.goto(BASE + '?song=ya-zeina&mode=test'); await p.waitForSelector('.an-challenge'); ok(await p.locator('.an-games').count() === 0, 'وضع الاختبار: تحدٍّ دون قائمة التمارين');

  // ---- الأجهزة والسمة
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 820, height: 1180 }], ['desktop', { width: 1440, height: 900 }]]) {
    for (const dark of [false, true]) {
      const pg = await b.newPage({ viewport: vp }); pg.on('pageerror', (e) => errs.push(`${name}: ${e.message}`));
      for (const u of ['', '?song=habibati-oman&mode=listen', '?song=nahda-mutajaddida&mode=practice', '?song=ya-mawtini&mode=read']) {
        await pg.goto(BASE + u + (dark ? (u ? '&' : '?') + 'dark=1' : '')); await pg.waitForTimeout(700);
        const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        ok(over <= 1, `${name}${dark ? ' داكن' : ''} ${u || 'المكتبة'}: لا تمرير أفقي للصفحة (${over})`);
        await pg.screenshot({ path: path.join(OUT, `${name}${dark ? '-dark' : ''}${u ? '-' + u.match(/song=([^&]+)/)[1] : '-library'}.png`) });
      }
      await pg.close();
    }
  }
  ok(errs.length === 0, `لا أخطاء في وحدة التحكم${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await b.close(); console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED'); process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
