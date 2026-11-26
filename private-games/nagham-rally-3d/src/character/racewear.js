// =====================================================================
//  ملابس وتجهيزات القيادة فوق الشخصية المشتركة (العازف/العازفة) — دون أي تعديل في الملفات المشتركة.
//
//  ١) بدلة القيادة: نُبقي هندسة الزي المحتشم كما فصّلها _shared/3d/character/outfit.js (فضفاضة ومعتمة وتغطي الجسم كله)،
//     ونستبدل قوامه بقوام بدلة سباق (لون أساسي، شريطان جانبيان، لوحة صدر بشعار MusiTeacher، أساور مطاطية).
//     عند العازف نُخفي ما لا يلائم البدلة: لوح القماش بين الساقين والمَصَرّ والفراخة وطوق الدشداشة.
//  ٢) القفازات: قشرة من جلد اليدين نفسه (بأوزان التشكيل نفسها) منفوخة قليلًا على اتجاه السطح، فتتحرك مع كل مفصل إصبع.
//  ٣) الخوذة: مجسم مستقل مثبّت بعظمة الرأس (يتبع حركة الرأس)، مقاسه من رؤوس شبكة الرأس الفعلية بعد التوحيد،
//     وفيها فتحة وجه واسعة وواقٍ مرفوع حتى يبقى الوجه ظاهرًا للطلاب. تحتها يبقى اللحاف (العازفة) بلون البدلة كغطاء رقبة.
//  ٤) الحزام (للسيارة فقط): يُبنى بعد وضعية الجلوس ويُثبَّت بعظمة الصدر.
// =====================================================================
import * as THREE from 'three';

const TAU = Math.PI * 2;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
function noise(x, w, h, a = 0.035) {
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 255 * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
}
// شعار نصي صغير (MusiTeacher) مرسوم بخط الواجهة
function badge(x, cx, cy, s, col, bg) {
  x.save(); x.translate(cx, cy);
  x.fillStyle = bg; x.beginPath(); x.roundRect(-s * 1.55, -s * 0.42, s * 3.1, s * 0.84, s * 0.2); x.fill();
  x.fillStyle = col; x.font = `800 ${s * 0.46}px Cairo, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('MusiTeacher', 0, s * 0.03);
  x.restore();
}

// ---------- قوام البدلة ----------
// الزي الرئيسي: u = الزاوية حول محور الجذع/الساق (0.5 = الأمام، 0.25/0.75 = الجانبان)، v = الارتفاع/1.2 م
function suitMainTex(S) {
  return canvasTex(1024, 1024, (x, w, h) => {
    x.fillStyle = S.base; x.fillRect(0, 0, w, h);
    noise(x, w, h, 0.03);
    const Y = (z) => (1 - z / 1.2) * h;
    // شريطان جانبيان على طول الجسم والساقين
    for (const u of [0.25, 0.75]) {
      x.fillStyle = S.stripe; x.fillRect(u * w - w * 0.022, 0, w * 0.044, h);
      x.fillStyle = S.accent; x.fillRect(u * w - w * 0.006, 0, w * 0.012, h);
    }
    // (ارتفاعات فضاء الهندسة: الصدر ≈ 0.93–1.06 م، الخصر ≈ 0.81، الركبة ≈ 0.45، الكاحل < 0.1)
    // لوحة صدر بشعار المنصة
    x.fillStyle = S.accent; x.beginPath(); x.roundRect(w * 0.405, Y(1.055), w * 0.19, Y(0.95) - Y(1.055), w * 0.02); x.fill();
    badge(x, w * 0.5, (Y(1.055) + Y(0.95)) / 2, w * 0.05, S.base, S.accent);
    // حزام الخصر
    x.fillStyle = S.glove; x.fillRect(0, Y(0.835), w, Y(0.80) - Y(0.835));
    x.fillStyle = S.stripe; x.fillRect(0, Y(0.822), w, Y(0.813) - Y(0.822));
    // رقعتا الركبة (حماية) وأسفل البنطال بلون داكن (يلتقي بالحذاء)
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, Y(0.51), w, Y(0.40) - Y(0.51));
    x.fillStyle = S.glove; x.fillRect(0, Y(0.11), w, h - Y(0.11));
  });
}
// الكمّان: u حول الذراع، v من الكتف (0) إلى المعصم (1)
function suitSleeveTex(S) {
  return canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = S.base; x.fillRect(0, 0, w, h); noise(x, w, h, 0.03);
    x.fillStyle = S.stripe; x.fillRect(w * 0.22, 0, w * 0.06, h);           // شريط على الجهة الخارجية
    x.fillStyle = S.accent; x.fillRect(w * 0.245, 0, w * 0.012, h);
    x.fillStyle = S.glove; x.fillRect(0, 0, w, h * 0.1);                    // طرف المعصم (أعلى القوام = المعصم)
  });
}
function suitMaterial(map, rough = 0.62) {
  return new THREE.MeshPhysicalMaterial({ map, roughness: rough, metalness: 0, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff), clearcoat: 0.08, clearcoatRoughness: 0.5 });
}

// ---------- القفازات: قشرة من جلد اليد ----------
function buildGloves(root, S) {
  let body = null; root.traverse((o) => { if (o.isSkinnedMesh && /^Human$/.test(o.name)) body = o; });
  if (!body) return null;
  const g = body.geometry, pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const names = body.skeleton.bones.map((b) => b.name);
  const isHand = (n) => /^(wrist|finger|metacarpal)/.test(n), isFore = (n) => /^lowerarm02/.test(n);
  const domName = (i) => { let bi = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.array[i * 4 + k]; if (w > bw) { bw = w; bi = si.array[i * 4 + k]; } } return names[bi] || ''; };
  const handW = (i) => { let s = 0; for (let k = 0; k < 4; k++) { const n = names[si.array[i * 4 + k]] || ''; if (isHand(n)) s += sw.array[i * 4 + k]; } return s; };
  const idx = g.index, nTri = (idx ? idx.count : pos.count) / 3;
  const P = [], N = [], SI = [], SW = [], UV = [];
  for (let t = 0; t < nTri; t++) {
    const ids = idx ? [idx.getX(t * 3), idx.getX(t * 3 + 1), idx.getX(t * 3 + 2)] : [t * 3, t * 3 + 1, t * 3 + 2];
    // يد كاملة، أو طرف الساعد الملاصق للرسغ (كُمّ القفاز)
    if (!ids.every((i) => isHand(domName(i)) || (isFore(domName(i)) && handW(i) > 0.02) || handW(i) > 0.35)) continue;
    for (const i of ids) {
      const nx = nor ? nor.getX(i) : 0, ny = nor ? nor.getY(i) : 0, nz = nor ? nor.getZ(i) : 0;
      const off = isHand(domName(i)) ? 0.0016 : 0.0034;
      P.push(pos.getX(i) + nx * off, pos.getY(i) + ny * off, pos.getZ(i) + nz * off);
      N.push(nx, ny, nz);
      for (let k = 0; k < 4; k++) { SI.push(si.array[i * 4 + k]); SW.push(sw.array[i * 4 + k]); }
      UV.push(0, 0);
    }
  }
  if (!P.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(S.glove), roughness: 0.48, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4, sheen: 0.3, sheenColor: new THREE.Color(0x8899aa) });
  const m = new THREE.SkinnedMesh(geo, mat);
  m.name = 'Race_gloves';
  m.position.copy(body.position); m.quaternion.copy(body.quaternion); m.scale.copy(body.scale);
  body.parent.add(m); m.updateMatrixWorld(true);
  m.bind(body.skeleton, body.bindMatrix.clone());
  m.castShadow = true; m.frustumCulled = false;
  return m;
}

/**
 * تطبيق تجهيزات القيادة (قبل بناء الـRig): يعيد { gloves, hidden }.
 * @param {THREE.Object3D} root  الشخصية بعد applyOutfit و applyMaterials
 * @param {'male'|'female'} gender
 */
export function applyRacewear(root, gender, S) {
  const hidden = [];
  const main = suitMaterial(suitMainTex(S)), sleeve = suitMaterial(suitSleeveTex(S));
  const cuff = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(S.glove), roughness: 0.55, sheen: 0.2 });
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === 'Outfit_dishdasha') o.material = main;
    else if (o.name === 'Outfit_sleeves') o.material = sleeve;
    else if (/^Outfit_cuff/.test(o.name)) o.material = cuff;
    else if (o.name === 'Outfit_lihaf') {                // غطاء الرأس يبقى (غطاء رقبة تحت الخوذة) بلون داكن متناسق مع البدلة
      o.material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(S.glove), roughness: 0.7, sheen: 0.4, sheenColor: new THREE.Color(0x667788) });
    } else if (/^Outfit_(robe_drape|masar|farukha|collar)$/.test(o.name)) { o.visible = false; hidden.push(o.name); }
    else if (/shoes/.test(o.name)) o.material = new THREE.MeshStandardMaterial({ color: new THREE.Color('#15181d'), roughness: 0.42, metalness: 0.1 });
  });
  const gloves = buildGloves(root, S);
  return { gloves, hidden };
}

// ---------- الخوذة ----------
/**
 * تُبنى بعد توحيد الشخصية (rig.normalize + captureRest): تُقاس من رؤوس الرأس في وضعية الراحة،
 * ثم تُضاف ابنةً لعظمة الرأس بتحويل محلي يحفظ موضعها العالمي.
 * style: 'car' (واقٍ شفاف مرفوع وفتحة وجه عريضة) | 'moto' (واقٍ مدخّن مرفوع وحاجب للذقن أبرز)
 */
export function buildHelmet(rig, S, style = 'car') {
  const head = rig.b('C', 'head'); if (!head) return null;
  const p = new THREE.Vector3(), box = new THREE.Box3();
  const neckB = rig.b('C', 'neck');
  const verts = rig.verts([head], 0.6);
  for (const e of verts) { rig.vertexWorld(e.m, e.i, p); box.expandByPoint(p); }
  if (box.isEmpty()) return null;
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const R = Math.max(sz.x, sz.z) * 0.5 + 0.016;                      // نصف قطر الخوذة: حجم الرأس + الحشوة
  const H = sz.y * 0.5 + 0.02;
  const grp = new THREE.Group(); grp.name = 'Race_helmet';
  const shellMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(S.helmet), roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 });
  const stripeMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(S.helmetStripe), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.65 });
  const visorMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(S.visor), roughness: 0.05, metalness: 0.2, transparent: true, opacity: style === 'moto' ? 0.55 : 0.35, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  // القشرة: كرة مقطوعة الأمام (فتحة الوجه) — المحور المحلي: +z الأمام، +y الأعلى
  // فتحة الوجه بين θ (زاوية من الأعلى) faceTop..faceBot وفي نطاق φ حول الأمام
  const faceHalf = style === 'moto' ? 0.62 : 0.78;               // نصف عرض الفتحة (راديان)
  const faceTop = 0.95, faceBot = style === 'moto' ? 1.95 : 2.15;
  const seg = 48, ring = 32;
  const P = [], I = [];
  const keep = (th, ph) => { const a = Math.atan2(Math.sin(ph), Math.cos(ph)); return !(Math.abs(a) < faceHalf && th > faceTop && th < faceBot); };
  const sx = R * 1.02, sy = H * 1.0, sz2 = R * 1.12;
  const thMax = style === 'moto' ? 2.25 : 2.3;
  for (let r = 0; r <= ring; r++) {
    const th = (r / ring) * thMax;
    for (let s = 0; s <= seg; s++) {
      const ph = (s / seg) * TAU;                  // ph = 0 → الأمام (+z)
      P.push(Math.sin(th) * Math.sin(ph) * sx, Math.cos(th) * sy, Math.sin(th) * Math.cos(ph) * sz2);
    }
  }
  for (let r = 0; r < ring; r++) for (let s = 0; s < seg; s++) {
    const a = r * (seg + 1) + s, b = a + 1, d = a + seg + 1, e = d + 1;
    const th = ((r + 0.5) / ring) * thMax, ph = ((s + 0.5) / seg) * TAU;
    if (!keep(th, ph)) continue;
    I.push(a, d, b, b, d, e);
  }
  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); shellGeo.setIndex(I); shellGeo.computeVertexNormals();
  const shell = new THREE.Mesh(shellGeo, shellMat); grp.add(shell);
  // بطانة داخلية داكنة (تُرى من فتحة الوجه)
  const liner = new THREE.Mesh(shellGeo, new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.9, side: THREE.BackSide })); liner.scale.setScalar(0.985); grp.add(liner);
  // شريط طولي فوق الخوذة
  const stripe = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 16, -0.13, 0.26, 0.05, 2.0), stripeMat);
  stripe.scale.set(sx * 1.012, sy * 1.012, sz2 * 1.012); stripe.rotation.y = 0; grp.add(stripe);
  // حافة فتحة الوجه (إطار مطاطي)
  const rimPts = [];
  for (let k = 0; k <= 64; k++) {
    const t = k / 64; let th, ph;
    if (t < 0.25) { th = faceTop; ph = -faceHalf + (t / 0.25) * 2 * faceHalf; }
    else if (t < 0.5) { th = faceTop + ((t - 0.25) / 0.25) * (faceBot - faceTop); ph = faceHalf; }
    else if (t < 0.75) { th = faceBot; ph = faceHalf - ((t - 0.5) / 0.25) * 2 * faceHalf; }
    else { th = faceBot - ((t - 0.75) / 0.25) * (faceBot - faceTop); ph = -faceHalf; }
    rimPts.push(new THREE.Vector3(Math.sin(th) * Math.sin(ph) * sx, Math.cos(th) * sy, Math.sin(th) * Math.cos(ph) * sz2));
  }
  const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 96, 0.0065, 8, true), darkMat); grp.add(rim);
  // الواقي المرفوع فوق الجبهة
  const visor = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 12, -faceHalf - 0.12, 2 * faceHalf + 0.24, 0.42, 0.62), visorMat);
  visor.scale.set(sx * 1.05, sy * 1.05, sz2 * 1.06); grp.add(visor);
  // حاجب الذقن للموتوسيكل + فتحات تهوية
  if (style === 'moto') {
    const chin = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 8, -faceHalf - 0.05, 2 * faceHalf + 0.1, faceBot - 0.05, 0.38), shellMat);
    chin.scale.set(sx * 1.01, sy, sz2 * 1.02); grp.add(chin);
    for (const sgn of [-1, 1]) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.03), darkMat); v.position.set(sgn * 0.03, sy * 0.92, sz2 * 0.35); v.rotation.x = -0.5; grp.add(v); }
  }
  // شعار صغير على الجانبين
  const logoTex = canvasTex(256, 64, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = S.helmetStripe; x.font = '800 34px Cairo, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('MusiTeacher', w / 2, h / 2 + 2); });
  logoTex.wrapS = THREE.ClampToEdgeWrapping;
  for (const sgn of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.028), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, depthWrite: false }));
    l.position.set(sgn * sx * 1.0, sy * 0.05, -sz2 * 0.12); l.rotation.y = sgn * Math.PI / 2; grp.add(l);
  }
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  // الموضع العالمي: مركز الرأس مرفوعًا قليلًا (الخوذة تغطي قمة الرأس) وموجّهة للأمام (+Z في وضعية الراحة)
  const world = new THREE.Matrix4().compose(new THREE.Vector3(c.x, c.y + 0.01, c.z - 0.006), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
  head.updateWorldMatrix(true, false);
  const local = head.matrixWorld.clone().invert().multiply(world);
  local.decompose(grp.position, grp.quaternion, grp.scale);
  head.add(grp);
  grp.userData = { R, H, center: c.clone() };
  return grp;
}

// ---------- حزام الأمان (السيارة) ----------
/**
 * يُبنى بعد وضعية الجلوس: أربعة أشرطة (كتفان وحجر) تُسقط نقاطها على السطح الأمامي الفعلي لبدلة السائق
 * (رؤوس الزي المشكَّلة) فتلتصق بالصدر دون أن تخترقه، ثم تُثبَّت بعظمة الصدر.
 */
export function buildBelt(rig, color = '#d23b3b') {
  const chest = rig.b('C', 'upperChest') || rig.b('C', 'chest'); if (!chest) return null;
  const W = (s, k) => rig.wp(s, k);
  const shL = W('L', 'upperArm'), shR = W('R', 'upperArm'), hips = W('C', 'hips'), hipL = W('L', 'upperLeg'), hipR = W('R', 'upperLeg'), neck = W('C', 'neck');
  // سطح البدلة: لكل (x,y) أعلى قيمة z (الأمام)
  const pts = [], p = new THREE.Vector3();
  for (const m of rig.meshes) {
    if (!/^Outfit_(dishdasha|sleeves|lihaf)$/.test(m.name) || !m.visible) continue;
    const n = m.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 2) { rig.vertexWorld(m, i, p); pts.push(p.x, p.y, p.z); }
  }
  const surfZ = (x, y, r = 0.03) => { let best = -Infinity; for (let k = 0; k < pts.length; k += 3) if (Math.abs(pts[k] - x) < r && Math.abs(pts[k + 1] - y) < r) best = Math.max(best, pts[k + 2]); return best; };
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.6, side: THREE.DoubleSide });
  const buckleMat = new THREE.MeshStandardMaterial({ color: 0xcfd6de, roughness: 0.25, metalness: 0.9 });
  const grp = new THREE.Group(); grp.name = 'Race_belt';
  // شريط مرن عبر نقاط مسقطة
  const ribbon = (a, b, w = 0.048, N = 14) => {
    const P = [], I = [];
    for (let k = 0; k <= N; k++) {
      const q = a.clone().lerp(b, k / N);
      const z = surfZ(q.x, q.y); if (isFinite(z)) q.z = Math.max(q.z, z + 0.008);
      P.push(q);
    }
    const V = [];
    for (let k = 0; k <= N; k++) {
      const t = (P[Math.min(N, k + 1)].clone().sub(P[Math.max(0, k - 1)])).normalize();
      const side = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 0, 1)).normalize().multiplyScalar(w / 2);
      V.push(...P[k].clone().add(side).toArray(), ...P[k].clone().sub(side).toArray());
      if (k < N) I.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); g.setIndex(I); g.computeVertexNormals();
    grp.add(new THREE.Mesh(g, mat));
    return P;
  };
  const buckle = hips.clone().lerp(neck, 0.22);
  for (const sh of [shL, shR]) {
    const top = sh.clone().lerp(neck, 0.5); top.y += 0.03;
    ribbon(top, buckle);
  }
  const lapL = hipL.clone().lerp(buckle, 0.15); lapL.x += 0.07; const lapR = hipR.clone().lerp(buckle, 0.15); lapR.x -= 0.07;
  ribbon(lapL, buckle, 0.055); ribbon(buckle, lapR, 0.055);
  const bz = surfZ(buckle.x, buckle.y, 0.04); if (isFinite(bz)) buckle.z = bz + 0.012;
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 24), buckleMat); b.rotation.x = Math.PI / 2; b.position.copy(buckle); grp.add(b);
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  chest.updateWorldMatrix(true, false);
  const inv = chest.matrixWorld.clone().invert();
  const holder = new THREE.Group(); holder.name = 'Race_belt_holder';
  inv.decompose(holder.position, holder.quaternion, holder.scale);
  holder.add(grp); chest.add(holder);
  return holder;
}

// ---------- ذيل سترة الركوب (للموتوسيكل) ----------
/**
 * عند الميل للأمام على الدراجة تشدّ البدلة على الحوض. نضيف لوحًا من قماش البدلة نفسه خلف الحوض والفخذين
 * (كذيل سترة ركوب طويلة) يُبنى من سطح البدلة الفعلي في وضعية الجلوس: لكل عمود/صف أبعد نقطة خلفًا + سماكة،
 * فيغطي الشكل ولا يخترقه القماش، ثم يُثبَّت بعظمة الحوض فيتحرك معها.
 */
export function buildTail(rig, S, opt = {}) {
  const hipsB = rig.b('C', 'hips'); if (!hipsB) return null;
  const pts = [], p = new THREE.Vector3();
  for (const m of rig.meshes) {
    if (m.name !== 'Outfit_dishdasha' || !m.visible) continue;
    const n = m.geometry.attributes.position.count;
    for (let i = 0; i < n; i++) { rig.vertexWorld(m, i, p); pts.push(p.x, p.y, p.z); }
  }
  const hipL = rig.wp('L', 'upperLeg'), hipR = rig.wp('R', 'upperLeg'), spine = rig.wp('C', 'spine');
  const yTop = Math.max(spine.y, hipL.y) + 0.10, yBot = opt.seatY != null ? opt.seatY + 0.02 : hipL.y - 0.14;
  const zMax = (hipL.z + hipR.z) / 2 + 0.04;                     // ما خلف مفصل الورك فقط
  const NX = 14, NY = 10, half = Math.abs(hipL.x - hipR.x) / 2 + 0.13;
  const grid = [];
  for (let j = 0; j <= NY; j++) {
    const y = yTop + (yBot - yTop) * j / NY, row = [];
    for (let i = 0; i <= NX; i++) {
      const x = -half + 2 * half * i / NX;
      let zmin = Infinity;
      for (let k = 0; k < pts.length; k += 3) if (Math.abs(pts[k] - x) < 0.035 && Math.abs(pts[k + 1] - y) < 0.035 && pts[k + 2] < zMax) zmin = Math.min(zmin, pts[k + 2]);
      row.push(isFinite(zmin) ? zmin : null);
    }
    grid.push(row);
  }
  // سدّ الثغرات وتنعيم: كل خلية بلا قيمة تأخذ متوسط جيرانها، ثم لا ينحني اللوح أعمق من الجوار (قماش مشدود لا يتبع الشق)
  for (let it = 0; it < 6; it++) for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) if (grid[j][i] == null) {
    const nb = [[j, i - 1], [j, i + 1], [j - 1, i], [j + 1, i]].map(([a, b]) => (grid[a] || [])[b]).filter((v) => v != null);
    if (nb.length) grid[j][i] = nb.reduce((a, b) => a + b, 0) / nb.length;
  }
  for (let it = 0; it < 3; it++) for (let j = 0; j <= NY; j++) { const r = grid[j]; for (let i = 1; i < NX; i++) if (r[i] != null && r[i - 1] != null && r[i + 1] != null) r[i] = Math.min(r[i], (r[i - 1] + r[i + 1]) / 2); }
  const P = [], UV = [], I = [];
  const zc = (hipL.z + hipR.z) / 2;
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const x = -half + 2 * half * i / NX, y = yTop + (yBot - yTop) * j / NY;
    let z = (grid[j][i] ?? zc - 0.12) - 0.022;
    // الطرفان ينثنيان نحو الأمام قليلًا (يلتفّ القماش حول الجانبين)
    const e = Math.abs(i / NX - 0.5) * 2; z += Math.pow(e, 3) * 0.05;
    P.push(x, y, z); UV.push(i / NX, j / NY);
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
  const tex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = S.base; x.fillRect(0, 0, w, h); noise(x, w, h, 0.03); x.fillStyle = S.stripe; x.fillRect(w * 0.47, 0, w * 0.06, h); x.fillStyle = S.glove; x.fillRect(0, h * 0.9, w, h * 0.1); });
  const mesh = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.62, sheen: 0.25, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide }));
  mesh.name = 'Race_tail'; mesh.castShadow = true;
  hipsB.updateWorldMatrix(true, false);
  const holder = new THREE.Group(); holder.name = 'Race_tail_holder';
  hipsB.matrixWorld.clone().invert().decompose(holder.position, holder.quaternion, holder.scale);
  holder.add(mesh); hipsB.add(holder);
  return holder;
}
