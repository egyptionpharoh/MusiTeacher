// =====================================================================
//  رسم المدوّنة الإيقاعية (SVG) — مأخوذ من لعبة «إيقاعات الفنون العُمانية» ومكيّف لسطر واحد قابل للنقر.
//  الدُّم: رأس سفلي وساقه إلى أعلى (الرأس يسار الساق) · التك: رأس علوي وساقه إلى أسفل (الرأس يمين الساق).
//  تك اليد اليسرى (كا): كالتك وتحتها «ك». السكتات رموز حقيقية. العلامة ‹>› فوق الرأس = نبر.
//  الرسم بالأبيض والأسود (currentColor) فيبقى واضحًا عند الطباعة وعلى السبورة.
// =====================================================================
const U = 25, ROW = 92, LABEL = 108, PADR = 22, YH = 26, YL = 58, HW = 7.2, TOP = 18, BOT = 66;
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
  if (d === 8) return `<rect x="${cx - 8}" y="${y - 6}" width="16" height="6"/>`;
  return `<rect x="${cx - 8}" y="${y - 6}" width="16" height="6"/>`;
}
function flags(n, sx, sy, up) {
  const k = n.d === 1 ? 2 : 1; let o = '';
  for (let i = 0; i < k; i++) {
    const y = up ? sy + i * 8 : sy - i * 8;
    o += up ? `<path d="M${sx} ${y} c 1.5 7 11 8 8.5 21" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`
      : `<path d="M${sx} ${y} c 1.5 -7 11 -8 8.5 -21" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  return o;
}
const quad = (x1, y1, x2, y2, t = 5, dy = 0) => `<polygon points="${x1},${y1 + dy - t / 2} ${x2},${y2 + dy - t / 2} ${x2},${y2 + dy + t / 2} ${x1},${y1 + dy + t / 2}"/>`;

function layout(pc) {
  const barGap = 14, x0 = LABEL + 30;
  const xOf = (u) => x0 + u * U + Math.floor(u / pc.upbar) * barGap + 12;
  const width = x0 + pc.total * U + pc.barsN * barGap + PADR;
  return { xOf, width, barGap, x0 };
}

/**
 * يرسم مدوّنة قطعة (من buildPiece) في el.
 * opt.label اسم السطر · opt.onNote(note) عند النقر على علامة أو سكتة.
 * يعيد { update(pos|null), flash(u) }.
 */
export function renderNotation(el, pc, opt = {}) {
  const L = layout(pc), H = ROW + 26;
  let o = `<svg xmlns="${NS}" viewBox="0 0 ${L.width} ${H}" width="${L.width}" height="${H}" class="score" role="img" aria-label="المدوّنة الإيقاعية: ${opt.label || ''}" style="min-width:${Math.min(L.width, 560)}px;max-width:${Math.round(L.width * 1.25)}px" direction="ltr">`;
  for (let u = 0; u < pc.total; u += pc.upb) { const x = L.xOf(u); o += `<g class="nbeat" data-u="${u}"><circle cx="${x}" cy="11" r="${u % pc.upbar === 0 ? 5.5 : 4}"/><text x="${x}" y="15" text-anchor="middle">${(u % pc.upbar) / pc.upb + 1}</text></g>`; }
  o += `<g class="nrow" transform="translate(0 22)">`;
  o += `<rect class="nrow-bg" x="0" y="2" width="${L.width}" height="${ROW - 4}" rx="12"/>`;
  o += `<text class="nlabel" x="${LABEL - 8}" y="47" text-anchor="end">${opt.label || ''}</text>`;
  o += `<g class="nmeter"><text x="${LABEL + 12}" y="40" text-anchor="middle">${pc.meter[0]}</text><text x="${LABEL + 12}" y="61" text-anchor="middle">${pc.meter[1]}</text></g>`;
  for (let b = 1; b <= pc.barsN; b++) {
    const x = b === pc.barsN ? L.x0 + pc.total * U + (pc.barsN - 1) * L.barGap + 12 + 6 : L.xOf(b * pc.upbar) - HW - 9;
    o += b === pc.barsN ? `${line(x - 5, 14, x - 5, 70, 1.6)}<rect x="${x - 1}" y="13" width="4.5" height="58"/>` : line(x, 14, x, 70, 1.6);
  }
  const groups = new Map(); let gi = 0;
  pc.bars.forEach((bar) => bar.forEach((n) => {
    const cx = L.xOf(n.u), id = gi++;
    const hitbox = `<rect class="nhit-area" x="${cx - 12}" y="4" width="${Math.max(24, n.d * U - 2)}" height="${ROW - 10}" fill="transparent"/>`;
    if (n.k === 'R') { o += `<g class="nn nrest" data-i="${id}" data-u="${n.u}" data-d="${n.d}">${hitbox}${rest(cx, n.d)}</g>`; return; }
    const up = n.k === 'D', cy = up ? YL : YH, sx = up ? cx + HW - 0.6 : cx - HW + 0.6, sy = up ? TOP : BOT;
    let g = hitbox + head(cx, cy) + line(sx, cy + (up ? -2 : 2), sx, sy, 2);
    if (n.d === 3 || n.d === 6) g += dot(cx, cy);
    if (n.d >= 8) g = hitbox + `<ellipse cx="${cx}" cy="${cy}" rx="${HW}" ry="5.3" fill="none" stroke="currentColor" stroke-width="2" transform="rotate(-20 ${cx} ${cy})"/>` + line(sx, cy + (up ? -2 : 2), sx, sy, 2);
    if (!n.beam && n.d < 4 && n.d !== 3) g += flags(n, sx, sy, up);
    if (!n.beam && n.d === 3) g += flags({ d: 2 }, sx, sy, up);
    if (n.acc) g += up ? `<path d="M${cx - 6} ${cy - 17} l 11 4 l -11 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="M${cx - 6} ${cy - 22} l 11 4 l -11 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (n.k === 'K') g += `<text class="nka" x="${cx + 1}" y="${BOT + 13}" text-anchor="middle">ك</text>`;
    o += `<g class="nn ${n.tied ? 'ntied' : 'nhit'} k${n.k}" data-i="${id}" data-u="${n.u}" data-d="${n.d}">${g}</g>`;
    if (n.beam) { if (!groups.has(n.beam)) groups.set(n.beam, []); groups.get(n.beam).push({ n, sx, sy, up, cx, cy }); }
    if (n.tie) o += `<path class="ntie" d="M${cx + 4} ${cy - 9} Q ${cx + (n.d * U) / 2 + 2} ${cy - 24} ${cx + n.d * U - 4} ${cy - 9}" fill="none" stroke="currentColor" stroke-width="1.8"/>`;
  }));
  for (const g of groups.values()) {
    let b = '';
    for (let i = 0; i < g.length - 1; i++) {
      const a = g[i], c = g[i + 1];
      b += quad(a.sx, a.sy, c.sx, c.sy, 5);
      if (a.n.d === 1 && c.n.d === 1) { const dy = a.up && c.up ? 8 : !a.up && !c.up ? -8 : (c.up ? 8 : -8); b += quad(a.sx, a.sy, c.sx, c.sy, 4, dy); }
    }
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
  o += `</g><line class="nhead" x1="0" y1="20" x2="0" y2="${H - 4}" style="display:none"/></svg>`;
  el.innerHTML = o;
  const svg = el.firstChild, headLine = svg.querySelector('.nhead');
  const flat = pc.bars.flat();
  const notes = [...svg.querySelectorAll('.nn')].map((e) => ({ el: e, i: +e.dataset.i, u: +e.dataset.u, d: +e.dataset.d, n: flat[+e.dataset.i] }));
  const beats = [...svg.querySelectorAll('.nbeat')].map((b) => ({ el: b, u: +b.dataset.u })); let cur = null, curBeat = null;
  if (opt.onNote) for (const n of notes) { n.el.style.cursor = 'pointer'; n.el.addEventListener('pointerdown', (e) => { e.preventDefault(); opt.onNote(n.n, n); }); }
  return {
    width: L.width, notes,
    update(pos) {
      if (pos == null) { headLine.style.display = 'none'; if (cur) cur.el.classList.remove('on'); cur = null; if (curBeat) curBeat.el.classList.remove('on'); curBeat = null; return; }
      const x = L.xOf(Math.floor(pos)) + (pos - Math.floor(pos)) * U;
      headLine.style.display = ''; headLine.setAttribute('x1', x); headLine.setAttribute('x2', x);
      const n = notes.find((q) => pos >= q.u && pos < q.u + q.d) || null;
      if (n !== cur) { if (cur) cur.el.classList.remove('on'); if (n) n.el.classList.add('on'); cur = n; }
      const bt = beats.find((q) => pos >= q.u && pos < q.u + pc.upb) || null;
      if (bt !== curBeat) { if (curBeat) curBeat.el.classList.remove('on'); if (bt) bt.el.classList.add('on'); curBeat = bt; }
      if (el.scrollWidth > el.clientWidth + 4) { const target = x * (el.scrollWidth / L.width) - el.clientWidth * 0.4; if (Math.abs(el.scrollLeft - target) > el.clientWidth * 0.3 || pos < 0.5) el.scrollLeft = Math.max(0, target); }
    },
    flash(i) { const n = notes.find((q) => q.i === i); if (!n) return; n.el.classList.remove('flash'); void n.el.getBoundingClientRect(); n.el.classList.add('flash'); setTimeout(() => n.el.classList.remove('flash'), 420); },
  };
}
