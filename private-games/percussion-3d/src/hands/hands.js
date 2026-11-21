// =====================================================================
//  اليدان البشريتان ثلاثيتا الأبعاد للعزف على الآلات الإيقاعية.
//  لا يدَ مرسومة ولا أيقونة: نعيد استخدام نموذج العازفة المشترك بين ألعاب MusiTeacher
//  (_shared/3d/models/character-girl.fbx) بهيكله العظمي الحقيقي (سُلاميات ومفاصل الأصابع)
//  وزيّه المحتشم (الكمّ الطويل حتى المعصم) ومواد الجلد نفسها، ثم:
//   1) نقصّ الشبكات فلا يبقى إلا الساعد والكف والأصابع لكل يد (بقية الجسم لا تُرسم أبدًا).
//   2) نحرّك عظمة الساعد بحرّية في الفضاء (كأن الذراع تأتي من خارج الشاشة)، ثم المعصم، ثم كل سُلامية.
//  الحركة نفسها (اقتراب، ملامسة، ارتداد) تُحسب في hand-motion.js من جدول الضربات على ساعة الصوت.
// =====================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { applyOutfit } from '../../_shared/3d/character/outfit.js';
import { applyMaterials } from '../../_shared/3d/character/materials.js';
import { Rig } from '../../_shared/3d/character/rig.js';
import { handFrameNow } from '../../_shared/3d/character/hand.js';

// هيكل MakeHuman «Default» (كما في إعدادات ألعاب العازفة الأخرى)
const BONE_MAP = {
  hips: 'root', spine: 'spine05', chest: 'spine03', upperChest: 'spine01', neck: 'neck01', head: 'head',
  'L.shoulder': 'clavicleL', 'L.upperArm': 'upperarm01L', 'L.lowerArm': 'lowerarm01L', 'L.hand': 'wristL',
  'R.shoulder': 'clavicleR', 'R.upperArm': 'upperarm01R', 'R.lowerArm': 'lowerarm01R', 'R.hand': 'wristR',
  'L.upperLeg': 'upperleg01L', 'L.lowerLeg': 'lowerleg01L', 'L.foot': 'footL', 'L.toes': 'toe1-1L',
  'R.upperLeg': 'upperleg01R', 'R.lowerLeg': 'lowerleg01R', 'R.foot': 'footR', 'R.toes': 'toe1-1R',
};
for (const s of ['L', 'R']) ['thumb', 'index', 'middle', 'ring', 'little'].forEach((f, k) => { for (let j = 1; j <= 3; j++) BONE_MAP[`${s}.${f}${j}`] = `finger${k + 1}-${j}${s}`; });

export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'little'];
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();

/** إطار (أصل + محاور) → مصفوفة */
export const frameMatrix = (o, x, y, z) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(o);

export class Hands {
  /** يحمّل النموذج ويجهّز اليدين. modelUrl نسبةً إلى index.html */
  static async load(modelUrl = './_shared/3d/models/character-girl.fbx', onProgress) {
    const mgr = new THREE.LoadingManager(); mgr.setURLModifier((u) => (/\.(png|jpe?g|tga|bmp|gif|tif)(\?|$)/i.test(u) ? PX : u));
    const root = await new FBXLoader(mgr).loadAsync(modelUrl, onProgress);
    const strays = []; root.traverse((o) => { if (o.isLight || o.isCamera) strays.push(o); }); strays.forEach((o) => o.parent && o.parent.remove(o));
    const cfg = { boneMap: BONE_MAP, height: 1.6, autoScale: true, gender: 'female',
      outfit: { enabled: true, dishdasha: '#7a1f2e', embroidery: '#d8b25a', embroidery2: '#2f6b5a', sirwal: '#1f4a44', lihaf: '#1e2a45', lihafBorder: '#c9a14a' } };
    applyOutfit(root, cfg);
    applyMaterials(root, cfg);
    const rig = new Rig(root, cfg);
    if (rig.missing.length) throw new Error('missing-bones:' + rig.missing.join(','));
    rig.normalize(cfg.height); rig.captureRest();
    return new Hands(root, rig);
  }

  constructor(root, rig) {
    this.root = root; this.rig = rig; this.side = {};
    root.updateMatrixWorld(true);
    for (const s of ['L', 'R']) this.side[s] = this.measure(s);
    this.crop();
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  }

  // ---------- القياس في وضعية الراحة ----------
  measure(s) {
    const rig = this.rig, B = (k) => rig.b(s, k), fore = B('lowerArm'), wrist = B('hand');
    const Hrest = handFrameNow(rig, s);                       // {o,x,y,z} مصفوفات أعداد
    const v = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    const Mh = frameMatrix(v(Hrest.o), v(Hrest.x), v(Hrest.y), v(Hrest.z));
    const fingers = {};
    for (const f of FINGERS) {
      const bones = [1, 2, 3].map((j) => B(`${f}${j}`));
      const p = bones.map((b) => b.getWorldPosition(new THREE.Vector3()));
      const tip = p[2].clone().add(p[2].clone().sub(p[1]).multiplyScalar(0.85));
      // ثني الأصابع في وضعية الراحة (النموذج يأتي بأصابع منثنية قليلًا): ميل كل سُلامية عن مستوى الكف وانفراجها عن محوره
      const hx = v(Hrest.x), hy = v(Hrest.y), hz = v(Hrest.z), seg = [p[1].clone().sub(p[0]).normalize(), p[2].clone().sub(p[1]).normalize()];
      const pit = seg.map((d) => Math.asin(Math.max(-1, Math.min(1, d.dot(hz)))));
      fingers[f] = { bones, len: [p[0].distanceTo(p[1]), p[1].distanceTo(p[2]), p[2].distanceTo(tip)],
        flexRest: [-pit[0], -(pit[1] - pit[0]), 0], yawRest: Math.atan2(seg[0].dot(hx), seg[0].dot(hy)) };
    }
    // الإصبع الوسطى من المعصم: طول الكف التقريبي (لتقدير المواضع)
    const palm = B('middle1').getWorldPosition(new THREE.Vector3()).distanceTo(wrist.getWorldPosition(new THREE.Vector3()));
    return { fore, wrist, HrestInv: Mh.clone().invert(), MforeRest: fore.matrixWorld.clone(), fingers, palm,
      sign: s === 'L' ? 1 : -1 };
  }

  // ---------- قصّ الشبكات: الساعد والكف فقط ----------
  crop(keepFore = 0.24, keepSkin = 0.1) {   // الجلد يُقصّ أقصر من الكمّ فلا يظهر تحت حافته
    const rig = this.rig, keep = new Map();           // عظمة → جهة
    for (const s of ['L', 'R']) rig.b(s, 'lowerArm').traverse((b) => { if (b.isBone) keep.set(b, s); });
    const handB = new Set(); for (const s of ['L', 'R']) rig.b(s, 'hand').traverse((b) => { if (b.isBone) handB.add(b); });
    const wristP = { L: rig.wp('L', 'hand'), R: rig.wp('R', 'hand') };
    const w = new THREE.Vector4(), ix = new THREE.Vector4(), p = new THREE.Vector3();
    for (const m of rig.meshes) {
      const g = m.geometry, sw = g.attributes.skinWeight, si = g.attributes.skinIndex, n = g.attributes.position.count;
      const ok = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        w.fromBufferAttribute(sw, i); ix.fromBufferAttribute(si, i);
        let tot = 0, handW = 0, sideW = { L: 0, R: 0 };
        for (let k = 0; k < 4; k++) { const b = m.skeleton.bones[ix.getComponent(k)], s = keep.get(b); if (s) { tot += w.getComponent(k); sideW[s] += w.getComponent(k); if (handB.has(b)) handW += w.getComponent(k); } }
        if (tot < 0.55) continue;
        const s = sideW.L > sideW.R ? 'L' : 'R';
        rig.vertexWorld(m, i, p);
        if (handW >= 0.5 || p.distanceTo(wristP[s]) <= (m.name === 'Human' ? keepSkin : keepFore)) {   // الكف والأصابع كاملة، والساعد حتى حدّ القص
          ok[i] = 1;
          // الأوزان المتبقية لعظام العضد/الكتف تشدّ الرأس إلى جسم العازفة البعيد: نحصرها في عظام الساعد واليد
          for (let k = 0; k < 4; k++) { const b = m.skeleton.bones[ix.getComponent(k)]; w.setComponent(k, keep.has(b) ? w.getComponent(k) / tot : 0); }
          sw.setXYZW(i, w.x, w.y, w.z, w.w);
        }
      }
      const idx = g.index ? g.index.array : null, triCount = (idx ? idx.length : n) / 3;
      const groups = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.length : n, materialIndex: 0 }];
      const out = [], newGroups = [];
      for (const gr of groups) {
        const start = out.length;
        for (let t = gr.start / 3; t < Math.min(triCount, (gr.start + gr.count) / 3); t++) {
          const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
          if (ok[a] && ok[b] && ok[c]) out.push(a, b, c);
        }
        if (out.length > start) newGroups.push({ start, count: out.length - start, materialIndex: gr.materialIndex });
      }
      sw.needsUpdate = true;
      if (!out.length) { m.visible = false; continue; }
      g.setIndex(out); g.clearGroups(); if (Array.isArray(m.material)) for (const gr of newGroups) g.addGroup(gr.start, gr.count, gr.materialIndex);
    }
  }

  // ---------- الوضعية ----------
  /**
   * يضع يدًا: الساعد بإطار forearm ({o,x,y,z} THREE.Vector3 بإطار اليد: y نحو الأصابع، z ظهر اليد)،
   * ثم ثني المعصم wrist (راديان، موجب = رفع الكف لأعلى نحو ظهر اليد)، ثم الأصابع fingers[f] = [ث1, ث2, ث3] (راديان، موجب = انثناء نحو الكف)
   * وضمّها spread (0 = كما في الراحة، 1 = ملتصقة).
   */
  pose(s, pose) {
    const S = this.side[s], fore = S.fore;
    const Hdes = frameMatrix(pose.o, pose.x, pose.y, pose.z);
    // الساعد يتبع «إطار اليد بلا ثني معصم»: G = Hdes · Hrest⁻¹ ، ثم ساعد_العالم = G · ساعد_الراحة
    const G = _m.multiplyMatrices(Hdes, S.HrestInv);
    const Mfore = new THREE.Matrix4().multiplyMatrices(G, S.MforeRest);
    const parentInv = fore.parent.matrixWorld.clone().invert();
    new THREE.Matrix4().multiplyMatrices(parentInv, Mfore).decompose(fore.position, fore.quaternion, fore.scale);   // المقياس أيضًا (يُعيد اليد بعد إخفائها)
    S.hidden = false;
    fore.updateMatrixWorld(true);
    // استرجاع وضعية الراحة لما تحت الساعد قبل الثني
    const rest = this.rig.rest;
    fore.traverse((b) => { if (b !== fore && b.isBone) { const r = rest.get(b); if (r) { b.quaternion.copy(r.q); b.position.copy(r.p); } } });
    fore.updateMatrixWorld(true);
    // المعصم: ثني حول محور اليد العرضي x عند مفصل المعصم
    if (pose.wrist) this.rotWorld(S.wrist, pose.x, pose.wrist);   // الدوران الموجب حول x يحمل y نحو z (ظهر اليد) = رفع الكف
    // الأصابع
    const lat = pose.x, nrm = pose.z;
    for (const f of FINGERS) {
      const a = pose.fingers && pose.fingers[f]; const F = S.fingers[f];
      if (f !== 'thumb' && pose.spread) {           // ضمّ الأصابع (spread > 0) أو فتحها (spread < 0) بدوران حول عمودي الكف
        const sp = pose.spread, tgt = sp > 0 ? F.yawRest + (TOGETHER[f] * -S.sign - F.yawRest) * Math.min(1, sp) : F.yawRest * (1 + 0.5 * Math.min(1, -sp));
        this.rotWorld(F.bones[0], nrm, F.yawRest - tgt);
      }
      if (!a) continue;
      if (f === 'thumb') { const axis = this.thumbAxis(s, pose); for (let j = 0; j < 3; j++) if (a[j]) this.rotWorld(F.bones[j], axis, a[j]); continue; }
      // الزوايا المطلوبة مطلقة (0 = إصبع مستقيمة في مستوى الكف)؛ ندوّر بالفرق عن وضعية الراحة
      for (let j = 0; j < 3; j++) { const d = (a[j] || 0) - F.flexRest[j]; if (d) this.rotWorld(F.bones[j], lat, -d); }
    }
  }
  thumbAxis(s, pose) { return _v.copy(pose.y).multiplyScalar(0.6).add(pose.z.clone().multiplyScalar(S_THUMB * (s === 'L' ? -1 : 1))).normalize().clone(); }

  /** دوران عظمة حول محور عالمي يمر بمفصلها */
  rotWorld(bone, axis, ang) {
    bone.getWorldQuaternion(_q);
    _q2.setFromAxisAngle(axis, ang).multiply(_q);
    bone.parent.getWorldQuaternion(_q).invert();
    bone.quaternion.copy(_q.multiply(_q2));
    bone.updateMatrixWorld(true);
  }

  /** مواضع عالمية مفيدة بعد الوضعية: أطراف الأصابع ومنتصف السُّلاميات (لنقطة التلامس) */
  tip(s, f) { const F = this.side[s].fingers[f], b2 = F.bones[1], b3 = F.bones[2]; const p2 = b2.getWorldPosition(new THREE.Vector3()), p3 = b3.getWorldPosition(new THREE.Vector3()); return p3.clone().add(p3.clone().sub(p2).normalize().multiplyScalar(F.len[2])); }
  joint(s, f, j) { return this.side[s].fingers[f].bones[j - 1].getWorldPosition(new THREE.Vector3()); }
  wristPos(s) { return this.side[s].wrist.getWorldPosition(new THREE.Vector3()); }
  /** اليدان شبكة واحدة؛ إخفاء يد = تصغير عظمة ساعدها إلى الصفر (تنطوي رؤوسها كلها) */
  hide(s) { const f = this.side[s].fore; f.scale.setScalar(1e-4); f.position.set(0, -50, 0); f.updateMatrixWorld(true); this.side[s].hidden = true; }
}
const S_THUMB = 0.8;
/** انفراج الأصابع حين تُضمّ (راديان، لليد اليمنى؛ اليسرى معكوسة) */
const TOGETHER = { index: -0.05, middle: 0.02, ring: 0.09, little: 0.16 };
