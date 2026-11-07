// خلفيات الأغلفة: رسوم SVG مرسومة بالكود (وحدات ملم على ورقة A4: 210×297).
// كل رسم مستوحى من البيئة العُمانية أو من الموسيقى، ويُبقي مساحات العناوين والحقول هادئة.
// لا نستخدم <pattern> أو <filter> أو خطوطًا: الرسم نفسه يُحوَّل إلى PNG عالي الدقة داخل ملف Word.

const n = (v) => Math.round(v * 100) / 100;
const pts = (arr) => arr.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
const attrs = (o = {}) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false)
  .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}="${v}"`).join(' ');
const el = (tag, o, inner) => (inner === undefined ? `<${tag} ${attrs(o)}/>` : `<${tag} ${attrs(o)}>${inner}</${tag}>`);
const grp = (o, inner) => el('g', o, inner);

// مولّد شبه عشوائي ثابت (التصميم نفسه في كل مرة)
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- عناصر زخرفية
/** نجمة ثمانية (خاتم) — مربعان متراكبان، من أكثر الزخارف حضورًا في العمارة العُمانية والإسلامية */
export function star8(cx, cy, R, o = {}) {
  const r = R * 0.7654, p = [];
  for (let i = 0; i < 16; i++) { const a = (Math.PI / 8) * i - Math.PI / 2; const rr = i % 2 ? r : R; p.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
  return el('polygon', { points: pts(p), fill: 'none', ...o });
}
function rosette(cx, cy, R, o = {}) {
  const { stroke, sw = 0.3, opacity = 1 } = o;
  let s = el('circle', { cx: n(cx), cy: n(cy), r: n(R), fill: 'none', stroke, strokeWidth: sw });
  s += star8(cx, cy, R * 0.86, { stroke, strokeWidth: sw });
  s += el('circle', { cx: n(cx), cy: n(cy), r: n(R * 0.28), fill: 'none', stroke, strokeWidth: sw });
  for (let i = 0; i < 8; i++) { const a = (Math.PI / 4) * i; s += el('line', { x1: n(cx + R * 0.28 * Math.cos(a)), y1: n(cy + R * 0.28 * Math.sin(a)), x2: n(cx + R * 0.66 * Math.cos(a)), y2: n(cy + R * 0.66 * Math.sin(a)), stroke, strokeWidth: sw * 0.8 }); }
  return grp({ opacity }, s);
}
/** شريط هندسي متكرر: نجوم ثمانية متصلة بمعينات */
function girihBand(x0, x1, y, h, o = {}) {
  const { stroke, sw = 0.3, opacity = 1, fill } = o;
  const step = h * 1.25; let s = '';
  s += el('line', { x1: x0, y1: n(y), x2: x1, y2: n(y), stroke, strokeWidth: sw });
  s += el('line', { x1: x0, y1: n(y + h), x2: x1, y2: n(y + h), stroke, strokeWidth: sw });
  for (let x = x0 + step / 2; x <= x1 - step / 2 + 0.01; x += step) {
    s += star8(x, y + h / 2, h * 0.42, { stroke, strokeWidth: sw, fill: fill || 'none' });
    const d = h * 0.18, mx = x + step / 2;
    if (mx < x1 - 0.5) s += el('polygon', { points: pts([[mx, y + h / 2 - d], [mx + d, y + h / 2], [mx, y + h / 2 + d], [mx - d, y + h / 2]]), fill: stroke, opacity: 0.55 });
  }
  return grp({ opacity }, s);
}
function note(x, y, s, o = {}) {
  const { fill, up = true, flag = false } = o;
  let out = el('ellipse', { cx: n(x), cy: n(y), rx: n(s * 0.62), ry: n(s * 0.42), transform: `rotate(-22 ${n(x)} ${n(y)})`, fill });
  const sx = up ? x + s * 0.55 : x - s * 0.55;
  const y2 = up ? y - s * 3.1 : y + s * 3.1;
  out += el('line', { x1: n(sx), y1: n(y), x2: n(sx), y2: n(y2), stroke: fill, strokeWidth: n(s * 0.14) });
  if (flag) out += el('path', { d: `M${n(sx)},${n(y2)} q${n(s * 1.2)},${n(s * 0.9)} ${n(s * 0.7)},${n(s * 2.2)}`, fill: 'none', stroke: fill, strokeWidth: n(s * 0.22) });
  return out;
}
function beamed(x, y, s, gap, o = {}) {
  const { fill, dy = 0 } = o;
  let out = note(x, y, s, { fill }) + note(x + gap, y + dy, s, { fill });
  const sx1 = x + s * 0.55, sx2 = x + gap + s * 0.55;
  out += el('polygon', { points: pts([[sx1, y - s * 3.1], [sx2, y + dy - s * 3.1], [sx2, y + dy - s * 2.6], [sx1, y - s * 2.6]]), fill });
  return out;
}
/** مدرج موسيقي على منحنى: f(x) → y للسطر الأوسط */
function staffCurve(x0, x1, f, gap, o = {}) {
  const { stroke, sw = 0.25, opacity = 1 } = o;
  let s = '';
  for (let k = -2; k <= 2; k++) {
    let d = '';
    for (let x = x0; x <= x1 + 0.01; x += 2) d += `${d ? 'L' : 'M'}${n(x)},${n(f(x) + k * gap)}`;
    s += el('path', { d, fill: 'none', stroke, strokeWidth: sw });
  }
  return grp({ opacity }, s);
}
function bg(p, extra = '') {
  return el('rect', { x: 0, y: 0, width: 210, height: 297, fill: p.paper }) + extra;
}
function frame(inset, o) { return el('rect', { x: inset, y: inset, width: 210 - 2 * inset, height: 297 - 2 * inset, fill: 'none', ...o }); }
function palm(x, y, h, o = {}) {
  const { fill, dir = 1 } = o;
  let s = el('path', { d: `M${n(x)},${n(y)} Q${n(x + dir * h * 0.08)},${n(y - h * 0.5)} ${n(x + dir * h * 0.03)},${n(y - h)}`, fill: 'none', stroke: fill, strokeWidth: n(h * 0.045), strokeLinecap: 'round' });
  const tx = x + dir * h * 0.03, ty = y - h;
  const fronds = [[-0.55, 0.12], [-0.42, -0.1], [-0.2, -0.24], [0.15, -0.26], [0.4, -0.12], [0.55, 0.12], [0.3, 0.28], [-0.3, 0.3]];
  for (const [fx, fy] of fronds) {
    const ex = tx + fx * h * 0.75, ey = ty + fy * h * 0.75 + h * 0.12;
    s += el('path', { d: `M${n(tx)},${n(ty)} Q${n(tx + fx * h * 0.4)},${n(ty + fy * h * 0.55 - h * 0.12)} ${n(ex)},${n(ey)}`, fill: 'none', stroke: fill, strokeWidth: n(h * 0.03), strokeLinecap: 'round' });
  }
  return s;
}

// ---------------------------------------------------------------- الآلات (صور ظلية مبسطة)
function oudShape(o = {}) {
  const { fill, stroke, sw = 0.6 } = o;
  let s = el('path', { d: 'M0,-55 C30,-50 45,-10 42,15 C40,45 20,58 0,58 C-20,58 -40,45 -42,15 C-45,-10 -30,-50 0,-55 Z', fill: fill || 'none', stroke, strokeWidth: sw });
  s += el('path', { d: 'M-6,-54 L-5,-122 L5,-122 L6,-54 Z', fill: fill || 'none', stroke, strokeWidth: sw });
  s += el('path', { d: 'M-5,-122 L-1,-152 L9,-150 L5,-122 Z', fill: fill || 'none', stroke, strokeWidth: sw });
  s += rosette(0, -8, 11, { stroke: stroke || fill, sw: sw * 0.6 });
  s += el('circle', { cx: -19, cy: -22, r: 4, fill: 'none', stroke: stroke || fill, strokeWidth: sw * 0.6 });
  s += el('circle', { cx: 19, cy: -22, r: 4, fill: 'none', stroke: stroke || fill, strokeWidth: sw * 0.6 });
  s += el('rect', { x: -12, y: 34, width: 24, height: 3, rx: 1, fill: stroke || fill });
  for (let i = -2.5; i <= 2.5; i++) s += el('line', { x1: n(i * 1.8), y1: 35, x2: n(i * 1.2), y2: -122, stroke: stroke || fill, strokeWidth: 0.25 });
  return s;
}
function neyShape(len, o = {}) {
  const { stroke, sw = 0.5 } = o;
  let s = el('rect', { x: 0, y: -2.2, width: len, height: 4.4, rx: 2.2, fill: 'none', stroke, strokeWidth: sw });
  for (let i = 0; i < 6; i++) s += el('circle', { cx: n(len * 0.42 + i * len * 0.075), cy: 0, r: 0.9, fill: stroke });
  for (const t of [0.12, 0.3, 0.88]) s += el('line', { x1: n(len * t), y1: -2.2, x2: n(len * t), y2: 2.2, stroke, strokeWidth: sw * 0.6 });
  return s;
}
function dafShape(R, o = {}) {
  const { stroke, sw = 0.5, fill = 'none' } = o;
  let s = el('circle', { cx: 0, cy: 0, r: R, fill, stroke, strokeWidth: sw });
  s += el('circle', { cx: 0, cy: 0, r: R * 0.86, fill: 'none', stroke, strokeWidth: sw * 0.6 });
  for (let i = 0; i < 10; i++) { const a = (Math.PI * 2 * i) / 10; s += el('circle', { cx: n(Math.cos(a) * R * 0.93), cy: n(Math.sin(a) * R * 0.93), r: n(R * 0.05), fill: stroke }); }
  return s;
}
function drumShape(w, h, o = {}) {
  const { stroke, sw = 0.5 } = o;
  let s = el('ellipse', { cx: 0, cy: 0, rx: w / 2, ry: h * 0.12, fill: 'none', stroke, strokeWidth: sw });
  s += el('path', { d: `M${-w / 2},0 L${-w / 2},${h} M${w / 2},0 L${w / 2},${h}`, stroke, strokeWidth: sw });
  s += el('path', { d: `M${-w / 2},${h} A${w / 2},${h * 0.12} 0 0 0 ${w / 2},${h}`, fill: 'none', stroke, strokeWidth: sw });
  let z = '';
  for (let i = 0; i <= 8; i++) { const x = -w / 2 + (w / 8) * i; z += `${i ? 'L' : 'M'}${n(x)},${i % 2 ? h * 0.85 : h * 0.15}`; }
  s += el('path', { d: z, fill: 'none', stroke, strokeWidth: sw * 0.7 });
  return s;
}
function qanunShape(o = {}) { // عمودي: الضلع الطويل يمينًا
  const { stroke, sw = 0.5 } = o;
  let s = el('polygon', { points: pts([[0, 22], [44, 0], [44, 250], [0, 228]]), fill: 'none', stroke, strokeWidth: sw });
  s += el('rect', { x: 34, y: 10, width: 6, height: 230, fill: 'none', stroke, strokeWidth: sw * 0.7 });
  for (let i = 0; i < 28; i++) { const y = 28 + i * 7.1; s += el('line', { x1: n(0 + (y < 125 ? (125 - y) * 0 : 0)), y1: n(y), x2: 44, y2: n(y - 0.2), stroke, strokeWidth: i % 3 === 0 ? 0.35 : 0.2 }); }
  s += rosette(18, 70, 9, { stroke, sw: 0.3 }) + rosette(18, 180, 9, { stroke, sw: 0.3 });
  return s;
}

// ---------------------------------------------------------------- الخلفيات
const ART = {};

ART['omani-lattice'] = (p) => {
  let s = bg(p);
  s += frame(7, { stroke: p.accent, strokeWidth: 0.9 }) + frame(9.6, { stroke: p.gold, strokeWidth: 0.35 });
  s += girihBand(14, 196, 11.2, 5.2, { stroke: p.gold, sw: 0.28, opacity: 0.85 });
  s += girihBand(14, 196, 280.6, 5.2, { stroke: p.gold, sw: 0.28, opacity: 0.85 });
  for (const [x, y] of [[8.3, 8.3], [201.7, 8.3], [8.3, 288.7], [201.7, 288.7]]) s += rosette(x, y, 5.2, { stroke: p.accent, sw: 0.35 }) + el('circle', { cx: x, cy: y, r: 1.2, fill: p.accent2 });
  // سلسلة جانبية خافتة
  for (let y = 30; y <= 268; y += 9.5) s += star8(13, y, 2.2, { stroke: p.gold, strokeWidth: 0.22, opacity: 0.5 }) + star8(197, y, 2.2, { stroke: p.gold, strokeWidth: 0.22, opacity: 0.5 });
  // ميدالية مائية خلف العنوان
  s += grp({ opacity: 0.055 }, rosette(105, 140, 62, { stroke: p.accent, sw: 1.2 }) + star8(105, 140, 46, { stroke: p.accent, strokeWidth: 0.8 }));
  // مدرج خافت في الثلث السفلي
  s += staffCurve(22, 188, (x) => 228 + Math.sin((x - 22) / 26) * 3, 1.6, { stroke: p.accent2, sw: 0.22, opacity: 0.22 });
  s += grp({ opacity: 0.22 }, note(46, 228.8, 1.5, { fill: p.accent2 }) + beamed(150, 226.4, 1.5, 6, { fill: p.accent2, dy: -1.6 }) + note(170, 230.4, 1.5, { fill: p.accent2, flag: true }));
  return s;
};

ART['omani-band'] = (p) => {
  let s = bg(p);
  s += el('rect', { x: 0, y: 0, width: 210, height: 6, fill: p.accent }) + el('rect', { x: 0, y: 6, width: 210, height: 1.2, fill: p.gold });
  s += el('rect', { x: 0, y: 291, width: 210, height: 6, fill: p.accent }) + el('rect', { x: 0, y: 289.8, width: 210, height: 1.2, fill: p.gold });
  s += girihBand(10, 200, 9.8, 5.6, { stroke: p.accent, sw: 0.28, opacity: 0.55 });
  s += girihBand(10, 200, 281.6, 5.6, { stroke: p.accent, sw: 0.28, opacity: 0.55 });
  s += frame(18, { stroke: p.gold, strokeWidth: 0.3, opacity: 0.8 });
  for (const [x, y] of [[18, 18], [192, 18], [18, 279], [192, 279]]) s += star8(x, y, 3.2, { stroke: p.gold, strokeWidth: 0.35, fill: p.paper });
  s += grp({ opacity: 0.06 }, star8(105, 150, 70, { stroke: p.accent, strokeWidth: 1 }) + star8(105, 150, 54, { stroke: p.accent, strokeWidth: 0.6 }));
  return s;
};

ART['medallion'] = (p) => {
  let s = bg(p, el('defs', {}, el('radialGradient', { id: 'mg', cx: '50%', cy: '47%', r: '60%' }, el('stop', { offset: '0', stopColor: p.soft }) + el('stop', { offset: '1', stopColor: p.paper }))) + el('rect', { width: 210, height: 297, fill: 'url(#mg)' }));
  const cx = 105, cy = 138;
  let m = '';
  for (let k = 0; k < 3; k++) m += star8(cx, cy, 78 - k * 14, { stroke: p.gold, strokeWidth: 0.5 - k * 0.1 });
  for (let i = 0; i < 16; i++) { const a = (Math.PI / 8) * i; m += el('line', { x1: n(cx + 50 * Math.cos(a)), y1: n(cy + 50 * Math.sin(a)), x2: n(cx + 78 * Math.cos(a)), y2: n(cy + 78 * Math.sin(a)), stroke: p.gold, strokeWidth: 0.25 }); }
  m += el('circle', { cx, cy, r: 84, fill: 'none', stroke: p.gold, strokeWidth: 0.35 });
  s += grp({ opacity: 0.32 }, m);
  s += frame(8, { stroke: p.gold, strokeWidth: 0.6 }) + frame(10, { stroke: p.gold, strokeWidth: 0.2 });
  const corner = (x, y, sx, sy) => grp({ transform: `translate(${x} ${y}) scale(${sx} ${sy})` },
    el('path', { d: 'M0,22 Q0,0 22,0 M4,22 Q4,4 22,4 M0,10 Q10,10 10,0', fill: 'none', stroke: p.gold, strokeWidth: 0.4 }) + star8(9, 9, 3, { stroke: p.gold, strokeWidth: 0.3 }));
  s += corner(10, 10, 1, 1) + corner(200, 10, -1, 1) + corner(10, 287, 1, -1) + corner(200, 287, -1, -1);
  return s;
};

ART['gold-frame'] = (p) => {
  let s = bg(p);
  s += frame(10, { stroke: p.gold, strokeWidth: 1.1 }) + frame(13, { stroke: p.gold, strokeWidth: 0.25 }) + frame(14.4, { stroke: p.gold, strokeWidth: 0.25 });
  // أرابيسك الزوايا
  const arab = (x, y, rot) => {
    let a = '';
    for (let k = 0; k < 3; k++) a += el('path', { d: `M0,${30 - k * 6} C${8 - k * 2},${18 - k * 4} ${18 - k * 4},${8 - k * 2} ${30 - k * 6},0`, fill: 'none', stroke: p.gold, strokeWidth: 0.35 });
    a += el('path', { d: 'M0,0 C12,4 18,10 14,14 C10,18 4,12 0,0 Z', fill: p.gold, opacity: 0.55 });
    a += star8(16, 16, 3.6, { stroke: p.gold, strokeWidth: 0.35 });
    return grp({ transform: `translate(${x} ${y}) rotate(${rot})` }, a);
  };
  s += arab(14.4, 14.4, 0) + arab(195.6, 14.4, 90) + arab(195.6, 282.6, 180) + arab(14.4, 282.6, 270);
  // فاصل زخرفي أعلى العنوان وأسفل الحقول
  const div = (y) => el('line', { x1: 60, y1: y, x2: 96, y2: y, stroke: p.gold, strokeWidth: 0.3 }) + el('line', { x1: 114, y1: y, x2: 150, y2: y, stroke: p.gold, strokeWidth: 0.3 }) + star8(105, y, 3.4, { stroke: p.gold, strokeWidth: 0.4 }) + el('circle', { cx: 105, cy: y, r: 0.9, fill: p.gold });
  s += div(96) + div(222);
  s += grp({ opacity: 0.12 }, staffCurve(30, 180, () => 254, 1.4, { stroke: p.gold, sw: 0.25 }));
  return s;
};

ART['fort'] = (p) => {
  let s = bg(p, el('defs', {}, el('linearGradient', { id: 'fg', x1: 0, y1: 0, x2: 0, y2: 1 }, el('stop', { offset: '0', stopColor: p.paper }) + el('stop', { offset: '1', stopColor: p.soft }))) + el('rect', { width: 210, height: 297, fill: 'url(#fg)' }));
  // جبال خلف الحصن
  s += el('path', { d: 'M0,297 L0,236 Q22,222 44,232 Q66,212 92,226 Q116,206 142,224 Q168,210 190,226 Q200,222 210,228 L210,297 Z', fill: p.accent, opacity: 0.07 });
  let f = '';
  const merlons = (x0, x1, y, w = 3, g = 2.4, h = 3) => { let m = ''; for (let x = x0; x + w <= x1 + 0.01; x += w + g) m += el('rect', { x: n(x), y: n(y - h), width: w, height: h }); return m; };
  f += el('rect', { x: 30, y: 262, width: 150, height: 35 }) + merlons(30, 180, 262);
  f += el('rect', { x: 30, y: 248, width: 18, height: 49 }) + merlons(30, 48, 248, 2.6, 2.2, 3);
  f += el('rect', { x: 162, y: 248, width: 18, height: 49 }) + merlons(162, 180, 248, 2.6, 2.2, 3);
  f += el('path', { d: 'M84,297 L87,240 Q105,235 123,240 L126,297 Z' }) + merlons(87, 123, 240, 3.2, 2.4, 3.4);
  s += grp({ fill: p.accent, opacity: 0.2 }, f);
  // البوابة والنوافذ بلون الورق
  let c = el('path', { d: 'M99,297 L99,282 Q105,274 111,282 L111,297 Z' });
  for (const x of [38, 170]) c += el('rect', { x: x - 1, y: 258, width: 2, height: 6, rx: 1 });
  for (const x of [96, 105, 114]) c += el('rect', { x: x - 0.9, y: 252, width: 1.8, height: 6, rx: 0.9 });
  s += grp({ fill: p.paper, opacity: 0.85 }, c);
  s += grp({ opacity: 0.2 }, palm(16, 297, 44, { fill: p.accent2, dir: 1 }) + palm(196, 297, 40, { fill: p.accent2, dir: -1 }) + palm(188, 297, 30, { fill: p.accent2, dir: 1 }));
  // المدرج أفقًا، والنوتات كطيور
  s += staffCurve(12, 198, (x) => 214 - Math.sin(x / 34) * 2, 1.5, { stroke: p.accent, sw: 0.22, opacity: 0.28 });
  s += grp({ opacity: 0.3, fill: p.accent }, note(52, 212.6, 1.4, { fill: p.accent }) + beamed(64, 211, 1.4, 5.5, { fill: p.accent, dy: 1.5 }) + note(146, 215.5, 1.4, { fill: p.accent, flag: true }));
  s += el('line', { x1: 20, y1: 10, x2: 190, y2: 10, stroke: p.gold, strokeWidth: 0.5 }) + el('line', { x1: 20, y1: 11.6, x2: 190, y2: 11.6, stroke: p.gold, strokeWidth: 0.18 });
  return s;
};

ART['door'] = (p) => {
  let s = bg(p);
  const top = 82, bot = 272, xl = 38, xr = 172, sh = 118;
  const arch = (inset) => `M${xl + inset},${bot} L${xl + inset},${sh} Q${xl + inset},${top + 18 + inset} ${105},${top + inset} Q${xr - inset},${top + 18 + inset} ${xr - inset},${sh} L${xr - inset},${bot}`;
  s += el('path', { d: arch(-5) + ' Z', fill: p.soft, opacity: 0.9 });
  s += el('path', { d: arch(-5), fill: 'none', stroke: p.gold, strokeWidth: 0.9 });
  s += el('path', { d: arch(-1.6), fill: 'none', stroke: p.gold, strokeWidth: 0.3 });
  // مسامير الباب العُماني الخشبي
  for (let y = sh; y <= bot - 2; y += 7.5) s += el('circle', { cx: xl - 3.3, cy: y, r: 0.85, fill: p.gold }) + el('circle', { cx: xr + 3.3, cy: y, r: 0.85, fill: p.gold });
  for (let t = 0.04; t < 1; t += 0.085) { // على القوس
    const L = (a, b, c, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c;
    s += el('circle', { cx: n(L(xl - 3.3, xl - 3.3, 105, t)), cy: n(L(sh, top + 14.7, top - 3.3, t)), r: 0.85, fill: p.gold });
    s += el('circle', { cx: n(L(xr + 3.3, xr + 3.3, 105, t)), cy: n(L(sh, top + 14.7, top - 3.3, t)), r: 0.85, fill: p.gold });
  }
  s += rosette(xl + 4, sh - 14, 6, { stroke: p.gold, sw: 0.3, opacity: 0.8 }) + rosette(xr - 4, sh - 14, 6, { stroke: p.gold, sw: 0.3, opacity: 0.8 });
  s += el('rect', { x: xl - 8, y: bot, width: xr - xl + 16, height: 4, fill: p.gold, opacity: 0.85 });
  s += el('rect', { x: xl - 12, y: bot + 5, width: xr - xl + 24, height: 1.2, fill: p.gold, opacity: 0.6 });
  // نقش خفيف داخل الباب
  for (let y = 236; y <= 262; y += 13) s += girihBand(xl + 8, xr - 8, y, 5, { stroke: p.gold, sw: 0.2, opacity: 0.35 });
  s += frame(8, { stroke: p.gold, strokeWidth: 0.35, opacity: 0.7 });
  return s;
};

ART['frankincense'] = (p) => {
  let s = bg(p, el('defs', {}, el('linearGradient', { id: 'smk', gradientUnits: 'userSpaceOnUse', x1: 105, y1: 250, x2: 196, y2: 120 }, el('stop', { offset: '0', stopColor: p.accent, stopOpacity: 0.75 }) + el('stop', { offset: '1', stopColor: p.accent, stopOpacity: 0.05 }))));
  // المبخرة الظفارية: قاعدة مربعة بأرجل، جسم متدرّج، وأطراف مدببة مزخرفة
  let m = el('path', { d: 'M92,290 L92,284 L118,284 L118,290 L115,290 L115,287 L95,287 L95,290 Z' });
  m += el('path', { d: 'M94,284 L97,268 L113,268 L116,284 Z', opacity: 0.85 });
  m += el('path', { d: 'M87,262 L123,262 L113,268 L97,268 Z' });
  m += el('path', { d: 'M86,262 L84,255 L90,259 L95,254 L100,259 L105,253 L110,259 L115,254 L120,259 L126,255 L124,262 Z', opacity: 0.9 });
  s += grp({ fill: p.accent2, opacity: 0.26 }, m);
  let deco = '';
  for (const [x, y] of [[100, 276], [105, 276], [110, 276]]) deco += el('polygon', { points: pts([[x, y - 2.4], [x + 1.6, y], [x, y + 2.4], [x - 1.6, y]]) });
  s += grp({ fill: p.paper, opacity: 0.85 }, deco);
  s += el('ellipse', { cx: 105, cy: 255.5, rx: 9, ry: 1.6, fill: p.gold, opacity: 0.35 });
  // دخان اللبان يصير مدرجًا موسيقيًا
  for (let k = -2; k <= 2; k++) {
    let d = '';
    for (let t = 0; t <= 1.001; t += 0.02) { const x = 105 + t * 92 + Math.sin(t * 9 + k * 0.3) * 6 * (1 - t * 0.4); const y = 254 - t * 128 + k * (1.6 + t * 1.2); d += `${d ? 'L' : 'M'}${n(x)},${n(y)}`; }
    s += el('path', { d, fill: 'none', stroke: 'url(#smk)', strokeWidth: 0.5 });
  }
  s += grp({ opacity: 0.35 }, note(141, 202, 1.6, { fill: p.accent }) + note(160, 176, 1.6, { fill: p.accent, flag: true }) + beamed(172, 160, 1.5, 5.5, { fill: p.accent, dy: -2 }));
  s += girihBand(30, 180, 12, 4.4, { stroke: p.accent2, sw: 0.25, opacity: 0.45 });
  s += el('line', { x1: 30, y1: 291, x2: 180, y2: 291, stroke: p.accent2, strokeWidth: 0.3, opacity: 0.5 });
  return s;
};

ART['sea'] = (p) => {
  let s = bg(p, el('defs', {}, el('linearGradient', { id: 'sky', x1: 0, y1: 0, x2: 0, y2: 1 }, el('stop', { offset: '0', stopColor: p.paper }) + el('stop', { offset: '0.7', stopColor: p.soft }) + el('stop', { offset: '1', stopColor: p.soft }))) + el('rect', { width: 210, height: 297, fill: 'url(#sky)' }));
  s += el('circle', { cx: 160, cy: 226, r: 15, fill: p.gold, opacity: 0.22 });
  // أمواج يتحول خطوطها الخمسة إلى مدرج
  const wave = (x) => 240 + Math.sin(x / 16) * 2.2;
  s += staffCurve(0, 210, wave, 1.7, { stroke: p.accent, sw: 0.32, opacity: 0.5 });
  let w = '';
  for (let k = 0; k < 4; k++) {
    let d = `M0,297 L0,${250 + k * 11}`;
    for (let x = 0; x <= 210; x += 3) d += ` L${x},${n(250 + k * 11 + Math.sin(x / (12 + k * 3) + k) * (2.4 - k * 0.3))}`;
    d += ' L210,297 Z';
    w += el('path', { d, fill: p.accent, opacity: 0.07 + k * 0.04 });
  }
  s += w;
  // سفينة شراعية تقليدية
  let dhow = el('path', { d: 'M134,236.5 Q156,245 182,236 L178,243 Q156,248 139,243 Z' });
  dhow += el('path', { d: 'M158,237 L157,196 L159,196 L160,237 Z' }) + el('path', { d: 'M158,199 Q172,210 181,233 L146,233 Q153,218 158,199 Z', opacity: 0.75 });
  s += grp({ fill: p.accent2, opacity: 0.42 }, dhow);
  s += grp({ opacity: 0.45 }, note(36, wave(36) + 1.7, 1.5, { fill: p.accent }) + beamed(60, wave(60) - 1.7, 1.5, 6, { fill: p.accent, dy: 2 }) + note(96, wave(96), 1.5, { fill: p.accent, flag: true }));
  s += el('line', { x1: 14, y1: 9, x2: 196, y2: 9, stroke: p.accent, strokeWidth: 0.4, opacity: 0.6 });
  return s;
};

ART['terraces'] = (p) => {
  let s = bg(p);
  // مدرجات الجبل الأخضر الزراعية: خطوط كنتورية، أعلاها خمسة خطوط بمسافات المدرج
  for (let k = 0; k < 16; k++) {
    const base = 214 + k * 5.6;
    let d = '';
    for (let x = -2; x <= 212; x += 3) d += `${d ? 'L' : 'M'}${x},${n(base - Math.exp(-((x - 70) ** 2) / 2600) * (30 - k * 1.2) - Math.exp(-((x - 165) ** 2) / 1800) * (22 - k) )}`;
    s += el('path', { d, fill: 'none', stroke: k < 5 ? p.accent : p.accent2, strokeWidth: k < 5 ? 0.3 : 0.4, opacity: k < 5 ? 0.45 : 0.18 + k * 0.012 });
  }
  s += grp({ opacity: 0.4 }, note(70, 184.5, 1.4, { fill: p.accent }) + note(84, 190, 1.4, { fill: p.accent, flag: true }) + beamed(160, 194, 1.4, 5, { fill: p.accent, dy: -1.4 }));
  s += el('circle', { cx: 176, cy: 168, r: 10, fill: p.gold, opacity: 0.18 });
  s += frame(9, { stroke: p.accent2, strokeWidth: 0.35, opacity: 0.6 });
  return s;
};

ART['falaj'] = (p) => {
  let s = bg(p);
  // سعف النخيل في الزاويتين العلويتين
  const frond = (x, y, len, ang, dir) => {
    let f = '';
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    const cx = x + Math.cos(ang - dir * 0.35) * len * 0.55, cy = y + Math.sin(ang - dir * 0.35) * len * 0.55;
    f += el('path', { d: `M${n(x)},${n(y)} Q${n(cx)},${n(cy)} ${n(ex)},${n(ey)}`, fill: 'none', stroke: p.accent2, strokeWidth: 0.5 });
    for (let t = 0.12; t < 0.98; t += 0.055) {
      const bx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex, by = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ey;
      const l = 9 * Math.sin(Math.PI * t) + 1.5;
      for (const sd of [1, -1]) { const a = ang + sd * 1.05; f += el('line', { x1: n(bx), y1: n(by), x2: n(bx + Math.cos(a) * l), y2: n(by + Math.sin(a) * l), stroke: p.accent2, strokeWidth: 0.3 }); }
    }
    return f;
  };
  s += grp({ opacity: 0.22 }, frond(-4, -4, 70, 0.55, 1) + frond(-4, 10, 62, 0.15, 1) + frond(214, -4, 70, Math.PI - 0.55, -1) + frond(214, 10, 62, Math.PI - 0.15, -1));
  // الفلج: قناة ماء تتلوى، وماؤها خمسة خطوط موسيقية
  const fy = (x) => 246 + Math.sin(x / 30) * 8;
  s += el('path', { d: Array.from({ length: 71 }, (_, i) => `${i ? 'L' : 'M'}${i * 3},${n(fy(i * 3) - 6)}`).join('') + Array.from({ length: 71 }, (_, i) => `L${210 - i * 3},${n(fy(210 - i * 3) + 6)}`).join('') + 'Z', fill: p.soft, opacity: 0.9 });
  s += staffCurve(0, 210, fy, 1.8, { stroke: p.accent, sw: 0.3, opacity: 0.5 });
  for (const sgn of [-1, 1]) s += el('path', { d: Array.from({ length: 71 }, (_, i) => `${i ? 'L' : 'M'}${i * 3},${n(fy(i * 3) + sgn * 6.4)}`).join(''), fill: 'none', stroke: p.accent2, strokeWidth: 0.6, opacity: 0.45 });
  s += grp({ opacity: 0.45 }, note(52, fy(52) + 0.9, 1.5, { fill: p.accent }) + beamed(120, fy(120) - 0.9, 1.5, 6, { fill: p.accent, dy: 0.8 }) + note(170, fy(170) + 1.8, 1.5, { fill: p.accent, flag: true }));
  s += el('line', { x1: 20, y1: 289, x2: 190, y2: 289, stroke: p.accent2, strokeWidth: 0.3, opacity: 0.5 });
  return s;
};

ART['night'] = (p) => {
  let s = el('defs', {}, el('linearGradient', { id: 'ng', x1: 0, y1: 0, x2: 0.4, y2: 1 }, el('stop', { offset: '0', stopColor: p.paper }) + el('stop', { offset: '1', stopColor: p.deep })));
  s += el('rect', { width: 210, height: 297, fill: 'url(#ng)' });
  s += frame(8, { stroke: p.gold, strokeWidth: 0.7 }) + frame(10.5, { stroke: p.gold, strokeWidth: 0.2 });
  // شبكة نجوم ذهبية في زاويتين متقابلتين تتلاشى نحو الداخل
  const lattice = (ox, oy, sx, sy) => {
    let l = '';
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      if (i + j > 6) continue;
      const op = 0.75 - (i + j) * 0.11;
      l += star8(ox + sx * (8 + i * 10), oy + sy * (8 + j * 10), 4.2, { stroke: p.gold, strokeWidth: 0.3, opacity: n(op) });
      l += el('line', { x1: n(ox + sx * (8 + i * 10 + 4.2)), y1: n(oy + sy * (8 + j * 10)), x2: n(ox + sx * (8 + i * 10 + 5.8)), y2: n(oy + sy * (8 + j * 10)), stroke: p.gold, strokeWidth: 0.3, opacity: n(op) });
    }
    return l;
  };
  s += lattice(202, 10, -1, 1) + lattice(8, 287, 1, -1);
  s += grp({ opacity: 0.18 }, staffCurve(30, 180, (x) => 238 + Math.sin(x / 20) * 2, 1.4, { stroke: p.gold, sw: 0.22 }) + note(70, 238.7, 1.3, { fill: p.gold }) + beamed(128, 237, 1.3, 5, { fill: p.gold, dy: 1 }));
  return s;
};

ART['oud'] = (p) => {
  let s = bg(p);
  s += grp({ transform: 'translate(54 214) rotate(-34) scale(0.86)', opacity: 0.07 }, oudShape({ fill: p.accent, stroke: p.accent, sw: 0.8 }));
  s += grp({ transform: 'translate(54 214) rotate(-34) scale(0.86)', opacity: 0.22 }, oudShape({ stroke: p.accent, sw: 0.5 }));
  // جملة لحنية منسابة
  const mel = (x) => 236 - (x - 20) * 0.5 + Math.sin(x / 13) * 8;
  s += staffCurve(96, 196, (x) => 250 - (x - 96) * 0.32, 1.5, { stroke: p.accent2, sw: 0.22, opacity: 0.3 });
  const rr = rng(7);
  let nn = '';
  for (let x = 104; x < 194; x += 9) { const y = 250 - (x - 96) * 0.32 + Math.round((rr() - 0.5) * 4) * 0.75; nn += rr() > 0.6 ? beamed(x, y, 1.3, 4.4, { fill: p.accent2, dy: (rr() - 0.5) * 2 }) : note(x, y, 1.3, { fill: p.accent2, flag: rr() > 0.7 }); x += rr() > 0.6 ? 4 : 0; }
  s += grp({ opacity: 0.32 }, nn);
  void mel;
  s += el('line', { x1: 196, y1: 20, x2: 196, y2: 277, stroke: p.gold, strokeWidth: 0.5 }) + el('line', { x1: 193.6, y1: 20, x2: 193.6, y2: 277, stroke: p.gold, strokeWidth: 0.18 });
  s += star8(194.8, 20, 2.4, { stroke: p.gold, strokeWidth: 0.3, fill: p.paper }) + star8(194.8, 277, 2.4, { stroke: p.gold, strokeWidth: 0.3, fill: p.paper });
  s += grp({ transform: 'translate(150 30) rotate(-18)', opacity: 0.12 }, neyShape(46, { stroke: p.accent, sw: 0.45 }));
  return s;
};

ART['manuscript'] = (p) => {
  let s = bg(p);
  for (let k = 0; k < 11; k++) {
    const y = 22 + k * 24.5;
    if (y > 8 && y < 76 && false) continue;
    for (let l = 0; l < 5; l++) s += el('line', { x1: 18, y1: n(y + l * 1.9), x2: 192, y2: n(y + l * 1.9), stroke: p.accent, strokeWidth: 0.16, opacity: 0.32 });
    s += el('line', { x1: 18, y1: n(y), x2: 18, y2: n(y + 7.6), stroke: p.accent, strokeWidth: 0.3, opacity: 0.32 });
  }
  s += el('path', { d: 'M15,22 Q12,30 15,38', fill: 'none', stroke: p.accent, strokeWidth: 0.35, opacity: 0.3 });
  const rr = rng(21);
  let nn = '';
  for (const k of [0, 1, 9, 10]) for (let x = 30; x < 186; x += 11 + rr() * 6) nn += note(x, 22 + k * 24.5 + Math.round(rr() * 8) * 0.95, 1.05, { fill: p.accent, flag: rr() > 0.75 });
  s += grp({ opacity: 0.22 }, nn);
  return s;
};

ART['qanun'] = (p) => {
  let s = bg(p);
  s += el('rect', { x: 0, y: 0, width: 62, height: 297, fill: p.soft });
  s += grp({ transform: 'translate(10 24)', opacity: 0.55 }, qanunShape({ stroke: p.accent, sw: 0.45 }));
  s += el('line', { x1: 62, y1: 0, x2: 62, y2: 297, stroke: p.gold, strokeWidth: 0.6 }) + el('line', { x1: 64.2, y1: 0, x2: 64.2, y2: 297, stroke: p.gold, strokeWidth: 0.2 });
  s += el('line', { x1: 78, y1: 12, x2: 198, y2: 12, stroke: p.accent, strokeWidth: 0.3, opacity: 0.6 }) + el('line', { x1: 78, y1: 285, x2: 198, y2: 285, stroke: p.accent, strokeWidth: 0.3, opacity: 0.6 });
  return s;
};

ART['waveform'] = (p) => {
  let s = bg(p, el('defs', {}, el('linearGradient', { id: 'wv', x1: 0, y1: 0, x2: 1, y2: 0 }, el('stop', { offset: '0', stopColor: p.accent2 }) + el('stop', { offset: '1', stopColor: p.accent }))));
  const cy = 252, rr = rng(5);
  let b = '';
  for (let i = 0; i < 70; i++) {
    const x = 14 + i * 2.62; const env = Math.sin((i / 69) * Math.PI) ** 0.7;
    const h = 2 + env * (6 + rr() * 16) * (0.6 + 0.4 * Math.sin(i / 3.1));
    b += el('rect', { x: n(x), y: n(cy - h / 2), width: 1.5, height: n(h), rx: 0.75 });
  }
  s += grp({ fill: 'url(#wv)', opacity: 0.85 }, b);
  s += el('line', { x1: 14, y1: cy, x2: 196, y2: cy, stroke: p.accent, strokeWidth: 0.15, opacity: 0.4 });
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) s += el('circle', { cx: 18 + i * 4, cy: 16 + j * 4, r: 0.45, fill: p.accent, opacity: 0.35 });
  s += el('rect', { x: 0, y: 0, width: 210, height: 2.2, fill: 'url(#wv)' });
  return s;
};

ART['mosaic'] = (p) => {
  let s = bg(p);
  const cols = [p.accent, p.accent2, p.gold, p.soft];
  const rr = rng(13);
  const tri = (ox, oy, size, cols2, rows, flipX, flipY) => {
    let t = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < rows - r; c++) {
      const x = ox + (flipX ? -1 : 1) * c * size, y = oy + (flipY ? -1 : 1) * r * size;
      const dx = flipX ? -size : size, dy = flipY ? -size : size;
      const op = n(0.12 + rr() * 0.28);
      t += el('polygon', { points: pts([[x, y], [x + dx, y], [x, y + dy]]), fill: cols2[Math.floor(rr() * cols2.length)], opacity: op });
      if (c < rows - r - 1) t += el('polygon', { points: pts([[x + dx, y], [x + dx, y + dy], [x, y + dy]]), fill: cols2[Math.floor(rr() * cols2.length)], opacity: n(op * 0.7) });
    }
    return t;
  };
  s += tri(0, 297, 15, cols, 6, false, true) + tri(210, 0, 11, cols, 4, true, false);
  s += el('line', { x1: 60, y1: 285, x2: 196, y2: 285, stroke: p.accent, strokeWidth: 0.3, opacity: 0.6 });
  return s;
};

ART['staff-sweep'] = (p) => {
  let s = bg(p);
  const f = (x) => 270 - (x / 210) * 70 - Math.sin(x / 40) * 12;
  s += staffCurve(-5, 215, f, 2.4, { stroke: p.accent, sw: 0.55, opacity: 0.55 });
  const rr = rng(3);
  let nn = '';
  for (let x = 18; x < 200; x += 14 + rr() * 8) nn += rr() > 0.55 ? beamed(x, f(x) + Math.round((rr() - 0.5) * 4) * 1.2, 2.1, 6.5, { fill: p.accent2, dy: (rr() - 0.5) * 3 }) : note(x, f(x) + Math.round((rr() - 0.5) * 4) * 1.2, 2.1, { fill: p.accent2, flag: rr() > 0.6 });
  s += grp({ opacity: 0.6 }, nn);
  s += el('circle', { cx: 196, cy: 16, r: 4, fill: p.gold, opacity: 0.8 });
  return s;
};

ART['piano-3d'] = (p) => {
  let s = bg(p, el('defs', {}, el('linearGradient', { id: 'kw', x1: 0, y1: 0, x2: 0, y2: 1 }, el('stop', { offset: '0', stopColor: '#ffffff' }) + el('stop', { offset: '1', stopColor: p.soft })) + el('linearGradient', { id: 'kb', x1: 0, y1: 0, x2: 0, y2: 1 }, el('stop', { offset: '0', stopColor: p.accent2 }) + el('stop', { offset: '1', stopColor: p.deep }))));
  // لوحة مفاتيح منظورية بعمق ثلاثي الأبعاد
  const y0 = 238, keyH = 40, skew = 18, nW = 15, w = 210 / (nW - 1.4);
  let k = '';
  for (let i = 0; i < nW; i++) {
    const x = -6 + i * w;
    k += el('polygon', { points: pts([[x + skew, y0], [x + w + skew - 0.5, y0], [x + w - 0.5, y0 + keyH], [x, y0 + keyH]]), fill: 'url(#kw)', stroke: p.accent, strokeWidth: 0.25 });
    k += el('polygon', { points: pts([[x, y0 + keyH], [x + w - 0.5, y0 + keyH], [x + w - 0.5, y0 + keyH + 4], [x, y0 + keyH + 4]]), fill: p.soft, stroke: p.accent, strokeWidth: 0.2 });
  }
  for (let i = 0; i < nW - 1; i++) {
    if (![0, 1, 3, 4, 5].includes(i % 7)) continue; // دو# ري# فا# صول# لا#
    const x = -6 + (i + 1) * w - w * 0.3;
    k += el('polygon', { points: pts([[x + skew, y0], [x + w * 0.6 + skew, y0], [x + w * 0.6 + skew * 0.4, y0 + keyH * 0.6], [x + skew * 0.4, y0 + keyH * 0.6]]), fill: 'url(#kb)' });
    k += el('polygon', { points: pts([[x + skew * 0.4, y0 + keyH * 0.6], [x + w * 0.6 + skew * 0.4, y0 + keyH * 0.6], [x + w * 0.6 + skew * 0.4, y0 + keyH * 0.6 + 2.2], [x + skew * 0.4, y0 + keyH * 0.6 + 2.2]]), fill: p.deep });
  }
  s += el('rect', { x: 0, y: y0 - 6, width: 210, height: 6, fill: p.accent2 }) + el('rect', { x: 0, y: y0 - 1.2, width: 210, height: 1.2, fill: p.gold });
  s += grp({ opacity: 1 }, k);
  s += el('rect', { x: 0, y: 0, width: 210, height: 3, fill: p.accent2 });
  return s;
};

ART['speaker'] = (p) => {
  let s = bg(p, el('defs', {}, el('radialGradient', { id: 'cone', cx: '50%', cy: '50%', r: '50%' }, el('stop', { offset: '0', stopColor: p.accent }) + el('stop', { offset: '0.55', stopColor: p.soft }) + el('stop', { offset: '1', stopColor: p.paper, stopOpacity: 0 }))));
  // حلقات مجسّمة متتابعة كأمواج الصوت، خارج مساحة العناوين
  const cx = 186, cy = 262;
  for (let k = 9; k >= 1; k--) s += el('circle', { cx, cy, r: k * 10, fill: 'none', stroke: p.accent, strokeWidth: n(0.25 + (9 - k) * 0.05), opacity: n(0.07 + (9 - k) * 0.03) });
  s += el('circle', { cx, cy, r: 26, fill: 'url(#cone)', opacity: 0.55 });
  s += el('circle', { cx, cy, r: 8, fill: p.accent2, opacity: 0.55 }) + el('circle', { cx: cx - 2, cy: cy - 2, r: 2.4, fill: '#ffffff', opacity: 0.5 });
  for (let k = 5; k >= 1; k--) s += el('circle', { cx: 18, cy: 30, r: k * 7, fill: 'none', stroke: p.accent2, strokeWidth: 0.25, opacity: n(0.06 + (5 - k) * 0.035) });
  return s;
};

ART['ink'] = (p) => {
  let s = bg(p);
  s += frame(10, { stroke: p.ink, strokeWidth: 0.6 }) + frame(12, { stroke: p.ink, strokeWidth: 0.2 });
  const orn = (y) => el('line', { x1: 66, y1: y, x2: 99, y2: y, stroke: p.ink, strokeWidth: 0.25 }) + el('line', { x1: 111, y1: y, x2: 144, y2: y, stroke: p.ink, strokeWidth: 0.25 }) + star8(105, y, 3, { stroke: p.ink, strokeWidth: 0.3 });
  s += orn(97) + orn(222);
  for (const [x, y] of [[10, 10], [200, 10], [10, 287], [200, 287]]) s += star8(x, y, 2.6, { stroke: p.ink, strokeWidth: 0.3, fill: p.paper });
  return s;
};

ART['ink-staff'] = (p) => {
  let s = bg(p);
  for (const y0 of [14, 276]) for (let l = 0; l < 5; l++) s += el('line', { x1: 20, y1: y0 + l * 1.5, x2: 190, y2: y0 + l * 1.5, stroke: p.ink, strokeWidth: 0.18 });
  s += note(40, 279.75, 1.1, { fill: p.ink }) + beamed(160, 17, 1.1, 4.5, { fill: p.ink, dy: 1.5 });
  s += el('line', { x1: 20, y1: 97, x2: 190, y2: 97, stroke: p.ink, strokeWidth: 0.2 });
  return s;
};

ART['academic-band'] = (p) => {
  let s = bg(p);
  s += el('rect', { x: 184, y: 0, width: 26, height: 297, fill: p.accent });
  for (let y = 12; y < 297; y += 13) s += star8(197, y, 4.2, { stroke: p.soft, strokeWidth: 0.3, opacity: 0.55 });
  s += el('rect', { x: 181, y: 0, width: 1, height: 297, fill: p.gold });
  s += grp({ opacity: 0.25 }, staffCurve(14, 120, () => 279, 1.3, { stroke: p.accent, sw: 0.2 }) + note(30, 279.65, 1.1, { fill: p.accent }) + note(44, 277, 1.1, { fill: p.accent, flag: true }));
  s += el('line', { x1: 14, y1: 14, x2: 170, y2: 14, stroke: p.accent, strokeWidth: 0.25, opacity: 0.6 });
  return s;
};

ART['ledger'] = (p) => {
  let s = bg(p);
  s += el('rect', { x: 0, y: 0, width: 210, height: 82, fill: p.accent });
  s += girihBand(0, 210, 82, 4.6, { stroke: p.gold, sw: 0.3, fill: p.accent });
  s += el('rect', { x: 0, y: 82, width: 210, height: 4.6, fill: p.gold, opacity: 0.12 });
  for (let i = 0; i < 9; i++) s += el('line', { x1: 0, y1: 8 + i * 8, x2: 210, y2: 8 + i * 8, stroke: '#ffffff', strokeWidth: 0.15, opacity: 0.12 });
  s += el('rect', { x: 0, y: 291, width: 210, height: 6, fill: p.accent });
  return s;
};

ART['drums'] = (p) => {
  let s = bg(p);
  s += grp({ transform: 'translate(204 128)', opacity: 0.22 }, dafShape(22, { stroke: p.accent, sw: 0.6 }));
  s += grp({ transform: 'translate(6 74)', opacity: 0.16 }, dafShape(16, { stroke: p.accent2, sw: 0.5 }));
  s += grp({ transform: 'translate(30 256)', opacity: 0.2 }, dafShape(40, { stroke: p.accent2, sw: 0.7 }));
  s += grp({ transform: 'translate(178 232)', opacity: 0.25 }, drumShape(26, 34, { stroke: p.accent, sw: 0.55 }));
  // صف إيقاعي: دُم (دائرة ممتلئة) وتك (حلقة)
  const pattern = [1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0];
  pattern.forEach((v, i) => { const x = 40 + i * 8.2; s += v ? el('circle', { cx: x, cy: 222, r: 1.6, fill: p.accent2, opacity: 0.55 }) : el('circle', { cx: x, cy: 222, r: 1.1, fill: 'none', stroke: p.accent2, strokeWidth: 0.3, opacity: 0.55 }); });
  s += el('line', { x1: 36, y1: 226.4, x2: 168, y2: 226.4, stroke: p.accent2, strokeWidth: 0.2, opacity: 0.4 });
  return s;
};

ART['wreath'] = (p) => {
  let s = bg(p);
  const cx = 105, cy = 150, R = 82;
  const items = [
    (x, y, r) => grp({ transform: `translate(${x} ${y}) rotate(${r}) scale(0.16)` }, oudShape({ stroke: p.accent, sw: 3 })),
    (x, y, r) => grp({ transform: `translate(${x} ${y}) rotate(${r + 90})` }, neyShape(22, { stroke: p.accent2, sw: 0.4 })),
    (x, y) => grp({ transform: `translate(${x} ${y})` }, dafShape(6, { stroke: p.accent, sw: 0.4 })),
    (x, y, r) => grp({ transform: `translate(${x} ${y}) rotate(${r})` }, note(0, 0, 2.4, { fill: p.accent2, flag: true })),
    (x, y) => grp({ transform: `translate(${x} ${y - 5})` }, drumShape(7, 9, { stroke: p.accent, sw: 0.35 })),
  ];
  let w = '';
  const N = 15;
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (Math.PI * 2 * i) / N + 0.21;
    if (Math.abs(Math.sin(a) + 1) < 0.25) continue; // فجوة أعلى الإكليل
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 1.02;
    w += items[i % items.length](n(x), n(y), n((a * 180) / Math.PI));
  }
  s += grp({ opacity: 0.3 }, w);
  s += el('circle', { cx, cy, r: R + 10, fill: 'none', stroke: p.gold, strokeWidth: 0.25, opacity: 0.4 });
  s += frame(9, { stroke: p.accent, strokeWidth: 0.3, opacity: 0.5 });
  return s;
};

ART['celebration'] = (p) => {
  let s = bg(p);
  let r = '';
  for (let i = 0; i < 24; i++) { const a1 = Math.PI + (Math.PI * i) / 24, a2 = a1 + Math.PI / 48; r += el('polygon', { points: pts([[105, 330], [105 + Math.cos(a1) * 360, 330 + Math.sin(a1) * 360], [105 + Math.cos(a2) * 360, 330 + Math.sin(a2) * 360]]), fill: i % 2 ? p.accent : p.gold, opacity: 0.045 }); }
  s += r;
  const rr = rng(9);
  let st = '';
  for (let i = 0; i < 26; i++) { const x = 14 + rr() * 182, y = 14 + rr() * 60; st += i % 3 ? star8(x, y, 0.8 + rr() * 1.4, { stroke: p.gold, strokeWidth: 0.3, opacity: 0.6 }) : note(x, y, 0.9, { fill: p.accent, flag: true }); }
  for (let i = 0; i < 14; i++) { const x = 14 + rr() * 182, y = 252 + rr() * 30; st += star8(x, y, 0.8 + rr() * 1.2, { stroke: p.gold, strokeWidth: 0.3, opacity: 0.55 }); }
  s += grp({ opacity: 0.8 }, st);
  // شريط احتفالي خلف العنوان
  const by = 112;
  s += el('path', { d: `M20,${by} L34,${by} L34,${by + 30} L20,${by + 30} L27,${by + 15} Z`, fill: p.accent2, opacity: 0.25 }) + el('path', { d: `M190,${by} L176,${by} L176,${by + 30} L190,${by + 30} L183,${by + 15} Z`, fill: p.accent2, opacity: 0.25 });
  return s;
};

ART['national'] = (p) => {
  // ألوان علم السلطنة شريطًا متموجًا (بلا العلم ولا الشعار نفسيهما)
  let s = bg(p);
  const band = (y0, amp, ph) => (x) => y0 + Math.sin(x / 30 + ph) * amp;
  const ribbon = (f, h, fill, op) => {
    let d = '';
    for (let x = -4; x <= 214; x += 3) d += `${d ? 'L' : 'M'}${x},${n(f(x))}`;
    for (let x = 214; x >= -4; x -= 3) d += `L${x},${n(f(x) + h)}`;
    return el('path', { d: d + 'Z', fill, opacity: op });
  };
  s += ribbon(band(246, 6, 0), 8, '#C8102E', 0.75) + ribbon(band(254, 6, 0), 5, '#FFFFFF', 1) + ribbon(band(259, 6, 0), 8, '#00843D', 0.75);
  s += staffCurve(-4, 214, (x) => band(254, 6, 0)(x) + 2.5, 0.9, { stroke: p.gold, sw: 0.16, opacity: 0.8 });
  s += ribbon(band(3.5, 1.6, 2), 2, '#C8102E', 0.6) + ribbon(band(6.2, 1.6, 2), 2, '#00843D', 0.6);
  s += grp({ opacity: 0.35 }, note(150, 236, 1.5, { fill: p.accent }) + beamed(164, 232, 1.5, 6, { fill: p.accent, dy: -2 }));
  return s;
};

export const ART_IDS = Object.keys(ART);

export function renderArt(id, palette) {
  const fn = ART[id] || ART['omani-lattice'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">${fn(palette)}</svg>`;
}
