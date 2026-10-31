// =====================================================================
//  لاعب جالس عام (مشترك بين ألعاب MusiTeacher ثلاثية الأبعاد).
//  مستخرج من عازفة الكمان: قياس الجسم، الجلوس على المقعد وملامسة الأرض، IK للذراعين (مع تقدّم الترقوة)،
//  وحركة الرأس. الألعاب الخاصة بكل آلة ترث هذه الفئة وتضيف وضعية الحمل والأصابع.
// =====================================================================
import * as THREE from 'three';
import { V, Frame, F, ik2 } from '../engine/math.js';
import { measureHand, poseHandRotation, handFrameNow } from './hand.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const ar = (v) => [v.x, v.y, v.z];
const UP = [0, 1, 0], FWD = [0, 0, 1];
const QP = (k, d) => { const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get(k) : null; return q ? q.split(',').map(Number) : d; };
const CLAVMAX = QP('clavmax', [0.5])[0];
const LEGSPLAY = QP('splay', [1.25])[0];
const TORSO_YAW = QP('tyaw', [0])[0];
export const SEAT = { y: 0.45, zFront: 0.16, zBack: -0.26, halfW: 0.22 };

export class SeatedPlayer {
  constructor(rig, config = {}) { this.rig = rig; this.cfg = config; this.qa = {}; }
  // وضعية الجلوس والقياس (تُستدعى من setup في الفئة الوارثة)
  baseSetup() {
    const rig = this.rig;
    rig.normalize(this.cfg.height || 1.6);
    rig.captureRest();
    rig.buildDominance();
    this.measure();
    this.posture();
  }

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

  applyHead(yaw, pitch, roll) {
    const rig = this.rig, neck = rig.b('C', 'neck'), head = rig.b('C', 'head');
    if (!this.headBase) { this.headBase = { neck: rig.worldQ(neck), head: rig.worldQ(head) }; }
    const e = (k) => new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * k, yaw * k, roll * k, 'YXZ'));
    rig.setWorldQuaternion(neck, e(0.45).multiply(this.headBase.neck.clone()));
    rig.setWorldQuaternion(head, e(1).multiply(this.headBase.head.clone()));
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
