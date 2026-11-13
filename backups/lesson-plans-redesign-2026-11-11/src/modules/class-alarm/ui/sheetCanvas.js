// 🎨 رسم الجدول المنسق على Canvas مباشرة (للتصدير صورة PNG وPDF بدقة عالية).
// لماذا ليس لقطة من HTML؟ المتصفحات تمنع تصدير لوحة رُسم عليها HTML عبر SVG (Tainted canvas)،
// لذلك نرسم نفس التصميم بأوامر الرسم، بخط Cairo المحمّل في الصفحة، مع دعم كامل للعربية من اليمين لليسار.
import { DAY_NAMES, fmtTime } from '../core/time.js';
import { weekStats } from '../core/schedule.js';
import { shortClass, SHEET_W, SHEET_H } from '../core/sheet.js';

const PAL = [['#e0f2fe', '#0369a1'], ['#fce7f3', '#be185d'], ['#dcfce7', '#15803d'], ['#fef3c7', '#b45309'], ['#ede9fe', '#6d28d9'], ['#ffe4e6', '#be123c'], ['#ccfbf1', '#0f766e'], ['#e0e7ff', '#4338ca'], ['#fae8ff', '#a21caf'], ['#ecfccb', '#4d7c0f']];
const THEME = {
  official: { bg: '#ffffff', head: '#113f67', headInk: '#ffffff', ink: '#13243a', muted: '#5b6b80', line: '#c9d3df', cell: '#f4f8fc', day: '#f4f8fc', dayInk: '#113f67', brk: '#eef2f6', accent: '#b8913a', school: '#113f67' },
  modern: { bg: '#f7fbff', head: '#e3eff8', headInk: '#113f67', ink: '#13243a', muted: '#5b6b80', line: '#d6e4ef', cell: '#eef6fb', day: '#eef6fb', dayInk: '#226597', brk: '#eef2f6', accent: '#3a8fb7', school: '#ffffff', band: ['#113f67', '#226597', '#3a8fb7'] },
  print: { bg: '#ffffff', head: '#ffffff', headInk: '#000000', ink: '#000000', muted: '#333333', line: '#000000', cell: '#ffffff', day: '#ffffff', dayInk: '#000000', brk: '#f2f2f2', accent: '#000000', school: '#000000' },
  colorful: { bg: '#ffffff', head: '#4c1d95', headInk: '#ffffff', ink: '#13243a', muted: '#5b6b80', line: '#e9d5ff', cell: '#faf5ff', day: '#faf5ff', dayInk: '#4c1d95', brk: '#f5f0fb', accent: '#6d28d9', school: '#4c1d95' },
};
const FAMILY = "Cairo, 'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial, sans-serif";
const font = (w, px) => `${w} ${px}px ${FAMILY}`;

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
/** نص عربي متمركز مع تصغير تلقائي ليتسع للعرض */
function text(g, s, x, y, { w = 9999, px = 16, weight = 700, color = '#000', align = 'center', min = 8 } = {}) {
  if (!s) return;
  let size = px;
  g.font = font(weight, size);
  while (size > min && g.measureText(s).width > w) { size -= 0.5; g.font = font(weight, size); }
  g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText(s, x, y);
}

export async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  try { await Promise.all([400, 700, 800, 900].map((w) => document.fonts.load(font(w, 20), 'الجدول 123'))); } catch { /* خط النظام */ }
}

function loadImg(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }

export async function drawSheet(profile, { template = 'official', h24 = false, showRoom = true, showSubject = true, showNotes = false, showStats = true } = {}, scale = 3) {
  await ensureFonts();
  const th = THEME[template] || THEME.official;
  const c = document.createElement('canvas'); c.width = SHEET_W * scale; c.height = SHEET_H * scale;
  const g = c.getContext('2d'); g.scale(scale, scale);
  g.fillStyle = th.bg; g.fillRect(0, 0, SHEET_W, SHEET_H);
  const days = profile.days.length ? profile.days : [0, 1, 2, 3, 4];
  const cols = profile.periods.filter((p) => p.start || p.kind === 'lesson');
  const colorOf = new Map();
  for (const d of days) for (const p of cols) { const l = (profile.lessons[d] || {})[p.id]; if (l) { const k = String(l.grade || l.subject || '').trim(); if (!colorOf.has(k)) colorOf.set(k, PAL[colorOf.size % PAL.length]); } }

  let pad = 30, top = 26;
  if (template === 'official') {
    g.strokeStyle = th.head; g.lineWidth = 1.2; g.strokeRect(20, 20, SHEET_W - 40, SHEET_H - 40); g.strokeRect(24, 24, SHEET_W - 48, SHEET_H - 48);
    g.strokeStyle = th.accent; g.lineWidth = 1; g.strokeRect(29, 29, SHEET_W - 58, SHEET_H - 58);
    pad = 46; top = 40;
  }
  // الترويسة
  const H = 96, R = SHEET_W - pad, L = pad;
  if (template === 'modern') {
    const gr = g.createLinearGradient(R, top, L, top); th.band.forEach((col, i) => gr.addColorStop(i / (th.band.length - 1), col));
    g.fillStyle = gr; rr(g, L, top, R - L, H, 18); g.fill();
  }
  const metaInk = template === 'modern' ? '#ffffff' : th.ink, metaMuted = template === 'modern' ? '#cfe3f2' : th.muted;
  if (profile.schoolLogo) { const im = await loadImg(profile.schoolLogo); if (im) { const s = Math.min(80 / im.width, 80 / im.height); g.drawImage(im, R - 12 - im.width * s - (80 - im.width * s) / 2, top + 8 + (80 - im.height * s) / 2, im.width * s, im.height * s); } }
  const cx = SHEET_W / 2;
  text(g, profile.school || 'اسم المدرسة', cx, top + 30, { w: 520, px: 22, weight: 800, color: th.school });
  text(g, 'الجدول الدراسي الأسبوعي', cx, top + 66, { w: 520, px: 30, weight: 900, color: template === 'modern' ? '#ffffff' : template === 'print' ? '#000' : th.head });
  if (template === 'official') { g.fillStyle = th.accent; rr(g, cx - 60, top + 88, 120, 3, 1.5); g.fill(); }
  const meta = [['المعلم/ة', profile.teacher], ['المادة', profile.subject], ['العام الدراسي', profile.year], ['الفصل الدراسي', profile.semester]].filter((m) => m[1]);
  meta.forEach(([k, v], i) => {
    const y = top + 18 + i * 20 + (4 - meta.length) * 8;
    text(g, k, L + 255, y, { w: 90, px: 13, weight: 600, color: metaMuted, align: 'right' });
    text(g, v, L + 155, y, { w: 150, px: 13.5, weight: 800, color: metaInk, align: 'right' });
  });

  // الجدول
  const tTop = top + H + 14, footH = 30, tBot = SHEET_H - (template === 'official' ? 44 : 26) - footH;
  const dayW = 96, brkW = 46, headH = 58;
  const nBrk = cols.filter((p) => p.kind === 'break').length;
  const lesW = (R - L - dayW - nBrk * brkW) / Math.max(1, cols.length - nBrk);
  const rowH = (tBot - tTop - headH) / days.length;
  const gap = template === 'modern' ? 4 : 0;
  const xs = []; let x = R - dayW;
  for (const p of cols) { const w = p.kind === 'break' ? brkW : lesW; xs.push([x - w, w]); x -= w; }
  const box = (bx, by, bw, bh, fill) => {
    g.fillStyle = fill;
    if (gap) { rr(g, bx + gap / 2, by + gap / 2, bw - gap, bh - gap, 8); g.fill(); } else g.fillRect(bx, by, bw, bh);
  };
  // رأس الأعمدة
  box(R - dayW, tTop, dayW, headH, th.head);
  text(g, 'اليوم', R - dayW / 2, tTop + headH / 2, { px: 15, weight: 800, color: th.headInk });
  cols.forEach((p, i) => {
    const [bx, bw] = xs[i];
    box(bx, tTop, bw, headH, th.head);
    if (p.kind === 'break') return;
    text(g, p.label || String(p.no), bx + bw / 2, tTop + 20, { w: bw - 8, px: 15, weight: 800, color: th.headInk });
    if (p.start) text(g, `${fmtTime(p.start, h24)} – ${fmtTime(p.end, h24)}`, bx + bw / 2, tTop + 41, { w: bw - 6, px: 11.5, weight: 600, color: th.headInk });
  });
  // الصفوف
  days.forEach((d, ri) => {
    const y = tTop + headH + ri * rowH;
    box(R - dayW, y, dayW, rowH, th.day);
    text(g, DAY_NAMES[d], R - dayW / 2, y + rowH / 2, { w: dayW - 8, px: 17, weight: 900, color: th.dayInk });
    cols.forEach((p, i) => {
      const [bx, bw] = xs[i];
      if (p.kind === 'break') return;
      const l = (profile.lessons[d] || {})[p.id];
      const own = profile.dayTimes && profile.dayTimes[d] && profile.dayTimes[d][p.id];
      if (!l) { box(bx, y, bw, rowH, template === 'modern' ? '#fafcfe' : '#ffffff'); }
      else {
        const [bg, fg] = template === 'colorful' ? colorOf.get(String(l.grade || l.subject || '').trim()) || PAL[0] : [th.cell, th.ink];
        box(bx, y, bw, rowH, bg);
        const lines = [[shortClass(l) || l.subject || 'حصة', 20, 900, fg]];
        if (showSubject && l.subject && l.subject !== profile.subject && shortClass(l)) lines.push([l.subject, 12, 700, th.muted]);
        if (showRoom && l.room) lines.push([l.room, 11.5, 600, th.muted]);
        if (showNotes && l.note) lines.push([l.note, 11, 600, th.muted]);
        const lh = lines.map((t) => t[1] * 1.35), tot = lh.reduce((a, b) => a + b, 0);
        let yy = y + rowH / 2 - tot / 2;
        lines.forEach(([s, px, w, col], k) => { text(g, s, bx + bw / 2, yy + lh[k] / 2, { w: bw - 10, px, weight: w, color: col }); yy += lh[k]; });
      }
      if (own) {
        g.font = font(700, 11); const tw = g.measureText(fmtTime(own.start, h24)).width + 10;
        g.fillStyle = '#ffedd5'; rr(g, bx + 5, y + 5, tw, 16, 5); g.fill();
        text(g, fmtTime(own.start, h24), bx + 5 + tw / 2, y + 13.5, { px: 11, weight: 700, color: '#9a3412' });
      }
    });
  });
  // أعمدة الفسحة المدمجة
  cols.forEach((p, i) => {
    if (p.kind !== 'break') return;
    const [bx, bw] = xs[i];
    box(bx, tTop + headH, bw, rowH * days.length, th.brk);
    g.save(); g.translate(bx + bw / 2, tTop + headH + (rowH * days.length) / 2); g.rotate(Math.PI / 2);
    text(g, p.name || 'استراحة', 0, 0, { w: rowH * days.length - 20, px: 15, weight: 800, color: th.muted });
    g.restore();
  });
  // خطوط الشبكة
  if (!gap) {
    g.strokeStyle = th.line; g.lineWidth = template === 'print' ? 1 : 0.8;
    g.beginPath();
    for (let k = 0; k <= days.length; k++) { const y = tTop + headH + k * rowH; g.moveTo(L, y); g.lineTo(R, y); }
    g.moveTo(R - dayW, tTop); g.lineTo(R - dayW, tBot);
    xs.forEach(([bx]) => { g.moveTo(bx, tTop); g.lineTo(bx, tBot); });
    g.stroke();
    g.lineWidth = template === 'print' ? 2 : 1.5; g.strokeRect(L, tTop, R - L, tBot - tTop);
    // الفسحة تمر عبر الخطوط الأفقية: نعيد رسمها فوقها
    cols.forEach((p, i) => { if (p.kind !== 'break') return; const [bx, bw] = xs[i]; g.fillStyle = th.brk; g.fillRect(bx + 0.6, tTop + headH + 0.6, bw - 1.2, rowH * days.length - 1.2); g.save(); g.translate(bx + bw / 2, tTop + headH + (rowH * days.length) / 2); g.rotate(Math.PI / 2); text(g, p.name || 'استراحة', 0, 0, { w: rowH * days.length - 20, px: 15, weight: 800, color: th.muted }); g.restore(); });
  }
  // التذييل
  const fy = tBot + footH / 2 + 4;
  if (showStats) {
    const st = weekStats(profile); const hrs = Math.floor(st.minutes / 60), mins = st.minutes % 60;
    const s = `عدد الحصص الأسبوعية: ${st.lessons}     زمن التدريس: ${hrs ? `${hrs} س` : ''}${hrs && mins ? ' و' : ''}${mins ? `${mins} د` : hrs ? '' : '0'}     أيام العمل: ${days.length}`;
    text(g, s, R, fy, { w: 560, px: 13, weight: 700, color: th.muted, align: 'right' });
  }
  if (template === 'colorful' && colorOf.size > 1) {
    let lx = R - 580;
    for (const [k, [bg, fg]] of [...colorOf.entries()].filter(([k]) => k).slice(0, 6)) {
      const label = k.replace(/^الصف\s*/, 'الصف '); g.font = font(800, 12); const w = g.measureText(label).width + 18;
      if (lx - w < L + 90) break;
      g.fillStyle = bg; rr(g, lx - w, fy - 10, w, 20, 10); g.fill(); text(g, label, lx - w / 2, fy, { px: 12, weight: 800, color: fg }); lx -= w + 6;
    }
  }
  g.direction = 'ltr'; g.textAlign = 'left'; g.font = font(600, 11); g.fillStyle = th.muted; g.globalAlpha = 0.7; g.fillText('MusiTeacher', L, fy); g.globalAlpha = 1;
  return c;
}
