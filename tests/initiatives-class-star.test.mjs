// مبادرة «نجم الحصة» + بطاقة التشجيع:  node --test tests/initiatives-class-star.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const base = new URL('../src/lib/initiatives/', import.meta.url).href;
test('مبادرة نجم الحصة: البيانات والعرض والتصدير وبطاقة التشجيع', async () => {
const { libraryInitiatives, filterInitiatives } = await import(base + 'catalog.js');
const { projectFromInitiative, normalizeProject } = await import(base + 'schema.js');
const H = await import(base + 'export-html.js');
const all = libraryInitiatives();
assert.ok(all.length >= 40, 'المكتبة 39 مبادرة سابقة + نجم الحصة');
assert.equal(new Set(all.map((i) => i.id)).size, all.length, 'المعرّفات فريدة');
const it = all.find((i) => i.id === 'class-star');
assert.ok(it && !it.brief, 'خطة كاملة');
assert.equal(it.domain, 'values');
assert.equal(it.phases.length, 3); assert.equal(it.phases[1].steps.length, 7);
assert.equal(it.boost.length, 7); assert.equal(it.card.title, 'نجم الحصة'); assert.equal(it.card.reasons.length, 6); assert.equal(it.card.tips.length, 5);
const txt = JSON.stringify(it);
for (const bad of [/(^|[^ت])حسين/, /الملك/, /طلحة/, /الأستاذ/, /من إعداد/, /المشرف/]) assert.ok(!bad.test(txt), `لا يحتوي: ${bad}`);
for (const k of ['summary', 'problem', 'goal', 'audience', 'join']) assert.ok(it[k], k);
// البحث والتصفية
assert.ok(filterInitiatives(all, { q: 'نجم الحصة' }).some((i) => i.id === 'class-star'));
assert.ok(filterInitiatives(all, { domain: 'values' }).some((i) => i.id === 'class-star'));
// تبنّي المبادرة → مبادراتي (الحقول الجديدة لا تضيع) وحفظ/استرجاع
const p = projectFromInitiative(it, { meta: { school: 'مدرستي' } });
assert.equal(p.plan.card.title, 'نجم الحصة'); assert.equal(p.plan.boost.length, 7);
const again = normalizeProject(JSON.parse(JSON.stringify(p)));
assert.deepEqual(again.plan.card, p.plan.card);
// المبادرات الأخرى بلا بطاقة: null وليس خطأ
const other = all.find((i) => i.id !== 'class-star');
assert.equal(other.card, null); assert.deepEqual(other.boost, []);
// ملف المبادرة يتضمن الأقسام الجديدة
const out = H.outline(p).map((s) => s.title);
assert.ok(out.includes('أساليب تعزيز الطلبة وتحفيزهم') && out.some((t) => t.startsWith('بطاقة التشجيع')), out.join(' | '));
const html = H.projectHTML(p);
assert.ok(html.includes('نجم الحصة') && !/(^|[^ت])حسين|الملك/.test(html));
// بطاقات الطباعة
const ch = H.cardHTML(p.plan, { school: 'مدرستي' });
assert.equal((ch.match(/class="card"/g) || []).length, 4);
for (const s of ['الطالب/ـة', 'الصف:', 'التاريخ:', 'سبب التكريم', 'المعلم/ـة', 'تقديرًا لجهدك', 'الإتقان', 'مدرستي', 'size:A4 landscape']) assert.ok(ch.includes(s), s);
const ch2 = H.cardHTML(other);
assert.ok(ch2.includes('بطاقة تميز وتشجيع'));
});
