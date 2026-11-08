// اختبار واجهة شامل بمتصفح حقيقي (Playwright):  AI=1 node harness.mjs &  ثم  node e2e.cjs
// يحفظ لقطات الشاشة والملفات المنزّلة في _out/.
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs'); const path = require('path'); const assert = require('assert/strict');
const BASE = process.env.BASE || 'http://127.0.0.1:5330'; const OUT = path.join(__dirname, '_out'); fs.mkdirSync(OUT, { recursive: true });
const AI = process.env.AI !== '0';
const log = (...a) => console.log('✓', ...a);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true, locale: 'ar' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // نلتقط الطباعة بدل فتح نافذة النظام
  await page.addInitScript(() => { window.__printed = []; const orig = HTMLIFrameElement.prototype; Object.defineProperty(window, '__hookPrint', { value: true });
    const obs = new MutationObserver(() => document.querySelectorAll('iframe').forEach((f) => { try { if (f.contentWindow && !f.__hooked) { f.__hooked = true; f.addEventListener('load', () => { f.contentWindow.print = () => window.__printed.push(f.contentDocument.title + '|' + f.contentDocument.body.innerText.length); }); } } catch { /* */ } }));
    document.addEventListener('DOMContentLoaded', () => obs.observe(document.body, { childList: true, subtree: true })); void orig; });
  await page.goto(BASE + '/');
  await page.getByRole('heading', { name: 'مشاغل الإنماء المهني' }).waitFor();
  const cards = await page.locator('.pd-card').count();
  assert.ok(cards >= 41 + 6, `بطاقات: ${cards}`); log('فتح الأداة', cards, 'بطاقة');
  if (AI) await page.locator('.pd-ask-row button:not([disabled])').waitFor(); else await page.getByText('التوليد الذكي غير مفعّل على الخادم').waitFor();
  await page.screenshot({ path: path.join(OUT, '01-explore.png'), fullPage: false });

  // التصنيفات
  await page.locator('.pd-domain', { hasText: 'التقويم من أجل التعلم' }).click();
  const assess = await page.locator('.pd-section').last().locator('.pd-card').count();
  assert.equal(assess, 4); assert.equal(await page.getByText('مشاغل مميزة').count(), 0);
  await page.locator('.pd-domain', { hasText: 'التقويم من أجل التعلم' }).click(); log('التنقل بين التصنيفات');
  // البحث والفلاتر
  await page.getByLabel('بحث في الأفكار').fill('الإيقاع');
  await page.getByText(/نتائج التصفية \(\d+\)/).waitFor();
  assert.ok(await page.locator('.pd-card', { hasText: 'الإيقاع مدخلًا للتعلم في كل المواد' }).count() === 1);
  await page.getByLabel('بحث في الأفكار').fill('');
  await page.locator('.pd-select', { hasText: 'المدة' }).locator('select').selectOption('short');
  const shortN = await page.locator('.pd-section').last().locator('.pd-card').count();
  assert.ok(shortN >= 5); for (const t of await page.locator('.pd-section').last().locator('.pd-meta span:first-child').allInnerTexts()) assert.ok(/15|20|دقيقة/.test(t));
  await page.getByRole('button', { name: 'مسح الفلاتر' }).click(); log('البحث والتصفية', shortN, 'فكرة قصيرة');

  // فكرة عشوائية
  await page.getByRole('button', { name: 'اقترح لي فكرة عشوائية' }).click();
  await page.locator('.pd-idea-title').waitFor(); const r1 = await page.locator('.pd-idea-title').innerText();
  await page.getByRole('button', { name: 'مكتبة الأفكار' }).click();
  await page.getByRole('button', { name: 'اقترح لي فكرة عشوائية' }).click(); const r2 = await page.locator('.pd-idea-title').innerText();
  assert.notEqual(r1, r2); log('فكرة عشوائية', r1, '→', r2);
  await page.getByRole('button', { name: 'مكتبة الأفكار' }).click();

  // الفكرة المميزة وبطاقتها الكاملة
  await page.locator('.pd-card', { hasText: 'من مستهلك للمحتوى إلى صانع للموارد التعليمية' }).first().locator('.pd-card-main').click();
  for (const h of ['وصف الفكرة وأهميتها', 'الهدف العام', 'الأهداف التفصيلية القابلة للقياس', 'المحاور الرئيسة', 'الأدوات والمتطلبات', 'أساليب التدريب', 'النشاط التطبيقي', 'تقويم الأثر', 'النتائج المتوقعة']) await page.locator('.pd-block h3', { hasText: h }).first().waitFor();
  for (const k of ['الفئة المستهدفة', 'الزمن المقترح']) await page.locator('.pd-fact', { hasText: k }).waitFor();
  await page.screenshot({ path: path.join(OUT, '02-idea.png'), fullPage: true }); log('بطاقة الفكرة بحقولها الثلاثة عشر');

  // الإعدادات + إعداد سريع
  await page.locator('.pd-seg button', { hasText: '30 د' }).click();
  await page.locator('.pd-field', { hasText: 'عدد المشاركين' }).locator('input').fill('40');
  await page.locator('.pd-field', { hasText: 'التخصص' }).locator('select').selectOption('music');
  await page.getByRole('radio', { name: 'عملي' }).click();
  await page.locator('.pd-more summary').click();
  await page.locator('.pd-field', { hasText: 'مقدّم المشغل' }).locator('input').fill('أ. حسين محمد سيد');
  await page.locator('.pd-field', { hasText: 'التاريخ' }).locator('input').fill('الأحد 15 نوفمبر 2026');
  await page.getByRole('button', { name: AI ? 'إعداد سريع من محتوى المكتبة' : 'إعداد المشغل التدريبي' }).click();
  await page.locator('.pd-ws-title').waitFor();
  const agendaTxt = await page.locator('.pd-agenda').innerText();
  const mins = [...agendaTxt.matchAll(/(\d+) (?:دقائق|دقيقة)|دقيقتان|دقيقة/g)].map((m) => (m[1] ? +m[1] : m[0] === 'دقيقتان' ? 2 : 1));
  assert.equal(mins.reduce((a, b) => a + b, 0), 30, `مجموع الجدول ${mins}`);
  assert.match(await page.locator('.pd-wsec.is-accent').innerText(), /10 مجموعات|20 زوجًا|زوجًا/);
  assert.match(await page.locator('.pd-ws-main').innerText(), /المهارات الموسيقية/);
  for (const h of ['الأهداف التدريبية', 'الافتتاح', 'نشاط تمهيدي', 'المحاور', 'النشاط التطبيقي', 'الخاتمة والتوصيات', 'التقويم والتغذية الراجعة']) await page.locator('.pd-wsec-head h3', { hasText: h }).first().waitFor();
  await page.screenshot({ path: path.join(OUT, '03-workshop.png'), fullPage: true }); log('إعداد سريع لمشغل 30 دقيقة/40 مشاركًا');

  // التعديل
  await page.getByRole('button', { name: 'تعديل المحتوى' }).click();
  await page.locator('.pd-field', { hasText: 'عنوان المشغل' }).locator('input').fill('مشغل: صانع الموارد الذكي');
  const obj = page.locator('.pd-field', { hasText: 'الأهداف التفصيلية' }).locator('textarea');
  await obj.fill((await obj.inputValue()) + '\nيشارك المعلم موردًا مع زميل من تخصص آخر.');
  await page.locator('.pd-fs', { hasText: 'النشاط التطبيقي' }).locator('.pd-minutes input').fill('20');
  await page.getByText(/المجموع \d+ من 30 دقيقة/).first().waitFor();
  assert.match(await page.locator('.pd-total').first().innerText(), /المجموع (?!30)\d+ من 30/);
  await page.getByRole('button', { name: 'وزّع الوقت تلقائيًا' }).click();
  await page.getByText('المجموع 30 من 30 دقيقة').first().waitFor();
  await page.screenshot({ path: path.join(OUT, '04-editor.png') });
  await page.getByRole('button', { name: 'حفظ التعديلات' }).first().click();
  await page.getByText('حُفظت التعديلات.').waitFor();
  assert.equal(await page.locator('.pd-ws-title').innerText(), 'مشغل: صانع الموارد الذكي');
  await page.getByText('يشارك المعلم موردًا مع زميل من تخصص آخر.').waitFor(); log('التعديل اليدوي وإعادة توزيع الوقت');

  // النسخ
  await page.getByRole('button', { name: /نسخ المحتوى/ }).click(); await page.getByText(/نُسخ المشغل كاملًا/).waitFor();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(clip.startsWith('📘 مشغل: صانع الموارد الذكي') && clip.includes('■ النشاط التطبيقي') && clip.includes('يشارك المعلم موردًا')); log('نسخ المحتوى', clip.length, 'حرفًا');
  // PowerPoint و Word
  for (const [btn, ext] of [[/عرض PowerPoint/, '.pptx'], [/حقيبة تدريبية \(Word\)/, '.docx']]) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: btn }).click()]);
    const name = dl.suggestedFilename(); assert.ok(name.endsWith(ext), name);
    const target = path.join(OUT, `ui-export${ext}`); await dl.saveAs(target);
    const buf = fs.readFileSync(target); assert.equal(buf.readUInt32LE(0), 0x04034b50); log('تنزيل', name, buf.length, 'بايت');
  }
  // الطباعة (الحقيبة، الوثيقة، الدعوة) — نتحقق أن الإطار المعزول طلب الطباعة فعلًا بمحتوى كامل
  for (const btn of [/حقيبة تدريبية للطباعة/, /وثيقة المشغل للطباعة/, /بطاقة دعوة/]) {
    await page.getByRole('button', { name: btn }).click();
    await page.waitForFunction((n) => window.__printed.length >= n, (await page.evaluate(() => window.__printed.length)) + 1, { timeout: 8000 });
  }
  const printed = await page.evaluate(() => window.__printed); assert.equal(printed.length, 3);
  assert.ok(printed.every((p) => +p.split('|')[1] > 200), printed.join(' ; ')); log('الطباعة / PDF', printed.join(' ; '));

  // مشاغلي (السجل) يبقى بعد إعادة التحميل
  await page.reload(); await page.getByRole('button', { name: /مشاغلي/ }).click();
  await page.locator('.pd-row', { hasText: 'مشغل: صانع الموارد الذكي' }).waitFor();
  await page.locator('.pd-row-main', { hasText: 'مشغل: صانع الموارد الذكي' }).click(); await page.locator('.pd-ws-title', { hasText: 'صانع الموارد الذكي' }).waitFor(); log('السجل محفوظ بعد إعادة التحميل');

  if (AI) {
    // توليد أفكار جديدة
    await page.getByRole('button', { name: 'مكتبة الأفكار' }).click();
    await page.getByLabel('وصف الفكرة المطلوبة').fill('مشغل قصير عن الأسئلة الصفية');
    await page.getByRole('button', { name: 'ابتكر أفكارًا' }).click();
    await page.locator('.pd-working').waitFor(); await page.getByText(/أُضيفت 3 أفكار جديدة/).waitFor();
    assert.equal(await page.locator('.pd-section', { hasText: 'أفكار مبتكرة لك' }).locator('.pd-ai-badge').count(), 3);
    await page.getByRole('button', { name: 'ابتكر أفكارًا' }).click(); await page.getByText(/أُضيفت 3 أفكار جديدة/).waitFor();
    const titles = await page.locator('.pd-section', { hasText: 'أفكار مبتكرة لك' }).locator('.pd-card-title').allInnerTexts();
    assert.equal(new Set(titles).size, titles.length, 'لا تكرار'); log('توليد أفكار', titles.length, 'فكرة غير مكررة');
    await page.screenshot({ path: path.join(OUT, '05-ai-ideas.png') });
    // فاجئني
    await page.getByRole('button', { name: 'فاجئني بفكرة تدريبية' }).click();
    await page.locator('.pd-source.is-ai').waitFor(); assert.equal(await page.locator('.pd-block', { hasText: 'مراجع للاستزادة' }).count(), 0, 'لا مراجع لفكرة مولدة'); log('فاجئني');
    // إعداد بالذكاء الاصطناعي لفكرة المكتبة
    await page.getByRole('button', { name: 'مكتبة الأفكار' }).click();
    await page.locator('.pd-grid.is-featured .pd-card', { hasText: 'من مستهلك للمحتوى' }).locator('.pd-card-main').click();
    await page.getByRole('button', { name: 'إعداد المشغل التدريبي بالذكاء الاصطناعي' }).click();
    await page.getByText(/يعدّ الذكاء الاصطناعي المشغل كاملًا… \d+ ث/).waitFor();
    await page.getByText('المشغل جاهز. راجعه وعدّل ما تريد قبل التصدير.').waitFor();
    await page.locator('.pd-ai-note').waitFor(); await page.locator('.pd-source.is-mixed').waitFor();
    assert.ok(!(await page.locator('.pd-ws-main').innerText()).includes('Fake ref'), 'مراجع مختلقة محذوفة');
    // إعادة صياغة جزء
    await page.locator('.pd-wsec', { hasText: 'النشاط التطبيقي' }).getByRole('button', { name: 'أعد الصياغة' }).click();
    await page.getByPlaceholder(/توجيه اختياري/).fill('أنشطة أقصر');
    await page.getByRole('button', { name: 'أعد صياغة النشاط التطبيقي' }).click();
    await page.getByText('تمت إعادة صياغة هذا الجزء.').waitFor();
    await page.getByText('نشاط معاد الصياغة').first().waitFor(); await page.locator('.pd-axis', { hasText: 'كيف نكتب الطلب؟' }).waitFor();
    log('إعداد بالذكاء الاصطناعي + إعادة صياغة جزء');
    // الإلغاء أثناء الانتظار
    await page.locator('.pd-wsec', { hasText: 'الأهداف التدريبية' }).getByRole('button', { name: 'أعد الصياغة' }).click();
    await page.getByRole('button', { name: 'أعد صياغة الأهداف' }).click();
    await page.locator('.pd-working').getByRole('button', { name: 'إلغاء' }).click(); await page.getByText('أُلغي الطلب.').waitFor(); log('إلغاء الطلب');
  } else {
    await page.getByRole('button', { name: 'مكتبة الأفكار' }).click();
    assert.equal(await page.getByRole('button', { name: 'ابتكر أفكارًا' }).count(), 0, 'لا زر توليد بلا مفتاح'); await page.locator('.pd-ask.is-off').waitFor();
    await page.getByRole('button', { name: 'فاجئني بفكرة تدريبية' }).click(); await page.locator('.pd-source.is-library').waitFor();
    assert.equal(await page.getByRole('button', { name: 'إعداد المشغل التدريبي بالذكاء الاصطناعي' }).count(), 0);
    log('بلا مفتاح: التوليد معطل بوضوح، والمكتبة والإعداد يعملان');
  }
  assert.deepEqual(errors.filter((e) => !/favicon/.test(e)), [], 'أخطاء في المتصفح');

  // شاشات مختلفة والوضع الداكن
  for (const [name, vp, dark] of [['06-mobile', { width: 390, height: 844 }, false], ['07-mobile-dark', { width: 390, height: 844 }, true], ['08-tablet-dark', { width: 820, height: 1180 }, true]]) {
    const p = await ctx.newPage(); await p.setViewportSize(vp); await p.goto(BASE + (dark ? '/?dark=1' : '/'));
    await p.getByRole('heading', { name: 'مشاغل الإنماء المهني' }).waitFor();
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert.ok(overflow <= 1, `${name}: تمرير أفقي ${overflow}`);
    await p.screenshot({ path: path.join(OUT, `${name}.png`) });
    await p.locator('.pd-card-main').first().click(); await p.locator('.pd-idea-title').waitFor();
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 1);
    await p.getByRole('button', { name: /إعداد سريع|إعداد المشغل التدريبي$/ }).first().click(); await p.locator('.pd-ws-title').waitFor();
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 1, `${name}: تمرير أفقي في المشغل`);
    await p.screenshot({ path: path.join(OUT, `${name}-workshop.png`), fullPage: false }); await p.close();
    log('عرض', name);
  }
  await browser.close();
  console.log('\nE2E OK');
})().catch((e) => { console.error('✗', e); process.exit(1); });
