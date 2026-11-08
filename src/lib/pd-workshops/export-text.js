// المخرجات النصية: نسخة نصية منظمة للنسخ، ونسخة HTML للنسخ المنسق والطباعة/PDF، والحقيبة التدريبية للطباعة.
import { agendaOf, totalMinutes, ordinal } from './schema.js';
import { DOMAIN, FORMATS, LEVELS, SPECS, STAGES, label } from './taxonomy.js';

/** نطاقات الأرقام: الشرطة القصيرة (–) محايدة في خوارزمية الاتجاه فتقلب (1–4) إلى (4–1) داخل النص العربي،
 *  أما الشرطة العادية (-) فتبقي الرقمين بترتيبهما. نوحّدها هنا لكل المخرجات. */
export const bidiNums = (s) => String(s == null ? '' : s).replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2');

export const BRAND = 'MusiTeacher — بوابة المعلم الذكية';
export const AI_NOTE = 'أُعدّ هذا المحتوى بمساعدة الذكاء الاصطناعي؛ راجعه وتحقق من ملاءمته قبل التقديم.';
export const LIB_NOTE = 'المحتوى من مكتبة الأفكار المنتقاة في MusiTeacher، ويمكن تكييفه حسب واقع المدرسة.';

export const sourceNote = (w) => (w.source === 'library' ? LIB_NOTE : AI_NOTE);
const mins = (n) => (n === 1 ? 'دقيقة واحدة' : n === 2 ? 'دقيقتان' : n >= 3 && n <= 10 ? `${n} دقائق` : `${n} دقيقة`);
export { mins as minutesLabel };

/** بيانات البرنامج (تُستخدم في كل المخرجات). */
export function programFacts(w) {
  const s = w.settings;
  return [
    ['المجال', (DOMAIN[w.domain] || {}).label || ''],
    ['الفئة المستهدفة', w.audienceText],
    ['المدة', mins(totalMinutes(w) || s.duration)],
    ['عدد المشاركين', s.participants ? `${s.participants} مشاركًا تقريبًا` : ''],
    ['التخصص', label(SPECS, s.spec, '')],
    ['المرحلة', label(STAGES, s.stage, '')],
    ['طبيعة المشغل', label(FORMATS, w.format)],
    ['المستوى', label(LEVELS, w.level)],
    ['مقدّم المشغل', s.presenter],
    ['المدرسة', s.school],
    ['التاريخ', s.date],
    ['المكان', s.venue],
  ].filter(([, v]) => v);
}

/** المخطط المنطقي للمشغل (أقسام بعناوين وفقرات وقوائم) — مصدر واحد للنص وHTML. */
export function outline(w) {
  const S = [];
  const sec = (title, minutes, body) => S.push({ title, minutes, body: body.filter((b) => b && (b.text || (b.items && b.items.length))) });
  const p = (text, lead) => (text ? { text, lead } : null);
  const ul = (items, lead) => ({ items: items || [], lead });
  const ol = (items, lead) => ({ items: items || [], ordered: true, lead });

  sec('التعريف بالمشغل', 0, [p(w.summary), p(w.importance, 'أهميته'), p(w.goal, 'الهدف العام')]);
  sec('الأهداف التدريبية', 0, [p('يُتوقع في نهاية المشغل أن:'), ol(w.objectives)]);
  sec('الافتتاح', w.opening.minutes, [p(w.opening.welcome), ul(w.opening.agreements, 'اتفاقيات المشغل')]);
  sec(w.hook.title ? `النشاط التمهيدي: ${w.hook.title}` : 'النشاط التمهيدي', w.hook.minutes, [p(w.hook.purpose, 'الغرض'), ol(w.hook.steps)]);
  w.axes.forEach((a, i) => sec(`المحور ${ordinal(i + 1)}: ${a.title}`, a.minutes, [p(a.explain), ul(a.points), p(a.example, 'مثال من الواقع المدرسي')]));
  sec(w.activity.title ? `النشاط التطبيقي: ${w.activity.title}` : 'النشاط التطبيقي', w.activity.minutes,
    [p(w.activity.grouping, 'التنظيم'), ol(w.activity.steps, 'الخطوات'), p(w.activity.output, 'المنتج المتوقع'), ul(w.activity.tips, 'ملاحظات للميسّر')]);
  sec('أسئلة النقاش وتبادل الخبرات', w.discussion.minutes, [ul(w.discussion.questions)]);
  sec('الخاتمة والتوصيات', w.closing.minutes, [p(w.closing.takeaway, 'الفكرة الرئيسة'), ul(w.closing.recs, 'التوصيات')]);
  sec('التقويم والتغذية الراجعة', w.evaluation.minutes, [p(w.evaluation.method, 'طريقة قياس الأثر'), ul(w.evaluation.items, 'بنود التقويم'), ol(w.evaluation.feedback, 'بطاقة التغذية الراجعة')]);
  sec('المواد والأدوات', 0, [ul(w.materials)]);
  sec('أساليب التدريب', 0, [ul(w.strategies)]);
  sec('النتائج المتوقعة', 0, [ul(w.outcomes)]);
  if (w.notes) sec('ملاحظات للميسّر', 0, [p(w.notes)]);
  if (w.refs.length) sec('مراجع للاستزادة', 0, [ul(w.refs)]);
  return S.filter((s) => s.body.length);
}

/** نص منظم للنسخ واللصق (واتساب، بريد، مستند). */
export function workshopToText(w) {
  const L = [];
  L.push(`📘 ${w.title}`);
  if (w.tagline) L.push(w.tagline);
  L.push('');
  for (const [k, v] of programFacts(w)) L.push(`${k}: ${v}`);
  L.push('', '— الجدول الزمني —');
  for (const r of agendaOf(w)) L.push(`• ${r.title} (${mins(r.minutes)})`);
  for (const s of outline(w)) {
    L.push('', `■ ${s.title}${s.minutes ? ` — ${mins(s.minutes)}` : ''}`);
    for (const b of s.body) {
      if (b.text) L.push(b.lead ? `${b.lead}: ${b.text}` : b.text);
      else {
        if (b.lead) L.push(`${b.lead}:`);
        b.items.forEach((it, i) => L.push(b.ordered ? `${i + 1}. ${it}` : `- ${it}`));
      }
    }
  }
  L.push('', `— ${sourceNote(w)}`, `— ${BRAND}`);
  return L.join('\n');
}

export const esc = (s) => bidiNums(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function bodyHTML(b) {
  if (b.text) return `<p>${b.lead ? `<strong>${esc(b.lead)}:</strong> ` : ''}${esc(b.text)}</p>`;
  const tag = b.ordered ? 'ol' : 'ul';
  return `${b.lead ? `<p class="lead">${esc(b.lead)}:</p>` : ''}<${tag}>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</${tag}>`;
}

/** جزء HTML للمحتوى (للنسخ المنسّق إلى Word/Docs). */
export function workshopToHTMLFragment(w) {
  const facts = programFacts(w).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  const agenda = agendaOf(w).map((r) => `<tr><td>${esc(r.title)}</td><td class="n">${esc(mins(r.minutes))}</td></tr>`).join('');
  const secs = outline(w).map((s) => `<section><h2>${esc(s.title)}${s.minutes ? ` <small>${esc(mins(s.minutes))}</small>` : ''}</h2>${s.body.map(bodyHTML).join('')}</section>`).join('');
  return `<h1>${esc(w.title)}</h1>${w.tagline ? `<p class="tag">${esc(w.tagline)}</p>` : ''}
<table class="facts">${facts}</table>
<h2>الجدول الزمني</h2><table class="agenda"><thead><tr><th>الفقرة</th><th>الزمن</th></tr></thead><tbody>${agenda}</tbody></table>
${secs}<p class="note">${esc(sourceNote(w))}</p>`;
}

const PRINT_CSS = `
@page{size:A4;margin:16mm 15mm 18mm}
*{box-sizing:border-box}
body{font-family:"Segoe UI",Tahoma,"Noto Naskh Arabic","Noto Sans Arabic",Arial,sans-serif;color:#1f2433;line-height:1.75;font-size:12.5pt;margin:0;background:#fff;direction:rtl}
h1{font-size:22pt;color:#14365f;margin:0 0 4mm;line-height:1.35}
h2{font-size:14.5pt;color:#14365f;border-bottom:1.5px solid #c9d6ea;padding-bottom:1.5mm;margin:7mm 0 3mm;break-after:avoid}
h2 small{font-size:10pt;color:#6b7280;font-weight:600;margin-inline-start:6px}
h3{font-size:12.5pt;color:#24527f;margin:5mm 0 2mm}
p{margin:0 0 2.5mm}.tag{color:#4b5563;font-size:13pt}.lead{font-weight:700;margin-top:2mm}
ul,ol{margin:0 0 3mm;padding-inline-start:7mm}li{margin-bottom:1.2mm}
table{border-collapse:collapse;width:100%;margin:2mm 0 4mm;font-size:11.5pt}
th,td{border:1px solid #cfd8e6;padding:2mm 3mm;text-align:start;vertical-align:top}
.facts th{background:#f1f5fb;width:32%;color:#14365f}
.agenda thead th{background:#14365f;color:#fff}.agenda .n{width:24%;white-space:nowrap}
section{break-inside:auto}
.note{margin-top:8mm;font-size:10pt;color:#6b7280;border-top:1px dashed #cbd5e1;padding-top:2mm}
.page{break-after:page}
.cover{height:257mm;display:flex;flex-direction:column;justify-content:space-between;border:2.5px solid #14365f;padding:16mm 14mm;position:relative}
.cover .kind{font-size:13pt;color:#24527f;font-weight:700;letter-spacing:.5px}
.cover h1{font-size:28pt;margin-top:8mm}
.cover .band{height:6mm;background:linear-gradient(90deg,#14365f,#2f7fc1,#7cc4b8);border-radius:3mm}
.cover dl{display:grid;grid-template-columns:auto 1fr;gap:2mm 6mm;font-size:12.5pt;margin:0}
.cover dt{color:#6b7280}.cover dd{margin:0;font-weight:600}
.cover .brand{font-size:10pt;color:#6b7280;text-align:center}
.box{border:1.5px solid #cfd8e6;border-radius:3mm;padding:4mm 5mm;margin:3mm 0 5mm}
.lines div{border-bottom:1px solid #cfd8e6;height:9mm}
.scale{display:flex;gap:4mm;justify-content:flex-start}.scale span{border:1px solid #94a3b8;border-radius:50%;width:8mm;height:8mm;display:inline-flex;align-items:center;justify-content:center;font-size:10pt}
.ws-head{display:flex;justify-content:space-between;border-bottom:1px solid #cfd8e6;padding-bottom:2mm;margin-bottom:4mm;font-size:11pt;color:#4b5563}
@media screen{body{background:#eef1f6}.sheet{background:#fff;max-width:210mm;margin:8mm auto;padding:16mm 15mm;box-shadow:0 2px 12px rgba(0,0,0,.08)}}
@media print{.sheet{padding:0}.noprint{display:none}}
`;

const doc = (title, inner) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body><div class="sheet">${inner}</div></body></html>`;

/** وثيقة الطباعة (المشغل كاملًا). */
export function printableHTML(w) {
  return doc(w.title, `${workshopToHTMLFragment(w)}<p class="note">${esc(BRAND)}</p>`);
}

const lines = (n) => `<div class="lines">${'<div></div>'.repeat(n)}</div>`;

/** الحقيبة التدريبية للطباعة: غلاف، بيانات، وصف وأهداف، جدول، محتوى، أوراق عمل، تقويم، مراجع، ملاحظات. */
export function kitHTML(w) {
  const facts = programFacts(w);
  const cover = `<div class="cover page"><div><div class="band"></div><p class="kind" style="margin-top:8mm">حقيبة تدريبية — برنامج إنماء مهني</p><h1>${esc(w.title)}</h1>${w.tagline ? `<p class="tag">${esc(w.tagline)}</p>` : ''}</div>
<dl>${facts.filter(([k]) => ['المجال', 'الفئة المستهدفة', 'المدة', 'مقدّم المشغل', 'المدرسة', 'التاريخ'].includes(k)).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
<div><div class="band" style="opacity:.35"></div><p class="brand">${esc(BRAND)}</p></div></div>`;
  const out = outline(w);
  const pick = (prefixes) => out.filter((s) => prefixes.some((p) => s.title.startsWith(p)));
  const secHTML = (s) => `<section><h3>${esc(s.title)}${s.minutes ? ` <small>(${esc(mins(s.minutes))})</small>` : ''}</h3>${s.body.map(bodyHTML).join('')}</section>`;
  const agenda = agendaOf(w).map((r, i) => `<tr><td class="n">${i + 1}</td><td>${esc(r.title)}</td><td class="n">${esc(mins(r.minutes))}</td><td class="n">${esc(`${r.from}–${r.to}`)}</td></tr>`).join('');

  const p1 = `<div class="page"><h2>بيانات البرنامج التدريبي</h2><table class="facts">${facts.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
<h2>وصف البرنامج</h2>${w.summary ? `<p>${esc(w.summary)}</p>` : ''}${w.importance ? `<p><strong>أهميته:</strong> ${esc(w.importance)}</p>` : ''}
<h2>الهدف العام</h2><p>${esc(w.goal)}</p><h2>الأهداف التفصيلية</h2><ol>${w.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ol>
${w.materials.length ? `<h2>المواد والأدوات</h2><ul>${w.materials.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
${w.strategies.length ? `<h2>أساليب التدريب</h2><ul>${w.strategies.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}</div>`;
  const p2 = `<div class="page"><h2>الجدول الزمني</h2><table class="agenda"><thead><tr><th>م</th><th>الفقرة</th><th>الزمن</th><th>الدقيقة</th></tr></thead><tbody>${agenda}</tbody></table>
<h2>المحتوى التدريبي</h2>${pick(['الافتتاح', 'النشاط التمهيدي', 'المحور', 'الخاتمة']).map(secHTML).join('')}</div>`;
  const ws = `<div class="page"><div class="ws-head"><span>ورقة عمل (1)</span><span>الاسم/المجموعة: ....................</span></div>
<h2>${esc(w.activity.title || 'النشاط التطبيقي')}</h2>${w.activity.grouping ? `<p><strong>التنظيم:</strong> ${esc(w.activity.grouping)}</p>` : ''}
<ol>${w.activity.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>${w.activity.output ? `<div class="box"><strong>المنتج المطلوب:</strong> ${esc(w.activity.output)}</div>` : ''}
<h3>مساحة العمل</h3>${lines(10)}</div>
${w.discussion.questions.length ? `<div class="page"><div class="ws-head"><span>ورقة عمل (2)</span><span>الاسم/المجموعة: ....................</span></div><h2>أسئلة النقاش وتبادل الخبرات</h2>
${w.discussion.questions.map((q, i) => `<div class="box"><strong>${i + 1}. ${esc(q)}</strong>${lines(3)}</div>`).join('')}</div>` : ''}`;
  const evalPage = `<div class="page"><h2>أداة تقويم أثر المشغل</h2>${w.evaluation.method ? `<p><strong>الطريقة:</strong> ${esc(w.evaluation.method)}</p>` : ''}
<table><thead><tr><th>البند</th><th style="width:30%">الاستجابة</th></tr></thead><tbody>${w.evaluation.items.map((i) => `<tr><td>${esc(i)}</td><td></td></tr>`).join('')}</tbody></table>
<h2>بطاقة التغذية الراجعة</h2>${w.evaluation.feedback.map((q, i) => `<div class="box"><strong>${i + 1}. ${esc(q)}</strong>${/1 إلى 5|من 1/.test(q) ? '<div class="scale" style="margin-top:3mm"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>' : lines(2)}</div>`).join('')}</div>`;
  const last = `<div><h2>التوصيات والنتائج المتوقعة</h2>${w.closing.recs.length ? `<ul>${w.closing.recs.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}${w.outcomes.length ? `<h3>النتائج المتوقعة</h3><ul>${w.outcomes.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
${w.refs.length ? `<h2>المراجع والمصادر</h2><ul>${w.refs.map((o) => `<li dir="auto">${esc(o)}</li>`).join('')}</ul>` : ''}
<h2>ملاحظات وتوصيات المشاركين</h2>${lines(8)}<p class="note">${esc(sourceNote(w))} — ${esc(BRAND)}</p></div>`;
  return doc(`حقيبة تدريبية — ${w.title}`, cover + p1 + p2 + ws + evalPage + last);
}

/** بطاقة دعوة لحضور المشغل (صفحة واحدة للطباعة أو للمشاركة كصورة). */
export function inviteHTML(w) {
  const s = w.settings;
  const rows = [['الموعد', s.date], ['المكان', s.venue], ['المدة', mins(totalMinutes(w) || s.duration)], ['يقدّمه', s.presenter]].filter(([, v]) => v);
  return doc(`دعوة — ${w.title}`, `<div style="border:2.5px solid #14365f;border-radius:6mm;padding:14mm;text-align:center">
<div class="band" style="height:5mm;background:linear-gradient(90deg,#14365f,#2f7fc1,#7cc4b8);border-radius:3mm"></div>
<p style="font-size:13pt;color:#24527f;font-weight:700;margin-top:8mm">دعوة لحضور مشغل إنماء مهني</p>
<h1 style="font-size:24pt">${esc(w.title)}</h1>${w.tagline ? `<p class="tag">${esc(w.tagline)}</p>` : ''}
<p style="margin:6mm auto;max-width:150mm">${esc(w.goal)}</p>
<table class="facts" style="max-width:140mm;margin:6mm auto">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
${s.school ? `<p>${esc(s.school)}</p>` : ''}<p class="brand" style="font-size:10pt;color:#6b7280;margin-top:10mm">${esc(BRAND)}</p></div>`);
}
