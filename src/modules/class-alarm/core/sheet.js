// 🖨️ الجدول الأسبوعي المنسق (باسم المعلم والمدرسة) — يولّد HTML/CSS مستقلًا بمقاس A4 أفقي.
// نفس المصدر يُستخدم للمعاينة والطباعة والتصدير صورة/PDF، فما يراه المعلم هو ما يُطبع.
import { DAY_NAMES, fmtTime, parseHHMM } from './time.js';
import { weekStats } from './schedule.js';

export const SHEET_W = 1123, SHEET_H = 794; // A4 أفقي عند 96 نقطة/بوصة

export const TEMPLATES = [
  { id: 'official', name: 'رسمي مدرسي', desc: 'أزرق داكن وذهبي بإطار مزدوج' },
  { id: 'modern', name: 'أنيق وعصري', desc: 'ترويسة متدرجة وخانات ناعمة' },
  { id: 'print', name: 'بسيط للطباعة', desc: 'أبيض وأسود موفّر للحبر' },
  { id: 'colorful', name: 'ملوّن حسب الصف', desc: 'لون لكل صف مع دليل ألوان' },
];

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PALETTE = [['#e0f2fe', '#0369a1'], ['#fce7f3', '#be185d'], ['#dcfce7', '#15803d'], ['#fef3c7', '#b45309'], ['#ede9fe', '#6d28d9'], ['#ffe4e6', '#be123c'], ['#ccfbf1', '#0f766e'], ['#e0e7ff', '#4338ca'], ['#fae8ff', '#a21caf'], ['#ecfccb', '#4d7c0f']];

export function shortClass(l) {
  if (!l) return '';
  const g = String(l.grade || '').replace(/^الصف\s*/, '').trim();
  return [g, l.section].filter(Boolean).join(' / ');
}
const classKey = (l) => String(l.grade || l.subject || '').trim();

export function buildSheet(profile, { template = 'official', h24 = false, showRoom = true, showSubject = true, showNotes = false, showStats = true, brandLine = 'MusiTeacher' } = {}) {
  const t = TEMPLATES.some((x) => x.id === template) ? template : 'official';
  const days = profile.days.length ? profile.days : [0, 1, 2, 3, 4];
  const cols = profile.periods.filter((p) => p.start || p.kind === 'lesson');
  const colorOf = new Map();
  for (const d of days) for (const p of cols) { const l = (profile.lessons[d] || {})[p.id]; if (l) { const k = classKey(l); if (!colorOf.has(k)) colorOf.set(k, PALETTE[colorOf.size % PALETTE.length]); } }
  const st = weekStats(profile);
  const dayTimes = profile.dayTimes || {};
  const hasDayTimes = Object.keys(dayTimes).length > 0;

  const head = cols.map((p) => p.kind === 'break'
    ? '<th class="brk-h"></th>'
    : `<th><b>${esc(p.label || p.no)}</b>${p.start ? `<small>${esc(fmtTime(p.start, h24))} – ${esc(fmtTime(p.end, h24))}</small>` : ''}</th>`).join('');

  const rows = days.map((d) => {
    const cells = cols.map((p, i) => {
      if (p.kind === 'break') return i === cols.findIndex((x) => x.id === p.id) && d === days[0] ? `<td class="brk" rowspan="${days.length}"><span>${esc(p.name || 'استراحة')}</span></td>` : '';
      const l = (profile.lessons[d] || {})[p.id];
      const own = dayTimes[d] && dayTimes[d][p.id];
      const time = own ? `<i class="own">${esc(fmtTime(own.start, h24))}</i>` : '';
      if (!l) return `<td class="free">${time}</td>`;
      const [bg, fg] = t === 'colorful' ? colorOf.get(classKey(l)) || PALETTE[0] : [];
      const subj = showSubject && l.subject && l.subject !== profile.subject ? `<em>${esc(l.subject)}</em>` : '';
      return `<td class="on"${bg ? ` style="--c-bg:${bg};--c-fg:${fg}"` : ''}><div class="cell"><strong>${esc(shortClass(l) || l.subject || 'حصة')}</strong>${subj}${showRoom && l.room ? `<span class="room">${esc(l.room)}</span>` : ''}${showNotes && l.note ? `<span class="note">${esc(l.note)}</span>` : ''}${time}</div></td>`;
    }).join('');
    return `<tr><th class="day">${esc(DAY_NAMES[d])}</th>${cells}</tr>`;
  }).join('');

  const meta = [
    profile.teacher && ['المعلم/ة', profile.teacher], profile.subject && ['المادة', profile.subject],
    profile.year && ['العام الدراسي', profile.year], profile.semester && ['الفصل الدراسي', profile.semester],
  ].filter(Boolean);
  const legend = t === 'colorful' && colorOf.size > 1
    ? `<div class="legend">${[...colorOf.entries()].filter(([k]) => k).slice(0, 10).map(([k, [bg, fg]]) => `<span style="background:${bg};color:${fg}">${esc(k.replace(/^الصف\s*/, 'الصف '))}</span>`).join('')}</div>` : '';
  const hrs = Math.floor(st.minutes / 60), mins = st.minutes % 60;
  const stats = showStats ? `<div class="stats"><span>عدد الحصص الأسبوعية: <b>${st.lessons}</b></span><span>زمن التدريس: <b>${hrs ? `${hrs} س` : ''}${hrs && mins ? ' و' : ''}${mins ? `${mins} د` : hrs ? '' : '0'}</b></span><span>أيام العمل: <b>${days.length}</b></span>${hasDayTimes ? '<span class="own-key"><i class="own">8:00</i> توقيت خاص بذلك اليوم</span>' : ''}</div>` : '';

  const html = `<div class="cat-sheet t-${t}" dir="rtl" lang="ar">
<div class="frame">
<header>
  ${profile.schoolLogo ? `<img class="logo" src="${esc(profile.schoolLogo)}" alt="">` : '<div class="logo-ph"></div>'}
  <div class="titles">
    <div class="school">${esc(profile.school || 'اسم المدرسة')}</div>
    <h1>الجدول الدراسي الأسبوعي</h1>
  </div>
  <div class="meta">${meta.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
</header>
<table><thead><tr><th class="corner">اليوم</th>${head}</tr></thead><tbody>${rows}</tbody></table>
<footer>${stats}${legend}<div class="brand">${esc(brandLine)}</div></footer>
</div></div>`;
  return { html, css: SHEET_CSS, width: SHEET_W, height: SHEET_H, template: t };
}

export const SHEET_CSS = `
.cat-sheet{width:${SHEET_W}px;height:${SHEET_H}px;box-sizing:border-box;padding:26px 30px;font-family:'Cairo','Segoe UI',Tahoma,'Noto Sans Arabic',sans-serif;color:#13243a;background:#fff;position:relative;overflow:hidden;
  --ink:#13243a;--muted:#5b6b80;--line:#c9d3df;--head:#113f67;--head-ink:#fff;--accent:#b8913a;--cell:#f4f8fc;--free:#fff;--brk:#eef2f6}
.cat-sheet *{box-sizing:border-box}
.cat-sheet .frame{height:100%;display:flex;flex-direction:column;gap:14px}
.cat-sheet header{display:grid;grid-template-columns:90px 1fr auto;align-items:center;gap:18px}
.cat-sheet .logo{width:84px;height:84px;object-fit:contain}
.cat-sheet .logo-ph{width:84px;height:84px}
.cat-sheet .titles{text-align:center}
.cat-sheet .school{font-size:22px;font-weight:800;color:var(--head);line-height:1.4}
.cat-sheet h1{margin:2px 0 0;font-size:30px;font-weight:900;letter-spacing:0;line-height:1.35}
.cat-sheet .meta{display:grid;grid-template-columns:auto auto;gap:3px 14px;font-size:13.5px;min-width:250px}
.cat-sheet .meta div{display:contents}
.cat-sheet .meta span{color:var(--muted);font-weight:600}
.cat-sheet .meta b{font-weight:800}
.cat-sheet table{width:100%;flex:1;border-collapse:separate;border-spacing:0;table-layout:fixed;border:1.5px solid var(--line);border-radius:12px;overflow:hidden}
.cat-sheet th,.cat-sheet td{border-inline-start:1px solid var(--line);border-bottom:1px solid var(--line);text-align:center;vertical-align:middle;padding:4px}
.cat-sheet tr>*:first-child{border-inline-start:0}
.cat-sheet tbody tr:last-child>*{border-bottom:0}
.cat-sheet thead th{background:var(--head);color:var(--head-ink);height:58px;font-size:15px}
.cat-sheet thead th b{display:block;font-weight:800;line-height:1.3}
.cat-sheet thead th small{display:block;font-size:11.5px;opacity:.85;font-weight:600;direction:rtl}
.cat-sheet .corner{width:96px}
.cat-sheet .day{background:var(--cell);font-size:17px;font-weight:900;color:var(--head);width:96px}
.cat-sheet thead .brk-h{width:46px;padding:0}
.cat-sheet .brk-h span,.cat-sheet td.brk span{writing-mode:vertical-rl;font-size:14px;font-weight:800;letter-spacing:1px}
.cat-sheet td.brk{background:var(--brk);color:var(--muted);width:46px;padding:0}
.cat-sheet td.on{background:var(--c-bg,var(--cell))}
.cat-sheet td.free{background:var(--free)}
.cat-sheet .cell{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;line-height:1.3}
.cat-sheet .cell strong{font-size:20px;font-weight:900;color:var(--c-fg,var(--ink));white-space:nowrap}
.cat-sheet .cell em{font-style:normal;font-size:12px;font-weight:700;color:var(--muted)}
.cat-sheet .cell .room{font-size:11.5px;color:var(--muted)}
.cat-sheet .cell .note{font-size:11px;color:var(--muted);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cat-sheet i.own{font-style:normal;font-size:11px;font-weight:700;color:#9a3412;background:#ffedd5;border-radius:6px;padding:0 5px;display:inline-block}
.cat-sheet footer{display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--muted)}
.cat-sheet .stats{display:flex;gap:18px;flex-wrap:wrap}
.cat-sheet .stats b{color:var(--ink)}
.cat-sheet .legend{display:flex;gap:6px;flex-wrap:wrap}
.cat-sheet .legend span{border-radius:999px;padding:1px 10px;font-weight:800;font-size:12px}
.cat-sheet .brand{margin-inline-start:auto;font-size:11px;opacity:.7;direction:ltr}
/* رسمي */
.cat-sheet.t-official{padding:20px}
.cat-sheet.t-official .frame{border:3px double var(--head);border-radius:6px;padding:16px 20px;position:relative}
.cat-sheet.t-official .frame::after{content:'';position:absolute;inset:5px;border:1px solid var(--accent);border-radius:3px;pointer-events:none}
.cat-sheet.t-official h1{color:var(--head)}
.cat-sheet.t-official h1::after{content:'';display:block;width:120px;height:3px;margin:4px auto 0;background:var(--accent);border-radius:2px}
.cat-sheet.t-official table{border-radius:4px}
/* عصري */
.cat-sheet.t-modern{--head:#226597;--cell:#eef6fb;--line:#d6e4ef;background:linear-gradient(180deg,#f7fbff,#fff 40%)}
.cat-sheet.t-modern header{background:linear-gradient(120deg,#113f67,#226597 55%,#3a8fb7);color:#fff;border-radius:18px;padding:12px 18px}
.cat-sheet.t-modern .school,.cat-sheet.t-modern h1{color:#fff}
.cat-sheet.t-modern .meta span{color:#cfe3f2}
.cat-sheet.t-modern table{border:0;border-spacing:5px;border-collapse:separate}
.cat-sheet.t-modern th,.cat-sheet.t-modern td{border:0;border-radius:10px}
.cat-sheet.t-modern thead th{background:#e3eff8;color:#113f67}
.cat-sheet.t-modern td.free{background:#fafcfe;outline:1px dashed #dbe6ef;outline-offset:-1px}
.cat-sheet.t-modern td.on{box-shadow:inset 0 0 0 1px #cfe0ec}
/* طباعة */
.cat-sheet.t-print{--head:#fff;--head-ink:#000;--ink:#000;--muted:#333;--line:#000;--cell:#fff;--brk:#f2f2f2}
.cat-sheet.t-print table{border:2px solid #000;border-radius:0}
.cat-sheet.t-print thead th{border-bottom:2px solid #000}
.cat-sheet.t-print .school{color:#000}
.cat-sheet.t-print .day{color:#000}
/* ملوّن */
.cat-sheet.t-colorful{--head:#4c1d95;--cell:#faf5ff;--line:#e9d5ff;background:radial-gradient(circle at 0 0,#fdf4ff,#fff 45%)}
.cat-sheet.t-colorful thead th{background:linear-gradient(180deg,#6d28d9,#4c1d95)}
.cat-sheet.t-colorful .day{color:#4c1d95}
`;

/** صفوف بيانات جدولية (للتصدير إلى Excel وWord) */
export function sheetRows(profile, { h24 = false } = {}) {
  const days = profile.days;
  const cols = profile.periods.filter((p) => p.start || p.kind === 'lesson');
  const header = ['اليوم', ...cols.map((p) => (p.kind === 'break' ? p.name || 'استراحة' : `${p.label}${p.start ? `\n${fmtTime(p.start, h24)} – ${fmtTime(p.end, h24)}` : ''}`))];
  const rows = days.map((d) => [DAY_NAMES[d], ...cols.map((p) => {
    if (p.kind === 'break') return '';
    const l = (profile.lessons[d] || {})[p.id];
    if (!l) return '';
    return [shortClass(l) || l.subject, l.subject && l.subject !== profile.subject && shortClass(l) ? l.subject : '', l.room].filter(Boolean).join('\n');
  })]);
  return { header, rows, cols };
}

/** قائمة مسطحة (حصة لكل صف) — أسهل لإعادة الاستيراد والتعديل في Excel */
export function listRows(profile) {
  const out = [['اليوم', 'الحصة', 'من', 'إلى', 'المادة', 'الصف', 'الشعبة', 'القاعة', 'ملاحظة']];
  for (const d of profile.days) {
    const dt = (profile.dayTimes || {})[d] || {};
    for (const p of profile.periods) {
      const l = (profile.lessons[d] || {})[p.id];
      if (p.kind !== 'lesson' || !l) continue;
      const t = dt[p.id] || p;
      out.push([DAY_NAMES[d], p.no, t.start, t.end, l.subject || profile.subject, String(l.grade || '').replace(/^الصف\s*/, ''), l.section, l.room, l.note]);
    }
  }
  return out;
}

export const minutesBetween = (a, b) => (parseHHMM(b) ?? 0) - (parseHHMM(a) ?? 0);
