// منضّد النوتة: يحوّل نموذج الأغنية إلى عناصر رسم SVG (خطوط، مسارات، نصوص) بمواضع محسوبة.
// دالة نقية قابلة للاختبار خارج المتصفح؛ المكوّن ScoreView يرسم الناتج فقط.
import { TPQ, keySignature, printedAccidentals, beatUnit } from './notation.js';

const E4 = 30; // الموضع السلّمي لنغمة مي 4 (الخط الأول)
const SHARP_POS = { F: 8, C: 5, G: 9, D: 6, A: 3, E: 7, B: 4 };
const FLAT_POS = { B: 4, E: 7, A: 3, D: 6, G: 2, C: 5, F: 1 };

// ---------------------------------------------------------------- رموز (بوحدة المسافة بين خطين = 1)
const r2 = (n) => Math.round(n * 100) / 100;
function P(d, s, x, y) { // يحوّل مسارًا بوحدات المسافة إلى بكسل
  return d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, a, b) => `${r2(x + Number(a) * s)},${r2(y + Number(b) * s)}`);
}
// مفتاح صول: مركز الحلزون على خط صول (y=0)
const CLEF = 'M0.32,0.18 C0.28,-0.32 1.08,-0.42 1.16,0.12 C1.24,0.78 0.42,1.08 -0.08,0.78 C-0.7,0.4 -0.62,-0.62 0.02,-1.18 C0.62,-1.7 1.12,-2.5 1.02,-3.4 C0.94,-4.32 0.36,-4.36 0.24,-3.52 C0.14,-2.8 0.46,-0.6 0.64,1.0 L0.78,2.35 C0.86,3.02 0.28,3.22 -0.06,2.86';
const SHARP = (x, y, s) => [
  { t: 'line', x1: x - 0.24 * s, y1: y - 1.25 * s, x2: x - 0.24 * s, y2: y + 1.35 * s, w: 0.13 * s },
  { t: 'line', x1: x + 0.24 * s, y1: y - 1.35 * s, x2: x + 0.24 * s, y2: y + 1.25 * s, w: 0.13 * s },
  { t: 'line', x1: x - 0.55 * s, y1: y - 0.28 * s, x2: x + 0.55 * s, y2: y - 0.58 * s, w: 0.3 * s },
  { t: 'line', x1: x - 0.55 * s, y1: y + 0.58 * s, x2: x + 0.55 * s, y2: y + 0.28 * s, w: 0.3 * s },
];
const FLAT = (x, y, s) => [
  { t: 'line', x1: x - 0.32 * s, y1: y - 1.85 * s, x2: x - 0.32 * s, y2: y + 0.55 * s, w: 0.14 * s },
  { t: 'path', d: P('M-0.32,0.55 C0.75,0.05 0.72,-0.78 -0.32,-0.2 L-0.32,0.02 C0.32,-0.38 0.42,0.02 -0.32,0.4 Z', s, x, y), fill: true },
];
const NATURAL = (x, y, s) => [
  { t: 'line', x1: x - 0.28 * s, y1: y - 1.3 * s, x2: x - 0.28 * s, y2: y + 0.55 * s, w: 0.13 * s },
  { t: 'line', x1: x + 0.28 * s, y1: y - 0.55 * s, x2: x + 0.28 * s, y2: y + 1.3 * s, w: 0.13 * s },
  { t: 'line', x1: x - 0.28 * s, y1: y - 0.3 * s, x2: x + 0.28 * s, y2: y - 0.52 * s, w: 0.28 * s },
  { t: 'line', x1: x - 0.28 * s, y1: y + 0.52 * s, x2: x + 0.28 * s, y2: y + 0.3 * s, w: 0.28 * s },
];
// نصف بيمول بالعرف العربي: بيمول يقطع ساقَه خطٌّ مائل
const HALF_FLAT = (x, y, s) => [...FLAT(x, y, s), { t: 'line', x1: x - 0.75 * s, y1: y - 0.55 * s, x2: x + 0.1 * s, y2: y - 1.25 * s, w: 0.16 * s }];
// نصف دييز: دييز بساق واحدة
const HALF_SHARP = (x, y, s) => [
  { t: 'line', x1: x, y1: y - 1.3 * s, x2: x, y2: y + 1.3 * s, w: 0.13 * s },
  { t: 'line', x1: x - 0.45 * s, y1: y - 0.25 * s, x2: x + 0.45 * s, y2: y - 0.55 * s, w: 0.3 * s },
  { t: 'line', x1: x - 0.45 * s, y1: y + 0.55 * s, x2: x + 0.45 * s, y2: y + 0.25 * s, w: 0.3 * s },
];
const ACC = { 1: SHARP, '-1': FLAT, 0: NATURAL, '-0.5': HALF_FLAT, 0.5: HALF_SHARP };
const QUARTER_REST = 'M-0.2,-1.5 L0.42,-0.72 C0.08,-0.38 0.02,-0.08 0.4,0.38 L0.32,0.45 C-0.1,0.18 -0.3,0.5 0.12,1.3 C-0.48,0.9 -0.42,0.25 0.02,0.28 L-0.42,-0.3 C-0.06,-0.62 -0.02,-0.98 -0.28,-1.38 Z';
const FLAG_UP = 'M0,0 C0.1,0.9 1.25,1.35 1.05,2.75 C0.98,2.25 0.8,1.5 0,1.2 Z';
const FLAG_DOWN = 'M0,0 C0.1,-0.9 1.25,-1.35 1.05,-2.75 C0.98,-2.25 0.8,-1.5 0,-1.2 Z';

const isBeamable = (e) => e.kind === 'note' && e.base >= 8;

/**
 * @param {object} song  نموذج parseSong
 * @param {{width:number, sp?:number, measures?:number[], showNames?:boolean, showNumbers?:boolean, compact?:boolean, header?:boolean}} opt
 */
export function engrave(song, opt = {}) {
  const s = opt.sp || 10; const W = Math.max(240, opt.width || 900);
  const list = opt.measures || song.measures.map((_, i) => i);
  const sig = keySignature(song.key); const accTable = printedAccidentals(song);
  const beat = beatUnit(song.time);
  const hasCoda = song.measures.some((m) => m.coda); const hasFine = song.measures.some((m) => m.fine);
  const jumpText = hasCoda ? ' al Coda' : hasFine ? ' al Fine' : '';
  const headerW = (first) => s * (3.4 + sig.items.length * 1.05 + 0.6 + (first ? 2.6 : 0));
  // ---- عرض كل مازورة
  const MW = {};
  for (const mi of list) {
    const ms = song.measures[mi]; let w = s * 1.4;
    ms.events.forEach((e, ei) => {
      const q = e.dur / TPQ; let ew = s * (1.7 + 2.3 * Math.sqrt(q));
      if (accTable[mi][ei] !== null && accTable[mi][ei] !== undefined) ew += s * 1.1;
      if (e.dots) ew += s * 0.5 * e.dots;
      if (opt.showNames && e.kind === 'note') { const nm = opt.nameOf ? opt.nameOf(e) : ''; ew = Math.max(ew, s * 3.3, s * (0.9 + 0.56 * nm.length)); }
      if (e.graces) ew += s * 1.25 * e.graces.length + s * 0.4;
      e._w = ew; w += ew;
    });
    if (ms.startRepeat) w += s * 1.2; if (ms.endRepeat) w += s * 0.9;
    MW[mi] = w;
  }
  // ---- توزيع على أسطر
  const systems = []; let curr = []; let used = 0;
  list.forEach((mi, k) => {
    const hw = headerW(systems.length === 0 && opt.header !== false);
    if (curr.length && hw + used + MW[mi] > W - s) { systems.push(curr); curr = []; used = 0; }
    curr.push(mi); used += MW[mi];
    if (k === list.length - 1) systems.push(curr);
  });
  const topPad = s * (opt.compact ? 4.5 : 8.5); const botPad = s * (opt.compact ? 4 : (opt.showNames ? 8 : 6));
  const sysH = topPad + 4 * s + botPad;
  const items = []; const notes = []; const measureBoxes = []; const eventX = {};
  const tieStarts = [];

  systems.forEach((sysM, si) => {
    const y0 = si * sysH + topPad; const first = si === 0 && opt.header !== false;
    const yOf = (p) => y0 + (8 - p) * (s / 2);
    const hw = headerW(first); const natural = sysM.reduce((a, mi) => a + MW[mi], 0);
    const last = si === systems.length - 1;
    const scale = last && natural < (W - hw) * 0.7 ? 1 : (W - hw - s * 0.5) / natural;
    const right = last && scale === 1 ? hw + natural : W - s * 0.5;
    // خطوط المدرج
    for (let l = 0; l < 5; l++) items.push({ t: 'line', x1: 0, y1: y0 + l * s, x2: right, y2: y0 + l * s, w: Math.max(1, s * 0.1), c: 'staff' });
    items.push({ t: 'line', x1: 0, y1: y0, x2: 0, y2: y0 + 4 * s, w: Math.max(1, s * 0.12) });
    // المفتاح والدليل والميزان
    items.push({ t: 'path', d: P(CLEF, s, s * 1.15, y0 + 3 * s), stroke: s * 0.2, fillNone: true });
    items.push({ t: 'circle', cx: s * 1.15 - 0.12 * s, cy: y0 + 3 * s + 2.72 * s, r: s * 0.3 });
    let x = s * 3.2;
    sig.items.forEach(({ step: st, alter }) => { const p = (alter > 0 ? SHARP_POS : FLAT_POS)[st]; items.push(...ACC[alter](x + s * 0.5, yOf(p), s)); x += s * 1.05; });
    if (first) {
      const [n, d] = song.time.split('/');
      x += s * 0.7;
      items.push({ t: 'text', x: x + s * 0.8, y: y0 + 1.75 * s, text: n, size: s * 2.3, bold: true, serif: true, anchor: 'middle' });
      items.push({ t: 'text', x: x + s * 0.8, y: y0 + 3.75 * s, text: d, size: s * 2.3, bold: true, serif: true, anchor: 'middle' });
    }
    if (opt.showNumbers !== false && !opt.compact) items.push({ t: 'text', x: s * 0.2, y: y0 - s * 1.6, text: String(song.measures[sysM[0]].number), size: s * 1.15, c: 'muted' });
    let mx = hw;
    sysM.forEach((mi) => {
      const ms = song.measures[mi]; const mw = MW[mi] * scale; const box = { mi, x: mx, y: y0 - 2 * s, w: mw, h: 8 * s, sys: si };
      measureBoxes.push(box);
      let ex = mx + s * 1.0 * scale;
      if (ms.startRepeat) { // ‖: في بداية المازورة
        items.push({ t: 'line', x1: mx + s * 0.25, y1: y0, x2: mx + s * 0.25, y2: y0 + 4 * s, w: s * 0.5 });
        items.push({ t: 'line', x1: mx + s * 0.8, y1: y0, x2: mx + s * 0.8, y2: y0 + 4 * s, w: s * 0.13 });
        items.push({ t: 'circle', cx: mx + s * 1.3, cy: y0 + 1.5 * s, r: s * 0.22 }, { t: 'circle', cx: mx + s * 1.3, cy: y0 + 2.5 * s, r: s * 0.22 });
        ex += s * 1.2;
      }
      // خانة النهاية
      if (ms.volta) {
        const prevSame = list.indexOf(mi) > 0 && song.measures[mi - 1] && song.measures[mi - 1].volta === ms.volta && sysM.includes(mi - 1);
        const nextSame = song.measures[mi + 1] && song.measures[mi + 1].volta === ms.volta;
        const vy = y0 - s * 3.2;
        items.push({ t: 'line', x1: mx + s * 0.3, y1: vy, x2: mx + mw - s * 0.3, y2: vy, w: s * 0.12 });
        if (!prevSame) { items.push({ t: 'line', x1: mx + s * 0.3, y1: vy, x2: mx + s * 0.3, y2: vy + s * 1.6, w: s * 0.12 }); items.push({ t: 'text', x: mx + s * 0.7, y: vy + s * 1.35, text: `${ms.volta}.`, size: s * 1.25, serif: true, bold: true }); }
        if (!nextSame && ms.volta === 1) items.push({ t: 'line', x1: mx + mw - s * 0.3, y1: vy, x2: mx + mw - s * 0.3, y2: vy + s * 1.6, w: s * 0.12 });
      }
      if (ms.segno && !opt.compact) segno(items, mx + s * 1.2, y0 - s * 5.2, s);
      if (ms.coda && !opt.compact) coda(items, mx + s * 1.2, y0 - s * 5.2, s);
      const labels = opt.compact ? [] : ms.labels.slice(); const chords = ms.chords.slice();
      // تجميع العوارض
      const groups = beamGroups(ms, beat);
      const geo = [];
      ms.events.forEach((e, ei) => {
        const acc = accTable[mi][ei];
        const ax = acc !== null && acc !== undefined ? s * 1.1 * scale : 0;
        const gw = e.graces ? s * 1.25 * e.graces.length + s * 0.4 : 0;
        const cx = ex + gw + ax + s * 0.7; const evW = e._w * scale;
        eventX[mi + ':' + ei] = cx;
        for (const l of labels.filter((l) => l.at === ei)) items.push({ t: 'text', x: cx, y: y0 - s * (ms.volta ? 4.6 : 3.2), text: l.text, size: s * 1.25, bold: true, rtl: true, anchor: 'middle', c: 'label' });
        for (const c of chords.filter((c) => c.at === ei)) items.push({ t: 'text', x: cx - s * 0.4, y: y0 - s * (ms.volta ? 4.6 : 1.6) - (labels.some((l) => l.at === ei) ? s * 1.6 : 0), text: c.text, size: s * 1.35, serif: true, c: 'chord' });
        const g = { mi, ei, x: cx, items: [] };
        if (e.kind === 'rest') {
          const ry = yOf(4);
          if (e.base === 1) g.items.push({ t: 'rect', x: cx - s * 0.6, y: yOf(6), w: s * 1.2, h: s * 0.5 });
          else if (e.base === 2) g.items.push({ t: 'rect', x: cx - s * 0.6, y: yOf(4) - s * 0.5, w: s * 1.2, h: s * 0.5 });
          else if (e.base === 4) g.items.push({ t: 'path', d: P(QUARTER_REST, s, cx, ry), fill: true });
          else restFlags(g.items, cx, y0, s, e.base === 8 ? 1 : e.base === 16 ? 2 : 3);
          if (e.dots) g.items.push({ t: 'circle', cx: cx + s * 1.0, cy: yOf(5), r: s * 0.2 });
          notes.push({ ...g, kind: 'rest', y: ry });
          items.push({ t: 'group', key: `${mi}:${ei}`, mi, ei, kind: 'rest', items: g.items, hit: { x: cx - s, y: y0, w: s * 2, h: 4 * s } });
          geo.push(null);
        } else {
          const p = e.pos - E4; const y = yOf(p);
          // خطوط إضافية
          for (let lp = -2; lp >= p; lp -= 2) g.items.push({ t: 'line', x1: cx - s * 1.05, y1: yOf(lp), x2: cx + s * 1.05, y2: yOf(lp), w: s * 0.13 });
          for (let lp = 10; lp <= p; lp += 2) g.items.push({ t: 'line', x1: cx - s * 1.05, y1: yOf(lp), x2: cx + s * 1.05, y2: yOf(lp), w: s * 0.13 });
          if (acc !== null && acc !== undefined) g.items.push(...ACC[acc](cx - s * 1.55, y, s));
          const hollow = e.base <= 2;
          g.items.push({ t: 'head', cx, cy: y, rx: s * 0.62, ry: s * 0.44, hollow, sw: s * 0.16 });
          if (e.graces) graceGroup(g.items, e.graces, ex + s * 0.7, s, yOf);
          for (let k = 0; k < e.dots; k++) g.items.push({ t: 'circle', cx: cx + s * (1.05 + k * 0.5), cy: p % 2 === 0 ? y - s / 2 : y, r: s * 0.18 });
          const up = stemUp(groups, ei, ms, p);
          geo.push({ x: cx, y, p, up, e });
          notes.push({ ...g, kind: 'note', y, p });
          if (opt.showNames) g.items.push({ t: 'text', x: cx, y: y0 + 4 * s + s * (p <= -1 ? 4.6 : 3.2), text: opt.nameOf ? opt.nameOf(e) : '', size: s * 0.98, anchor: 'middle', rtl: true, c: 'name' });
          items.push({ t: 'group', key: `${mi}:${ei}`, mi, ei, kind: 'note', items: g.items, hit: { x: cx - s * 1.1, y: y - s * 1.2, w: s * 2.2, h: s * 2.4 } });
          if (e.tieNext) tieStarts.push({ mi, ei, x: cx, y, up, si });
          if (e.tiePrev) tieEnds(items, tieStarts, { mi, ei, x: cx, y, si }, s, yOf);
        }
        ex += evW;
      });
      // السيقان والعوارض والأعلام
      drawStems(items, ms, geo, groups, s, yOf);
      // نهاية المازورة
      const bx = mx + mw;
      if (ms.endRepeat) {
        items.push({ t: 'circle', cx: bx - s * 1.3, cy: y0 + 1.5 * s, r: s * 0.22 }, { t: 'circle', cx: bx - s * 1.3, cy: y0 + 2.5 * s, r: s * 0.22 });
        items.push({ t: 'line', x1: bx - s * 0.8, y1: y0, x2: bx - s * 0.8, y2: y0 + 4 * s, w: s * 0.13 });
        items.push({ t: 'line', x1: bx - s * 0.25, y1: y0, x2: bx - s * 0.25, y2: y0 + 4 * s, w: s * 0.5 });
      } else if (ms.bar === 'final') {
        items.push({ t: 'line', x1: bx - s * 0.75, y1: y0, x2: bx - s * 0.75, y2: y0 + 4 * s, w: s * 0.13 });
        items.push({ t: 'line', x1: bx - s * 0.25, y1: y0, x2: bx - s * 0.25, y2: y0 + 4 * s, w: s * 0.5 });
      } else if (ms.bar === 'double') {
        items.push({ t: 'line', x1: bx - s * 0.45, y1: y0, x2: bx - s * 0.45, y2: y0 + 4 * s, w: s * 0.13 });
        items.push({ t: 'line', x1: bx, y1: y0, x2: bx, y2: y0 + 4 * s, w: s * 0.13 });
      } else items.push({ t: 'line', x1: bx, y1: y0, x2: bx, y2: y0 + 4 * s, w: s * 0.13 });
      if (ms.fine) items.push({ t: 'text', x: bx - s * 0.3, y: y0 + 4 * s + s * 3.6, text: 'Fine', size: s * 1.35, serif: true, bold: true, italic: true, anchor: 'end' });
      if (ms.toCoda && !opt.compact) { coda(items, bx - s * 1.2, y0 - s * 5.2, s); items.push({ t: 'text', x: bx - s * 2.4, y: y0 - s * 4.8, text: 'To Coda', size: s * 1.05, serif: true, italic: true, anchor: 'end' }); }
      if ((ms.ds || ms.dc) && !opt.compact) {
        const fy = ms.fine ? y0 + 4 * s + s * 5.4 : y0 + 4 * s + s * 3.6;
        if (ms.ds && !hasCoda) segno(items, bx - s * 1.3, y0 - s * 5.2, s);
        items.push({ t: 'text', x: bx - s * 0.3, y: fy, text: (ms.dc ? 'D.C.' : 'D.S.') + jumpText, size: s * 1.2, serif: true, italic: true, bold: true, anchor: 'end' });
      }
      if (ms.dsSign && !opt.compact) { segno(items, bx - s * 1.3, y0 - s * 5.2, s); items.push({ t: 'text', x: bx - s * 0.3, y: y0 + 4 * s + s * 3.6, text: '؟ مسار الرجوع قيد المراجعة', size: s * 0.95, rtl: true, anchor: 'end', c: 'warn' }); }
      mx += mw;
    });
  });
  // أربطة لم تُغلق (لا يُفترض حدوثها)
  return { width: W, height: systems.length * sysH, sp: s, systems: systems.map((m, i) => ({ measures: m, y: i * sysH + topPad, h: sysH })), items, notes, measureBoxes, eventX };
}

/** نغمات الزينة: رؤوس صغيرة بسيقان صاعدة وعارضتين (دبل كروش) وقوس يصلها بالنغمة الأساسية */
function graceGroup(out, graces, x0, s, yOf) {
  const k = 0.62; const tops = []; const xs = [];
  graces.forEach((gr, i) => {
    const p = gr.pos - E4; const x = x0 + i * s * 1.25; const y = yOf(p);
    for (let lp = -2; lp >= p; lp -= 2) out.push({ t: 'line', x1: x - s * 0.7, y1: yOf(lp), x2: x + s * 0.7, y2: yOf(lp), w: s * 0.1 });
    for (let lp = 10; lp <= p; lp += 2) out.push({ t: 'line', x1: x - s * 0.7, y1: yOf(lp), x2: x + s * 0.7, y2: yOf(lp), w: s * 0.1 });
    if (gr.printed !== null && gr.printed !== undefined) out.push(...ACC[gr.printed](x - s * 1.0, y, s * k));
    out.push({ t: 'head', cx: x, cy: y, rx: s * 0.62 * k, ry: s * 0.44 * k, hollow: false, sw: s * 0.1 });
    const sx = x + s * 0.36; xs.push(sx); tops.push(y - s * 2.5);
    out.push({ t: 'line', x1: sx, y1: y, x2: sx, y2: y - s * 2.5, w: s * 0.09 });
  });
  const top = Math.min(...tops);
  if (graces.length > 1) {
    xs.forEach((sx, i) => out.push({ t: 'line', x1: sx, y1: tops[i], x2: sx, y2: top, w: s * 0.09 }));
    [0, s * 0.5].forEach((o) => out.push({ t: 'poly', pts: [[xs[0], top + o], [xs[xs.length - 1], top + o], [xs[xs.length - 1], top + o + s * 0.3], [xs[0], top + o + s * 0.3]] }));
  } else {
    out.push({ t: 'path', d: P(FLAG_UP, s * k, xs[0], top), fill: true });
    out.push({ t: 'line', x1: xs[0] - s * 0.55, y1: top + s * 1.6, x2: xs[0] + s * 0.55, y2: top + s * 0.7, w: s * 0.09 });
  }
}
function segno(items, x, y, s) {
  items.push({ t: 'text', x, y: y + s * 1.2, text: 'S', size: s * 2.4, serif: true, bold: true, italic: true, anchor: 'middle' });
  items.push({ t: 'line', x1: x - s * 0.9, y1: y + s * 0.7, x2: x + s * 0.9, y2: y - s * 1.1, w: s * 0.16 });
  items.push({ t: 'circle', cx: x - s * 0.85, cy: y - s * 0.55, r: s * 0.2 }, { t: 'circle', cx: x + s * 0.85, cy: y + s * 0.15, r: s * 0.2 });
}
function coda(items, x, y, s) {
  items.push({ t: 'ellipse', cx: x, cy: y, rx: s * 0.62, ry: s * 0.82, sw: s * 0.2 });
  items.push({ t: 'line', x1: x - s * 1.15, y1: y, x2: x + s * 1.15, y2: y, w: s * 0.14 }, { t: 'line', x1: x, y1: y - s * 1.3, x2: x, y2: y + s * 1.3, w: s * 0.14 });
}
function restFlags(out, cx, y0, s, n) {
  // سكتة الكروش/الدبل كروش: رأس صغير وساق مائلة
  const top = y0 + s * 1.5; const len = s * (1.3 + n * 0.9);
  out.push({ t: 'line', x1: cx + s * 0.45, y1: top - s * 0.1, x2: cx - s * 0.15 - (n - 1) * s * 0.18, y2: top + len, w: s * 0.15 });
  for (let k = 0; k < n; k++) {
    const yy = top + k * s; const xx = cx + s * 0.45 - k * s * 0.22;
    out.push({ t: 'circle', cx: xx - s * 0.62, cy: yy + s * 0.05, r: s * 0.26 });
    out.push({ t: 'path', d: P('M-0.62,0.2 C-0.3,0.5 0,0.25 0.05,-0.05 L0.12,0.02 C-0.04,0.42 -0.38,0.62 -0.66,0.35 Z', s, xx, yy), fill: true });
  }
}
/** مجموعات العوارض: نغمات أقصر من السوداء داخل النبضة نفسها (الثلاثية مجموعة واحدة) */
export function beamGroups(ms, beat) {
  const groups = []; let cur = []; let curKey = null;
  const flush = () => { if (cur.length >= 2) groups.push(cur); cur = []; curKey = null; };
  ms.events.forEach((e, ei) => {
    if (!isBeamable(e)) { flush(); return; }
    const key = e.tuplet ? 't' + e.tuplet.id : 'b' + Math.floor((e.start + 0.001) / beat);
    if (cur.length && key !== curKey) flush();
    cur.push(ei); curKey = key;
  });
  flush();
  return groups;
}
function stemUp(groups, ei, ms, p) {
  const g = groups.find((g) => g.includes(ei));
  if (!g) return p < 4;
  const avg = g.reduce((a, k) => a + (ms.events[k].pos - E4), 0) / g.length;
  return avg < 4;
}
function drawStems(items, ms, geo, groups, s, yOf) {
  const inGroup = new Set(groups.flat());
  geo.forEach((g, ei) => {
    if (!g || inGroup.has(ei) || g.e.base === 1) return;
    const len = s * 3.4; const mid = yOf(4);
    const sx = g.up ? g.x + s * 0.56 : g.x - s * 0.56;
    let ey = g.up ? Math.min(g.y - len, mid) : Math.max(g.y + len, mid);
    if (g.e.base >= 16 && g.up) ey -= s * 0.5; if (g.e.base >= 16 && !g.up) ey += s * 0.5;
    items.push({ t: 'line', x1: sx, y1: g.y + (g.up ? -s * 0.1 : s * 0.1), x2: sx, y2: ey, w: s * 0.12, tag: `${ms.index}:${ei}` });
    const flags = g.e.base === 8 ? 1 : g.e.base === 16 ? 2 : g.e.base === 32 ? 3 : 0;
    for (let k = 0; k < flags; k++) items.push({ t: 'path', d: P(g.up ? FLAG_UP : FLAG_DOWN, s, sx, ey + (g.up ? k * s * 0.85 : -k * s * 0.85)), fill: true, tag: `${ms.index}:${ei}` });
    if (g.e.tuplet && !inGroup.has(ei)) items.push({ t: 'text', x: g.x, y: g.up ? ey - s * 0.6 : ey + s * 1.6, text: '3', size: s * 1.2, serif: true, bold: true, italic: true, anchor: 'middle' });
  });
  groups.forEach((grp) => {
    const gs = grp.map((ei) => geo[ei]); const up = gs[0].up; const dir = up ? -1 : 1;
    const xs = gs.map((g) => (up ? g.x + s * 0.56 : g.x - s * 0.56));
    const nat = gs.map((g) => g.y + dir * s * 3.3);
    let slope = (nat[nat.length - 1] - nat[0]) / Math.max(1, xs[xs.length - 1] - xs[0]);
    slope = Math.max(-0.22, Math.min(0.22, slope)) * 0.6;
    const lineAt = (x, b) => b + slope * (x - xs[0]);
    let b = nat[0];
    // كل ساق لا تقل عن 2.6 مسافة
    gs.forEach((g, k) => { const need = g.y + dir * s * 2.6; const at = lineAt(xs[k], b); if (up ? at > need : at < need) b += need - at; });
    // لا تعبر العارضة الخط الأوسط باتجاه الرؤوس كثيرًا
    gs.forEach((g, k) => items.push({ t: 'line', x1: xs[k], y1: g.y + dir * s * 0.1, x2: xs[k], y2: lineAt(xs[k], b), w: s * 0.12 }));
    const th = s * 0.48; const gap = s * 0.78;
    beamSeg(items, xs[0], xs[xs.length - 1], lineAt, b, th, up);
    // العارضة الثانية (دبل كروش)
    const lvl = gs.map((g) => (g.e.base >= 16 ? 2 : 1));
    const b2 = b - dir * gap;
    for (let k = 0; k < gs.length; k++) {
      if (lvl[k] < 2) continue;
      if (k + 1 < gs.length && lvl[k + 1] >= 2) { beamSeg(items, xs[k], xs[k + 1], lineAt, b2, th, up); continue; }
      if (k > 0 && lvl[k - 1] >= 2) continue;
      // عارضة قصيرة: نحو السابق إن كانت نقطةً في نهاية المجموعة، وإلا نحو اللاحق
      const toPrev = k === gs.length - 1 || (k > 0 && gs[k - 1].e.dots);
      const x1 = toPrev ? xs[k] - s * 1.1 : xs[k]; const x2 = toPrev ? xs[k] : xs[k] + s * 1.1;
      beamSeg(items, x1, x2, lineAt, b2, th, up);
    }
    if (gs[0].e.tuplet && gs.every((g) => g.e.tuplet && g.e.tuplet.id === gs[0].e.tuplet.id)) {
      const xm = (xs[0] + xs[xs.length - 1]) / 2; items.push({ t: 'text', x: xm, y: lineAt(xm, b) + (up ? -s * 0.9 : s * 2.0), text: '3', size: s * 1.25, serif: true, bold: true, italic: true, anchor: 'middle' });
    }
  });
}
function beamSeg(items, x1, x2, lineAt, b, th, up) {
  const y1 = lineAt(x1, b), y2 = lineAt(x2, b); const o = up ? th : -th;
  items.push({ t: 'poly', pts: [[x1, y1], [x2, y2], [x2, y2 + o], [x1, y1 + o]] });
}
function tieEnds(items, starts, end, s, yOf) {
  const st = starts.pop(); if (!st) return;
  const dir = st.up ? 1 : -1; // الرباط عكس اتجاه الساق
  const arc = (x1, x2, y) => { const h = Math.min(s * 1.4, Math.max(s * 0.6, (x2 - x1) * 0.12)) * dir; const yy = y + dir * s * 0.7;
    return { t: 'path', d: `M${r2(x1)},${r2(yy)} C${r2(x1 + (x2 - x1) * 0.25)},${r2(yy + h)} ${r2(x2 - (x2 - x1) * 0.25)},${r2(yy + h)} ${r2(x2)},${r2(yy)} C${r2(x2 - (x2 - x1) * 0.25)},${r2(yy + h * 0.72)} ${r2(x1 + (x2 - x1) * 0.25)},${r2(yy + h * 0.72)} ${r2(x1)},${r2(yy)} Z`, fill: true };
  };
  if (st.si === end.si) items.push(arc(st.x + s * 0.5, end.x - s * 0.5, st.y));
  else { items.push(arc(st.x + s * 0.5, st.x + s * 3.5, st.y)); items.push(arc(end.x - s * 3.5, end.x - s * 0.5, end.y)); }
}

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** تحويل الرسم إلى نص SVG (للصور المصغرة والاختبارات) */
export function toSvgString(lay, { ink = '#111', muted = '#777', label = '#9f1239', chord = '#1d4ed8', warn = '#b45309', staff } = {}) {
  const col = (c) => (c === 'muted' ? muted : c === 'label' ? label : c === 'chord' ? chord : c === 'warn' ? warn : c === 'staff' ? (staff || ink) : ink);
  const one = (it) => {
    switch (it.t) {
      case 'line': return `<line x1="${r2(it.x1)}" y1="${r2(it.y1)}" x2="${r2(it.x2)}" y2="${r2(it.y2)}" stroke="${col(it.c)}" stroke-width="${r2(it.w)}"/>`;
      case 'circle': return `<circle cx="${r2(it.cx)}" cy="${r2(it.cy)}" r="${r2(it.r)}" fill="${ink}"/>`;
      case 'rect': return `<rect x="${r2(it.x)}" y="${r2(it.y)}" width="${r2(it.w)}" height="${r2(it.h)}" fill="${ink}"/>`;
      case 'ellipse': return `<ellipse cx="${r2(it.cx)}" cy="${r2(it.cy)}" rx="${r2(it.rx)}" ry="${r2(it.ry)}" fill="none" stroke="${ink}" stroke-width="${r2(it.sw)}"/>`;
      case 'head': return it.hollow
        ? `<ellipse cx="${r2(it.cx)}" cy="${r2(it.cy)}" rx="${r2(it.rx * 0.9)}" ry="${r2(it.ry * 0.82)}" transform="rotate(-22 ${r2(it.cx)} ${r2(it.cy)})" fill="none" stroke="${ink}" stroke-width="${r2(it.sw)}"/>`
        : `<ellipse cx="${r2(it.cx)}" cy="${r2(it.cy)}" rx="${r2(it.rx)}" ry="${r2(it.ry)}" transform="rotate(-22 ${r2(it.cx)} ${r2(it.cy)})" fill="${ink}"/>`;
      case 'path': return it.fillNone ? `<path d="${it.d}" fill="none" stroke="${ink}" stroke-width="${r2(it.stroke)}" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="${it.d}" fill="${ink}"/>`;
      case 'poly': return `<polygon points="${it.pts.map((p) => p.map(r2).join(',')).join(' ')}" fill="${ink}"/>`;
      case 'text': return `<text x="${r2(it.x)}" y="${r2(it.y)}" font-size="${r2(it.size)}" fill="${col(it.c)}"${it.anchor ? ` text-anchor="${it.anchor}"` : ''}${it.bold ? ' font-weight="700"' : ''}${it.italic ? ' font-style="italic"' : ''} font-family="${it.serif ? 'Georgia,Times New Roman,serif' : 'Cairo,Segoe UI,Tahoma,sans-serif'}"${it.rtl ? ' direction="rtl"' : ''}>${esc(it.text)}</text>`;
      case 'group': return `<g data-ev="${it.key}">${it.items.map(one).join('')}</g>`;
      default: return '';
    }
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(lay.width)} ${r2(lay.height)}" width="${r2(lay.width)}" height="${r2(lay.height)}">${lay.items.map(one).join('')}</svg>`;
}
