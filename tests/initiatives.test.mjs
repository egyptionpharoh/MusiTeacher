// اختبارات «مبادرات تعليمية»:  node --test tests/initiatives.test.mjs
// المكتبة، التطبيع، المولدات (الجدول الزمني/المتابعة/الاستبانة)، الدمج والمزامنة، منطق الخادم بذكاء اصطناعي محاكى، وسلامة ملف Word.
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { INITIATIVES } from '../src/lib/initiatives/library.js';
import { DOMAINS, LEADS, COSTS, STATUSES, TWEAKS } from '../src/lib/initiatives/taxonomy.js';
import { libraryInitiatives, filterInitiatives, randomInitiative } from '../src/lib/initiatives/catalog.js';
import { normalizeInitiative, normalizeProject, projectFromInitiative, duplicateProject, timelineOf, tasksFromPhases, syncTasks, progressOf, surveyOf, dedupe, str } from '../src/lib/initiatives/schema.js';
import { mergeData } from '../src/lib/initiatives/store.js';
import { makeHandlers } from '../src/lib/initiatives/handlers.js';
import { SYSTEM, ideasPrompt, developPrompt } from '../src/lib/initiatives/prompts.js';
import { buildProjectDocx, imageSize } from '../src/lib/initiatives/export-docx.js';
import { projectHTML, posterHTML, surveyHTML, projectToText, outline } from '../src/lib/initiatives/export-html.js';
import { crc32 } from '../src/lib/cover-studio/zip.js';

const lib = libraryInitiatives();
const featured = lib.find((i) => i.id === 'school-innovates');

function unzip(buf) {
  const out = {}; let p = 0;
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8), csize = buf.readUInt32LE(p + 18), crc = buf.readUInt32LE(p + 14);
    const nlen = buf.readUInt16LE(p + 26), xlen = buf.readUInt16LE(p + 28);
    const name = buf.subarray(p + 30, p + 30 + nlen).toString('utf8');
    const body = buf.subarray(p + 30 + nlen + xlen, p + 30 + nlen + xlen + csize);
    const d = method === 8 ? zlib.inflateRawSync(body) : body;
    assert.equal(crc32(d), crc, `CRC ${name}`); out[name] = d; p += 30 + nlen + xlen + csize;
  }
  return out;
}
function wellFormed(xml, name) {
  const stack = []; const re = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>/g; let m;
  while ((m = re.exec(xml))) { if (m[4]) continue; if (m[1]) assert.equal(stack.pop(), m[2], `${name}: </${m[2]}>`); else stack.push(m[2]); }
  assert.equal(stack.length, 0, `${name}: وسوم غير مغلقة`);
}

// ====================================================================== المكتبة
test(`المكتبة: ${INITIATIVES.length} مبادرة تغطي كل المجالات والقيادات والتكاليف`, () => {
  assert.ok(INITIATIVES.length >= 35);
  assert.equal(new Set(INITIATIVES.map((i) => i.id)).size, INITIATIVES.length);
  for (const d of DOMAINS) assert.ok(lib.some((i) => i.domain === d.id), d.label);
  for (const l of LEADS) assert.ok(lib.some((i) => i.lead === l.id), l.label);
  for (const c of COSTS) assert.ok(lib.some((i) => i.cost === c.id), c.label);
  assert.ok(lib.some((i) => i.weeks === 1) && lib.some((i) => i.weeks >= 12), 'مدد متنوعة');
  assert.ok(featured && featured.featured && lib.find((i) => i.id === 'little-journalist'), 'المبادرة المطلوبة والصحفي الصغير (من النسخة السابقة)');
});
for (const raw of INITIATIVES) {
  test(`مبادرة مكتملة وواقعية: ${raw.title}`, () => {
    const i = normalizeInitiative(raw, 'library');
    for (const f of ['slogan', 'summary', 'problem', 'goal', 'audience', 'beneficiaries', 'join']) assert.ok(i[f].length > 5, `${f} ناقص`);
    assert.ok(i.rationale.length >= 2 && i.objectives.length >= 2, 'مبررات وأهداف');
    assert.ok(i.team.length >= 1 && i.team.every((t) => t.r && t.tasks), 'فريق بمهام');
    assert.ok(i.resources.length >= 1 && i.phases.length >= 1 && i.phases.every((p) => p.steps.length && p.by), 'موارد ومراحل بمسؤول');
    assert.equal(i.phases.reduce((s, p) => s + p.w, 0), i.weeks, 'مجموع أسابيع المراحل = المدة');
    assert.ok(i.kpis.length >= 1 && i.kpis.every((k) => k.k && k.tool), 'مؤشرات بأداة قياس');
    assert.ok(i.evaluation.length && i.outputs.length && i.sustain.length && i.approvals.length, 'تقييم ومخرجات واستدامة وموافقات');
    assert.equal(i.brief, false);
    const all = JSON.stringify(raw);
    assert.ok(!/وزارة/.test(all), 'لا نسبة للوزارة');
    assert.ok(!/(دراسة|دراسات) (أثبتت|تؤكد|تشير)|بنسبة \d|\d+\s?%\s?(من|على الأقل)|تحقيق التميز|رفع المستوى/.test(all), 'لا إحصاءات أو أهداف إنشائية');
    for (const k of i.kpis) assert.ok(!/\d+\s?%|٪/.test(k.k), `مؤشر بنسبة مستهدفة: ${k.k}`);
    if (i.resources.some((r) => r.c === 'partner')) assert.ok(i.resources.filter((r) => r.c === 'partner').every((r) => r.alt), 'بديل للموارد المكلفة');
    if (/صور|تصوير|تسجيل/.test(all)) assert.ok(i.approvals.some((a) => /موافق/.test(a)), 'التصوير يحتاج موافقة');
  });
}
test('البحث والتصفية و«الكل»', () => {
  assert.equal(filterInitiatives(lib, {}).length, lib.length);
  assert.ok(filterInitiatives(lib, { q: 'القراءة' }).some((i) => i.id === 'reading-ladder'));
  const f = filterInitiatives(lib, { lead: 'students', cost: 'free' });
  assert.ok(f.length >= 3 && f.every((i) => i.lead === 'students' && i.cost === 'free'));
  assert.ok(filterInitiatives(lib, { duration: 'week' }).every((i) => i.weeks <= 1));
  assert.ok(filterInitiatives(lib, { stage: 'c1' }).every((i) => i.stages.includes('c1')));
  const recent = lib.slice(1).map((i) => i.id);
  assert.equal(randomInitiative(lib, recent).id, lib[0].id);
});

// ====================================================================== المولدات والتطبيع
test('مولد الجدول الزمني: مراحل متتابعة من الأحد إلى الخميس', () => {
  const tl = timelineOf(featured.phases, '2026-11-11');   // أربعاء
  assert.equal(tl[0].from, '2026-11-15'); assert.equal(new Date(tl[0].from).getUTCDay(), 0, 'تبدأ الأحد');
  assert.equal(new Date(tl[0].to).getUTCDay(), 4, 'تنتهي الخميس');
  assert.equal(tl[tl.length - 1].toWeek, featured.weeks);
  for (let k = 1; k < tl.length; k++) assert.equal(tl[k].fromWeek, tl[k - 1].toWeek + 1);
  assert.equal(timelineOf(featured.phases, '')[0].from, undefined, 'بلا تاريخ: أسابيع فقط');
});
test('قائمة المتابعة: من خطوات المراحل، وتحديثها يحفظ الإنجاز والمهام الإضافية', () => {
  const tasks = tasksFromPhases(featured.phases);
  assert.equal(tasks.length, featured.phases.reduce((s, p) => s + p.steps.length, 0));
  tasks[0].done = true; tasks.push({ id: 'x', phase: 20, text: 'مهمة إضافية', done: true, doneAt: 1 });
  const phases = [{ ...featured.phases[0], steps: [...featured.phases[0].steps, 'خطوة جديدة'] }, ...featured.phases.slice(1)];
  const synced = syncTasks(tasks, phases);
  assert.ok(synced.find((t) => t.text === featured.phases[0].steps[0]).done, 'الإنجاز محفوظ');
  assert.ok(synced.find((t) => t.text === 'خطوة جديدة')); assert.ok(synced.find((t) => t.text === 'مهمة إضافية'));
  assert.equal(progressOf({ tasks: synced }).done, 2);
});
test('نموذج قياس الأثر: بلا أسماء، ومبسط للحلقة الأولى', () => {
  const s = surveyOf(featured); assert.equal(s.scale.length, 4); assert.ok(s.items.length >= 4); assert.match(s.intro, /بلا اسم/);
  const young = surveyOf(lib.find((i) => i.id === 'healthy-lunchbox')); assert.equal(young.scale.length, 3);
  assert.ok(!JSON.stringify(s).match(/اسمك|رقمك|هاتف/));
});
test('التطبيع يتحمل المدخلات التالفة، ولا يقبل مراجع من الذكاء الاصطناعي', () => {
  assert.equal(normalizeInitiative(null), null);
  const i = normalizeInitiative({ title: 'x'.repeat(400), domain: 'hack', lead: 'x', cost: 'gold', weeks: 999, phases: [{ t: 'أ', w: 'abc', steps: 'خطوة\nثانية' }], refs: ['مرجع مختلق'], kpis: ['مؤشر'] }, 'ai');
  assert.equal(i.title.length, 160); assert.equal(i.domain, 'academic'); assert.equal(i.cost, 'low'); assert.equal(i.weeks, 52);
  assert.deepEqual(i.phases[0].steps, ['خطوة', 'ثانية']); assert.deepEqual(i.refs, []); assert.equal(i.kpis[0].k, 'مؤشر');
  const p = normalizeProject({ status: 'hacked', meta: { logo: 'javascript:alert(1)', startDate: 'tomorrow' }, log: [{ activity: '<b>x</b>' }] });
  assert.equal(p.status, 'idea'); assert.equal(p.meta.logo, ''); assert.equal(p.meta.startDate, '');
  assert.equal(str('(1–4)'), '(1-4)');
});
test('المشروع: من مبادرة، ونسخة مستقلة تبدأ من التخطيط', () => {
  const p = projectFromInitiative(featured, { meta: { school: 'مدرسة' } });
  assert.equal(p.status, 'planning'); assert.equal(p.plan.title, featured.title); assert.ok(p.tasks.length > 5); assert.match(p.meta.year, /^\d{4}-\d{4}$/);
  const brief = projectFromInitiative(normalizeInitiative({ title: 'فكرة', summary: 'س' }, 'ai')); assert.equal(brief.status, 'idea'); assert.equal(brief.origin, 'ai');
  const d = duplicateProject({ ...p, status: 'active', log: [{ id: 'l', activity: 'نشاط' }] });
  assert.notEqual(d.id, p.id); assert.equal(d.status, 'planning'); assert.equal(d.log.length, 0); assert.ok(d.tasks.every((t) => !t.done)); assert.match(d.plan.title, /\(نسخة\)$/);
});
test('دمج المزامنة: الأحدث يفوز، والمحذوفات تُحترم، والشعار المحلي يبقى', () => {
  const a = normalizeProject({ id: 'a', updatedAt: 100, plan: { title: 'أ قديم' }, meta: { logo: 'data:image/png;base64,AAAA' } });
  const a2 = normalizeProject({ id: 'a', updatedAt: 200, plan: { title: 'أ جديد' } });
  const b = normalizeProject({ id: 'b', updatedAt: 100, plan: { title: 'ب' } });
  const c = normalizeProject({ id: 'c', updatedAt: 100, plan: { title: 'ج' } });
  const m = mergeData({ projects: [a, b], favs: ['x'], deleted: { c: 150 } }, { projects: [a2, c], favs: ['y'], deleted: {} });
  assert.deepEqual(m.projects.map((p) => p.plan.title).sort(), ['أ جديد', 'ب']);
  assert.equal(m.projects.find((p) => p.id === 'a').meta.logo, 'data:image/png;base64,AAAA');
  assert.deepEqual(m.favs.sort(), ['x', 'y']);
});
test('منع التكرار بين الأفكار المولدة ومع المكتبة', () => {
  const ideas = ['مدرستي تبتكر: من فكرة طالب إلى مشروع', 'جدار الأسئلة الصامتة', 'مبادرة جدار الأسئلة الصامتة!'].map((t) => normalizeInitiative({ title: t }, 'ai'));
  assert.deepEqual(dedupe(ideas, [featured.title]).map((i) => i.title), ['جدار الأسئلة الصامتة']);
});

// ====================================================================== التعليمات
test('تعليمات الذكاء الاصطناعي: لا إحصاءات ولا نسب مستهدفة ولا وزارة، وبدائل وموافقات', () => {
  for (const s of [/لا تختلق إحصاءات/, /وزارة التعليم/, /دون نسب|لا تضع أي نسبة/, /alt/, /approvals/, /بيانات شخصية/]) assert.match(SYSTEM, s);
  const p = ideasPrompt({ request: 'مبادرة قراءة', options: { domain: 'academic', stage: 'c2', weeks: 1, nature: 'student' }, exclude: ['سابقة'], count: 3 });
  for (const s of ['مبادرة قراءة', 'التعليمية والأكاديمية', 'الحلقة الثانية', 'سابقة', 'طلابية', 'آلية التنفيذ']) assert.ok(p.includes(s), s);
  const d = developPrompt({ initiative: featured, tweaks: [TWEAKS[0], TWEAKS[3]], instruction: 'للصف السادس' });
  assert.ok(d.includes(TWEAKS[0]) && d.includes(TWEAKS[3]) && d.includes('للصف السادس'));
});

// ====================================================================== الخادم
function fakeAI({ fail } = {}) {
  const calls = [];
  return {
    calls, configured: () => true,
    async generateJSON({ prompt }) {
      calls.push(prompt);
      if (fail) { const e = new Error('x'); e.code = fail; throw e; }
      if (prompt.startsWith('ابتكر')) return { data: { ideas: [{ title: 'جدار الأسئلة الصامتة', domain: 'academic', phases: [{ t: 'x', w: 3 }], refs: ['مختلق'] }, { title: featured.title }, { title: 'جدار الأسئلة الصامتة!!' }, { title: 'سوق المهارات بين الصفوف', domain: 'leadership' }] }, model: 'f' };
      if (prompt.startsWith('طوّر')) return { data: { title: 'مطورة', weeks: 99, objectives: ['أ'], phases: [{ t: 'أ', w: 2, steps: ['س'] }, { t: 'ب', w: 3, steps: ['ص'] }], kpis: [{ k: 'عدد', tool: 'سجل' }], refs: ['مختلق'] }, model: 'f' };
      if (/فريق العمل/.test(prompt)) return { data: { team: [{ r: 'منسق', tasks: 'جديد' }] }, model: 'f' };
      return { data: {}, model: 'f' };
    },
  };
}
const H = (ai, extra = {}) => makeHandlers({
  ai, log: () => {}, verifyIdToken: async (t) => { if (t === 'good') return { uid: 'u1' }; throw new Error('bad'); },
  findUser: async () => ({ isSubscribed: true, subscriptionEndDate: new Date(Date.now() + 864e5) }), ...extra,
});
const R = (body, { token = 'good', method = 'POST', origin } = {}) => new Request('http://localhost/api/initiatives/x', {
  method, body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body), headers: { host: 'localhost', 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}) },
});

test('الخادم: الحالة، والدخول والاشتراك والمصدر شرط للتوليد', async () => {
  const h = H(fakeAI());
  assert.deepEqual(await (await h.status()).json(), { ok: true, ai: true, sync: false, library: lib.length });
  assert.equal((await h.ideas(R({}, { token: null }))).status, 401);
  assert.equal((await h.ideas(R({}, { origin: 'https://evil.example' }))).status, 403);
  assert.equal((await H(fakeAI(), { findUser: async () => ({ isSubscribed: false }) }).ideas(R({}))).status, 403);
  assert.equal((await H({ configured: () => false }).ideas(R({}))).status, 503);
});
test('الخادم: ابتكار أفكار جديدة مختصرة بلا تكرار وبلا مراجع وبلا مراحل مفروضة', async () => {
  const ai = fakeAI(); const r = await (await H(ai).ideas(R({ request: 'قراءة', options: { stage: 'c2', hack: 1 }, exclude: ['قديمة'] }))).json();
  assert.equal(r.ok, true); assert.deepEqual(r.ideas.map((i) => i.title), ['جدار الأسئلة الصامتة', 'سوق المهارات بين الصفوف']);
  assert.ok(r.ideas.every((i) => i.brief && !i.phases.length && !i.refs.length && i.source === 'ai'));
  assert.match(ai.calls[0], /قديمة/); assert.match(ai.calls[0], new RegExp(lib[5].title.slice(0, 15)), 'المكتبة ضمن المستبعد');
});
test('الخادم: تطوير المبادرة يحسب المدة من المراحل ويقبل التعديلات المعروفة فقط', async () => {
  const ai = fakeAI(); const r = await (await H(ai).develop(R({ initiative: featured, tweaks: [TWEAKS[1], 'تعديل غير معروف'], instruction: 'أقصر' }))).json();
  assert.equal(r.ok, true); assert.equal(r.plan.weeks, 5); assert.deepEqual(r.plan.refs, []);
  assert.ok(ai.calls[0].includes(TWEAKS[1]) && !ai.calls[0].includes('تعديل غير معروف') && ai.calls[0].includes('أقصر'));
  assert.equal((await H(fakeAI()).develop(R({ initiative: {} }))).status, 400);
});
test('الخادم: إعادة توليد جزء يبقي البقية، وأخطاء الذكاء الاصطناعي واضحة', async () => {
  const r = await (await H(fakeAI()).section(R({ initiative: featured, section: 'team' }))).json();
  assert.deepEqual(r.plan.team, [{ r: 'منسق', tasks: 'جديد', name: '' }]); assert.deepEqual(r.plan.phases, featured.phases.map((p) => ({ ...p })));
  assert.equal((await H(fakeAI()).section(R({ initiative: featured, section: 'objectives' }))).status, 502, 'رد فارغ = خطأ');
  assert.equal((await H(fakeAI()).section(R({ initiative: featured, section: 'hack' }))).status, 400);
  assert.equal((await H(fakeAI({ fail: 'timeout' })).ideas(R({}))).status, 504);
  const h = H(fakeAI(), { burstMax: 1 }); await h.ideas(R({})); assert.equal((await h.ideas(R({}))).status, 429);
});
test('الخادم: المزامنة تحفظ نسخة مطبّعة بلا شعارات، وتسترجعها وتحذفها', async () => {
  const mem = new Map();
  const store = { get: async (u) => mem.get(u) || null, put: async (u, data, at) => mem.set(u, { data, updatedAt: at }), remove: async (u) => mem.delete(u) };
  const h = H(fakeAI(), { store });
  const p = normalizeProject({ ...projectFromInitiative(featured), meta: { logo: 'data:image/png;base64,AAAA', school: 'م' } });
  assert.equal((await h.sync(R({ data: { projects: [p], favs: ['a'], deleted: {} } }))).status, 200);
  const g = await (await h.sync(R(null, { method: 'GET' }))).json();
  assert.equal(g.data.projects[0].meta.logo, ''); assert.equal(g.data.projects[0].meta.school, 'م'); assert.deepEqual(g.data.favs, ['a']);
  assert.equal((await h.sync(R({ data: { projects: 'x' } }))).status, 400);
  assert.equal((await h.sync(R(null, { method: 'DELETE' }))).status, 200); assert.equal(mem.size, 0);
  assert.equal((await H(fakeAI()).sync(R(null, { method: 'GET' }))).status, 503, 'بلا مخزن');
  assert.equal((await h.sync(R(null, { method: 'GET', token: null }))).status, 401);
});

// ====================================================================== المخرجات
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFElEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const sample = normalizeProject({
  ...projectFromInitiative(featured), status: 'active',
  meta: { school: 'مدرسة الإبداع', presenter: 'أ. حسين محمد سيد', year: '2026-2027', startDate: '2026-11-15', logo: `data:image/png;base64,${png.toString('base64')}` },
  log: [{ id: 'l1', date: '2026-11-16', activity: 'إطلاق المبادرة', notes: 'تفاعل جيد', results: '18 فكرة' }],
  results: { summary: 'نتائج أولية', lessons: 'دروس' },
});
test('النسخة النصية والطباعة: كل أجزاء ملف المبادرة (أ–هـ) والملاحق، والنصوص مهرّبة', () => {
  const t = projectToText(sample);
  for (const s of ['🌟 مدرستي تبتكر', 'ب. التعريف بالمبادرة', 'ج. خطة التنفيذ', 'د. المتابعة والتقييم', 'هـ. الاستدامة', 'الجدول الزمني', 'سجل الإنجاز', 'إطلاق المبادرة']) assert.ok(t.includes(s), s);
  const h = projectHTML(sample);
  for (const s of ['ملف مبادرة', 'مدرسة الإبداع', 'أ. حسين محمد سيد', '2026-2027', 'الخلفية والمبررات', 'مراحل التنفيذ والأنشطة', 'فريق العمل والمسؤوليات', 'الموارد المطلوبة', 'الشركاء المحتملون', 'مؤشرات الأداء وأدوات القياس', 'آلية توثيق التنفيذ', 'نتائج المبادرة', 'الاستدامة والتطوير والتعميم', 'قائمة متابعة التنفيذ', 'نموذج قياس الأثر', 'سجل التوثيق', 'data:image/png']) assert.ok(h.includes(s), s);
  const evil = normalizeProject({ ...sample, plan: { ...sample.plan, title: '<img src=x onerror=alert(1)>' } });
  for (const html of [projectHTML(evil), posterHTML(evil), surveyHTML(evil)]) { assert.ok(!html.includes('<img src=x')); assert.match(html, /dir="rtl"/); }
  assert.ok(outline(sample).some((s) => s.title === 'الجدول الزمني' && s.blocks[0].rows[0][2].includes('نوفمبر')));
});
test('ملف Word: حزمة سليمة، A4، RTL، الشعار مضمّن، وكل الأقسام', async () => {
  const files = unzip(Buffer.from(await buildProjectDocx(sample)));
  for (const [n, d] of Object.entries(files)) if (/\.(xml|rels)$/.test(n)) wellFormed(d.toString('utf8'), n);
  assert.ok(files['word/media/logo.png']); assert.deepEqual(imageSize(new Uint8Array(png), 'png'), { w: 2, h: 3 });
  const doc = files['word/document.xml'].toString('utf8');
  assert.match(doc, /<w:pgSz w:w="11906" w:h="16838"\/>/); assert.match(doc, /r:embed="rIdLogo"/); assert.match(doc, /<w:bidiVisual\/>/);
  const plain = doc.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
  for (const s of ['ملف مبادرة — مدرسة الإبداع', 'بيانات المبادرة', 'ب. التعريف بالمبادرة', 'ج. خطة التنفيذ', 'د. المتابعة والتقييم', 'هـ. الاستدامة', 'ملحق (1): قائمة متابعة التنفيذ', 'ملحق (2): نموذج قياس الأثر', 'ملحق (3): سجل التوثيق', 'إطلاق المبادرة']) assert.ok(plain.includes(s), s);
  for (const m of doc.matchAll(/<w:pPr>(.*?)<\/w:pPr>/g)) { const p = m[1]; assert.ok(p.indexOf('<w:bidi') < p.indexOf('<w:spacing'), 'ترتيب pPr'); }
  assert.match(files['word/_rels/document.xml.rels'].toString('utf8'), /media\/logo\.png/);
  const noLogo = unzip(Buffer.from(await buildProjectDocx(normalizeProject({ ...sample, meta: { ...sample.meta, logo: '' } }))));
  assert.ok(!noLogo['word/media/logo.png'] && !noLogo['word/document.xml'].toString('utf8').includes('rIdLogo'));
});
test('كل مبادرات المكتبة تُصدَّر ملف Word سليمًا', async () => {
  for (const i of lib) {
    const files = unzip(Buffer.from(await buildProjectDocx(projectFromInitiative(i))));
    wellFormed(files['word/document.xml'].toString('utf8'), i.id);
    assert.ok(!/undefined|NaN|\[object/.test(files['word/document.xml'].toString('utf8')), i.id);
  }
});
const soffice = (() => { try { execFileSync('soffice', ['--version'], { stdio: 'ignore', timeout: 30000 }); return true; } catch { return false; } })();
test('LibreOffice يفتح ملف المبادرة ويحوّله إلى PDF (فتح حقيقي)', { skip: !soffice && 'LibreOffice غير متوفر' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'in-'));
  fs.writeFileSync(path.join(dir, 'f.docx'), await buildProjectDocx(sample));
  execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', dir, path.join(dir, 'f.docx')], { timeout: 180000, stdio: 'ignore' });
  const pages = Number((execFileSync('pdfinfo', [path.join(dir, 'f.pdf')]).toString().match(/Pages:\s+(\d+)/) || [])[1]);
  assert.ok(pages >= 6, `صفحات ${pages}`);
});
test('الحالات الخمس للمبادرة معرفة', () => { assert.deepEqual(STATUSES.map((s) => s.id), ['idea', 'planning', 'ready', 'active', 'done']); });
