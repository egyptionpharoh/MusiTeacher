// اختبارات «مستشار المعلم في اللجان والامتحانات»: سلامة قاعدة المعرفة، ودقة البحث المحلي،
// والتمييز بين أنواع الامتحانات والأدوار، وعدم خلط المصادر، وعدم وجود أي استدعاء لذكاء اصطناعي أو شبكة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdvisor, FALLBACK } from '../src/modules/committee-advisor/core/engine.js';
import { normalizeArabic } from '../src/modules/committee-advisor/core/normalize.js';
import { ENTRIES, CATEGORIES } from '../src/modules/committee-advisor/data/knowledge.js';
import { SYNONYMS } from '../src/modules/committee-advisor/data/synonyms.js';
import { SUGGESTED, STARTERS } from '../src/modules/committee-advisor/data/suggestions.js';
import { DOCUMENTS, SOURCE_TYPES } from '../src/modules/committee-advisor/data/sources.js';

const A = createAdvisor({ entries: ENTRIES, synonyms: SYNONYMS });
const ask = (q, ctx = {}) => A.ask(q, ctx);
const MOD = fileURLToPath(new URL('../src/modules/committee-advisor/', import.meta.url));
const ROUTE = fileURLToPath(new URL('../src/app/dashboard/tools/committee-advisor/', import.meta.url));

test('قاعدة المعرفة: حقول صحيحة ومعرفات فريدة ومراجع موجودة', () => {
  const ids = new Set();
  const cats = new Set([...CATEGORIES.map((c) => c.id), 'about']);
  for (const e of ENTRIES) {
    assert.ok(!ids.has(e.id), `معرف مكرر ${e.id}`); ids.add(e.id);
    assert.ok(cats.has(e.cat), `${e.id}: تصنيف غير معروف`);
    assert.ok(e.q && e.q.length > 6, e.id);
    assert.ok(Array.isArray(e.exams) && e.exams.length, e.id);
    for (const x of e.exams) assert.ok(['all', 'transfer', 'certificate', 'diploma'].includes(x), `${e.id}: ${x}`);
    for (const x of e.roles) assert.ok(['all', 'invigilator', 'control', 'monitoring', 'other'].includes(x), `${e.id}: ${x}`);
    assert.ok(e.parts.length, e.id);
    for (const p of e.parts) {
      assert.ok(SOURCE_TYPES[p.src], `${e.id}: مصدر غير معروف ${p.src}`);
      assert.ok(p.text || (p.list && p.list.length), `${e.id}: جزء فارغ`);
      if (p.src === 'official') assert.ok(p.ref && DOCUMENTS[p.ref.doc] && p.ref.part, `${e.id}: معلومة رسمية بلا مرجع وثيقة`);
      else assert.ok(!p.ref, `${e.id}: مرجع وثيقة على جزء غير رسمي (${p.src}) — خلط مصادر`);
    }
  }
  for (const e of ENTRIES) for (const n of e.next || []) assert.ok(ids.has(n), `${e.id} → ${n}`);
  for (const list of [...Object.values(SUGGESTED), STARTERS]) for (const id of list) assert.ok(ids.has(id), id);
});

test('الخبرة الميدانية لا تُعرض كنص رسمي، ووصف الاجتماع مقصور على الدبلوم العام', () => {
  for (const e of ENTRIES) for (const p of e.parts.filter((x) => x.src === 'field')) {
    assert.ok(!/وفق اللائحة|ينص القرار|حسب القانون|تنص الوثيقة|تنص الورقة/.test(p.text || ''), e.id);
  }
  for (const e of ENTRIES.filter((x) => x.cat === 'meeting' && x.id !== 'meet-transfer-cert' && x.id !== 'meet-conflict')) {
    assert.deepEqual(e.exams, ['diploma'], e.id);
  }
  // البنود الرسمية المقتبسة موجودة فعلًا في نص الوثيقة المنقول
  const d1 = JSON.stringify(DOCUMENTS.D1);
  for (const w of ['بنصف ساعة', 'بثلث ساعة', 'مراقب الدور', 'الزائرة الصحية', 'محضر فتح المظاريف', 'المسئولية تضامنية']) assert.ok(d1.includes(w), w);
});

test('المعلم ليس محرر المحاضر: لا أسئلة عن كتابة محضر أو صياغة توصيات', () => {
  for (const e of ENTRIES) {
    const all = [e.q, ...(e.alts || [])].join(' | ');
    assert.ok(!/كيف (أكتب|اكتب|أحرر|احرر) محضر|كيف أصوغ|صياغة التوصيات/.test(all), e.id);
  }
  const r = ask('مين يكتب محضر المخالفة');
  assert.equal(r.type, 'answer'); assert.equal(r.entry.id, 'viol-who-writes');
});

test('الأسئلة المقترحة: الضغط يعطي إجابة (أو يسأل عن نوع الامتحان أولًا)', () => {
  for (const id of Object.values(SUGGESTED).flat()) {
    const e = A.entryById(id);
    const r0 = A.answerEntry(id, {});
    if (e.exams.includes('all')) assert.equal(r0.type, 'answer', id);
    else assert.equal(r0.type, 'need-exam', id);
    const ex = e.exams.includes('all') ? 'diploma' : e.exams[0];
    assert.equal(A.answerEntry(id, { exam: ex }).type, 'answer', id);
  }
});

test('البحث الحر: صياغات مختلفة (فصحى وعامية) تصل للإجابة الأقرب', () => {
  const cases = [
    ['ما دوري كمراقب لجنة؟', 'role-invigilator'],
    ['ايه مهام الملاحظ جوه القاعة', 'role-invigilator'],
    ['ابني بيمتحن في نفس المركز اعمل ايه', 'papers-relatives'],
    ['امتى احضر يوم الامتحان', 'examday-arrival'],
    ['هل أدخل الجوال معي للجنة', 'examday-prohibited'],
    ['ممكن اطلع من اللجنة', 'examday-leave'],
    ['طالب تعبان في اللجنة', 'examday-sick'],
    ['طالب بيغش', 'viol-observed'],
    ['ممكن اشرح السؤال لطالب', 'examday-explain'],
    ['الفرق بين المراقب والكنترول', 'role-diff'],
    ['التعليمات متناقضة', 'refer-conflict'],
    ['عندي ظرف طارئ ومش هقدر احضر', 'meet-conflict'],
    ['المظاريف امتى افتحها', 'examday-envelopes'],
    ['كم مكافأة المراقبة', 'na-pay'],
    ['هل الأداة رسمية', 'about-official'],
  ];
  for (const [q, id] of cases) {
    const r = ask(q, { exam: 'diploma' });
    assert.equal(r.type, 'answer', `${q} → ${r.type}`); assert.equal(r.entry.id, id, q);
  }
  const r = ask('ليه بيطلبوا استمارة بنكية', { exam: 'diploma' });
  assert.equal(r.entry.id, 'papers-bank');
});

test('لا إجابات مخترعة: الأسئلة خارج النطاق تعطي رسالة عدم التوفر النصية', () => {
  for (const q of ['ما عاصمة فرنسا', 'كيف أطبخ المكرونة', 'سعر الذهب اليوم', 'كيف أحل معادلة تربيعية']) {
    const r = ask(q, { exam: 'diploma' });
    assert.equal(r.type, 'unknown', q); assert.equal(r.text, FALLBACK);
  }
  assert.ok(FALLBACK.includes('رئيس اللجان (رئيس مركز الامتحانات) أو المراقب الأول'));
  assert.equal(ask('   ').type, 'clarify');
  const amb = ask('اجتماع');
  assert.equal(amb.type, 'choices'); assert.ok(amb.options.length >= 2);
});

test('التمييز بين أنواع الامتحانات', () => {
  // بلا سياق: يسأل عن نوع الامتحان قبل الإجابة على ما يخص الدبلوم
  const r1 = ask('ماذا يحدث في اجتماع المراقبين');
  assert.equal(r1.type, 'need-exam');
  // النقل/الشهادة: لا يعمم خبرة الدبلوم
  for (const exam of ['transfer', 'certificate']) {
    const r = A.answerEntry('meet-what', { exam });
    assert.equal(r.type, 'mismatch', exam); assert.match(r.text, /الدبلوم العام/); assert.match(r.text, /لا تتوفر لدي معلومات موثقة/);
    assert.equal(A.answerEntry('viol-types', { exam }).type, 'mismatch');
    assert.equal(A.answerEntry('meet-transfer-cert', { exam }).type, 'answer');
  }
  // عرض للاطلاع فقط مع تنبيه
  const f = A.answerEntry('meet-what', { exam: 'transfer' }, { force: true });
  assert.equal(f.type, 'answer'); assert.ok(f.notes.some((n) => n.includes('الدبلوم العام')));
  // «استفسار عام»: يجيب مع تنبيه بنوع الامتحان
  const g = A.answerEntry('meet-what', { exam: 'general' });
  assert.equal(g.type, 'answer'); assert.ok(g.notes.length);
  // ذكر نوع الامتحان في السؤال نفسه
  const t = ask('اجتماع امتحانات النقل');
  assert.equal(t.entry.id, 'meet-transfer-cert');
  assert.equal(ask('ماذا يحدث في اجتماع الدبلوم العام').entry.id, 'meet-what');
});

test('التمييز بين المراقب وعضو الكنترول', () => {
  const c = A.answerEntry('role-control', {});
  assert.equal(c.type, 'answer');
  assert.equal(c.entry.parts[0].src, 'none'); // لا مهام مخترعة لعضو الكنترول
  const inv = A.answerEntry('examday-arrival', { exam: 'diploma', role: 'invigilator' });
  assert.equal(inv.notes.length, 0);
  const ctl = A.answerEntry('examday-arrival', { exam: 'diploma', role: 'control' });
  assert.ok(ctl.notes.some((n) => n.includes('للملاحظين')));
  assert.equal(ask('ايه دور عضو الكنترول').entry.id, 'role-control');
});

test('الخصوصية: لا يطلب ولا يعالج أرقامًا شخصية', () => {
  assert.equal(ask('رقمي المدني 12345678 ماذا أفعل').type, 'private');
  assert.equal(ask('حسابي OM12 0001 2345').type, 'private');
  for (const e of ENTRIES) for (const p of e.parts) {
    const t = [p.text || '', ...(p.list || [])].join(' ');
    assert.ok(!/أرسل (لنا|لي) (رقمك|بياناتك)|اكتب رقمك المدني/.test(t), e.id);
  }
});

test('التطبيع العربي', () => {
  assert.equal(normalizeArabic('إِجْتِمَاعٌ'), 'اجتماع');
  assert.equal(normalizeArabic('مكافأة المراقبة'), 'مكافاه المراقبه');
  assert.equal(normalizeArabic('٢٠٢٦'), '2026');
});

function walk(dir) {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
}

test('الواجهة: لا مفاتيح ولا اتصال مباشر بـ Gemini، والاتصال الوحيد بخادم المنصة', () => {
  const client = [...walk(join(MOD, 'ui')), ...walk(join(MOD, 'core')), ...walk(join(MOD, 'data')), ...walk(ROUTE)].filter((f) => /\.(js|jsx|mjs|css)$/.test(f));
  assert.ok(client.length >= 10, String(client.length));
  for (const f of client) {
    const s = readFileSync(f, 'utf8');
    assert.ok(!/generativelanguage|googleapis|GoogleGenerativeAI|openai|api[_-]?key|AIza|process\.env/i.test(s), f);
    assert.ok(!/firebase|firestore|localStorage|XMLHttpRequest|WebSocket|sendBeacon/.test(s), f);
    if (f.endsWith('aiClient.js')) {
      assert.equal((s.match(/\bfetch\s*\(/g) || []).length, 1);
      assert.match(s, /endpoint = '\/api\/committee-advisor'/);
    } else assert.ok(!/\bfetch\s*\(/.test(s), f);
  }
  // الخادم: المفتاح من متغيرات البيئة فقط، ولا مفتاح مكتوب في الكود
  const route = readFileSync(fileURLToPath(new URL('../src/app/api/committee-advisor/route.js', import.meta.url)), 'utf8');
  const server = readFileSync(join(MOD, 'server', 'ai.js'), 'utf8');
  assert.match(route, /process\.env\.GEMINI_API_KEY/);
  for (const s of [route, server]) assert.ok(!/AIza[0-9A-Za-z_-]{10,}/.test(s));
  assert.ok(!/openai|anthropic/i.test(route + server));
});

test('الأسئلة المقترحة: لا يُقترح إلا ما له إجابة واضحة', () => {
  for (const id of [...Object.values(SUGGESTED).flat(), ...STARTERS]) {
    const e = A.entryById(id);
    assert.notEqual(e.suggest, false, id);
    assert.ok(!e.parts.some((p) => p.src === 'none'), `${id}: إجابة فيها «غير متوفر»`);
  }
  // الأسئلة ذات الصلة بعد أي إجابة لا تقود إلى سؤال بلا إجابة
  for (const e of ENTRIES) {
    const ex = e.exams.includes('all') ? 'diploma' : e.exams[0];
    const r = A.answerEntry(e.id, { exam: ex });
    for (const x of r.related || []) assert.notEqual(x.suggest, false, `${e.id} → ${x.id}`);
  }
  // الأسئلة الضعيفة تبقى قابلة للبحث وتُجاب بصدق
  assert.equal(ask('كم مكافأة المراقبة', { exam: 'diploma' }).entry.id, 'na-pay');
});

test('تحديد المجال: الأسئلة خارج اللجان والامتحانات لا تُرسل لأي خدمة', () => {
  for (const q of ['ما عاصمة فرنسا', 'كيف أطبخ المكرونة', 'سعر الذهب اليوم']) assert.equal(A.inDomain(q), false, q);
  for (const q of ['هل يجوز للمراقب الجلوس أثناء الامتحان', 'طالب نسي القلم في اللجنة', 'هل يمكن تبديل يوم المراقبة مع زميل']) assert.equal(A.inDomain(q), true, q);
});

// ───────────── خادم الاستعانة بـ Gemini (باعتماديات وهمية — بلا شبكة) ─────────────
const { makeAdvisorAIHandler, buildPrompt, cleanOutput, SYSTEM, AI_DISCLAIMER } = await import('../src/modules/committee-advisor/server/ai.js');
function fakeDeps(over = {}) {
  const calls = [];
  const deps = {
    ai: { configured: () => true, async generateJSON(a) { calls.push(a); return { data: { inScope: true, intro: 'جملة افتتاحية.', points: ['نقطة 1', 'نقطة 2'], refer: 'رئيس اللجان' }, model: 'x' }; } },
    verifyIdToken: async (t) => (t === 'good' ? { uid: 'u1' } : t === 'sus' ? { uid: 'u2' } : null),
    findUser: async (uid) => (uid === 'u2' ? { status: 'suspended' } : { status: 'active' }),
    log: () => {},
    ...over,
  };
  return { deps, calls };
}
const req = (body, token = 'good', headers = {}) => new Request('http://localhost/api/committee-advisor', { method: 'POST', headers: { 'content-type': 'application/json', host: 'localhost', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: JSON.stringify(body) });
const Q = { question: 'هل يجوز للمراقب الجلوس أثناء الامتحان', exam: 'diploma', role: 'invigilator' };

test('الخادم: يستدعي Gemini لسؤال من المجال، ويحفظ النتيجة فلا يكرر الاستدعاء', async () => {
  const { deps, calls } = fakeDeps(); const h = makeAdvisorAIHandler(deps);
  const r1 = await (await h(req(Q))).json();
  assert.equal(r1.ok, true); assert.equal(r1.answer.intro, 'جملة افتتاحية.'); assert.equal(r1.disclaimer, AI_DISCLAIMER);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].maxTokens <= 800 && calls[0].temperature <= 0.3);
  const r2 = await (await h(req(Q))).json();
  assert.equal(r2.cached, true); assert.equal(calls.length, 1);
});

test('الخادم: لا استدعاء خارج المجال أو مع بيانات شخصية أو بدون دخول', async () => {
  const { deps, calls } = fakeDeps(); const h = makeAdvisorAIHandler(deps);
  assert.equal((await (await h(req({ question: 'ما عاصمة فرنسا' }))).json()).outOfScope, true);
  assert.equal((await (await h(req({ question: 'رقمي 1234567890 هل أراقب غدًا' }))).json()).reason, 'private');
  assert.equal((await h(req(Q, null))).status, 401);
  assert.equal((await h(req(Q, 'bad'))).status, 401);
  assert.equal((await h(req(Q, 'sus'))).status, 403);
  assert.equal((await h(req(Q, 'good', { origin: 'https://evil.example' }))).status, 403);
  assert.equal(calls.length, 0);
});

test('الخادم: حدود الاستخدام وانتهاء الحصة تعطي ردًا وديًا بلا تفاصيل تقنية', async () => {
  const { deps } = fakeDeps({ limits: { perMinute: 2 } }); const h = makeAdvisorAIHandler(deps);
  for (let i = 0; i < 2; i++) assert.equal((await (await h(req({ ...Q, question: Q.question + ' ' + 'اليوم'.repeat(i + 1) }))).json()).ok, true);
  assert.equal((await (await h(req({ ...Q, question: 'طالب نسي القلم في اللجنة' }))).json()).reason, 'busy');
  const err = Object.assign(new Error('HTTP 429'), { code: 'rate-limited' });
  const { deps: d2 } = fakeDeps({ ai: { configured: () => true, generateJSON: async () => { throw err; } } });
  const r = await (await makeAdvisorAIHandler(d2)(req(Q))).json();
  assert.deepEqual(r, { ok: false, reason: 'quota' });
  const { deps: d3 } = fakeDeps({ ai: { configured: () => false } });
  assert.deepEqual(await (await makeAdvisorAIHandler(d3)(req(Q))).json(), { ok: false, reason: 'unavailable' });
  const { deps: d4 } = fakeDeps({ enabled: false });
  assert.equal((await (await makeAdvisorAIHandler(d4)(req(Q))).json()).reason, 'unavailable');
});

test('الخادم: التعليمات تمنع اختراع العقوبات والقرارات، والسياق الموثق يُرفق', () => {
  assert.match(SYSTEM, /ممنوع منعًا باتًا اختراع عقوبات/);
  assert.match(SYSTEM, /inScope=false/);
  const p = buildPrompt({ question: 'هل أستطيع الخروج من القاعة أثناء الامتحان', exam: 'diploma', role: 'invigilator' });
  assert.match(p, /امتحانات الدبلوم العام/); assert.match(p, /مراقب لجنة/);
  assert.match(p, /مهام وواجبات الملاحظين/);
  assert.equal(cleanOutput({ inScope: false }).inScope, false);
  assert.equal(cleanOutput({}), null);
  const c = cleanOutput({ intro: 'x'.repeat(900), points: Array(10).fill('p') });
  assert.equal(c.intro.length, 400); assert.equal(c.points.length, 6);
});
