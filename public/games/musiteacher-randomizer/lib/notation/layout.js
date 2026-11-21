// =====================================================================
//  تخطيط العلامات على خط إيقاعي واحد (y = 0) بوحدة «مسافة المدرج»، والمحور y للأعلى.
//  يُنتج «عناصر أولية» يرسمها svg.js (ثنائي الأبعاد للواجهة والطباعة) وglyph3d.js (ثلاثي الأبعاد)
//  من المصدر نفسه، فيتطابق الرمز في المجسم والبطاقة المطبوعة دائمًا.
//  القياسات من قيم الحفر الافتراضية لخط Bravura (SMuFL): سمك الساق 0.12، العارضة 0.5، فاصل العوارض 0.25.
// =====================================================================
import { GLYPHS, ENGRAVING } from './smufl.js';
import { FIG } from './figures.js';

const STEM_LEN = 3.5;               // طول الساق المعتاد (3.5 مسافة)
const HEAD = { w: 'noteheadWhole', h: 'noteheadHalf', q: 'noteheadBlack', e: 'noteheadBlack', s: 'noteheadBlack' };
const REST = { w: 'restWhole', h: 'restHalf', q: 'restQuarter', e: 'rest8th', s: 'rest16th' };
const FLAG = { e: 'flag8thUp', s: 'flag16thUp' };
const bw = (n) => GLYPHS[n].bbox.bBoxNE[0] - GLYPHS[n].bbox.bBoxSW[0];

/**
 * يخطط تسلسل معرّفات أشكال (عنصر واحد أو أكثر).
 * @returns {{prims:Array, width:number, top:number, bottom:number, parts:Array<{fi,pi,x0,x1,rest}>}}
 *  prim: {t:'glyph', n, x, y, fi, pi} | {t:'rect', x, y, w, h, fi, pi}  (y للحافة السفلى)
 */
export function layout(ids, opt = {}) {
  const gap = opt.gap ?? 1.15, figGap = opt.figGap ?? 1.5;
  const prims = [], parts = [];
  let x = opt.padX ?? 0.4;
  ids.forEach((id, fi) => {
    const f = FIG[id]; if (!f) return;
    const noteXs = [];                         // للعوارض: [{x(stem), b, pi}]
    const beamable = f.parts.filter((pp) => !pp.rest && (pp.b === 'e' || pp.b === 's')).length >= 2;
    f.parts.forEach((pp, pi) => {
      const x0 = x;
      if (pp.rest) {
        const g = REST[pp.b]; prims.push({ t: 'glyph', n: g, x, y: 0, fi, pi });
        x += bw(g);
        if (pp.dot) { prims.push({ t: 'glyph', n: 'augmentationDot', x: x + 0.25, y: 0.5, fi, pi }); x += 0.65; }
      } else {
        const hn = HEAD[pp.b]; prims.push({ t: 'glyph', n: hn, x, y: 0, fi, pi });
        const hw = bw(hn);
        if (pp.b !== 'w') {
          const a = GLYPHS[hn].anchors.stemUpSE, sx = x + a[0] - ENGRAVING.stemThickness, top = STEM_LEN + (pp.b === 's' && !beamable ? 0.25 : 0);
          prims.push({ t: 'rect', x: sx, y: a[1], w: ENGRAVING.stemThickness, h: top - a[1], fi, pi, stem: true });
          if (beamable && (pp.b === 'e' || pp.b === 's')) noteXs.push({ sx, b: pp.b, pi, top });
          else if (FLAG[pp.b]) { const fg = FLAG[pp.b], an = GLYPHS[fg].anchors.stemUpNW; prims.push({ t: 'glyph', n: fg, x: sx - an[0], y: top - an[1], fi, pi }); }
        }
        x += hw;
        if (pp.dot) { prims.push({ t: 'glyph', n: 'augmentationDot', x: x + 0.25, y: 0.5, fi, pi }); x += 0.65; }
      }
      parts.push({ fi, pi, x0, x1: x, rest: !!pp.rest });
      if (pi < f.parts.length - 1) x += gap;
    });
    // العوارض: الأولى تصل كل العلامات، والثانية تصل الدوبل كروش المتجاورة، والمنفرد يأخذ عارضة قصيرة
    if (noteXs.length >= 2) {
      const T = ENGRAVING.beamThickness, S = ENGRAVING.beamSpacing, st = ENGRAVING.stemThickness, top = STEM_LEN;
      const first = noteXs[0], last = noteXs[noteXs.length - 1];
      prims.push({ t: 'rect', x: first.sx, y: top - T, w: last.sx + st - first.sx, h: T, fi, pi: -1, beam: 1 });
      const y2 = top - 2 * T - S, stub = 1.0;
      for (let j = 0; j < noteXs.length; j++) {
        const o = noteXs[j]; if (o.b !== 's') continue;
        const nx = noteXs[j + 1], pv = noteXs[j - 1];
        if (nx && nx.b === 's') { prims.push({ t: 'rect', x: o.sx, y: y2, w: nx.sx + st - o.sx, h: T, fi, pi: -1, beam: 2 }); continue; }
        if (pv && pv.b === 's') continue;
        const dir = j === noteXs.length - 1 ? -1 : 1;   // الأخير يتجه للخلف، وغيره للأمام
        prims.push({ t: 'rect', x: dir > 0 ? o.sx : o.sx + st - stub, y: y2, w: stub, h: T, fi, pi: -1, beam: 2 });
      }
      if (f.parts.some((pp) => pp.tup === 3)) {
        const mid = (first.sx + last.sx) / 2 - bw('tuplet3') / 2;
        prims.push({ t: 'glyph', n: 'tuplet3', x: mid, y: top + 0.45, fi, pi: -1 });
      }
    }
    x += figGap;
  });
  x += (opt.padX ?? 0.4) - figGap;
  let top = 1.2, bottom = -1.2;
  prims.forEach((p) => {
    if (p.t === 'rect') { top = Math.max(top, p.y + p.h); bottom = Math.min(bottom, p.y); }
    else { const b = GLYPHS[p.n].bbox; top = Math.max(top, p.y + b.bBoxNE[1]); bottom = Math.min(bottom, p.y + b.bBoxSW[1]); }
  });
  return { prims, width: Math.max(x, 1), top, bottom, parts };
}

/** يحوّل مخطط رمز إلى نص مسار SVG (المحور y للأسفل)، مع إزاحة وتكبير */
export function glyphPath(n, ox, oy, k) {
  const out = [];
  const X = (v) => +(ox + v * k).toFixed(2), Y = (v) => +(oy - v * k).toFixed(2);
  for (const c of GLYPHS[n].d) {
    if (c[0] === 'M' || c[0] === 'L') out.push(c[0] + X(c[1]) + ' ' + Y(c[2]));
    else if (c[0] === 'Q') out.push('Q' + X(c[1]) + ' ' + Y(c[2]) + ' ' + X(c[3]) + ' ' + Y(c[4]));
    else if (c[0] === 'C') out.push('C' + X(c[1]) + ' ' + Y(c[2]) + ' ' + X(c[3]) + ' ' + Y(c[4]) + ' ' + X(c[5]) + ' ' + Y(c[6]));
    else if (c[0] === 'Z') out.push('Z');
  }
  return out.join('');
}
