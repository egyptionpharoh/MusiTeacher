// =====================================================================
//  شخصية العازف (ذكر) من نموذج العازفة نفسه — بلا ملف نموذج ثانٍ.
//
//  لماذا هذا الطريق؟ نموذج العازفة مُصدَّر من MakeHuman بهيكل «Default». الفرق بين الذكر والأنثى في MakeHuman
//  ليس ملابس، بل أهداف تشكيل تشريحية (macro targets) على الشبكة الأساسية نفسها: عرض الكتفين والصدر، الحوض،
//  طول الأطراف وحجم اليدين، الفك والجبهة والأنف والحاجبين، ومواضع المفاصل. قمنا (خارج اللعبة) بمطابقة الشبكة
//  الأساسية لـMakeHuman (CC0) مع شبكة العازفة، ثم حسبنا الفرق بين الذكر والأنثى بالقيم نفسها (العِرق/العضلات/الوزن)،
//  وحفظناه في character-male-morph.json: إزاحة لكل رأس في كل شبكة، وإزاحة لكل مفصل في الهيكل.
//  هنا نطبّق الفرق على نسخة محمّلة من النموذج قبل تفصيل الزي وبناء الـRig، فيعمل كل منطق الوضعية والـIK
//  على عظام ذكر حقيقية (أطوال الذراعين والأصابع تُقاس من جديد تلقائيًا).
//  إحداثيات الهندسة (FBX من MakeHuman): z للأعلى، الوجه نحو −y، الأرض z≈0.
// =====================================================================
import * as THREE from 'three';

const decode = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Int16Array(u.buffer); };

const _cache = new Map();
export async function loadMorph(url) {
  if (!_cache.has(url)) _cache.set(url, fetch(url, { credentials: 'same-origin' }).then((r) => { if (!r.ok) throw new Error('morph ' + r.status); return r.json(); }));
  return _cache.get(url);
}

// أنماط ناعمة من مواضع غير مفهرسة (لحام بالموضع) — تُستعمل لنقل الفرق إلى الأنماط الأصلية بدل إعادة حسابها
function weldNormals(pos) {
  const n = pos.length / 3, map = new Map(), out = new Float32Array(pos.length);
  const key = (i) => `${Math.round(pos[i * 3] * 2e4)},${Math.round(pos[i * 3 + 1] * 2e4)},${Math.round(pos[i * 3 + 2] * 2e4)}`;
  const keys = new Array(n);
  for (let t = 0; t < n; t += 3) {
    const ax = pos[t * 3], ay = pos[t * 3 + 1], az = pos[t * 3 + 2];
    const ux = pos[t * 3 + 3] - ax, uy = pos[t * 3 + 4] - ay, uz = pos[t * 3 + 5] - az, vx = pos[t * 3 + 6] - ax, vy = pos[t * 3 + 7] - ay, vz = pos[t * 3 + 8] - az;
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    for (let k = 0; k < 3; k++) { const kk = keys[t + k] = key(t + k); let e = map.get(kk); if (!e) map.set(kk, e = [0, 0, 0]); e[0] += fx; e[1] += fy; e[2] += fz; }
  }
  for (let i = 0; i < n; i++) { const e = map.get(keys[i]), l = Math.hypot(e[0], e[1], e[2]) || 1; out[i * 3] = e[0] / l; out[i * 3 + 1] = e[1] / l; out[i * 3 + 2] = e[2] / l; }
  return out;
}

/** يحوّل نموذج العازفة المحمّل (قبل applyOutfit/applyMaterials/Rig) إلى عازف. يعيد تقريرًا قصيرًا. */
export function applyMaleMorph(root, morph) {
  root.updateMatrixWorld(true);
  const meshes = []; root.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  const body = meshes.find((m) => m.name === 'Human');
  if (!body) throw new Error('male-morph: no Human mesh');
  const S = morph.heightNorm || 1, U = morph.unit;
  const rep = { meshes: 0, bones: 0, skipped: [] };
  // 1) الشبكات: الموضع الجديد = (الأصل + الفرق) × S حول أصل الأرض، والأنماط تُصحَّح بفرق الأنماط الناعمة
  for (const m of meshes) {
    const d = morph.meshes[m.name]; const pa = m.geometry.attributes.position;
    if (!d) { rep.skipped.push(m.name); continue; }
    const dv = decode(d); if (dv.length !== pa.array.length) { rep.skipped.push(m.name + ':len'); continue; }
    const p0 = pa.array.slice(), p1 = pa.array;
    for (let i = 0; i < p1.length; i++) p1[i] = (p0[i] + dv[i] * U) * S;
    pa.needsUpdate = true;
    const na = m.geometry.attributes.normal;
    if (na) {
      const s0 = weldNormals(p0), s1 = weldNormals(p1), n = na.array;
      for (let i = 0; i < n.length; i += 3) {
        let x = n[i] + s1[i] - s0[i], y = n[i + 1] + s1[i + 1] - s0[i + 1], z = n[i + 2] + s1[i + 2] - s0[i + 2]; const l = Math.hypot(x, y, z) || 1;
        n[i] = x / l; n[i + 1] = y / l; n[i + 2] = z / l;
      }
      na.needsUpdate = true;
    }
    m.geometry.computeBoundingBox(); m.geometry.computeBoundingSphere();
    rep.meshes++;
  }
  // 2) العظام: موضع المفصل الجديد في فضاء الهندسة ثم في العالم (عبر bindMatrix للجسم)، من الأعلى إلى الأسفل
  const B = body.bindMatrix.clone(), Bi = B.clone().invert();
  const bones = []; root.traverse((o) => { if (o.isBone) bones.push(o); });
  const depth = (b) => { let k = 0; for (let p = b.parent; p; p = p.parent) k++; return k; };
  bones.sort((a, b) => depth(a) - depth(b));
  const before = new Map(bones.map((b) => [b, b.matrixWorld.clone()]));
  const target = new Map();
  for (const b of bones) {
    const w = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld), g = w.clone().applyMatrix4(Bi);
    const db = morph.bones[b.name] || [0, 0, 0];
    g.set((g.x + db[0]) * S, (g.y + db[1]) * S, (g.z + db[2]) * S);
    target.set(b, g.applyMatrix4(B));
  }
  for (const b of bones) {
    const t = target.get(b), inv = b.parent ? b.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
    b.position.copy(t.clone().applyMatrix4(inv));
    b.updateMatrix(); b.matrixWorld.multiplyMatrices(b.parent ? b.parent.matrixWorld : new THREE.Matrix4(), b.matrix);
    rep.bones++;
  }
  root.updateMatrixWorld(true);
  // 3) مصفوفات الربط: يبقى الشكل في وضع الراحة كما حسبناه، وتدور الأطراف حول المفاصل الجديدة
  for (const m of meshes) {
    const sk = m.skeleton;
    sk.boneInverses = sk.bones.map((b, i) => {
      const B0 = before.get(b) || b.matrixWorld;
      return b.matrixWorld.clone().invert().multiply(B0).multiply(sk.boneInverses[i]);
    });
  }
  // (إخفاء جلد الجذع والذراعين والرقبة تحت الثوب يتم في outfit.js بعد معرفة خط الطوق، لأن فتحة الدشداشة مائلة)
  // 4) جذع العازف وساقاه: شبكة ملابس العازفة الأصلية (قميص وبنطال نسائيان) تحمل شكل الصدر والحوض الأنثوي،
  //    والدشداشة تُفصَّل منها. لذلك نستبدلهما بغلافين مأخوذين من سطح جسم الذكر نفسه (الشبكة الأساسية لـMakeHuman
  //    بأهداف الذكر، وأوزان الهيكل الافتراضية لـMakeHuman)، مضبوطين على هيكل هذه الشخصية: صدر مستوٍ، حوض وأرداف ذكورية.
  if (morph.shells) {
    const suit = meshes.find((m) => /sportsuit/.test(m.name)) || body;
    const names = morph.boneNames || [], idxOf = new Map(suit.skeleton.bones.map((b, i) => [b.name, i]));
    for (const [nm, sd] of Object.entries(morph.shells)) {
      const pq = decode(sd.pos), si8 = Uint8Array.from(atob(sd.si), (c) => c.charCodeAt(0)), sw8 = Uint8Array.from(atob(sd.sw), (c) => c.charCodeAt(0));
      const pos = new Float32Array(sd.n * 3), si = new Uint16Array(sd.n * 4), sw = new Float32Array(sd.n * 4);
      for (let i = 0; i < pos.length; i++) pos[i] = pq[i] * sd.posUnit * S;
      for (let i = 0; i < si.length; i++) { si[i] = idxOf.get(names[si8[i]]) ?? 0; sw[i] = sw8[i] / 255; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(weldNormals(pos), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sd.n * 2), 2));
      g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      const m = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial({ color: 0xcccccc })); m.name = nm;
      m.position.copy(suit.position); m.quaternion.copy(suit.quaternion); m.scale.copy(suit.scale);
      suit.parent.add(m); m.updateMatrixWorld(true); m.bind(suit.skeleton, suit.bindMatrix.clone());
      rep.shells = (rep.shells || 0) + 1;
    }
    for (const m of meshes) if (/female_(casualsuit|sportsuit)/.test(m.name)) { m.parent.remove(m); m.geometry.dispose(); }
  }
  return rep;
}

// ---------- ملامح العازف: لحية مشذّبة وشارب، رموش أقصر ----------
// اللحية «قشرة» مستخرجة من مثلثات جلد الوجه نفسها (بأوزانها) مرفوعة 0.6 مم عن الجلد، بقناع ناعم الحواف وقوام شعيرات قصيرة،
// فتتحرك مع الفك والرأس ولا تحتاج إلى عظام إضافية. حدودها تُحسب من معالم الوجه الفعلية (الشفتان، الأنف، الأذنان).
function beardTexture(seed = 3, n = 9000, len0 = 16, len1 = 34, curl = 0.5) {
  // شعيرات حقيقية الطول (بضعة مم) متجهة للأسفل بانحناء خفيف وتفاوت في اللون؛ القناع وحده لا يصنع «شعرًا» بل لطخة
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); x.lineCap = 'round';
  let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const px = r() * 512, py = r() * 512, L = len0 + r() * (len1 - len0), a = Math.PI / 2 + (r() - 0.5) * 0.7, v = 120 + r() * 135, bend = (r() - 0.5) * curl;
    x.strokeStyle = `rgb(${v},${v},${v})`; x.lineWidth = 1.1 + r() * 1.3;
    x.beginPath(); x.moveTo(px, py);
    x.quadraticCurveTo(px + Math.cos(a + bend) * L * 0.5, py + Math.sin(a + bend) * L * 0.5, px + Math.cos(a + bend * 2) * L, py + Math.sin(a + bend * 2) * L);
    x.stroke();
    // التفاف عند حواف القماش (حتى يتكرر بلا درز)
    if (px > 512 - L || py > 512 - L) { x.save(); x.translate(px > 512 - L ? -512 : 0, py > 512 - L ? -512 : 0); x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + bend) * L * 0.5, py + Math.sin(a + bend) * L * 0.5, px + Math.cos(a + bend * 2) * L, py + Math.sin(a + bend * 2) * L); x.stroke(); x.restore(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function addMaleFace(root, opts = {}) {
  const body = root.getObjectByName('Human'); if (!body) return null;
  const g = body.geometry, pos = g.attributes.position, nor = g.attributes.normal, uvA = g.attributes.uv;
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const bones = body.skeleton.bones.map((b) => b.name);
  const isHead = (i) => { let best = 0, bi = 0; for (let k = 0; k < 4; k++) { const w = sw.array[i * 4 + k]; if (w > best) { best = w; bi = si.array[i * 4 + k]; } } return /^(head|jaw|neck0[23]|oris|levator|risorius|special0[1346]|temporalis|tongue)/.test(bones[bi] || ''); };
  // معالم: الشفتان (مجموعة مادة lips)، طرف الأنف، الأذنان
  const lipsMat = (Array.isArray(body.material) ? body.material : [body.material]).findIndex((m) => /lips/.test(m.name));
  let lip = { x0: 9, x1: -9, z0: 9, z1: -9, y: 0, n: 0 };
  for (const gr of g.groups) if (gr.materialIndex === lipsMat) for (let i = gr.start; i < gr.start + gr.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); lip.x0 = Math.min(lip.x0, x); lip.x1 = Math.max(lip.x1, x); lip.z0 = Math.min(lip.z0, z); lip.z1 = Math.max(lip.z1, z); lip.y += pos.getY(i); lip.n++;
  }
  if (!lip.n) return null;
  lip.y /= lip.n; const mouthZ = (lip.z0 + lip.z1) / 2, mouthW = (lip.x1 - lip.x0) / 2;
  let nose = { y: 9, z: 0 }, chinZ = 9, earX = 0;
  for (let i = 0; i < pos.count; i++) {
    if (!isHead(i)) continue;
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (Math.abs(x) < 0.006 && z > mouthZ && z < mouthZ + 0.07 && y < nose.y) nose = { y, z };
    if (Math.abs(x) < 0.02 && y < lip.y + 0.03 && z < chinZ) chinZ = z;
    earX = Math.max(earX, Math.abs(x));
  }
  const noseBase = mouthZ + (nose.z - mouthZ) * 0.42;           // أسفل الأنف (فوق الشفة العليا)
  // قناع اللحية: الذقن والفك حتى الأذنين، والشارب فوق الشفة، مع حدود ناعمة وفراغ حول الشفتين
  const mask = (x, y, z, nz) => {
    const ax = Math.abs(x);
    if (nz > 0.55) return 0;                                       // لا شيء على قمة الرأس
    const front = 1 - sstep(lip.y + 0.065, lip.y + 0.095, y);      // حتى ما قبل الأذن (لا تمتد خلفها)
    const cheekTop = noseBase - 0.004 + 0.032 * sstep(0.02, earX - 0.012, ax);       // خط الخد يرتفع نحو السالفين
    const top = 1 - sstep(cheekTop - 0.004, cheekTop + 0.0015, z);                // خط خد مرتّب (حلاقة نظيفة فوقه)
    const dens = 0.62 + 0.38 * (1 - sstep(cheekTop - 0.03, cheekTop - 0.012, z));   // أكثف عند الفك والذقن، أخف على الخد
    const under = sstep(chinZ - 0.028, chinZ - 0.012, z) * (1 - sstep(lip.y + 0.045, lip.y + 0.07, y) * sstep(chinZ - 0.02, chinZ - 0.035, z));   // تحت الفك حتى أعلى الرقبة
    // فراغ الشفتين: إهليلج حول الفم
    const ex = ax / (mouthW + 0.0045), ez = (z - mouthZ) / ((lip.z1 - lip.z0) / 2 + 0.0035);
    const lipsHole = sstep(0.95, 1.25, Math.hypot(ex, ez));
    // الشارب: فوق الشفة العليا فقط بعرض الفم، وصلة رفيعة نحو اللحية عند زاويتي الفم
    const moust = (1 - sstep(mouthW + 0.005, mouthW + 0.011, ax)) * sstep(lip.z1 - 0.0025, lip.z1 + 0.001, z) * (1 - sstep(noseBase + 0.0, noseBase + 0.004, z)) * (1 - sstep(lip.y + 0.014, lip.y + 0.032, y)) * (1 - 0.25 * (1 - sstep(0.0, 0.004, ax)));   // فرق خفيف في المنتصف (الأخدود)
    const sideBand = sstep(mouthW - 0.002, mouthW + 0.006, ax);    // على جانبي الفم وحتى الأذن
    const lower = 1 - sstep(lip.z0 - 0.002, lip.z0 + 0.004, z);    // تحت الشفة السفلى
    const base = Math.max(lower, sideBand) * top * under * front * lipsHole * dens;
    const lipsHoleM = sstep(0.9, 1.1, Math.hypot(ex * 0.95, (z - mouthZ) / ((lip.z1 - lip.z0) / 2 + 0.0012)));      // الشارب يلامس حافة الشفة العليا
    return Math.max(base, moust * lipsHoleM) * (opts.density ?? 1);
  };
  const P = [], N = [], UV = [], A = [], SI = [], SW = [];
  for (let t = 0; t < pos.count; t += 3) {
    if (!isHead(t) || !isHead(t + 1) || !isHead(t + 2)) continue;
    const ms = [0, 1, 2].map((k) => { const i = t + k; return mask(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getZ(i)); });
    if (Math.max(...ms) < 0.02) continue;
    for (let k = 0; k < 3; k++) {
      const i = t + k, off = 0.0006;
      P.push(pos.getX(i) + nor.getX(i) * off, pos.getY(i) + nor.getY(i) * off, pos.getZ(i) + nor.getZ(i) * off);
      N.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      UV.push(pos.getX(i) * 40 + pos.getY(i) * 20, pos.getZ(i) * 40); A.push(ms[k]);
      for (let q = 0; q < 4; q++) { SI.push(si.array[i * 4 + q]); SW.push(sw.array[i * 4 + q]); }
    }
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  bg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); bg.setAttribute('beardMask', new THREE.Float32BufferAttribute(A, 1));
  bg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); bg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  const beard = hairShell(bg, beardTexture(3, 9000, 16, 34, 0.5), opts.color || '#16100c', 'Male_beard', body);
  // شعر الرأس القصير: يظهر خلف الأذنين وفوقهما وعند القفا تحت المصر (كان الجلد أصلع تحت حافة المصر)
  const hair = addMaleHair(body, { lip, mouthZ, chinZ, isHead, color: opts.hairColor || '#120d0a' });
  return { beard, hair, tris: P.length / 9, lip, noseBase, chinZ, earX };
}


// مادة الشعر (لحية/رأس): لون داكن + قناع شعيرات؛ الكثافة = قناع المنطقة × (تغطية أساسية + شعيرات)، حتى يُقرأ كشعر قصير كثيف لا كظل
function hairShell(bg, tex, color, name, body, base = 0.42, gain = 0.75) {
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.85, metalness: 0, transparent: true, depthWrite: false, alphaMap: tex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float beardMask;\nvarying float vBeard;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBeard = beardMask;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBeard;')
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
float hm = smoothstep(0.0, 1.0, vBeard);
diffuseColor.a = clamp(hm * (${base.toFixed(3)} + ${gain.toFixed(3)} * diffuseColor.a), 0.0, 0.96);
diffuseColor.rgb *= 0.85 + 0.3 * diffuseColor.a;`);
  };
  mat.customProgramCacheKey = () => 'hairShell' + base + '_' + gain;
  const m = new THREE.SkinnedMesh(bg, mat); m.name = name;
  m.position.copy(body.position); m.quaternion.copy(body.quaternion); m.scale.copy(body.scale);
  body.parent.add(m); m.updateMatrixWorld(true); m.bind(body.skeleton, body.bindMatrix.clone());
  m.frustumCulled = false; m.renderOrder = 2;
  return m;
}

function addMaleHair(body, L) {
  const root = body.parent; let eyes = null; root.traverse((o) => { if (o.isMesh && /high-poly/.test(o.name)) eyes = o; });
  if (!eyes) return null;
  const g = body.geometry, pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const ep = eyes.geometry.attributes.position; let eyeZ = 0; for (let i = 0; i < ep.count; i++) eyeZ += ep.getZ(i); eyeZ /= ep.count;
  // الأذن: رؤوس الرأس البارزة جانبيًا قرب مستوى العين
  let earF = 9, earB = -9, earTop = -9, headHalf = 0;
  for (let i = 0; i < pos.count; i++) {
    if (!L.isHead(i)) continue; const x = Math.abs(pos.getX(i)), y = pos.getY(i), z = pos.getZ(i);
    if (Math.abs(z - eyeZ - 0.05) < 0.01) headHalf = Math.max(headHalf, x);
  }
  for (let i = 0; i < pos.count; i++) {
    if (!L.isHead(i)) continue; const x = Math.abs(pos.getX(i)), y = pos.getY(i), z = pos.getZ(i);
    if (x > headHalf + 0.004 && z > eyeZ - 0.06 && z < eyeZ + 0.03) { earF = Math.min(earF, y); earB = Math.max(earB, y); earTop = Math.max(earTop, z); }
  }
  if (earF > earB) return null;
  const mask = (x, y, z, nzz) => {
    const ax = Math.abs(x);
    if (y < earF - 0.018) return 0;                                         // لا شعر على الجبهة/الوجه
    const onEar = sstep(headHalf + 0.001, headHalf + 0.006, ax) * sstep(earF - 0.003, earF + 0.004, y) * (1 - sstep(earB - 0.004, earB + 0.003, y)) * (1 - sstep(earTop - 0.004, earTop + 0.002, z));
    const nape = sstep(eyeZ - 0.085, eyeZ - 0.072, z);                       // خط الشعر عند القفا
    const behind = sstep(earF - 0.004, earF + 0.004, y);                     // خلف مقدمة الأذن
    const aboveEar = sstep(earTop - 0.006, earTop + 0.002, z) * sstep(earF - 0.012, earF - 0.004, y);
    const side = behind * nape * sstep(earB - 0.02, earB + 0.005, y);         // خلف الأذن حتى القفا
    const burn = sstep(earF - 0.018, earF - 0.012, y) * (1 - sstep(earF + 0.002, earF + 0.008, y)) * sstep(eyeZ - 0.028, eyeZ - 0.016, z);  // السالف أمام الأذن
    return Math.max(side, aboveEar, burn) * (1 - onEar);
  };
  const P = [], N = [], UV = [], A = [], SI = [], SW = [];
  for (let t = 0; t < pos.count; t += 3) {
    if (!L.isHead(t) || !L.isHead(t + 1) || !L.isHead(t + 2)) continue;
    const ms = [0, 1, 2].map((k) => { const i = t + k; return mask(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getZ(i)); });
    if (Math.max(...ms) < 0.02) continue;
    for (let k = 0; k < 3; k++) {
      const i = t + k, off = 0.0009;
      P.push(pos.getX(i) + nor.getX(i) * off, pos.getY(i) + nor.getY(i) * off, pos.getZ(i) + nor.getZ(i) * off);
      N.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      UV.push(pos.getX(i) * 30 + pos.getY(i) * 30, pos.getZ(i) * 30); A.push(ms[k]);
      for (let q = 0; q < 4; q++) { SI.push(si.array[i * 4 + q]); SW.push(sw.array[i * 4 + q]); }
    }
  }
  if (!P.length) return null;
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  bg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); bg.setAttribute('beardMask', new THREE.Float32BufferAttribute(A, 1));
  bg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); bg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  return hairShell(bg, beardTexture(11, 12000, 10, 22, 0.3), L.color, 'Male_hair', body, 0.62, 0.45);
}
