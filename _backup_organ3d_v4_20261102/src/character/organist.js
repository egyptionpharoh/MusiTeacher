// =====================================================================
//  العازف/العازفة على الأورج: الجلوس على المقعد أمام لوحة مفاتيح أفقية، والذراعان بالـIK، والأصابع بأقواس (fingerArch)
//  تنتهي على نقطة لمس فعلية فوق سطح المفتاح (تُحسب من شبكة المفتاح نفسها فتتبع نزوله عند الضغط).
//  حركة مستقلة للأورج (لا منسوخة من الكمان أو الأكورديون):
//   • اليدان فوق المفاتيح والكفّان للأسفل، والأصابع مقوّسة، والمعصم أعلى قليلًا من سطح المفاتيح.
//   • اليد اليمنى: الإبهام (١) على النغمة الأخفض والخنصر (٥) على الأعلى. اليد اليسرى معكوسة: الخنصر على الأخفض.
//   • الإصبع على المفتاح الأسود يمتد للداخل (نحو اللوحة)، وتتقدّم الكف كلها إن لزم.
//   • المرفقان قرب الجسم وأخفض قليلًا من المعصمين، ويتحركان مع انتقال اليد على طول اللوحة.
// =====================================================================
import * as THREE from 'three';
import { V, Frame } from '../../_shared/3d/engine/math.js';
import { SeatedPlayer, SEAT as SEAT_REF } from '../../_shared/3d/character/seated-player.js';
import { fingerArch, thumbChain, poseFingers } from '../../_shared/3d/character/hand.js';
import { DIM } from '../instrument/organ-model.js';
import { WHITE_COUNT } from '../instrument/organ-data.js';
import { fixSeatedGlutes } from './seat-fix.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const ar = (v) => [v.x, v.y, v.z];
const QP = (k, d) => { const q = new URLSearchParams(location.search).get(k); return q ? q.split(',').map(Number) : d; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ثوابت قابلة للضبط عبر الرابط أثناء المعايرة (لا تؤثر في الاستعمال العادي)
const FDIR = { R: QP('rf', [0.0, 0.12, 1.0]), L: QP('lf', [0.0, -0.12, 1.0]) };     // اتجاه الأصابع في إطار kb (الأصابع تميل قليلًا نحو الداخل مع الساعد)
const POLE = { R: QP('rpole', [-0.55, -0.75, -0.35]), L: QP('lpole', [0.55, -0.75, -0.35]) };
const ARCH = QP('arch', [0.46, 0.68]);          // (أمام، نحو الراحة) كسور من طول الوسطى لموضع الطرف بالنسبة لجذر الإصبع
const PAD = QP('pad', [0.0085])[0];             // سُمك لحم الطرف فوق السطح
const HAND_POLE = QP('hpole', [0, 1, 0.6]);
const HOVER_Z = QP('hz', [0.034])[0];           // موضع الأطراف الخاملة على طول البيض (من المقدّمة)
const HAND_ROLL = QP('hroll', [7])[0];          // ميل الكف نحو جهة الخنصر (درجات)
const WRIST_MIN = QP('wmin', [0.034])[0];       // أقل ارتفاع للمعصم فوق سطح البيض
const BLACK_Z = DIM.BLACK_ZONE - 0.010;
const THUMB_DIR = QP('tdir', [0.0, 0.8, -0.4]);
// عبور الأصابع: اتجاه الإبهام حين يعبر تحت الكف (نحو جهة الخنصر، للأمام، نحو الراحة)، ودوران المعصم وارتفاع الأقواس
const THUMB_UNDER = QP('tund', [0.55, 0.55, -0.62]);
const CROSS_YAW = QP('cyaw', [7])[0];           // درجات: الرسغ يسبق الأصابع في اتجاه الحركة فتشير الأصابع قليلًا للخلف
const OVER_ARC = QP('oarc', [0.011])[0];        // قوس منخفض: الإصبع ٣ يمر فوق الإبهام قريبًا منه (لا قفزة عالية متصلبة)        // ارتفاع قوس الإصبع العابر فوق الإبهام (م)
const UNDER_ARC = QP('uarc', [0.004, 0.008]);   // الإبهام العابر: ارتفاع خفيف + نحو العازف (تحت الكف)     // اتجاه الإبهام المفضل في إطار الكف (جانبي، أمامي، نحو الراحة)         // بداية منطقة السود ناقص هامش

// أقصر مسافة بين قطعتين مستقيمتين [a0,a1] و[b0,b1]
function segDist(a0, a1, b0, b1) {
  const d1 = V.sub(a1, a0), d2 = V.sub(b1, b0), r = V.sub(a0, b0);
  const a = V.dot(d1, d1), e = V.dot(d2, d2), f = V.dot(d2, r);
  let sN, tN;
  if (a < 1e-12 && e < 1e-12) return V.len(r);
  if (a < 1e-12) { sN = 0; tN = clamp(f / e, 0, 1); }
  else { const c = V.dot(d1, r); if (e < 1e-12) { tN = 0; sN = clamp(-c / a, 0, 1); } else { const b = V.dot(d1, d2), den = a * e - b * b; sN = den > 1e-12 ? clamp((b * f - c * e) / den, 0, 1) : 0; tN = (b * sN + f) / e; if (tN < 0) { tN = 0; sN = clamp(-c / a, 0, 1); } else if (tN > 1) { tN = 1; sN = clamp((b - c) / a, 0, 1); } } }
  return V.len(V.sub(V.madd(a0, d1, sN), V.madd(b0, d2, tN)));
}

export class Organist extends SeatedPlayer {
  constructor(rig, config, organ) { super(rig, config); this.organ = organ; }

  setup() {
    this.baseSetup();
    this.head = { yaw: 0, pitch: QP('hp', [0.30])[0], roll: 0 };     // ينظر إلى المفاتيح
    this.applyHead(this.head.yaw, this.head.pitch, this.head.roll);
    // نقطة البداية: اليمنى إبهامها على دو٤ (الخانة 14)، واليسرى إبهامها على صول٣ (الخانة 11) — وضع الخمس نغمات
    this.state = { R: { base: 14, digits: {} }, L: { base: 11, digits: {} } };
    this.pose(this.state);
    // تصحيح شكل الأرداف في الجلوس (ثوب العازف) — انظر seat-fix.js
    if (!new URLSearchParams(location.search).has('noglutefix')) { try { this.qa.glutes = fixSeatedGlutes(this.rig, SEAT_REF, { depth: QP('gd', [0.035])[0] }); } catch (e) { console.warn('glute fix skipped', e); } }
    this.qa.seatTorso = this.torsoReport();
  }
  activate() { this.applyHead(this.head.yaw, this.head.pitch, this.head.roll); this.pose(this.state); }

  // إطار لوحة المفاتيح
  WK(p) { return this.organ.kb.localToWorld(new THREE.Vector3(p[0], p[1], p[2])); }
  WdK(d) { return v3(d).applyQuaternion(this.organ.kb.getWorldQuaternion(new THREE.Quaternion())); }
  // سطح المفتاح عند نقطة اللمس (يتبع ضغط المفتاح لأنه محسوب من شبكته)
  keySurface(k, extra = 0) { return k.mesh.localToWorld(new THREE.Vector3(-k.thick / 2 - PAD - extra, 0, k.touchZ)); }

  torsoReport() {
    const rig = this.rig, p = new THREE.Vector3(); let front = -Infinity;
    for (const e of rig.verts([rig.b('C', 'spine'), rig.b('C', 'chest')].filter(Boolean), 0.3)) { rig.vertexWorld(e.m, e.i, p); if (p.y > 0.6 && p.y < 0.95) front = Math.max(front, p.z); }
    return { bellyFrontZ: +front.toFixed(3), keyFrontZ: DIM.Z_FRONT, gapMm: Math.round((DIM.Z_FRONT - front) * 1000) };
  }

  // ---------- يد واحدة (R أو L) ----------
  // st: { base: خانة الإبهام (عشرية على البيض 0..35), digits: { d: { keyId, amt, lift } } }
  solveHand(s, st) {
    const rig = this.rig, hm = this.hand[s], organ = this.organ, side = s === 'R' ? -1 : 1, dir = s === 'R' ? 1 : -1;   // dir: اتجاه تزايد الخانة مع رقم الإصبع
    const nloc = [1, 0, 0];                                          // نحو داخل المفاتيح (الأسفل)
    const f = ar(this.WdK(V.norm(FDIR[s]))), n = ar(this.WdK(nloc));
    const yv0 = V.norm(f), zv0 = V.norm(V.mul(n, -1)), xv0 = V.cross(yv0, zv0);
    const amtOf = (d) => (st.digits[d] ? clamp(st.digits[d].amt ?? 0, 0, 1) * (1 - clamp(st.digits[d].lift ?? 0, 0, 1)) : 0);
    // ميل الكف: جهة الخنصر أخفض قليلًا (يد مرتخية)، ويزداد مع ضغط الخنصر ويقل مع ضغط الإبهام
    const crossRoll = (() => { let o = 0; for (const pr of Object.values(st.digits)) if (pr && pr.cross === 'over') o = Math.max(o, 1 - clamp(pr.lift ?? 0, 0, 1) * 0.5); return o; })();
    const roll = side * (HAND_ROLL + 8 * amtOf(4) + 3 * amtOf(3) - 8 * amtOf(0) - 7 * crossRoll) * Math.PI / 180, cr = Math.cos(roll), sr = Math.sin(roll);
    let xv = V.norm(V.sub(V.mul(xv0, cr), V.mul(zv0, sr))), zv = V.norm(V.add(V.mul(zv0, cr), V.mul(xv0, sr)));
    const slotY = (sl) => organ.slotY(sl);
    // ---------- عبور الأصابع: مقدار العبور الجاري (0..1) لكل نوع ----------
    //  تحت: الإبهام متجه إلى مفتاح أبعد من موضعه الطبيعي في اتجاه الحركة؛ فوق: إصبع متجه إلى مفتاح في جهة الإبهام.
    const slotOf = (id) => (organ.keys[id] ? organ.keys[id].slotEff : null);
    let cU = 0, cO = 0, uOff = 0;
    for (const [dk, pr] of Object.entries(st.digits)) {
      if (!pr || !pr.cross || slotOf(pr.keyId) == null) continue;
      const d = +dk, near = clamp(1.35 * (1 - clamp(pr.lift ?? 0, 0, 1)) + 0.25, 0, 1);
      if (pr.cross === 'under' && d === 0) { uOff = Math.max(uOff, dir * (slotOf(pr.keyId) - st.base)); cU = Math.max(cU, clamp((uOff - 0.3) / 2.2, 0, 1) * near); }
      if (pr.cross === 'over' && d > 0) { const off = dir * (slotOf(pr.keyId) - (st.base + dir * d)); cO = Math.max(cO, clamp((-off - 0.3) / 2.2, 0, 1) * near); }
    }
    this.qa['cross' + s] = { under: +cU.toFixed(2), over: +cO.toFixed(2) };
    // الرسغ يسبق الأصابع في اتجاه انتقال اليد (يمنى صاعدة: نحو الحاد)، فتدور الكف قليلًا حول محورها الرأسي
    const yaw = CROSS_YAW * Math.PI / 180 * dir * (cU - cO);
    let yv = V.norm(f);
    if (Math.abs(yaw) > 1e-4) { yv = V.norm(V.rot(yv, zv, yaw)); xv = V.norm(V.rot(xv, zv, yaw)); }
    const tgt = [];
    let shiftZ = 0;
    const hover = (d) => {
      const sl = clamp(st.base + dir * d, 0, WHITE_COUNT - 1);
      const lift = 0.010 + 0.002 * Math.abs(d - 2);
      // الإبهام والخنصر أقصر: أطرافهما أقرب إلى مقدّمة المفاتيح
      const zz = HOVER_Z + shiftZ - (d === 0 ? 0.012 : d === 4 ? 0.010 : d === 3 ? 0.003 : 0);
      const top = zz > BLACK_Z ? -DIM.BH : 0;
      return this.WK([top - PAD - lift, slotY(sl), zz]);
    };
    const build = () => {
      tgt.length = 0;
      for (let d = 0; d < 5; d++) {
        const pr = st.digits[d], h = hover(d);
        if (pr && organ.keys[pr.keyId]) {
          // الهدف: سطح المفتاح + سُمك اللحم + تصحيح مُقاس لكل إصبع (يُحدَّث كل إطار من فجوة الطرف الفعلية، انظر pose)
          const k = organ.keys[pr.keyId], c = this.corr[s][d][k.black ? 1 : 0];
          const tp = this.keySurface(k, c);
          // الإبهام يلمس المفتاح بطرف جانبه: يُزاح قليلًا بعيدًا عن جهة الكف فلا يلامس جانبه المفتاح المجاور
          if (d === 0) tp.add(this.WdK([0, -side * (this.thumbOff ?? 0.008), 0]));
          // الإبهام العابر: رفع مُقاس من جلده الفعلي (انظر thumbSkinCheck) حتى لا يحتك جانبه بالمفتاح المجاور
          if (d === 0 && pr.cross === 'under' && this._tRaise && this._tRaise[s] > 1e-4) tp.add(this.WdK([-this._tRaise[s], 0, 0]));
          const q = pr.lift > 0 ? tp.lerp(h, clamp(pr.lift, 0, 1)) : tp;
          // مسار منحنٍ للإصبع العابر: فوق الإبهام قوس عالٍ، والإبهام تحت الكف ينزلق منخفضًا نحو العازف (لا خط مستقيم)
          if (pr.cross && pr.lift > 1e-3) {
            const bump = Math.pow(Math.sin(Math.PI * clamp(pr.lift, 0, 1)), 0.8);
            if (pr.cross === 'over') q.add(this.WdK([-OVER_ARC * bump, 0, 0.004 * bump]));
            else q.add(this.WdK([-UNDER_ARC[0] * bump, 0, -UNDER_ARC[1] * bump]));
          }
          tgt.push(q);
        } else tgt.push(h);
      }
    };
    build();
    // ---------- استمرارية المسار ----------
    // حين يتغير هدف إصبع (الإبهام ينتقل من دو إلى فا، أو ٣ من لا إلى مي) يبدأ مساره الجديد من موضعه الفعلي لا من موضع نظري،
    // فلا يقفز الطرف لحظة تغيير الهدف. ينتهي الدمج فور بدء الضغط حتى يبقى الإصبع مطابقًا لمفتاحه وصوته.
    const BL_DUR = 0.14;
    this._bl = this._bl || { R: [], L: [] }; this._lastT = this._lastT || { R: null, L: null };
    const B = this._bl[s], lastT = this._lastT[s];
    const blend = () => {
      for (let d = 0; d < 5; d++) {
        const pr = st.digits[d], key = pr ? pr.keyId : null;
        let bl = B[d];
        if (!bl || bl.key !== key) bl = B[d] = { key, from: lastT && lastT[d] ? lastT[d].clone() : null, t: 0 };
        if (pr && (pr.amt ?? 0) > 0.5) bl.t = BL_DUR;
        if (bl.from && bl.t < BL_DUR) { const u = bl.t / BL_DUR, e = u * u * (3 - 2 * u); tgt[d] = bl.from.clone().lerp(tgt[d], e); }
      }
    };
    blend();
    const anchor = hover(2);
    const mid = hm.fingers[1], tot = mid.L[0] + mid.L[1] + mid.L[2], mx = mid.k[0] * side, my = mid.k[1];
    let O = V.sub(V.sub(ar(anchor), V.mul(xv, mx)), V.madd(V.mul(yv, my + ARCH[0] * tot), zv, -ARCH[1] * tot));
    const kbInv = organ.kb.matrixWorld.clone().invert(), kbM = organ.kb.matrixWorld;
    const clampWrist = () => { const q = new THREE.Vector3(...O).applyMatrix4(kbInv); if (q.x > -WRIST_MIN) { q.x = -WRIST_MIN; O = ar(q.applyMatrix4(kbM)); } };
    clampWrist();
    // الرفع (تجنّب الأسود) والتقديم يُحفظان بين الإطارات ويتلاشيان ببطء، فلا تتذبذب اليد بين إطار وآخر؛
    // ويُطبَّق الرفع السابق قبل خطوة «بلوغ الأصابع» حتى تتقدم اليد إن صار إصبع قصير (الخنصر) أبعد من هدفه.
    this._lift = this._lift || { R: 0, L: 0 }; this._fwd = this._fwd || { R: {}, L: {} };
    let lifted = Math.min(0.016, this._lift[s] * 0.97);
    if (lifted > 1e-4) O = V.madd(O, ar(this.WdK([-1, 0, 0])), lifted);
    // أثناء عبور الإبهام ترتفع الكف قليلًا (تتقوّس الأصابع أكثر) فيجد الإبهام ممرًا تحتها
    if (cU + cO > 0.01) O = V.madd(O, ar(this.WdK([-1, 0, 0])), 0.005 * cU + 0.003 * cO);
    // الكف تتبع الأصابع الضاغطة: إن لم يبلغ إصبعٌ هدفه (مفتاح أسود أبعد أو امتداد للخنصر) تتقدّم اليد كلها بالقدر اللازم
    const reachOf = (i) => {
      if (i === 0) { const th = hm.thumb; return { base: V.madd(V.madd(V.madd(O, xv, th.cmc[0] * side), yv, th.cmc[1]), zv, th.cmc[2]), lim: 0.9 * (th.L[0] + th.L[1] + th.L[2]) }; }
      const fd = hm.fingers[i - 1], L = fd.L[0] + fd.L[1] + fd.L[2];
      return { base: V.madd(V.madd(V.madd(O, xv, fd.k[0] * side), yv, fd.k[1]), zv, fd.k[2]), lim: 0.93 * L };
    };
    const O0 = O;
    for (let it = 0; it < 8; it++) {
      let worst = 0, mv = null;
      for (let i = 0; i < 5; i++) {
        if (!st.digits[i]) continue;
        const { base, lim } = reachOf(i), dv = V.sub(ar(tgt[i]), base), D = V.len(dv), ex = D - lim;
        if (ex > worst) { worst = ex; mv = V.mul(dv, ex / D); }
      }
      if (!mv || worst < 2e-4) break;
      O = V.add(O, mv); clampWrist();
    }
    { const a = new THREE.Vector3(...O).applyMatrix4(kbInv), b = new THREE.Vector3(...O0).applyMatrix4(kbInv); shiftZ = a.z - b.z; if (Math.abs(shiftZ) > 1e-5) { build(); blend(); } }
    // تجنّب المفاتيح السوداء: إصبع يضغط أبيض بجوار أسود قد تمرّ سُلامياته (خاصة في يد أكبر) تحت سطح الأسود.
    // نتحقق من مفاصل الأصابع ونرفع اليد كلها (يزداد تقوّس الأصابع) بالقدر اللازم فقط.
    // الإبهام العابر يتجه عبر الراحة نحو جهة الخنصر بقدر بُعد هدفه عن موضعه الطبيعي
    const tb = clamp(uOff / 3, 0, 1), tdBase = this.thumbDir || THUMB_DIR;
    const tdNow = tb > 0 ? V.norm(V.lerp(tdBase, THUMB_UNDER, tb)) : tdBase;
    const solveChains = () => {
      const toLq = (q) => { const d = V.sub(q, O); return [V.dot(d, xv), V.dot(d, yv), V.dot(d, zv)]; };
      const ch = []; for (let i = 0; i < 4; i++) ch.push(fingerArch(hm.fingers[i], side, toLq(ar(tgt[i + 1])), HAND_POLE, 0.7));
      const td = tdNow, th = thumbChain(hm.thumb, side, toLq(ar(tgt[0])), V.norm([td[0] * -side, td[1], td[2]]), this.thumbPole || [0, 0.6, 0.6]);
      return { ch, th };
    };
    // الرفع والتقديم يُحفظان بين الإطارات ويتلاشيان ببطء (لا تذبذب بين إطار وآخر مع تصحيح الملامسة)
    let sol = solveChains();
    const blacks = this._blacks || (this._blacks = Object.values(organ.keys).filter((k) => k.black));
    for (let it = 0; it < 4; it++) {
      const W = (p) => new THREE.Vector3(...V.add(V.add(V.add(O, V.mul(xv, p[0])), V.mul(yv, p[1])), V.mul(zv, p[2]))).applyMatrix4(kbInv);
      let need = 0;
      const test = (pts) => { for (const p of pts) { const q = W(p); for (const k of blacks) { const r = 0.0078; if (Math.abs(q.y - k.y) > k.wid / 2 + r * 0.8) continue; if (q.z < DIM.WL - 0.002 - DIM.BL - r || q.z > DIM.WL) continue; const top = -DIM.BH - r * 0.85 + (k.press ? 0.004 * k.press : 0); if (q.x > top) need = Math.max(need, q.x - top); } } };
      sol.ch.forEach((c, i) => { if (st.digits[i + 1] && !organ.keys[st.digits[i + 1].keyId]?.black) test([c[1], V.lerp(c[1], c[2], 0.5)]); });   // المفصل الأوسط ومنتصف السُّلامية الوسطى
      if (need < 3e-4 || lifted > 0.02) break;
      const up = ar(this.WdK([-1, 0, 0])); O = V.madd(O, up, need + 0.001); lifted += need + 0.001; sol = solveChains();
    }
    this._lift[s] = lifted;
    this.qa['lift' + s] = +(lifted * 1000).toFixed(1);
    // السُّلامية الأخيرة لإصبع طويل على مفتاح أبيض قد تبلغ مقدّمة المفتاح الأسود المجاور: يُقدَّم موضع اللمس نحو حافة المفتاح
    {
      const Wl = (p) => new THREE.Vector3(...V.add(V.add(V.add(O, V.mul(xv, p[0])), V.mul(yv, p[1])), V.mul(zv, p[2]))).applyMatrix4(kbInv);
      const toLq = (q) => { const d = V.sub(q, O); return [V.dot(d, xv), V.dot(d, yv), V.dot(d, zv)]; };
      const bFront = DIM.WL - 0.002 - DIM.BL;
      let moved = 0; const FW = this._fwd[s];
      for (let i = 1; i <= 4; i++) {
        const pr = st.digits[i]; if (!pr || (pr.lift ?? 1) > 0.5) { delete FW[i]; continue; }
        const kk = organ.keys[pr.keyId]; if (!kk || kk.black) { delete FW[i]; continue; }
        let fm = FW[i] && FW[i].key === pr.keyId ? FW[i].v * 0.97 : 0;
        if (fm > 1e-4) { tgt[i] = tgt[i].clone().add(this.WdK([0, 0, -fm])); sol.ch[i - 1] = fingerArch(hm.fingers[i - 1], side, toLq(ar(tgt[i])), HAND_POLE, 0.7); }
        for (let it = 0; it < 3; it++) {
          const c = sol.ch[i - 1]; let dz = 0;
          for (const f of [0, 0.5]) {
            const q = Wl(V.lerp(c[2], c[3], f)), r = 0.0072;
            for (const k of blacks) { if (Math.abs(q.y - k.y) > k.wid / 2 + r * 0.7) continue; if (q.z < bFront - r || q.x < -DIM.BH - r * 0.8) continue; dz = Math.max(dz, q.z - (bFront - r)); }
          }
          if (dz < 4e-4) break;
          const step = Math.min(dz + 0.001, 0.016 - fm); if (step <= 0) break;
          tgt[i] = tgt[i].clone().add(this.WdK([0, 0, -step])); fm += step;
          sol.ch[i - 1] = fingerArch(hm.fingers[i - 1], side, toLq(ar(tgt[i])), HAND_POLE, 0.7);
        }
        FW[i] = { key: pr.keyId, v: fm }; moved = Math.max(moved, fm);
      }
      this.qa['fwd' + s] = +(moved * 1000).toFixed(1);
    }
    // الإبهام الضاغط: إن مرّت سُلاميته الأخيرة داخل مفتاح أبيض مجاور غير مضغوط، يُنقل موضع لمسه قليلًا
    // نحو طرفه الخارجي وإلى الداخل (كما يلمس العازف المفتاح بجانب طرف الإبهام)، ثم يُعاد حله وحده.
    if (st.digits[0] && organ.keys[st.digits[0].keyId] && !organ.keys[st.digits[0].keyId].black && (st.digits[0].lift ?? 1) < 0.5) {
      const kk = organ.keys[st.digits[0].keyId], nbs = [1, -1, 2, -2].map((d) => organ.keys['k' + (kk.midi + d)]).filter((k) => k && !k.black);
      const Wl = (p) => new THREE.Vector3(...V.add(V.add(V.add(O, V.mul(xv, p[0])), V.mul(yv, p[1])), V.mul(zv, p[2]))).applyMatrix4(kbInv);
      const toLq = (q) => { const d = V.sub(q, O); return [V.dot(d, xv), V.dot(d, yv), V.dot(d, zv)]; };
      const td = tdNow;
      let shift = 0, dir = [td[0], td[1], td[2]];
      // سطح المفتاح المجاور الفعلي (قد يكون عائدًا من ضغطة سابقة، كما في عبور الإبهام تحت اليد في السلم)
      // المفتاح المجاور الذي لا يثبّته إصبع الآن (يُرفع عنه الإصبع المحوري) يُعامَل كأنه عاد للأعلى، فلا يصعد داخل جانب الإبهام
      const firm = new Set(); for (const hs of ['R', 'L']) { const sd = this.state && this.state[hs]; if (sd) for (const x of Object.values(sd.digits)) if (x && x.amt > 0.6 && (x.lift ?? 0) < 0.08) firm.add(x.keyId); }
      for (const x of Object.values(st.digits)) if (x && x.amt > 0.6 && (x.lift ?? 0) < 0.08) firm.add(x.keyId);
      const surfAt = (nb, z) => nb.topX + (DIM.WL + DIM.PIVOT_BACK - z) * Math.sin(nb.ang * (firm.has(nb.id) ? nb.press : 0));
      for (let it = 0; it < 7; it++) {
        let bad = 0, worstNb = null; const wR = cU > 0.02 ? 1.0 : 0.6;     // الإبهام العابر يرقد بجانبه على المفتاح: يُحسب نصف قطره كاملًا
        for (const f of [0, 0.35, 0.6, 0.85]) { const q = Wl(V.lerp(sol.th[2], sol.th[3], f)), r = 0.0065 * (cU > 0.02 ? 1.25 : 1); for (const nb of nbs) if (Math.abs(q.y - nb.y) < nb.wid / 2 + r * wR && q.z < DIM.WL && q.x > surfAt(nb, q.z) - r) { const v = q.x - surfAt(nb, q.z) + r; if (v > bad) { bad = v; worstNb = nb; } } }
        if (bad < 5e-4) break;
        let t0 = tgt[0];
        if (cU > 0.02 && worstNb && shift >= 0.005) { shift += 0.001; dir = V.norm(V.lerp(dir, [0, 0.3, -0.95], 0.5)); }   // ثم يُرفع طرفه أكثر (يضغط بطرفه لا بجانبه)
        else if (cU > 0.02 && worstNb && shift < 0.009) {
          // إبهام عابر: يُبعَد عن المفتاح المجاور المتداخل (أيًا كانت جهته) داخل حدود مفتاحه، ويُسحب قليلًا نحو مقدّمته
          const own = organ.keys[st.digits[0].keyId], cur = new THREE.Vector3().copy(t0).applyMatrix4(kbInv);
          const away = Math.sign(own.y - worstNb.y) || 1, room = own.wid / 2 - 0.0035 - away * (cur.y - own.y);
          const dy = Math.max(0, Math.min(0.0025, room)); shift += 0.0025;
          // إن لم يبقَ مجال جانبي (إبهام عريض) يركب الإبهام فوق حافة المفتاح المجاور العائد بقدر التداخل فقط
          t0 = t0.clone().add(this.WdK([dy < 0.0012 ? -Math.min(bad, 0.0035) : 0, away * dy, -0.002]));
        }
        else if (shift < 0.0075) { shift += 0.0025; t0 = t0.clone().add(this.WdK([0, -side * 0.0025, 0.004])); }
        else if (cU > 0.02) { shift += 0.002; t0 = t0.clone().add(this.WdK([0, 0, -0.003])); }   // إبهام عابر: يُسحب نحو مقدّمة المفتاح لا إلى عمقه
        else dir = V.norm(V.lerp(dir, [0, 0.35, -0.94], 0.45));         // يوجَّه الإبهام أكثر نحو عمق المفتاح فيضغط بطرفه لا بجانبه
        tgt[0] = t0;
        sol.th = thumbChain(hm.thumb, side, toLq(ar(t0)), V.norm([dir[0] * -side, dir[1], dir[2]]), this.thumbPole || [0, 0.6, 0.6]);
      }
      this.qa['thumbShift' + s] = +(shift * 1000).toFixed(1);
    }
    // ---------- الإبهام والأصابع لا تتداخل (أثناء العبور خصوصًا) ----------
    // المسافة بين محاور السُّلاميات ناقص نصفي القطرين المقاسين من شبكة اليد: سالبة = تداخل جلد.
    {
      const toLq = (q) => { const d = V.sub(q, O); return [V.dot(d, xv), V.dot(d, yv), V.dot(d, zv)]; };
      const gapTF = (fingers) => {
        let g = 1, at = null; const T = sol.th, tr = hm.thumb.r;
        for (const i of fingers) { const F = sol.ch[i], rr = hm.fingers[i].r;
          // السُّلاميتان الطرفيتان للإبهام مقابل الوسطى والطرفية للإصبع (قاعدتا الإصبعين متلاصقتان طبيعيًا فلا تُحسبان)
          for (const [a0, a1, ra] of [[V.lerp(T[1], T[2], 0.35), T[2], tr[1]], [T[2], T[3], tr[2]]]) for (let j = 1; j < 3; j++) { const v = segDist(a0, a1, F[j], F[j + 1]) - ra - rr[j]; if (v < g) { g = v; at = i; } } }
        return [g, at];
      };
      const busy = (i) => st.digits[i + 1] && (st.digits[i + 1].lift ?? 1) < 0.5;
      let [g] = gapTF([0, 1, 2]);
      const thumbFree = !st.digits[0] || (st.digits[0].lift ?? 1) > 0.4;      // الإبهام غير ضاغط (معلّق أو منسحب): يُبعَد أيضًا عن الأصابع
      if ((cU > 0.02 || thumbFree) && g < 0) {
        // الإبهام تحت الكف: يُدفع نحو العازف (تحت راحة اليد) ثم يُرفع قليلًا إن لزم
        // يُجرَّب لكل خطوة: أعمق تحت الكف (نحو العازف)، أو أخفض نحو سطح المفاتيح، أو كلاهما — ويُختار الأفضل.
        // الإبهام لا ينزل تحت سطح البيض (+ سُمك اللحم)، والإزاحة الكلية محدودة.
        const th0 = st.digits[0] && organ.keys[st.digits[0].keyId], floorX = -PAD - 0.003;
        const pd = [0, side === -1 ? 0 : 0, 0];
        let moved = 0;
        for (let it = 0; it < 7 && g < 0 && moved < 0.026; it++) {
          const step = Math.min(-g + 0.0008, 0.006, 0.026 - moved);
          const curK = new THREE.Vector3().copy(tgt[0]).applyMatrix4(kbInv);
          const down = Math.max(0, Math.min(step, floorX - curK.x));        // المسافة المتاحة للنزول (x المحلي للأسفل موجب)
          let best = null;
          for (const dv of [[0, 0, -step], [down, 0, 0], [down * 0.7, 0, -step * 0.7]]) {
            if (dv[0] === 0 && dv[2] === 0) continue;
            const cand = tgt[0].clone().add(this.WdK(dv));
            const thc = thumbChain(hm.thumb, side, toLq(ar(cand)), V.norm([tdNow[0] * -side, tdNow[1], tdNow[2]]), this.thumbPole || [0, 0.6, 0.6]);
            const keep = sol.th; sol.th = thc; const [gc] = gapTF([0, 1, 2]); sol.th = keep;
            if (!best || gc > best.g) best = { g: gc, cand, thc };
          }
          if (!best) break;
          moved += step; tgt[0] = best.cand; sol.th = best.thc; g = best.g;
        }
        this.qa['tfMove' + s] = +(moved * 1000).toFixed(1); void th0; void pd;
      }
      if (cO > 0.02) {
        // الإصبع العابر فوق الإبهام: يرتفع قوسه بقدر التداخل
        for (let i = 0; i < 4; i++) {
          const pr = st.digits[i + 1]; if (!pr || pr.cross !== 'over' || (pr.lift ?? 0) < 0.02) continue;
          for (let it = 0; it < 4; it++) { const [gi] = gapTF([i]); if (gi >= 0) break; tgt[i + 1] = tgt[i + 1].clone().add(this.WdK([-(-gi + 0.001), 0, 0])); sol.ch[i] = fingerArch(hm.fingers[i], side, toLq(ar(tgt[i + 1])), HAND_POLE, 0.7); }
        }
      }
      const [gF, atF] = gapTF([0, 1, 2]);
      this.qa['tf' + s] = { mm: +(gF * 1000).toFixed(1), finger: atF == null ? null : atF + 2, busy: atF == null ? null : !!busy(atF) };
    }
    const fr = Frame(O, xv, yv, zv);
    const toL = (q) => { const d = V.sub(q, O); return [V.dot(d, xv), V.dot(d, yv), V.dot(d, zv)]; };
    this['hand' + s + 'Frame'] = fr;
    // المرفق: قريب من الجسم ويتبع اليد على طول اللوحة (حين تبتعد اليد للخارج يبتعد المرفق قليلًا)
    const sh = rig.wp(s, 'upperArm'), lateral = (O[0] - sh.x) * (s === 'R' ? -1 : 1);
    const p = POLE[s], out = clamp(lateral / 0.25, -0.6, 1.2);
    this.poseArm(s, fr, [p[0] * (1 + 0.5 * out), p[1], p[2]]);
    const chains = sol.ch, thumb = sol.th;
    this['lastThumbShort' + s] = thumb.short;
    poseFingers(rig, hm, fr, chains, thumb);
    this[s === 'R' ? 'rTargets' : 'lTargets'] = tgt;
    this._lastT[s] = tgt.map((v) => v.clone()); for (const bl of B) if (bl) bl.t += st.dt || 1 / 60;
    this[s === 'R' ? 'rChains' : 'lChains'] = chains;
  }

  pose(state) {
    this.state = state;
    if (!this.corr) this.initContact();
    this.organ.root.updateMatrixWorld(true);
    this.solveHand('R', state.R);
    this.solveHand('L', state.L);
    this.updateContact();
    this.thumbSkinCheck();
  }
  /** أثناء عبور الإبهام: أعمق دخول لجلد سُلاميتيه الطرفيتين في مفتاح غير مفتاحه، ويُحدَّث منه رفع الإبهام للإطار التالي. */
  thumbSkinCheck() {
    this._tRaise = this._tRaise || { R: 0, L: 0 };
    for (const s of ['R', 'L']) {
      const t = this.state[s].digits[0], c = this.qa['cross' + s];
      if (!t || t.cross !== 'under' || (t.lift ?? 0) > 0.6) { this._tRaise[s] *= 0.85; continue; }
      if (!this._tVerts) this._tVerts = {};
      if (!this._tVerts[s]) { const rig = this.rig; this._tVerts[s] = rig.verts([rig.b(s, 'thumb2'), rig.b(s, 'thumb3')].filter(Boolean), 0.4).filter((_, i) => i % 2 === 0); }
      const own = t.keyId, p = this._p || (this._p = new THREE.Vector3()), inv = this._inv; let worst = 0;
      for (const e of this._tVerts[s]) { this.rig.vertexWorld(e.m, e.i, p); p.applyMatrix4(inv); worst = Math.max(worst, this.keyPenetration(p, own)); }
      this._tRaise[s] = clamp(worst > 0.0006 ? this._tRaise[s] + worst * 0.9 : this._tRaise[s] * 0.9, 0, 0.007);
    }
  }

  // ---------- ملامسة صادقة: الطرف على سطح المفتاح لا فوقه ولا داخله ----------
  // سُمك لحم الطرف تحت مفصل نهايته يختلف بين الأصابع وبزاوية الإصبع (مقوّس على الأبيض، ممتد على الأسود).
  // نقيس بعد كل وضعية أقرب نقطة جلد في السُّلامية الأخيرة إلى سطح المفتاح المضغوط، ونصحّح هدف ذلك الإصبع للإطار التالي.
  initContact() {
    const rig = this.rig;
    this.corr = { R: [], L: [] }; this.tipVerts = { R: [], L: [] }; this.gaps = { R: [], L: [] };
    for (const s of ['R', 'L']) for (let d = 0; d < 5; d++) {
      this.corr[s][d] = [PAD * 0.4, PAD * 0.2];
      const nm = d === 0 ? 'thumb' : ['index', 'middle', 'ring', 'little'][d - 1];
      const b3 = rig.b(s, nm + '3'), b2 = rig.b(s, nm + '2');
      this.tipVerts[s][d] = [...(b3 ? rig.verts([b3], 0.3) : []), ...(b2 ? rig.verts([b2], 0.6) : [])];
    }
  }
  tipGap(s, d, k) {
    const rig = this.rig, p = this._p || (this._p = new THREE.Vector3()), inv = this._inv;
    const armZ0 = (k.black ? DIM.WL - 0.002 : DIM.WL) + DIM.PIVOT_BACK, sinA = Math.sin(k.ang * k.press);
    let gap = Infinity;
    for (const e of this.tipVerts[s][d]) {
      rig.vertexWorld(e.m, e.i, p); p.applyMatrix4(inv);
      if (Math.abs(p.y - k.y) > k.wid / 2 + 0.003) continue;
      gap = Math.min(gap, k.topX + (armZ0 - p.z) * sinA - p.x);
    }
    return gap;
  }
  updateContact() {
    this._inv = this.organ.kb.matrixWorld.clone().invert();
    const want = 0.0006;                                   // فجوة مستهدفة 0.6 مم (تلامس بلا اختراق)
    for (const s of ['R', 'L']) for (const [d, pr] of Object.entries(this.state[s].digits)) {
      if (!pr || (pr.lift ?? 1) > 0.15) continue;
      const k = this.organ.keys[pr.keyId]; if (!k) continue;
      const g = this.tipGap(s, +d, k); this.gaps[s][d] = g;
      if (!isFinite(g)) continue;
      const c = this.corr[s][d], b = k.black ? 1 : 0;
      if (+d === 0 && this._tRaise && this._tRaise[s] > 0.0004) continue;   // الإبهام مرفوع عمدًا عن حافة المفتاح المجاور: لا يُعاد دفعه للأسفل
      // خطوة محدودة لكل إطار (تقارب بلا تذبذب)، وأسرع حين يدخل الجلد في المفتاح فلا يبقى الاختراق ظاهرًا
      c[b] = clamp(c[b] + clamp((want - g) * 0.45, -0.0008, g < -0.0015 ? 0.0028 : 0.0008), -0.016, 0.016);   // خطوة محدودة لكل إطار: تقارب بلا تذبذب
    }
  }

  // ---------- قياسات الجودة ----------
  /** أعمق دخول لجلد اليدين في أي مفتاح (مم) — يراعي ضغط المفتاح الحالي. */
  penetration() {
    const rig = this.rig, organ = this.organ, p = new THREE.Vector3(), out = {};
    const names = ['hand', 'thumb1', 'thumb2', 'thumb3', ...['index', 'middle', 'ring', 'little'].flatMap((f) => [1, 2, 3].map((i) => f + i))];
    const inv = organ.kb.matrixWorld.clone().invert();
    for (const s of ['R', 'L']) {
      const bones = names.map((n) => rig.b(s, n)).filter(Boolean);
      let worst = 0, where = null, n = 0;
      for (const bn of bones) for (const e of rig.verts([bn], 0.35)) {
        rig.vertexWorld(e.m, e.i, p); n++;
        const q = p.clone().applyMatrix4(inv), d = this.keyPenetration(q);
        if (d > worst) { worst = d; where = [bn.name, ...[q.x, q.y, q.z].map((v) => +v.toFixed(3))]; }
      }
      out[s] = { maxMm: +(worst * 1000).toFixed(1), at: where, verts: n };
    }
    return out;
  }
  // عمق نقطة (إطار kb) داخل أقرب مفتاح: الأسود له الأولوية (أعلى)
  keyPenetration(q, skipId = null) {
    if (q.z < -0.004 || q.z > DIM.WL + 0.004) return 0;
    let best = 0;
    for (const k of Object.values(this.organ.keys)) {
      if (k.id === skipId || Math.abs(q.y - k.y) > k.wid / 2) continue;
      const zFront = (k.black ? DIM.WL - 0.002 - DIM.BL : 0);
      if (q.z < zFront || q.z > zFront + k.len) continue;
      // سطح المفتاح الحالي عند هذا العمق (المفتاح مائل بزاوية الضغط حول محوره الخلفي)
      const armZ = (k.black ? DIM.WL - 0.002 : DIM.WL) + DIM.PIVOT_BACK - q.z;
      const surf = k.topX + armZ * Math.sin(k.ang * k.press);
      const d = q.x - surf;
      if (d > 0 && d < k.thick + 0.004) best = Math.max(best, d);
    }
    return best;
  }
  /** فجوة طرف كل إصبع ضاغط عن سطح مفتاحه (مم): أقرب رأس من جلد السُّلامية الأخيرة إلى سطح المفتاح داخل حدوده.
   *  موجبة = الطرف فوق السطح، سالبة = داخل المفتاح. (اسمها مختلف عن contactReport في SeatedPlayer الخاص بالمقعد) */
  fingerContact() {
    const rig = this.rig, organ = this.organ, p = new THREE.Vector3(), inv = organ.kb.matrixWorld.clone().invert(), out = {};
    const tipBone = (s, d) => rig.b(s, d === 0 ? 'thumb3' : ['index', 'middle', 'ring', 'little'][d - 1] + '3');
    for (const s of ['R', 'L']) {
      const res = [];
      for (const [d, pr] of Object.entries(this.state[s].digits)) {
        if (!pr || (pr.amt ?? 0) < 0.95 || (pr.lift ?? 0) > 0.02) continue;
        const k = organ.keys[pr.keyId], bn = tipBone(s, +d); if (!k || !bn) continue;
        const armZ0 = (k.black ? DIM.WL - 0.002 : DIM.WL) + DIM.PIVOT_BACK;
        let gap = Infinity;
        for (const e of rig.verts([bn], 0.5)) {
          rig.vertexWorld(e.m, e.i, p); const q = p.clone().applyMatrix4(inv);
          if (Math.abs(q.y - k.y) > k.wid / 2 + 0.004) continue;
          const surf = k.topX + (armZ0 - q.z) * Math.sin(k.ang * k.press);
          gap = Math.min(gap, surf - q.x);
        }
        res.push({ finger: +d + 1, key: pr.keyId, gapMm: isFinite(gap) ? +(gap * 1000).toFixed(1) : null });
      }
      out[s] = res;
    }
    return out;
  }
}
