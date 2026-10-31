// =====================================================================
//  نظام الهيكل العظمي (Rig) العام للعازفة:
//  - التعرّف على العظام بأسمائها الشائعة (Mixamo، VRM، Character Creator، Unreal، Rigify)
//  - توحيد الحجم والاتجاه (الوجه نحو +Z، يسار العازفة +X، الوحدة: متر)
//  - حفظ وضعية الراحة لكل عظمة، وأدوات توجيه العظام في الفضاء العالمي
//  - تشكيل الرؤوس (Skinning) على المعالج لقياس سطح الجلد/الملابس الحقيقي
// =====================================================================
import * as THREE from 'three';

const SIDE_TOKENS = { l: 'L', left: 'L', r: 'R', right: 'R' };
const FINGER_NAMES = { thumb: 'thumb', index: 'index', middle: 'middle', mid: 'middle', ring: 'ring', pinky: 'little', little: 'little', pinkie: 'little' };
const SEG_WORDS = { proximal: 1, intermediate: 2, distal: 3, end: 4, tip: 4, metacarpal: 0 };

const BODY_PATTERNS = [
  ['hips', /^(hips|pelvis|hip|roothips)$/],
  ['spine', /^(spine|spine0|spine00|spine01|abdomen|waist|spinelower)$/],
  ['chest', /^(spine1|spine02|chest|spinemiddle)$/],
  ['upperChest', /^(spine2|spine03|upperchest|chest1|spineupper)$/],
  ['neck', /^(neck|neck1|neck01|necktwist01)$/],
  ['head', /^head$/],
  ['headTop', /^(headtopend|headend|headtop)$/],
  ['shoulder', /^(shoulder|clavicle|collar|clavicula)$/],
  ['upperArm', /^(arm|upperarm|uparm)$/],
  ['lowerArm', /^(forearm|lowerarm|elbow)$/],
  ['hand', /^(hand|wrist)$/],
  ['upperLeg', /^(upleg|upperleg|thigh)$/],
  ['lowerLeg', /^(leg|lowerleg|calf|shin|knee)$/],
  ['foot', /^(foot|ankle)$/],
  ['toes', /^(toebase|toes|toe|ball)$/],
];

// يحلل اسم العظمة إلى {key, side}
function parseBoneName(raw) {
  let n = raw.toLowerCase();
  n = n.replace(/^.*[:|]/, '');                                  // mixamorig:Head → head
  n = n.replace(/^mixamorig\d*[_]?/, '');                        // GLTFLoader يحذف ":" فيصبح mixamorigLeftHand
  n = n.replace(/^(cc_base|j_bip|def|org|bip0?1|b)[_\-. ]+/, '');
  const toks = n.split(/[_\-. ]+/).filter(Boolean);
  let side = null;
  const rest = [];
  for (const t of toks) {
    if (SIDE_TOKENS[t]) { side = SIDE_TOKENS[t]; continue; }
    let m = t.match(/^(left|right)(.*)$/);
    if (m) { side = SIDE_TOKENS[m[1]]; if (m[2]) rest.push(m[2]); continue; }
    m = t.match(/^(.*?)(left|right)$/);
    if (m && m[1]) { side = SIDE_TOKENS[m[2]]; rest.push(m[1]); continue; }
    rest.push(t);
  }
  const core = rest.join('');
  // الأصابع: handindex1 / index01 / indexproximal / thumbmetacarpal ...
  const fm = core.match(/^(hand)?(thumb|index|middle|mid|ring|pinky|little|pinkie)(finger)?(0?[0-4]|proximal|intermediate|distal|metacarpal|end|tip)$/);
  if (fm && side) {
    const f = FINGER_NAMES[fm[2]];
    let s = fm[4];
    s = SEG_WORDS[s] != null ? SEG_WORDS[s] : parseInt(s, 10);
    return { key: `${f}${s}`, side, finger: f, seg: s };
  }
  for (const [key, re] of BODY_PATTERNS) if (re.test(core)) return { key, side };
  // "upperarm.L" بعد التنقية يصبح "upperarml": جرّب اعتبار الحرف الأخير جهة
  if (!side && /[lr]$/.test(core) && core.length > 2) {
    const r = parseBoneName(raw.replace(/[lLrR]$/, '') + (/[lL]$/.test(raw) ? '_l' : '_r'));
    if (r && r.side) return r;
  }
  return null;
}

export class Rig {
  constructor(root, config = {}) {
    this.root = root;                   // gltf.scene
    this.config = config;
    this.bones = { L: {}, R: {}, C: {} };
    this.meshes = [];
    root.traverse((o) => {
      if (o.isSkinnedMesh) this.meshes.push(o);
    });
    if (!this.meshes.length) throw new Error('لا يحتوي النموذج على SkinnedMesh (نموذج غير مُجهّز بهيكل عظمي).');
    // بعض ملفات FBX (مثل تصدير MakeHuman) تعطي كل شبكة نسخة مستقلة من العظام بنفس الأسماء، وأحيانًا
    // تكون النسخ متداخلة (عظمة داخل عظمة بالاسم نفسه). نوحّد كل الشبكات على النسخة العليا من كل عظمة
    // حتى يتحرك الجسم والملابس والعينان معًا بهيكل واحد.
    const top = (b) => { while (b.parent && b.parent.isBone && b.parent.name === b.name) b = b.parent; return b; };
    for (const m of this.meshes) {
      const bones = m.skeleton.bones.map(top);
      if (bones.some((b, i) => b !== m.skeleton.bones[i])) m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), m.bindMatrix);
    }
    const byName = new Map();
    for (const m of this.meshes) for (const b of m.skeleton.bones) if (!byName.has(b.name)) byName.set(b.name, b);
    for (const m of this.meshes) {
      const bones = m.skeleton.bones.map((b) => byName.get(b.name));
      if (bones.some((b, i) => b !== m.skeleton.bones[i])) m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), m.bindMatrix);
    }
    const allBones = new Set();
    this.meshes.forEach((m) => m.skeleton.bones.forEach((b) => allBones.add(b)));
    this.allBones = [...allBones];
    for (const b of this.allBones) {
      const p = parseBoneName(b.name);
      if (!p) continue;
      const bucket = p.side ? this.bones[p.side] : this.bones.C;
      if (!bucket[p.key]) bucket[p.key] = b;
    }
    // إعادة تسمية يدوية من ملف الإعدادات: { "L.hand": "MyLeftWrist", ... }
    const over = config.boneMap || {};
    for (const k in over) {
      const [side, key] = k.includes('.') ? k.split('.') : ['C', k];
      const b = this.allBones.find((x) => x.name === over[k]);
      if (b) this.bones[side][key] = b;
    }
    this.fixFingerNumbering();
    this.missing = this.checkRequired();
  }

  // بعض الهياكل تبدأ الإبهام من 0 (metacarpal) أو الأصابع من 0 — نوحّدها إلى 1..3 + طرف 4
  fixFingerNumbering() {
    for (const s of ['L', 'R']) {
      const B = this.bones[s];
      for (const f of ['index', 'middle', 'ring', 'little']) delete B[`${f}0`];
      if (B.thumb0) {
        const segs = [0, 1, 2, 3, 4].filter((i) => B[`thumb${i}`]).map((i) => B[`thumb${i}`]);
        for (let i = 0; i <= 4; i++) delete B[`thumb${i}`];
        segs.forEach((bone, i) => { B[`thumb${i + 1}`] = bone; });
      }
    }
  }

  checkRequired() {
    const need = [];
    for (const k of ['hips', 'spine', 'neck', 'head']) if (!this.bones.C[k]) need.push(k);
    for (const s of ['L', 'R']) {
      for (const k of ['upperArm', 'lowerArm', 'hand', 'upperLeg', 'lowerLeg', 'foot']) if (!this.bones[s][k]) need.push(`${s}.${k}`);
      for (const f of ['thumb', 'index', 'middle', 'ring', 'little']) for (let i = 1; i <= 3; i++) if (!this.bones[s][`${f}${i}`]) need.push(`${s}.${f}${i}`);
    }
    return need;
  }

  b(side, key) { return side === 'C' ? this.bones.C[key] : this.bones[side][key]; }

  // ---------- وضعية الربط، التوحيد، الحجم ----------
  normalize(targetHeight) {
    const root = this.root;
    root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.set(1, 1, 1);
    // وضعية الراحة = تحويلات العُقد كما حُمّلت من ملف glTF (وضعية T أو A عند التصدير).
    // لا نستخدم skeleton.pose() لأنها تخطئ حين يكون للهيكل أب بمقياس/دوران (مثل Armature بمقياس 0.01).
    root.updateMatrixWorld(true);
    // الاتجاه: يسار العازفة = upperLeg.L - upperLeg.R ، الأمام = يسار × أعلى
    const pL = this.wp('L', 'upperLeg'), pR = this.wp('R', 'upperLeg');
    const left = pL.clone().sub(pR); left.y = 0; left.normalize();
    const fwd = new THREE.Vector3().crossVectors(left, new THREE.Vector3(0, 1, 0)).normalize();
    const yaw = Math.atan2(fwd.x, fwd.z);
    root.rotation.set(0, -yaw, 0);
    root.updateMatrixWorld(true);
    // الطول: من أخفض نقطة في الشبكة إلى أعلى نقطة (قمة الرأس/غطاء الرأس)
    const box = this.skinnedBox();
    const h = box.max.y - box.min.y;
    let s = 1;
    if (this.config.autoScale !== false && targetHeight && (h < 0.9 * targetHeight || h > 1.1 * targetHeight)) s = targetHeight / h;
    root.scale.setScalar(s);
    root.updateMatrixWorld(true);
    const box2 = this.skinnedBox();
    root.position.y -= box2.min.y;
    root.updateMatrixWorld(true);
    this.height = box2.max.y - box2.min.y;
    this.scale = s;
  }

  wp(side, key, target = new THREE.Vector3()) {
    const b = this.b(side, key);
    return b ? b.getWorldPosition(target) : null;
  }

  skinnedBox(step = 7) {
    const box = new THREE.Box3(), v = new THREE.Vector3();
    for (const m of this.meshes) {
      const n = m.geometry.attributes.position.count;
      for (let i = 0; i < n; i += step) { this.vertexWorld(m, i, v); box.expandByPoint(v); }
    }
    return box;
  }

  vertexWorld(mesh, i, target) {
    mesh.getVertexPosition(i, target);           // يتضمّن تحويل العظام (Skinning)
    return target.applyMatrix4(mesh.matrixWorld);
  }

  // قائمة رؤوس كل عظمة مهيمنة: Map(bone → [{m, i}])
  buildDominance() {
    const dom = new Map(), w = new THREE.Vector4(), ix = new THREE.Vector4();
    for (const m of this.meshes) {
      const g = m.geometry, sw = g.attributes.skinWeight, si = g.attributes.skinIndex;
      for (let i = 0; i < sw.count; i++) {
        w.fromBufferAttribute(sw, i); ix.fromBufferAttribute(si, i);
        let best = 0, bi = 0;
        for (let k = 0; k < 4; k++) { const wk = w.getComponent(k); if (wk > best) { best = wk; bi = ix.getComponent(k); } }
        const bone = m.skeleton.bones[bi];
        let list = dom.get(bone); if (!list) { list = []; dom.set(bone, list); }
        list.push({ m, i, w: best });
      }
    }
    this.dom = dom;
    return dom;
  }
  verts(bones, minW = 0) {
    const out = [];
    for (const b of bones) { if (!b) continue; const l = this.dom.get(b); if (l) for (const e of l) if (e.w >= minW) out.push(e); }
    return out;
  }

  // ---------- حفظ وضعية الراحة ----------
  captureRest() {
    this.root.updateMatrixWorld(true);
    this.rest = new Map();
    for (const b of this.allBones) {
      this.rest.set(b, { q: b.quaternion.clone(), p: b.position.clone(), wq: b.getWorldQuaternion(new THREE.Quaternion()), wp: b.getWorldPosition(new THREE.Vector3()) });
    }
  }
  resetToRest() {
    for (const [b, r] of this.rest) { b.quaternion.copy(r.q); b.position.copy(r.p); }
    this.root.updateMatrixWorld(true);
  }

  // تعيين اتجاه العظمة عالميًا: المحور المحلي aLocal يتجه إلى dirW، والمحور sLocal يقترب من secW
  // aLocal وsLocal محسوبان من وضعية الراحة (setAimAxes)
  setAimAxes(bone, restDirW, restSecW) {
    const r = this.rest.get(bone), inv = r.wq.clone().invert();
    r.aL = restDirW.clone().normalize().applyQuaternion(inv);
    r.sL = restSecW.clone().normalize().applyQuaternion(inv);
  }
  aim(bone, dirW, secW) {
    const r = this.rest.get(bone);
    const Q = basisRotation(r.aL, r.sL, dirW, secW);
    this.setWorldQuaternion(bone, Q);
  }
  setWorldQuaternion(bone, qW) {
    const pq = new THREE.Quaternion();
    if (bone.parent) bone.parent.getWorldQuaternion(pq);
    bone.quaternion.copy(pq.invert().multiply(qW));
    bone.updateWorldMatrix(false, true);
  }
  worldQ(bone) { return bone.getWorldQuaternion(new THREE.Quaternion()); }
}

// دوران يحوّل الأساس (a, s) إلى (A, S) — s وS تلميحات تُعامد على المحور الأول
export function basisRotation(a, s, A, S) {
  const m1 = basisMatrix(a, s), m2 = basisMatrix(A, S);
  const R = m2.multiply(m1.transpose());
  return new THREE.Quaternion().setFromRotationMatrix(R);
}
function basisMatrix(a, s) {
  const e1 = a.clone().normalize();
  const e2 = s.clone().addScaledVector(e1, -s.dot(e1));
  if (e2.lengthSq() < 1e-10) {
    const t = Math.abs(e1.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    e2.copy(t).addScaledVector(e1, -t.dot(e1));
  }
  e2.normalize();
  const e3 = new THREE.Vector3().crossVectors(e1, e2);
  return new THREE.Matrix4().makeBasis(e1, e2, e3);
}

export { parseBoneName };
