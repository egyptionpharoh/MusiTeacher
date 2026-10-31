// =====================================================================
//  الزي العماني المحتشم للعازفة: دشداشة بأكمام طويلة وسروال وكم عند الكاحل ولحاف على الرأس والكتفين.
//
//  لماذا نُفصِّل الزي من شبكات النموذج نفسه؟
//    ملف MakeHuman يحذف من الجسم كل الأوجه المختبئة تحت الملابس (لذلك لا يوجد جذع ولا ساقان في شبكة الجسم)،
//    ويأتي بملابس رياضية ضيقة وشعر مكشوف. نحتفظ ببنية الملابس الجاهزة (فهي مُلبَّسة أصلًا على الهيكل العظمي نفسه)
//    ثم «ننفخها» شعاعيًا حول محور كل طرف (جذع/ذراع/ساق) لتصير ثوبًا فضفاضًا، ونبني الأكمام من أذرع الجسم،
//    ونبني اللحاف كحلقات أفقية حول الرأس والكتفين بمقاسات مأخوذة من الشبكة الفعلية.
//  كل الرؤوس تحتفظ بأوزان التشكيل (skinIndex/skinWeight) فتتحرك مع الهيكل العظمي دون أي تغيير في منطق الوضعية.
// =====================================================================
import * as THREE from 'three';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// جدول خطي متعدد القطع [[x, y], ...] مرتّب تصاعديًا
function table(tb, x) {
  if (x <= tb[0][0]) return tb[0][1];
  for (let i = 1; i < tb.length; i++) if (x <= tb[i][0]) return lerp(tb[i - 1][1], tb[i][1], (x - tb[i - 1][0]) / (tb[i][0] - tb[i - 1][0]));
  return tb[tb.length - 1][1];
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ---------- تصنيف العظام ----------
function boneGroup(name) {
  const side = /L$/.test(name) ? 'L' : /R$/.test(name) ? 'R' : '';
  if (/^(upperarm|lowerarm)/.test(name)) return 'arm' + side;
  if (/^(wrist|finger|metacarpal)/.test(name)) return 'hand' + side;
  if (/^(upperleg|lowerleg|foot|toe)/.test(name)) return 'leg' + side;
  if (/^(head|jaw|neck|eye|tongue|skull)/.test(name)) return 'head';
  return 'torso';                 // الحوض والعمود الفقري والترقوة والكتف
}

// ---------- أدوات الشبكة ----------
class Src {
  constructor(mesh) {
    this.mesh = mesh;
    const g = mesh.geometry;
    this.pos = g.attributes.position; this.si = g.attributes.skinIndex; this.sw = g.attributes.skinWeight;
    this.names = mesh.skeleton.bones.map((b) => b.name);
    this.grp = this.names.map(boneGroup);
    this.n = this.pos.count;
  }
  p(i) { return [this.pos.getX(i), this.pos.getY(i), this.pos.getZ(i)]; }
  weights(i) {
    const o = [];
    for (let k = 0; k < 4; k++) { const w = this.sw.array[i * 4 + k]; if (w > 0) o.push([this.si.array[i * 4 + k], w]); }
    return o;
  }
  // مجموعة الرأس المهيمنة للرأس
  dom(i) {
    let bi = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = this.sw.array[i * 4 + k]; if (w > bw) { bw = w; bi = this.si.array[i * 4 + k]; } }
    return { bone: bi, name: this.names[bi], group: this.grp[bi] };
  }
}

// مساقط على سلسلة مفاصل: تعيد أقرب نقطة على السلسلة وبارامترها s (0 عند أول مفصل)
function onChain(pts, p) {
  let best = { d: Infinity }, acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], ab = sub(b, a), l2 = dot(ab, ab);
    const t = clamp(dot(sub(p, a), ab) / l2, 0, 1);
    const c = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
    const d = len(sub(p, c));
    if (d < best.d) best = { d, c, s: i + t, tan: nrm(ab) };
    acc += Math.sqrt(l2);
  }
  return best;
}

// طيّات قماش هادئة (جيوب ظل خفيفة) كدالة في الزاوية والارتفاع
function folds(a, z, amp) {
  return amp * (0.55 * Math.sin(7 * a + 4.1 * z) + 0.3 * Math.sin(13 * a - 9 * z + 1.7) + 0.15 * Math.sin(23 * a + 15 * z));
}

// ---------- القوام (Textures) ----------
function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; else t.wrapS = THREE.RepeatWrapping, t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// نسيج قماش دقيق (خرائط عادية) — نسج متقاطع مع اضطراب خفيف
function weaveNormal() {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N);
  const H = new Float32Array(N * N);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const warp = Math.sin(i * TAU / 4) * 0.5, weft = Math.sin(j * TAU / 4) * 0.5;
    const over = ((i >> 2) + (j >> 2)) & 1;
    H[j * N + i] = (over ? warp : weft) * 0.6 + (rnd() - 0.5) * 0.25;
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const hx = H[j * N + (i + 1) % N] - H[j * N + (i + N - 1) % N], hy = H[((j + 1) % N) * N + i] - H[((j + N - 1) % N) * N + i];
    const nx = -hx * 0.9, ny = -hy * 0.9, nz = 1, l = Math.hypot(nx, ny, nz);
    const o = (j * N + i) * 4;
    img.data[o] = (nx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[o + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(70, 70);
  return t;
}

// تطريز عماني هندسي: شريط ذهبي بمعينات وسلاسل خضراء
function embroideryBand(x, x0, x1, y0, y1, c1, c2, c3) {
  const h = y1 - y0;
  x.fillStyle = c1; x.fillRect(x0, y0, x1 - x0, h);
  x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(x0, y0, x1 - x0, 1); x.fillRect(x0, y1 - 1, x1 - x0, 1);
  x.strokeStyle = c2; x.lineWidth = Math.max(1, h * 0.09);
  const step = h * 0.9;
  for (let px = x0; px < x1; px += step) {
    x.beginPath(); x.moveTo(px, y0 + h * 0.5); x.lineTo(px + step / 2, y0 + h * 0.14); x.lineTo(px + step, y0 + h * 0.5); x.lineTo(px + step / 2, y0 + h * 0.86); x.closePath(); x.stroke();
    x.fillStyle = c3; x.beginPath(); x.arc(px + step / 2, y0 + h * 0.5, h * 0.09, 0, TAU); x.fill();
  }
  x.fillStyle = c3; x.fillRect(x0, y0 + h * 0.08, x1 - x0, Math.max(1, h * 0.05)); x.fillRect(x0, y1 - h * 0.13, x1 - x0, Math.max(1, h * 0.05));
}

function fabricBase(x, w, h, hex, variation = 0.05) {
  x.fillStyle = hex; x.fillRect(0, 0, w, h);
  // خيوط طولية خفيفة جدًا حتى لا يبدو اللون مسطحًا
  // تباين خفيف جدًا وناعم (بلا خطوط عمودية حادة كي لا تتمدد على الساقين)
  for (let k = 0; k < 400; k++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * variation * 0.5})`; const r = 6 + Math.random() * 40; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, r, 0, TAU); x.fill(); }
}

// ---------- بناء الهندسة من مثلثات مختارة ----------
// tris: [{src, i0, i1, i2}] ؛ transform(src, i) → {p:[x,y,z], uv:[u,v]}
function buildGeometry(tris, vertexFn, outward) {
  const n = tris.length * 3;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  let o = 0, flipped = 0;
  for (const t of tris) {
    const rs = t.idx.map((i) => vertexFn(t.src, i));
    let order = [0, 1, 2];
    // اتجاه لفّ المثلثات في ملف FBX غير متسق؛ نُعيد ترتيب الرؤوس ليكون ترتيب كل وجه موجّهًا إلى الخارج
    if (outward && outward.flip) {
      const a = rs[0].p, b = rs[1].p, c = rs[2].p, fn = cross(sub(b, a), sub(c, a));
      const ref = outward([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]);
      if (ref && dot(fn, ref) < 0) { order = [0, 2, 1]; flipped++; }
    }
    const us = [];
    for (let k = 0; k < 3; k++) {
      const j = order[k], i = t.idx[j], r = rs[j];
      pos[(o + k) * 3] = r.p[0]; pos[(o + k) * 3 + 1] = r.p[1]; pos[(o + k) * 3 + 2] = r.p[2];
      uv[(o + k) * 2] = r.uv[0]; uv[(o + k) * 2 + 1] = r.uv[1]; us.push(r.uv[0]);
      for (let q = 0; q < 4; q++) { si[(o + k) * 4 + q] = t.src.si.array[i * 4 + q]; sw[(o + k) * 4 + q] = t.src.sw.array[i * 4 + q]; }
    }
    // طيّ الدرزة الدائرية: إن امتد المثلث على أكثر من نصف اللفة نُزيح أصغر u بمقدار 1
    if (Math.max(...us) - Math.min(...us) > 0.5) for (let k = 0; k < 3; k++) if (uv[(o + k) * 2] < 0.5) uv[(o + k) * 2] += 1;
    o += 3;
  }
  buildGeometry.lastFlipped = flipped;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('normal', new THREE.BufferAttribute(smoothNormals(pos, outward), 3));
  return g;
}

// أنماط ناعمة: نجمع أوجه المواضع المتطابقة (الرؤوس المكررة في الشبكة غير المفهرسة)
function smoothNormals(pos, outward) {
  const n = pos.length / 3, out = new Float32Array(pos.length), map = new Map();
  const key = (i) => `${Math.round(pos[i * 3] * 5e3)},${Math.round(pos[i * 3 + 1] * 5e3)},${Math.round(pos[i * 3 + 2] * 5e3)}`;
  for (let t = 0; t < n; t += 3) {
    const a = [pos[t * 3], pos[t * 3 + 1], pos[t * 3 + 2]], b = [pos[(t + 1) * 3], pos[(t + 1) * 3 + 1], pos[(t + 1) * 3 + 2]], c = [pos[(t + 2) * 3], pos[(t + 2) * 3 + 1], pos[(t + 2) * 3 + 2]];
    let fn = cross(sub(b, a), sub(c, a));              // المساحة مضمّنة (وزن بالمساحة)
    if (outward) {                                     // اتجاه المثلثات في ملف FBX غير متسق: نوجّه كل وجه إلى الخارج
      const ref = outward([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]);
      if (ref && dot(fn, ref) < 0) fn = [-fn[0], -fn[1], -fn[2]];
    }
    for (let k = 0; k < 3; k++) { const kk = key(t + k); let e = map.get(kk); if (!e) map.set(kk, e = [0, 0, 0]); e[0] += fn[0]; e[1] += fn[1]; e[2] += fn[2]; }
  }
  for (let i = 0; i < n; i++) { const e = map.get(key(i)), l = Math.hypot(e[0], e[1], e[2]) || 1; out[i * 3] = e[0] / l; out[i * 3 + 1] = e[1] / l; out[i * 3 + 2] = e[2] / l; }
  return out;
}

// تخفيف الحوض والمؤخرة (فضاء الهندسة: z للأعلى، +y للخلف). الجذع والساقان فقط؛ الأذرع والرأس لا تُمسّ.
function reshapeHips(mesh, k) {
  const g = mesh.geometry, pos = g.attributes.position, sk = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const grp = mesh.skeleton.bones.map((b) => boneGroup(b.name));
  for (let i = 0; i < pos.count; i++) {
    let bi = 0, bw = -1; for (let j = 0; j < 4; j++) { const w = sw.array[i * 4 + j]; if (w > bw) { bw = w; bi = sk.array[i * 4 + j]; } }
    const gr = grp[bi]; if (gr === 'head' || gr.startsWith('arm') || gr.startsWith('hand')) continue;
    const z = pos.getZ(i), w = smooth(0.58, 0.67, z) * (1 - smooth(0.78, 0.90, z));
    if (w <= 0) continue;
    const y = pos.getY(i), x = pos.getX(i);
    if (y > 0) pos.setY(i, y - k.depth * w * y);                 // مؤخرة أقل بروزًا
    pos.setX(i, x * (1 - k.width * w));                           // حوض أضيق قليلًا
  }
  pos.needsUpdate = true;
}

// ---------- الدالة الرئيسية ----------
export function applyOutfit(root, cfg = {}) {
  const oc = cfg.outfit || {};
  root.updateMatrixWorld(true);
  const all = []; root.traverse((o) => { if (o.isSkinnedMesh) all.push(o); });
  const find = (re) => all.find((m) => re.test(m.name));
  const body = find(/^Human$/), suit = find(/sportsuit/), casual = find(/casualsuit/);
  if (!body || !suit || !casual) return { applied: false, reason: 'لم يُعثر على شبكتي الجسم والملابس' };
  // تناسق منطقة الحوض: شبكة MakeHuman الافتراضية ممتلئة الحوض، ثم يضيف النفخ الشعاعي للثوب سماكة أخرى حتى يبدو الحوض والمؤخرة والفخذان أكبر من الصدر والكتفين.
  // نخفّف عمق المؤخرة وعرض الحوض قليلًا (وزن ناعم بحسب الارتفاع) في شبكتي الملابس قبل التفصيل، فيتبعهما الزي كله بلا أي تغيير في الأوزان.
  const _q = (k, d) => { const v = new URLSearchParams(location.search).get(k); return v == null ? d : +v; };
  const hipK = cfg.hipRefine ?? { depth: _q('hipd', 0.14), width: _q('hipw', 0.045) };
  for (const mesh of [suit, casual]) { reshapeHips(mesh, hipK); }
  const SB = new Src(body), SS = new Src(suit), SC = new Src(casual);
  const boneG = (n) => { const b = suit.skeleton.bones.find((x) => x.name === n); return suit.worldToLocal(b.getWorldPosition(new THREE.Vector3())).toArray(); };
  const bm = cfg.boneMap || {};
  const P = {
    hips: boneG(bm.hips || 'root'), spine: boneG(bm.spine || 'spine05'), chest: boneG(bm.chest || 'spine03'), upperChest: boneG(bm.upperChest || 'spine01'), neck: boneG(bm.neck || 'neck01'), head: boneG(bm.head || 'head'),
  };
  const chains = {};
  for (const s of ['L', 'R']) {
    chains['arm' + s] = [boneG(bm[s + '.upperArm']), boneG(bm[s + '.lowerArm']), boneG(bm[s + '.hand'])];
    const leg = [boneG(bm[s + '.upperLeg']), boneG(bm[s + '.lowerLeg']), boneG(bm[s + '.foot'])];
    leg.push([leg[2][0], leg[2][1], 0.0]);        // نهاية السلسلة عند الأرض
    chains['leg' + s] = leg;
  }
  const ax = (p) => [0, p[1], p[2]];
  chains.torso = [ax(P.hips), ax(P.spine), ax(P.chest), ax(P.upperChest), ax(P.neck)];

  // دشداشة فضفاضة: مقدار النفخ الشعاعي (بالمتر في فضاء الهندسة) كدالة في الارتفاع/البارامتر
  const D_TORSO = _q('dold', 0) ? [[0.70, 0.034], [0.80, 0.028], [0.90, 0.018], [1.0, 0.013], [1.1, 0.012]] : [[0.70, 0.022], [0.80, 0.020], [0.90, 0.016], [1.0, 0.013], [1.1, 0.012]];
  const HEM = 0.185;                                         // ارتفاع حافة الدشداشة عن الأرض (فوقها كم السروال)
  const D_LEG = [[0.0, 0.012], [0.07, 0.014], [HEM - 0.012, 0.016], [HEM + 0.012, 0.030], [0.20, 0.028], [0.39, 0.020], [0.55, 0.020], [0.72, 0.022]];
  const D_ARM = [[0, 0.012], [1, 0.013], [1.7, 0.012], [2.0, 0.012]];   // كمّ أضيق عند المعصم (كان 0.021 فتبدو الأسورة حلقة واسعة سائبة)

  const dispGroup = (g, p) => {
    if (g === 'torso') {
      const q = onChain(chains.torso, p);
      let r = sub(p, q.c); r = sub(r, [q.tan[0] * dot(r, q.tan), q.tan[1] * dot(r, q.tan), q.tan[2] * dot(r, q.tan)]);
      const L = len(r) || 1, a = Math.atan2(p[0], -(p[1] - P.spine[1]));
      const d = table(D_TORSO, p[2]) + folds(a, p[2], 0.0035 * smooth(1.0, 0.74, p[2]));
      return [r[0] / L * d, r[1] / L * d, r[2] / L * d];
    }
    if (g.startsWith('leg')) {
      const ch = chains[g], q = onChain(ch, p);
      const r = sub(p, q.c), rr = sub(r, [q.tan[0] * dot(r, q.tan), q.tan[1] * dot(r, q.tan), q.tan[2] * dot(r, q.tan)]);
      const L = len(rr) || 1, a = Math.atan2(p[0] - q.c[0], -(p[1] - q.c[1]));
      let d = table(D_LEG, p[2]) + folds(a, p[2], 0.004 * smooth(0.05, 0.16, p[2]) * smooth(0.65, 0.3, p[2]));
      // قرب خط المنتصف (شقّ المؤخرة وما بين الفخذين) يدفع النفخ الشعاعي كل ساق نحو الأخرى فيتقاطع القماش ويظهر رقاقات مسنّنة؛ نُخمّده هناك
      const toMid = (rr[0] / L) * (p[0] > 0 ? -1 : 1);
      if (p[2] > 0.5 && toMid > 0) d *= 1 - toMid * (1 - smooth(0.02, 0.075, Math.abs(p[0]))) * smooth(0.5, 0.58, p[2]);
      return [rr[0] / L * d, rr[1] / L * d, rr[2] / L * d];
    }
    if (g.startsWith('arm')) {
      const q = onChain(chains[g], p);
      const r = sub(p, q.c), rr = sub(r, [q.tan[0] * dot(r, q.tan), q.tan[1] * dot(r, q.tan), q.tan[2] * dot(r, q.tan)]);
      const L = len(rr) || 1, a = Math.atan2(rr[0], -rr[1]);
      const d = table(D_ARM, q.s) + folds(a, q.s, 0.0014);
      return [rr[0] / L * d, rr[1] / L * d, rr[2] / L * d];
    }
    return [0, 0, 0];
  };
  const displaced = (S, i) => {
    const p = S.p(i), ws = S.weights(i), acc = { };
    let tot = 0;
    for (const [bi, w] of ws) { const g = S.grp[bi]; if (g === 'head' || g.startsWith('hand')) continue; acc[g] = (acc[g] || 0) + w; tot += w; }
    const d = [0, 0, 0];
    for (const g in acc) { const dg = dispGroup(g, p), k = acc[g]; d[0] += dg[0] * k; d[1] += dg[1] * k; d[2] += dg[2] * k; }
    // الرؤوس ذات الوزن الجزئي على الرأس/اليد لا تُنفخ بالكامل (حتى لا تنتفخ منطقة الرقبة واليد)
    const f = clamp(tot, 0, 1);
    return [p[0] + d[0] * f, p[1] + d[1] * f, p[2] + d[2] * f];
  };

  // ---- اختيار المثلثات ----
  const trisFrom = (S, accept) => {
    const out = [], g = S.mesh.geometry;
    const ranges = (g.groups && g.groups.length) ? g.groups.filter((x) => x.materialIndex === 0).map((x) => [x.start, x.count]) : [[0, S.n]];
    for (const [st, cn] of ranges) for (let i = st; i + 2 < st + cn; i += 3) {
      const idx = [i, i + 1, i + 2], ds = idx.map((k) => S.dom(k));
      const zc = (S.p(i)[2] + S.p(i + 1)[2] + S.p(i + 2)[2]) / 3;
      if (accept(ds, idx, zc)) out.push({ src: S, idx });
    }
    return out;
  };
  const majority = (ds) => { const c = {}; for (const d of ds) c[d.group] = (c[d.group] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; };
  const isArm = (g) => g.startsWith('arm');
  // الجذع من القميص الفضفاض (casualsuit) والساقان من بنطال الرياضة (حتى منتصف الحوض فقط حتى لا تتكرر طبقة الصدر)
  const notArm = (ds) => !isArm(majority(ds)) && !majority(ds).startsWith('hand');
  const mainSuit = trisFrom(SC, (ds) => notArm(ds)).concat(trisFrom(SS, (ds, idx, zc) => notArm(ds) && zc < 0.80));
  const sleeveSuit = trisFrom(SC, (ds) => isArm(majority(ds)));
  const sleeveBody = trisFrom(SB, (ds) => ds.every((d) => isArm(d.group) && /^(upperarm|lowerarm)/.test(d.name)));

  // ---- خرائط UV ----
  const HT = 1.2;                                           // ارتفاع التغطية الرأسية للقوام
  const uvMain = (S, i) => {
    const p = S.p(i), g = S.dom(i).group;
    if (g.startsWith('leg')) { const c = onChain(chains[g], p).c; return [Math.atan2(p[0] - c[0], -(p[1] - c[1])) / TAU + 0.5, clamp(p[2] / HT)]; }   // الساق: لفّ حول محورها
    return [Math.atan2(p[0], -(p[1] - P.spine[1])) / TAU + 0.5, clamp(p[2] / HT)];
  };
  const armUV = (g, rest) => {
    const ch = chains[g], q = onChain(ch, rest), a = nrm(sub(ch[1], ch[0]));
    const b1 = nrm([-a[0] * a[1], 1 - a[1] * a[1], -a[2] * a[1]]);          // اتجاه «الخلف» (+y) عموديًا على محور الذراع
    const b2 = cross(a, b1), r = sub(rest, q.c);
    return [Math.atan2(dot(r, b2), dot(r, b1)) / TAU + 0.5, clamp(q.s / 2)];
  };

  // ---- المواد ----
  const wn = weaveNormal();
  const C = { dish: oc.dishdasha || '#7a1f2e', sir: oc.sirwal || '#1f4a44', gold: oc.embroidery || '#d8b25a', teal: oc.embroidery2 || '#2f6b5a' };
  const mainTex = canvasTex(1024, 1024, (x, w, h) => {
    fabricBase(x, w, h, C.dish);
    const Y = (z) => (1 - z / HT) * h;
    // كم السروال تحت حافة الدشداشة
    x.fillStyle = C.sir; x.fillRect(0, Y(HEM - 0.015), w, h - Y(HEM - 0.015));
    embroideryBand(x, 0, w, Y(HEM + 0.026), Y(HEM + 0.004), C.gold, C.teal, '#f4e2a8');        // حافة الدشداشة
    embroideryBand(x, 0, w, Y(0.085), Y(0.04), C.gold, C.teal, '#f4e2a8');                      // كم السروال
    // فتحة أمامية مطرّزة (من الصدر حتى منتصف الفخذ)
    const cx = w * 0.5, pw = w * 0.018;
    x.fillStyle = C.gold; x.fillRect(cx - pw, Y(0.9), pw * 2, Y(0.79) - Y(0.9));
    x.fillStyle = C.teal; x.fillRect(cx - pw * 0.35, Y(0.9), pw * 0.7, Y(0.79) - Y(0.9));
    for (let z = 0.88; z > 0.80; z -= 0.045) { x.fillStyle = C.gold; x.beginPath(); x.arc(cx, Y(z), pw * 1.5, 0, TAU); x.fill(); x.fillStyle = C.teal; x.beginPath(); x.arc(cx, Y(z), pw * 0.7, 0, TAU); x.fill(); }
    // حزام تطريز عند الخصر الواسع (خفيف)
    embroideryBand(x, 0, w, Y(0.99), Y(0.965), C.gold, C.teal, '#f4e2a8');
  });
  const sleeveTex = canvasTex(512, 512, (x, w, h) => {
    fabricBase(x, w, h, C.dish);
    // v=1 (أعلى القماش) عند المعصم: شريط تطريز الكُمّ
    embroideryBand(x, 0, w, h * 0.012, h * 0.1, C.gold, C.teal, '#f4e2a8');
    x.fillStyle = C.gold; x.fillRect(0, h * 0.108, w, h * 0.012);
  });
  const fabric = (map) => new THREE.MeshPhysicalMaterial({
    map, color: 0xffffff, roughness: 0.78, metalness: 0, side: new URLSearchParams(location.search).has('ds') ? THREE.DoubleSide : THREE.FrontSide,
    normalMap: wn, normalScale: new THREE.Vector2(0.28, 0.28),
    sheen: 0.1, sheenRoughness: 0.7, sheenColor: new THREE.Color(0x805048),
  });

  // ---- بناء الشبكات ----
  const mkSkinned = (geo, mat, name) => {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.name = name; m.position.copy(suit.position); m.quaternion.copy(suit.quaternion); m.scale.copy(suit.scale);
    suit.parent.add(m); m.updateMatrixWorld(true);
    m.bind(suit.skeleton, suit.bindMatrix.clone());
    m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    return m;
  };
  // اتجاه «الخارج» عند نقطة: ابتعاد عن أقرب محور (جذع/ساق/ذراع)
  const outwardAt = (p) => {
    // الحوض من الخلف: أقرب محور هو محور إحدى الساقين فيصير «الخارج» جانبيًا نحو المنتصف، وتُعكس خطأً إشارة أنماط الردفين فتظهر رقاقات داكنة مسنّنة
    // (الهندسة نفسها ناعمة تمامًا؛ العيب في اتجاه الأنماط فقط). نستخدم هنا الابتعاد عن مركز الحوض.
    if (p[2] > 0.5 && p[2] < 0.82 && p[1] > -0.015) { const w = smooth(0.5, 0.58, p[2]) * (1 - smooth(0.74, 0.82, p[2])); if (w > 0.2) return sub(p, [0, 0.02, 0.68]); }
    let best = null, bd = Infinity;
    for (const k in chains) { const q = onChain(chains[k], p); if (q.d < bd) { bd = q.d; best = { k, q }; } }
    let r = sub(p, best.q.c); const t = best.q.tan;
    r = sub(r, [t[0] * dot(r, t), t[1] * dot(r, t), t[2] * dot(r, t)]);
    return r;
  };
  const geoMain = buildGeometry(mainSuit, (S, i) => { const rest = S.p(i), p = displaced(S, i); return { p, uv: uvMain(S, i) }; }, outwardAt);
  const mMain = mkSkinned(geoMain, fabric(mainTex), 'Outfit_dishdasha');

  const sleeveTris = sleeveSuit.concat(sleeveBody);
  const geoSleeve = buildGeometry(sleeveTris, (S, i) => {
    const rest = S.p(i), g = S.dom(i).group;
    const gg = isArm(g) ? g : (rest[0] > 0 ? 'armL' : 'armR');
    return { p: displaced(S, i), uv: armUV(gg, rest) };
  }, outwardAt);
  // الكم والأسورة قماش لا يلتف مع اليد: نحوّل أي تأثير لعظمة المعصم أو الأصابع إلى عظمة الساعد،
  // وإلا مالت الأسورة وانسحبت حافة الكم المسنّنة مع دوران اليد (قبضة القوس تدير المعصم كثيرًا).
  const forearmOnly = (geo) => {
    const bones = suit.skeleton.bones, remap = new Map();
    for (const side of ['L', 'R']) {
      const hand = bm[side + '.hand'], fore = bones.findIndex((b) => b.name === bm[side + '.lowerArm']);
      if (fore < 0) continue;
      bones.forEach((b, i) => { for (let o = b; o; o = o.parent) if (o.name === hand) { remap.set(i, fore); break; } });
    }
    const si = geo.attributes.skinIndex; let n = 0;
    for (let k = 0; k < si.array.length; k++) if (remap.has(si.array[k])) { si.array[k] = remap.get(si.array[k]); n++; }
    si.needsUpdate = true; return n;
  };
  forearmOnly(geoSleeve);
  const mSleeve = mkSkinned(geoSleeve, fabric(sleeveTex), 'Outfit_sleeves');

  // ---- حلقتا الأساور: تغطيان حافة الكم المتعرجة (حدود مثلثات القماش الأصلي) عند المعصم ----
  const cuffTex = canvasTex(256, 64, (x, w, h) => {
    x.fillStyle = C.gold; x.fillRect(0, 0, w, h);
    embroideryBand(x, 0, w, h * 0.12, h * 0.88, C.gold, C.teal, '#f4e2a8');
    x.fillStyle = C.dish; x.fillRect(0, 0, w, 3); x.fillRect(0, h - 3, w, 3);
  }, true);
  const cuffMat = new THREE.MeshPhysicalMaterial({ map: cuffTex, roughness: 0.62, metalness: 0.05, side: THREE.DoubleSide, normalMap: wn, normalScale: new THREE.Vector2(0.2, 0.2) });
  const cuffs = [];
  for (const side of ['L', 'R']) {
    const g = 'arm' + side, ch = chains[g], boneName = bm[side + '.lowerArm'];
    const bi = suit.skeleton.bones.findIndex((b) => b.name === boneName);
    if (bi < 0) continue;
    // الإسقاط على محور الساعد بلا قصّ عند المعصم (قصّ البارامتر عند 2 كان يخلط رؤوس المعصم واليد)
    const e0 = ch[1], ab = sub(ch[2], ch[1]), l2 = dot(ab, ab);
    let sMax = 0; const pts = [];
    for (const t of sleeveTris) for (const i of t.idx) {
      const rp = t.src.p(i), q = onChain(ch, rp), qo = onChain(chains[side === 'L' ? 'armR' : 'armL'], rp);
      if (qo.d < q.d || q.s < 1.3) continue;
      const su = 1 + dot(sub(rp, e0), ab) / l2, c = [e0[0] + ab[0] * (su - 1), e0[1] + ab[1] * (su - 1), e0[2] + ab[2] * (su - 1)];
      if (su > 1.95 || q.d > 0.12) continue;                                 // نتجاهل اليد والمعصم نفسه
      const dp = displaced(t.src, i), su2 = 1 + dot(sub(dp, e0), ab) / l2, c2 = [e0[0] + ab[0] * (su2 - 1), e0[1] + ab[1] * (su2 - 1), e0[2] + ab[2] * (su2 - 1)];
      pts.push({ s: su, d: len(sub(dp, c2)), p: rp, src: t.src, i }); sMax = Math.max(sMax, su);
    }
    const edge = pts.filter((q) => q.s > sMax - 0.05);
    if (edge.length < 6) continue;
    const rEdge = edge.reduce((a2, q) => a2 + q.d, 0) / edge.length + 0.0045;
    const s0 = sMax - 0.19, s1 = sMax + 0.014, K = 14, M = 40;
    const near = pts.filter((q) => q.s > s0 - 0.08), axis = nrm(sub(ch[2], ch[1])), b1 = nrm(cross(axis, [0, 1, 0])), b2 = cross(axis, b1);
    const pos = [], uv = [], nor = [], si = [], sw = [], idx = [];
    for (let k = 0; k <= K; k++) {
      const s = s0 + (s1 - s0) * k / K, c = [ch[1][0] + (ch[2][0] - ch[1][0]) * (s - 1), ch[1][1] + (ch[2][1] - ch[1][1]) * (s - 1), ch[1][2] + (ch[2][2] - ch[1][2]) * (s - 1)];
      const edgeRound = 1 - 0.0 * k;                                                         // حواف الحلقة مستديرة قليلًا
      const R = rEdge * (1 + 0.04 * Math.sin(Math.PI * k / K)) * edgeRound;
      for (let m = 0; m <= M; m++) {
        const a = m / M * TAU, ca = Math.cos(a), sa = Math.sin(a);
        pos.push(c[0] + (b1[0] * ca + b2[0] * sa) * R, c[1] + (b1[1] * ca + b2[1] * sa) * R, c[2] + (b1[2] * ca + b2[2] * sa) * R);
        nor.push(b1[0] * ca + b2[0] * sa, b1[1] * ca + b2[1] * sa, b1[2] * ca + b2[2] * sa);
        uv.push(m / M * 2, k / K);
        // الأوزان من أقرب رأس في الكم (حتى يتبع الحلقة التواء الساعد والمعصم كما يتبعه القماش)
        const wp = [pos[pos.length - 3], pos[pos.length - 2], pos[pos.length - 1]]; let nb = null, nd = Infinity;
        for (const q of near) { const dd = len(sub(q.p, wp)); if (dd < nd) { nd = dd; nb = q; } }
        for (let z = 0; z < 4; z++) { si.push(nb.src.si.array[nb.i * 4 + z]); sw.push(nb.src.sw.array[nb.i * 4 + z]); }
      }
    }
    for (let k = 0; k < K; k++) for (let m = 0; m < M; m++) { const i0 = k * (M + 1) + m, i1 = i0 + 1, i2 = i0 + M + 1, i3 = i2 + 1; idx.push(i0, i2, i1, i1, i2, i3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    geo.setIndex(idx);
    forearmOnly(geo);
    cuffs.push(mkSkinned(geo, cuffMat, 'Outfit_cuff' + side));
  }

  // ---- اللحاف ----
  const lihaf = buildLihaf({ SB, SS, mainSuit, displaced, P, cfg, oc, mkSkinned, suit, wn, C });

  // ---- إزالة الملابس الأصلية والشعر ----
  const gone = [];
  for (const m of all) if (/casualsuit|sportsuit|long01/.test(m.name)) { m.parent.remove(m); m.geometry.dispose(); gone.push(m.name); }
  return { applied: true, meshes: [mMain, mSleeve, lihaf, ...cuffs].filter(Boolean), removed: gone, tri: { main: mainSuit.length, sleeve: sleeveTris.length } };
}

// ---------- اللحاف: حلقات أفقية حول الرأس ثم الكتفين مع فتحة للوجه ----------
function buildLihaf(ctx) {
  const { SB, SS, mainSuit, displaced, P, oc, mkSkinned, wn, C } = ctx;
  const OFF = 0.011, OFF_SH = +(new URLSearchParams(location.search).get('offsh') ?? 0.016);   // سماكة القماش + حجم الشعر تحته
  // 1) نقاط القشرة: رأس/رقبة من الجسم + جذع منفوخ من الثوب (للكتفين)
  const pts = [];
  for (let i = 0; i < SB.n; i++) {
    const d = SB.dom(i);
    if (d.group === 'head' || (d.group === 'torso' && SB.p(i)[2] > 1.04)) pts.push({ p: SB.p(i), head: d.group === 'head', src: SB, i });
  }
  const suitPts = [];
  const seen = new Set();
  for (const t of mainSuit) for (const i of t.idx) { const key = t.src.mesh.id + ':' + i; if (seen.has(key)) continue; seen.add(key); const rp = t.src.p(i); if (rp[2] > 0.84 && Math.abs(rp[0]) < 0.2) suitPts.push({ p: displaced(t.src, i), rest: rp, src: t.src, i }); }
  const zTop = Math.max(...pts.map((q) => q.p[2]));
  const sliceExtents = (z, hw) => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
    for (const q of pts) if (Math.abs(q.p[2] - z) < hw) { x0 = Math.min(x0, q.p[0]); x1 = Math.max(x1, q.p[0]); y0 = Math.min(y0, q.p[1]); y1 = Math.max(y1, q.p[1]); n++; }
    for (const q of suitPts) if (Math.abs(q.p[2] - z) < hw) { x0 = Math.min(x0, q.p[0]); x1 = Math.max(x1, q.p[0]); y0 = Math.min(y0, q.p[1]); y1 = Math.max(y1, q.p[1]); n++; }
    return n ? { x0, x1, y0, y1 } : null;
  };
  // 2) الحلقات: من حافة الكتف إلى قمة الرأس
  const zHem = 0.955, zChin = 1.118, zBrowTop = 1.292, DOME = 0.045;
  const rings = [];
  for (let z = zHem; z <= zTop - DOME; z += (z > zBrowTop - 0.045 && z < zBrowTop + 0.012) ? 0.0035 : 0.01) {
    const e = sliceExtents(z, 0.009); if (!e) continue;
    const hx = (e.x1 - e.x0) / 2, hy = (e.y1 - e.y0) / 2;
    const off = OFF + OFF_SH * (1 - smooth(1.03, 1.11, z));                        // الكتفان: غلاف أوسع قليلًا حتى لا يخترقه الثوب الأحمر فتظهر بقع حمراء
    rings.push({ z, cx: (e.x0 + e.x1) / 2, cy: (e.y0 + e.y1) / 2, rx: hx + off, ry: hy + off });
  }
  // تنعيم أنصاف الأقطار على الارتفاع
  for (let it = 0; it < 4; it++) for (let k = 1; k < rings.length - 1; k++) {
    for (const key of ['cx', 'cy', 'rx', 'ry']) rings[k][key] = 0.25 * rings[k - 1][key] + 0.5 * rings[k][key] + 0.25 * rings[k + 1][key];
  }
  // 3) الإحداثيات: زاوية من الأمام (−y) حول الحلقة؛ فتحة الوجه تضيّق الحلقة إلى قوس مفتوح
  const NCOL = 96, apexZ = zTop + 0.022;
  const open = (z) => {
    if (z < zChin || z > zBrowTop) return 0;
    const zm = (zChin + zBrowTop) / 2, hz = (zBrowTop - zChin) / 2, t = (z - zm) / hz;
    return 0.95 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.6)), 0.5);   // قوس مستدير الطرفين (لا رأس مدبّب فوق الجبهة)
  };
  const SE = 2.15;                                            // أُس القطع الزائد الفائق (أكثر «صندوقية» من الإهليلج)
  const ringPoint = (r, a) => {
    const s = Math.sin(a), c = Math.cos(a);                  // a=0 للأمام (−y)
    const k = Math.pow(Math.pow(Math.abs(s), SE) + Math.pow(Math.abs(c), SE), -1 / SE);
    return [r.cx + r.rx * k * s, r.cy - r.ry * k * c, r.z];
  };
  const verts = [], idxs = [], uvs = [];
  const colsPer = NCOL + 1;
  rings.forEach((r, j) => {
    const a0 = open(r.z);
    for (let c = 0; c <= NCOL; c++) {
      const t = c / NCOL, a = a0 + t * (TAU - 2 * a0);
      verts.push(ringPoint(r, a)); uvs.push([t, j / (rings.length - 1)]);
    }
  });
  for (let j = 0; j < rings.length - 1; j++) for (let c = 0; c < NCOL; c++) {
    const a = j * colsPer + c, b = a + 1, d = a + colsPer, e = d + 1;
    idxs.push(a, d, b, b, d, e);
  }
  // قبّة الرأس: حلقات إضافية بربع قطع ناقص بدل القمة المخروطية، ومعها زيادة طفيفة في الحجم كأن الشعر تحت الطرحة
  const last = rings[rings.length - 1], capH = apexZ - last.z, CAP = 9, zRingTop = last.z;
  for (let k = 1; k <= CAP; k++) {
    const f = k / CAP, sc = Math.cos(f * Math.PI / 2) * 0.985 + 0.015, r = { z: last.z + capH * Math.sin(f * Math.PI / 2), cx: last.cx, cy: last.cy, rx: last.rx * sc, ry: last.ry * sc };
    rings.push(r);
    for (let c = 0; c <= NCOL; c++) { const t = c / NCOL; verts.push(ringPoint(r, t * TAU)); uvs.push([t, 1]); }
    const j = rings.length - 2;
    for (let c = 0; c < NCOL; c++) { const a = j * colsPer + c, b = a + 1, d = a + colsPer, e = d + 1; idxs.push(a, d, b, b, d, e); }
  }
  const topRing = rings[rings.length - 1], apex = verts.length; verts.push([topRing.cx, topRing.cy, apexZ + 0.002]); uvs.push([0.5, 1]);
  for (let c = 0; c < NCOL; c++) idxs.push((rings.length - 1) * colsPer + c, apex, (rings.length - 1) * colsPer + c + 1);
  // 4) أوزان التشكيل من أقرب رأس مرجعي: جذع/ثوب تحت الرقبة، رأس/رقبة فوقها
  const refHead = pts.filter((q) => q.head), refBody = suitPts;
  const nearest = (p, set) => { let b = null, bd = Infinity; for (const q of set) { const dx = q.p[0] - p[0], dy = q.p[1] - p[1], dz = q.p[2] - p[2], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; b = q; } } return b; };
  const n = verts.length, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const ZNECK = 1.075;
  for (let v = 0; v < n; v++) {
    pos.set(verts[v], v * 3); uv.set(uvs[v], v * 2);
    const set = verts[v][2] < ZNECK ? refBody : refHead;
    const q = nearest(verts[v], set.length ? set : refHead);
    for (let k = 0; k < 4; k++) { si[v * 4 + k] = q.src.si.array[q.i * 4 + k]; sw[v * 4 + k] = q.src.sw.array[q.i * 4 + k]; }
  }
  const g = new THREE.BufferGeometry();
  // نفرد المؤشرات إلى مثلثات غير مفهرسة لتناسب smoothNormals نفسها
  const P3 = new Float32Array(idxs.length * 3), U2 = new Float32Array(idxs.length * 2), SI = new Uint16Array(idxs.length * 4), SW = new Float32Array(idxs.length * 4);
  idxs.forEach((vi, o) => { P3.set(pos.subarray(vi * 3, vi * 3 + 3), o * 3); U2.set(uv.subarray(vi * 2, vi * 2 + 2), o * 2); SI.set(si.subarray(vi * 4, vi * 4 + 4), o * 4); SW.set(sw.subarray(vi * 4, vi * 4 + 4), o * 4); });
  g.setAttribute('position', new THREE.BufferAttribute(P3, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U2, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  const ringCenter = (p) => { let b = rings[0], bd = Infinity; for (const r of rings) { const d = Math.abs(r.z - p[2]); if (d < bd) { bd = d; b = r; } } return [p[0] - b.cx, p[1] - b.cy, p[2] > apexZ - 0.03 ? (p[2] - (apexZ - 0.05)) * 0.6 : 0]; };
  g.setAttribute('normal', new THREE.BufferAttribute(smoothNormals(P3, ringCenter), 3));

  const tex = canvasTex(512, 512, (x, w, h) => {
    fabricBase(x, w, h, oc.lihaf || '#1e2a45', 0.06);
    const bd = oc.lihafBorder || '#c9a14a';
    // v=0 عند الحافة السفلى: شريط مطرّز
    embroideryBand(x, 0, w, h * 0.945, h * 0.995, bd, C.teal, '#f4e2a8');
    // حافتا فتحة الوجه (u≈0 و u≈1): خط ذهبي رفيع
    const vA = (zChin - rings[0].z) / (zRingTop - rings[0].z), vB = (zBrowTop - rings[0].z) / (zRingTop - rings[0].z);
    x.fillStyle = bd; x.fillRect(0, (1 - vB) * h, w * 0.012, (vB - vA) * h); x.fillRect(w * 0.988, (1 - vB) * h, w * 0.012, (vB - vA) * h);
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.flipY = true;
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex, color: 0xffffff, roughness: 0.62, side: THREE.DoubleSide, normalMap: wn, normalScale: new THREE.Vector2(0.2, 0.2),
    sheen: 0.3, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x8a9ac8),
  });
  const m = mkSkinned(g, mat, 'Outfit_lihaf');
  m.userData.rings = rings.length; m.userData.apex = apexZ; m.userData.zTop = zTop; m.userData.zRingTop = zRingTop;
  return m;
}
