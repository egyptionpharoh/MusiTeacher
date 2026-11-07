// =====================================================================
//  العازف/العازفة على العود: وضعية الحمل، اليد اليسرى على الزند، واليد اليمنى بالريشة.
//  حركة خاصة بالعود (لا منسوخة من الكمان أو الأكورديون أو الأورج):
//   • الحمل: قعر القصعة على الفخذ الأيمن وظهرها ملاصق للبطن، الوجه نحو الجمهور مائلًا قليلًا للأعلى، والزند إلى يسار
//     العازف مرتفعًا قليلًا ومتقدّمًا للأمام. يُحسب الموضع من سطح الجسم والثوب الفعليين (لا اختراق).
//   • اليسرى: الإبهام خلف الزند مقابل السبابة/الوسطى، والكف تحت الحافة الحادّة للزند بمسافة عنه، والأصابع مقوّسة
//     تنزل بأطرافها على الأوتار في مواضع النغمات الحقيقية (عود بلا دساتين: الموضع = الطبقة). الإصبع الضاغط يُنزل
//     الوتر حتى لوحة الأصابع، والأصابع الحرة معلّقة فوق الأوتار.
//   • اليمنى: الساعد مستند على الحافة العليا للقصعة، والريشة بين الإبهام والسبابة، والحركة من الرسغ:
//     طرف الريشة يعبر الوتر نفسه لحظة الصوت (نازلة ↓ أو صاعدة ↑) ثم يرتفع قليلًا ويعود — لا ضرب في الهواء.
//  الإطار المحلي للعود (oud-model.js): y نحو الزند، z خارج الوجه، x نحو الأرض (الوتر الأغلظ في الأعلى).
// =====================================================================
import * as THREE from 'three';
import { V, Frame, F } from '../../_shared/3d/engine/math.js';
import { SeatedPlayer, SEAT } from '../../_shared/3d/character/seated-player.js';
import { fingerArch, thumbChain, poseFingers, FINGERS } from '../../_shared/3d/character/hand.js';
import { OUD, RISHA } from '../instrument/oud-model.js';
import { fixSeatedGlutes, fixSeatedLap, fixSeatedHem, calmFabric } from './dish-fix.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const ar = (v) => [v.x, v.y, v.z];
const QP = (k, d) => { const q = new URLSearchParams(location.search).get(k); return q ? q.split(',').map(Number) : d; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const DEG = Math.PI / 180;

// ---------- ثوابت قابلة للضبط عبر الرابط (للمعايرة فقط) ----------
const HOLD = { pitch: QP('opitch', [15])[0], yaw: QP('oyaw', [16])[0], tilt: QP('otilt', [7])[0], x: QP('ox', [-0.02])[0], gap: QP('ogap', [0.004])[0] };
const L_ANCHOR = QP('lanc', [0.021, -0.004, -0.004]);     // جذر الوسطى: (تحت الحافة الحادة، نحو الفرس، خلف الوجه) بالمتر
const L_YDIR = QP('lydir', [-1, 0.06, 0.30]);              // اتجاه الكف (من الرسغ إلى الأصابع) في إطار العود
const L_POLE = QP('lpole', [0.35, -0.55, -0.6]);          // قطب مرفق اليسرى (عالمي، نسبةً إلى الكتف)
const L_HOVER = QP('lhov', [0.009])[0];                    // ارتفاع الأطراف الحرة فوق الأوتار
const PAD = QP('pad', [0.0072])[0];                        // سُمك لحم الطرف فوق الوتر
const THUMB_TH = QP('tth', [104])[0] * DEG;                // زاوية موضع الإبهام حول ظهر الزند (90° = منتصف الظهر)
const THUMB_DIR = QP('tdir', [0.2, 0.75, -0.6]);
const R_POLE = QP('rpole', [-0.75, -0.1, -0.55]);
const R_YH = QP('ryh', [0.70, -0.10, -0.70]);            // اتجاه أصابع اليمنى (من الرسغ إلى المفاصل) في إطار العود
const R_ZH = QP('rzh', [-0.45, 0.0, 0.85]);             // ظهر الكف اليمنى في إطار العود
const PROTRUDE = QP('prot', [0.031])[0];                   // طول الجزء البارز من الريشة خارج القبضة

export class Oudist extends SeatedPlayer {
  constructor(rig, config, oud) { super(rig, config); this.oud = oud; }

  setup() {
    // ثوابت الحمل واليدين لكل شخصية (أطوال الجسم واليدين مختلفة): من config.js، ويمكن تجاوزها بالرابط أثناء المعايرة
    const hold = (this.cfg && this.cfg.hold) || {}, has = (k) => new URLSearchParams(location.search).has(k);
    const pick = (k, def) => (has(k) ? QP(k, def) : (hold[k] ?? def));
    this.P = { lanc: pick('lanc', L_ANCHOR), lydir: pick('lydir', L_YDIR), ryh: pick('ryh', R_YH), prot: has('prot') ? PROTRUDE : (hold.prot ?? PROTRUDE) };
    this.stoolH = has('stool') ? QP('stool', [0])[0] : (hold.stool ?? 0);
    this.baseSetup();
    this.fixCloth();
    this.head = { yaw: QP('hy', [0.10])[0], pitch: QP('hp', [0.36])[0], roll: QP('hr', [0.05])[0] };   // ينظر إلى الزند واليدين
    this.applyHead(this.head.yaw, this.head.pitch, this.head.roll);
    this.placeOud();
    this.buildGrip();
    this.state = this.restState();
    this.pose(this.state);
    this.calibrateRightElbow();
    this.pose(this.state);
  }
  // المرفق الأيمن: يُختار دوران قطب المرفق (حول محور الكتف–الرسغ) بحيث يستند الساعد على الحافة العليا للقصعة
  // دون أن يدخل فيها، وأقرب ما يمكن إلى الوضع المفضّل. يُحسب مرة لكل شخصية (أطوال ذراعيها مختلفة).
  armClear(s, step = 3) {
    const rig = this.rig, p = new THREE.Vector3();
    if (!this._av) this._av = {};
    if (!this._av[s + step]) this._av[s + step] = rig.verts([rig.b(s, 'lowerArm'), rig.b(s, 'upperArm')].filter(Boolean), 0.4).filter((_, i) => i % step === 0);
    let worst = -Infinity;
    for (const e of this._av[s + step]) { rig.vertexWorld(e.m, e.i, p); worst = Math.max(worst, this.insideOud(this.Lw(p))); }
    return worst;                     // موجب = دخول، سالب = أقرب مسافة (تقريبية)
  }
  calibrateRightElbow() {
    const sh = ar(this.rig.wp('R', 'upperArm')), wr = this.handRFrame.o, ax = V.norm(V.sub(wr, sh));
    let best = null;
    for (let a = -70; a <= 70; a += 10) {
      const pole = V.rot(R_POLE, ax, a * DEG);
      this.rPole = pole; this.pose(this.state);
      const w = this.armClear('R');
      const cost = (w > 0 ? 100 * w : Math.max(0, -w - 0.006) * 2) + Math.abs(a) * 0.00004;
      if (!best || cost < best.cost) best = { a, pole, cost, w };
    }
    this.rPole = best.pole; this.qa.rElbow = { deg: best.a, clearMm: +(-best.w * 1000).toFixed(1) };
  }
  // الجلوس (نسخة من SeatedPlayer.posture) مع مسند قدم اختياري تحت القدم اليمنى: يرفع الفخذ الأيمن فيستقر عليه قعر العود
  // (ممارسة شائعة عند عازفي العود). القدم اليسرى على الأرض.
  posture() {
    if (!this.stoolH) return super.posture();
    const rig = this.rig, root = rig.root;
    const hipsY0 = 0.535 * (this.rig.height / 1.72);
    const placeHips = (y) => { const mid = rig.wp('L', 'upperLeg').add(rig.wp('R', 'upperLeg')).multiplyScalar(0.5); root.position.x += -mid.x; root.position.y += y - mid.y; root.position.z += 0.05 - mid.z; root.updateMatrixWorld(true); };
    rig.resetToRest();
    const sp = rig.b('C', 'spine');
    if (sp) rig.setWorldQuaternion(sp, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.035).multiply(rig.worldQ(sp)));
    placeHips(Math.max(SEAT.y + 0.06, hipsY0));
    this.ankleLift = { L: 0, R: 0 };
    const p = new THREE.Vector3();
    for (let it = 0; it < 6; it++) {
      this.poseLegs();
      const minY = this.seatMinY();
      if (isFinite(minY)) { root.position.y += SEAT.y + 0.002 - minY; root.updateMatrixWorld(true); }
      this.poseLegs();
      for (const s of ['L', 'R']) {
        const fv = rig.verts([rig.b(s, 'foot'), rig.b(s, 'toes')], 0.4);
        let fy = Infinity;
        for (let k = 0; k < fv.length; k += 2) { rig.vertexWorld(fv[k].m, fv[k].i, p); fy = Math.min(fy, p.y); }
        if (isFinite(fy)) this.ankleLift[s] -= fy - 0.001 - (s === 'R' ? this.stoolH : 0);
      }
    }
    this.poseLegs();
    this.qa.seat = this.contactReport();
    // مسند القدم: صندوق خشبي صغير تحت القدم اليمنى
    const fv = rig.verts([rig.b('R', 'foot'), rig.b('R', 'toes')], 0.4); const lo = new THREE.Vector3(1, 1, 1).multiplyScalar(Infinity), hi = lo.clone().multiplyScalar(-1);
    for (const e of fv) { rig.vertexWorld(e.m, e.i, p); lo.min(p); hi.max(p); }
    const g = new THREE.Group(); g.name = 'footstool';
    const w = Math.max(0.16, hi.x - lo.x + 0.08), d = Math.max(0.24, hi.z - lo.z + 0.06), h = this.stoolH;
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4429, roughness: 0.55 }), top = new THREE.MeshStandardMaterial({ color: 0x7a2a2a, roughness: 0.9 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.012, d), wood); box.position.set((lo.x + hi.x) / 2, (h - 0.012) / 2, (lo.z + hi.z) / 2); g.add(box);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(w - 0.01, 0.012, d - 0.01), top); pad.position.set(box.position.x, h - 0.006, box.position.z); g.add(pad);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    this.extras = g;
  }
  activate() {
    if (this.oudPlace) { this.oud.root.position.copy(this.oudPlace.p); this.oud.root.quaternion.copy(this.oudPlace.q); this.oud.root.updateMatrixWorld(true); }
    this.applyHead(this.head.yaw, this.head.pitch, this.head.roll);
    this.pose(this.state);
  }
  restState() {
    return { L: { f: {} }, R: { tip: [OUD.courseX(3, OUD.yPluck) - 0.008, OUD.yPluck, OUD.zStr(OUD.yPluck) + 0.006], roll: 0 } };
  }

  // ثوب العازف في الجلوس (مثل الأكورديون: الأرداف لوح محتشم، الحِجر ملتصق، الطرف السفلي منسدل)؛ العازفة: تصحيح الأرداف المعتدل.
  fixCloth() {
    const has = (k) => new URLSearchParams(location.search).has(k), male = this.cfg && this.cfg.gender === 'male';
    try {
      if (male) {
        if (!has('noglutefix')) this.qa.glutes = fixSeatedGlutes(this.rig, SEAT, { mode: 'drape', out: QP('gout', [0.006])[0] });
        if (!has('nolapfix')) this.qa.lap = fixSeatedLap(this.rig);
        if (!has('nohemfix')) this.qa.hem = fixSeatedHem(this.rig);
        if (!has('nocalm')) this.qa.fabric = calmFabric(this.rig);
      } else if (!has('noglutefix')) this.qa.glutes = fixSeatedGlutes(this.rig, SEAT, { mode: 'lobes', depth: 0.035 });
    } catch (e) { console.warn('cloth fix skipped', e); }
  }

  // ---------- تحويلات إطار العود ----------
  W(p) { return this.oud.root.localToWorld(new THREE.Vector3(p[0], p[1], p[2])); }
  Wd(d) { return v3(d).applyQuaternion(this.oud.root.quaternion); }
  Lw(p) { if (!this._invM || this._invF !== this._frame) { this._invM = this.oud.root.matrixWorld.clone().invert(); this._invF = this._frame; } return p.clone().applyMatrix4(this._invM); }

  // ---------- عمق نقطة (إطار العود) داخل جسم العود: القصعة + الزند + لوح الوجه ----------
  insideOud(q, margin = 0) {
    let worst = -Infinity;
    if (q.y > OUD.yBot && q.y < OUD.yJoint + 0.004) {
      const w = OUD.w(q.y), d = OUD.d(q.y);
      if (w > 1e-3 && q.z < 0) {
        const r = Math.hypot(q.x / w, q.z / d), rad = Math.hypot(q.x, q.z) / Math.max(r, 1e-6);
        if (r < 1) worst = Math.max(worst, Math.min((1 - r) * rad, -q.z) + margin);   // داخل القصعة: أقرب مخرج عبر جدارها أو عبر الوجه
      } else if (w > 1e-3 && Math.abs(q.x) < w) worst = Math.max(worst, -q.z + margin);  // أمام الوجه: سالب = مسافة عنه
    }
    if (q.y > OUD.yJoint - 0.04 && q.y < OUD.yNut + 0.004) {
      const w = OUD.neckW(q.y), d = OUD.neckD(q.y), top = q.y > OUD.yFbEnd ? OUD.fbTop(q.y) : 0.003;
      if (Math.abs(q.x) < w && q.z < top) {
        const zb = q.z < 0 ? -d * Math.sqrt(Math.max(0, 1 - (q.x / w) ** 2)) : -Infinity;
        if (q.z > zb) { const dx = w - Math.abs(q.x), dzT = top - q.z, dzB = q.z - zb; worst = Math.max(worst, Math.min(dx, dzT, dzB) + margin); }
      }
    }
    return worst;
  }

  // ---------- وضع العود على الجسم ----------
  bodyVerts() {
    if (!this._bv) {
      const rig = this.rig, bones = ['hips', 'spine', 'chest', 'upperChest'].map((k) => rig.b('C', k)).filter(Boolean);
      bones.push(rig.b('L', 'upperLeg'), rig.b('R', 'upperLeg'), rig.b('L', 'lowerLeg'), rig.b('R', 'lowerLeg'));
      if (rig.b('L', 'shoulder')) bones.push(rig.b('L', 'shoulder'), rig.b('R', 'shoulder'));
      this._bv = rig.verts(bones.filter(Boolean), 0.25).filter((_, i) => i % 2 === 0);
    }
    return this._bv;
  }
  bodyPenetration(extra = 0) {
    this._frame = (this._frame || 0) + 1;
    const rig = this.rig, p = new THREE.Vector3(); let worst = -Infinity, at = null;
    for (const e of this.bodyVerts()) { rig.vertexWorld(e.m, e.i, p); const q = this.oud.root.worldToLocal(p.clone()); const d = this.insideOud(q, extra); if (d > worst) { worst = d; at = q; } }
    return { d: worst, at };
  }
  placeOud() {
    const oud = this.oud, rig = this.rig;
    const hc = (this.cfg && this.cfg.hold) || {}, U = new URLSearchParams(location.search);
    const H = { ...HOLD, ...Object.fromEntries(Object.entries({ pitch: hc.pitch, yaw: hc.yaw, tilt: hc.tilt, x: hc.x }).filter(([k, v]) => v != null && !U.has('o' + k))), ...(window.__HOLD || {}) };
    const pitch = H.pitch * DEG, yaw = H.yaw * DEG, tilt = H.tilt * DEG;
    // المحاور: الزند نحو يسار العازف (+X) مرتفعًا (pitch) ومتقدّمًا للأمام (yaw)، والوجه نحو الجمهور مائلًا للأعلى (tilt)
    let Y = [Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw)];
    let Z = V.norm(V.perp([-Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt)], Y));
    const X = V.cross(Y, Z);
    const m = new THREE.Matrix4().makeBasis(v3(X), v3(Y), v3(Z));
    oud.root.quaternion.setFromRotationMatrix(m);
    // البداية: أمام الجسم بمسافة كافية وفوق الفخذين، ثم يُقرَّب العود (على اتجاه −Z) حتى يلامس البطن، ويُنزَّل حتى يرتكز على الفخذ الأيمن
    const hips = rig.wp('C', 'hips');
    const kneeR = this.knee.R;
    oud.root.position.set(H.x, hips.y + 0.45, hips.z + 0.55);
    oud.root.updateMatrixWorld(true);
    // الاقتراب أفقيًا نحو البطن، مع الانزلاق فوق الفخذ (يرتفع قليلًا إن لامس الفخذ ثم يكمل)، ثم الاستقرار للأسفل
    const back = new THREE.Vector3(0, 0, -1), down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(0, 1, 0);
    const P = () => oud.root.position, upd = () => oud.root.updateMatrixWorld(true);
    const hit = () => this.bodyPenetration(H.gap).d > 0;
    const settle = (step) => { for (let i = 0; i < 200; i++) { P().addScaledVector(down, step); upd(); if (hit()) { P().addScaledVector(down, -step); upd(); return; } } };
    settle(0.004);
    for (let i = 0; i < 200; i++) {
      const save = P().clone();
      P().addScaledVector(back, 0.003); upd();
      let lifted = 0; while (hit() && lifted < 0.03) { P().addScaledVector(up, 0.0015); upd(); lifted += 0.0015; }
      if (hit()) { P().copy(save); upd(); break; }
      settle(0.0015);
    }
    // دقة أعلى
    for (let i = 0; i < 6; i++) { P().addScaledVector(back, 0.001); upd(); if (hit()) { P().addScaledVector(back, -0.001); upd(); break; } }
    settle(0.0008);
    this.qa.oudGapMm = +(-this.bodyPenetration(0).d * 1000).toFixed(1);
    this.oudPlace = { p: oud.root.position.clone(), q: oud.root.quaternion.clone() };
    this.qa.oud = { pos: ar(oud.root.position).map((v) => +v.toFixed(3)), kneeR: kneeR.map((v) => +v.toFixed(3)) };
  }

  // ---------- قبضة الريشة: وضعية ثابتة لأصابع اليمنى في إطار الكف + موضع الريشة فيها ----------
  buildGrip() {
    const hm = this.hand.R, side = -1;                    // اليمنى: +x نحو الخنصر (الإبهام في −x)
    const H = (v) => [v[0] * side, v[1], v[2]];
    const fk = (i) => H(hm.fingers[i].k), Lf = (i) => hm.fingers[i].L[0] + hm.fingers[i].L[1] + hm.fingers[i].L[2];
    // أطراف الأصابع المنثنية (قبضة رخوة): السبابة منثنية أقل (تحمل الريشة بجانب سلاميتها الوسطى)، والبقية أكثر نحو الراحة
    const G = QP('grip', [0.42, 0.50, 0.56, 0.60]);       // كسور من طول الإصبع: مقدار الانثناء نحو الراحة
    const tips = [0, 1, 2, 3].map((i) => { const k = fk(i), L = Lf(i), g = G[i]; return [k[0] * 0.92, k[1] + L * (0.62 - g * 0.55), k[2] - L * (0.35 + g * 0.6)]; });
    const chains = tips.map((t, i) => fingerArch(hm.fingers[i], side, t, [0, 1, 0.6], 0.8));
    // الريشة بين باطن الإبهام وجانب السلامية الوسطى للسبابة
    const idx = chains[0], ip = V.lerp(idx[1], idx[2], 0.55);
    const radial = [-1 * side * -1, 0, 0];                 // جهة الإبهام في إطار اليد اليمنى (−x)
    void radial;
    const gripPt = V.add(ip, [side * hm.fingers[0].r[1] * 1.15, 0.0, -0.002]);          // ملاصق لجانب السبابة من جهة الإبهام
    const th = hm.thumb, thumbTip = V.add(gripPt, [side * (0.0012 + RISHA.t + th.r[2] * 0.95), 0.004, 0.002]);
    const thumbPts = thumbChain(th, side, thumbTip, V.norm([0.6 * -side, 0.75, -0.35]), [0, 0.6, 0.6]);
    // اتجاه الريشة داخل القبضة: تخرج من بين الإبهام والسبابة نحو الأمام-الأسفل (جهة الراحة) ومؤخرتها تحت الكف
    const dirL = V.norm(QP('gdir', [-0.10, 0.75, -0.65]));
    this.grip = { chains, thumbPts, gripPt, dirL };
  }

  // ---------- اليد اليسرى ----------
  // st.f: { 1..4: { course, semis, amt (0..1 الضغط), lift } } ؛ st.pos: موضع اليد على الزند (الوضع الأول افتراضيًا)
  solveLeft(st) {
    const rig = this.rig, hm = this.hand.L, side = 1;
    const xo = ar(this.Wd([1, 0, 0])), yo = ar(this.Wd([0, 1, 0])), zo = ar(this.Wd([0, 0, 1]));
    // إطار الكف: x نحو الإبهام = نحو الأنف تقريبًا، y من الرسغ إلى الأصابع = نحو الأعلى (−x العود) ومائل للأمام، z = ظهر اليد نحو الجمهور
    const LY = this.P.lydir, yh0 = V.norm(V.comb(xo, LY[0], yo, LY[1], zo, LY[2]));
    const xh = V.norm(V.perp(yo, yh0)), zh = V.cross(xh, yh0), yh = yh0;
    // الأهداف: الأصابع الضاغطة على مواضع النغمات؛ والحرة تُحسب بعد معرفة موضع الكف (ارتخاء طبيعي فوق الأوتار)
    const yRef = OUD.stopY(3);
    const tgt = [], press = [];
    for (let f = 1; f <= 4; f++) {
      const pr = st.f[f];
      if (pr && pr.amt > 0) {
        const y = OUD.stopY(pr.semis), c = pr.course, r = c < 3 ? 0.00058 - c * 0.00005 : 0.00042 - (c - 3) * 0.00003;
        const zP = OUD.fbTop(y) + 2 * r + PAD + (this.corrL[f] || 0), zH = OUD.zStr(y) + L_HOVER;
        const z = zH + (zP - zH) * clamp(pr.amt, 0, 1);
        const yy = y - 0.0035;                                       // مركز باطن الطرف على موضع النغمة تمامًا تقريبًا
        tgt.push(this.W([OUD.courseX(c, yy), yy, z])); press.push(pr.amt);
      } else { tgt.push(null); press.push(0); }
    }
    // موضع الكف: جذر الوسطى تحت الحافة الحادة للزند (جهة الكردان) قرب موضع البنصر
    const LA = this.P.lanc, yA = yRef + LA[1] + (st.shift || 0);
    const anchorLocal = [OUD.neckW(yA) + LA[0] + this.hOut * 0.6, yA, LA[2] + this.hOut * 0.8];
    const anchor = ar(this.W(anchorLocal));
    const mid = hm.fingers[1];
    let O = V.sub(anchor, V.comb(xh, mid.k[0] * side, yh, mid.k[1], zh, mid.k[2]));
    // الأصابع تبلغ أهدافها: إن كان هدف أبعد من مدى إصبع تقترب الكف بالقدر اللازم فقط
    const reachOf = (i) => { const fd = hm.fingers[i]; return { base: V.add(O, V.comb(xh, fd.k[0] * side, yh, fd.k[1], zh, fd.k[2])), lim: 0.9 * (fd.L[0] + fd.L[1] + fd.L[2]) }; };
    for (let it = 0; it < 6; it++) {
      let worst = 0, mv = null;
      for (let i = 0; i < 4; i++) { if (!press[i]) continue; const { base, lim } = reachOf(i), dv = V.sub(ar(tgt[i]), base), D = V.len(dv), ex = D - lim; if (ex > worst) { worst = ex; mv = V.mul(dv, ex / D); } }
      if (!mv || worst < 2e-4) break; O = V.add(O, mv);
    }
    const toL = (q) => { const d = V.sub(q, O); return [V.dot(d, xh), V.dot(d, yh), V.dot(d, zh)]; };
    // الأصابع الحرة: معلّقة فوق الأوتار قرب مواضعها المعتادة (السبابة عند الدرجة الكاملة … الخنصر عند الرابعة)،
    // على مسافة لا تقل عن 80% من طول الإصبع عن جذره (انثناء مرتخٍ لا قبضة)، ثم فوق مستوى الأوتار بهامش.
    for (let i = 0; i < 4; i++) {
      if (tgt[i]) continue;
      const fd = hm.fingers[i], Lf = fd.L[0] + fd.L[1] + fd.L[2], f = i + 1;
      const y = OUD.stopY([0, 2, 3, 4, 5][f]) - 0.004, c = clamp(this.state && this.state.L.lastCourse != null ? this.state.L.lastCourse : 3, 2, 4);
      let q = v3([OUD.courseX(c, y) + 0.003 * (f - 2), y, OUD.zStr(y) + L_HOVER + 0.002 * f + (this.fLift[f] || 0)]);
      const mcp = this.Lw(v3(V.add(O, V.comb(xh, fd.k[0] * side, yh, fd.k[1], zh, fd.k[2]))));
      const dv = q.clone().sub(mcp), D = dv.length(), Dmin = 0.8 * Lf;
      if (D < Dmin) q = mcp.clone().addScaledVector(dv.normalize(), Dmin);
      const zMin = OUD.zStr(q.y) + L_HOVER * 0.6 + (this.fLift[f] || 0); if (q.z < zMin) q.z = zMin;
      tgt[i] = this.oud.root.localToWorld(q);
    }
    // استمرارية الحركة: حين يتغير هدف إصبع (من التعليق إلى وتر، أو من وتر إلى آخر) يبدأ مساره من موضعه السابق (لا قفزات)
    this._lb = this._lb || []; this._lt = this._lt || [];
    for (let i = 0; i < 4; i++) {
      const pr = st.f[i + 1], key = pr && pr.amt > 0 ? pr.course + ':' + pr.semis : 'hover';
      let bl = this._lb[i];
      if (!bl || bl.key !== key) bl = this._lb[i] = { key, from: this._lt[i] ? this._lt[i].clone() : null, t: 0 };
      if (bl.from && bl.t < 0.12 && !(pr && pr.amt > 0.92)) { const u = bl.t / 0.12, e = u * u * (3 - 2 * u); tgt[i] = bl.from.clone().lerp(tgt[i], e); }
      bl.t += this.dt || 1 / 60;
    }
    this._lt = tgt.map((v) => v.clone());
    let chains = [0, 1, 2, 3].map((i) => fingerArch(hm.fingers[i], side, toL(ar(tgt[i])), [0, 1, 0.7], 0.72));
    // لا تدخل سلاميات الأصابع في الزند: يُرفع هدف الإصبع الحر، ويُبعد الضاغط قليلًا نحو الأمام
    const Wh = (q) => this.Lw(v3(V.add(O, V.comb(xh, q[0], yh, q[1], zh, q[2]))));
    for (let i = 0; i < 4; i++) {
      for (let it = 0; it < 6; it++) {
        let worst = -1; const c = chains[i];
        for (const [a, b] of [[c[0], c[1]], [c[1], c[2]], [c[2], c[3]]]) for (const u of [0.25, 0.6, 1]) { const q = Wh(V.lerp(a, b, u)); worst = Math.max(worst, this.insideOud(q, hm.fingers[i].r[1] * 1.3)); }
        if (worst <= 0) break;
        const up = press[i] ? ar(this.Wd([-0.6, 0, 0.8])) : ar(this.Wd([0, 0, 1]));
        tgt[i] = tgt[i].clone().add(v3(V.mul(up, worst + 0.001)));
        chains[i] = fingerArch(hm.fingers[i], side, toL(ar(tgt[i])), [0, 1, 0.7], 0.72);
      }
    }
    // الإبهام خلف الزند مقابل السبابة/الوسطى: نقطة على السطح الخلفي + سُمك الباطن
    const yT = OUD.stopY(2.4) + (st.shift || 0), wN = OUD.neckW(yT), dN = OUD.neckD(yT);
    const nx = Math.cos(THUMB_TH), nz = -Math.sin(THUMB_TH);
    const nrm = V.norm([nx / wN, 0, nz / dN]);
    const tPad = hm.thumb.r[2] * 0.95 + 0.0015 + (this.corrT || 0);
    const thumbTip = ar(this.W([wN * nx + nrm[0] * tPad, yT, dN * nz + nrm[2] * tPad]));
    let thumb = thumbChain(hm.thumb, side, toL(thumbTip), V.norm(THUMB_DIR), [0, 0.5, -0.6]);
    const fr = Frame(O, xh, yh, zh);
    this.handLFrame = fr;
    this.poseArm('L', fr, L_POLE);
    poseFingers(rig, hm, fr, chains, thumb);
    this.lTargets = tgt; this.lChains = chains; this.lThumb = thumb;
    this.qa.thumbShortL = +((thumb.short || 0) * 1000).toFixed(1);
  }

  // ---------- اليد اليمنى والريشة ----------
  // st.tip: موضع طرف الريشة في إطار العود؛ st.flex: انثناء الرسغ (يدير الريشة حول القبضة أثناء الضرب)
  solveRight(st) {
    const rig = this.rig, hm = this.hand.R, g = this.grip;
    const flex = (st.flex || 0) * DEG;
    // إطار الكف في إطار العود: الأصابع (من الرسغ إلى المفاصل) نحو الأسفل وقليلًا نحو الوجه، وظهر الكف نحو الجمهور/الأعلى.
    // الإبهام في جهة الزند والخنصر في جهة الفرس. انثناء الرسغ يدير الكف حول محور موازٍ للزند فيمسح طرف الريشة عبر الأوتار.
    const ax = [0, 1, 0];
    let yhL = V.norm(this.P.ryh), zhL = V.norm(V.perp(R_ZH, yhL));
    yhL = V.rot(yhL, ax, flex); zhL = V.rot(zhL, ax, flex);
    const xhL = V.cross(yhL, zhL);
    const xh = ar(this.Wd(xhL)), yh = ar(this.Wd(yhL)), zh = ar(this.Wd(zhL));
    const toW = (q) => V.comb(xh, q[0], yh, q[1], zh, q[2]);
    const dW = V.norm(toW(g.dirL));
    const tipW = ar(this.W(st.tip));
    const gripW = V.madd(tipW, dW, -this.P.prot);
    const O = V.sub(gripW, toW(g.gripPt));
    const fr = Frame(O, xh, yh, zh);
    this.handRFrame = fr;
    // المرفق: يُبحث كل إطار حول الزاوية الحالية (±4°) عن موضع يبقي الساعد مستندًا على حافة القصعة دون أن يدخلها
    const sh = ar(rig.wp('R', 'upperArm')), axA = V.norm(V.sub(O, sh));
    const poleAt = (a) => V.rot(this.rPole || R_POLE, axA, a * DEG);
    const costAt = (a) => { this.poseArm('R', fr, poleAt(a)); const w = this.armClear('R', 6); return { w, c: (w > 0 ? 100 * w : 0) + Math.abs(this.rAng + a) * 0.0006 }; };
    if (this.rAng == null) this.rAng = 0;
    let bestA = 0, bestC = costAt(0);
    const cand = bestC.w > 0.002 ? [-40, -30, -20, -12, -6, 6, 12, 20, 30, 40] : [-4, 4];
    if (bestC.w > -0.002 || Math.abs(this.rAng) > 0.5) for (const a of cand) { const c = costAt(a); if (c.c < bestC.c - 1e-6) { bestC = c; bestA = a; } }
    if (bestA) { this.rPole = poleAt(bestA); this.rAng += bestA; }
    this.poseArm('R', fr, this.rPole || R_POLE);
    this.qa.rArmMm = +(bestC.w * 1000).toFixed(1);
    poseFingers(rig, hm, fr, g.chains, g.thumbPts);
    this.rishaTip = tipW; this.rishaDir = dW; this.rishaGrip = gripW;
  }
  // ---------- كُمّ الساعد الأيمن يستقر على حافة القصعة (قماش لين): رؤوس الكُمّ الداخلة في العود تُزاح إلى سطحه ----------
  // تُحسب الإزاحة في فضاء الربط بمعكوس مصفوفة الجلد لكل رأس (كما في تصحيحات الثوب)، وتُعاد الرؤوس إلى أصلها حين تبتعد.
  sleeveRest() {
    const rig = this.rig;
    if (!this._sl) {
      const bones = [rig.b('R', 'lowerArm'), rig.b('R', 'upperArm'), rig.b('R', 'hand')].filter(Boolean);
      const list = rig.verts(bones, 0.2).filter((e) => !/human|body/i.test(e.m.name));
      const byMesh = new Map(); for (const e of list) { if (!byMesh.has(e.m)) byMesh.set(e.m, []); byMesh.get(e.m).push(e.i); }
      this._sl = [...byMesh.entries()].map(([m, idx]) => ({ m, idx, orig: Float32Array.from(idx.flatMap((i) => [m.geometry.attributes.position.getX(i), m.geometry.attributes.position.getY(i), m.geometry.attributes.position.getZ(i)])), moved: new Uint8Array(idx.length) }));
      this._slTmp = { S: new THREE.Matrix4(), K: new THREE.Matrix4(), inv: new THREE.Matrix4(), p: new THREE.Vector3(), d: new THREE.Vector3() };
    }
    const T = this._slTmp; let maxPush = 0;
    this._slN = (this._slN || 0) + 1; const full = this._slN % 12 === 1;          // فحص كامل كل 12 إطارًا، وبينهما الرؤوس القريبة فقط
    const qOud = this.oud.root.quaternion;
    for (const S of this._sl) {
      const m = S.m, pos = m.geometry.attributes.position; m.updateMatrixWorld(true);
      const BMc = []; const BM = new Proxy(BMc, { get: (a, j) => a[j] || (a[j] = new THREE.Matrix4().multiplyMatrices(m.skeleton.bones[j].matrixWorld, m.skeleton.boneInverses[j])) });
      const pre = new THREE.Matrix4().multiplyMatrices(m.matrixWorld, m.bindMatrixInverse);
      const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
      let dirty = false;
      if (!S.near) S.near = new Uint8Array(S.idx.length).fill(1);
      for (let k = 0; k < S.idx.length; k++) {
        if (!full && !S.near[k] && !S.moved[k]) continue;
        const i = S.idx[k];
        T.S.elements.fill(0);
        for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (!w) continue; const e = BM[si.getComponent(i, j)].elements; for (let q = 0; q < 16; q++) T.S.elements[q] += w * e[q]; }
        const K = T.K.multiplyMatrices(pre, T.S).multiply(m.bindMatrix);
        T.p.set(S.orig[k * 3], S.orig[k * 3 + 1], S.orig[k * 3 + 2]).applyMatrix4(K);
        const q = this.Lw(T.p), dep = this.insideOud(q, 0.0012);
        if (full) S.near[k] = dep > -0.03 ? 1 : 0;
        if (dep > 0) {
          // اتجاه الخروج: عمودي على جدار القصعة (أو على الوجه إن كان أقرب)
          const w = OUD.w(q.y), d = OUD.d(q.y); let n;
          if (q.z < 0 && w > 1e-3 && (1 - Math.hypot(q.x / w, q.z / d)) * Math.hypot(q.x, q.z) < -q.z) n = new THREE.Vector3(q.x / (w * w), 0, q.z / (d * d)).normalize(); else n = new THREE.Vector3(0, 0, 1);
          T.d.copy(n).multiplyScalar(dep).applyQuaternion(qOud);
          T.inv.copy(K).invert();
          const lin = new THREE.Matrix3().setFromMatrix4(T.inv), db = T.d.clone().applyMatrix3(lin);
          pos.setXYZ(i, S.orig[k * 3] + db.x, S.orig[k * 3 + 1] + db.y, S.orig[k * 3 + 2] + db.z); S.moved[k] = 1; dirty = true; maxPush = Math.max(maxPush, dep);
        } else if (S.moved[k]) { pos.setXYZ(i, S.orig[k * 3], S.orig[k * 3 + 1], S.orig[k * 3 + 2]); S.moved[k] = 0; dirty = true; }
      }
      if (dirty) { pos.needsUpdate = true; }
    }
    this.qa.sleevePushMm = +(maxPush * 1000).toFixed(1);
  }
  placeRisha(mesh) {
    if (!mesh || !this.rishaTip) return;
    // y المحلي للريشة: من الطرف نحو المؤخرة؛ نوجّهه عكس dW، والعرض عموديًا على الأوتار تقريبًا (على امتداد الزند)
    const yv = V.mul(this.rishaDir, -1), xv0 = ar(this.Wd([0, 1, 0]));
    const xv = V.norm(V.perp(xv0, yv)), zv = V.cross(xv, yv);
    const m = new THREE.Matrix4().makeBasis(v3(xv), v3(yv), v3(zv)).setPosition(v3(this.rishaTip));
    mesh.matrixAutoUpdate = false; mesh.matrix.copy(m); mesh.matrixWorldNeedsUpdate = true; mesh.updateMatrixWorld(true);
  }

  pose(state) {
    this.state = state; this._frame = (this._frame || 0) + 1;
    if (!this.corrL) { this.corrL = { 1: 0, 2: 0, 3: 0, 4: 0 }; this.corrT = 0; this.fLift = { 1: 0, 2: 0, 3: 0, 4: 0 }; this.hOut = 0; }
    this.oud.root.updateMatrixWorld(true);
    this.solveLeft(state.L);
    this.solveRight(state.R);
    this.sleeveRest();
    this.updateContact();
    // تصحيح فوري في الإطار نفسه إن دخل طرف إصبع ضاغط تحت سطح الوتر (لا يظهر اختراق ولو لإطار واحد)
    for (let it = 0; it < 3 && (Object.values(this.gapL).some((g) => g < -0.0004) || this.fPen > 0.0008); it++) { this.solveLeft(state.L); this.updateContact(); }
  }

  // ---------- ملامسة صادقة: طرف الإصبع الضاغط على الوتر لا فوقه ولا داخله، والإبهام على ظهر الزند ----------
  tipVerts(f) {
    this._tv = this._tv || {};
    if (!this._tv[f]) { const rig = this.rig, nm = f === 0 ? 'thumb' : FINGERS[f - 1], b3 = rig.b('L', nm + '3'), b2 = rig.b('L', nm + '2'); this._tv[f] = [...(b3 ? rig.verts([b3], 0.3).map((e) => ({ ...e, distal: true })) : []), ...(b2 ? rig.verts([b2], 0.6) : [])]; }
    return this._tv[f];
  }
  updateContact() {
    const rig = this.rig, p = new THREE.Vector3(), st = this.state.L;
    this.gapL = {};
    for (let f = 1; f <= 4; f++) {
      const pr = st.f[f]; if (!pr || pr.amt < 0.25) { this.corrL[f] *= 0.9; continue; }
      const y = OUD.stopY(pr.semis), c = pr.course, r = c < 3 ? 0.00058 - c * 0.00005 : 0.00042 - (c - 3) * 0.00003;
            let gap = Infinity;
      for (const e of this.tipVerts(f)) {
        if (!e.distal) continue;
        rig.vertexWorld(e.m, e.i, p); const q = this.Lw(p);
        if (Math.abs(q.x) > OUD.fbHalfW(q.y) || Math.abs(q.y - (y - 0.0035)) > 0.016 || q.z < OUD.fbTop(q.y) - 0.008) continue;   // كل جلد الطرف فوق اللوحة لا يهبط تحت أعلى الوتر
        gap = Math.min(gap, q.z - (OUD.fbTop(q.y) + 2 * r));            // فوق الوتر المضغوط (الوتر على اللوحة)
      }
      this.gapL[f] = gap;
      if (!isFinite(gap)) continue;
      if (pr.amt >= 0.9) this.corrL[f] = clamp(this.corrL[f] + clamp((0.0004 - gap) * 0.5, -0.0008, gap < -0.001 ? 0.0025 : 0.0008), -0.012, 0.012);
      else if (gap < 0) this.corrL[f] = clamp(this.corrL[f] - gap + 0.0003, -0.012, 0.012);     // أثناء النزول: لا يهبط الطرف تحت الوتر
    }
    // جلد الأصابع لا يدخل الزند: الإصبع الحر يرتفع، وإن كان الدخول من إصبع ضاغط تبتعد الكف قليلًا عن الزند
    let outNeed = 0; this.fPen = 0;
    for (let f = 1; f <= 4; f++) {
      if (!this._fv) this._fv = {};
      if (!this._fv[f]) { const nm = FINGERS[f - 1]; this._fv[f] = rig.verts([1, 2, 3].map((k) => rig.b('L', nm + k)).filter(Boolean), 0.3).filter((_, i) => i % 4 === 0); }
      let worst = 0;
      for (const e of this._fv[f]) { rig.vertexWorld(e.m, e.i, p); const q = this.Lw(p); worst = Math.max(worst, this.insideOud(q)); }
      const pr = st.f[f], pressing = pr && pr.amt > 0.5;
      this.fPen = Math.max(this.fPen, worst);
      // السلامية الأولى (قاعدة الإصبع) لا تتحرك برفع الطرف: إن لامست حافة الزند تبتعد الكف كلها
      if (pressing) { outNeed = Math.max(outNeed, worst); this.fLift[f] *= 0.9; }
      else this.fLift[f] = clamp(worst > 0.0003 ? this.fLift[f] + worst + 0.0006 : this.fLift[f] * 0.97, 0, 0.02);
    }
    for (let f = 1; f <= 4; f++) { const b1 = rig.b('L', FINGERS[f - 1] + '1'); if (!b1) continue; this._p1 = this._p1 || {}; if (!this._p1[f]) this._p1[f] = rig.verts([b1], 0.3).filter((_, i) => i % 4 === 0);
      for (const e of this._p1[f]) { rig.vertexWorld(e.m, e.i, p); outNeed = Math.max(outNeed, this.insideOud(this.Lw(p))); } }
    this.hOut = clamp(outNeed > 0.0003 ? this.hOut + outNeed * 0.8 + 0.0003 : this.hOut * 0.985, 0, 0.016);
    // الإبهام: أقرب جلد إلى ظهر الزند
    let tg = Infinity;
    for (const e of this.tipVerts(0)) { rig.vertexWorld(e.m, e.i, p); const q = this.Lw(p); const d = this.insideOud(q); if (d > -0.02) tg = Math.min(tg, -d); }
    this.gapT = tg;
    if (isFinite(tg)) this.corrT = clamp(this.corrT + clamp((0.0006 - tg) * 0.5, -0.0008, 0.0016), -0.008, 0.01);
  }

  // ---------- قياسات الجودة ----------
  /** أعمق دخول لجلد اليدين/الذراعين/الجسم في العود، ودخول الريشة في الوجه أو الأصابع (مم) */
  penetration() {
    const rig = this.rig, p = new THREE.Vector3(), out = {};
    const handBones = (s) => ['hand', 'thumb1', 'thumb2', 'thumb3', ...FINGERS.flatMap((f) => [1, 2, 3].map((i) => f + i))].map((n) => rig.b(s, n)).filter(Boolean);
    for (const s of ['L', 'R']) {
      let worst = -Infinity, where = null;
      for (const bn of [...handBones(s), rig.b(s, 'lowerArm'), rig.b(s, 'upperArm')].filter(Boolean)) for (const e of rig.verts([bn], 0.35)) {
        rig.vertexWorld(e.m, e.i, p); const q = this.Lw(p), d = this.insideOud(q);
        if (d > worst) { worst = d; where = [bn.name, e.m.name, ...ar(q).map((v) => +v.toFixed(3))]; }
      }
      out[s] = { maxMm: +(Math.max(0, worst) * 1000).toFixed(1), at: worst > 0 ? where : null };
    }
    const b = this.bodyPenetration(0); out.body = { maxMm: +(Math.max(0, b.d) * 1000).toFixed(1) };
    { let w = -Infinity; for (const bn of [rig.b('R', 'lowerArm'), rig.b('R', 'upperArm')]) for (const e of rig.verts([bn], 0.35)) { if (!/human|body/i.test(e.m.name)) continue; rig.vertexWorld(e.m, e.i, p); w = Math.max(w, this.insideOud(this.Lw(p))); } out.armSkinR = +(Math.max(0, w) * 1000).toFixed(1); }
    // الريشة: الطرف لا يلمس الوجه، ولا تخترق الأصابع (المسافة إلى محاور السلاميات أكبر من نصف قطرها)
    if (this.rishaTip) {
      const tl = this.Lw(v3(this.rishaTip)); out.rishaFaceMm = +((tl.z - 0) * 1000).toFixed(1);
      out.rishaFinger = this.rishaFingerGap();
    }
    return out;
  }
  rishaFingerGap() {
    const fr = this.handRFrame, hm = this.hand.R, g = this.grip; if (!fr) return null;
    const W = (q) => F.pt(fr, q);
    let worst = Infinity, at = null;
    const segs = [];
    g.chains.forEach((c, i) => { for (let j = 0; j < 3; j++) segs.push([W(c[j]), W(c[j + 1]), hm.fingers[i].r[j], FINGERS[i] + (j + 1)]); });
    for (let j = 1; j < 3; j++) segs.push([W(g.thumbPts[j]), W(g.thumbPts[j + 1]), hm.thumb.r[j], 'thumb' + (j + 1)]);
    for (let k = 0; k <= 20; k++) {
      const s = this.P.prot * 0.3 + (RISHA.len - this.P.prot * 0.3) * k / 20;
      const pt = V.madd(this.rishaTip, this.rishaDir, -s);
      for (const [a, b, r, nm] of segs) { const ab = V.sub(b, a), t = clamp(V.dot(V.sub(pt, a), ab) / V.dot(ab, ab), 0, 1), d = V.dist(pt, V.madd(a, ab, t)) - r - RISHA.t / 2; if (d < worst) { worst = d; at = nm + '@' + (s * 100).toFixed(1) + 'cm'; } }
    }
    return { mm: +(worst * 1000).toFixed(1), at };
  }
  report() { return { ...this.qa, gapL: this.gapL, gapT: this.gapT }; }
}
