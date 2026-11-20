// =====================================================================
//  مصنع الوسائل التعليمية القابلة للطباعة — يُحمَّل عند الطلب فقط ولا يؤثر في المشهد ثلاثي الأبعاد
//  (يتوقف رسم المشهد طوال فتح المصنع). معاينة بالقياس الحقيقي للورق، ثم طباعة أو حفظ PDF من المتصفح.
// =====================================================================
import { TEMPLATES, pages, PAPER } from './templates.js';
import { FIG, allowedFor, GRADES, GRADE_NAMES, SINGLE_NOTES, RESTS, GROUPS } from '../data/figures.js';

const today = () => { try { return new Date().toLocaleDateString('ar-OM', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return ''; } };
let opt = null;

export function openFactory(app, preset = {}) {
  const grade = app.state.grade; const al = allowedFor(grade);
  opt = Object.assign({ template: 'reference', paper: 'A4', landscape: false, bw: false, grade, showValues: true, showNames: true, showRests: true, showSyl: grade <= 4, includeGroups: true,
    perPage: 6, meter: 4, mode: 'complete', count: 0, blankCells: false, nameLine: true, title: '', lesson: '', date: today(), seed: 1, ids: al }, opt && opt.grade === grade ? { ...opt, ids: opt.ids } : {}, preset);
  if (!opt.ids || !opt.ids.length) opt.ids = al;
  if (preset.template === 'cards' && preset.ids && preset.ids.length <= 2) opt.perPage = 4;
  if (preset.names) opt.showValues = true;
  const root = app.$('#print-root'); root.hidden = false; document.body.classList.add('pf-open');
  root.innerHTML = `<div class="pf-ui"><aside class="pf-side"></aside><div class="pf-main"><div class="pf-top"><b class="pf-title">🖨 إنشاء وسيلة تعليمية للطباعة</b><span class="pf-status"></span>
    <span style="flex:1"></span><button class="accent big pf-print">🖨 طباعة / حفظ PDF</button><button class="pf-close">✕ إغلاق</button></div>
    <p class="pf-tip">للحفظ بصيغة PDF: اضغط «طباعة» ثم اختر الوجهة «حفظ بتنسيق PDF». اجعل الهوامش «بلا» أو «الافتراضية» والمقياس 100%.</p>
    <div class="pf-preview"><div class="pf-pages"></div></div></div></div>`;
  root.querySelector('.pf-close').onclick = () => close(app);
  root.querySelector('.pf-print').onclick = () => doPrint();
  side(app); render();
}
function close() { const r = document.querySelector('#print-root'); r.hidden = true; r.innerHTML = ''; document.body.classList.remove('pf-open', 'printing'); }

function side(app) {
  const S = document.querySelector('.pf-side'); S.innerHTML = '';
  const h = (t) => { const e = document.createElement('h4'); e.textContent = t; S.append(e); };
  const row = () => { const d = document.createElement('div'); d.className = 'pf-row'; S.append(d); return d; };
  const btn = (parent, label, on, fn, cls = '') => { const b = document.createElement('button'); b.innerHTML = label; b.className = (on ? 'on ' : '') + cls; b.onclick = () => { fn(); side(app); render(); }; parent.append(b); return b; };
  const check = (parent, label, key) => { const l = document.createElement('label'); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!opt[key]; c.onchange = () => { opt[key] = c.checked; render(); }; l.append(c, ' ' + label); parent.append(l); };
  const text = (label, key, ph) => { const l = document.createElement('label'); l.className = 'pf-field'; l.textContent = label; const i = document.createElement('input'); i.type = 'text'; i.value = opt[key] || ''; i.placeholder = ph || ''; i.oninput = () => { opt[key] = i.value; render(); }; l.append(i); S.append(l); };
  h('١. نوع الوسيلة');
  const tg = document.createElement('div'); tg.className = 'pf-tpl'; S.append(tg);
  for (const k in TEMPLATES) btn(tg, `<span>${TEMPLATES[k].icon}</span><b>${TEMPLATES[k].name}</b><small>${TEMPLATES[k].kind}</small>`, opt.template === k, () => { opt.template = k; });
  h('٢. الورق');
  const r1 = row(); ['A4', 'A5'].forEach((p) => btn(r1, p + (p === 'A5' ? ' (للكراسة)' : ''), opt.paper === p, () => { opt.paper = p; }));
  const r2 = row(); btn(r2, 'طولي', !opt.landscape, () => { opt.landscape = false; }); btn(r2, 'عرضي', opt.landscape, () => { opt.landscape = true; });
  const r3 = row(); btn(r3, '🎨 ملوّن', !opt.bw, () => { opt.bw = false; }); btn(r3, '⚫ أبيض وأسود (اقتصادي)', opt.bw, () => { opt.bw = true; });
  h('٣. المحتوى');
  const gl = document.createElement('label'); gl.className = 'pf-field'; gl.textContent = 'الصف'; const gs = document.createElement('select'); GRADES.forEach((g) => gs.append(new Option('الصف ' + GRADE_NAMES[g - 1], g))); gs.value = opt.grade; gs.onchange = () => { opt.grade = +gs.value; opt.ids = allowedFor(opt.grade); side(app); render(); }; gl.append(gs); S.append(gl);
  const al = allowedFor(opt.grade); const box = document.createElement('div'); box.className = 'pf-ids'; S.append(box);
  [...SINGLE_NOTES, ...GROUPS, ...RESTS].filter((id) => al.includes(id)).forEach((id) => { const l = document.createElement('label'); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = opt.ids.includes(id); c.onchange = () => { opt.ids = c.checked ? [...new Set([...opt.ids, id])] : opt.ids.filter((x) => x !== id); opt.ids = [...SINGLE_NOTES, ...GROUPS, ...RESTS].filter((x) => opt.ids.includes(x)); render(); }; l.append(c, ' ' + FIG[id].name); box.append(l); });
  const r4 = row(); btn(r4, 'الكل', false, () => { opt.ids = al; }); btn(r4, 'العلامات', false, () => { opt.ids = al.filter((x) => FIG[x].kind !== 'rest'); }); btn(r4, 'السكتات', false, () => { opt.ids = al.filter((x) => FIG[x].kind === 'rest'); });
  const r5 = row(); check(r5, 'إظهار القيم الزمنية (أطفئها لورقة اختبار)', 'showValues');
  const t = opt.template;
  if (t === 'cards') { check(r5, 'إظهار الأسماء', 'showNames'); const r = row(); r.append('عدد البطاقات في الصفحة: '); [4, 6, 8, 12, 16].forEach((n) => btn(r, String(n), +opt.perPage === n, () => { opt.perPage = n; })); }
  if (t === 'pairs') check(r5, 'إظهار السكتات (أطفئها ليرسمها الطالب)', 'showRests');
  if (t === 'reference') { check(r5, 'عمود النطق (تا، تي…)', 'showSyl'); check(r5, 'تضمين الأشكال (تاتي…)', 'includeGroups'); }
  if (t === 'relations') check(r5, 'خانات فارغة يرسم فيها الطالب', 'blankCells');
  if (t === 'strips') { const r = row(); btn(r, 'أكمل الناقص', opt.mode !== 'blank', () => { opt.mode = 'complete'; }); btn(r, 'شرائط فارغة', opt.mode === 'blank', () => { opt.mode = 'blank'; }); const r6 = row(); r6.append('الميزان: '); [2, 3, 4].forEach((m) => btn(r6, m + '/4', opt.meter === m, () => { opt.meter = m; opt.seq = null; })); }
  if (['strips', 'order', 'soundsilence', 'match', 'quiz'].includes(t)) { const r = row(); btn(r, '🔀 نسخة مختلفة', false, () => { opt.seed++; }); }
  if (t === 'names') { const l = document.createElement('label'); l.className = 'pf-field'; l.textContent = 'الأسماء (اسم في كل سطر)'; const ta = document.createElement('textarea'); ta.rows = 5; ta.value = (opt.names || []).join('\n'); ta.oninput = () => { opt.names = ta.value.split('\n').map((s) => s.trim()).filter(Boolean); render(); }; l.append(ta); S.append(l); }
  h('٤. العنوان والتذييل');
  text('العنوان (اتركه فارغًا للعنوان المقترح)', 'title', TEMPLATES[t].name); text('اسم الدرس', 'lesson', 'اختياري'); text('التاريخ', 'date', 'اختياري');
  const r7 = row(); check(r7, 'سطر «الاسم والصف» للطالب', 'nameLine');
}

function render() {
  const T = TEMPLATES[opt.template]; let bodies = [];
  try { bodies = T.build({ ...opt, ids: opt.ids.length ? opt.ids : allowedFor(opt.grade) }); } catch (e) { console.error(e); bodies = ['<p>تعذّر إنشاء هذه الوسيلة بالاختيارات الحالية.</p>']; }
  const P = document.querySelector('.pf-pages'); if (!P) return; P.innerHTML = pages(opt, bodies);
  P.dataset.paper = opt.paper; P.dataset.land = opt.landscape ? '1' : '0';
  requestAnimationFrame(() => fitPreview());
  const st = document.querySelector('.pf-status'); const over = check();
  st.innerHTML = `${bodies.length} صفحة · ${opt.paper} ${opt.landscape ? 'عرضي' : 'طولي'} · ${opt.bw ? 'أبيض وأسود' : 'ملوّن'}${over ? ' · <b style="color:#f4a261">⚠ محتوى يتجاوز الصفحة</b>' : ''}`;
}
/** يتحقق أن محتوى كل صفحة داخل حدودها (لا اقتطاع ولا عنصر منقسم) */
export function check() {
  let bad = 0; document.querySelectorAll('.pf-pages .pg').forEach((pg) => { const r = pg.getBoundingClientRect(); pg.classList.remove('over'); pg.querySelectorAll(':scope > *').forEach((c) => { const q = c.getBoundingClientRect(); if (q.bottom > r.bottom + 1 || q.right > r.right + 1 || q.left < r.left - 1) { bad++; pg.classList.add('over'); } }); });
  return bad;
}
function fitPreview() {
  const box = document.querySelector('.pf-preview'), P = document.querySelector('.pf-pages'); if (!box || !P) return;
  const pg = P.querySelector('.pg'); if (!pg) return; const w = pg.offsetWidth; const k = Math.min(1, (box.clientWidth - 40) / w);
  P.style.transform = `scale(${k})`; P.style.transformOrigin = 'top center'; P.style.marginBottom = `${-(1 - k) * P.offsetHeight}px`;
}
addEventListener('resize', () => document.body.classList.contains('pf-open') && fitPreview());

async function doPrint() {
  const [w, h] = PAPER[opt.paper];
  let st = document.getElementById('pg-size'); if (!st) { st = document.createElement('style'); st.id = 'pg-size'; document.head.append(st); }
  st.textContent = `@page { size: ${opt.landscape ? h : w}mm ${opt.landscape ? w : h}mm; margin: 0; }`;
  try { await document.fonts.ready; } catch (e) { /* */ }
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 1500); }, 60);
}
/** للاختبار الآلي: يجهز الصفحة للطباعة دون فتح نافذة الطباعة */
export function preparePrint() { const [w, h] = PAPER[opt.paper]; let st = document.getElementById('pg-size'); if (!st) { st = document.createElement('style'); st.id = 'pg-size'; document.head.append(st); } st.textContent = `@page { size: ${opt.landscape ? h : w}mm ${opt.landscape ? w : h}mm; margin: 0; }`; document.body.classList.add('printing'); return document.querySelectorAll('.pf-pages .pg').length; }
export function setOptions(o) { Object.assign(opt, o); side(window.rw3d); render(); return check(); }
