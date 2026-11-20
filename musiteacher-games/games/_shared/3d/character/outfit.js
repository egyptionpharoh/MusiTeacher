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
  const male = oc.style === 'male';                 // العازف: دشداشة بيضاء إلى الكعبين + مَصَرّ + فراخة، بلا لحاف ولا سروال ظاهر
  root.updateMatrixWorld(true);
  const all = []; root.traverse((o) => { if (o.isSkinnedMesh) all.push(o); });
  const find = (re) => all.find((m) => re.test(m.name));
  const body = find(/^Human$/), suit = find(/sportsuit/), casual = find(/casualsuit/);
  if (!body || !suit || !casual) return { applied: false, reason: 'لم يُعثر على شبكتي الجسم والملابس' };
  // تناسق منطقة الحوض: شبكة MakeHuman الافتراضية ممتلئة الحوض، ثم يضيف النفخ الشعاعي للثوب سماكة أخرى حتى يبدو الحوض والمؤخرة والفخذان أكبر من الصدر والكتفين.
  // نخفّف عمق المؤخرة وعرض الحوض قليلًا (وزن ناعم بحسب الارتفاع) في شبكتي الملابس قبل التفصيل، فيتبعهما الزي كله بلا أي تغيير في الأوزان.
  const _q = (k, d) => { const v = new URLSearchParams(location.search).get(k); return v == null ? d : +v; };
  const hipK = cfg.hipRefine ?? { depth: _q('hipd', 0.14), width: _q('hipw', 0.045) };
  if (!male) for (const mesh of [suit, casual]) { reshapeHips(mesh, hipK); }      // جسم الذكر (من أهداف MakeHuman) حوضه أضيق أصلًا
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
  const HEM = male ? 0.045 : 0.185;                         // ارتفاع حافة الدشداشة عن الأرض (العازفة: فوقها كم السروال؛ العازف: إلى الكعبين)
  const D_LEG = male ? [[0.0, 0.014], [0.03, 0.022], [0.07, 0.027], [0.14, 0.028], [0.24, 0.026], [0.39, 0.021], [0.55, 0.020], [0.72, 0.022]]
    : [[0.0, 0.012], [0.07, 0.014], [HEM - 0.012, 0.016], [HEM + 0.012, 0.030], [0.20, 0.028], [0.39, 0.020], [0.55, 0.020], [0.72, 0.022]];
  const D_ARM = [[0, 0.012], [1, 0.013], [1.7, 0.012], [2.0, 0.012]];   // كمّ أضيق عند المعصم (كان 0.021 فتبدو الأسورة حلقة واسعة سائبة)

  const dispGroup = (g, p) => {
    if (g === 'torso') {
      const q = onChain(chains.torso, p);
      let r = sub(p, q.c); r = sub(r, [q.tan[0] * dot(r, q.tan), q.tan[1] * dot(r, q.tan), q.tan[2] * dot(r, q.tan)]);
      const L = len(r) || 1, a = Math.atan2(p[0], -(p[1] - P.spine[1]));
      let d = table(D_TORSO, p[2]) + folds(a, p[2], 0.0035 * smooth(1.0, 0.74, p[2]));
      if (male) { const cz = collarZ(p); d *= 0.25 + 0.75 * smooth(cz - 0.005, cz - 0.07, p[2]); }   // فتحة الرقبة تلامس الرقبة
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
  // خط فتحة الدشداشة (العازف): عند قاعدة الرقبة خلفًا، وأخفض أمامًا كفتحة الدشداشة العمانية. القماش فوقه يُحذف والجلد تحته يُخفى.
  const collarZ = (p) => { const vx = p[0] - P.neck[0], vy = p[1] - P.neck[1], L = Math.hypot(vx, vy) || 1, front = Math.max(0, -vy / L); return P.neck[2] + 0.005 - 0.04 * Math.pow(front, 1.5); };
  const belowCollar = (S, idx) => idx.some((i) => { const p = S.p(i); return p[2] < collarZ(p) + 0.004; });
  const mainSuit = trisFrom(SC, (ds, idx) => notArm(ds) && (!male || belowCollar(SC, idx))).concat(trisFrom(SS, (ds, idx, zc) => notArm(ds) && zc < 0.80));
  const sleeveSuit = trisFrom(SC, (ds) => isArm(majority(ds)));
  // العازف: غلاف الذراع الذكري يغطي الذراع كله؛ إضافة جلد ذراع العازفة فوقه تُنتج طبقتين متقاطعتين (حواف ممزّقة عند الكتف والعضد)
  const sleeveBody = male ? [] : trisFrom(SB, (ds) => ds.every((d) => isArm(d.group) && /^(upperarm|lowerarm)/.test(d.name)));

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
  const mainTex = male ? maleMainTex(C, HT, HEM) : canvasTex(1024, 1024, (x, w, h) => {
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
  const sleeveTex = male ? canvasTex(512, 512, (x, w, h) => { fabricBase(x, w, h, C.dish, 0.035); x.fillStyle = C.gold; x.fillRect(0, h * 0.05, w, h * 0.006); x.fillRect(0, h * 0.075, w, h * 0.004); }) : canvasTex(512, 512, (x, w, h) => {
    fabricBase(x, w, h, C.dish);
    // v=1 (أعلى القماش) عند المعصم: شريط تطريز الكُمّ
    embroideryBand(x, 0, w, h * 0.012, h * 0.1, C.gold, C.teal, '#f4e2a8');
    x.fillStyle = C.gold; x.fillRect(0, h * 0.108, w, h * 0.012);
  });
  const fabric = (map) => new THREE.MeshPhysicalMaterial({
    map, color: 0xffffff, roughness: 0.78, metalness: 0, side: new URLSearchParams(location.search).has('ds') ? THREE.DoubleSide : THREE.FrontSide,
    normalMap: wn, normalScale: new THREE.Vector2(0.28, 0.28),
    sheen: 0.1, sheenRoughness: 0.7, sheenColor: new THREE.Color(male ? 0xd8d4cc : 0x805048),
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
  const geoMain = buildGeometry(mainSuit, (S, i) => {
    const rest = S.p(i); let p = displaced(S, i);
    return { p, uv: uvMain(S, i) };
  }, outwardAt);
  // العازف: قصّ القماش قصًّا هندسيًا على خط فتحة الرقبة (لا حذف مثلثات كاملة) فتخرج حافة نظيفة يغطيها الطوق
  let collarEdge = null;
  if (male) collarEdge = clipAbove(geoMain, (q) => q[2] - (collarZ(q) + 0.003));
  const mMain = mkSkinned(geoMain, fabric(mainTex), 'Outfit_dishdasha');

  const sleeveTris = sleeveSuit.concat(sleeveBody);
  // العازف: نهاية الكم (حدّ مثلثات الغلاف عند المعصم متعرّج) تُسوّى على مستوى عمودي على الساعد فتصير حافة مستقيمة تحت الأسورة
  const hemS = {};
  // الإسقاط على محور الساعد بلا قصّ (رؤوس ما بعد مفصل المعصم لها s=2 بعد القصّ فلا تُسوّى)؛ الحافة قبل المعصم بقليل
  const foreS = (gg, p) => { const ch = chains[gg], ab = sub(ch[2], ch[1]); return 1 + dot(sub(p, ch[1]), ab) / dot(ab, ab); };
  if (male) { hemS.armL = 1.965; hemS.armR = 1.965; }
  const geoSleeve = buildGeometry(sleeveTris, (S, i) => {
    const rest = S.p(i), g = S.dom(i).group;
    const gg = isArm(g) ? g : (rest[0] > 0 ? 'armL' : 'armR');
    let p = displaced(S, i);
    if (male && hemS[gg]) {
      const ch = chains[gg], su = foreS(gg, rest), cut = hemS[gg] - 0.035;
      if (su > cut && onChain(ch, rest).s > 1) { const ab = sub(ch[2], ch[1]); p = [p[0] - ab[0] * (su - cut), p[1] - ab[1] * (su - cut), p[2] - ab[2] * (su - cut)]; }
    }
    return { p, uv: armUV(gg, rest) };
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
  // العازف: أوزان طرف الكم موحّدة (متوسط الحلقة) فيلتف الطرف قطعةً واحدة مع الساعد بدل أن تتعرّج رؤوسه بين عظمتي الساعد
  if (male) {
    const pa = geoSleeve.attributes.position, sI = geoSleeve.attributes.skinIndex, sW = geoSleeve.attributes.skinWeight;
    for (const gg of ['armL', 'armR']) {
      if (!hemS[gg]) continue;
      const ch = chains[gg], cut = hemS[gg] - 0.035, sv = [], acc = new Map();
      for (let i = 0; i < pa.count; i++) {
        const p = [pa.getX(i), pa.getY(i), pa.getZ(i)], q = onChain(ch, p), qo = onChain(chains[gg === 'armL' ? 'armR' : 'armL'], p);
        if (qo.d < q.d || q.s < cut - 0.16) continue;
        sv.push([i, q.s]);
        if (q.s > cut - 0.06) for (let k = 0; k < 4; k++) { const b = sI.array[i * 4 + k], w = sW.array[i * 4 + k]; if (w > 0) acc.set(b, (acc.get(b) || 0) + w); }
      }
      const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((a, b) => a + b[1], 0) || 1;
      for (const [i, sv0] of sv) {
        const t = smooth(cut - 0.15, cut - 0.05, sv0), cur = new Map();
        for (let k = 0; k < 4; k++) { const b = sI.array[i * 4 + k], w = sW.array[i * 4 + k]; if (w > 0) cur.set(b, (cur.get(b) || 0) + w * (1 - t)); }
        for (const [b, w] of top) cur.set(b, (cur.get(b) || 0) + t * w / tot);
        const best = [...cur.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4), bt = best.reduce((a, b) => a + b[1], 0) || 1;
        for (let k = 0; k < 4; k++) { sI.array[i * 4 + k] = best[k] ? best[k][0] : 0; sW.array[i * 4 + k] = best[k] ? best[k][1] / bt : 0; }
      }
    }
    sI.needsUpdate = sW.needsUpdate = true;
  }
  // العازف: أنماط مشتركة بين الثوب والكمّين (حدّهما متعرّج بين المثلثات، وانقطاع التظليل عنده كان يبدو كقماش ممزّق عند الكتف)
  if (male) {
    const a = geoMain.attributes.position.array, b = geoSleeve.attributes.position.array, all = new Float32Array(a.length + b.length);
    all.set(a, 0); all.set(b, a.length);
    const nn = smoothNormals(all, null);            // أغلفة MakeHuman متسقة الاتجاه أصلًا؛ تخمين «الخارج» كان يقلب أنماط بعض الأوجه (بقع ظل ممزقة عند الإبط والخصر)
    geoMain.setAttribute('normal', new THREE.BufferAttribute(nn.slice(0, a.length), 3));
    geoSleeve.setAttribute('normal', new THREE.BufferAttribute(nn.slice(a.length), 3));
  }
  const mSleeve = mkSkinned(geoSleeve, fabric(sleeveTex), 'Outfit_sleeves');

  // ---- حلقتا الأساور: تغطيان حافة الكم المتعرجة (حدود مثلثات القماش الأصلي) عند المعصم ----
  const cuffTex = male ? canvasTex(256, 64, (x, w, h) => { fabricBase(x, w, h, C.dish, 0.03); x.fillStyle = C.gold; x.fillRect(0, h * 0.42, w, h * 0.07); x.fillRect(0, h * 0.58, w, h * 0.04); }, true) : canvasTex(256, 64, (x, w, h) => {
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
    let rEdge = edge.reduce((a2, q) => a2 + q.d, 0) / edge.length + 0.0045;
    let s0 = sMax - 0.19, s1 = sMax + 0.014; const K = 14, M = 40;
    if (male) {           // أسورة ضيقة عند حافة الكم المستقيمة، وتحيط بالكم كله (نصف القطر الأقصى) فلا يخترقها القماش بأسنان متعرجة
      const cut = (hemS[g] || sMax) - 0.035, band = pts.filter((q) => q.s > cut - 0.09 && q.s < cut + 0.01);
      if (band.length > 6) rEdge = Math.max(...band.map((q) => q.d)) + 0.0025;
      s0 = cut - 0.075; s1 = cut + 0.004;
    }
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
    cuffs.push(mkSkinned(geo, male ? fabric(cuffTex) : cuffMat, 'Outfit_cuff' + side));
  }

  // العازف: جلد العضد والساعد تحت الكم مخفي (يُربط بأوزان مختلفة عن الكم فيبرز منه عند ثني الذراع)؛ يبقى طرف الساعد قرب المعصم تحت الأسورة
  if (male) {
    const pa = SB.pos; let hid = 0;
    for (let t = 0; t + 2 < SB.n; t += 3) {
      // قاعدة موحّدة: يُخفى المثلث إن كانت رؤوسه كلها تحت الثوب (جذع، أو أسفل الرقبة داخل الطوق، أو عضد/ساعد تحت الكم)،
      // حتى المثلثات المختلطة بين الترقوة والعضد أو الرقبة (كانت تبرز كبقع جلد عند الكتف)
      const ok = [t, t + 1, t + 2].every((i) => {
        const d = SB.dom(i), p = SB.p(i);
        if (/^(spine|clavicle|shoulder01|breast|pelvis|root|neck0[12])/.test(d.name)) return p[2] < collarZ(p) - 0.002;
        if (isArm(d.group) && /^(upperarm|lowerarm01)/.test(d.name)) return onChain(chains[d.group], p).s < 1.72;
        return false;
      });
      if (!ok) continue;
      // مثلث صفري: الرؤوس الثلاثة في نقطة واحدة وبأوزان واحدة (وإلا فرّقها التحريك فظهرت شظايا جلد عبر القماش)
      for (let k = 1; k < 3; k++) { pa.setXYZ(t + k, pa.getX(t), pa.getY(t), pa.getZ(t)); for (let q = 0; q < 4; q++) { SB.si.array[(t + k) * 4 + q] = SB.si.array[t * 4 + q]; SB.sw.array[(t + k) * 4 + q] = SB.sw.array[t * 4 + q]; } }
      hid++;
    }
    pa.needsUpdate = true; SB.si.needsUpdate = SB.sw.needsUpdate = true; applyOutfit.hiddenTris = hid;
  }
  // ---- اللحاف (العازفة) أو المَصَرّ وطوق الرقبة والفراخة (العازف) ----
  const ctx = { SB, SS, mainSuit, displaced, P, cfg, oc, mkSkinned, suit, wn, C, root, bm, collarZ, collarEdge };
  const lihaf = male ? null : buildLihaf(ctx);
  const maleParts = male ? buildMaleHeadAndCollar(ctx) : [];
  if (male) { const dr = buildRobeDrape({ ...ctx, chains, HEM, onChain, mat: fabric(mainTex), HT }); if (dr) maleParts.push(dr); }

  // ---- إزالة الملابس الأصلية والشعر ----
  const gone = [];
  for (const m of all) if (/casualsuit|sportsuit|long01/.test(m.name)) { m.parent.remove(m); m.geometry.dispose(); gone.push(m.name); }
  return { applied: true, style: male ? 'male' : 'female', meshes: [mMain, mSleeve, lihaf, ...cuffs, ...maleParts].filter(Boolean), removed: gone, tri: { main: mainSuit.length, sleeve: sleeveTris.length } };
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

// =====================================================================
//  زيّ العازف العُماني: دشداشة بيضاء بلا ياقة، بفتحة صدر قصيرة مطرّزة بخيط بلون العاج، وفراخة (كشكوشة) تتدلّى من الطوق،
//  ومَصَرّ ملفوف على الرأس (قماش مطرّز بنقوش صغيرة وحافة ملوّنة) فوق الأذنين، تظهر فيه طيّات اللف المائلة.
// =====================================================================
function maleMainTex(C, HT, HEM) {
  return canvasTex(1024, 1024, (x, w, h) => {
    fabricBase(x, w, h, C.dish, 0.035);
    const Y = (z) => (1 - z / HT) * h, cx = w * 0.5;
    // فتحة الصدر (الجيب الأمامي) من الطوق إلى منتصف الصدر: خطّا تطريز رفيعان وغرزة متعرجة بينهما
    const top = Y(1.135), bot = Y(1.035), pw = w * 0.0065;
    x.fillStyle = C.gold; x.fillRect(cx - pw * 1.8, top, pw * 0.45, bot - top); x.fillRect(cx + pw * 1.35, top, pw * 0.45, bot - top);
    x.strokeStyle = C.teal; x.lineWidth = 1.2; x.beginPath();
    for (let y = top, k = 0; y < bot; y += 5, k++) x.lineTo(cx + (k % 2 ? pw : -pw) * 0.7, y);
    x.stroke();
    x.fillStyle = 'rgba(0,0,0,.10)'; x.fillRect(cx - 0.6, top, 1.2, bot - top);          // خط الفتحة
    // طوق الرقبة: شريط تطريز رفيع
    x.fillStyle = C.gold; x.fillRect(0, Y(1.142), w, Y(1.128) - Y(1.142));
    // حافة الذيل: درزة مزدوجة خفيفة
    x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, Y(HEM + 0.006), w, 2); x.fillRect(0, Y(HEM + 0.012), w, 1);
  });
}

function masarTexture(cols) {
  // قماش المصر: أرضية عاجية بنقش «بوته» كشميري (قطرة منحنية الطرف) متكرر بلونين، وحافة ملوّنة عند طرف اللفة الظاهر
  const [base, a, b] = cols;
  return canvasTex(1024, 512, (x, w, h) => {
    fabricBase(x, w, h, base, 0.04);
    let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const boteh = (px, py, sz, ang, c1, c2) => {
      x.save(); x.translate(px, py); x.rotate(ang);
      const drop = (k) => { x.beginPath(); x.moveTo(0, -sz * 1.05 * k); x.bezierCurveTo(sz * 0.95 * k, -sz * 0.55 * k, sz * 0.75 * k, sz * 0.75 * k, 0, sz * 0.62 * k);
        x.bezierCurveTo(-sz * 0.72 * k, sz * 0.62 * k, -sz * 0.62 * k, -sz * 0.15 * k, -sz * 0.08 * k, -sz * 0.42 * k); x.quadraticCurveTo(sz * 0.18 * k, -sz * 0.75 * k, 0, -sz * 1.05 * k); x.closePath(); };
      x.fillStyle = c1; drop(1); x.fill();
      x.fillStyle = base; drop(0.68); x.fill();
      x.fillStyle = c2; drop(0.45); x.fill();
      x.fillStyle = c1; for (let k = 0; k < 5; k++) { const t = k / 4; x.beginPath(); x.arc(-sz * 0.95 + t * sz * 0.2, sz * 0.9 - t * sz * 1.6, sz * 0.09, 0, TAU); x.fill(); }   // نقاط زخرفية جانبية
      x.restore();
    };
    const rows = 6, cols2 = 12;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols2; i++) {
      const px = (i + (j % 2) * 0.5 + 0.25) * w / cols2, py = (j + 0.55) * h * 0.86 / rows;
      const flip = (i + j) % 2 ? 1 : -1;
      boteh(px, py, 17 + r() * 3, 0.5 * flip + (r() - 0.5) * 0.25, (i + 2 * j) % 3 ? b : a, (i + 2 * j) % 3 ? a : b);
      // زهيرات صغيرة بين النقوش
      x.fillStyle = a; x.beginPath(); x.arc(px + w / cols2 * 0.5, py + h * 0.86 / rows * 0.5, 3, 0, TAU); x.fill();
    }
    // خطوط «اللفة» الخفيفة المائلة (تُبرز أن القماش ملفوف طبقات)
    x.strokeStyle = 'rgba(80,60,40,.10)'; x.lineWidth = 3;
    for (let i = -h; i < w; i += 64) { x.beginPath(); x.moveTo(i, h * 0.88); x.lineTo(i + h * 0.9, 0); x.stroke(); }
    // حافة الطرف الظاهر (شريط ملوّن مزدوج بحبيبات) عند الأسفل
    x.fillStyle = a; x.fillRect(0, h * 0.895, w, h * 0.055); x.fillStyle = b; x.fillRect(0, h * 0.958, w, h * 0.022);
    for (let i = 0; i < w; i += 14) { x.fillStyle = base; x.fillRect(i, h * 0.91, 6, h * 0.025); }
  });
}

function buildMaleHeadAndCollar(ctx) {
  const { SB, mainSuit, displaced, P, oc, mkSkinned, suit, wn, C, root } = ctx;
  const bones = suit.skeleton.bones, bi = (n) => bones.findIndex((b) => b.name === n);
  const headIdx = bi('head'), chestIdx = bi('spine01') >= 0 ? bi('spine01') : bi('spine02'), neckIdx = bi('neck01');
  // معالم الرأس من الشبكة الفعلية (فضاء الهندسة: z للأعلى، الوجه −y)
  const head = [];
  for (let i = 0; i < SB.n; i++) if (SB.dom(i).group === 'head') head.push(SB.p(i));
  const eyes = (() => { let m = null; root.traverse((o) => { if (o.isMesh && /high-poly/.test(o.name)) m = o; }); return m; })();
  let eyeZ = 0, eyeY = 0;
  if (eyes) { const p = eyes.geometry.attributes.position; for (let i = 0; i < p.count; i++) { eyeZ += p.getZ(i); eyeY += p.getY(i); } eyeZ /= p.count; eyeY /= p.count; }
  const zTop = Math.max(...head.map((p) => p[2]));
  const slice = (z, hw = 0.006) => { let x0 = 9, x1 = -9, y0 = 9, y1 = -9, n = 0; for (const p of head) if (Math.abs(p[2] - z) < hw) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); n++; } return n > 6 ? { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2 } : null; };
  // ---- المَصَرّ ----
  // الحافة السفلى مائلة: فوق منتصف الجبهة أمامًا، فوق الأذنين جانبًا، وعند مؤخرة الرأس خلفًا
  // المصر يُلبس منخفضًا: يغطي أعلى الجبهة (نحو 3 سم فوق الحاجبين)، وأعلى الأذنين جانبًا، ومؤخرة الرأس خلفًا؛ ويعلو قمة الرأس بنحو 4–5 سم
  const zFront = eyeZ + 0.028, zSide = eyeZ + 0.010, zBack = eyeZ - 0.022, zCap = zTop + 0.024;     // أخفض قليلًا: المصر ملفوف لا أسطوانة عالية
  const NC = 120, NR = 26;
  const ext = []; for (let z = zBack - 0.01; z <= zTop - 0.004; z += 0.004) { const e = slice(z); if (e) ext.push({ z, ...e }); }
  for (let it = 0; it < 3; it++) for (let k = 1; k < ext.length - 1; k++) for (const key of ['cx', 'cy', 'rx', 'ry']) ext[k][key] = 0.25 * ext[k - 1][key] + 0.5 * ext[k][key] + 0.25 * ext[k + 1][key];
  const extAt = (z) => { if (z <= ext[0].z) return ext[0]; for (let k = 1; k < ext.length; k++) if (z <= ext[k].z) { const a = ext[k - 1], b = ext[k], t = (z - a.z) / (b.z - a.z); return { cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), rx: lerp(a.rx, b.rx, t), ry: lerp(a.ry, b.ry, t) }; } return ext[ext.length - 1]; };
  // جوانب المصر شبه عمودية: لا يتبع انحناء الجمجمة نحو القمة (وإلا بدا قلنسوة صغيرة)، بل يحافظ على اتساعه ثم ينغلق بقبة مسطحة
  { let mx = 0, my = 0; const zRef = zFront; for (const e of ext) if (e.z >= zBack && e.z <= zRef + 0.01) { mx = Math.max(mx, e.rx); my = Math.max(my, e.ry); }
    for (const e of ext) if (e.z > zRef) { const k = 1 - 0.10 * smooth(zRef, zTop, e.z); e.rx = Math.max(e.rx, mx * k); e.ry = Math.max(e.ry, my * k); } }
  const zLast = ext[ext.length - 1].z;
  const SE = 2.3;
  const verts = [], uvs = [], idx = [];
  for (let j = 0; j <= NR; j++) {
    const t = j / NR;
    for (let c = 0; c <= NC; c++) {
      const u = c / NC, a = u * TAU - Math.PI, s = Math.sin(a), co = -Math.cos(a);        // a=0 للأمام
      const zb = co > 0 ? lerp(zSide, zFront, co) : lerp(zSide, zBack, -co);
      // من الحافة إلى أعلى القماش ثم قبّة مسطّحة قليلًا
      const tz = Math.min(1, t / 0.78), z = t <= 0.78 ? lerp(zb, zCap - 0.012, Math.pow(tz, 0.9)) : lerp(zCap - 0.012, zCap, Math.sin((t - 0.78) / 0.22 * Math.PI / 2));
      const e = extAt(Math.min(z, zLast));
      // سُمك اللف: يزداد من الحافة إلى منتصف الارتفاع ثم يقل نحو القمة، مع طبقات لفّ مائلة تتقاطع أمامًا (شكل V)
      const bulk = 0.011 + 0.012 * smooth(0, 0.35, t) + 0.006 * Math.sin(Math.PI * t);     // أعرض في منتصف اللفة
      const phase = t * 3.4 + Math.abs(a) / Math.PI * 1.9, layer = 1 - (phase - Math.floor(phase));
      const fold = 0.0075 * Math.pow(layer, 1.6) * (t < 0.8 ? 1 : smooth(0.95, 0.8, t));     // حواف طبقات اللف المائلة
      const capK = t <= 0.72 ? 1 : Math.pow(Math.cos((t - 0.72) / 0.28 * Math.PI / 2), 0.7) * 0.97 + 0.03;     // حافة علوية مستديرة (قماش ملفوف) ثم قمة شبه مسطحة
      const k = Math.pow(Math.pow(Math.abs(s), SE) + Math.pow(Math.abs(co), SE), -1 / SE);
      const rx = (e.rx + bulk + fold) * capK, ry = (e.ry + bulk + fold) * capK;
      verts.push([e.cx + rx * k * s, e.cy - ry * k * co, z]);
      uvs.push([u * 3, t]);
    }
  }
  for (let j = 0; j < NR; j++) for (let c = 0; c < NC; c++) { const a = j * (NC + 1) + c, b = a + 1, d = a + NC + 1, e = d + 1; idxs3(idx, a, b, d, e); }
  const apex = verts.length; verts.push([extAt(zLast).cx, extAt(zLast).cy, zCap + 0.002]); uvs.push([0.5, 1]);
  for (let c = 0; c < NC; c++) idx.push(NR * (NC + 1) + c, apex, NR * (NC + 1) + c + 1);
  const rigid = (boneIndex) => (v) => [boneIndex, 0, 0, 0, 1, 0, 0, 0];
  const masarGeo = flatGeo(verts, uvs, idx, rigid(headIdx), (p) => { const e = extAt(Math.min(p[2], zLast)); return [p[0] - e.cx, p[1] - e.cy, p[2] > zLast ? (p[2] - zLast) * 1.4 : 0]; });
  const cols = oc.masar || ['#ece3cf', '#8b2d3a', '#2f6170'];
  const masarMat = new THREE.MeshPhysicalMaterial({ map: masarTexture(cols), roughness: 0.74, side: THREE.DoubleSide, normalMap: wn, normalScale: new THREE.Vector2(0.25, 0.25), sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xfff4e0) });
  const masar = mkSkinned(masarGeo, masarMat, 'Outfit_masar');
  // ---- طوق الرقبة ----
  // أعلى نقاط الدشداشة حول الرقبة = حافة فتحتها؛ حلقة قماش رفيعة تغطيها حتى لا يظهر أي فراغ بين الجلد والثوب
  // الطوق عند قاعدة الرقبة ومائل كفتحة الدشداشة: أعلى خلفًا وأخفض أمامًا (وإلا ارتفع مع القماش على الرقبة واصطدم بالكمان ومسند الذقن)
  const zCollarMax = ctx.collarZ;
  const top = [];
  const seen = new Set();
  if (ctx.collarEdge && ctx.collarEdge.length > 20) top.push(...ctx.collarEdge.map((q) => [q[0], q[1], q[2] - 0.003]));     // مركز الطوق تحت حافة القصّ بقليل: يغطيها ولا يرتفع على الرقبة
  else for (const tr of mainSuit) for (const i of tr.idx) { const key = tr.src.mesh.id + ':' + i; if (seen.has(key)) continue; seen.add(key); const p = displaced(tr.src, i); if (p[2] > 1.05 && p[2] < zCollarMax(p) && Math.abs(p[0]) < 0.11) top.push(p); }
  const neck = P.neck, NA = 72, ring = [];
  for (let c = 0; c < NA; c++) {
    const a = c / NA * TAU, dx = Math.sin(a), dy = -Math.cos(a);
    let best = null;
    for (const p of top) { const vx = p[0] - neck[0], vy = p[1] - neck[1], L = Math.hypot(vx, vy) || 1; if ((vx * dx + vy * dy) / L < 0.985) continue; if (!best || p[2] > best[2]) best = p; }
    ring.push(best);
  }
  for (let c = 0; c < NA; c++) if (!ring[c]) { for (let k = 1; k < NA; k++) { const q = ring[(c + k) % NA] || ring[(c - k + NA) % NA]; if (q) { ring[c] = q; break; } } }
  const smoothRing = ring.map((p, c) => { const q = [0, 0, 0]; for (let k = -3; k <= 3; k++) { const r = ring[(c + k + NA) % NA]; q[0] += r[0]; q[1] += r[1]; q[2] += r[2]; } return q.map((v) => v / 7); });
  const cv = [], cu = [], ci = [], RW = 0.0045, TH = 0.004;
  for (let c = 0; c <= NA; c++) {
    const p = smoothRing[c % NA], o = [p[0] - neck[0], p[1] - neck[1]], L = Math.hypot(o[0], o[1]) || 1, n = [o[0] / L, o[1] / L];
    for (const [dz, dr] of [[-RW, 0], [-RW, TH], [RW, TH], [RW, 0]]) { cv.push([p[0] + n[0] * (dr + 0.002), p[1] + n[1] * (dr + 0.002), p[2] + dz]); cu.push([c / NA * 4, dz > 0 ? 1 : 0]); }
  }
  for (let c = 0; c < NA; c++) for (let k = 0; k < 3; k++) { const a = c * 4 + k, b = a + 1, d = a + 4, e = d + 1; idxs3(ci, a, b, d, e); }
  const collarGeo = flatGeo(cv, cu, ci, (p) => [neckIdx >= 0 ? neckIdx : chestIdx, chestIdx, 0, 0, 0.35, 0.65, 0, 0], (p) => [p[0] - neck[0], p[1] - neck[1], 0]);
  const collarTex = canvasTex(256, 32, (x, w, h) => { fabricBase(x, w, h, C.dish, 0.03); x.fillStyle = C.gold; x.fillRect(0, h * 0.4, w, h * 0.2); }, true);
  const collar = mkSkinned(collarGeo, new THREE.MeshPhysicalMaterial({ map: collarTex, roughness: 0.75, normalMap: wn, normalScale: new THREE.Vector2(0.2, 0.2) }), 'Outfit_collar');
  // ---- الفراخة (الكشكوشة): حبل قصير معطّر يتدلّى من الطوق أمامًا، ينتهي بشرّابة ----
  const front = smoothRing[0];
  const surfY = (x, z) => { let best = null; for (const tr of mainSuit) for (const i of tr.idx) { const p = displaced(tr.src, i); if (Math.abs(p[0] - x) < 0.01 && Math.abs(p[2] - z) < 0.01 && (!best || p[1] < best)) best = p[1]; } return best; };
  const path = []; const LEN = 0.12, NS = 14, TX = -0.014;        // الفراخة: أقصر، تتدلى يمين فتحة الصدر (كما في الدشداشة العمانية)
  for (let k = 0; k <= NS; k++) { const z = front[2] - 0.004 - LEN * k / NS, y = surfY(TX, z); path.push([TX, (y ?? front[1]) - 0.0045, z]); }
  const tv = [], tu = [], ti = [], RAD = 0.0022, NSEG = 8;
  for (let k = 0; k <= NS; k++) {
    const p = path[k], tail = k > NS - 3 ? 1 + (k - (NS - 3)) * 0.9 : 1;      // تنتفخ في آخرها كشرّابة
    for (let m = 0; m <= NSEG; m++) { const a = m / NSEG * TAU; tv.push([p[0] + Math.cos(a) * RAD * tail, p[1] + Math.sin(a) * RAD * tail * 0.8, p[2]]); tu.push([m / NSEG, k / NS]); }
  }
  for (let k = 0; k < NS; k++) for (let m = 0; m < NSEG; m++) { const a = k * (NSEG + 1) + m, b = a + 1, d = a + NSEG + 1, e = d + 1; idxs3(ti, a, b, d, e); }
  const last = path[NS], tipI = tv.length; tv.push([last[0], last[1], last[2] - 0.006]); tu.push([0.5, 1]);
  for (let m = 0; m < NSEG; m++) ti.push(NS * (NSEG + 1) + m, NS * (NSEG + 1) + m + 1, tipI);
  const tasselGeo = flatGeo(tv, tu, ti, () => [chestIdx, 0, 0, 0, 1, 0, 0, 0], (p) => { const q = path.reduce((b, c) => (Math.abs(c[2] - p[2]) < Math.abs(b[2] - p[2]) ? c : b)); return [p[0] - q[0], p[1] - q[1], 0]; });
  const tassel = mkSkinned(tasselGeo, new THREE.MeshPhysicalMaterial({ color: new THREE.Color(oc.tassel || '#e9e2d2'), roughness: 0.7, sheen: 0.3, sheenColor: new THREE.Color(0xffffff) }), 'Outfit_farukha');
  // الشعر الطويل والرموش الأنثوية تُعالج في مكان آخر؛ المصر يغطي الشعر
  masar.userData.landmarks = { eyeZ, eyeY, zTop, zFront, zSide, zBack };
  return [masar, collar, tassel];
}
// قصّ شبكة غير مفهرسة عند السطح f(p)=0 مع إبقاء الجزء f≤0. الرؤوس الجديدة على الحافة تُستوفى خطيًا (الموضع، UV، الأنماط، الأوزان)،
// وتأخذ مؤشرات العظام من الرأس الداخلي. يعيد نقاط الحافة الجديدة.
function clipAbove(geo, f) {
  const A = geo.attributes, names = ['position', 'uv', 'normal', 'skinIndex', 'skinWeight'].filter((k) => A[k]);
  const src = Object.fromEntries(names.map((k) => [k, { a: A[k].array, s: A[k].itemSize }]));
  const out = Object.fromEntries(names.map((k) => [k, []]));
  const edge = [], n = A.position.count;
  const get = (k, i) => Array.from(src[k].a.subarray(i * src[k].s, (i + 1) * src[k].s));
  const vtx = (i) => Object.fromEntries(names.map((k) => [k, get(k, i)]));
  const mix = (a, b, t) => { const o = {}; for (const k of names) o[k] = k === 'skinIndex' ? a[k].slice() : a[k].map((v, j) => v + (b[k][j] - v) * t); return o; };
  const push = (v) => { for (const k of names) out[k].push(...v[k]); };
  for (let t = 0; t < n; t += 3) {
    const V = [vtx(t), vtx(t + 1), vtx(t + 2)], F = V.map((v) => f(v.position));
    const ins = F.map((x) => x <= 0), ni = ins.filter(Boolean).length;
    if (ni === 3) { V.forEach(push); continue; }
    if (ni === 0) continue;
    const poly = [];
    for (let k = 0; k < 3; k++) {
      const a = V[k], b = V[(k + 1) % 3], fa = F[k], fb = F[(k + 1) % 3];
      if (fa <= 0) poly.push(a);
      if ((fa <= 0) !== (fb <= 0)) { const tt = fa / (fa - fb), m = mix(fa <= 0 ? a : b, fa <= 0 ? b : a, fa <= 0 ? tt : 1 - tt); poly.push(m); edge.push(m.position); }
    }
    for (let k = 1; k + 1 < poly.length; k++) { push(poly[0]); push(poly[k]); push(poly[k + 1]); }
  }
  for (const k of names) { const C = src[k].a.constructor; geo.setAttribute(k, new THREE.BufferAttribute(new C(out[k]), src[k].s)); }
  return edge;
}

function idxs3(arr, a, b, d, e) { arr.push(a, d, b, b, d, e); }
// هندسة غير مفهرسة من رؤوس/مؤشرات + أوزان (دالة لكل رأس تعيد [i0..i3, w0..w3]) + أنماط ناعمة نحو «الخارج»
function flatGeo(verts, uvs, idx, weightsFn, outwardFn) {
  const n = idx.length, P3 = new Float32Array(n * 3), U2 = new Float32Array(n * 2), SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  idx.forEach((vi, o) => {
    const p = verts[vi], w = weightsFn(p);
    P3.set(p, o * 3); U2.set(uvs[vi], o * 2); SI.set(w.slice(0, 4), o * 4); SW.set(w.slice(4, 8), o * 4);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P3, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U2, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  g.setAttribute('normal', new THREE.BufferAttribute(smoothNormals(P3, outwardFn), 3));
  return g;
}

// =====================================================================
//  ثوب العازف بين الساقين: الدشداشة ثوب واحد يتدلّى من الركبتين، لا بنطال. القماش المنفوخ حول كل ساق وحده يجعل
//  الساقين تبدوان كسروال منفصل حين يجلس العازف ويباعد ركبتيه، فنضيف لوحًا من القماش نفسه بين الساقين من أعلى الفخذ
//  إلى الذيل، حافتاه على الجهة الأمامية الداخلية لكل ساق وأوزانه ممزوجة بين الساقين، فيتمدد بين الركبتين ويتدلى بين الساقين.
// =====================================================================
function buildRobeDrape(ctx) {
  const { SS, mainSuit, displaced, chains, HEM, onChain, mkSkinned, mat, HT } = ctx;
  const L = chains.legL, R = chains.legR; if (!L || !R) return null;
  // نقاط القماش المنفوخ حول الساقين (من البنطال)
  const pts = []; const seen = new Set();
  for (const tr of mainSuit) for (const i of tr.idx) { if (tr.src !== SS) continue; const key = i; if (seen.has(key)) continue; seen.add(key); const p = displaced(SS, i); if (p[2] < 0.80) pts.push({ p, i }); }
  const front = [0, -1, 0];
  const NR = 30, NC = 10, s0 = 0.12, s1 = 2.0;       // يبدأ قرب أعلى الفخذ فيغطي الحِجر (لا يظهر شكل الحوض بين الفخذين)
  const at = (ch, s) => { const k = Math.min(ch.length - 2, Math.floor(s)), t = s - k, a = ch[k], b = ch[k + 1]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  const edge = (ch, other, s) => {
    const c = at(ch, s), o = at(other, s);
    let d = [o[0] - c[0], 0, o[2] - c[2]]; const l = Math.hypot(d[0], d[2]) || 1; d = [d[0] / l, 0, d[2] / l];
    const dir = [d[0] * 0.55 + front[0] * 0.83, d[1] * 0.55 + front[1] * 0.83, d[2] * 0.55 + front[2] * 0.83];
    // نصف قطر القماش في هذا الاتجاه: أبعد نقطة قريبة من المقطع
    let r = 0.04, best = null;
    for (const q of pts) { const dz = Math.abs(q.p[2] - c[2]); if (dz > 0.012) continue; const v = [q.p[0] - c[0], q.p[1] - c[1], 0]; const vl = Math.hypot(v[0], v[1]); if (!vl) continue; const cs = (v[0] * dir[0] + v[1] * dir[1]) / (vl * Math.hypot(dir[0], dir[1])); if (cs > 0.9 && vl < 0.11 && (!best || vl > best.vl)) best = { vl, q }; }
    if (best) r = best.vl;
    const dn = Math.hypot(dir[0], dir[1]);
    const p = [c[0] + dir[0] / dn * r * 0.84, c[1] + dir[1] / dn * r * 0.84, c[2]];
    let nb = best ? best.q : null;
    if (!nb) { let bd = 1e9; for (const q of pts) { const dd = (q.p[0] - p[0]) ** 2 + (q.p[1] - p[1]) ** 2 + (q.p[2] - p[2]) ** 2; if (dd < bd) { bd = dd; nb = q; } } }
    return { p, w: nb };
  };
  const V = [], U = [], SI = [], SW = [];
  const rows = [];
  for (let j = 0; j <= NR; j++) {
    const s = s0 + (s1 - s0) * j / NR, a = edge(L, R, s), b = edge(R, L, s);
    if (a.p[2] < HEM - 0.005 || b.p[2] < HEM - 0.005) break;
    rows.push([a, b]);
  }
  const wOf = (q) => { const o = []; for (let k = 0; k < 4; k++) { const w = SS.sw.array[q.i * 4 + k]; if (w > 0) o.push([SS.si.array[q.i * 4 + k], w]); } return o; };
  rows.forEach(([a, b], j) => {
    for (let c = 0; c <= NC; c++) {
      const u = c / NC, sag = Math.sin(Math.PI * u) * 0.006;           // انتفاخ خفيف للأمام في الوسط
      V.push([a.p[0] + (b.p[0] - a.p[0]) * u, a.p[1] + (b.p[1] - a.p[1]) * u - sag, a.p[2] + (b.p[2] - a.p[2]) * u]);
      U.push([0.5 + (u - 0.5) * 0.05, Math.min(1, V[V.length - 1][2] / HT)]);
      const m = new Map(); for (const [bi, w] of wOf(a.w)) m.set(bi, (m.get(bi) || 0) + w * (1 - u)); for (const [bi, w] of wOf(b.w)) m.set(bi, (m.get(bi) || 0) + w * u);
      const top = [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4), tot = top.reduce((x, y) => x + y[1], 0) || 1;
      SI.push([0, 1, 2, 3].map((k) => (top[k] ? top[k][0] : 0))); SW.push([0, 1, 2, 3].map((k) => (top[k] ? top[k][1] / tot : 0)));
    }
  });
  if (rows.length < 3) return null;
  const idx = []; for (let j = 0; j < rows.length - 1; j++) for (let c = 0; c < NC; c++) { const a = j * (NC + 1) + c, b = a + 1, d = a + NC + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
  const n = idx.length, P3 = new Float32Array(n * 3), U2 = new Float32Array(n * 2), S4 = new Uint16Array(n * 4), W4 = new Float32Array(n * 4);
  idx.forEach((vi, o) => { P3.set(V[vi], o * 3); U2.set(U[vi], o * 2); S4.set(SI[vi], o * 4); W4.set(SW[vi], o * 4); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P3, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U2, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(S4, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(W4, 4));
  g.setAttribute('normal', new THREE.BufferAttribute(smoothNormals(P3, () => [0, -1, 0]), 3));
  const m2 = mat.clone(); m2.side = THREE.DoubleSide;
  return mkSkinned(g, m2, 'Outfit_robe_drape');
}
