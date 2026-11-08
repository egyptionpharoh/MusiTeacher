// مخرجات المبادرة النصية: ملف المبادرة للطباعة/PDF، بطاقة الإعلان، استبانة قياس الأثر، والنسخة النصية للنسخ.
import { DOMAIN, LEADS, COSTS, SIZES, STAGES, STATUSES, label, weeksLabel } from './taxonomy.js';
import { timelineOf, surveyOf, fmtDate, progressOf } from './schema.js';

export const BRAND = 'MusiTeacher — بوابة المعلم الذكية';
export const COST_SHORT = { free: 'بلا تكلفة', low: 'منخفضة', partner: 'تحتاج دعمًا/شراكة' };
export const ORIGIN_NOTE = {
  library: 'المبادرة مبنية على مكتبة المبادرات المنتقاة في MusiTeacher، ويمكن تكييفها حسب واقع المدرسة.',
  ai: 'أُعدّت المبادرة بمساعدة الذكاء الاصطناعي؛ راجعها وتحقق من ملاءمتها لمدرستك قبل اعتمادها.',
  mixed: 'المبادرة من مكتبة MusiTeacher وطُوّرت بمساعدة الذكاء الاصطناعي؛ راجعها قبل اعتمادها.',
  manual: 'مبادرة أعدها المعلم.',
};
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** بيانات التعريف (الغلاف والجداول). */
export function factsOf(p) {
  const pl = p.plan, m = p.meta;
  return [
    ['المجال', `${(DOMAIN[pl.domain] || {}).label || ''}${pl.topic ? ` — ${pl.topic}` : ''}`],
    ['المدرسة', m.school], ['مقدم المبادرة / الفريق', m.presenter], ['العام الدراسي', m.year],
    ['الفئة المستهدفة', pl.audience], ['المستفيدون المتوقعون', pl.beneficiaries],
    ['القيادة', label(LEADS, pl.lead)], ['الحجم', label(SIZES, pl.size)], ['المراحل الدراسية', pl.stages.map((s) => label(STAGES, s)).join('، ')],
    ['مدة التنفيذ', `${weeksLabel(pl.weeks)}${m.startDate ? ` — تبدأ ${fmtDate(m.startDate)}` : ''}`],
    ['الموارد', label(COSTS, pl.cost)],
  ].filter(([, v]) => v);
}

/** الأقسام المنطقية لملف المبادرة (مصدر واحد للنص وHTML). */
export function outline(p) {
  const pl = p.plan;
  const tl = timelineOf(pl.phases, p.meta.startDate);
  const S = [];
  const add = (part, title, blocks) => { const b = blocks.filter((x) => x && (x.text || (x.items && x.items.length) || (x.rows && x.rows.length))); if (b.length) S.push({ part, title, blocks: b }); };
  const P = (text, lead) => (text ? { text, lead } : null);
  const U = (items, lead) => ({ items: items || [], lead });
  const O = (items, lead) => ({ items: items || [], ordered: true, lead });
  const T = (head, rows, widths) => ({ head, rows, widths });

  add('ب', 'الخلفية والمبررات', [P(pl.summary, 'خلفية المبادرة'), P(pl.problem, 'المشكلة أو الاحتياج'), U(pl.rationale, 'مبررات المبادرة')]);
  add('ب', 'الأهداف', [P(pl.goal, 'الهدف العام'), O(pl.objectives, 'الأهداف التفصيلية')]);
  add('ب', 'الفئة المستهدفة', [P(pl.audience), P(pl.beneficiaries, 'المستفيدون المتوقعون')]);
  add('ج', 'مراحل التنفيذ والأنشطة', pl.phases.map((ph, i) => ({ items: ph.steps, ordered: true, lead: `المرحلة ${i + 1}: ${ph.t} (${weeksLabel(ph.w)}${ph.by ? ` — ${ph.by}` : ''})` })));
  add('ج', 'الجدول الزمني', [T(['المرحلة', 'المدة', 'الفترة', 'المسؤول'], tl.map((r) => [r.title, weeksLabel(r.weeks), r.from ? `${fmtDate(r.from)} - ${fmtDate(r.to)}` : `الأسبوع ${r.fromWeek}${r.toWeek > r.fromWeek ? ` - ${r.toWeek}` : ''}`, r.by]), [32, 14, 34, 20])]);
  add('ج', 'فريق العمل والمسؤوليات', [T(['الدور', 'الاسم', 'المهام'], pl.team.map((t) => [t.r, t.name || '', t.tasks]), [30, 22, 48])]);
  add('ج', 'الموارد المطلوبة', [T(['المورد', 'التكلفة', 'البديل البسيط'], pl.resources.map((r) => [r.i, COST_SHORT[r.c] || '', r.alt || '—']), [44, 16, 40])]);
  add('ج', 'الشركاء المحتملون', [U(pl.partners), pl.partners.length ? P('الشراكات مقترحة وتتطلب التنسيق المسبق وموافقة إدارة المدرسة قبل الإعلان عنها.') : null]);
  add('ج', 'الموافقات والمتطلبات قبل التنفيذ', [U(pl.approvals)]);
  add('د', 'مؤشرات الأداء وأدوات القياس', [T(['المؤشر', 'أداة القياس', 'القياس القبلي', 'المستهدف', 'النتيجة'], pl.kpis.map((k) => [k.k, k.tool, k.base || '', k.target || '', k.result || '']), [32, 24, 14, 14, 16]),
    P('تُحدَّد القيم المستهدفة بعد القياس القبلي وبما يناسب واقع المدرسة.')]);
  add('د', 'أساليب التقييم', [U(pl.evaluation)]);
  add('د', 'آلية توثيق التنفيذ', [U(['سجل إنجاز يدوَّن فيه تاريخ كل نشاط وما تم فيه وملاحظاته ونتائجه.', 'صور ومرفقات للأنشطة (وفق ضوابط تصوير الطلبة في المدرسة).', 'قائمة متابعة بمهام كل مرحلة تُعلَّم عند إنجازها.', 'تقرير ختامي يقارن القياس القبلي بالبعدي.'])]);
  if (p.log.length) add('د', 'سجل الإنجاز', [T(['التاريخ', 'النشاط', 'الملاحظات', 'النتائج'], p.log.map((e) => [e.date ? fmtDate(e.date) : '', e.activity, e.notes, e.results]), [16, 26, 32, 26])]);
  if (p.tasks.length && p.status !== 'idea') { const g = progressOf(p); add('د', 'تقدم التنفيذ', [P(`أُنجز ${g.done} من ${g.total} مهمة (${g.pct}%).`)]); }
  if (p.results.summary || p.results.lessons) add('د', 'نتائج المبادرة', [P(p.results.summary, 'النتائج'), P(p.results.lessons, 'الدروس المستفادة')]);
  add('هـ', 'المخرجات المتوقعة', [U(pl.outputs)]);
  add('هـ', 'الاستدامة والتطوير والتعميم', [U(pl.sustain)]);
  if (p.notes) add('هـ', 'ملاحظات', [P(p.notes)]);
  return S;
}

export const PARTS = { 'ب': 'التعريف بالمبادرة', 'ج': 'خطة التنفيذ', 'د': 'المتابعة والتقييم', 'هـ': 'الاستدامة' };

/** نسخة نصية منظمة للنسخ. */
export function projectToText(p) {
  const L = [`🌟 ${p.plan.title}`]; if (p.plan.slogan) L.push(p.plan.slogan);
  L.push(''); for (const [k, v] of factsOf(p)) L.push(`${k}: ${v}`);
  let part = '';
  for (const s of outline(p)) {
    if (s.part !== part) { part = s.part; L.push('', `══ ${part}. ${PARTS[part]} ══`); }
    L.push('', `■ ${s.title}`);
    for (const b of s.blocks) {
      if (b.text) L.push(b.lead ? `${b.lead}: ${b.text}` : b.text);
      else if (b.rows) { L.push(b.head.join(' | ')); b.rows.forEach((r) => L.push(r.map((c) => c || '—').join(' | '))); }
      else { if (b.lead) L.push(`${b.lead}:`); b.items.forEach((it, i) => L.push(b.ordered ? `${i + 1}. ${it}` : `- ${it}`)); }
    }
  }
  L.push('', `— ${ORIGIN_NOTE[p.origin] || ORIGIN_NOTE.library}`, `— ${BRAND}`);
  return L.join('\n');
}

// ------------------------------------------------------------------ HTML
const CSS = `
@page{size:A4;margin:15mm 15mm 17mm}
*{box-sizing:border-box}
body{font-family:"Segoe UI",Tahoma,"Noto Naskh Arabic","Noto Sans Arabic",Arial,sans-serif;color:#1f2433;line-height:1.75;font-size:12pt;margin:0;background:#fff;direction:rtl}
h1{font-size:24pt;color:#7a3e00;margin:0 0 3mm;line-height:1.35}
h2{font-size:15pt;color:#7a3e00;margin:7mm 0 2mm;padding:1.5mm 3mm;background:#fff4e0;border-inline-start:4px solid #e08a00;border-radius:2mm;break-after:avoid}
h3{font-size:12.5pt;color:#3d2a12;margin:5mm 0 2mm;border-bottom:1px solid #f0d9b5;padding-bottom:1mm;break-after:avoid}
p{margin:0 0 2.5mm}.lead{font-weight:700;margin:2mm 0 1mm}
ul,ol{margin:0 0 3mm;padding-inline-start:7mm}li{margin-bottom:1mm}
table{border-collapse:collapse;width:100%;margin:1mm 0 4mm;font-size:10.8pt;break-inside:auto}
th,td{border:1px solid #e3cfae;padding:1.6mm 2.4mm;text-align:start;vertical-align:top}
thead th{background:#7a3e00;color:#fff}
tr{break-inside:avoid}
.facts th{background:#fff4e0;color:#7a3e00;width:32%}
.note{margin-top:7mm;font-size:9.5pt;color:#6b7280;border-top:1px dashed #d6c3a5;padding-top:2mm}
.page{break-after:page}
.cover{min-height:255mm;display:flex;flex-direction:column;justify-content:space-between;border:2.5px solid #b45309;border-radius:4mm;padding:14mm 13mm;text-align:center}
.cover .kind{font-size:13pt;color:#b45309;font-weight:800;letter-spacing:.5px}
.cover h1{font-size:30pt;margin:6mm 0 3mm}
.cover .slogan{font-size:14pt;color:#5b4630}
.cover .band{height:6mm;border-radius:3mm;background:linear-gradient(90deg,#fde047,#f59e0b,#ea580c)}
.cover table{text-align:start;max-width:150mm;margin:0 auto}
.cover img{max-height:30mm;max-width:60mm;object-fit:contain;margin:0 auto 4mm;display:block}
.brand{font-size:9.5pt;color:#6b7280}
.scale td,.scale th{text-align:center}
.lines div{border-bottom:1px solid #e3cfae;height:9mm}
.check{width:9mm;text-align:center;font-size:13pt}
@media screen{body{background:#f3efe8}.sheet{background:#fff;max-width:210mm;margin:8mm auto;padding:15mm;box-shadow:0 2px 12px rgba(0,0,0,.08)}}
@media print{.sheet{padding:0}}
`;
const doc = (title, inner, extraCss = '') => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}${extraCss}</style></head><body><div class="sheet">${inner}</div></body></html>`;

function blockHTML(b) {
  if (b.text) return `<p>${b.lead ? `<strong>${esc(b.lead)}:</strong> ` : ''}${esc(b.text)}</p>`;
  if (b.rows) {
    const cols = b.widths ? `<colgroup>${b.widths.map((w) => `<col style="width:${w}%">`).join('')}</colgroup>` : '';
    return `<table>${cols}<thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  const tag = b.ordered ? 'ol' : 'ul';
  return `${b.lead ? `<p class="lead">${esc(b.lead)}</p>` : ''}<${tag}>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</${tag}>`;
}

export function surveyHTMLFragment(p) {
  const s = surveyOf(p.plan);
  return `<h3>${esc(s.title)}</h3><p>${esc(s.intro)}</p>
<table class="scale"><thead><tr><th style="text-align:start">البند</th>${s.scale.map((x) => `<th style="width:${Math.round(44 / s.scale.length)}%">${esc(x)}</th>`).join('')}</tr></thead>
<tbody>${s.items.map((i) => `<tr><td style="text-align:start">${esc(i)}</td>${s.scale.map(() => '<td>◯</td>').join('')}</tr>`).join('')}</tbody></table>
${s.open.map((q) => `<p class="lead">${esc(q)}</p><div class="lines"><div></div><div></div></div>`).join('')}`;
}

/** ملف المبادرة الكامل للطباعة / PDF. */
export function projectHTML(p) {
  const pl = p.plan, m = p.meta;
  const cover = `<div class="cover page"><div><div class="band"></div>${m.logo ? `<img src="${m.logo}" alt="شعار المدرسة" style="margin-top:8mm">` : '<div style="height:10mm"></div>'}
<p class="kind">ملف مبادرة ${m.school ? `— ${esc(m.school)}` : 'مدرسية'}</p><h1>${esc(pl.title)}</h1>${pl.slogan ? `<p class="slogan">${esc(pl.slogan)}</p>` : ''}</div>
<table class="facts">${factsOf(p).filter(([k]) => ['المدرسة', 'مقدم المبادرة / الفريق', 'العام الدراسي', 'المجال', 'مدة التنفيذ', 'الفئة المستهدفة'].includes(k)).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
<div><div class="band" style="opacity:.4"></div><p class="brand" style="margin-top:3mm">${esc(BRAND)}</p></div></div>`;
  let part = ''; let body = '';
  for (const s of outline(p)) {
    if (s.part !== part) { part = s.part; body += `<h2>${esc(part)}. ${esc(PARTS[part])}</h2>`; }
    body += `<section><h3>${esc(s.title)}</h3>${s.blocks.map(blockHTML).join('')}</section>`;
  }
  const checklist = p.tasks.length ? `<div class="page"></div><h2>ملحق (1): قائمة متابعة التنفيذ</h2><table><thead><tr><th class="check">✓</th><th>المهمة</th><th style="width:28%">المرحلة</th></tr></thead><tbody>${p.tasks.map((t) => `<tr><td class="check">${t.done ? '☑' : '☐'}</td><td>${esc(t.text)}</td><td>${esc((pl.phases[t.phase] || {}).t || 'مهام إضافية')}</td></tr>`).join('')}</tbody></table>` : '';
  const survey = `<div class="page"></div><h2>ملحق (2): نموذج قياس الأثر</h2>${surveyHTMLFragment(p)}`;
  const logTpl = `<h2>ملحق (3): سجل التوثيق</h2><table><thead><tr><th style="width:16%">التاريخ</th><th style="width:28%">النشاط</th><th>الملاحظات والنتائج</th></tr></thead><tbody>${'<tr><td style="height:12mm"></td><td></td><td></td></tr>'.repeat(8)}</tbody></table>`;
  return doc(`ملف مبادرة — ${pl.title}`, `${cover}<h3 style="border:0">بيانات المبادرة</h3><table class="facts">${factsOf(p).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>${body}${checklist}${survey}${logTpl}<p class="note">${esc(ORIGIN_NOTE[p.origin] || '')} — ${esc(BRAND)}</p>`);
}

/** استبانة قياس الأثر وحدها (للطباعة والتوزيع). */
export function surveyHTML(p) {
  return doc(`استبانة — ${p.plan.title}`, `${surveyHTMLFragment(p)}<p class="note">${esc(p.meta.school || '')} ${p.meta.school ? '— ' : ''}${esc(BRAND)}</p>`);
}

/** بطاقة الإعلان/التعريف بالمبادرة (صفحة واحدة A4). */
export function posterHTML(p) {
  const pl = p.plan, m = p.meta, d = DOMAIN[pl.domain] || {};
  const color = d.color || '#b45309';
  const dates = m.startDate ? `تبدأ ${fmtDate(m.startDate)} · ${weeksLabel(pl.weeks)}` : weeksLabel(pl.weeks);
  const css = `.poster{min-height:262mm;border-radius:8mm;overflow:hidden;display:flex;flex-direction:column;border:2px solid ${color}}
.ph{background:linear-gradient(135deg,${color},#f59e0b);color:#fff;padding:14mm 12mm 12mm;text-align:center;position:relative}
.ph h1{color:#fff;font-size:32pt;margin:3mm 0}.ph .k{font-weight:800;opacity:.9;letter-spacing:.5px}.ph .s{font-size:15pt;opacity:.95}
.ph img{max-height:22mm;max-width:50mm;background:#fff;border-radius:3mm;padding:2mm;margin-bottom:2mm}
.pb{padding:9mm 12mm;flex:1;display:flex;flex-direction:column;gap:5mm}
.box{border:1.5px solid #f0d9b5;border-radius:4mm;padding:4mm 6mm;background:#fffaf2}.box h3{border:0;margin:0 0 2mm;color:${color};font-size:14pt}
.join{background:${color};color:#fff;border-radius:4mm;padding:5mm 7mm;font-size:14pt;font-weight:700;text-align:center}
.pf{text-align:center;color:#6b7280;font-size:10pt;padding:0 0 6mm}`;
  return doc(`إعلان — ${pl.title}`, `<div class="poster"><div class="ph">${m.logo ? `<img src="${m.logo}" alt="">` : ''}<div class="k">مبادرة ${esc(m.school || 'مدرسية')}</div><h1>${esc(pl.title)}</h1>${pl.slogan ? `<div class="s">${esc(pl.slogan)}</div>` : ''}</div>
<div class="pb"><div class="box"><h3>ما المبادرة؟</h3><p>${esc(pl.summary)}</p></div>
<div class="box"><h3>ماذا نريد أن نحقق؟</h3><ul>${pl.objectives.slice(0, 3).map((o) => `<li>${esc(o)}</li>`).join('')}</ul></div>
<div class="box"><h3>لمن؟ ومتى؟</h3><p>${esc(pl.audience)}<br>${esc(dates)}</p></div>
${pl.join ? `<div class="join">كيف تشارك؟ ${esc(pl.join)}</div>` : ''}</div>
<div class="pf">${m.presenter ? `${esc(m.presenter)} · ` : ''}${esc(m.year || '')}</div></div>`, css);
}

export const statusLabel = (id) => label(STATUSES, id);
