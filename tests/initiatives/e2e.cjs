// اختبار واجهة شامل بمتصفح حقيقي (Playwright):  AI=1 node harness.mjs &  ثم  node e2e.cjs   (AI=0 لمسار بلا مفتاح)
// يغطي: العرض، التصنيفات، البحث والتصفية، البطاقة، الابتكار وعدم التكرار، التطوير، تعديل الأجزاء، الحفظ والاستعادة،
// الحالة، ملف المبادرة وتصديره، الطباعة، المزامنة، RTL، الشاشات، الوضع الداكن. اللقطات والملفات في _out/.
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs'); const path = require('path'); const assert = require('assert/strict');
const BASE = process.env.BASE || 'http://127.0.0.1:5340'; const OUT = path.join(__dirname, process.env.OUTDIR || '_out'); fs.mkdirSync(OUT, { recursive: true });
const AI = process.env.AI !== '0';
const log = (...a) => console.log('✓', ...a);
const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true, locale: 'ar' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { window.__printed = [];
    const obs = new MutationObserver(() => document.querySelectorAll('iframe').forEach((f) => { if (!f.__h) { f.__h = true; f.addEventListener('load', () => { f.contentWindow.print = () => window.__printed.push(`${f.contentDocument.title}|${f.contentDocument.body.innerText.length}|${f.contentDocument.documentElement.dir}`); }); } }));
    document.addEventListener('DOMContentLoaded', () => obs.observe(document.body, { childList: true, subtree: true })); });
  await page.goto(BASE + '/');

  // 1) عرض جميع المبادرات
  await page.locator('.in-card').first().waitFor();
  const all = await page.locator('.in-section').last().locator('.in-card').count();
  assert.ok(all >= 35, `عدد ${all}`); assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  assert.equal(await page.locator('.in-root').getAttribute('dir'), 'rtl'); log('1 عرض جميع المبادرات', all);
  await page.screenshot({ path: path.join(OUT, '01-explore.png') });

  // 2) تصفح التصنيفات + «الكل»
  await page.locator('.in-domain', { hasText: 'الصحية والبيئية' }).click();
  const health = await page.locator('.in-section').last().locator('.in-card').count();
  assert.ok(health >= 4 && health < all);
  for (const t of await page.locator('.in-section').last().locator('.in-card-domain').allInnerTexts()) assert.match(t, /الصحية والبيئية/);
  await page.locator('.in-domain', { hasText: 'الكل' }).click();
  assert.equal(await page.locator('.in-section').last().locator('.in-card').count(), all); log('2 التصنيفات و«الكل»', health);

  // 3) البحث والتصفية
  await page.getByLabel('بحث في المبادرات').fill('القراءة');
  await page.getByText(/نتائج التصفية \(\d+\)/).waitFor();
  assert.ok(await page.locator('.in-card', { hasText: 'سُلّم القراءة' }).count() >= 1);
  await page.getByLabel('بحث في المبادرات').fill('');
  await page.locator('.in-select', { hasText: 'الموارد المطلوبة' }).locator('select').selectOption('free');
  await page.locator('.in-select', { hasText: 'من يقودها' }).locator('select').selectOption('students');
  const fs2 = await page.locator('.in-section').last().locator('.in-card').count(); assert.ok(fs2 >= 3);
  for (const t of await page.locator('.in-section').last().locator('.in-meta').allInnerTexts()) { assert.match(t, /بلا تكلفة/); assert.match(t, /بقيادة الطلبة/); }
  await page.getByRole('button', { name: 'مسح الفلاتر' }).click(); log('3 البحث والتصفية', fs2, 'مبادرة طلابية بلا تكلفة');

  // 4) بطاقة المبادرة
  await page.locator('.in-card', { hasText: 'مدرستي تبتكر' }).first().locator('.in-card-main').click();
  for (const h of ['وصف المبادرة', 'المشكلة أو الاحتياج', 'مبررات اختيارها', 'الأهداف', 'خطوات التنفيذ', 'الجدول الزمني', 'فريق العمل والمسؤوليات', 'الموارد والأدوات', 'مؤشرات الأداء والنجاح', 'النتائج والمخرجات المتوقعة', 'الاستدامة والتطوير', 'قبل التنفيذ: الموافقات والمتطلبات']) await page.locator('.in-sec-head h3', { hasText: h }).first().waitFor();
  for (const k of ['الفئة المستهدفة', 'المستفيدون المتوقعون', 'مدة التنفيذ', 'القيادة والحجم']) await page.locator('.in-facts', { hasText: k }).waitFor();
  await page.locator('.in-gantt-row').first().waitFor(); assert.equal(await page.locator('.in-gantt-row').count(), 5);
  await page.screenshot({ path: path.join(OUT, '02-card.png'), fullPage: true }); log('4 بطاقة المبادرة (21 عنصرًا)');

  // 9) حفظ في المحفوظة
  await page.locator('.in-detail-nav .in-fav').click();
  await page.locator('.in-space.is-saved').click(); await page.locator('.in-card', { hasText: 'مدرستي تبتكر' }).waitFor(); log('9a الحفظ في المحفوظة');

  // 7) أضفها إلى مبادراتي (+ التطوير إن توفر الذكاء الاصطناعي)
  await page.locator('.in-card', { hasText: 'مدرستي تبتكر' }).locator('.in-card-main').click();
  await page.getByRole('button', { name: /أضفها إلى مبادراتي/ }).click();
  await page.locator('.in-ws-title h2', { hasText: 'مدرستي تبتكر' }).waitFor();
  await page.getByText('أُضيفت المبادرة إلى «مبادراتي»').waitFor(); log('7a إضافة المبادرة إلى مبادراتي');

  // 8) تعديل أجزاء من الخطة يدويًا
  await page.getByRole('button', { name: 'تعديل الخطة' }).click();
  await page.locator('.in-field', { hasText: 'اسم المبادرة' }).locator('input').fill('مدرستي تبتكر 2027');
  const ph = page.locator('.in-fs', { hasText: 'مراحل التنفيذ' }).locator('.in-row-edit').first();
  await ph.locator('.in-field', { hasText: 'الأسابيع' }).locator('input').fill('3');
  await ph.locator('textarea').fill('إعلان المبادرة في الطابور ومجموعات الصفوف.\nزيارة الصفوف لشرح الفكرة.');
  await page.getByRole('button', { name: 'حفظ الخطة' }).first().click();
  await page.getByText('حُفظت الخطة وحُدّثت قائمة المتابعة.').waitFor();
  assert.equal(await page.locator('.in-ws-title h2').innerText(), 'مدرستي تبتكر 2027'); log('8a تعديل الخطة يدويًا');

  // مولد الجدول الزمني
  await page.getByRole('tab', { name: /الجدول الزمني/ }).click();
  await page.locator('.in-field', { hasText: 'تاريخ بدء المبادرة' }).locator('input').fill('2026-11-15');
  await page.locator('.in-table tbody tr').first().waitFor();
  const tlText = await page.locator('.in-table').innerText();
  assert.match(tlText, /15 نوفمبر 2026/); assert.match(tlText, /3 أسابيع/); log('الجدول الزمني بالتواريخ');
  // الفريق
  await page.getByRole('tab', { name: /الفريق/ }).click();
  await page.getByLabel(/اسم منسق المبادرة/).fill('أ. حسين محمد سيد');
  // المؤشرات
  await page.getByRole('tab', { name: /المؤشرات/ }).click();
  await page.locator('.in-kpi').first().locator('.in-field', { hasText: 'القياس القبلي' }).locator('input').fill('12 فكرة في الفصل الماضي');
  // 10) المتابعة وتغيير الحالة
  await page.getByRole('tab', { name: /المتابعة/ }).click();
  const boxes = page.locator('.in-check input[type=checkbox]');
  assert.ok((await boxes.count()) >= 10);
  await page.locator('.in-check', { hasText: 'زيارة الصفوف لشرح الفكرة.' }).waitFor();
  await boxes.nth(0).check(); await boxes.nth(1).check();
  assert.equal(await page.locator('.in-status-select select').inputValue(), 'active', 'الحالة تتحول تلقائيًا إلى قيد التنفيذ');
  await page.locator('.in-status-select select').selectOption('ready'); await page.getByText('الحالة الآن: جاهزة للتنفيذ').waitFor();
  await page.locator('.in-status-select select').selectOption('active'); log('10 قائمة المتابعة وتغيير الحالة');
  // التوثيق مع صورة
  await page.getByRole('tab', { name: /التوثيق/ }).click();
  await page.locator('.in-field', { hasText: 'النشاط المنفذ' }).locator('input').fill('إطلاق المبادرة في الطابور');
  await page.locator('.in-field', { hasText: 'النتائج' }).first().locator('input').fill('وصلت 18 فكرة في يومين');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
  await page.locator('.in-log-form .in-upload input').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await page.locator('.in-log-form .in-photo img').waitFor();
  await page.getByRole('button', { name: 'تسجيل النشاط' }).click(); await page.locator('.in-log li', { hasText: 'إطلاق المبادرة في الطابور' }).waitFor();
  await page.locator('.in-log li .in-photo img').waitFor(); log('سجل الإنجاز مع صورة');
  await page.screenshot({ path: path.join(OUT, '03-workspace-log.png'), fullPage: true });

  // 11-12) ملف المبادرة وتصديره + الإعلان والاستبانة
  await page.getByRole('tab', { name: /ملف المبادرة/ }).click();
  await page.locator('.in-field', { hasText: 'اسم المدرسة' }).locator('input').fill('مدرسة الإبداع للتعليم الأساسي');
  await page.locator('.in-field', { hasText: 'مقدم المبادرة أو الفريق' }).locator('input').fill('أ. حسين محمد سيد وفريق الابتكار');
  const logo = fs.readFileSync(path.join(__dirname, '../../public/logo.png'));
  await page.locator('.in-logo .in-upload input').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: logo });
  await page.locator('.in-logo img').waitFor();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /تنزيل ملف Word/ }).click()]);
  const docx = path.join(OUT, 'ui-initiative.docx'); await dl.saveAs(docx);
  assert.ok(dl.suggestedFilename().endsWith('.docx')); const buf = fs.readFileSync(docx); assert.equal(buf.readUInt32LE(0), 0x04034b50);
  assert.ok(buf.includes(Buffer.from('word/media/logo.png')), 'الشعار داخل الملف'); log('12 تنزيل ملف Word', dl.suggestedFilename(), buf.length);
  for (const btn of [/طباعة \/ حفظ PDF/]) { await page.getByRole('button', { name: btn }).click(); await page.waitForFunction(() => window.__printed.length >= 1, null, { timeout: 8000 }); }
  await page.getByRole('button', { name: /نسخ المحتوى نصًا/ }).click(); await page.getByText('نُسخ محتوى المبادرة كاملًا.').waitFor();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(clip.startsWith('🌟 مدرستي تبتكر 2027') && clip.includes('ج. خطة التنفيذ') && clip.includes('أ. حسين محمد سيد'));
  await page.getByRole('tab', { name: /الإعلان والاستبانة/ }).click();
  await page.getByRole('button', { name: /طباعة البطاقة/ }).click(); await page.waitForFunction(() => window.__printed.length >= 2, null, { timeout: 8000 });
  await page.getByRole('button', { name: /طباعة الاستبانة/ }).click(); await page.waitForFunction(() => window.__printed.length >= 3, null, { timeout: 8000 });
  const printed = await page.evaluate(() => window.__printed);
  assert.ok(printed.every((x) => x.endsWith('|rtl') && +x.split('|')[1] > 150), printed.join(' ; ')); log('11 الطباعة/PDF + النسخ + الإعلان + الاستبانة', printed.length);
  await page.screenshot({ path: path.join(OUT, '04-tools.png') });

  // 9) الحفظ والاستعادة بعد إعادة التحميل + نسخة مستقلة
  await page.reload(); await page.locator('.in-space.is-projects').click();
  await page.locator('.in-project', { hasText: 'مدرستي تبتكر 2027' }).waitFor();
  assert.match(await page.locator('.in-project', { hasText: 'مدرستي تبتكر 2027' }).innerText(), /قيد التنفيذ/);
  await page.locator('.in-project', { hasText: 'مدرستي تبتكر 2027' }).click();
  await page.locator('.in-ws-tabs button.is-on', { hasText: 'المتابعة' }).waitFor();
  await page.getByRole('button', { name: 'إنشاء نسخة' }).click(); await page.locator('.in-ws-title h2', { hasText: '(نسخة)' }).waitFor();
  await page.locator('.in-space.is-projects').click(); assert.equal(await page.locator('.in-project').count(), 2);
  await page.locator('.in-status-tabs button', { hasText: 'قيد التنفيذ' }).click(); assert.equal(await page.locator('.in-project').count(), 1);
  await page.locator('.in-status-tabs button', { hasText: 'الكل' }).click(); log('9 الحفظ والاستعادة والنسخ والتصفية بالحالة');
  await page.screenshot({ path: path.join(OUT, '05-projects.png') });

  if (AI) {
    // 5-6) ابتكر لي مبادرة: تنوع وعدم تكرار
    await page.locator('.in-space.is-create').click();
    await page.locator('.in-examples .in-chip', { hasText: 'اقترح مبادرة يقودها الطلبة بأنفسهم' }).click();
    await page.locator('.in-more summary').click(); await page.locator('.in-select', { hasText: 'المرحلة الدراسية' }).locator('select').selectOption('c2');
    await page.getByRole('button', { name: /ابتكر 3 مبادرات مختلفة/ }).click();
    await page.locator('.in-working').waitFor(); await page.getByText(/ابتُكرت 3 أفكار جديدة/).waitFor();
    await page.getByRole('button', { name: /ابتكر 3 مبادرات مختلفة/ }).click(); await page.getByText(/ابتُكرت 3 أفكار جديدة/).waitFor();
    const titles = await page.locator('.in-section .in-card-title').allInnerTexts();
    assert.equal(titles.length, 6); assert.equal(new Set(titles).size, 6, 'لا تكرار');
    assert.equal(await page.locator('.in-section .in-ai').count(), 6); log('5-6 الابتكار وتنوع النتائج', titles.length);
    await page.screenshot({ path: path.join(OUT, '06-create.png') });
    // 7) طوّر المبادرة
    await page.locator('.in-section .in-card-main').first().click();
    await page.locator('.in-brief-note').waitFor();
    await page.getByRole('button', { name: 'طوّر المبادرة' }).click();
    await page.locator('.in-tweaks .in-chip', { hasText: 'اجعل المبادرة أقل تكلفة' }).click();
    await page.locator('.in-tweaks .in-chip', { hasText: 'حوّلها إلى مبادرة يقودها الطلبة' }).click();
    await page.getByRole('button', { name: /طوّر وأضف إلى مبادراتي/ }).click();
    await page.getByText(/يطوّر الذكاء الاصطناعي المبادرة/).waitFor();
    await page.getByText(/طُوّرت المبادرة إلى خطة تنفيذية/).waitFor();
    await page.locator('.in-phases li').nth(2).waitFor();
    assert.equal(await page.locator('.in-gantt-row').count(), 3); log('7 تطوير فكرة إلى خطة تنفيذية');
    // 8) إعادة توليد جزء دون فقد البقية
    const before = await page.locator('.in-phases').innerText();
    await page.locator('.in-sec', { hasText: 'فريق العمل والمسؤوليات' }).getByRole('button', { name: 'أعد الصياغة' }).click();
    await page.getByText('أُعيدت صياغة هذا الجزء، وبقيت بقية المبادرة كما هي.').waitFor();
    await page.getByText('مسؤول التوثيق').first().waitFor();
    assert.equal(await page.locator('.in-phases').innerText(), before, 'المراحل لم تتغير'); log('8 إعادة صياغة جزء واحد');
    // الإلغاء
    await page.locator('.in-sec', { hasText: 'الأهداف' }).first().getByRole('button', { name: 'أعد الصياغة' }).click();
    await page.locator('.in-working').getByRole('button', { name: 'إلغاء' }).click(); await page.getByText('أُلغي الطلب.').waitFor(); log('إلغاء الطلب');
    // المزامنة مع الحساب
    await page.locator('.in-space.is-projects').click();
    await page.locator('.in-sync input').check();
    await page.getByText(/آخر مزامنة/).waitFor({ timeout: 10000 });
    const stored = await (await page.request.get(BASE + '/__store')).json();
    assert.equal(stored.length, 1); assert.equal(stored[0][1].data.projects.length, 3);
    assert.ok(stored[0][1].data.projects.every((p) => p.meta.logo === ''), 'الشعار لا يُرفع');
    // جهاز آخر: سياق جديد فارغ يستعيد المبادرات من الحساب
    const ctx2 = await browser.newContext({ locale: 'ar' }); const p2 = await ctx2.newPage();
    await p2.addInitScript(() => { try { localStorage.setItem('mt-initiatives:v1', JSON.stringify({ projects: [], favs: [], deleted: {}, aiIdeas: [], recent: [], sync: true })); } catch { /* */ } });
    await p2.goto(BASE + '/'); await p2.locator('.in-space.is-projects').click();
    await p2.locator('.in-project', { hasText: 'مدرستي تبتكر 2027' }).first().waitFor({ timeout: 10000 });
    assert.equal(await p2.locator('.in-project').count(), 3); await ctx2.close(); log('المزامنة مع الحساب والاستعادة على جهاز آخر');
  } else {
    await page.locator('.in-space.is-create').click(); await page.locator('.in-off').waitFor();
    assert.equal(await page.getByRole('button', { name: /ابتكر 3 مبادرات/ }).count(), 0);
    await page.locator('.in-space.is-explore').click(); await page.locator('.in-card-main').first().click();
    assert.ok(await page.getByRole('button', { name: 'طوّر المبادرة' }).isDisabled()); await page.getByText(/التطوير بالذكاء الاصطناعي غير مفعّل/).waitFor();
    log('بلا مفتاح: الابتكار والتطوير معطلان بوضوح، والمكتبة والتخطيط والتصدير تعمل');
  }
  assert.deepEqual(errors, [], 'أخطاء في Console');

  // 13-15) RTL، الشاشات، الوضع الداكن
  for (const [name, vp, dark] of [['07-mobile', { width: 390, height: 844 }, false], ['08-mobile-dark', { width: 390, height: 844 }, true], ['09-tablet-dark', { width: 820, height: 1180 }, true], ['10-desktop-dark', { width: 1360, height: 900 }, true]]) {
    const p = await ctx.newPage(); await p.setViewportSize(vp); await p.goto(BASE + (dark ? '/?dark=1' : '/'));
    await p.locator('.in-card').first().waitFor();
    assert.ok(await noHScroll(p) <= 1, `${name}: تمرير أفقي`); await p.screenshot({ path: path.join(OUT, `${name}.png`) });
    await p.locator('.in-space.is-projects').click(); await p.locator('.in-project').first().click(); await p.locator('.in-ws-tabs').waitFor();
    assert.ok(await noHScroll(p) <= 1, `${name}: تمرير أفقي في مساحة العمل`);
    await p.getByRole('tab', { name: /المؤشرات/ }).click(); assert.ok(await noHScroll(p) <= 1, `${name}: المؤشرات`);
    await p.screenshot({ path: path.join(OUT, `${name}-workspace.png`) }); await p.close(); log('عرض', name);
  }
  await browser.close();
  console.log('\nE2E OK');
})().catch((e) => { console.error('✗', e); process.exit(1); });
