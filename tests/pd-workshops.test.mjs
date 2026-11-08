// اختبارات مشاغل الإنماء المهني:  node --test tests/pd-workshops.test.mjs
// المكتبة، توزيع الزمن، التطبيع، منطق الخادم (بذكاء اصطناعي محاكى)، عميل Gemini (بشبكة محاكاة)، وسلامة ملفات PowerPoint وWord.
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IDEAS } from '../src/lib/pd-workshops/ideas.js';
import { DOMAINS, DURATIONS, STYLES } from '../src/lib/pd-workshops/taxonomy.js';
import { libraryIdeas, filterIdeas, randomIdea } from '../src/lib/pd-workshops/library.js';
import { allocate, composeWorkshop, retime } from '../src/lib/pd-workshops/compose.js';
import { normalizeIdea, normalizeWorkshop, agendaOf, totalMinutes, dedupeIdeas, str } from '../src/lib/pd-workshops/schema.js';
import { makeHandlers } from '../src/lib/pd-workshops/handlers.js';
import { makeGemini, parseJSON, modelsFrom } from '../src/lib/pd-workshops/ai.js';
import { SYSTEM, ideasPrompt, buildPrompt } from '../src/lib/pd-workshops/prompts.js';
import { buildPptx, buildSlides, fitSize } from '../src/lib/pd-workshops/export-pptx.js';
import { buildKitDocx } from '../src/lib/pd-workshops/export-docx.js';
import { workshopToText, kitHTML, printableHTML, inviteHTML, bidiNums } from '../src/lib/pd-workshops/export-text.js';
import { crc32 } from '../src/lib/cover-studio/zip.js';

const lib = libraryIdeas();
const featured = lib.find((i) => i.id === 'ai-creator');

function unzip(buf) {
  const out = {}; let p = 0;
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8), csize = buf.readUInt32LE(p + 18), crc = buf.readUInt32LE(p + 14);
    const nlen = buf.readUInt16LE(p + 26), xlen = buf.readUInt16LE(p + 28);
    const name = buf.subarray(p + 30, p + 30 + nlen).toString('utf8');
    const body = buf.subarray(p + 30 + nlen + xlen, p + 30 + nlen + xlen + csize);
    const d = method === 8 ? zlib.inflateRawSync(body) : body;
    assert.equal(crc32(d), crc, `CRC ${name}`);
    out[name] = d.toString('utf8'); p += 30 + nlen + xlen + csize;
  }
  return out;
}
/** فحص XML بنيوي بسيط: كل وسم يُفتح يُغلق بالترتيب. */
function wellFormed(xml, name) {
  const stack = [];
  const re = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>|<\?[^>]*\?>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (!m[2]) continue;
    if (m[4]) continue;
    if (m[1]) { const top = stack.pop(); assert.equal(top, m[2], `${name}: </${m[2]}> لا يطابق <${top}>`); } else stack.push(m[2]);
  }
  assert.equal(stack.length, 0, `${name}: وسوم غير مغلقة ${stack.slice(-3)}`);
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|#\d+;|apos;)/.test(xml), `${name}: & غير مهرّب`);
}

// ====================================================================== المكتبة
test(`المكتبة: ${IDEAS.length} فكرة بمعرفات فريدة تغطي كل المجالات والمدد`, () => {
  assert.ok(IDEAS.length >= 40);
  assert.equal(new Set(IDEAS.map((i) => i.id)).size, IDEAS.length);
  for (const d of DOMAINS) assert.ok(lib.some((i) => i.domain === d.id), `لا أفكار في ${d.label}`);
  assert.ok(lib.some((i) => i.duration <= 20), 'أفكار قصيرة');
  assert.ok(lib.some((i) => i.duration >= 30 && i.duration <= 45), 'أفكار متوسطة');
  assert.ok(lib.some((i) => i.duration >= 60), 'برامج أطول');
  assert.ok(lib.filter((i) => i.specs.includes('music')).length >= 3, 'أفكار لمعلمي الموسيقى');
  assert.ok(lib.some((i) => i.specs.includes('stem')) && lib.some((i) => i.specs.includes('languages')), 'تخصصات متعددة');
  assert.ok(featured && featured.featured, 'الفكرة المميزة المطلوبة موجودة');
});

for (const raw of IDEAS) {
  test(`بطاقة الفكرة مكتملة: ${raw.title}`, () => {
    const i = normalizeIdea(raw, 'library');
    assert.equal(i.title, raw.title);
    for (const f of ['summary', 'importance', 'goal', 'tag']) assert.ok(i[f].length > 10, `${f} ناقص`);
    assert.ok(i.objectives.length >= 2, 'أهداف');
    assert.ok(i.axes.length >= 2 && i.axes.every((a) => a.t && a.p.length), 'محاور بنقاط');
    assert.ok(i.materials.length && i.strategies.length, 'أدوات واستراتيجيات');
    assert.ok(i.warmup.t && i.warmup.s.length, 'نشاط افتتاحي');
    assert.ok(i.activity.t && i.activity.s.length && i.activity.out, 'نشاط تطبيقي بمنتج');
    assert.ok(i.evaluation.m && i.evaluation.items.length, 'تقويم الأثر');
    assert.ok(i.outcomes.length && i.recs.length && i.discussion.length, 'نتائج وتوصيات ونقاش');
    // الأهداف إجرائية: تبدأ بفعل مضارع لا بأفعال غامضة
    for (const o of i.objectives) assert.ok(!/^(يفهم|يعرف|يدرك|يتعرف)/.test(o.replace(/^يصوغ المعلم|^المعلم /, '')), `هدف غير إجرائي: ${o}`);
    // لا إحصاءات ولا نسب ولا نسبة لجهة رسمية
    const all = JSON.stringify(raw);
    assert.ok(!/%|٪|بالمئة|في المئة|دراسة أثبتت|أثبتت الدراسات/.test(all), 'لا إحصاءات مختلقة');
    assert.ok(!/وزارة/.test(all), 'لا نسبة إلى الوزارة');
    for (const r of i.refs) assert.match(r, /\(\d{4}\)/, 'مرجع بسنة نشر');
  });
}

test('البحث والتصفية: كلمات متعددة، التخصص يشمل «جميع التخصصات»، والمدة', () => {
  const q = filterIdeas(lib, { q: 'بطاقة الخروج' });
  assert.ok(q.some((i) => i.id === 'exit-tickets'));
  assert.ok(filterIdeas(lib, { q: 'الذكاء الاصطناعي' }).length >= 3);
  const music = filterIdeas(lib, { spec: 'music' });
  assert.ok(music.some((i) => i.id === 'music-games-digital') && music.some((i) => i.specs.includes('all')));
  assert.ok(filterIdeas(lib, { band: 'short' }).every((i) => i.duration <= 25));
  assert.equal(filterIdeas(lib, { domain: 'ai', format: 'workshop' }).every((i) => i.domain === 'ai' && i.format === 'workshop'), true);
  assert.equal(filterIdeas(lib, { q: 'كلمةغيرموجودةاطلاقا' }).length, 0);
});
test('الفكرة العشوائية لا تكرر ما عُرض مؤخرًا', () => {
  const recent = lib.slice(0, lib.length - 1).map((i) => i.id);
  for (let k = 0; k < 20; k++) assert.equal(randomIdea(lib, recent, Math.random).id, lib[lib.length - 1].id);
  assert.ok(randomIdea(lib, lib.map((i) => i.id)), 'إن عُرض الكل يعود للمكتبة كاملة');
});

// ====================================================================== الزمن والتأليف
test('توزيع الزمن: المجموع يساوي المدة تمامًا لكل المدد والأساليب', () => {
  for (const T of [10, 15, 20, 25, 30, 45, 60, 90, 120, 180]) for (const s of STYLES) for (const disc of [true, false]) {
    const m = allocate(T, s.id, { discussion: disc });
    const sum = Object.values(m).reduce((a, b) => a + b, 0);
    assert.equal(sum, T, `${T} ${s.id}`);
    assert.ok(m.activity >= (T < 15 ? 3 : 4) && m.axes >= (T < 15 ? 2 : 3) && m.opening >= 1);
    if (T <= 20) assert.equal(m.discussion, 0, 'لا نقاش منفصل في المشغل القصير');
  }
  assert.ok(allocate(45, 'practical').activity > allocate(45, 'knowledge').activity, 'الطابع العملي يعطي النشاط وقتًا أطول');
});
test('تأليف كل أفكار المكتبة بكل المدد: الجدول صحيح والمحتوى مكتمل', () => {
  for (const i of lib) for (const d of DURATIONS) {
    const w = composeWorkshop(i, { duration: d, participants: 26, depth: d <= 20 ? 'brief' : 'standard' });
    assert.equal(totalMinutes(w), d, `${i.id} ${d}`);
    assert.ok(w.axes.length >= 1 && w.axes.length <= (d <= 20 ? 2 : 5));
    assert.ok(w.objectives.length && w.activity.steps.length && w.evaluation.feedback.length);
    const ag = agendaOf(w); assert.equal(ag[ag.length - 1].to, d);
  }
});
test('التخصيص: عدد المشاركين ومستوى التفصيل والتخصص تؤثر فعلًا', () => {
  const big = composeWorkshop(featured, { participants: 60 });
  const small = composeWorkshop(featured, { participants: 6 });
  assert.match(big.activity.grouping, /30 زوجًا/); assert.match(small.activity.grouping, /3 أزواج/);
  assert.ok(big.activity.steps.length > small.activity.steps.length, 'خطوة إدارة المجموعات الكبيرة');
  const brief = composeWorkshop(featured, { depth: 'brief', duration: 45 }), det = composeWorkshop(featured, { depth: 'detailed', duration: 60 });
  assert.ok(brief.objectives.length <= 3 && det.axes[0].explain.length > brief.axes[0].explain.length);
  assert.match(composeWorkshop(featured, { spec: 'music' }).activity.tips.join(' '), /المهارات الموسيقية/);
  assert.ok(composeWorkshop(featured, {}).refs.length > 0, 'المراجع الموثقة تنتقل من المكتبة');
});
test('إعادة توزيع الوقت بعد تعديل المدة تحافظ على المحتوى', () => {
  const w = composeWorkshop(featured, { duration: 45 });
  const r = retime(w, 30);
  assert.equal(totalMinutes(r), 30); assert.deepEqual(r.axes.map((a) => a.title), w.axes.map((a) => a.title));
});

// ====================================================================== التطبيع
test('التطبيع يتحمل المدخلات التالفة ويقص النصوص الطويلة', () => {
  assert.equal(normalizeIdea(null), null); assert.equal(normalizeIdea({ title: '' }), null);
  const i = normalizeIdea({ title: 'x'.repeat(500), domain: 'hack', specs: 'music', objectives: 'أ\nب\n- ج', axes: ['محور', { title: 'ثانٍ', points: ['1', 2] }], refs: ['مرجع مختلق'] }, 'ai');
  assert.equal(i.title.length, 160); assert.equal(i.domain, 'strategies'); assert.deepEqual(i.specs, ['music']);
  assert.deepEqual(i.objectives, ['أ', 'ب', 'ج']); assert.equal(i.axes.length, 2);
  assert.deepEqual(i.refs, [], 'مراجع الذكاء الاصطناعي لا تُقبل');
  const w = normalizeWorkshop({ axes: 'bad', opening: 5, settings: { duration: 9999, participants: -3 } });
  assert.equal(w.settings.duration, 180); assert.equal(w.settings.participants, 2); assert.deepEqual(w.axes, []);
  assert.equal(str('a\u0000b\u0007c'), 'abc');
  assert.equal(str('(1–4)'), '(1-4)', 'نطاق الأرقام بشرطة عادية لا ينقلب في النص العربي');
});
test('إزالة الأفكار المكررة أو شبه المكررة', () => {
  const a = normalizeIdea({ title: 'التقويم التكويني باستخدام بطاقات الخروج' }, 'ai');
  const b = normalizeIdea({ title: 'التقويم التكويني باستخدام بطاقات الخروج!' }, 'ai');
  const c = normalizeIdea({ title: 'مختبر الإيقاع للمعلمين الجدد' }, 'ai');
  assert.deepEqual(dedupeIdeas([a, b, c]).map((x) => x.title), [a.title, c.title]);
  assert.deepEqual(dedupeIdeas([c], ['مختبر الإيقاع للمعلمين الجدد']), []);
});

// ====================================================================== التعليمات
test('تعليمات الذكاء الاصطناعي تمنع اختلاق المراجع والإحصاءات والنسبة للوزارة', () => {
  assert.match(SYSTEM, /لا تختلق مراجع/); assert.match(SYSTEM, /إحصاء/); assert.match(SYSTEM, /وزارة التعليم/); assert.match(SYSTEM, /قابلة للقياس/);
  const p = ideasPrompt({ filters: { domain: 'ai', spec: 'music' }, topic: 'مشغل قصير', exclude: ['فكرة سابقة'], count: 3 });
  assert.match(p, /فكرة سابقة/); assert.match(p, /المهارات الموسيقية/); assert.match(p, /مشغل قصير/);
  assert.match(buildPrompt({ idea: featured, settings: normalizeWorkshop({}).settings }), /لا تضف مراجع/);
});

// ====================================================================== الخادم
const sub = { uid: 'u1' };
function fakeAI({ fail, delay } = {}) {
  let n = 0;
  const calls = [];
  return {
    calls,
    configured: () => true,
    async generateJSON({ prompt }) {
      calls.push(prompt);
      if (delay) await new Promise((r) => setTimeout(r, delay));
      if (fail) { const e = new Error('x'); e.code = fail; throw e; }
      if (prompt.startsWith('اقترح')) {
        n++;
        return { model: 'fake', data: { ideas: [
          { title: `فكرة مولدة رقم ${n} عن مختبر الأسئلة`, domain: 'questions', duration: 20, objectives: ['يصوغ سؤالًا'], axes: [{ t: 'محور', p: ['نقطة'] }], refs: ['Fake (2020). Not real.'] },
          { title: IDEAS[0].title }, // مكررة مع المكتبة → تُحذف
          { title: `فكرة مولدة رقم ${n} عن مختبر الأسئلة` }, // مكررة داخليًا → تُحذف
        ] } };
      }
      if (prompt.startsWith('أعدّ مشغلًا')) {
        return { model: 'fake', data: { title: 'مشغل مولد', objectives: ['يطبق', 'يصمم'], axes: [{ title: 'أ', explain: 'ش', points: ['1'] }, { title: 'ب', points: ['2'] }, { title: 'ج' }],
          activity: { title: 'نشاط', steps: ['1', '2'] }, discussion: { questions: ['س؟'] }, evaluation: { items: ['ب'], feedback: ['ف'] }, refs: ['Invented (2021). Fake.'] } };
      }
      return { model: 'fake', data: { activity: { title: 'نشاط معاد', steps: ['خطوة جديدة'] } } };
    },
  };
}
function H(ai, extra = {}) {
  return makeHandlers({
    ai, log: () => {},
    verifyIdToken: async (t) => { if (t === 'good') return sub; throw new Error('bad'); },
    findUser: async () => ({ role: 'user', isSubscribed: true, subscriptionEndDate: new Date(Date.now() + 864e5) }),
    ...extra,
  });
}
const req = (body, { token = 'good', origin } = {}) => new Request('http://localhost/api/pd-workshops/x', {
  method: 'POST', body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', host: 'localhost', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}) },
});

test('الخادم: الحالة لا تكشف أسرارًا، والتوليد يتطلب دخولًا واشتراكًا ومصدرًا صحيحًا', async () => {
  const h = H(fakeAI());
  assert.deepEqual(await (await h.status()).json(), { ok: true, ai: true, library: lib.length });
  assert.equal((await h.ideas(req({}, { token: null }))).status, 401);
  assert.equal((await h.ideas(req({}, { token: 'bad' }))).status, 401);
  assert.equal((await h.ideas(req({}, { origin: 'https://evil.example' }))).status, 403);
  const expired = H(fakeAI(), { findUser: async () => ({ isSubscribed: true, subscriptionEndDate: new Date(Date.now() - 1000) }) });
  assert.equal((await expired.ideas(req({}))).status, 403);
  const off = H({ configured: () => false });
  assert.equal((await off.ideas(req({}))).status, 503);
  assert.equal((await (await off.status()).json()).ai, false);
});
test('الخادم: أفكار جديدة بلا تكرار مع المكتبة أو فيما بينها، وبلا مراجع مولدة', async () => {
  const ai = fakeAI(); const h = H(ai);
  const r = await h.ideas(req({ topic: 'اختبار', filters: { domain: 'questions' }, exclude: ['فكرة قديمة'] }));
  const d = await r.json();
  assert.equal(r.status, 200); assert.equal(d.ideas.length, 1);
  assert.equal(d.ideas[0].source, 'ai'); assert.deepEqual(d.ideas[0].refs, []);
  assert.match(ai.calls[0], /فكرة قديمة/); assert.match(ai.calls[0], new RegExp(IDEAS[3].title), 'عناوين المكتبة ضمن المستبعد');
});
test('الخادم: إعداد مشغل كامل يوزع الوقت ويستبدل المراجع بمراجع المكتبة', async () => {
  const h = H(fakeAI());
  const d = await (await h.build(req({ idea: featured, settings: { duration: 30, participants: 15 } }))).json();
  assert.equal(d.ok, true); assert.equal(totalMinutes(d.workshop), 30);
  assert.equal(d.workshop.source, 'mixed'); assert.deepEqual(d.workshop.refs, featured.refs);
  const fromAiIdea = await (await h.build(req({ idea: { ...featured, source: 'ai', id: 'ai-x' }, settings: {} }))).json();
  assert.deepEqual(fromAiIdea.workshop.refs, [], 'فكرة مولدة = بلا مراجع');
});
test('الخادم: إعادة توليد جزء واحد تبقي بقية المشغل كما هو', async () => {
  const h = H(fakeAI());
  const w = composeWorkshop(featured, { duration: 45 });
  const d = await (await h.section(req({ workshop: w, section: 'activity', instruction: 'أقصر' }))).json();
  assert.equal(d.workshop.activity.title, 'نشاط معاد'); assert.deepEqual(d.workshop.axes.map((a) => a.title), w.axes.map((a) => a.title));
  assert.equal(totalMinutes(d.workshop), 45); assert.ok(d.workshop.aiSections.includes('activity'));
  assert.equal((await h.section(req({ workshop: w, section: 'hack' }))).status, 400);
});
test('الخادم: أخطاء الذكاء الاصطناعي ترجع رموزًا مفهومة، وحدود المعدل والحجم تعمل', async () => {
  assert.equal((await H(fakeAI({ fail: 'timeout' })).ideas(req({}))).status, 504);
  assert.equal((await (await H(fakeAI({ fail: 'rate-limited' })).ideas(req({}))).json()).error, 'ai-rate-limited');
  const h = H(fakeAI(), { burstMax: 2 });
  assert.equal((await h.ideas(req({}))).status, 200); assert.equal((await h.ideas(req({}))).status, 200);
  assert.equal((await h.ideas(req({}))).status, 429);
  assert.equal((await H(fakeAI()).build(req({ idea: featured, pad: 'x'.repeat(70000) }))).status, 413);
});

// ====================================================================== عميل Gemini
test('Gemini: المفتاح في الترويسة، JSON، والانتقال لنموذج بديل عند عدم التوفر', async () => {
  const seen = [];
  const fetchImpl = async (url, opt) => {
    seen.push({ url, key: opt.headers['x-goog-api-key'], body: JSON.parse(opt.body) });
    if (url.includes('gemini-3.8-flash')) return new Response('{}', { status: 404 });
    return Response.json({ candidates: [{ content: { parts: [{ text: '```json\n{"ideas":[{"title":"س"}]}\n```' }] } }] });
  };
  const g = makeGemini({ apiKey: 'k-123', models: ['gemini-3.8-flash', 'gemini-2.5-flash'], fetchImpl });
  const r = await g.generateJSON({ system: 's', prompt: 'p' });
  assert.equal(r.model, 'gemini-2.5-flash'); assert.deepEqual(r.data, { ideas: [{ title: 'س' }] });
  assert.equal(seen[0].key, 'k-123'); assert.ok(!seen[0].url.includes('k-123'), 'المفتاح ليس في الرابط');
  assert.equal(seen[0].body.generationConfig.responseMimeType, 'application/json');
  await assert.rejects(makeGemini({ apiKey: '' }).generateJSON({ prompt: 'p' }), { code: 'not-configured' });
  let n = 0;
  await assert.rejects(makeGemini({ apiKey: 'k', models: ['a', 'b'], fetchImpl: async () => { n++; return new Response('', { status: 403 }); } }).generateJSON({ prompt: 'p' }), { code: 'auth' });
  assert.equal(n, 1, 'مفتاح مرفوض: لا محاولة لنموذج آخر');
  await assert.rejects(makeGemini({ apiKey: 'k', models: ['a'], timeoutMs: 30, fetchImpl: (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' })))) }).generateJSON({ prompt: 'p' }), { code: 'timeout' });
  assert.deepEqual(parseJSON('قبل {"a":1} بعد'), { a: 1 });
  assert.deepEqual(modelsFrom({ PD_WORKSHOPS_MODEL: 'x-model' }).slice(0, 2), ['x-model', 'gemini-3.8-flash']);
});

// ====================================================================== المخرجات
const sample = composeWorkshop(featured, { duration: 45, participants: 24, presenter: 'أ. حسين محمد سيد', school: 'مدرسة الإبداع', date: '15 نوفمبر 2026', venue: 'قاعة مصادر التعلم' });

test('النسخة النصية: العناوين والجدول والتوضيح بالمصدر', () => {
  const t = workshopToText(sample);
  for (const s of ['📘 من مستهلك', 'الجدول الزمني', '■ الأهداف التدريبية', '■ المحور الأول', '■ النشاط التطبيقي', 'بطاقة التغذية الراجعة', 'مكتبة الأفكار']) assert.ok(t.includes(s), s);
  assert.ok(!t.includes('undefined') && !t.includes('[object'));
  assert.equal(bidiNums('(1–4)'), '(1-4)');
});
test('وثائق الطباعة: الحقيبة فيها كل الأقسام المطلوبة، وكل النصوص مهرّبة', () => {
  const evil = normalizeWorkshop({ ...sample, title: '<script>alert(1)</script>' });
  for (const html of [kitHTML(evil), printableHTML(evil), inviteHTML(evil)]) { assert.ok(!html.includes('<script>alert')); assert.match(html, /dir="rtl"/); }
  const k = kitHTML(sample);
  for (const s of ['حقيبة تدريبية', 'بيانات البرنامج التدريبي', 'الهدف العام', 'الأهداف التفصيلية', 'الجدول الزمني', 'المحتوى التدريبي', 'ورقة عمل (1)', 'ورقة عمل (2)', 'أداة تقويم أثر المشغل', 'بطاقة التغذية الراجعة', 'المراجع والمصادر', 'ملاحظات وتوصيات المشاركين']) assert.ok(k.includes(s), s);
});

test('PowerPoint: حزمة سليمة، علاقات صحيحة، نصوص قابلة للتعديل RTL، وملاحظات لكل شريحة', async () => {
  const files = unzip(Buffer.from(await buildPptx(sample)));
  const slides = Object.keys(files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  assert.equal(slides.length, buildSlides(sample).length);
  assert.ok(slides.length >= 10 && slides.length <= 20);
  for (const [n, x] of Object.entries(files)) if (/\.(xml|rels)$/.test(n)) wellFormed(x, n);
  // كل هدف علاقة موجود فعلًا
  for (const [n, x] of Object.entries(files)) {
    if (!n.endsWith('.rels')) continue;
    const base = n.replace(/_rels\/[^/]*\.rels$/, '');
    for (const m of x.matchAll(/Target="([^"]+)"/g)) {
      if (/^https?:/.test(m[1])) continue;
      const t = path.posix.normalize(path.posix.join(base, m[1]));
      assert.ok(files[t], `${n} → ${t} مفقود`);
    }
  }
  const ct = files['[Content_Types].xml'];
  for (const n of Object.keys(files)) if (/^ppt\/.*\.xml$/.test(n)) assert.ok(ct.includes(`PartName="/${n}"`), `نوع المحتوى ${n}`);
  const s5 = files['ppt/slides/slide5.xml'];
  assert.match(s5, /rtl="1"/); assert.match(s5, /<a:t>/); assert.ok(!/<p:pic/.test(s5), 'نصوص لا صور');
  const all = slides.map((n) => files[n]).join('');
  for (const s of [sample.title, sample.objectives[0], sample.axes[1].title, sample.activity.steps[0], sample.discussion.questions[0]]) assert.ok(all.includes(s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')), `المحتوى: ${s}`);
  assert.match(files['ppt/notesSlides/notesSlide7.xml'], /<a:t>[^<]{20,}/, 'ملاحظات الميسّر');
  assert.match(files['ppt/presentation.xml'], /cx="12192000" cy="6858000"/);
});
test('PowerPoint: تقدير المساحة يصغّر الخط للنص الطويل ولا يتجاوز الحد الأدنى', () => {
  assert.equal(fitSize(['قصير'], 800, 100, 30, 12), 30);
  const long = 'نص طويل جدًا '.repeat(60);
  assert.ok(fitSize([long], 800, 200, 30, 12) < 20);
  assert.equal(fitSize([long.repeat(10)], 300, 50, 30, 12), 12);
});
test('PowerPoint: كل أفكار المكتبة تُصدَّر بلا أخطاء وبقيم مسافات صحيحة', async () => {
  for (const i of lib) {
    const files = unzip(Buffer.from(await buildPptx(composeWorkshop(i, { duration: i.duration }))));
    for (const [n, x] of Object.entries(files)) if (/slides\/slide\d+\.xml$/.test(n)) {
      wellFormed(x, `${i.id}/${n}`);
      for (const m of x.matchAll(/<a:(?:off|ext) (?:x|cx)="(-?\d+)" (?:y|cy)="(-?\d+)"/g)) assert.ok(Number.isInteger(+m[1]) && Number.isInteger(+m[2]));
      assert.ok(!/NaN|undefined/.test(x), `${i.id}/${n}`);
    }
  }
});
test('Word (الحقيبة): حزمة سليمة، A4، RTL، وأقسام الحقيبة كلها', async () => {
  const files = unzip(Buffer.from(await buildKitDocx(sample)));
  for (const [n, x] of Object.entries(files)) wellFormed(x, n);
  const doc = files['word/document.xml'];
  assert.match(doc, /<w:pgSz w:w="11906" w:h="16838"\/>/); assert.match(doc, /<w:bidiVisual\/>/);
  const plain = doc.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
  for (const s of ['حقيبة تدريبية', 'بيانات البرنامج التدريبي', 'الجدول الزمني', 'المحتوى التدريبي', 'ورقة عمل (1)', 'أداة تقويم أثر المشغل', 'بطاقة التغذية الراجعة', 'المراجع والمصادر', 'ملاحظات وتوصيات', sample.activity.steps[0]]) assert.ok(plain.includes(s), s);
  assert.match(doc, /<w:t xml:space="preserve">Prompt<\/w:t>/, 'الكلمات اللاتينية في مقطع مستقل بلا rtl');
  // ترتيب عناصر الفقرة حسب المخطط: bidi قبل spacing قبل jc
  for (const m of doc.matchAll(/<w:pPr>(.*?)<\/w:pPr>/g)) {
    const p = m[1]; const b = p.indexOf('<w:bidi'), s = p.indexOf('<w:spacing'), j = p.indexOf('<w:jc');
    assert.ok(b < s && (j < 0 || s < j), `ترتيب pPr: ${p.slice(0, 120)}`);
  }
  assert.match(files['word/footer1.xml'], /PAGE/);
});

const soffice = (() => { try { execFileSync('soffice', ['--version'], { stdio: 'ignore', timeout: 30000 }); return true; } catch { return false; } })();
test('LibreOffice يفتح الملفين ويحوّلهما إلى PDF (اختبار فتح حقيقي)', { skip: !soffice && 'LibreOffice غير متوفر' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-'));
  fs.writeFileSync(path.join(dir, 'w.pptx'), await buildPptx(sample));
  fs.writeFileSync(path.join(dir, 'k.docx'), await buildKitDocx(sample));
  execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', dir, path.join(dir, 'w.pptx'), path.join(dir, 'k.docx')], { timeout: 180000, stdio: 'ignore' });
  const pages = (f) => Number((execFileSync('pdfinfo', [path.join(dir, f)]).toString().match(/Pages:\s+(\d+)/) || [])[1]);
  assert.equal(pages('w.pdf'), buildSlides(sample).length);
  assert.ok(pages('k.pdf') >= 7, 'الحقيبة عدة صفحات');
});
