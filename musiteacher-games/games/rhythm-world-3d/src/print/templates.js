// =====================================================================
//  قوالب الوسائل التعليمية المطبوعة. كل قالب يبني صفحات كاملة بأبعاد الورق الحقيقية (مم)
//  من بيانات اللعبة نفسها (العلامات، الصف، الاستوديو، الأسماء)، ويضمن ألا يُقسم عنصر بين صفحتين
//  لأنه يحسب عدد العناصر التي تتسع لها كل صفحة قبل الرسم.
// =====================================================================
import { FIG, TPB, valueText, beatsNum, allowedFor, GRADE_NAMES, SINGLE_NOTES, RESTS } from '../data/figures.js';
import { figureSVG } from '../notation/svg.js';
import { analyse, rhythmFor } from '../data/names.js';

export const PAPER = { A4: [210, 297], A5: [148, 210] };
export const MARGIN = 10;                  // هامش آمن للطباعة (مم)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** رمز موسيقي بارتفاع محدد بالمليمتر */
export function sym(ids, hMm, o = {}) { const r = figureSVG(Array.isArray(ids) ? ids : [ids], { k: 10, padTop: 0.3, padBottom: 0.3, minTop: o.minTop ?? 4.3, minBottom: o.minBottom ?? -2.1, color: o.color || '#111', line: o.line !== false, lineOpacity: o.lineOpacity ?? 0.45, ...o }); return r.svg.replace('<svg ', `<svg style="height:${hMm}mm;width:auto;max-width:100%" `); }
const tint = (opt, id) => (opt.bw ? 'transparent' : (FIG[id].hue || '#888') + '1f');
const stroke = (opt, id) => (opt.bw ? '#111' : FIG[id].hue || '#333');
/** مربعات الزمن: كل مربع = زمن، والكسر جزء من مربع */
function beatBoxes(ticks, rest, opt, size = 6) {
  const n = Math.ceil(ticks / TPB); let s = '';
  for (let i = 0; i < n; i++) { const frac = Math.min(1, ticks / TPB - i); s += `<span class="bx ${rest ? 'r' : 's'}${opt.bw ? ' bw' : ''}" style="width:${size}mm;height:${size}mm"><i style="width:${frac * 100}%"></i></span>`; }
  return `<span class="bxs">${s}</span>`;
}

function header(opt, title, sub) {
  const meta = [opt.lesson && esc(opt.lesson), opt.grade && 'الصف ' + GRADE_NAMES[opt.grade - 1], opt.date && esc(opt.date)].filter(Boolean).join(' | ');
  return `<header class="ph"><div><h1>${esc(opt.title || title)}</h1>${meta || sub ? `<p>${meta}${meta && sub ? ' — ' : ''}${sub ? esc(sub) : ''}</p>` : ''}</div>${opt.nameLine ? '<div class="who"><span>الاسم: ………………………</span><span>الصف: ………</span></div>' : ''}</header>`;
}
const footer = (n, N) => `<footer class="pfoot"><span class="brand">♫ MusiTeacher · عالم الإيقاع</span><span>صفحة ${n} من ${N}</span></footer>`;
/** يجمع محتوى الصفحات في عناصر <section> بالقياس الحقيقي */
export function pages(opt, bodies) {
  const [w, h] = PAPER[opt.paper]; const W = opt.landscape ? h : w, H = opt.landscape ? w : h;
  return bodies.map((b, i) => `<section class="pg${opt.bw ? ' bw' : ''} ${opt.paper}" style="width:${W}mm;height:${H}mm;padding:${MARGIN}mm">${b}${footer(i + 1, bodies.length)}</section>`).join('');
}
export function innerSize(opt) { const [w, h] = PAPER[opt.paper]; const W = (opt.landscape ? h : w) - 2 * MARGIN, H = (opt.landscape ? w : h) - 2 * MARGIN; return { W, H, bodyH: H - (opt.nameLine ? 26 : 19) - 8 }; }
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o.length ? o : [[]]; };
const blank = (w = 22) => `<span class="blank" style="min-width:${w}mm"></span>`;
const valueOrBlank = (opt, id) => (opt.showValues ? esc(valueText(FIG[id].ticks)) : blank(26));

// ---------------------------------------------------------------- القوالب
export const TEMPLATES = {
  reference: {
    name: 'لوحة مرجعية: العلامات وقيمها', kind: 'شرح ومراجعة', icon: '📋',
    build(opt) {
      const ids = opt.ids.filter((id) => FIG[id].kind !== 'group' || opt.includeGroups); const S = innerSize(opt);
      const rowH = opt.paper === 'A5' ? 22 : 26; const per = Math.max(1, Math.floor((S.bodyH - 10) / rowH));
      return chunk(ids, per).map((part, pi) => header(opt, 'العلامات الإيقاعية وقيمها الزمنية', 'من الأطول إلى الأقصر') +
        `<table class="tbl"><thead><tr><th>الرمز</th><th>الاسم</th><th>القيمة الزمنية</th><th>بالأزمنة</th>${opt.showSyl ? '<th>النطق</th>' : ''}</tr></thead><tbody>` +
        part.map((id) => `<tr style="height:${rowH}mm;background:${tint(opt, id)}"><td class="sy">${sym(id, rowH - 5)}</td><td><b>${esc(FIG[id].name)}</b></td><td>${valueOrBlank(opt, id)}</td><td>${opt.showValues ? beatBoxes(FIG[id].ticks, FIG[id].kind === 'rest', opt) : blank(20)}</td>${opt.showSyl ? `<td>${esc(FIG[id].syl || (FIG[id].kind === 'rest' ? 'صمت' : ''))}</td>` : ''}</tr>`).join('') + '</tbody></table>');
    },
  },
  pairs: {
    name: 'العلامات والسكتات المقابلة لها', kind: 'شرح ومراجعة', icon: '🤫',
    build(opt) {
      const notes = opt.ids.filter((id) => FIG[id].kind === 'note' && FIG[id].pair); const S = innerSize(opt);
      const rowH = opt.paper === 'A5' ? 24 : 28; const per = Math.max(1, Math.floor((S.bodyH - 10) / rowH));
      return chunk(notes.length ? notes : ['q'], per).map((part) => header(opt, 'العلامات والسكتات المقابلة لها', 'لكل علامة صوت سكتةٌ صمتُها بالزمن نفسه') +
        `<table class="tbl"><thead><tr><th>العلامة (صوت)</th><th>اسمها</th><th>الزمن</th><th>السكتة (صمت)</th><th>اسمها</th></tr></thead><tbody>` +
        part.map((id) => { const r = FIG[id].pair; return `<tr style="height:${rowH}mm"><td class="sy" style="background:${tint(opt, id)}">${sym(id, rowH - 6)}</td><td><b>${esc(FIG[id].name)}</b></td><td>${opt.showValues ? esc(valueText(FIG[id].ticks)) + beatBoxes(FIG[id].ticks, false, opt, 4.5) : blank(24)}</td><td class="sy rs">${opt.showRests === false ? blank(18) : sym(r, rowH - 6)}</td><td>${opt.showRests === false ? blank(26) : '<b>' + esc(FIG[r].name) + '</b>'}</td></tr>`; }).join('') + '</tbody></table>');
    },
  },
  cards: {
    name: 'بطاقات للقص', kind: 'قص ولصق', icon: '✂',
    build(opt) {
      const ids = opt.ids; const per = +opt.perPage || 6; const S = innerSize(opt);
      const cols = per <= 2 ? 1 : per <= 6 ? 2 : per <= 12 ? 3 : 4, rows = Math.ceil(per / cols);
      const cw = S.W / cols, ch = (S.bodyH + 6) / rows;
      return chunk(ids, per).map((part) => header(opt, 'بطاقات العلامات الإيقاعية', opt.showValues ? 'قصّ البطاقات على الخط المتقطع والصقها في كراستك' : 'اكتب اسم العلامة وقيمتها، ثم قصّ البطاقة') +
        `<div class="cards" style="grid-template-columns:repeat(${cols},${cw}mm);grid-auto-rows:${ch}mm">` +
        part.map((id) => `<div class="card" style="--c:${stroke(opt, id)};background:${tint(opt, id)}"><div class="cs">${sym(id, Math.min(ch * 0.52, cw * 0.62))}</div><div class="cn">${opt.showNames === false ? blank(30) : esc(FIG[id].name)}</div><div class="cv">${opt.showValues ? esc(valueText(FIG[id].ticks)) : blank(26)}</div>${opt.showValues && ch > 40 ? beatBoxes(FIG[id].ticks, FIG[id].kind === 'rest', opt, Math.min(6, cw / 9)) : ''}</div>`).join('') + '</div>');
    },
  },
  match: {
    name: 'بطاقات المطابقة (رمز ↔ اسم وقيمة)', kind: 'مطابقة', icon: '🧩',
    build(opt) {
      const ids = opt.ids.slice(0, 12); const S = innerSize(opt); const rnd = seeded(opt.seed || 7);
      const names = [...ids].sort(() => rnd() - 0.5); const cols = 3; const n = Math.ceil(ids.length / cols); const half = (S.bodyH - 14) / 2; const ch = Math.min(38, half / Math.max(1, n));
      const grid = (list, fn) => `<div class="cards" style="grid-template-columns:repeat(${cols},${S.W / cols}mm);grid-auto-rows:${ch}mm">${list.map(fn).join('')}</div>`;
      return [header(opt, 'طابِق الرمز مع اسمه وقيمته', 'قصّ البطاقات، ثم ضع كل رمز بجانب بطاقته') +
        '<h3 class="sec">بطاقات الرموز</h3>' + grid(ids, (id) => `<div class="card"><div class="cs">${sym(id, ch * 0.72)}</div></div>`) +
        '<h3 class="sec">بطاقات الأسماء والقيم</h3>' + grid(names, (id) => `<div class="card"><div class="cn">${esc(FIG[id].name)}</div><div class="cv">${esc(valueText(FIG[id].ticks))}</div></div>`)];
    },
  },
  relations: {
    name: 'شجرة الأزمنة والعلاقات', kind: 'شرح ومراجعة', icon: '🌳',
    build(opt) {
      const rows = opt.rows && opt.rows.length ? opt.rows : defaultTree(opt.grade); const S = innerSize(opt);
      const total = Math.max(...rows.map((r) => r.ids.reduce((a, id) => a + FIG[id].ticks, 0)));
      const labelW = 30, barW = S.W - labelW - 4; const rowH = Math.min(30, (S.bodyH - 20) / rows.length - 3);
      const body = rows.map((r) => `<div class="trw" style="height:${rowH}mm"><div class="tl"><b>${esc(r.label)}</b><small>${esc(r.sub || '')}</small></div><div class="tb" style="width:${barW}mm">` +
        r.ids.map((id) => `<div class="tc${FIG[id].kind === 'rest' ? ' r' : ''}" style="width:${(FIG[id].ticks / total) * barW}mm;background:${FIG[id].kind === 'rest' ? '' : tint(opt, id)}">${opt.blankCells ? '' : sym(id, rowH - 5, { lineOpacity: 0.25 })}</div>`).join('') +
        Array.from({ length: total / TPB - 1 }, (_, b) => `<i class="tbeat" style="left:${((b + 1) * TPB / total) * barW}mm"></i>`).join('') + '</div></div>').join('');
      return [header(opt, opt.relTitle || 'شجرة الأزمنة', opt.blankCells ? 'ارسم في كل خانة العلامة المناسبة لطولها' : 'كل صف يملأ الزمن نفسه') + `<div class="tree">${body}</div>` +
        `<p class="note">الخطوط المتقطعة = النبض (زمن النوار). ${opt.blankCells ? '' : 'الخانة المخططة = سكتة (صمت).'}</p>`];
    },
  },
  strips: {
    name: 'شرائط إيقاعية للإكمال', kind: 'تدريب وإكمال', icon: '🎼',
    build(opt) {
      const meter = opt.meter || 4; const S = innerSize(opt); const per = Math.max(3, Math.floor(S.bodyH / 26)); const n = +opt.count || per;
      const seq = opt.seq && opt.seq.length ? opt.seq : null; const rnd = seeded(opt.seed || 3);
      const al = allowedFor(opt.grade).filter((id) => FIG[id].ticks % TPB === 0 && FIG[id].ticks <= meter * TPB);
      const make = () => { const out = []; for (let m = 0; m < 2; m++) { let left = meter * TPB; while (left > 0) { const o = al.filter((id) => FIG[id].ticks <= left); const id = o[Math.floor(rnd() * o.length)]; out.push(id); left -= FIG[id].ticks; } } return out; };
      const stripH = Math.min(34, (S.bodyH - 8) / per - 4);
      const strips = Array.from({ length: n }, (_, i) => {
        const ids = i === 0 && seq ? seq : make(); const ms = splitMeasures(ids, meter);
        const hideAt = opt.mode === 'blank' ? null : ms.map((m) => Math.floor(rnd() * m.length));
        return `<div class="strip" style="height:${stripH}mm"><span class="num">${i + 1}</span><span class="tsig"><b>${meter}</b><b>4</b></span>` + ms.map((m, mi) =>
          `<span class="msr">${opt.mode === 'blank' ? Array.from({ length: meter }, () => '<span class="beat"></span>').join('') : m.map((id, j) => (j === hideAt[mi] ? `<span class="gap" style="width:${12 + FIG[id].beats * 6}mm"></span>` : sym(id, stripH - 3, { line: false, minTop: 3.9, minBottom: -1.6, padTop: 0.1, padBottom: 0.1 }))).join('')}</span>`).join('') + '</div>';
      });
      const title = opt.mode === 'blank' ? 'شرائط إيقاعية فارغة' : 'أكمل المازورة بالعلامة الناقصة';
      const sub = opt.mode === 'blank' ? `اكتب إيقاعك في الميزان ${meter}/4 (كل مربع = زمن)` : `كل مازورة في الميزان ${meter}/4 تحتاج ${meter} أزمنة`;
      return chunk(strips, per).map((part) => header(opt, title, sub) + `<div class="strips">${part.join('')}</div>`);
    },
  },
  order: {
    name: 'رتّب العلامات حسب الزمن', kind: 'تدريب', icon: '↕',
    build(opt) {
      const ids = opt.ids.filter((id) => FIG[id].kind !== 'group').slice(0, 8); const rnd = seeded(opt.seed || 11); const mixed = [...ids].sort(() => rnd() - 0.5); const S = innerSize(opt);
      const w = Math.min(36, S.W / Math.max(4, mixed.length) - 3);
      return [header(opt, 'رتّب العلامات من الأطول إلى الأقصر', 'اكتب رقم الترتيب في المربع تحت كل علامة') +
        `<div class="row">${mixed.map((id) => `<div class="obox" style="width:${w}mm">${sym(id, Math.min(30, w))}<span class="sq"></span></div>`).join('')}</div>` +
        '<h3 class="sec">اكتب أسماءها بالترتيب</h3>' + `<ol class="lines">${ids.map(() => '<li></li>').join('')}</ol>`];
    },
  },
  soundsilence: {
    name: 'الصوت والصمت', kind: 'نشاط وتطبيق', icon: '🔇',
    build(opt) {
      const al = opt.ids.filter((id) => FIG[id].kind !== 'group'); const notes = al.filter((id) => FIG[id].kind === 'note'), rests = al.filter((id) => FIG[id].kind === 'rest');
      const rnd = seeded(opt.seed || 5); const pick = (a) => a[Math.floor(rnd() * a.length)];
      const line = () => Array.from({ length: 6 }, (_, i) => (rests.length && (i % 2 || rnd() < 0.3) ? pick(rests) : pick(notes.length ? notes : ['q'])));
      const S = innerSize(opt); const nL = opt.paper === 'A5' ? 3 : 5; const h = Math.min(30, (S.bodyH - 40) / nL - 6);
      return [header(opt, 'الصوت والصمت', 'لوّن العلامات التي نصفّق لها، وضع دائرة حول السكتات') +
        `<div class="legend"><span><i class="sw s"></i> صوت: نصفّق</span><span><i class="sw r"></i> صمت: لا نصفّق ونعدّ بهدوء</span></div>` +
        Array.from({ length: nL }, (_, i) => `<div class="ssline"><span class="num">${i + 1}</span>${line().map((id) => `<span class="ss">${sym(id, h)}</span>`).join('')}<span class="cnt">عدد السكتات: …</span></div>`).join('')];
    },
  },
  names: {
    name: 'ورقة نشاط: إيقاع الأسماء', kind: 'نشاط وتطبيق', icon: '🧒',
    build(opt) {
      const names = (opt.names && opt.names.length ? opt.names : ['محمد', 'أحمد', 'علي', 'سالم']).slice(0, 12); const S = innerSize(opt);
      const per = opt.paper === 'A5' ? 3 : 5; const bh = (S.bodyH - 6) / per - 4;
      const blocks = names.map((n) => { const a = analyse(n); const R = rhythmFor(a.syllables, opt.mode || 'length');
        return `<div class="nb" style="height:${bh}mm"><div class="nn">${esc(n)}</div><div class="sb">${a.syllables.map((s) => `<span class="sylb">${opt.showValues ? esc(s.text) : ''}</span>`).join('')}<span class="hint">← عدد المقاطع: ${opt.showValues ? a.syllables.length : '…'}</span></div>` +
          `<div class="nr">${opt.showValues ? sym(R.seq, Math.min(18, bh * 0.4)) : '<span class="rline"></span>'}</div></div>`; });
      return chunk(blocks, per).map((part) => header(opt, 'إيقاع الأسماء', opt.showValues ? 'صفّق كل اسم مع مقاطعه' : 'قسّم الاسم إلى مقاطع، ثم اكتب إيقاعه على الخط') + part.join(''));
    },
  },
  summary: {
    name: 'ملخص مصور للمفاهيم', kind: 'شرح ومراجعة', icon: '⭐',
    build(opt) {
      const ids = opt.ids.filter((id) => FIG[id].kind !== 'group').slice(0, 8);
      const tree = defaultTree(opt.grade); const total = Math.max(...tree.map((r) => r.ids.reduce((a, id) => a + FIG[id].ticks, 0))); const S = innerSize(opt); const barW = S.W - 34;
      const gridRows = Math.ceil(ids.length / 4); const tipsH = 22; const cardH = Math.min(30, (S.bodyH - tipsH - 12) * 0.45 / gridRows); const rowH = Math.min(16, ((S.bodyH - tipsH - 12) - gridRows * (cardH + 2)) / tree.length - 2);
      return [header(opt, 'ملخص: العلامات والسكتات', '') +
        `<div class="sumgrid">${ids.map((id) => `<div class="si" style="height:${cardH}mm;background:${tint(opt, id)};--c:${stroke(opt, id)}">${sym(id, cardH - 10, { line: false, minTop: 3.9, minBottom: -1.2, padTop: 0.1, padBottom: 0.1 })}<b>${esc(FIG[id].name)}</b><span>${esc(valueText(FIG[id].ticks))}</span></div>`).join('')}</div>` +
        '<h3 class="sec">العلاقات بين العلامات</h3><div class="tree">' + tree.map((r) => `<div class="trw" style="height:${rowH}mm"><div class="tl"><b>${esc(r.label)}</b></div><div class="tb" style="width:${barW}mm">${r.ids.map((id) => `<div class="tc" style="width:${(FIG[id].ticks / total) * barW}mm;background:${tint(opt, id)}">${sym(id, rowH - 2, { lineOpacity: 0.25, minTop: 3.9, minBottom: -1.2, padTop: 0.1, padBottom: 0.1 })}</div>`).join('')}</div></div>`).join('') + '</div>' +
        `<ul class="tips"><li>الرأس الأسود الممتلئ = نوار أو أقصر، والرأس الأبيض المفرّغ = بلانش أو روند.</li><li>كل شَعرة أو عارضة تقسم الزمن نصفين.</li><li>السكتة صمتٌ بالزمن نفسه، والنبض يستمر أثناءها.</li>${opt.grade >= 7 ? '<li>النقطة تزيد العلامة نصف قيمتها.</li>' : ''}</ul>`];
    },
  },
  quiz: {
    name: 'تقويم قصير', kind: 'تقويم', icon: '✅',
    build(opt) {
      const notes = opt.ids.filter((id) => FIG[id].kind === 'note'); const rests = opt.ids.filter((id) => FIG[id].kind === 'rest'); const rnd = seeded(opt.seed || 9); const pick = (a) => a[Math.floor(rnd() * a.length)];
      const qs = [];
      notes.slice(0, 3).forEach((id) => qs.push(`<li><span>ما اسم هذه العلامة؟ وكم زمنها؟</span>${sym(id, 16)}<span class="ans">الاسم: ……………… الزمن: ……………</span></li>`));
      notes.filter((id) => FIG[id].pair && rests.includes(FIG[id].pair)).slice(0, 2).forEach((id) => qs.push(`<li><span>ارسم السكتة المقابلة للعلامة:</span>${sym(id, 16)}<span class="draw"></span></li>`));
      if (notes.includes('h') && notes.includes('q')) qs.push('<li><span>البلانش يساوي ……… نوار.</span></li>');
      if (opt.ids.includes('ee') || notes.includes('e')) qs.push('<li><span>النوار يساوي ……… كروش.</span></li>');
      if (notes.includes('w')) qs.push('<li><span>الروند يساوي ……… بلانش، أو ……… نوار.</span></li>');
      if (notes.length >= 2) { const a = pick(notes), b = pick(notes.filter((x) => x !== a)); qs.push(`<li><span>أيهما أطول زمنًا؟ ضع دائرة حوله.</span>${sym(a, 16)}<span class="or">أم</span>${sym(b, 16)}</li>`); }
      return [header(opt, 'تقويم قصير', 'أجب عن الأسئلة') + `<ol class="quiz">${qs.slice(0, 8).join('')}</ol>`];
    },
  },
};

function defaultTree(grade) {
  const al = new Set(allowedFor(grade)); const top = al.has('w') ? 4 : al.has('h') ? 2 : 1; const rep = (id, n) => Array(n).fill(id); const t = [];
  if (al.has('w')) t.push({ label: 'روند', sub: '4', ids: ['w'] });
  if (al.has('h') && top >= 2) t.push({ label: 'بلانش', sub: '2', ids: rep('h', top / 2) });
  t.push({ label: 'نوار', sub: '1', ids: rep('q', top) });
  if (al.has('ee') || al.has('e')) t.push({ label: 'كروش', sub: '½', ids: rep('ee', top) });
  if (al.has('ssss')) t.push({ label: 'دوبل كروش', sub: '¼', ids: rep('ssss', top) });
  return t;
}
function splitMeasures(ids, meter) { const cap = meter * TPB, out = [[]]; let t = 0; for (const id of ids) { if (t >= cap) { out.push([]); t = 0; } out[out.length - 1].push(id); t += FIG[id].ticks; } return out; }
function seeded(s) { let x = s >>> 0 || 1; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
export { beatsNum, SINGLE_NOTES, RESTS };
