// ============================================================================
// glyphs.js — رسم العلامات والأشكال الإيقاعية (SVG) من بياناتها الزمنية في rhythm.js
// خط إيقاعي واحد (لا مدرج ولا درجات صوتية): رؤوس العلامات على الخط y=70.
// يُرسم كل شكل من أجزائه (رأس، ساق، شَعرة، عارضة، نقطة، تريوليه) فيتطابق المكتوب مع المسموع دائمًا.
// ============================================================================
(function (root) {
  'use strict';
  const LINE_Y = 70, STEM_TOP = 20, GAP = 30, PAD = 16;

  function head(cx, base) {
    if (base === 'w') {
      return `<ellipse cx="${cx}" cy="${LINE_Y}" rx="11" ry="7" fill="none" stroke="currentColor" stroke-width="3.6" transform="rotate(-15 ${cx} ${LINE_Y})"/>`;
    }
    const hollow = base === 'h';
    return `<ellipse cx="${cx}" cy="${LINE_Y}" rx="9" ry="6.6" ${hollow ? 'fill="none" stroke="currentColor" stroke-width="3"' : 'fill="currentColor"'} transform="rotate(-20 ${cx} ${LINE_Y})"/>`;
  }
  const stem = (x, top) => `<line x1="${x}" y1="${LINE_Y - 2}" x2="${x}" y2="${top}" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`;
  const dot = (cx) => `<circle cx="${cx + 16}" cy="${LINE_Y - 5}" r="3.3" fill="currentColor"/>`;
  const flag = (x, i) => `<path d="M${x} ${STEM_TOP + i * 11} c 2 9 15 12 12 30" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>`;
  const beam = (x1, x2, level) => {
    const y = STEM_TOP + level * 10;
    return `<rect x="${Math.min(x1, x2) - 1.3}" y="${y}" width="${Math.abs(x2 - x1) + 2.6}" height="6" fill="currentColor"/>`;
  };

  function rest(cx, base) {
    const ledger = `<line x1="${cx - 15}" y1="${LINE_Y}" x2="${cx + 15}" y2="${LINE_Y}" stroke="currentColor" stroke-width="2"/>`;
    if (base === 'w') return ledger + `<rect x="${cx - 10}" y="${LINE_Y}" width="20" height="8" fill="currentColor"/>`;
    if (base === 'h') return ledger + `<rect x="${cx - 10}" y="${LINE_Y - 8}" width="20" height="8" fill="currentColor"/>`;
    if (base === 'q') {
      return `<path d="M${cx - 4} ${LINE_Y - 30} L${cx + 6} ${LINE_Y - 18} L${cx - 3} ${LINE_Y - 7} L${cx + 7} ${LINE_Y + 6} ` +
        `C${cx - 5} ${LINE_Y + 1} ${cx - 8} ${LINE_Y + 12} ${cx + 1} ${LINE_Y + 19}" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    if (base === 'e') {
      return `<circle cx="${cx - 4}" cy="${LINE_Y - 14}" r="4.2" fill="currentColor"/>` +
        `<path d="M${cx - 4} ${LINE_Y - 11} q 7 3 11 -5 L${cx - 2} ${LINE_Y + 16}" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>`;
    }
    // دوبل كروش
    return `<circle cx="${cx - 2}" cy="${LINE_Y - 20}" r="4" fill="currentColor"/><circle cx="${cx - 6}" cy="${LINE_Y - 7}" r="4" fill="currentColor"/>` +
      `<path d="M${cx - 2} ${LINE_Y - 17} q 7 3 11 -5 M${cx - 6} ${LINE_Y - 4} q 7 3 11 -5 M${cx + 9} ${LINE_Y - 22} L${cx - 3} ${LINE_Y + 18}" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>`;
  }

  /** يعيد { svg, width } لشكل إيقاعي */
  function figureSVG(fig) {
    const parts = fig.parts;
    const n = parts.length;
    const hasDot = parts.some((x) => x.dot);
    const width = PAD * 2 + GAP * (n - 1) + (hasDot ? 12 : 0) + (parts[0].b === 'w' ? 6 : 0) + 10;
    let out = '';
    const xs = parts.map((_, i) => PAD + 6 + i * GAP + (parts.slice(0, i).some((x) => x.dot) ? 12 : 0));
    const notes = parts.map((x, i) => ({ x, i, cx: xs[i], sx: xs[i] + 8 })).filter((o) => !o.x.rest);
    const beamed = notes.filter((o) => o.x.b === 'e' || o.x.b === 's');
    const isBeamGroup = beamed.length >= 2;

    parts.forEach((x, i) => {
      const cx = xs[i];
      if (x.rest) { out += rest(cx, x.b); if (x.dot) out += dot(cx); return; }
      out += head(cx, x.b);
      if (x.b !== 'w') out += stem(cx + 8, STEM_TOP);
      if (x.dot) out += dot(cx);
      if (!isBeamGroup) {
        if (x.b === 'e') out += flag(cx + 8, 0);
        if (x.b === 's') out += flag(cx + 8, 0) + flag(cx + 8, 1);
      }
    });

    if (isBeamGroup) {
      out += beam(beamed[0].sx, beamed[beamed.length - 1].sx, 0);
      // العارضة الثانية للدوبل كروش: تصل الدوبل كروش المتجاورة، والمنفرد يأخذ عارضة قصيرة
      for (let j = 0; j < beamed.length; j++) {
        const o = beamed[j];
        if (o.x.b !== 's') continue;
        const next = beamed[j + 1];
        const prev = beamed[j - 1];
        if (next && next.x.b === 's') { out += beam(o.sx, next.sx, 1); continue; }
        if (prev && prev.x.b === 's') continue;          // موصولة مسبقًا
        const dir = (j === beamed.length - 1) ? -1 : 1;    // الأخير يتجه للخلف، وغيره للأمام
        out += beam(o.sx, o.sx + dir * 12, 1);
      }
      if (parts.some((x) => x.tup === 3)) {
        const mid = (beamed[0].sx + beamed[beamed.length - 1].sx) / 2;
        out += `<text x="${mid}" y="${STEM_TOP - 5}" text-anchor="middle" font-size="17" font-weight="800" font-family="Arial, sans-serif" fill="currentColor">3</text>`;
      }
    }
    return {
      width,
      svg: `<svg viewBox="0 0 ${width} 100" width="${width}" height="100" class="glyph" role="img" aria-label="${fig.name}" xmlns="http://www.w3.org/2000/svg">${out}</svg>`,
    };
  }

  const cache = {};
  function glyph(id) {
    if (!cache[id]) {
      const f = (root.RD || require('./rhythm.js')).FIG[id];
      cache[id] = f ? figureSVG(f) : { svg: '', width: 0 };
    }
    return cache[id];
  }

  const API = { glyph, figureSVG, LINE_Y };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.RDGlyphs = API;
})(typeof window !== 'undefined' ? window : globalThis);
