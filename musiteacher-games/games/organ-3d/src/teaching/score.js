// =====================================================================
//  رسم النوتة الموسيقية (Canvas 2D) — يُستعمل في الكتاب على حامل النوتة (قوام ثلاثي الأبعاد) وفي لوحة «النوتة» للطلاب.
//  مدرج حقيقي: مفتاح صول لليد اليمنى، مفتاح فا لليد اليسرى، أو المدرج المزدوج لليدين؛ ميزان ٤/٤ وخطوط المازورات وأرقامها،
//  أشكال النغمات بحسب المدة (مستديرة، بيضاء، سوداء، سوداء مع نقطة، كروش)، الخطوط الإضافية، والعلامة ♯.
//  ترقيم الأصابع تحت النغمات بالأرقام 1–5 كما في نماذج كتب المنهج (دليل المعلم للصف الرابع والخامس)،
//  وأسماء النغمات اختيارية فوق المدرج (عربية أو غربية، لا يُخلط بينهما).
//  كل الأشكال مرسومة بمسارات (لا تعتمد على خطوط موسيقية قد لا تتوفر في الجهاز).
// =====================================================================
import { pc, noteName } from '../instrument/organ-data.js';

const LETTER = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];          // درجة الحرف لكل نغمة (C=0 … B=6)، والدييز على درجة الطبيعي
const SHARP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const stepOf = (m) => (Math.floor(m / 12) - 1) * 7 + LETTER[pc(m)];
const STAFF = { treble: { bottom: stepOf(64) }, bass: { bottom: stepOf(43) } };   // الخط الأول: مي٤ / صول٢

// ---------- المفاتيح الموسيقية (بوحدات المسافة بين خطين، s) ----------
function trebleClef(x, cx, gy, s) {               // gy = خط صول (الخط الثاني من أسفل)
  const P = (a, b) => [cx + a * s, gy + b * s];
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath();
  x.moveTo(...P(0.12, 0.15));
  x.bezierCurveTo(...P(-0.55, 0.1), ...P(-0.45, -0.85), ...P(0.25, -0.8));          // دوامة حول خط صول
  x.bezierCurveTo(...P(1.05, -0.75), ...P(1.15, 0.55), ...P(0.2, 0.75));
  x.bezierCurveTo(...P(-0.85, 0.85), ...P(-1.05, -0.35), ...P(-0.45, -1.15));
  x.bezierCurveTo(...P(0.1, -1.85), ...P(0.75, -2.55), ...P(0.62, -3.55));            // صعود إلى الحلقة العليا
  x.bezierCurveTo(...P(0.52, -4.35), ...P(-0.2, -4.2), ...P(-0.12, -3.25));
  x.bezierCurveTo(...P(-0.05, -2.3), ...P(0.35, 0.6), ...P(0.42, 1.55));              // الساق النازلة
  x.bezierCurveTo(...P(0.48, 2.2), ...P(-0.15, 2.45), ...P(-0.45, 2.05));
  x.lineWidth = s * 0.2; x.stroke();
  x.beginPath(); x.arc(...P(-0.32, 1.85), s * 0.3, 0, Math.PI * 2); x.fill();
  x.restore();
}
function bassClef(x, cx, fy, s) {                  // fy = خط فا (الخط الرابع من أسفل)
  const P = (a, b) => [cx + a * s, fy + b * s];
  x.save(); x.lineCap = 'round';
  x.beginPath(); x.arc(...P(-0.35, 0.05), s * 0.32, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(...P(-0.62, -0.05));
  x.bezierCurveTo(...P(-0.55, -1.15), ...P(1.25, -1.2), ...P(1.05, 0.35));
  x.bezierCurveTo(...P(0.95, 1.45), ...P(0.1, 2.35), ...P(-0.7, 2.75));
  x.lineWidth = s * 0.24; x.stroke();
  x.beginPath(); x.arc(...P(1.55, -0.5), s * 0.16, 0, Math.PI * 2); x.arc(...P(1.55, 0.5), s * 0.16, 0, Math.PI * 2); x.fill();
  x.restore();
}
function sharp(x, cx, cy, s) {
  x.save(); x.lineWidth = s * 0.12;
  x.beginPath(); x.moveTo(cx - 0.18 * s, cy - 1.2 * s); x.lineTo(cx - 0.18 * s, cy + 1.3 * s); x.moveTo(cx + 0.18 * s, cy - 1.3 * s); x.lineTo(cx + 0.18 * s, cy + 1.2 * s); x.stroke();
  x.lineWidth = s * 0.3;
  x.beginPath(); x.moveTo(cx - 0.45 * s, cy - 0.3 * s); x.lineTo(cx + 0.45 * s, cy - 0.6 * s); x.moveTo(cx - 0.45 * s, cy + 0.55 * s); x.lineTo(cx + 0.45 * s, cy + 0.25 * s); x.stroke();
  x.restore();
}

/**
 * يرسم نوتة تمرين.
 * @param x     سياق Canvas 2D
 * @param box   { x, y, w, h } منطقة الرسم
 * @param opt   { events, hands: 'R'|'L'|'B', title, bpm, fingers: true, names: 'off'|'ar'|'en'…, hi: Set(أحداث مضاءة), ink, hiColor, paper }
 * @returns { rows, perRow } معلومات التخطيط
 */
export function drawScore(x, box, opt) {
  if (!(box.w > 40 && box.h > 30)) return { rows: 0, perRow: 0 };          // لوحة مخفية أو لم تُقَس بعد
  const ev = (opt.events || []).slice().sort((a, b) => a.t - b.t);
  const hands = opt.hands || 'R';
  const staves = hands === 'B' ? ['treble', 'bass'] : [hands === 'L' ? 'bass' : 'treble'];
  const staffOf = (e) => (hands === 'B' ? (e.hand === 'L' ? 'bass' : 'treble') : staves[0]);
  const ink = opt.ink || '#1b1b1b', hiC = opt.hiColor || '#18a14a';
  const total = Math.max(4, Math.ceil(Math.max(...ev.map((e) => e.t + e.d), 4) / 4) * 4), bars = total / 4;
  // التخطيط: صف أو أكثر، حتى ٤ مازورات في الصف (وأقل في المساحات الضيقة)
  const titleH = opt.title ? box.h * 0.12 : 0;
  const maxBarsRow = Math.max(1, Math.min(opt.barsPerRow || 4, Math.floor(box.w / (box.h * 0.55))));
  const rows = Math.ceil(bars / maxBarsRow), perRow = Math.ceil(bars / rows);
  const rowH = (box.h - titleH) / rows;
  const sysStaffs = staves.length;
  // مسافة الخطوط: تتسع لاسم النغمة فوق المدرج وأرقام الأصابع تحته والخطوط الإضافية
  const s = Math.max(1, Math.min(rowH / (sysStaffs * 4 + (sysStaffs - 1) * 6 + 11.5), box.w / (perRow * 4 * 3.2 + 9)));
  x.save();
  x.fillStyle = ink; x.strokeStyle = ink;
  if (opt.title) {
    x.font = `700 ${Math.round(titleH * 0.62)}px Tajawal,Tahoma,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    x.fillText(opt.title, box.x + box.w / 2, box.y + titleH * 0.5); x.direction = 'ltr';
  }
  const nameMode = opt.names || 'off', lang = nameMode.startsWith('en') ? 'en' : 'ar', oct = nameMode.endsWith('oct');
  for (let r = 0; r < rows; r++) {
    const b0 = r * perRow, b1 = Math.min(bars, b0 + perRow);
    const top0 = box.y + titleH + r * rowH + (r === 0 && opt.bpm ? 5.4 : 3.8) * s;   // أعلى خط في المدرج الأول (فوقه السرعة وأسماء النغمات)
    const x0 = box.x + 0.4 * s, xClefEnd = x0 + (r === 0 ? 6.0 : 4.0) * s, xEnd = box.x + box.w - 0.6 * s;
    const beatW = (xEnd - xClefEnd) / ((b1 - b0) * 4 + 0.3);
    const staffTop = (k) => top0 + k * (4 + 6) * s;
    const yOf = (st, step) => staffTop(staves.indexOf(st)) + 4 * s - (step - STAFF[st].bottom) * s / 2;
    // الخطوط الخمسة
    x.lineWidth = Math.max(1, s * 0.1);
    staves.forEach((st, k) => { for (let l = 0; l < 5; l++) { const y = staffTop(k) + l * s; x.beginPath(); x.moveTo(x0, y); x.lineTo(xEnd, y); x.stroke(); } });
    // خط البداية الذي يجمع المدرجين، والقوس
    if (sysStaffs > 1) { x.beginPath(); x.moveTo(x0, staffTop(0)); x.lineTo(x0, staffTop(1) + 4 * s); x.stroke(); }
    // المفاتيح الموسيقية والميزان
    staves.forEach((st, k) => {
      if (st === 'treble') trebleClef(x, x0 + 1.25 * s, staffTop(k) + 3 * s, s); else bassClef(x, x0 + 1.15 * s, staffTop(k) + 1 * s, s);
      if (r === 0) { x.font = `800 ${Math.round(2.1 * s)}px Georgia,"Times New Roman",serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('4', x0 + 4.4 * s, staffTop(k) + 1 * s); x.fillText('4', x0 + 4.4 * s, staffTop(k) + 3 * s); }
    });
    // السرعة فوق المازورة الأولى
    if (r === 0 && opt.bpm) { x.font = `600 ${Math.round(1.25 * s)}px Georgia,serif`; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; const ty = top0 - 3.9 * s; noteHead(x, x0 + 0.6 * s, ty, s * 0.55, true); x.fillRect(x0 + 0.6 * s + 0.31 * s, ty - 1.8 * s, 0.1 * s, 1.8 * s); x.fillText(' = ' + opt.bpm, x0 + 1.1 * s, ty + 0.4 * s); }
    // خطوط المازورات وأرقامها
    for (let b = b0; b <= b1; b++) {
      const bx = b === b1 ? xEnd : xClefEnd + (b - b0) * 4 * beatW - 0.15 * beatW + (b === b0 ? 0 : 0);
      if (b > b0 || r > 0) { x.lineWidth = Math.max(1, s * 0.12); x.beginPath(); x.moveTo(bx, staffTop(0)); x.lineTo(bx, staffTop(sysStaffs - 1) + 4 * s); x.stroke(); }
      if (b === bars) { x.lineWidth = s * 0.45; x.beginPath(); x.moveTo(bx - 0.3 * s, staffTop(0)); x.lineTo(bx - 0.3 * s, staffTop(sysStaffs - 1) + 4 * s); x.stroke(); }
      if (b < b1) { x.font = `italic 600 ${Math.round(1.1 * s)}px Georgia,serif`; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillText(String(b + 1), (b === b0 ? xClefEnd - 0.9 * s : bx + 0.15 * s), staffTop(0) - 0.45 * s); }
    }
    // صف ترقيم الأصابع لكل مدرج: مستوى واحد تحت المدرج (ينخفض فقط إن نزلت نغمة تحته)
    const fRow = staves.map((st, k) => { let y = staffTop(k) + 4 * s + 1.9 * s; for (const e of ev) { const bar = Math.floor(e.t / 4 + 1e-6); if (bar < b0 || bar >= b1 || staffOf(e) !== st) continue; y = Math.max(y, yOf(st, stepOf(e.midi)) + 2.1 * s); } return y; });
    // النغمات
    for (const e of ev) {
      const bar = Math.floor(e.t / 4 + 1e-6); if (bar < b0 || bar >= b1) continue;
      const st = staffOf(e), step = stepOf(e.midi), y = yOf(st, step), k = staves.indexOf(st);
      const nx = xClefEnd + (e.t - b0 * 4) * beatW + beatW * 0.42;
      const on = opt.hi && opt.hi.has(e);
      x.fillStyle = on ? hiC : ink; x.strokeStyle = on ? hiC : ink;
      if (on) { x.save(); x.globalAlpha = 0.18; x.fillRect(nx - beatW * 0.42, staffTop(k) - 2.6 * s, beatW * 0.92, 4 * s + 5.6 * s); x.restore(); }
      // الخطوط الإضافية
      const bot = STAFF[st].bottom, topS = bot + 8;
      x.lineWidth = Math.max(1, s * 0.12);
      for (let ls = bot - 2; ls >= step; ls -= 2) { const ly = yOf(st, ls); x.beginPath(); x.moveTo(nx - 0.95 * s, ly); x.lineTo(nx + 0.95 * s, ly); x.stroke(); }
      for (let ls = topS + 2; ls <= step; ls += 2) { const ly = yOf(st, ls); x.beginPath(); x.moveTo(nx - 0.95 * s, ly); x.lineTo(nx + 0.95 * s, ly); x.stroke(); }
      if (SHARP[pc(e.midi)]) sharp(x, nx - 1.55 * s, y, s);
      const d = e.d, open = d >= 1.9, whole = d >= 3.4, dotted = Math.abs(d - 1.5) < 0.01 || Math.abs(d - 3) < 0.01, eighth = d <= 0.55;
      noteHead(x, nx, y, s, !open);
      if (!whole) {
        const up = step < bot + 4, sx = up ? nx + 0.58 * s : nx - 0.58 * s, sy2 = up ? y - 3.4 * s : y + 3.4 * s;
        x.lineWidth = Math.max(1, s * 0.12); x.beginPath(); x.moveTo(sx, y); x.lineTo(sx, sy2); x.stroke();
        if (eighth) { x.lineWidth = s * 0.3; x.beginPath(); x.moveTo(sx, sy2); if (up) x.quadraticCurveTo(sx + 1.1 * s, sy2 + 1.2 * s, sx + 0.8 * s, sy2 + 2.6 * s); else x.quadraticCurveTo(sx + 1.1 * s, sy2 - 1.2 * s, sx + 0.8 * s, sy2 - 2.6 * s); x.stroke(); }
      }
      if (dotted) { x.beginPath(); x.arc(nx + 1.15 * s, y - (step % 2 === bot % 2 ? 0.5 * s : 0), 0.18 * s, 0, Math.PI * 2); x.fill(); }
      // ترقيم الأصابع تحت المدرج (كما في نماذج الكتاب)
      if (opt.fingers !== false && e.f) {
        x.font = `700 ${Math.round(1.35 * s)}px Arial,Helvetica,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(String(e.f), nx, fRow[k]);
      }
      // اسم النغمة (اختياري) فوق المدرج
      if (nameMode !== 'off') {
        const ny = Math.min(staffTop(k) - 2.0 * s, y - 1.9 * s);
        x.font = `600 ${Math.round(1.05 * s)}px Tajawal,Tahoma,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillStyle = on ? hiC : (opt.nameColor || '#6a5a45'); x.fillText(noteName(e.midi, lang, oct), nx, ny);
      }
    }
    x.fillStyle = ink; x.strokeStyle = ink;
  }
  x.restore();
  return { rows, perRow };
}
function noteHead(x, cx, cy, s, filled) {
  x.save(); x.translate(cx, cy); x.rotate(-0.38);
  x.beginPath(); x.ellipse(0, 0, 0.66 * s, 0.45 * s, 0, 0, Math.PI * 2);
  if (filled) x.fill(); else { x.lineWidth = Math.max(1, s * 0.16); x.stroke(); }
  x.restore();
}
