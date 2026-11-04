// =====================================================================
//  المايسترو الواقفة — ترث SeatedPlayer المشترك (القياس، IK الذراعين مع تقدّم الترقوة، حركة الرأس)
//  وتستبدل الجلوس بوقفة على المنصة. لا تعدّل أي ملف مشترك ولا شيئًا من لعبة الأكورديون: تستورد فقط.
//
//  مستوى القيادة: مستوى رأسي أمام الصدر، مقاساته تُحسب من طول ذراع النموذج الفعلي:
//    u (يمين/يسار المايسترو) و v (أسفل/أعلى) من patterns.js تتحول إلى نقطة الكف في العالم،
//    ثم يُحسب الرسغ منها ويحلّ IK الذراع. الشخصية تواجه +z، ويمينها في اتجاه −x.
// =====================================================================
import * as THREE from 'three';
import { SeatedPlayer } from '../_shared/3d/character/seated-player.js';
import { V, F } from '../_shared/3d/engine/math.js';
import { FINGERS, fingerFK, thumbChain, poseFingers, handFrameNow } from '../_shared/3d/character/hand.js';

const ar = (v) => [v.x, v.y, v.z];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// أصابع مسترخية مقوّسة قليلًا (يد قيادة بلا عصا): [فرد جانبي، المفصل الأول، الثاني، الثالث]
const RELAX = { index: [0.04, 0.1, 0.16, 0.1], middle: [0, 0.14, 0.22, 0.13], ring: [-0.04, 0.19, 0.28, 0.17], little: [-0.1, 0.25, 0.33, 0.2] };
const HANG = { index: [0.03, 0.18, 0.3, 0.2], middle: [0, 0.24, 0.36, 0.22], ring: [-0.04, 0.3, 0.42, 0.26], little: [-0.1, 0.36, 0.48, 0.28] };

export class Conductor extends SeatedPlayer {
  constructor(rig, config = {}) { super(rig, config); this.podiumH = config.podiumH || 0; }

  setup() {
    this.baseSetup();                  // normalize + captureRest + dominance + measure + posture (الوقوف أدناه)
    this.calibrate();
    this.cur = { R: null, L: null };
    this.pose({ R: { rest: true }, L: { rest: true } }, 1);
  }

  // ---------- الوقوف: وضعية الراحة الأصلية للساقين، القدمان على سطح المنصة ----------
  posture() {
    const rig = this.rig, root = rig.root;
    rig.resetToRest();
    root.updateMatrixWorld(true);
    const mid = rig.wp('L', 'upperLeg').add(rig.wp('R', 'upperLeg')).multiplyScalar(0.5);
    root.position.x -= mid.x; root.position.z -= mid.z; root.updateMatrixWorld(true);
    const p = new THREE.Vector3(); let fy = Infinity;
    for (const s of ['L', 'R']) for (const e of rig.verts([rig.b(s, 'foot'), rig.b(s, 'toes')], 0.4)) { rig.vertexWorld(e.m, e.i, p); fy = Math.min(fy, p.y); }
    if (isFinite(fy)) { root.position.y += this.podiumH - fy; root.updateMatrixWorld(true); }
    this.knee = { L: ar(rig.wp('L', 'lowerLeg')), R: ar(rig.wp('R', 'lowerLeg')) };
    // قياس ملامسة الأرض للاختبار
    fy = Infinity; for (const s of ['L', 'R']) for (const e of rig.verts([rig.b(s, 'foot'), rig.b(s, 'toes')], 0.4)) { rig.vertexWorld(e.m, e.i, p); fy = Math.min(fy, p.y); }
    this.qa.floorGapMm = +((fy - this.podiumH) * 1000).toFixed(1);
  }
  seatMinY() { return Infinity; }
  contactReport() { return { floorGapMm: this.qa.floorGapMm }; }

  // ---------- مستوى القيادة من مقاسات الجسم ----------
  calibrate() {
    const rig = this.rig, P = (s, k) => ar(rig.wp(s, k));
    const sR = P('R', 'upperArm'), sL = P('L', 'upperArm');
    const L = (this.len.R.upper + this.len.R.fore + this.len.L.upper + this.len.L.fore) / 2;
    const wr = P('R', 'hand'), m1 = P('R', 'middle1');
    this.palmOff = V.dist(wr, m1) * 0.55;                 // من الرسغ إلى منتصف الكف
    this.armLen = L;
    const midSh = V.mul(V.add(sR, sL), 0.5);
    this.plane = {
      cx: sR[0] * 0.5,                                     // مركز نمط اليد اليمنى: أمام الجانب الأيمن من الصدر (x سالب)
      y0: midSh[1] - 0.58 * L,                             // مستوى الإكتوس (قرب أسفل الصدر)
      H: 0.82 * L,                                         // ارتفاع v=1
      W: 0.5 * L,                                         // عرض u=1
      z0: midSh[2] + 0.74 * L,                             // بُعد المستوى أمام الكتفين
    };
    this.shoulder = { R: sR, L: sL };
    this.qa.plane = Object.fromEntries(Object.entries(this.plane).map(([k, v]) => [k, +v.toFixed(3)]));
  }

  /** نقطة الكف في العالم لموضع (u,v) في مستوى القيادة. side: اليد المنفِّذة؛ اليسرى تؤدي صورة مرآة (u يُعكس حول خط الجسم) */
  palmPoint(u, v, side = 'R') {
    const pl = this.plane, sg = side === 'R' ? 1 : -1;      // يمين المايسترو = −x
    const x = sg * (pl.cx - u * pl.W);
    const y = pl.y0 + v * pl.H;
    const z = pl.z0 + 0.05 * (0.35 - v) - 0.03 * Math.abs(u);    // الإكتوس أقرب للأمام قليلًا، والأطراف تنحني مع قوس الذراع
    return [x, y, z];
  }

  // إطار يد القيادة: الأصابع إلى الأمام مائلة قليلًا للداخل وللأسفل، وظهر اليد إلى الأعلى (الكف نحو الأرض) مع ميل خفيف للخارج.
  // flex: ثني الرسغ مع السرعة الرأسية (تتأخر الأصابع قليلًا عن اتجاه الحركة ثم تلحقه بعد الإكتوس).
  conductFrame(side, palm, du = 0, dv = 0) {
    const sgIn = side === 'R' ? 1 : -1;                     // الداخل لليمنى = +x
    const flex = clamp(dv * 0.06, -0.22, 0.22), yaw = clamp(-du * 0.03 * (side === 'R' ? 1 : -1), -0.12, 0.12);
    let y = V.norm([0.3 * sgIn + yaw, -0.08 + flex, 1]);
    const zHint = [-0.3 * sgIn, 1, 0.15];
    const fr = F.fromYZ([0, 0, 0], y, zHint);
    fr.o = V.madd(palm, fr.y, -this.palmOff);
    return fr;
  }

  // اليد في الراحة: الذراع منسدلة بجانب الجسم مع ثني خفيف للمرفق
  restFrame(side) {
    const sh = this.shoulder[side], sg = side === 'L' ? 1 : -1, L = this.armLen;
    const wr = [sh[0] + sg * 0.035, sh[1] - 0.9 * L, sh[2] + 0.07];
    return F.fromYZ(wr, [0.02 * sg, -1, 0.12], [sg, 0, 0.1]);
  }

  /**
   * state: { R: {u,v,du,dv} | {rest:true}, L: … }. blend: 0..1 نحو الهدف (1 = فوري) لانتقالات ناعمة بين الوضعيات.
   */
  pose(state, blend = 1) {
    for (const s of ['R', 'L']) {
      const st = state[s] || { rest: true };
      let fr;
      if (st.rest) fr = this.restFrame(s);
      else fr = this.conductFrame(s, this.palmPoint(st.u, st.v, s), st.du, st.dv);
      const prev = this.cur[s];
      if (prev && blend < 1) {
        const y = V.norm(V.lerp(prev.y, fr.y, blend)), z = V.lerp(prev.z, fr.z, blend);
        fr = F.fromYZ(V.lerp(prev.o, fr.o, blend), y, z);
      }
      this.cur[s] = fr;
      const sg = s === 'L' ? 1 : -1;
      const pole = st.rest ? [sg * 0.1, 0.05, -1] : [sg * 0.55, -0.55, -0.35];
      this.poseArm(s, fr, pole);
      this.poseHand(s, st.rest ? HANG : RELAX);
    }
    this.rig.root.updateMatrixWorld(true);
  }

  poseHand(s, angles) {
    const hm = this.hand[s], side = hm.s, fr = this.cur[s];
    const chains = FINGERS.map((f) => fingerFK(hm.fingers[FINGERS.indexOf(f)], side, angles[f]).pts);
    const th = hm.thumb, H = (v) => [v[0] * side, v[1], v[2]], k = hm.size;
    const base = H(th.cmc);
    const tip = [base[0] + side * 0.012 * k, base[1] + 0.052 * k, base[2] - 0.028 * k];
    const thumb = thumbChain(th, side, tip, V.norm([-side * 0.2, 0.2, -0.5]), [0, 0.6, 0.6]);
    poseFingers(this.rig, hm, fr, chains, thumb);
  }

  /** نقطة الكف الفعلية بعد الوضعية (للأثر المرسوم وللاختبار) */
  palmNow(s) { const f = this.cur[s]; return f ? V.madd(f.o, f.y, this.palmOff) : null; }
  /** نقطة الكف كما وضعها الهيكل العظمي فعلًا بعد IK (للتحقق من وصول اليد إلى الهدف) */
  palmActual(s) { const f = handFrameNow(this.rig, s); return V.madd(f.o, f.y, this.palmOff); }
}
