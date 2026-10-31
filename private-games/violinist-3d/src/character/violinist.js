// =====================================================================
//  العازفة: تحويل نموذج بشري مُجهّز بهيكل عظمي (GLB) إلى عازفة كمان جالسة.
//  - الجلوس في مقدمة الكرسي، القدمان على الأرض، الظهر مستقيم.
//  - الكمان على الترقوة اليسرى (مع مسند كتف)، والفك الأيسر على مسند الذقن.
//  - القوس على وتر لا (A) موازيًا للفرس، وقبضة القوس الكلاسيكية باليد اليمنى.
//  - اليد اليسرى في الوضع الأول: أصابع مقوّسة، والضغط بأطراف الأصابع.
//
//  كل قياسات التلامس مأخوذة من سطح الشبكة الحقيقي (الجلد والملابس) بعد التشكيل،
//  لا من أشكال تقريبية؛ لذلك تعمل الحلول على أي نموذج يطابق المواصفات في docs/MODEL_SPEC.md.
// =====================================================================
import * as THREE from 'three';
import { V, Frame, F, ik2, smooth } from '../engine/math.js';
import { VN, violinOutline } from '../instruments/violin.js';
import { BOW } from '../instruments/bow.js';
import { stopLength } from '../teaching/exercise.js';
import { FINGERS, measureHand, fingerFK, fingerIK, fingerArch, thumbChain, handFromBow, poseHandRotation, poseFingers, handFrameNow } from './hand.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const ar = (v) => [v.x, v.y, v.z];
const UP = [0, 1, 0], FWD = [0, 0, 1];

const LPOLE = (() => { const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lpole') : null; return q ? q.split(',').map(Number) : [0, 1, 0.6]; })();
const QP = (k, d) => { const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get(k) : null; return q ? q.split(',').map(Number) : d; };
const PKPOLE = QP('pkpole', [0, 1, 0.7]), PKRATIO = QP('pkr', [0.8])[0], PKFRAC = QP('pkf', [0.7])[0], PKUP = QP('pkup', [0.011])[0], PKSIDE = QP('pkside', [0])[0], DIPADD = QP('dip', [0.35])[0];
const LWANT = QP('lwant', [0.8])[0];
const RPOLE = QP('rpole', [-0.55, -0.06, -0.02]);   // اتجاه كوع اليد اليمنى (قطب IK) بالنسبة للكتف
const CLAVMAX = QP('clavmax', [0.5])[0];   // أقصى تقدّم للترقوة (راديان) لبلوغ طرف القوس على وتر صول
const LEPOLE = QP('lepole', [-0.12, -0.55, 0.12]);   // اتجاه كوع اليد اليسرى (قطب IK) بالنسبة للكتف
const LHROT = QP('lhrot', [0.3, -0.2, 0.4]);   // دوران اليد اليسرى حول محاورها (Y ثم Z ثم X) عند وضعها على الرقبة
const SIDX = QP('sidx', [0.3, 0.5, 1.1, 0.7]), SMID = QP('smid', [0.02, 0.8, 1.3, 0.8]), SRING = QP('sring', [-0.09, 1.0, 1.4, 0.8]);   // أشكال أصابع القبضة (فتح، MCP، PIP، DIP)
const CT = QP('ct', [0.5, 0.7, 0.8]);   // موضع التلامس على السلامية الوسطى (0 عند PIP، 1 عند DIP)
const PKFK = QP('pkfk', [0.3, 1.1, 0.9, 0.6]);   // اختياري: زوايا الخنصر (فتح، MCP، PIP، DIP) لانحناء دائري ناعم
const LTH = QP('lth', [0.26, -0.02, 1.0]), LTP = QP('ltp', [0.1, 0.9, -0.4]), LTQ = QP('ltq', [0.3, -0.9, 0.9]);   // هدف إبهام اليد اليسرى (طول، ارتفاع، عمق) واتجاه الكوع
const HROLL = QP('hroll', [0.4])[0];   // ميل اليد حول محور العصا (راديان)
const GRIPFWD = QP('ygo', [0])[0];   // م: تقدّم اليد اليمنى على القوس نحو الرأس (يعطي الخنصر مدى كافيًا)
const CLOTH = 0.008;   // سماكة طرحة + شعر بين الجلد ومسند الذقن
const PKLAT = QP('pklat', [60])[0] * Math.PI / 180;   // أقصى فتح جانبي لجذر الخنصر عن مستوى الانثناء
const PKBACK = QP('pkb', [0.008])[0];   // أقصى تقدّم لطرف الخنصر أمام قاعدته على محور العصا (م)
const LEGSPLAY = QP('splay', [1.25])[0];
const TORSO_YAW = +((typeof location !== 'undefined' && new URLSearchParams(location.search).get('tyaw')) ?? 0.14);
export const SEAT = { y: 0.45, zFront: 0.16, zBack: -0.26, halfW: 0.22 };

// زوايا الكمان (كما في النموذج الأصلي): الرأس الحلزوني إلى الأمام واليسار، شبه أفقي، مائل نحو جهة القوس
const VB = { vAz: 55 * Math.PI / 180, vEl: 6 * Math.PI / 180, vTilt: 26 * Math.PI / 180 };
function violinAxes(az = VB.vAz, el = VB.vEl, tilt = VB.vTilt) {
  const y = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  const z0 = V.norm(V.perp([0, 1, 0], y)), x0 = V.cross(y, z0);
  const z = V.norm(V.add(V.mul(z0, Math.cos(tilt)), V.mul(x0, Math.sin(tilt))));
  return [V.cross(y, z), y, z];
}
// نقطة ارتكاز مسند الكتف على الترقوة (إحداثيات الكمان) بدلالة معامل ارتفاعه srK
const srBottom = (k = 1) => [0, -0.108, -VN.ribs - 0.027 * k];
const SR_BOTTOM = srBottom(1);
const CHIN_TOP = [VN.chinrestTop[0], VN.chinrestTop[1], 0.0335];
// إطار الكمان الافتراضي حين لا يوجد نموذج (مطابق للأصل تقريبًا)
export function defaultViolinFrame() {
  const [x, y, z] = violinAxes();
  const R0 = Frame([0, 0, 0], x, y, z);
  return Frame(V.sub([0.09, 1.1, 0.04], F.dir(R0, [0, -0.108, -0.058])), x, y, z);
}

// نصف عرض جسم الكمان عند ارتفاع y (من المخطط الحقيقي)
const HALFW = (() => {
  const o = violinOutline(), tbl = [];
  for (let k = 0; k <= 60; k++) {
    const y = -0.161 + 0.356 * k / 60; let w = 0;
    for (const p of o) if (Math.abs(p[1] - y) < 0.006) w = Math.max(w, Math.abs(p[0]));
    tbl.push(w);
  }
  return (y) => { const k = Math.round((y + 0.161) / 0.356 * 60); return k < 0 || k > 60 ? 0 : tbl[k]; };
})();

const STR_R = [0.00048, 0.00042, 0.00036, 0.00026];       // أنصاف أقطار الأوتار G D A E
// نقطة على الوتر s (رقم عشري = بين وترين أثناء عبور الوتر) عند المسافة y من الفرس
const strAt = (s, y) => {
  const a = Math.max(0, Math.min(3, Math.floor(s))), b = Math.min(3, a + 1), t = s - a, A = VN.stringAt(a, y);
  return t < 1e-6 ? A : V.lerp(A, VN.stringAt(b, y), t);
};

export class Violinist {
  constructor(rig, config = {}) {
    this.rig = rig; this.cfg = config;
    this.qa = {};
  }

  // ------------------------------------------------------------------
  setup() {
    const rig = this.rig;
    rig.normalize(this.cfg.height || 1.6);
    rig.captureRest();
    rig.buildDominance();
    this.measure();
    this.posture();
    this.solveHold();
    this.placeLeftHand();
    this.refineBowHold();
    this.pose0 = this.pose(0, false);
    return this.pose0;
  }

  // ---------- القياسات ----------
  measure() {
    const rig = this.rig, P = (s, k) => ar(rig.wp(s, k));
    this.len = {};
    for (const s of ['L', 'R']) {
      this.len[s] = {
        upper: V.dist(P(s, 'upperArm'), P(s, 'lowerArm')), fore: V.dist(P(s, 'lowerArm'), P(s, 'hand')),
        thigh: V.dist(P(s, 'upperLeg'), P(s, 'lowerLeg')), shin: V.dist(P(s, 'lowerLeg'), P(s, 'foot')),
      };
    }
    this.hand = { L: measureHand(rig, 'L'), R: measureHand(rig, 'R') };
    // محاور التوجيه: الذراع (الوجه الأمامي للعضد = جهة الانثناء)، الساعد (يتبع ظهر اليد)، الساقان
    for (const s of ['L', 'R']) {
      const B = (k) => rig.b(s, k);
      rig.setAimAxes(B('upperArm'), v3(V.sub(P(s, 'lowerArm'), P(s, 'upperArm'))), v3(FWD));
      rig.setAimAxes(B('lowerArm'), v3(V.sub(P(s, 'hand'), P(s, 'lowerArm'))), v3(this.hand[s].restFrame.z));
      rig.setAimAxes(B('upperLeg'), v3(V.sub(P(s, 'lowerLeg'), P(s, 'upperLeg'))), v3(FWD));
      rig.setAimAxes(B('lowerLeg'), v3(V.sub(P(s, 'foot'), P(s, 'lowerLeg'))), v3(FWD));
      const toe = B('toes') ? P(s, 'toes') : V.add(P(s, 'foot'), [0, -0.05, 0.12]);
      this.len[s].footDir = V.norm(V.sub(toe, P(s, 'foot')));
      rig.setAimAxes(B('foot'), v3(this.len[s].footDir), v3(UP));
      // ارتفاع الكاحل عن الأرض في وضعية الراحة (الأرض = أخفض نقطة في الشبكة)
      this.len[s].ankleH = P(s, 'foot')[1];
      if (B('shoulder')) {
        rig.setAimAxes(B('shoulder'), v3(V.sub(P(s, 'upperArm'), P(s, 'shoulder'))), v3(FWD));
        this.len[s].clav = V.dist(P(s, 'upperArm'), P(s, 'shoulder'));
      }
    }
    this.headH = V.dist(P('C', 'neck'), P('C', 'head'));
  }

  // ---------- الجلوس ----------
  posture() {
    const rig = this.rig, root = rig.root;
    const hipsY0 = 0.535 * (this.rig.height / 1.72);
    const placeHips = (y) => {
      const mid = rig.wp('L', 'upperLeg').add(rig.wp('R', 'upperLeg')).multiplyScalar(0.5);
      root.position.x += -mid.x; root.position.y += y - mid.y; root.position.z += 0.05 - mid.z;
      root.updateMatrixWorld(true);
    };
    rig.resetToRest();
    // ميل خفيف للجذع إلى الأمام (ظهر مستقيم غير متصلّب)
    const sp = rig.b('C', 'spine');
    if (sp) rig.setWorldQuaternion(sp, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.035).multiply(rig.worldQ(sp)));
    // التفاتة خفيفة للجذع نحو اليسار (كما يفعل العازف): تقرّب الكتف الأيمن من الكمان فلا تمتد الذراع اليمنى كاملة عند رأس القوس
    if (sp) rig.setWorldQuaternion(sp, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), TORSO_YAW).multiply(rig.worldQ(sp)));
    placeHips(Math.max(SEAT.y + 0.06, hipsY0));
    this.ankleLift = { L: 0, R: 0 };
    const p = new THREE.Vector3();
    for (let it = 0; it < 6; it++) {
      // ملامسة المقعد: أخفض نقطة في الأرداف = سطح المقعد
      this.poseLegs();
      const minY = this.seatMinY();
      if (isFinite(minY)) { root.position.y += SEAT.y + 0.002 - minY; root.updateMatrixWorld(true); }
      // ملامسة الأرض: أخفض نقطة في القدم/الحذاء = الأرض
      this.poseLegs();
      for (const s of ['L', 'R']) {
        const fv = rig.verts([rig.b(s, 'foot'), rig.b(s, 'toes')], 0.4);
        let fy = Infinity;
        for (let k = 0; k < fv.length; k += 2) { rig.vertexWorld(fv[k].m, fv[k].i, p); fy = Math.min(fy, p.y); }
        if (isFinite(fy)) this.ankleLift[s] -= fy - 0.001;
      }
    }
    this.poseLegs();
    this.qa.seat = this.contactReport();
  }

  poseLegs() {
    const rig = this.rig;
    this.knee = {};
    for (const s of ['L', 'R']) {
      const sg = s === 'L' ? 1 : -1, Ln = this.len[s];
      const hip = ar(rig.wp(s, 'upperLeg'));
      const ank = [hip[0] * LEGSPLAY + sg * 0.01, Ln.ankleH + this.ankleLift[s], hip[2] + Ln.thigh * 0.9 + (s === 'L' ? 0.09 : 0.03)];
      // إن كانت الساق أقصر من المسافة نُقرّب القدم (لا ترتفع عن الأرض)
      const reach = Ln.thigh + Ln.shin - 0.004, d = V.dist(hip, ank);
      if (d > reach) { const dz = Math.sqrt(Math.max(0, reach * reach - (hip[1] - ank[1]) ** 2 - (ank[0] - hip[0]) ** 2)); ank[2] = hip[2] + dz; }
      const knee = ik2(hip, ank, Ln.thigh, Ln.shin, V.add(hip, [sg * 0.04, 0.6, 1]));
      this.knee[s] = knee;
      const thighD = V.norm(V.sub(knee, hip)), shinD = V.norm(V.sub(ank, knee));
      rig.aim(rig.b(s, 'upperLeg'), v3(thighD), v3(V.mul(V.perp(shinD, thighD), -1)));
      rig.aim(rig.b(s, 'lowerLeg'), v3(shinD), v3(V.perp(thighD, shinD)));
      const fd = Ln.footDir, yaw = sg * 0.12;
      const fdir = [fd[0] * Math.cos(yaw) + fd[2] * Math.sin(yaw), fd[1], -fd[0] * Math.sin(yaw) + fd[2] * Math.cos(yaw)];
      rig.aim(rig.b(s, 'foot'), v3(fdir), v3(UP));
    }
  }

  // أخفض نقطة من سطح الأرداف قرب مفصلي الوركين. نقيّد البحث بنصف قطر حول المفصلين حتى لا تُحسب
  // أطراف الثوب الطويل (الدشداشة) المتدلية على أنها نقطة جلوس.
  seatMinY() {
    const rig = this.rig, p = new THREE.Vector3();
    const jL = ar(rig.wp('L', 'upperLeg')), jR = ar(rig.wp('R', 'upperLeg'));
    const rad = 0.16 * (rig.height / 1.6);
    if (!this._seatVerts) this._seatVerts = rig.verts([rig.b('C', 'hips'), rig.b('L', 'upperLeg'), rig.b('R', 'upperLeg')], 0.3);
    let minY = Infinity;
    for (let k = 0; k < this._seatVerts.length; k += 2) {
      const e = this._seatVerts[k];
      rig.vertexWorld(e.m, e.i, p);
      const q = ar(p);
      if (q[1] > jL[1]) continue;
      if (Math.min(V.dist(q, jL), V.dist(q, jR)) > rad) continue;
      if (q[2] > SEAT.zFront - 0.02 || q[2] < SEAT.zBack || Math.abs(q[0]) > SEAT.halfW) continue;
      minY = Math.min(minY, q[1]);
    }
    return minY;
  }

  contactReport() {
    const rig = this.rig, p = new THREE.Vector3();
    let floor = Infinity;
    const seat = this.seatMinY() - SEAT.y;
    for (const s of ['L', 'R']) for (const e of rig.verts([rig.b(s, 'foot'), rig.b(s, 'toes')], 0.4)) { rig.vertexWorld(e.m, e.i, p); floor = Math.min(floor, p.y); }
    return { seatGapMm: +(seat * 1000).toFixed(1), floorGapMm: +(floor * 1000).toFixed(1) };
  }

  // ---------- الرأس والكمان ----------
  applyHead(yaw, pitch, roll) {
    const rig = this.rig, neck = rig.b('C', 'neck'), head = rig.b('C', 'head');
    if (!this.headBase) { this.headBase = { neck: rig.worldQ(neck), head: rig.worldQ(head) }; }
    const e = (k) => new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * k, yaw * k, roll * k, 'YXZ'));
    rig.setWorldQuaternion(neck, e(0.45).multiply(this.headBase.neck.clone()));
    rig.setWorldQuaternion(head, e(1).multiply(this.headBase.head.clone()));
  }

  solveHold() {
    const rig = this.rig, p = new THREE.Vector3(), k = rig.height / 1.6;
    this.applyHead(0, 0, 0);
    const neckP = ar(rig.wp('C', 'neck')), shL = ar(rig.wp('L', 'upperArm')), headP = ar(rig.wp('C', 'head'));
    // (1) سطح الكتف الأيسر الفعلي (جلد أو قماش): خريطة ارتفاعات حول منتصف الترقوة
    const yMax = neckP[1] + 0.01;                 // نستبعد الشعر وأطراف غطاء الرأس المتدلية فوق قاعدة الرقبة
    const shoulderPts = [];
    for (const e of rig.verts([rig.b('L', 'shoulder'), rig.b('C', 'upperChest'), rig.b('C', 'chest'), rig.b('C', 'neck'), rig.b('L', 'upperArm')], 0.3)) {
      rig.vertexWorld(e.m, e.i, p);
      if (p.y < yMax) shoulderPts.push(ar(p));
    }
    const P0 = V.add(V.lerp(neckP, shL, 0.5), [0, 0, 0.015]);
    const contacts = [];
    for (let dx = -0.024; dx <= 0.0241; dx += 0.012) for (let dz = -0.024; dz <= 0.0241; dz += 0.012) {
      const cx = P0[0] + dx * k, cz = P0[2] + dz * k;
      let top = -Infinity;
      for (const q of shoulderPts) if (Math.hypot(q[0] - cx, q[2] - cz) < 0.012 * k && q[1] > top) top = q[1];
      if (isFinite(top)) contacts.push({ c: [cx, top, cz], off: Math.hypot(dx, dz) });
    }
    if (!contacts.length) contacts.push({ c: V.add(P0, [0, 0.05, 0]), off: 0 });
    // (2) منطقة الفك الأيسر: الرأس الأبعد في اتجاه (يسار، أسفل) ضمن عظمة الرأس — لا مقدمة الذقن ولا الشعر/القبعات
    const dJ = V.norm([0.8, -0.6, 0.0]);                         // الحافة السفلية للفك الأيسر
    let jaw = null, best = -Infinity;
    for (const e of rig.verts([rig.b('C', 'head')], 0.5)) {
      if (e.m.name && e.m.name.startsWith('Outfit_')) continue;   // الفك = جلد الوجه؛ القماش (11 مم) هو الذي يلمس مسند الذقن
      rig.vertexWorld(e.m, e.i, p);
      const q = ar(p);
      // شريط جانب الفك: يسار مركز الرأس، بين مفصل الرأس ومقدمة الذقن، وتحت مستوى المفصل
      if (q[0] < headP[0] + 0.025 * k || q[1] > headP[1] || q[2] < headP[2] - 0.005 * k || q[2] > headP[2] + 0.065 * k) continue;
      const sc = V.dot(V.sub(q, headP), dJ);
      if (sc > best) { best = sc; jaw = e; }
    }
    if (!jaw) throw new Error('تعذّر تحديد منطقة الفك في النموذج');
    this.jawVert = jaw;
    const jawW = () => ar(rig.vertexWorld(jaw.m, jaw.i, p));
    // (3) وضعيات الرأس الممكنة (التفات، انحناء، ميل) → موضع الفك
    const heads = [];
    for (let yw = 0.15; yw <= 1.151; yw += 0.07) for (let pt = 0.0; pt <= 0.521; pt += 0.065) for (let rl = -0.32; rl <= 0.081; rl += 0.08) {
      this.applyHead(yw, pt, rl);
      heads.push({ yaw: yw, pitch: pt, roll: rl, j: jawW(), c: 0.6 * ((yw - 0.5) ** 2 + (pt - 0.22) ** 2 + 1.5 * (rl + 0.1) ** 2) });
    }
    // (4) بحث مشترك: نقطة الارتكاز على الكتف × زوايا الكمان × ارتفاع مسند الكتف × وضعية الرأس.
    //     الشروط: الفك على مسند الذقن، ومسند الكتف على الكتف، ولا تداخل بين الجذع والكمان،
    //     وبأقل ابتعاد عن الوضعية المريحة.
    const torso = this.torsoPoints();
    let bestC = Infinity, bestSol = null;
    for (const ct of contacts) for (let az = 30; az <= 66; az += 3) for (let el = 0; el <= 16; el += 4) for (let tl = 18; tl <= 34; tl += 4) for (let sk = 0.6; sk <= 1.51; sk += 0.15) {
      const [x, y, z] = violinAxes(az * Math.PI / 180, el * Math.PI / 180, tl * Math.PI / 180), R0 = Frame([0, 0, 0], x, y, z);
      const o = V.sub(ct.c, F.dir(R0, srBottom(sk)));
      const vf = Frame(o, x, y, z), t = F.pt(vf, CHIN_TOP);
      const vc = 0.0006 * ((az - 50) ** 2 + (el - 6) ** 2 * 1.5 + (tl - 26) ** 2) + 0.4 * (sk - 1) ** 2 + 400 * ct.off * ct.off;
      if (vc >= bestC) continue;
      // نسمح بانضغاط القماش حتى 3 مم (مثل ثوب يلامس ظهر الكمان)، وما زاد يُعاقَب بشدة
      const pen = Math.max(0, this.penetrationOf(torso, vf) - 0.003);
      const base = vc + 1e4 * pen * pen;
      if (base >= bestC) continue;
      for (const h of heads) {
        const dx = h.j[0] - t[0], dy = h.j[1] - t[1], dz = h.j[2] - t[2];
        const dd = Math.max(0, Math.hypot(dx, dy, dz) - CLOTH), c = base + h.c + 1e4 * dd * dd;   // بين جلد الفك ومسند الذقن طبقة قماش
        if (c < bestC) { bestC = c; bestSol = { h, vf, az, el, tl, sk, ct, t }; }
      }
    }
    const { h: H, ct } = bestSol;
    let vf = bestSol.vf;
    this.applyHead(H.yaw, H.pitch, H.roll);
    // الفجوة المتبقية الصغيرة: نُزيح الكمان على طوله وعرضه فقط (لا نحو الجسم)
    let gap = V.sub(jawW(), F.pt(vf, CHIN_TOP));
    { const gl = V.len ? V.len(gap) : Math.hypot(...gap); if (gl > CLOTH) gap = V.scale ? V.scale(gap, (gl - CLOTH) / gl) : gap.map((v) => v * (gl - CLOTH) / gl); else gap = [0, 0, 0]; }
    vf = Frame(V.add(vf.o, V.perp(gap, vf.z)), vf.x, vf.y, vf.z);
    for (let it = 0; it < 3; it++) {
      const push = this.penetrationOf(torso, vf) - 0.003;
      if (push <= 0.0005) break;
      vf = Frame(V.madd(vf.o, vf.z, push), vf.x, vf.y, vf.z);
    }
    this.head = { yaw: H.yaw, pitch: H.pitch, roll: H.roll };
    this.jawRestW = jawW();                                       // مرجع لإبقاء الفك على مسند الذقن أثناء حركات الرأس الدقيقة
    this.vf = vf; this.srK = bestSol.sk; this.collar = ct.c;
    this.qa.hold = {
      jawToChinrestMm: +(V.dist(jawW(), F.pt(vf, CHIN_TOP)) * 1000).toFixed(1),
      shoulderRestToCollarMm: +(V.dist(F.pt(vf, srBottom(bestSol.sk)), ct.c) * 1000).toFixed(1),
      bodyIntoViolinMm: +(this.penetrationOf(torso, vf) * 1000).toFixed(1),
      shoulderRestHeight: +bestSol.sk.toFixed(2),
      headYawDeg: +(H.yaw * 180 / Math.PI).toFixed(0), headPitchDeg: +(H.pitch * 180 / Math.PI).toFixed(0), headRollDeg: +(H.roll * 180 / Math.PI).toFixed(0),
      violinAzElTiltDeg: [bestSol.az, bestSol.el, bestSol.tl],
    };
  }

  // نقاط يمكن للعازفة أن تنظر إليها (إحداثيات العالم): مكان الإصبع الحالي على الوتر، الرأس الحلزوني، نقطة تماس القوس
  gazePoints(st) {
    const vf = this.vf, e = st && st.event;
    const sF = st ? st.sFinger : 2;
    const y = e && e.finger > 0 ? e.y : 0.2;
    const lift = (p) => F.pt(vf, V.add(p, [0, 0, 0.012]));
    return { finger: lift(strAt(sF, y)), scroll: lift(strAt(2, 0.37)), bow: this.bowContact ? this.bowContact.slice() : lift(strAt(2, 0.03)) };
  }

  // نقاط الجذع (بلا رقبة ورأس؛ فهما يلامسان مسند الذقن طبيعيًا)
  torsoPoints() {
    const rig = this.rig, p = new THREE.Vector3(), out = [];
    const vs = rig.verts(['hips', 'spine', 'chest', 'upperChest'].map((k) => rig.b('C', k)).concat([rig.b('L', 'shoulder'), rig.b('R', 'shoulder')]), 0.3);
    for (let k = 0; k < vs.length; k += 2) { rig.vertexWorld(vs[k].m, vs[k].i, p); if (p.y > 0.75) out.push(ar(p)); }
    return out;
  }
  // أقصى عمق تدخل فيه نقاط الجذع داخل جسم الكمان (بالمتر)
  penetrationOf(pts, vf) {
    const zBack = -VN.ribs - VN.archBack, zTop = VN.archTop;
    let depth = 0;
    for (const q of pts) {
      const dx = q[0] - vf.o[0], dy = q[1] - vf.o[1], dz = q[2] - vf.o[2];
      const lz = dx * vf.z[0] + dy * vf.z[1] + dz * vf.z[2];
      if (lz < zBack || lz > zTop || lz - zBack <= depth) continue;
      const ly = dx * vf.y[0] + dy * vf.y[1] + dz * vf.y[2];
      if (ly < -0.16 || ly > 0.19) continue;
      const lx = dx * vf.x[0] + dy * vf.x[1] + dz * vf.x[2];
      if (Math.abs(lx) > HALFW(ly) * 0.97) continue;
      depth = lz - zBack;
    }
    return depth;
  }
  violinBodyPenetration(vf) { return this.penetrationOf(this._torsoPts || (this._torsoPts = this.torsoPoints()), vf); }

  // ---------- قبضة القوس (في إحداثيات اليد اليمنى) ----------
  // adj: تصحيحات بالمتر تُستخرج من قياس الشبكة الفعلية (refineBowHold) لإلغاء الاختراق أو الفراغ
  bowHold(adj = { idx: 0, mid: 0, ring: 0, thumb: 0, pinky: 0 }) {
    const hm = this.hand.R, side = -1, HR = (v) => [v[0] * side, v[1], v[2]];
    const rStick = 0.0047;
    // أشكال أصابع مستديرة ومسترخية (زوايا: فتح جانبي، MCP، PIP، DIP). نحدّد الشكل أولًا ثم نضع العصا عليه،
    // بدل ضبط انحناء كل إصبع ليلاقي عصا موضوعة مسبقًا (كان يترك السبابة والبنصر شبه مستقيمتين وتبرز السبابة كمن يشير).
    const sets = { idx: [SIDX[0], SIDX[1], SIDX[2], SIDX[3] + DIPADD], mid: [SMID[0], SMID[1], SMID[2], SMID[3] + DIPADD], ring: [SRING[0], SRING[1], SRING[2], SRING[3] + DIPADD] };
    const pI = fingerFK(hm.fingers[0], side, sets.idx).pts, pM = fingerFK(hm.fingers[1], side, sets.mid).pts, pR = fingerFK(hm.fingers[2], side, sets.ring).pts;
    // نقطة تلامس على السطح الداخلي للسُّلامية الوسطى (من PIP إلى DIP) حيث تمرّ العصا
    const contactOf = (pts, fd, t, extra) => {
      const d = V.norm(V.sub(pts[2], pts[1])), p = V.norm(V.cross([-1, 0, 0], d));
      return V.madd(V.lerp(pts[1], pts[2], t), p, fd.r[1] + rStick + extra);
    };
    const CI = contactOf(pI, hm.fingers[0], CT[0], adj.idx), CM = contactOf(pM, hm.fingers[1], CT[1], adj.mid), CR = contactOf(pR, hm.fingers[2], CT[2], adj.ring);
    // العصا: أقرب خط مستقيم يمرّ بنقاط التلامس الثلاث (اتجاه السبابة-البنصر، ومركزه متوسط النقاط)
    let a = V.norm(V.sub(CI, CR));
    if (V.dot(a, HR([1, 0, 0])) < 0) a = V.mul(a, -1);
    const S = V.mul(V.add(V.add(CI, CM), CR), 1 / 3);
    const up = V.rot(V.norm(V.perp([0, 0, 1], a)), a, HROLL);                    // من الشعر إلى العصا: نحو ظهر اليد (مع ميل اختياري حول العصا)
    const chains = [pI, pM, pR];
    // الخنصر: منحنٍ وطرفه فوق العصا باتجاه كعب القوس
    const pk = hm.fingers[3];
    // طرف الخنصر على سطح العصا حيث تبعد عن قاعدة الخنصر نحو 78% من طوله: منحنٍ طبيعيًا، لا مطويًا على نفسه (كان الهدف قريبًا جدًا من القاعدة فيطوى الإصبع كدبّوس الشعر)
    const pkBase = [pk.k[0] * side, pk.k[1], pk.k[2]], pkLen = pk.L[0] + pk.L[1] + pk.L[2];
    const pkM = V.norm(pkBase), pkLat = V.norm(V.cross([0, 0, 1], pkM));       // محور المشط (من الرسغ) والمحور الجانبي في مستوى اليد
    let pkT = null, bestScore = Infinity, minLat = Infinity, latT = null;
    for (let t = -0.012; t <= 0.09; t += 0.002) {
      const q = V.madd(V.madd(V.madd(S, a, -t), up, rStick + pk.r[3] * 0.9 + adj.pinky + PKUP), V.cross(a, up), PKSIDE), sc = Math.abs(V.dist(q, pkBase) - PKFRAC * pkLen);
      if (V.dot(V.sub(q, pkBase), a) > PKBACK) continue;                      // طرف الخنصر خلف قاعدته (جهة كعب القوس) لا أمامها
      // الفتح الجانبي عند الجذر: زاوية اتجاه (القاعدة → الطرف) خارج مستوى الانثناء (محور المشط × ظهر اليد)؛ لا نقيّد الانثناء نفسه
      const dq = V.sub(q, pkBase), lat = V.dot(dq, pkLat), latA = Math.atan2(Math.abs(lat), Math.hypot(V.dot(dq, pkM), dq[2]));
      if (latA < minLat) { minLat = latA; latT = q; }
      if (latA > PKLAT) continue;
      if (sc < bestScore) { bestScore = sc; pkT = q; }
    }
    if (!pkT) pkT = latT;                                                      // لا هدف ضمن الحد: الأقل فتحًا جانبيًا
    if (!pkT) pkT = V.madd(V.madd(S, a, -0.03), up, rStick + pk.r[3] * 0.9 + adj.pinky + PKUP);
    chains.push(PKFK.length >= 4 ? fingerFK(pk, side, PKFK).pts : fingerIK(pk, side, pkT, PKPOLE, PKRATIO));   // PKFK: شكل مقوَّس بزوايا ثابتة بدل الهدف
    // الإبهام: منحنٍ، طرفه تحت العصا مقابل الإصبع الوسطى عند الزاوية الأمامية للكعب
    const th = hm.thumb;
    const tTip = V.madd(V.madd(S, a, -0.006), up, -(rStick + th.r[3] * 0.95 + adj.thumb));
    const thumb = thumbChain(th, side, tTip, V.norm(HR([0.6, 0.62, -0.5])), HR([0.9, -0.2, -0.6]));
    const yG = BOW.frogFront + 0.006 + GRIPFWD;      // إزاحة القبضة للأمام ليبلغ الخنصر المستقيم تقريبًا حلقات الكعب
    const x_l = V.cross(a, up);
    const o_l = V.sub(V.sub(S, V.mul(a, yG)), V.mul(up, BOW.stickZ(yG)));
    return { chains, thumb, o_l, x_l, y_l: a, z_l: up, adj, thumbReachMm: +(thumb.short * 1000).toFixed(1), fit: { a, S } };
  }

  // تصحيح القبضة بقياس الشبكة: لا اختراق للعصا، وتلامس فعلي (فراغ ≤ 0.8 مم) للأصابع المسنِدة
  refineBowHold() {
    const adj = { idx: 0, mid: 0, ring: 0, thumb: 0, pinky: 0 };
    const map = { index: 'idx', middle: 'mid', ring: 'ring', thumb: 'thumb', little: 'pinky' };
    for (let it = 0; it < 16; it++) {
      this.holdR = this.bowHold(adj);
      this.pose(0, false);
      const r = this.bowHandReport();
      let done = true;
      for (const f in map) {
        const pen = r[f].stickPenetrationMm / 1000, gap = r[f].nearestGapMm / 1000;
        if (pen > 0.0002) { adj[map[f]] += (pen + 0.0003) * 2.2; done = false; }
        else if (isFinite(gap) && gap > 0.0008) { adj[map[f]] -= (gap - 0.0003) * 2.2; done = false; }
      }
      if (done) break;
    }
  }

  // ---------- موضع اليد اليسرى في الوضع الأول (مرة واحدة) ----------
  placeLeftHand() {
    const vf = this.vf, hm = this.hand.L;
    const Vw = (p) => F.pt(vf, p);
    const yL = V.norm(V.add(V.mul(vf.z, 0.86), V.add(V.mul(vf.x, -0.38), V.mul(vf.y, -0.1))));
    const xL = V.norm(V.perp(vf.y, yL));
    const zL = V.cross(xL, yL);
    let X = xL, Y = yL, Z = zL;
    const ap = (ax, a) => { X = V.rot(X, ax, a); Y = V.rot(Y, ax, a); Z = V.rot(Z, ax, a); };
    ap(Y.slice(), LHROT[0]); ap(Z.slice(), LHROT[1]); ap(X.slice(), LHROT[2]);
    // قاعدة السبابة تلامس جانب الرقبة (جهة وتر مي)، ثم نضبط المسافة حتى تتقوّس الأصابع تقوّسًا طبيعيًا
    const K = Vw([0.012 + hm.fingers[0].r[0] * 1.6, 0.289, VN.zFb(0.289) - 0.004]);
    const R0 = Frame([0, 0, 0], X, Y, Z);
    let o = V.sub(K, F.dir(R0, V.mul(hm.fingers[0].k, 1)));
    // مواضع الأصابع من المصدر الموحّد (teaching/exercise.js): y = L / 2^(نصف النغمات/12) — نفس القيم التي يُشتق منها الصوت
    const fingerY = [1, 2, 3, 4].map(stopLength);
    this.fingerY = fingerY;
    for (let it = 0; it < 12; it++) {
      const hf = Frame(o, X, Y, Z);
      const toL = (q) => { const d = V.sub(q, o); return [V.dot(d, X), V.dot(d, Y), V.dot(d, Z)]; };
      let shift = [0, 0, 0];
      hm.fingers.forEach((fd, i) => {
        const sp = VN.stringAt(2, fingerY[i]);
        const t = toL(Vw(sp)), mcp = fd.k, tot = fd.L[0] + fd.L[1] + fd.L[2];
        const D = V.dist(mcp, t), want = tot * LWANT;               // الإصبع المقوّس يغطي نحو 80% من طوله
        shift = V.madd(shift, V.norm(V.sub(t, mcp)), (D - want) / 4);
      });
      o = V.add(o, F.dir(Frame(o, X, Y, Z), shift.map((c) => c * 0.8)));
    }
    // لا إصبع مفرود: إن تجاوز أي إصبع (غالبًا الخنصر) 88% من طوله نقرّب اليد نحو هدفه
    for (let it = 0; it < 40; it++) {
      const toL = (q) => { const d = V.sub(q, o); return [V.dot(d, X), V.dot(d, Y), V.dot(d, Z)]; };
      let worst = null;
      hm.fingers.forEach((fd, i) => {
        // الأبعد بين وضعي الضغط والرفع (الرفع 9–13 مم فوق الوتر)
        const tot = fd.L[0] + fd.L[1] + fd.L[2];
        let r = 0, t = null;
        for (const lift of [0.0, i === 3 ? 0.013 : 0.009]) {
          const tt = toL(Vw(V.add(VN.stringAt(2, fingerY[i]), [0, 0, lift + 0.003])));
          const rr = V.dist(fd.k, tt) / tot; if (rr > r) { r = rr; t = tt; }
        }
        if (r > 0.86 && (!worst || r > worst.r)) worst = { r, dir: V.norm(V.sub(t, fd.k)), ex: (r - 0.84) * tot };
      });
      if (!worst) break;
      o = V.add(o, F.dir(Frame(o, X, Y, Z), V.mul(worst.dir, worst.ex)));
    }
    // لا يدخل مفصل السبابة في الرقبة: يبقى على بعد نصف قطره على الأقل من حافة اللوحة
    const mcpW = F.pt(Frame(o, X, Y, Z), hm.fingers[0].k), d = V.sub(mcpW, vf.o);
    const lx = V.dot(d, vf.x), ly = V.dot(d, vf.y), minX = VN.fbHalfW(ly) + hm.fingers[0].r[0] * 1.05;
    if (lx < minX) o = V.madd(o, vf.x, minX - lx);
    this.handLBase = this.handLFrame = Frame(o, X, Y, Z);
  }

  // ---------- وضعية كاملة في اللحظة t ----------
  pose(t, playing, uOverride) {
    // المحاكاة القديمة (وضعية ثابتة أو حركة توضيحية على وتر لا): تُترجَم إلى حالة موحّدة
    const Ts = 1.1;
    let u = 0.3, note = 1;
    if (playing) {
      const k = Math.floor(t / Ts), f = (t % Ts) / Ts;
      const ease = (x) => x < 0.12 ? 0 : x > 0.92 ? 1 : (x - 0.12) / 0.8;
      const e = smooth(ease(f)) * 0.25 + ease(f) * 0.75;
      u = k % 2 === 0 ? 0.17 + 0.33 * e : 0.5 - 0.33 * e;
      note = [0, 1, 2, 3, 2, 1][k % 6];
    }
    if (uOverride != null) u = uOverride;
    const pose = this.poseState({ u, sBow: 2, sFinger: 2, press: [0, 1, 2, 3].map((i) => (i < note ? 1 : 0)) });
    pose.note = note;
    return pose;
  }

  // الوضعية من حالة موحّدة: u موضع نقطة التماس على القوس، sBow وتر القوس (عشري)، sFinger وتر الأصابع، press[0..3] ضغط الأصابع 1..4 (0..1)
  poseState(st) {
    const rig = this.rig, vf = this.vf, pose = { violin: vf };
    const Vw = (p) => F.pt(vf, p), Vd = (d) => F.dir(vf, d);
    const u = st.u;
    pose.u = u;
    // القوس على الوتر المطلوب، موازٍ للفرس
    const ySP = 0.028, sA = strAt(st.sBow, ySP);
    const sd = V.norm(V.sub(strAt(st.sBow, VN.yNut), strAt(st.sBow, 0)));
    const slope = -2 * 0.0026 * sA[0] / (0.0175 * 0.0175);
    const across = V.norm(V.perp([-1, 0, -slope], sd));
    const by = V.norm(Vd(across));
    let bz = V.norm(V.perp(Vd(V.cross(sd, across)), by));
    if (V.dot(bz, vf.z) < 0) bz = V.mul(bz, -1);
    bz = V.rot(bz, by, V.dot(V.cross(by, bz), vf.y) > 0 ? 0.22 : -0.22);
    const bx = V.cross(by, bz);
    const contact = V.madd(Vw(sA), vf.z, 0.0007);
    this.bowContact = contact;
    pose.bow = Frame(V.sub(V.sub(contact, V.mul(by, u)), V.mul(bz, BOW.hairZ(u))), bx, by, bz);
    this.lastBow = pose.bow;

    // اليد اليمنى والذراع
    const hold = this.holdR;
    const handR = handFromBow(pose.bow, hold.o_l, hold.x_l, hold.y_l, hold.z_l);
    this.poseArm('R', handR, RPOLE);
    poseFingers(rig, this.hand.R, handR, hold.chains, hold.thumb);
    pose.handR = handR;

    // اليد اليسرى: تنزاح جانبيًا مع الوتر (نحو وتر مي أو ري…) والأصابع تضغط الوتر الحالي
    const base = this.handLBase, dx = strAt(st.sFinger, 0.25)[0] - strAt(2, 0.25)[0];
    this.handLFrame = Frame(V.madd(base.o, vf.x, dx), base.x, base.y, base.z);
    this.poseArm('L', this.handLFrame, LEPOLE);
    pose.handL = this.handLFrame;
    this.fingerYCur = st.fy || this.fingerY;          // مواضع الأصابع للنغمة الحالية (السلالم: الإصبع الثاني واطئ في دو وفا)
    this.solveLeftFingers(st.press, st.sFinger);
    pose.state = st;
    return pose;
  }

  poseArm(s, handFrame, poleOff) {
    const rig = this.rig, Ln = this.len[s];
    const clav = rig.b(s, 'shoulder');
    if (clav) rig.setWorldQuaternion(clav, this.restClav(s));
    let sh = ar(rig.wp(s, 'upperArm'));
    const wr = handFrame.o, reach = Ln.upper + Ln.fore;
    // إن بعُد الهدف عن مدى الذراع: تتقدّم الترقوة قليلًا (كما يفعل العازف الحقيقي) بحدّ أقصى 20°
    let d = V.dist(sh, wr);
    // خطوة واحدة كانت تترك 2.9 مم فوق المدى (حركة الترقوة قوسية لا خطية)؛ نكرّر حتى يصل الهدف أو يبلغ الحد 20°
    for (let it = 0, tot = 0; clav && it < 5 && d > reach * 0.985 && tot < CLAVMAX; it++) {
      const cp = ar(rig.wp(s, 'shoulder'));
      const need = d - reach * 0.985;
      const axis = V.norm(V.cross(V.sub(sh, cp), V.sub(wr, cp)));
      const ang = Math.min(CLAVMAX - tot, need / Math.max(0.05, Ln.clav || 0.12));
      if (!(V.len(axis) > 0)) break;
      rig.setWorldQuaternion(clav, new THREE.Quaternion().setFromAxisAngle(v3(axis), ang).multiply(rig.worldQ(clav)));
      tot += ang;
      sh = ar(rig.wp(s, 'upperArm')); d = V.dist(sh, wr);
    }
    this.qa[`reach${s}`] = +(Math.max(0, d - reach) * 1000).toFixed(1);
    const elbow = ik2(sh, wr, Ln.upper, Ln.fore, V.add(sh, poleOff));
    const ud = V.norm(V.sub(elbow, sh)), fdir = V.norm(V.sub(wr, elbow));
    let bend = V.perp(fdir, ud);
    if (V.len(bend) < 1e-3) bend = V.perp(FWD, ud);
    rig.aim(rig.b(s, 'upperArm'), v3(ud), v3(bend));
    rig.aim(rig.b(s, 'lowerArm'), v3(fdir), v3(handFrame.z));
    poseHandRotation(rig, this.hand[s], handFrame);
  }
  restClav(s) {
    if (!this._clav) this._clav = {};
    if (!this._clav[s]) this._clav[s] = this.rig.worldQ(this.rig.b(s, 'shoulder'));
    return this._clav[s].clone();
  }

  // ---------- أصابع اليد اليسرى مع تصحيح التلامس من سطح الشبكة ----------
  solveLeftFingers(press, sF = 2) {
    this.sFinger = sF;
    const rig = this.rig, vf = this.vf, hm = this.hand.L;
    const Vw = (p) => F.pt(vf, p);
    const hf = Frame(ar(rig.wp('L', 'hand')), this.handLFrame.x, this.handLFrame.y, this.handLFrame.z);
    const toL = (q) => { const d = V.sub(q, hf.o); return [V.dot(d, hf.x), V.dot(d, hf.y), V.dot(d, hf.z)]; };
    // الإبهام على جانب الرقبة جهة وتر صول، مقابل الإصبع الأولى تقريبًا
    const th = hm.thumb;
    const thW = Vw([-VN.fbHalfW(LTH[0]) - th.r[3] * LTH[2], LTH[0], VN.zFb(LTH[0]) + LTH[1]]);
    const thumb = thumbChain(th, 1, toL(thW), V.norm(LTP), LTQ);
    this.qa.thumbLShortMm = +(thumb.short * 1000).toFixed(1);
    const targets = [], down = [];
    for (let i = 0; i < 4; i++) {
      const pr = press[i];
      down[i] = pr > 0.5;                    // الأصابع الأدنى تبقى على الوتر بعد وضعها
      const y = (this.fingerYCur || this.fingerY)[i], sp = strAt(sF, y);
      // المضغوطة: الوتر ملامس للوحة الأصابع، والطرف فوقه بقطر الوتر. المرفوعة: 9–13 مم فوق الوتر (ونمرّ بينهما بنعومة)
      const zDown = VN.zFb(y) + 0.0016 + 2 * STR_R[Math.max(0, Math.min(3, Math.round(sF)))], zUp = sp[2] + 0.009 + (i === 3 ? 0.004 : 0);
      const z = zUp + (zDown - zUp) * pr;
      targets.push([sp[0], y, z]);
    }
    if (!this._adj) this._adj = {};
    const adj = targets.map((_, i) => (this._adj[`${Math.round(sF)}:${i}:${down[i]}:${Math.round((this.fingerYCur || this.fingerY)[i] * 1e4)}`] ||= { v: [0, 0, 0], n: 0 }));
    let chains;
    const iters = adj.some((a) => a.n < 6) ? 8 : 1;
    for (let it = 0; it < iters; it++) {
      chains = targets.map((tg, i) => fingerArch(hm.fingers[i], 1, toL(Vw(V.add(tg, adj[i].v))), LPOLE, 0.7));
      poseFingers(rig, hm, this.handLFrame, chains, thumb);
      // نقطة التلامس الفعلية = أقرب رأس من سُلامية الطرف إلى سطح لوحة الأصابع؛ نصحّح الارتفاع والجانب
      for (let i = 0; i < 4; i++) {
        const c = this.fingerContact(i);
        const cl = (v, m) => Math.max(-m, Math.min(m, v));   // حدود أمان: التصحيح محلي لا يتراكم بلا نهاية
        const g = 0.6;                                         // تخميد: يمنع التأرجح حين تتغير الاستجابة قرب حدّ مدى الإصبع
        // الأصابع المرفوعة تبقى معلّقة مقوّسة فوق الوتر بلا معايرة (المعايرة كانت تمدّ الخنصر حين يعجز عن بلوغ الهدف)
        if (down[i]) {
          adj[i].v[2] = cl(adj[i].v[2] + g * (targets[i][2] - c.minZ), 0.012);
          adj[i].v[0] = cl(adj[i].v[0] + g * (targets[i][0] - c.cx), 0.006);
          // موضع التوقف على طول الوتر يحدّد النغمة: مركز تلامس الوسادة يجب أن يقع عند y المشتقّ منه الصوت (≈ 1 مم ≈ 6 سنت)
          adj[i].v[1] = cl(adj[i].v[1] + g * (targets[i][1] - c.cy), 0.01);
        }
        adj[i].n++;
      }
    }
    chains = targets.map((tg, i) => fingerArch(hm.fingers[i], 1, toL(Vw(V.add(tg, adj[i].v))), LPOLE, 0.7));
    poseFingers(rig, hm, this.handLFrame, chains, thumb);
    this.lastChains = chains; this.lastDown = down; this.lastTargets = targets;
  }

  // تلامس طرف الإصبع i (في إحداثيات الكمان): أخفض نقطة، ومركز منطقة التلامس، والمسافة إلى طرف الإصبع
  fingerContact(i) {
    const rig = this.rig, vf = this.vf, f = FINGERS[i], p = new THREE.Vector3();
    if (!this._distal) this._distal = {};
    if (!this._distal[f]) this._distal[f] = rig.verts([rig.b('L', `${f}3`), rig.b('L', `${f}4`)], 0.35);
    const pts = [];
    let minZ = Infinity;
    for (const e of this._distal[f]) {
      rig.vertexWorld(e.m, e.i, p);
      const d = V.sub(ar(p), vf.o), q = [V.dot(d, vf.x), V.dot(d, vf.y), V.dot(d, vf.z)];
      pts.push(q); if (q[2] < minZ) minZ = q[2];
    }
    let cx = 0, cy = 0, n = 0;
    for (const q of pts) if (q[2] < minZ + 0.0012) { cx += q[0]; cy += q[1]; n++; }
    cx /= n || 1; cy /= n || 1;
    return { minZ, cx, cy, pts };
  }

  // ---------- تقرير التحقق (QA) لوضعية العزف الحالية ----------
  report() {
    const rig = this.rig, vf = this.vf, out = { ...this.qa };
    const strX = (s, y) => strAt(this.sFinger ?? 2, y)[0];
    out.leftFingers = FINGERS.map((f, i) => {
      const c = this.fingerContact(i), y = (this.fingerYCur || this.fingerY)[i], tgt = this.lastTargets[i];
      const tipB = rig.b('L', `${f}4`) || rig.b('L', `${f}3`);
      const tip = ar(tipB.getWorldPosition(new THREE.Vector3()));
      const tl = V.sub(tip, vf.o), tipL = [V.dot(tl, vf.x), V.dot(tl, vf.y), V.dot(tl, vf.z)];
      // اختراق لوحة الأصابع والرقبة: رؤوس الإصبع تحت سطح اللوحة ضمن عرضها
      let pen = 0, touchG = false, touchE = false, padFlat = 0;
      for (const q of c.pts) {
        const zf = VN.zFb(q[1]);
        if (Math.abs(q[0]) < VN.fbHalfW(q[1]) && q[1] > VN.yFbEnd && q[1] < VN.yNut) pen = Math.max(pen, zf - q[2]);
        const zs = VN.stringAt(Math.max(0, Math.round(this.sFinger ?? 2) - 1), q[1])[2];
        if (this.lastDown[i] && Math.abs(q[0] - VN.stringAt(Math.max(0, Math.round(this.sFinger ?? 2) - 1), q[1])[0]) < 0.0012 && q[2] < zs + STR_R[1] + 0.0003) touchG = true;     // وتر ري المجاور
        if (this.lastDown[i] && Math.abs(q[0] - VN.stringAt(Math.min(3, Math.round(this.sFinger ?? 2) + 1), q[1])[0]) < 0.0012 && q[2] < VN.stringAt(Math.min(3, Math.round(this.sFinger ?? 2) + 1), q[1])[2] + STR_R[3] + 0.0003) touchE = true;
      }
      // عرض منطقة التلامس (عدد الرؤوس القريبة من اللوحة) — كبرها يعني الضغط بالوسادة العريضة
      for (const q of c.pts) if (q[2] < c.minZ + 0.0012) padFlat++;
      const finger = rig.verts([rig.b('L', `${f}3`)], 0.35).length;
      const chain = this.lastChains[i];
      const bendDeg = chain.bend != null ? +(chain.bend * 180 / Math.PI).toFixed(0) : null;
      return {
        finger: ['السبابة (1)', 'الوسطى (2)', 'البنصر (3)', 'الخنصر (4)'][i], pressed: this.lastDown[i],
        contactToStringMm: +((c.cx - strX(2, c.cy)) * 1000).toFixed(2),
        heightOverTargetMm: +((c.minZ - tgt[2]) * 1000).toFixed(2),
        stopPositionErrorMm: +((c.cy - y) * 1000).toFixed(2),                       // انحراف مركز التلامس الفعلي عن الموضع الذي يُشتق منه الصوت
        stopPositionErrorCents: +(1200 * Math.log2(y / c.cy)).toFixed(1),
        contactToTipMm: +(Math.hypot(c.cx - tipL[0], c.cy - tipL[1], c.minZ - tipL[2]) * 1000).toFixed(1),
        contactArea: `${padFlat}/${finger}`,
        fingerboardPenetrationMm: +(pen * 1000).toFixed(2),
        touchesNeighbourD: touchG, touchesNeighbourE: touchE, pipBendDeg: bendDeg,
      };
    });
    out.bowHand = this.bowHandReport();
    out.hold = this.qa.hold; out.seat = this.qa.seat;
    out.thumbReachShortMm = this.holdR.thumbReachMm;
    return out;
  }

  bowHandReport() {
    const rig = this.rig, p = new THREE.Vector3(), bowF = this.lastBow || this.pose0.bow;
    const rStick = 0.0047;
    const res = {};
    for (const f of [...FINGERS, 'thumb']) {
      let pen = 0, gap = Infinity;
      for (const e of rig.verts([1, 2, 3, 4].map((i) => rig.b('R', `${f}${i}`)), 0.35)) {
        rig.vertexWorld(e.m, e.i, p);
        const d = V.sub(ar(p), bowF.o), y = V.dot(d, bowF.y);
        if (y < 0 || y > 0.2) continue;
        const r = Math.hypot(V.dot(d, bowF.x), V.dot(d, bowF.z) - BOW.stickZ(y));
        pen = Math.max(pen, rStick - r); gap = Math.min(gap, r - rStick);
      }
      res[f] = { stickPenetrationMm: +(Math.max(0, pen) * 1000).toFixed(2), nearestGapMm: +(gap * 1000).toFixed(2) };
    }
    return res;
  }

  // نقاط مفيدة للكاميرا ونقاط التركيز
  landmarks() {
    const rig = this.rig, P = (s, k) => ar(rig.wp(s, k));
    const handC = (s) => { const f = handFrameNow(rig, s); return F.pt(f, [0, 0.07, 0]); };
    return {
      head: P('C', 'head'), chest: P('C', rig.b('C', 'upperChest') ? 'upperChest' : 'spine'),
      hips: P('C', 'hips'), kneeL: this.knee.L, kneeR: this.knee.R,
      handR: handC('R'), handL: handC('L'),
    };
  }
}
