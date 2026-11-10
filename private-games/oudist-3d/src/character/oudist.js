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
import { OUD, RISHA, shapeRisha } from '../instrument/oud-model.js';
import { fixSeatedGlutes, fixSeatedLap, fixSeatedHem, calmFabric } from './dish-fix.js';
import { buildSeatedRobe } from './robe.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const ar = (v) => [v.x, v.y, v.z];
const QP = (k, d) => { const q = new URLSearchParams(location.search).get(k); return q ? q.split(',').map(Number) : d; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const DEG = Math.PI / 180;

// ---------- ثوابت قابلة للضبط عبر الرابط (للمعايرة فقط) ----------
const HOLD = { pitch: QP('opitch', [22])[0], yaw: QP('oyaw', [6])[0], tilt: QP('otilt', [7])[0], x: QP('ox', [-0.05])[0], gap: QP('ogap', [0.004])[0] };
// اليد اليسرى (قواعد مستخلصة من تعليم العود: الإبهام مرتكز خلف الزند، الأصابع مقوّسة تنزل بأطرافها، وتبقى قريبة من الأوتار):
const L_PALM = QP('lpalm', [0.030, -0.004, 0.042]);       // موضع طرف الوسطى (على الوتر النشط) نسبةً إلى جذرها في إطار الكف: (أمام الجذر باتجاه الأصابع، نحو الفرس، نحو الراحة) بالمتر — قوس طبيعي
const L_YDIR = QP('lydir', [-0.5, 0.18, 0.87]);           // اتجاه الكف (من الرسغ إلى الأصابع) في إطار العود؛ المركّبة الثانية تقرّب جهة الخنصر من الزند
const L_POLE = QP('lpole', [0.35, -0.55, -0.6]);          // قطب مرفق اليسرى (عالمي، نسبةً إلى الكتف)
const L_HOVER = QP('lhov', [0.008])[0];                    // ارتفاع لحم الأطراف الحرة فوق الأوتار (قريبة من اللوحة: «لا ترفع أصابعك بعيدًا»)
const PAD = QP('pad', [0.0072])[0];                        // سُمك لحم الطرف فوق الوتر
const TIP_BACK = 0.0035;                                   // مركز باطن الطرف على موضع النغمة (نهاية العظمة أقرب إلى الأنف بهذا القدر)
const HOME = [2, 3, 4, 5];                                 // «بيت» كل إصبع في الوضع الأول: السبابة عند الدرجة الكاملة … الخنصر عند الرابعة
const R_MAX = 0.92, R_MIN = 0.42;                          // حدود مدّ الإصبع الضاغط (نسبة من طوله): أبعد من ذلك تقترب الكف، وأقرب تبتعد
const LEAN = QP('lean', [0.12])[0];                        // ميل الجذع للأمام (راديان)
const PALM_K = QP('lk', [0.5])[0];                          // نسبة تتبّع الكف للوتر النشط (حول وتر الدوكاه)
const HAND_W = QP('lw', [13])[0];                          // سرعة انتقال الكف بين الأوتار/الأوضاع (تخميد حرج)
const THUMB_TH = QP('tth', [78])[0] * DEG;                 // الزاوية المفضّلة لموضع الإبهام حول ظهر الزند (90° = منتصف الظهر)؛ تقل تلقائيًا إن لم يبلغها الإبهام
const THUMB_DIR = QP('tdir', [0.2, 0.75, -0.6]);
const R_POLE = QP('rpole', [-0.75, -0.1, -0.55]);
const R_YH = QP('ryh', [0.70, -0.10, -0.70]);            // اتجاه أصابع اليمنى (من الرسغ إلى المفاصل) في إطار العود
const R_ZH = QP('rzh', [-0.45, 0.0, 0.85]);             // ظهر الكف اليمنى في إطار العود
const PROTRUDE = QP('prot', [0.022])[0];                   // المسافة من طرف الريشة إلى مركز القرص (يبرز خارج الإبهام نحو 1 سم)

export class Oudist extends SeatedPlayer {
  constructor(rig, config, oud) { super(rig, config); this.oud = oud; }

  setup() {
    // ثوابت الحمل واليدين لكل شخصية (أطوال الجسم واليدين مختلفة): من config.js، ويمكن تجاوزها بالرابط أثناء المعايرة
    const hold = (this.cfg && this.cfg.hold) || {}, has = (k) => new URLSearchParams(location.search).has(k);
    const pick = (k, def) => (has(k) ? QP(k, def) : (hold[k] ?? def));
    this.P = { lpalm: pick('lpalm', L_PALM), lydir: pick('lydir', L_YDIR), ryh: pick('ryh', R_YH), prot: has('prot') ? PROTRUDE : (hold.prot ?? PROTRUDE) };
    this.stoolH = has('stool') ? QP('stool', [0])[0] : (hold.stool ?? 0);
    this.baseSetup();
    this.fixCloth();
    this.head = { yaw: QP('hy', [0.10])[0], pitch: QP('hp', [0.36])[0], roll: QP('hr', [0.05])[0] };   // ينظر إلى الزند واليدين
    this.applyHead(this.head.yaw, this.head.pitch, this.head.roll);
    this.placeOud();
    this.buildRobe();
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
    const rig = this.rig, root = rig.root;
    const hipsY0 = 0.535 * (this.rig.height / 1.72);
    const placeHips = (y) => { const mid = rig.wp('L', 'upperLeg').add(rig.wp('R', 'upperLeg')).multiplyScalar(0.5); root.position.x += -mid.x; root.position.y += y - mid.y; root.position.z += 0.05 - mid.z; root.updateMatrixWorld(true); };
    rig.resetToRest();
    const sp = rig.b('C', 'spine');
    // ميل الجذع قليلًا إلى الأمام فوق العود (ظهر مستقيم غير متصلّب): يقرّب الكتفين من الزند فلا تمتد الذراع اليسرى كاملة ولا ينكسر الرسغ
    if (sp) rig.setWorldQuaternion(sp, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), LEAN).multiply(rig.worldQ(sp)));
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
    if (!this.stoolH) return;
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
      } else {
        const fm = new URLSearchParams(location.search).get('fcloth') || 'drape';
        if (fm === 'lobes') this.qa.glutes = fixSeatedGlutes(this.rig, SEAT, { mode: 'lobes', depth: 0.035 });
        else {
          if (!has('noglutefix')) this.qa.glutes = fixSeatedGlutes(this.rig, SEAT, { mode: 'drape', out: QP('gout', [0.012])[0] });
        }
      }
    } catch (e) { console.warn('cloth fix skipped', e); }
  }

  // دشداشة العازفة الساترة (robe.js): تُبنى بعد وضع العود، فينضغط القماش تحته كما في الواقع ولا يخترقه
  buildRobe() {
    const U = new URLSearchParams(location.search), male = this.cfg && this.cfg.gender === 'male';
    if (male || U.has('norobe') || U.get('fcloth') === 'lobes') return;
    try {
      const oc = (this.cfg && this.cfg.outfit) || {}, q = new THREE.Vector3(), qO = this.oud.root.quaternion;
      const press = (x, y, z) => {
        for (let it = 0; it < 3; it++) {
          const l = this.Lw(q.set(x, y, z)), dep = this.insideOud(l, 0.003); if (!(dep > 0)) break;
          const w = OUD.w(l.y), d = OUD.d(l.y); let n;
          if (l.z < 0 && w > 1e-3 && (1 - Math.hypot(l.x / w, l.z / d)) * Math.hypot(l.x, l.z) < -l.z) n = new THREE.Vector3(l.x / (w * w), 0, l.z / (d * d)).normalize(); else n = new THREE.Vector3(0, 0, 1);
          n.multiplyScalar(dep + 0.0005).applyQuaternion(qO); x += n.x; y += n.y; z += n.z;
        }
        return [x, y, z];
      };
      this.qa.robe = buildSeatedRobe(this.rig, SEAT, { color: oc.dishdasha, gold: oc.embroidery, teal: oc.embroidery2, press });
      this._bv = null;
    } catch (e) { console.warn('robe skipped', e); }
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

  // مسافة موقّعة تقريبية من نقطة (إطار العود) إلى سطح الزند (ظهر نصف بيضاوي + لوحة الأصابع): موجبة خارجه
  neckDist(q) {
    const w = OUD.neckW(q.y), d = OUD.neckD(q.y), top = OUD.fbTop(q.y);
    if (q.z >= 0) { const dx = Math.abs(q.x) - w, dz = q.z - top; return dx > 0 && dz > 0 ? Math.hypot(dx, dz) : Math.max(dx, dz); }
    const r = Math.hypot(q.x / w, q.z / d), rad = Math.hypot(q.x, q.z);
    return r > 1e-6 ? (r - 1) * rad / r : -Math.min(w, d);
  }

  // ---------- وضع العود على الجسم ----------
  bodyVerts() {
    if (!this._bv) {
      const rig = this.rig, bones = ['hips', 'spine', 'chest', 'upperChest'].map((k) => rig.b('C', k)).filter(Boolean);
      bones.push(rig.b('L', 'upperLeg'), rig.b('R', 'upperLeg'), rig.b('L', 'lowerLeg'), rig.b('R', 'lowerLeg'));
      if (rig.b('L', 'shoulder')) bones.push(rig.b('L', 'shoulder'), rig.b('R', 'shoulder'));
      this._bv = rig.verts(bones.filter(Boolean), 0.25).filter((_, i) => i % 2 === 0);
      const robe = rig.meshes.find((m) => m.name === 'Outfit_robe_seated'); if (robe) this._bv = this._bv.filter((e) => e.m !== robe);   // الثوب الفضفاض ينضغط تحت العود ولا يسنده
    }
    return this._bv;
  }
  bodyPenetration(extra = 0) {
    this._frame = (this._frame || 0) + 1;
    const rig = this.rig, p = new THREE.Vector3(); let worst = -Infinity, at = null;
    for (const e of this.bodyVerts()) { rig.vertexWorld(e.m, e.i, p); const q = this.oud.root.worldToLocal(p.clone()); const d = this.insideOud(q, extra); if (d > worst) { worst = d; at = q; } }
    return { d: worst, at };
  }
  // أعلى سطح للفخذين والساقين (مع الثوب) في كل عمود من شبكة أفقية (خلية 12 مم، مع توسيع بخلية واحدة يسد الفراغ بين الرؤوس)
  lapField() {
    const rig = this.rig, p = new THREE.Vector3(), cell = 0.012, map = new Map();
    const bones = ['upperLeg', 'lowerLeg'].flatMap((k) => [rig.b('L', k), rig.b('R', k)]).filter(Boolean);
    for (const e of rig.verts(bones, 0.5)) { if (e.m.name === 'Outfit_robe_seated') continue; rig.vertexWorld(e.m, e.i, p); const k = Math.round(p.x / cell) + ':' + Math.round(p.z / cell); const y = map.get(k); if (y == null || p.y > y) map.set(k, p.y); }
    return (x, z) => { const i = Math.round(x / cell), j = Math.round(z / cell); let h = -Infinity; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const y = map.get((i + a) + ':' + (j + b)); if (y != null && y > h) h = y; } return h; };
  }
  // نقاط على حافة الوجه وسطح القصعة (إطار العود) يُختبر بها الارتكاز على الحِجر
  oudSupportSamples() {
    const out = [];
    for (let i = 0; i <= 48; i++) {
      const y = OUD.yBot + (OUD.yJoint - OUD.yBot) * i / 48, w = OUD.w(y), d = OUD.d(y);
      for (let j = 0; j <= 12; j++) { const th = Math.PI * j / 12; out.push([w * Math.cos(th), y, -d * Math.sin(th)]); }
    }
    return out;
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
    // الحِجر كسطح ارتفاعات: حافة الوجه رفيعة كالإسفين فتنفذ بين رؤوس شبكة الفخذ دون أن يكشفها اختبار «رأس داخل المجسم»،
    // فيبدو العود ساقطًا بين الفخذين. لذلك تُختبر نقاط من حافة العود وقصعته مقابل أعلى سطح للفخذين في كل عمود (X,Z).
    const lap = this.lapField(), samples = this.oudSupportSamples(), sp = new THREE.Vector3();
    const lapHit = () => { for (const q of samples) { sp.set(q[0], q[1], q[2]).applyMatrix4(oud.root.matrixWorld); if (sp.y < lap(sp.x, sp.z) + H.gap) return true; } return false; };
    const hit = () => this.bodyPenetration(H.gap).d > 0 || lapHit();
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
  // ---------- مسكة الريشة (الطريقة التقليدية المعتمدة في تعليم العود) ----------
  // • الريشة بين باطن الإبهام (من فوق) وطرف السبابة (يسندها من تحت)، ولا يبرز منها خارج القبضة إلا نحو سنتيمتر واحد.
  // • الإبهام مستقيم أو منحنٍ قليلًا (مفصله لا يبرز)، ممتد على امتداد السبابة.
  // • ذيل الريشة يدخل الراحة ثم ينحني داخلها ويخرج عند قاعدة الكف، وبقية الأصابع ملتفّة حوله برخاوة (قبضة مرتخية لا مشدودة).
  // كل شيء يُحسب في إطار الكف اليمنى (+x نحو الخنصر، y من الرسغ إلى المفاصل، z ظهر الكف) من قياس يد الشخصية نفسها.
  buildGrip() {
    const hm = this.hand.R, side = -1;
    const H = (v) => [v[0] * side, v[1], v[2]];
    const fk = (i) => H(hm.fingers[i].k), Lf = (i) => hm.fingers[i].L[0] + hm.fingers[i].L[1] + hm.fingers[i].L[2];
    const kI = fk(0), LI = Lf(0), th = hm.thumb;
    // اتجاه الطرف البارز: على امتداد الإبهام تقريبًا (نحو الأصابع ونحو الراحة) كأنه «ظفر ممتد»
    const d = V.norm(QP('gdir', [-0.08, 0.78, -0.62]));
    // نقطة القرص: أمام جذر السبابة نحو الراحة، حيث يلتقي باطن الإبهام بطرف السبابة (دائرة «OK» مرتخية)
    const GQ = QP('gq', [-0.0105, 0.10, -0.60]);
    const Q = [kI[0] + GQ[0], kI[1] + LI * GQ[1], kI[2] + LI * GQ[2]];
    // مسار الريشة: مستقيم من الطرف إلى ما بعد القرص، ثم انحناءة داخل الراحة حتى قاعدة الكف (منحنى مستوٍ ⇒ شريط ينثني حول عرضه فقط)
    const E = QP('gend', [0.013, 0.012, -0.027]);                       // مخرج الذيل عند قاعدة الكف (على لحمها)
    const back = V.madd(Q, d, -0.012), C = V.madd(Q, d, -0.052);
    let wAx = V.norm(V.cross(d, V.sub(E, Q)));                          // محور العرض: عمودي على مستوى الانحناء، ثابت على طول الشريط
    if (wAx[0] > 0) wAx = V.mul(wAx, -1);
    const prot = this.P.prot, pts = [V.madd(Q, d, prot), Q.slice(), back];
    for (let i = 1; i <= 22; i++) { const t = i / 22, a = (1 - t) * (1 - t), bq = 2 * t * (1 - t), c = t * t; pts.push([a * back[0] + bq * C[0] + c * E[0], a * back[1] + bq * C[1] + c * E[1], a * back[2] + bq * C[2] + c * E[2]]); }
    { let len = 0; for (let i = 1; i < pts.length; i++) len += V.dist(pts[i], pts[i - 1]); const rest = RISHA.len - len, n = pts.length, e = V.norm(V.sub(pts[n - 1], pts[n - 2])); if (rest > 0.002) pts.push(V.madd(pts[n - 1], e, rest)); }
    // وجه الشريط عند القرص: الإبهام فوقه (جهة ظهر اليد) والسبابة تحته
    let nQ = V.norm(V.cross(wAx, d)); if (nQ[2] < 0) nQ = V.mul(nQ, -1);
    // السبابة: طرفها يسند الريشة من تحت؛ بقية الأصابع قبضة مرتخية تلتف حول الذيل (تنثني أكثر كلما اتجهنا إلى الخنصر)
    const tipI = V.add(V.madd(V.madd(Q, nQ, -(hm.fingers[0].r[2] * 0.75 + RISHA.t / 2)), d, -0.004), [0.0045, 0, 0]);
    const G = QP('grip', [0, 0.30, 0.36, 0.42]);
    const tips = [tipI, ...[1, 2, 3].map((i) => { const k = fk(i), L = Lf(i), g = G[i]; return [k[0] * 0.9 + 0.004, k[1] + L * (0.30 - g * 0.55), k[2] - L * (0.50 + g * 0.12)]; })];
    let chains = tips.map((t, i) => fingerArch(hm.fingers[i], side, t, [0, 1, 0.6], 0.8));
    // لا تدخل سلاميات الأصابع الثلاث في الريشة: يُبعد طرف الإصبع عن أقرب نقطة من مسارها بقدر نصف قطره
    const nearest = (q) => { let bd = Infinity, bp = null; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], ab = V.sub(pts[i], a), t = clamp(V.dot(V.sub(q, a), ab) / V.dot(ab, ab), 0, 1), c = V.madd(a, ab, t), dd = V.dist(q, c); if (dd < bd) { bd = dd; bp = c; } } return [bd, bp]; };
    for (let i = 1; i < 4; i++) for (let it = 0; it < 8; it++) {
      let worst = 0, push = null; const c = chains[i], r = hm.fingers[i].r;
      for (let j = 0; j < 3; j++) for (const u of [0.3, 0.65, 1]) { const q = V.lerp(c[j], c[j + 1], u), [dd, cp] = nearest(q), need = r[j] * 0.95 + RISHA.t / 2 + 0.0008 - dd; if (need > worst) { worst = need; push = V.norm(V.sub(q, cp)); } }
      if (!push) break; tips[i] = V.madd(tips[i], push, worst + 0.0005); chains[i] = fingerArch(hm.fingers[i], side, tips[i], [0, 1, 0.6], 0.8);
    }
    // الإبهام: باطنه فوق الريشة عند نقطة القرص، ممتد شبه مستقيم
    const thumbTip = V.madd(V.madd(Q, nQ, th.r[2] * 0.92 + RISHA.t / 2 + 0.0006), d, 0.006);
    const thumbPts = thumbChain(th, side, thumbTip, V.norm([-0.1, 0.8, -0.55]), [-0.3, 0.2, 0.9]);
    this.grip = { chains, thumbPts, gripPt: Q, dirL: d, pts, wAx, nQ };
  }

  // ---------- اليد اليسرى ----------
  // st.f: { 1..4: { course, semis, amt (0..1 الضغط) } } ؛ st.course: الوتر الذي تعمل عليه اليد ؛ st.shift: إزاحة الوضع على الزند
  // المبدأ: الكف تتبع الوتر النشط بسلاسة، وكل طرف إصبع له «متتبّع» بمسار متصل في إطار العود:
  //   اقتراب (يرتفع قليلًا، ينتقل فوق الأوتار، ثم ينزل عموديًا على موضع النغمة) ← ضغط ← رفع عمودي ← عودة إلى «بيته» فوق الوتر.
  solveLeft(st) {
    const rig = this.rig, hm = this.hand.L, side = 1, dt = this._ldt || 0; this._ldt = 0;
    const xo = ar(this.Wd([1, 0, 0])), yo = ar(this.Wd([0, 1, 0])), zo = ar(this.Wd([0, 0, 1]));
    // إطار الكف: x نحو الإبهام = نحو الأنف تقريبًا، y من الرسغ إلى الأصابع = نحو الأعلى (−x العود) ومائل للأمام، z = ظهر اليد نحو الجمهور
    const LY = this.P.lydir, yh0 = V.norm(V.comb(xo, LY[0], yo, LY[1], zo, LY[2]));
    const xh = V.norm(V.perp(yo, yh0)), zh = V.cross(xh, yh0), yh = yh0;
    const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
    const mix = (a, b, t) => a + (b - a) * t;
    const rOf = (c) => (c < 3 ? 0.00058 - c * 0.00005 : 0.00042 - (c - 3) * 0.00003);
    // --- حالة اليد: الوتر النشط والوضع، بتخميد حرج (بداية ونهاية ناعمتان) ---
    const cGoal = clamp(st.course != null ? st.course : 3, 0, 5), sGoal = st.shift || 0;
    if (!this._hs) this._hs = { c: cGoal, cv: 0, s: sGoal, sv: 0 };
    const hs = this._hs;
    if (dt > 0) {
      const sp = (x, v, g) => { const w = HAND_W, e = Math.exp(-w * dt), d = x - g, t2 = (v + w * d) * dt; return [g + (d + t2) * e, (v - w * t2) * e]; };
      [hs.c, hs.cv] = sp(hs.c, hs.cv, cGoal); [hs.s, hs.sv] = sp(hs.s, hs.sv, sGoal);
    }
    const hc = hs.c, shift = hs.s;
    // --- أهداف الأطراف في إطار العود ---
    const pressPt = (pr) => { const y = OUD.stopY(pr.semis), yy = y - TIP_BACK; return [OUD.courseX(pr.course, yy), yy, OUD.fbTop(y) + 2 * rOf(pr.course) + PAD]; };
    const hoverPt = (i) => { const y = OUD.stopY(HOME[i]) - TIP_BACK + shift; return [OUD.courseX(hc, y) + 0.0012 * (i - 1.5), y, OUD.zStr(y) + PAD + L_HOVER + 0.0012 * i]; };
    if (!this._trk) this._trk = [0, 1, 2, 3].map((i) => ({ key: 'hover', p: hoverPt(i), S: null, peak: 0 }));
    const tips = [], press = [];
    for (let i = 0; i < 4; i++) {
      const f = i + 1, pr = st.f[f], on = !!(pr && pr.amt > 0), tr = this._trk[i];
      const key = on ? pr.course + ':' + pr.semis : 'hover';
      if (key !== tr.key) { tr.key = key; tr.S = (tr.out || tr.p).slice(); tr.peak = 0; }
      let p;
      if (on) {
        const a = clamp(pr.amt, 0, 1), G = pressPt(pr), S = tr.S || G, corr = this.corrL[f] || 0;
        if (a > tr.peak) tr.peak = a;
        if (tr.peak > 0.95 && a < tr.peak - 1e-4) {
          // الرفع: عموديًا عن الوتر (لا ينزلق الإصبع جانبًا وهو يرتفع)
          p = [G[0], G[1], mix(OUD.zStr(G[1]) + PAD + L_HOVER, G[2] + corr, ease(a))];
        } else {
          const l0 = 1 - Math.min(1, a / 0.6), lat = 1 - l0 * l0, dn = ease((a - 0.45) / 0.55);   // انتقال يتباطأ عند الوصول ثم نزول على الوتر
          const x = mix(S[0], G[0], lat), y = mix(S[1], G[1], lat), dist = Math.hypot(G[0] - S[0], G[1] - S[1]);
          const zApp = OUD.zStr(y) + PAD + 0.003;                                   // فوق الوتر مباشرة قبل النزول
          const arc = clamp(dist * 0.3, 0, 0.007) * Math.sin(Math.PI * lat);        // قوس عبور: أعلى كلما بعدت المسافة (عبور الأوتار دون جرّها)
          const z1 = mix(S[2], zApp, ease(Math.min(1, lat / 0.3))) + arc;
          p = [x, y, mix(z1, G[2] + corr, dn)];
        }
        press.push(a);
      } else {
        const G = hoverPt(i), k = dt > 0 ? 1 - Math.exp(-dt / 0.055) : (this._live ? 0 : 1);
        p = [mix(tr.p[0], G[0], k), mix(tr.p[1], G[1], k), mix(tr.p[2], G[2], k)];
        press.push(0);
      }
      tr.p = p;
      tips.push(on ? p.slice() : [p[0], p[1], p[2] + (this.fLift[f] || 0)]);
    }
    // --- موضع الكف: يُحدَّد بحيث يقع موضع الوتر النشط أمام جذر الوسطى ونحو الراحة (قوس الإصبع الطبيعي)، فتنحني الأصابع فوق حافة الزند
    //     وتنزل بأطرافها. عند الأوتار الغليظة تقترب المفاصل من حافة اللوحة فتتقدم الكف أمام سطحها بالقدر اللازم (تحليليًا، بلا ارتجاج).
    const LP = this.P.lpalm, yA = OUD.stopY(3) + LP[1] + shift, mid = hm.fingers[1];
    // الكف تتبع الوتر النشط جزئيًا (PALM_K): عند الأوتار الغليظة تنفرد الأصابع أكثر، وعند الحادة تتقوس أكثر — كما في اليد الحقيقية — فيبقى الإبهام خلف الزند
    const hcP = 3 + PALM_K * (hc - 3), sW = ar(this.W([OUD.courseX(hcP, yA), yA, OUD.zStr(yA)]));
    let mcpW = V.add(sW, V.comb(yh, -LP[0], zh, LP[2]));
    { const q = this.Lw(v3(mcpW)), r = mid.r[0], over = clamp((OUD.neckW(q.y) + 0.004 + r - q.x) / 0.012, 0, 1), zReq = OUD.fbTop(q.y) + r + 0.003;
      if (over > 0 && q.z < zReq) { q.z += (zReq - q.z) * ease(over); mcpW = ar(this.oud.root.localToWorld(q)); } }
    mcpW = V.add(mcpW, V.comb(xo, this.hOut * 0.6, zo, this.hOut * 0.8));
    let O = V.sub(mcpW, V.comb(xh, mid.k[0] * side, yh, mid.k[1], zh, mid.k[2]));
    const baseOf = (i) => { const fd = hm.fingers[i]; return V.add(O, V.comb(xh, fd.k[0] * side, yh, fd.k[1], zh, fd.k[2])); };
    const Lof = (i) => { const fd = hm.fingers[i]; return fd.L[0] + fd.L[1] + fd.L[2]; };
    const tipW = tips.map((q) => ar(this.W(q)));
    // الأصابع الضاغطة تبلغ أهدافها دون مدّ كامل ولا انقباض شديد: تتحرك الكف بالقدر اللازم فقط، موزونًا بمقدار الضغط (لا قفزات)
    for (let it = 0; it < 8; it++) {
      let worst = 0, mv = null;
      for (let i = 0; i < 4; i++) {
        if (!press[i]) continue;
        const dv = V.sub(tipW[i], baseOf(i)), D = V.len(dv), L = Lof(i), w = ease(press[i] * 1.6);
        const ex = D > R_MAX * L ? (D - R_MAX * L) * w : D < R_MIN * L ? -(R_MIN * L - D) * w : 0;
        if (Math.abs(ex) > Math.abs(worst)) { worst = ex; mv = V.mul(dv, ex / D); }
      }
      if (!mv || Math.abs(worst) < 1e-4) break; O = V.add(O, mv);
    }
    // الأصابع الحرة: إن كان «بيتها» أبعد من مداها (الخنصر القصير) تبقى مرتخية أقرب إلى جذرها
    for (let i = 0; i < 4; i++) {
      if (press[i]) continue;
      const b = baseOf(i), dv = V.sub(tipW[i], b), D = V.len(dv), lim = 0.9 * Lof(i);
      if (D > lim) { tipW[i] = V.madd(b, dv, lim / D); const q = this.Lw(v3(tipW[i])); const zMin = OUD.zStr(q.y) + PAD + 0.002; if (q.z < zMin) { q.z = zMin; tipW[i] = ar(this.oud.root.localToWorld(q)); } }
    }
    const toL = (q) => { const d = V.sub(q, O); return [V.dot(d, xh), V.dot(d, yh), V.dot(d, zh)]; };
    let tgt = tipW.map((q) => v3(q));
    let chains = [0, 1, 2, 3].map((i) => fingerArch(hm.fingers[i], side, toL(ar(tgt[i])), [0, 1, 0.7], 0.72));
    // لا تدخل سلاميات الأصابع في الزند: يُرفع هدف الإصبع الحر، ويُبعد الضاغط قليلًا نحو الأمام
    const Wh = (q) => this.Lw(v3(V.add(O, V.comb(xh, q[0], yh, q[1], zh, q[2]))));
    for (let i = 0; i < 4; i++) {
      for (let it = 0; it < 6; it++) {
        let worst = -1; const c = chains[i];
        // الإصبع الضاغط: سلاميته الأخيرة على الوتر عمدًا (ملامستها يضبطها مقياس الملامسة)، فتُفحص السلاميتان الأوليان فقط
        const segs = press[i] > 0.3 ? [[c[0], c[1]], [c[1], c[2]]] : [[c[0], c[1]], [c[1], c[2]], [c[2], c[3]]];
        for (const [a, b] of segs) for (const u of [0.25, 0.6, 1]) { const q = Wh(V.lerp(a, b, u)); worst = Math.max(worst, this.insideOud(q, hm.fingers[i].r[1] * 1.3)); }
        if (worst <= 0) break;
        const up = press[i] ? ar(this.Wd([-0.6, 0, 0.8])) : ar(this.Wd([0, 0, 1]));
        tgt[i] = tgt[i].clone().add(v3(V.mul(up, worst + 0.001)));
        chains[i] = fingerArch(hm.fingers[i], side, toL(ar(tgt[i])), [0, 1, 0.7], 0.72);
      }
    }
    for (let i = 0; i < 4; i++) this._trk[i].out = this.Lw(tgt[i]).toArray();       // الموضع المعروض فعلًا: منه يبدأ المسار التالي
    // الإبهام مرتكز خلف الزند مقابل ما بين السبابة والوسطى (لا يلتف حول الزند ولا يضغط). وضعه ثابت تقريبًا بالنسبة إلى الكف:
    // نقطة اسمية في إطار الكف (تُحدَّد مرة عند وتر الدوكاه) تُسقَط كل إطار على السطح الخلفي للزند، فينزلق باطن الإبهام على ظهر الزند
    // انزلاقًا خفيفًا متصلًا حين تتحرك الكف بين الأوتار — مرتكزًا لليد كما في العزف الحقيقي — ومفصله يبرز بعيدًا عن الزند.
    const toHand = (q) => { const d = V.sub(q, O); return [V.dot(d, xh), V.dot(d, yh), V.dot(d, zh)]; };
    if (!this._th0) { const yT = OUD.stopY(2.4), wN = OUD.neckW(yT), dN = OUD.neckD(yT); this._th0 = toHand(ar(this.W([wN * Math.cos(THUMB_TH), yT, -dN * Math.sin(THUMB_TH)]))); }
    const tq = Wh(this._th0), wN = OUD.neckW(tq.y), dN = OUD.neckD(tq.y);
    if (tq.z > -0.006) tq.z = -0.006;
    const rr = Math.hypot(tq.x / wN, tq.z / dN), sx = tq.x / rr, sz = tq.z / rr, nrm = V.norm([sx / (wN * wN), 0, sz / (dN * dN)]);
    const tPad = hm.thumb.r[2] * 0.95 + 0.0015 + (this.corrT || 0);
    const thumbTip = toHand(ar(this.W([sx + nrm[0] * tPad, tq.y, sz + nrm[2] * tPad])));
    const nH = (() => { const n = ar(this.Wd(nrm)); return [V.dot(n, xh), V.dot(n, yh), V.dot(n, zh)]; })();
    let thumb = thumbChain(hm.thumb, side, thumbTip, V.norm(THUMB_DIR), nH);
    const th = Math.atan2(-sz / dN, sx / wN);
    const fr = Frame(O, xh, yh, zh);
    this.handLFrame = fr;
    this.poseArm('L', fr, L_POLE);
    poseFingers(rig, hm, fr, chains, thumb);
    this.lTargets = tgt; this.lChains = chains; this.lThumb = thumb;
    this.qa.thumbShortL = +((thumb.short || 0) * 1000).toFixed(1); this.qa.thumbDeg = +(th / DEG).toFixed(0); this.qa.thumbBad = 0;
    this.qa.curlL = chains.map((c) => +c.reach.toFixed(2));
    // زاوية الرسغ (بين الساعد والكف): مؤشر جودة — الرسغ المستقيم تقريبًا هو السليم
    { const el = ar(rig.wp('L', 'lowerArm')), wr = ar(rig.wp('L', 'hand')); this.qa.wristL = +(Math.acos(clamp(V.dot(V.norm(V.sub(wr, el)), yh), -1, 1)) / DEG).toFixed(0); }
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
  // الريشة شريط منحنٍ معرَّف في إطار الكف: هندسته تُبنى مرة لكل شخصية، ثم يتبع الكف إطارًا بإطار (لا يتحرك منفصلًا عن اليد)
  placeRisha(mesh) {
    if (!mesh || !this.handRFrame) return;
    if (mesh.userData.gripOf !== this) { shapeRisha(mesh, this.grip.pts, this.grip.wAx); mesh.userData.gripOf = this; }
    const fr = this.handRFrame;
    const m = new THREE.Matrix4().makeBasis(v3(fr.x), v3(fr.y), v3(fr.z)).setPosition(v3(fr.o));
    mesh.matrixAutoUpdate = false; mesh.matrix.copy(m); mesh.matrixWorldNeedsUpdate = true; mesh.updateMatrixWorld(true);
  }

  pose(state) {
    this.state = state; this._frame = (this._frame || 0) + 1;
    if (!this.corrL) { this.corrL = { 1: 0, 2: 0, 3: 0, 4: 0 }; this.corrT = 0; this.fLift = { 1: 0, 2: 0, 3: 0, 4: 0 }; this.hOut = 0; }
    this.oud.root.updateMatrixWorld(true);
    this._ldt = this.dt || 0; this.dt = 0; if (this._ldt > 0) this._live = true;      // الزمن يتقدم مرة واحدة في الإطار (إعادات الحل للتصحيح بلا زمن)
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
    for (const e of this.tipVerts(0)) { rig.vertexWorld(e.m, e.i, p); const q = this.Lw(p); if (q.y > OUD.yJoint && q.y < OUD.yNut) tg = Math.min(tg, this.neckDist(q)); }
    this.gapT = tg;
    if (isFinite(tg)) this.corrT = clamp(this.corrT + clamp((0.0006 - tg) * 0.5, -0.0008, 0.0016), -0.014, 0.01);
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
    const hm = this.hand.R, g = this.grip; if (!this.handRFrame) return null;
    let worst = Infinity, at = null; const segs = [];
    g.chains.forEach((c, i) => { for (let j = 0; j < 3; j++) segs.push([c[j], c[j + 1], hm.fingers[i].r[j], FINGERS[i] + (j + 1)]); });
    for (let j = 1; j < 3; j++) segs.push([g.thumbPts[j], g.thumbPts[j + 1], hm.thumb.r[j], 'thumb' + (j + 1)]);
    let sLen = 0;
    for (let k = 0; k < g.pts.length; k++) {
      if (k) sLen += V.dist(g.pts[k], g.pts[k - 1]);
      const pt = g.pts[k];
      for (const [a, b, r, nm] of segs) { const ab = V.sub(b, a), t = clamp(V.dot(V.sub(pt, a), ab) / V.dot(ab, ab), 0, 1), d = V.dist(pt, V.madd(a, ab, t)) - r - RISHA.t / 2; if (d < worst) { worst = d; at = nm + '@' + (sLen * 100).toFixed(1) + 'cm'; } }
    }
    return { mm: +(worst * 1000).toFixed(1), at };
  }
  report() { return { ...this.qa, gapL: this.gapL, gapT: this.gapT }; }
}
