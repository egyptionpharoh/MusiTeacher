// المدرج الموسيقي (SVG): مفتاح صول، الدييز، الميزان، النغمات، أرقام الأصابع، ومؤشر ذهبي للنغمة الحالية.
// الكتابة الموسيقية من اليسار إلى اليمين دائمًا، حتى داخل صفحة عربية RTL.
// شكل مفتاح صول والدييز مرسوم كمسارات (من خط FreeSerif، رخصة GPL مع استثناء الخطوط) حتى يعمل دون إنترنت.

const SVGNS = 'http://www.w3.org/2000/svg';
const CLEF = 'M434 2Q464 -103 464 -170Q464 -223 427.0 -257.0Q390 -291 337 -291Q287 -291 250.0 -261.5Q213 -232 213 -190Q213 -160 233.5 -133.5Q254 -107 283.5 -107.0Q313 -107 331.5 -128.5Q350 -150 350 -178Q350 -240 280 -240Q298 -268 338 -268Q353 -268 368.5 -263.5Q384 -259 401.0 -248.0Q418 -237 428.5 -213.5Q439 -190 439 -157Q439 -136 411 -6Q389 -12 356 -12Q259 -12 189.5 60.0Q120 132 120 232Q120 267 131.5 303.0Q143 339 157.5 366.5Q172 394 200.5 428.5Q229 463 248.5 483.5Q268 504 303 539Q280 621 280 689Q280 779 313.0 839.5Q346 900 379 900Q389 900 401.5 887.0Q414 874 426.0 851.0Q438 828 446.5 790.5Q455 753 455 710Q455 551 342 447L368 329Q384 332 397 332Q458 332 500.0 282.5Q542 233 542 162Q542 44 434 2ZM426 746Q426 801 394 801Q358 801 333.0 748.0Q308 695 308 630Q308 588 321 557Q359 580 392.5 639.5Q426 699 426 746ZM498 128Q498 183 466.0 216.0Q434 249 383 249L428 23Q498 52 498 128ZM407 17 361 247Q334 241 311.5 214.0Q289 187 289 158Q289 143 295.0 128.5Q301 114 309.5 104.0Q318 94 327.0 86.0Q336 78 342.0 74.5Q348 71 348 71L340 66Q307 75 277.5 106.0Q248 137 248 184Q248 231 277.5 270.5Q307 310 343 323L325 430Q168 299 168 177Q168 104 223.0 55.0Q278 6 348 6Q365 6 407 17Z';
const SHARP = 'M365 24 319 6V-193L275 -209V-10L138 -63V-262L94 -279V-80L50 -96V0L94 17V262L50 245V341L94 358V589L138 606V376L275 429V659L319 675V446L365 464V366L319 348V104L365 122ZM275 88V332L138 279V34Z';

const S = 18;                    // المسافة بين خطين
const TOP_LINE = 84;             // y لخط المدرج الخامس (pos 8)
const yOf = (pos) => TOP_LINE + (8 - pos) * S / 2;
const FINGER_Y = 26;             // صف أرقام الأصابع
const H = 236;

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
// قطع ناقص مائل كمسار (للرأس المجوَّف بقاعدة evenodd)
function ellipse(cx, cy, rx, ry, rot) {
  const a = rot * Math.PI / 180, dx = Math.cos(a) * rx, dy = Math.sin(a) * rx;
  return `M${cx + dx} ${cy + dy}A${rx} ${ry} ${rot} 1 0 ${cx - dx} ${cy - dy}A${rx} ${ry} ${rot} 1 0 ${cx + dx} ${cy + dy}Z`;
}

export class Staff {
  constructor(viewport, { onSelect } = {}) {
    this.viewport = viewport;
    this.onSelect = onSelect;
    this.svg = el('svg', { class: 'staff-svg', role: 'img', 'aria-label': 'المدرج الموسيقي لسلم صول الكبير' });
    viewport.appendChild(this.svg);
    this.current = -1;
    this.showFingers = true;
    this.offset = 0;
    new ResizeObserver(() => this._scroll(false)).observe(viewport);
  }

  render(seq, scale) {
    this.seq = seq;
    const svg = this.svg; svg.textContent = '';
    const defs = el('defs', {}, svg);
    const glow = el('linearGradient', { id: 'stHi', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': '#f7d27e', 'stop-opacity': '0.15' }, glow);
    el('stop', { offset: '0.5', 'stop-color': '#f1bf5a', 'stop-opacity': '0.55' }, glow);
    el('stop', { offset: '1', 'stop-color': '#f7d27e', 'stop-opacity': '0.15' }, glow);

    // تخطيط أفقي
    const x0 = 158, dx = 66;
    const xs = []; let x = x0;
    seq.forEach((e, i) => {
      xs.push(x);
      const barAfter = (e.startBeat + e.beats) % 4 === 0;
      x += (e.kind === 'whole' ? dx * 1.25 : dx) + (barAfter && i < seq.length - 1 ? 14 : 0);
    });
    const width = x + 10;
    this.xs = xs; this.width = width;
    svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
    svg.style.aspectRatio = `${width} / ${H}`;

    // المؤشر الذهبي (خلف كل شيء)
    this.hi = el('g', { class: 'st-hi' }, svg);
    el('rect', { x: -19, y: 6, width: 38, height: H - 14, rx: 12, fill: 'url(#stHi)' }, this.hi);
    el('rect', { x: -19, y: 6, width: 38, height: H - 14, rx: 12, fill: 'none', stroke: '#d9a441', 'stroke-width': 1.4, 'stroke-opacity': 0.7 }, this.hi);
    el('circle', { cx: 0, cy: FINGER_Y - 1, r: 13, fill: '#e2ad45' }, this.hi);

    const ink = el('g', { class: 'st-ink' }, svg);
    for (let l = 0; l < 5; l++) el('line', { x1: 8, x2: width - 6, y1: yOf(l * 2), y2: yOf(l * 2), class: 'st-line' }, ink);
    // مفتاح صول: مركز اللفة على خط صول (pos 2)
    const kc = S / 165;
    el('path', { d: CLEF, transform: `translate(${14} ${yOf(2) + 160 * kc}) scale(${kc} ${-kc})`, class: 'st-glyph' }, ink);
    // الدييز (علامة التحويل الأساسية)
    const ks = (2.9 * S) / 954;
    let kx = 74;
    for (const k of scale.keySignature) {
      const pos = k.octave * 7 + 'CDEFGAB'.indexOf(k.step) - 30;
      el('path', { d: SHARP, transform: `translate(${kx} ${yOf(pos) + 198 * ks}) scale(${ks} ${-ks})`, class: 'st-glyph' }, ink);
      kx += 14;
    }
    // الميزان 4/4
    const tx = kx + 20;
    [6, 2].forEach((p, i) => {
      const t = el('text', { x: tx, y: yOf(p) + S * 0.72, 'text-anchor': 'middle', class: 'st-time' }, ink);
      t.textContent = String(scale.time[i]);
    });
    // خطوط المازورات
    seq.forEach((e, i) => {
      if ((e.startBeat + e.beats) % 4 !== 0) return;
      const last = i === seq.length - 1;
      const bx = last ? width - 12 : (xs[i] + xs[i + 1]) / 2 + 2;
      if (last) {
        el('line', { x1: bx - 7, x2: bx - 7, y1: yOf(8), y2: yOf(0), class: 'st-bar' }, ink);
        el('rect', { x: bx - 3, y: yOf(8), width: 5, height: 4 * S, class: 'st-glyph' }, ink);
      } else el('line', { x1: bx, x2: bx, y1: yOf(8), y2: yOf(0), class: 'st-bar' }, ink);
    });

    // النغمات
    this.noteEls = []; this.fingerEls = [];
    seq.forEach((e, i) => {
      const g = el('g', { class: 'st-note', 'data-i': i }, svg);
      const cx = xs[i], cy = yOf(e.pos);
      // خطوط إضافية
      const ledg = el('g', { class: 'st-ledger' }, g);
      for (let p = -2; p >= e.pos; p -= 2) el('line', { x1: cx - 17, x2: cx + 17, y1: yOf(p), y2: yOf(p) }, ledg);
      for (let p = 10; p <= e.pos; p += 2) el('line', { x1: cx - 17, x2: cx + 17, y1: yOf(p), y2: yOf(p) }, ledg);
      if (e.kind === 'whole') {
        el('path', { d: ellipse(cx, cy, S * 0.78, S * 0.5, 0) + ellipse(cx, cy, S * 0.36, S * 0.33, 62), 'fill-rule': 'evenodd', class: 'st-head' }, g);
      } else {
        el('path', { d: ellipse(cx, cy, S * 0.62, S * 0.44, -22) + ellipse(cx, cy, S * 0.5, S * 0.2, -32), 'fill-rule': 'evenodd', class: 'st-head' }, g);
        const up = e.pos < 4;   // الساق لأعلى تحت الخط الثالث
        const sx = up ? cx + S * 0.56 : cx - S * 0.56;
        el('line', { x1: sx, x2: sx, y1: cy + (up ? -2 : 2), y2: cy + (up ? -3.4 * S : 3.4 * S), class: 'st-stem' }, g);
      }
      const ft = el('text', { x: cx, y: FINGER_Y + 6, 'text-anchor': 'middle', class: 'st-finger' }, svg);
      ft.textContent = String(e.finger);
      // منطقة نقر كبيرة لكل نغمة
      const hit = el('rect', { x: cx - 30, y: 0, width: 60, height: H, fill: 'transparent', class: 'st-hit' }, svg);
      hit.addEventListener('click', () => this.onSelect && this.onSelect(i));
      this.noteEls.push(g); this.fingerEls.push(ft);
    });
    this.current = -1;
    this.setFingersVisible(this.showFingers);
  }

  setCurrent(i, animate = true) {
    this.current = i;
    const x = this.xs[i];
    this.hi.style.transition = animate ? '' : 'none';
    this.hi.style.transform = `translateX(${x}px)`;
    this.hi.style.opacity = 1;
    this.noteEls.forEach((g, k) => {
      g.classList.toggle('is-current', k === i);
      g.classList.toggle('is-past', k < i);
    });
    this.fingerEls.forEach((t, k) => t.classList.toggle('is-current', k === i));
    this._scroll(animate);
  }

  setFingersVisible(v) {
    this.showFingers = v;
    this.svg.classList.toggle('no-fingers', !v);
  }

  // تحريك أفقي يُبقي النغمة الحالية ظاهرة مع ما قبلها وما بعدها
  _scroll(animate) {
    if (!this.xs || this.current < 0) return;
    const vw = this.viewport.clientWidth, vh = this.viewport.clientHeight;
    const scale = vh / H, full = this.width * scale;
    let off = 0;
    if (full > vw) {
      off = this.xs[this.current] * scale - vw * 0.38;
      off = Math.max(0, Math.min(full - vw, off));
    }
    this.svg.style.transition = animate ? '' : 'none';
    this.svg.style.transform = `translateX(${-off}px)`;
    this.viewport.classList.toggle('can-scroll-l', off > 2);
    this.viewport.classList.toggle('can-scroll-r', full - vw - off > 2);
  }
}
