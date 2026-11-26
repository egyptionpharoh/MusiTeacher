// =====================================================================
//  السائق/السائقة: الشخصية المشتركة نفسها (العازف والعازفة في الأورج ثلاثي الأبعاد) بعد تجهيزها للقيادة.
//  • التحميل والتشكيل الذكري والزي والمواد: الملفات المشتركة كما هي (_shared/3d/character) دون أي تعديل.
//  • ملابس القيادة: src/character/racewear.js.
//  • الوضعية: نرث SeatedPlayer (قياس الجسم وIK الذراعين واليدين)، ونكتب وضعيتين جديدتين:
//      السيارة: جلوس منخفض بظهر مائل للخلف، الساقان ممدودتان نحو الدواسات، اليدان على المقود عند «٩ و٣».
//      الموتوسيكل: جذع مائل للأمام، الركبتان تضمّان الخزان، القدمان على مسندي القدمين، اليدان على المقبضين.
//    اليدان تُحلّان كل إطار من موضع المقود/المقبض الفعلي، فتتبعان دوران المقود وميل الدراجة.
// =====================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { Rig } from '../../_shared/3d/character/rig.js';
import { applyOutfit } from '../../_shared/3d/character/outfit.js';
import { applyMaterials } from '../../_shared/3d/character/materials.js';
import { loadMorph, applyMaleMorph, addMaleFace } from '../../_shared/3d/character/gender.js';
import { SeatedPlayer } from '../../_shared/3d/character/seated-player.js';
import { fingerFK, thumbChain, poseFingers, FINGERS } from '../../_shared/3d/character/hand.js';
import { V, Frame, ik2 } from '../../_shared/3d/engine/math.js';
import { CONFIG, SUITS } from '../config.js';
import { applyRacewear, buildHelmet, buildBelt, buildTail } from './racewear.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const ar = (v) => [v.x, v.y, v.z];
const UP = [0, 1, 0];

export const cfgFor = (g) => (g === 'male' ? { ...CONFIG, ...CONFIG.male, outfit: { ...CONFIG.outfit, ...CONFIG.male.outfit } } : { ...CONFIG, gender: 'female' });

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** يحمّل الشخصية ويجهزها للقيادة. onProgress(0..1) */
export async function loadDriver(gender, onProgress) {
  const cfg = cfgFor(gender);
  const mgr = new THREE.LoadingManager();
  mgr.setURLModifier((u) => (/\.(png|jpe?g|tga|bmp|gif|tif)(\?|$)/i.test(u) ? PX : u));
  const root = await new FBXLoader(mgr).loadAsync(CONFIG.modelUrl, (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); });
  const strays = []; root.traverse((o) => { if (o.isLight || o.isCamera) strays.push(o); }); strays.forEach((o) => o.parent && o.parent.remove(o));
  if (gender === 'male') applyMaleMorph(root, await loadMorph(cfg.morphUrl));
  applyOutfit(root, cfg);
  if (gender === 'male') addMaleFace(root);
  applyMaterials(root, cfg);
  const S = SUITS[gender];
  const wear = applyRacewear(root, gender, S);
  const rig = new Rig(root, cfg);
  if (rig.missing.length) throw new Error('missing-bones:' + rig.missing.join(','));
  const d = new Driver(rig, cfg, gender, S);
  d.setup();
  d.wear = wear;
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  return d;
}

export class Driver extends SeatedPlayer {
  constructor(rig, cfg, gender, suit) { super(rig, cfg); this.gender = gender; this.suit = suit; this.helmets = {}; this.belt = null; this.mode = null; this.steer = 0; this.lean = 0; }

  setup() {
    const rig = this.rig;
    rig.normalize(this.cfg.height || 1.6);
    rig.captureRest();
    rig.buildDominance();
    this.measure();
    // الخوذتان تُبنيان في وضعية الراحة (قياس الرأس)، ونُظهر المناسبة للمركبة
    this.helmets.car = buildHelmet(rig, this.suit, 'car');
    this.helmets.moto = buildHelmet(rig, this.suit, 'moto');
    for (const k in this.helmets) if (this.helmets[k]) this.helmets[k].visible = false;
    this.root = rig.root;
  }

  // ------------------------------------------------------------------ أدوات
  _spineChain() { const r = this.rig; return ['spine', 'chest', 'upperChest'].map((k) => r.b('C', k)).filter(Boolean); }
  /** دوران الراحة العالمي محسوبًا داخل إطار أب الشخصية الحالي (المركبة قد تكون مستديرة في العالم) */
  _restWQ(b) { return this._pq().multiply(this.rig.rest.get(b).wq.clone()); }
  _pq() { const p = this.rig.root.parent; return p ? p.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion(); }
  /** دوران حول محور في إطار المركبة → عالمي */
  _rotIn(axis, ang) { const q = this._pq(); return q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis, ang)).multiply(q.clone().invert()); }
  /** ميل الجذع حول محور X العالمي (موجب = للأمام)، موزّع على فقرات العمود */
  _leanTorso(total, dist = [0.5, 0.3, 0.2]) {
    const rig = this.rig, ch = this._spineChain();
    const hips = rig.b('C', 'hips');
    rig.setWorldQuaternion(hips, this._restWQ(hips));
    let acc = 0;
    ch.forEach((b, i) => {
      acc += total * (dist[i] ?? 0);
      rig.setWorldQuaternion(b, this._rotIn(new THREE.Vector3(1, 0, 0), acc).multiply(this._restWQ(b)));
    });
  }
  /** الرأس والرقبة: اتجاه نظر مستقل عن ميل الجذع (الرقبة تعوّض جزءًا والرأس الباقي) */
  _head(yaw, pitch, roll = 0) {
    const rig = this.rig, neck = rig.b('C', 'neck'), head = rig.b('C', 'head');
    const q = this._pq(), qi = q.clone().invert();
    const e = (k, extra = 0) => q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((pitch + extra) * k, yaw * k, roll * k, 'YXZ'))).multiply(qi);
    rig.setWorldQuaternion(neck, e(0.5, this.neckExtra || 0).multiply(this._restWQ(neck)));
    rig.setWorldQuaternion(head, e(1).multiply(this._restWQ(head)));
  }
  _placeHips(target) {
    const rig = this.rig, root = rig.root;
    root.updateMatrixWorld(true);
    const mid = rig.wp('L', 'upperLeg').add(rig.wp('R', 'upperLeg')).multiplyScalar(0.5);
    const d = target.clone().sub(mid);
    // root قد يكون ابنًا لمجموعة المركبة: نحوّل الإزاحة العالمية إلى إحداثيات الأب
    if (root.parent) { root.parent.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.parent.matrixWorld).invert(); const o = new THREE.Vector3().applyMatrix4(inv); d.applyMatrix4(inv).sub(o); }
    root.position.add(d); root.updateMatrixWorld(true);
  }
  _legTo(s, ank, pole, footDir) {
    const rig = this.rig, Ln = this.len[s];
    const hip = ar(rig.wp(s, 'upperLeg'));
    const reach = Ln.thigh + Ln.shin - 0.004;
    let a = ank;
    const dd = V.dist(hip, a); if (dd > reach) a = V.add(hip, V.mul(V.norm(V.sub(a, hip)), reach));
    const knee = ik2(hip, a, Ln.thigh, Ln.shin, V.add(hip, pole));
    const thighD = V.norm(V.sub(knee, hip)), shinD = V.norm(V.sub(a, knee));
    rig.aim(rig.b(s, 'upperLeg'), v3(thighD), v3(V.mul(V.perp(shinD, thighD), -1)));
    rig.aim(rig.b(s, 'lowerLeg'), v3(shinD), v3(V.perp(thighD, shinD)));
    rig.aim(rig.b(s, 'foot'), v3(V.norm(footDir)), v3(V.norm(V.perp(UP, V.norm(footDir)).length ? V.perp(UP, V.norm(footDir)) : UP)));
    if (!this.knee) this.knee = {};
    this.knee[s] = knee;
  }

  /** يحل محل restClav في SeatedPlayer: راحة الترقوة نسبةً إلى الصدر (لا إلى العالم) حتى تبقى صحيحة مع حركة المركبة */
  restClav(s) {
    const c = this.rig.b(s, 'shoulder');
    const pq = c.parent.getWorldQuaternion(new THREE.Quaternion());
    return pq.multiply((this._clavLocal && this._clavLocal[s]) || c.quaternion.clone());
  }

  // ------------------------------------------------------------------ قبضة اليد حول أنبوب (مقود/مقبض)
  /** سلاسل أصابع منثنية حول أنبوب نصف قطره r (في إطار اليد المحلي)، والإبهام يلتف من الجهة المقابلة */
  _gripChains(hm, r, curl = 1) {
    const side = hm.s;
    const ang = [[0.06, 1.15, 1.25, 0.75], [0.0, 1.2, 1.3, 0.8], [-0.05, 1.25, 1.35, 0.82], [-0.12, 1.3, 1.4, 0.85]];
    const chains = hm.fingers.map((fd, i) => { const a = ang[i].map((x, k) => (k ? x * curl : x)); return fingerFK(fd, side, a).pts; });
    // الإبهام: طرفه على جهة الراحة قرب السُّلامية الوسطى للسبابة
    const idx = chains[0];
    const tip = V.add(V.lerp(idx[1], idx[2], 0.5), [side * 0.012, -0.006, -0.018 - r * 0.6]);
    const th = thumbChain(hm.thumb, side, tip, V.norm([side * 0.6, 0.6, -0.5]), [side * 0.2, 0.5, -0.8]);
    return { chains, th };
  }
  _grip(s, frame, r) {
    const hm = this.hand[s];
    if (!this._gc) this._gc = {};
    const key = s + r;
    if (!this._gc[key]) this._gc[key] = this._gripChains(hm, r);
    const g = this._gc[key];
    poseFingers(this.rig, hm, frame, g.chains, g.th);
  }
  /** إطار اليد (Frame) الذي يجعل الأصابع المنثنية تلتف حول نقطة P على أنبوب محوره axis، والكف نحو palmDir */
  _handOnTube(s, P, axis, palmDir, r) {
    const hm = this.hand[s];
    // في إطار اليد: x جهة الإبهام (لليسرى) ، y نحو الأصابع ، z ظهر اليد
    // نضع خط المفاصل (index→little) على طول محور الأنبوب، والإبهام في اتجاه axisThumb
    // axis = الاتجاه الذي يقع فيه جانب الإبهام/السبابة على طول الأنبوب. في handFrameNow: x = جهة الإبهام × s (s=+1 لليسرى و−1 لليمنى)
    const x = V.norm(s === 'L' ? axis : V.mul(axis, -1));
    let z = V.norm(V.perp(V.mul(palmDir, -1), x));               // ظهر اليد عكس الكف
    let y = V.cross(z, x);
    // مركز قبضة الأصابع المنثنية يبعد عن الرسغ نحو الأصابع وتحت الكف: نقيسه من سلسلة الوسطى نفسها
    if (!this._gripOff) this._gripOff = {};
    if (!this._gripOff[s + r]) {
      const m0 = hm.fingers[1], k = [m0.k[0] * hm.s, m0.k[1], m0.k[2]];
      // مركز الأنبوب: أمام مفصل الوسطى بنصف السلامية الأولى، وتحت الكف بنصف قطر الأنبوب + سُمك الكف
      this._gripOff[s + r] = [k[0], k[1] + m0.L[0] * (this.gripK ? this.gripK[0] : 0.45), k[2] - r - (this.gripK ? this.gripK[1] : 0.014)];
    }
    const off = this._gripOff[s + r];
    const fr0 = Frame([0, 0, 0], x, y, z);
    const o = V.sub(P, V.add(V.add(V.mul(fr0.x, off[0]), V.mul(fr0.y, off[1])), V.mul(fr0.z, off[2])));
    return Frame(o, x, y, z);
  }

  // ------------------------------------------------------------------ الوضعيات
  /**
   * يجلس السائق في المركبة. veh: كائن من vehicles/*.js فيه spec (في إحداثيات المركبة المحلية) و root.
   * يُستدعى والمركبة في وضع الأصل (بلا دوران) — main.js يضمن ذلك.
   */
  seatIn(veh) {
    const rig = this.rig, sp = veh.spec, root = rig.root;
    this.veh = veh; this.mode = sp.kind;
    rig.resetToRest();
    root.quaternion.set(0, 0, 0, 1);
    // اتجاه الراحة من normalize محفوظ: نعيده
    if (this._rootQ) root.quaternion.copy(this._rootQ); else this._rootQ = root.quaternion.clone();
    if (root.parent !== veh.seatAnchor) veh.seatAnchor.add(root);
    root.position.set(0, 0, 0); root.updateMatrixWorld(true);
    const W = (p) => v3(p).applyMatrix4(veh.root.matrixWorld);
    // الجذع ثم الحوض في موضع المقعد
    this._leanTorso(sp.torsoLean, sp.leanDist);
    // الترقوتان: وضعهما المحلي بعد ميل الجذع هو «الراحة» التي تتقدّم منها حين تمتد الذراع
    this._clavLocal = {};
    for (const s of ['L', 'R']) { const c = rig.b(s, 'shoulder'); if (c) this._clavLocal[s] = c.quaternion.clone(); }
    this._placeHips(W(sp.hip));
    // الساقان
    for (const s of ['L', 'R']) {
      const sg = s === 'L' ? 1 : -1, L = sp.legs;
      const ank = ar(W([L.ankle[0] * sg, L.ankle[1], L.ankle[2]]));
      const pole = [L.pole[0] * sg, L.pole[1], L.pole[2]];
      this._legTo(s, ank, pole, [L.foot[0] * sg, L.foot[1], L.foot[2]]);
    }
    // الحوض يلامس المقعد: أخفض نقطة في الأرداف = سطح المقعد (قياس من الشبكة الفعلية)
    const p = new THREE.Vector3(); let minY = Infinity;
    if (!this._seatV) this._seatV = rig.verts([rig.b('C', 'hips'), rig.b('L', 'upperLeg'), rig.b('R', 'upperLeg')], 0.3);
    const jy = rig.wp('L', 'upperLeg').y;
    for (let k = 0; k < this._seatV.length; k += 3) { const e = this._seatV[k]; rig.vertexWorld(e.m, e.i, p); if (p.y < jy && Math.abs(p.x) < 0.2) minY = Math.min(minY, p.y); }
    const seatY = W([0, sp.seatY, 0]).y;
    if (isFinite(minY)) {
      const lift = seatY - minY;
      this._placeHips(rig.wp('L', 'upperLeg').add(rig.wp('R', 'upperLeg')).multiplyScalar(0.5).add(new THREE.Vector3(0, lift, 0)));
      for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1, L = sp.legs; this._legTo(s, ar(W([L.ankle[0] * sg, L.ankle[1], L.ankle[2]])), [L.pole[0] * sg, L.pole[1], L.pole[2]], [L.foot[0] * sg, L.foot[1], L.foot[2]]); }
      this.qa.seatGapMm = +(lift * 1000).toFixed(1);
    }
    this.neckExtra = sp.neckExtra || 0;
    this._head(0, sp.headPitch || 0);
    // التجهيزات
    for (const k in this.helmets) if (this.helmets[k]) this.helmets[k].visible = (k === sp.kind);
    if (this.belt) { this.belt.parent && this.belt.parent.remove(this.belt); this.belt = null; }
    if (sp.kind === 'car') this.belt = buildBelt(rig, this.suit.helmetStripe === '#c8323a' ? '#262c36' : '#c8323a');
    if (this.tail) { this.tail.parent && this.tail.parent.remove(this.tail); this.tail = null; }
    if (sp.kind === 'moto') this.tail = buildTail(rig, this.suit, { seatY: W([0, sp.seatY, 0]).y });
    this._gc = null; this._gripOff = null;
    this.updateHands(0);
  }

  /** كل إطار: اليدان على المقود/المقبضين بحسب الدوران الحالي، والرأس ينظر نحو المنعطف */
  updateHands(steer, look = 0) {
    const veh = this.veh; if (!veh) return;
    this.steer = steer;
    const grips = veh.gripFrames();                                  // [{s, P, axis, palm, r}] في الإحداثيات العالمية
    for (const g of grips) {
      const fr = this._handOnTube(g.s, g.P, g.axis, g.palm, g.r);
      const sg = g.s === 'L' ? 1 : -1, pl = veh.spec.elbowPole;
      this.poseArm(g.s, fr, [pl[0] * sg, pl[1], pl[2]]);
      this._grip(g.s, fr, g.r);
    }
    this._head(look * 0.35, this.veh.spec.headPitch || 0, -look * 0.05);
  }
}
