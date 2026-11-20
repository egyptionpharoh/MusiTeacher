// =====================================================================
//  رسم المدوّنة الإيقاعية (SVG) من بيانات المدوّنة نفسها التي يعزفها المحرك — فيتطابق المكتوب مع المسموع دائمًا.
//  أسلوب الأدلة: بلا مدرج؛ الرأس السفلي بساق إلى أعلى (الدُّم) والرأس العلوي بساق إلى أسفل (التك)،
//  والعوارض تصل أطراف السيقان كما في المصدر (ومنها الشكل المائل N بين دُم وتك).
//  المحور الأفقي زمني موحّد لكل الآلات، فتقع الضربات المتزامنة فوق بعضها ويمرّ عليها مؤشر واحد.
// =====================================================================
const U = 25, ROW = 92, LABEL = 132, PADR = 22, YH = 26, YL = 58, HW = 7.2, TOP = 18, BOT = 66;
const NS = 'http://www.w3.org/2000/svg';

const head = (cx, cy) => `<ellipse cx="${cx}" cy="${cy}" rx="${HW}" ry="5.3" transform="rotate(-20 ${cx} ${cy})"/>`;
const line = (x1, y1, x2, y2, w = 2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="${w}" stroke-linecap="round"/>`;
const dot = (cx, cy) => `<circle cx="${cx + 13}" cy="${cy - 1}" r="2.6"/>`;
function rest(cx, d) {
  const y = 42;
  const dotR = (d === 6 || d === 3) ? `<circle cx="${cx + 11}" cy="${y - 2}" r="2.4"/>` : '';
  if (d === 4 || d === 6) return `<path d="M${cx - 3} ${y - 15} L${cx + 4} ${y - 6} L${cx - 3} ${y + 2} L${cx + 4} ${y + 11} C${cx - 5} ${y + 7} ${cx - 6} ${y + 15} ${cx + 1} ${y + 19}" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>${dotR}`;
  if (d === 2 || d === 3) return `<circle cx="${cx - 3}" cy="${y - 7}" r="3.2"/><path d="M${cx - 3} ${y - 5} q 6 2 9 -4 L${cx - 1} ${y + 13}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>${dotR}`;
  if (d === 1) return `<circle cx="${cx - 2}" cy="${y - 11}" r="3"/><circle cx="${cx - 5}" cy="${y - 1}" r="3"/><path d="M${cx - 2} ${y - 9} q 6 2 9 -4 M${cx - 5} ${y + 1} q 6 2 9 -4 M${cx + 7} ${y - 13} L${cx - 2} ${y + 15}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`;
  return `<rect x="${cx - 8}" y="${y - 6}" width="16" height="6"/>`; // نصف (غير مستخدم في النماذج الحالية)
}
function flags(n, sx, sy, up) {
  // up: الساق إلى أعلى (رأس سفلي) — الشعرة تنحني يمينًا إلى أسفل. وإلا فهي عند أسفل الساق وتنحني يمينًا إلى أعلى.
  const k = n.d === 1 ? 2 : 1; let o = '';
  for (let i = 0; i < k; i++) {
    const y = up ? sy + i * 8 : sy - i * 8;
    o += up ? `<path d="M${sx} ${y} c 1.5 7 11 8 8.5 21" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`
      : `<path d="M${sx} ${y} c 1.5 -7 11 -8 8.5 -21" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  return o;
}
const quad = (x1, y1, x2, y2, t = 5, dy = 0) => `<polygon points="${x1},${y1 + dy - t / 2} ${x2},${y2 + dy - t / 2} ${x2},${y2 + dy + t / 2} ${x1},${y1 + dy + t / 2}"/>`;

/** هندسة أفقية مشتركة: موضع الدوبل كروش u على المحور */
export function layout(art) {
  const barGap = 14, x0 = LABEL + 30;
  const xOf = (u) => x0 + u * U + Math.floor(u / art.upbar) * barGap + 12;
  const width = x0 + art.total * U + art.barsN * barGap + PADR;
  return { xOf, width, barGap, x0 };
}

function rowSVG(art, t, L, y0) {
  let o = `<g class="nrow" data-inst="${t.inst}" transform="translate(0 ${y0})">`;
  o += `<rect class="nrow-bg" x="0" y="2" width="${L.width}" height="${ROW - 4}" rx="12"/>`;
  o += `<text class="nlabel" x="${LABEL - 8}" y="47" text-anchor="end">${t.info.name}</text>`;
  o += `<g class="nmeter"><text x="${LABEL + 12}" y="40" text-anchor="middle">${art.meter[0]}</text><text x="${LABEL + 12}" y="61" text-anchor="middle">${art.meter[1]}</text></g>`;
  // خطوط الموازير
  for (let b = 1; b <= art.barsN; b++) {
    // بين آخر علامة في المازورة وأول علامة في التالية (قبل رأسها بقليل)؛ والخط الختامي بعد آخر خانة
    const x = b === art.barsN ? L.x0 + art.total * U + (art.barsN - 1) * L.barGap + 12 + 6 : L.xOf(b * art.upbar) - HW - 9;
    o += b === art.barsN ? `${line(x - 5, 14, x - 5, 70, 1.6)}<rect x="${x - 1}" y="13" width="4.5" height="58"/>` : line(x, 14, x, 70, 1.6);
  }
  const groups = new Map();
  t.bars.forEach((bar) => bar.forEach((n) => {
    const cx = L.xOf(n.u);
    if (n.k === 'R') { o += `<g class="nn nrest" data-u="${n.u}" data-d="${n.d}">${rest(cx, n.d)}</g>`; return; }
    const up = n.k === 'D', cy = up ? YL : YH, sx = up ? cx + HW - 0.6 : cx - HW + 0.6, sy = up ? TOP : BOT;
    let g = head(cx, cy) + line(sx, cy + (up ? -2 : 2), sx, sy, 2);
    if (n.d === 3 || n.d === 6) g += dot(cx, cy);
    if (!n.beam && n.d < 4 && n.d !== 3) g += flags(n, sx, sy, up);
    if (!n.beam && n.d === 3) g += flags({ d: 2 }, sx, sy, up);
    if (n.acc) g += `<path d="M${cx - 6} ${cy - 17} l 11 4 l -11 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    o += `<g class="nn ${n.tied ? 'ntied' : 'nhit'} k${n.k}" data-u="${n.u}" data-d="${n.d}">${g}</g>`;
    if (n.beam) { if (!groups.has(n.beam)) groups.set(n.beam, []); groups.get(n.beam).push({ n, sx, sy, up, cx, cy }); }
    if (n.tie) o += `<path class="ntie" d="M${cx + 4} ${cy - 9} Q ${cx + (n.d * U) / 2 + 2} ${cy - 24} ${cx + n.d * U - 4} ${cy - 9}" fill="none" stroke="currentColor" stroke-width="1.8"/>`;
  }));
  // العوارض
  for (const g of groups.values()) {
    let b = '';
    for (let i = 0; i < g.length - 1; i++) {
      const a = g[i], c = g[i + 1];
      b += quad(a.sx, a.sy, c.sx, c.sy, 5);
      if (a.n.d === 1 && c.n.d === 1) { const dy = a.up && c.up ? 8 : !a.up && !c.up ? -8 : (c.up ? 8 : -8); b += quad(a.sx, a.sy, c.sx, c.sy, 4, dy); }
    }
    // دوبل كروش منفردة داخل المجموعة: عارضة ثانية قصيرة باتجاه جارتها
    g.forEach((a, i) => {
      if (a.n.d !== 1) return;
      const prev = g[i - 1], next = g[i + 1];
      if ((prev && prev.n.d === 1) || (next && next.n.d === 1)) return;
      const o2 = prev || next; if (!o2) return;
      const f = Math.min(0.45, 11 / Math.max(8, Math.abs(o2.sx - a.sx)));
      const x2 = a.sx + (o2.sx - a.sx) * f, y2 = a.sy + (o2.sy - a.sy) * f;
      b += quad(Math.min(a.sx, x2), a.sx < x2 ? a.sy : y2, Math.max(a.sx, x2), a.sx < x2 ? y2 : a.sy, 4, a.up ? 8 : -8);
    });
    o += `<g class="nbeam">${b}</g>`;
  }
  return o + '</g>';
}

/**
 * يرسم مدوّنة الفن في العنصر el. opt.only = معرّف آلة واحدة (عرض منفصل)، وإلا العرض المجمّع.
 * يعيد كائنًا لتحديث المؤشر والإضاءة: update(posUnits أو null) و setDim(instId, dim)
 */
export function renderScore(el, art, opt = {}) {
  const L = layout(art), tracks = opt.only ? art.tracks.filter((t) => t.inst === opt.only) : art.tracks;
  const H = tracks.length * ROW + 26;
  let o = `<svg xmlns="${NS}" viewBox="0 0 ${L.width} ${H}" width="${L.width}" height="${H}" class="score" role="img" aria-label="المدوّنة الإيقاعية لـ${art.title}" style="min-width:${Math.min(L.width, opt.minWidth || 640)}px;max-width:${Math.round(L.width * 1.12)}px">`;
  // شريط النبضات أعلى المدوّنة
  for (let u = 0; u < art.total; u += art.upb) { const x = L.xOf(u); o += `<g class="nbeat" data-u="${u}"><circle cx="${x}" cy="11" r="${u % art.upbar === 0 ? 5.5 : 4}"/><text x="${x}" y="15" text-anchor="middle">${(u % art.upbar) / art.upb + 1}</text></g>`; }
  // علامة السرعة كما وردت في المدوّنة (إن وردت)
  if (art.bpm && art.bpm.source) o += `<text class="ntempo" x="${LABEL - 8}" y="16" text-anchor="end">♩ = ${art.bpm.v}</text>`;
  tracks.forEach((t, i) => { o += rowSVG(art, t, L, 22 + i * ROW); });
  o += `<line class="nhead" x1="0" y1="20" x2="0" y2="${H - 4}" style="display:none"/></svg>`;
  el.innerHTML = o;
  const svg = el.firstChild, headLine = svg.querySelector('.nhead');
  const rows = [...svg.querySelectorAll('.nrow')].map((r) => ({ inst: r.dataset.inst, el: r, notes: [...r.querySelectorAll('.nn')].map((n) => ({ el: n, u: +n.dataset.u, d: +n.dataset.d })), cur: null }));
  const beats = [...svg.querySelectorAll('.nbeat')].map((b) => ({ el: b, u: +b.dataset.u })); let curBeat = null;
  return {
    width: L.width, height: H,
    update(pos) {
      if (pos == null) { headLine.style.display = 'none'; rows.forEach((r) => { if (r.cur) r.cur.el.classList.remove('on'); r.cur = null; }); if (curBeat) curBeat.el.classList.remove('on'); curBeat = null; return; }
      const x = L.xOf(Math.floor(pos)) + (pos - Math.floor(pos)) * U;
      headLine.style.display = ''; headLine.setAttribute('x1', x); headLine.setAttribute('x2', x);
      for (const r of rows) {
        const n = r.notes.find((q) => pos >= q.u && pos < q.u + q.d) || null;
        if (n !== r.cur) { if (r.cur) r.cur.el.classList.remove('on'); if (n) n.el.classList.add('on'); r.cur = n; }
      }
      const bt = beats.find((q) => pos >= q.u && pos < q.u + art.upb) || null;
      if (bt !== curBeat) { if (curBeat) curBeat.el.classList.remove('on'); if (bt) bt.el.classList.add('on'); curBeat = bt; }
      // تمرير أفقي تلقائي على الشاشات الضيقة
      if (el.scrollWidth > el.clientWidth + 4) { const k = el.clientWidth / el.scrollWidth; const target = x * (el.scrollWidth / L.width) - el.clientWidth * 0.4; if (Math.abs(el.scrollLeft - target) > el.clientWidth * 0.3 || pos < 0.5) el.scrollLeft = Math.max(0, target) * (k ? 1 : 1); }
    },
    setDim(inst, dim) { const r = rows.find((q) => q.inst === inst); if (r) r.el.classList.toggle('dim', dim); },
  };
}

/** مدوّنة مصغّرة لآلة واحدة (لبطاقات التحدي) */
export function miniScore(el, art, inst) { return renderScore(el, art, { only: inst, minWidth: 300 }); }
