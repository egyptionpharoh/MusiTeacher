// =====================================================================
//  العازفة والأكورديون: الجلوس، حمل الآلة، الأشرطة، وحركة اليدين والأصابع على المفاتيح والأزرار.
//  تُحلّ الذراعان بالـIK (من SeatedPlayer)، والأصابع بقوس (fingerArch) نحو نقاط تلامس فعلية على الآلة.
//  ما يخصّ الأكورديون فقط (لا حركة منسوخة من الكمان): يد يمنى فوق المفاتيح تتحرك على العمود الرأسي،
//  ويد يسرى تحتضن طرف صندوق الباص وتتحرك معه أثناء تمدد المنفاخ.
// =====================================================================
import * as THREE from 'three';
import { V, Frame, F, ik2 } from '../../_shared/3d/engine/math.js';
import { SeatedPlayer, SEAT } from '../../_shared/3d/character/seated-player.js';
import { FINGERS, fingerArch, thumbChain, poseHandRotation, poseFingers } from '../../_shared/3d/character/hand.js';
import { DIM } from '../instrument/accordion-model.js';
import { fixSeatedGlutes, fixSeatedLap, fixSeatedHem, calmFabric } from './dish-fix.js';
import { buildSeatedRobe } from './robe.js';
import { WHITE_COUNT } from '../instrument/accordion-data.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const ar = (v) => [v.x, v.y, v.z];
const QP = (k, d) => { const q = new URLSearchParams(location.search).get(k); return q ? q.split(',').map(Number) : d; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ثوابت قابلة للضبط عبر الرابط أثناء المعايرة (لا تؤثر في الاستعمال العادي)
const RF = QP('rf', [0.0, -0.2, 1.0]);        // اتجاه أصابع اليد اليمنى (إحداثيات لوحة المفاتيح: +z من مقدّمات البيض نحو السود)
const LF = QP('lf', [0.0, -0.1, 1.0]);          // اتجاه أصابع اليد اليسرى
const RPOLE = QP('rpole', [-0.75, 0.35, -0.2]);
const LPOLE_ARM = QP('lepole', [0.75, -0.35, -0.3]);
const R_ARCH = QP('rarch', [0.46, 0.50]);       // (أمام، نحو الراحة) كسور من طول الإصبع لموضع الطرف بالنسبة لجذر الإصبع
const L_ARCH = QP('larch', [0.46, 0.66]);
const PAD = QP('pad', [0.0088])[0];             // سُمك لحم الطرف: الهدف يوضع فوق السطح بهذا المقدار
const HAND_POLE = QP('hpole', [0, 1, 0.6]);
const HOVER_Z = QP('hz', [0.028])[0];
const HAND_ROLL = QP('hroll', [20])[0];
const BLACK_ZONE = 0.004 + 0.090 - 0.054 - 0.012;   // بداية المفاتيح السوداء على طول اللوحة ناقص هامش لحم الطرف         // درجات: ميل الكف نحو جهة الخنصر           // موضع الأطراف الخاملة على طول المفاتيح البيضاء (من مقدّمتها)

export class Accordionist extends SeatedPlayer {
  constructor(rig, config, accordion) { super(rig, config); this.acc = accordion; }

  setup() {
    this.baseSetup();
    this.fixMaleCloth();
    this.placeAccordion();
    this.buildRobe();
    this.buildStraps();
    this.rightState = { base: 6.0, digits: {} }; this.leftState = { row: 0.5, z: 2.6, digits: {} };
    this.pose({ w: this.acc.getWidth(), R: this.rightState, L: this.leftState });
  }

  // ثوب العازف في وضعية الجلوس (للعازف فقط؛ العازفة كما هي): الأرداف تنسدل لوحًا واحدًا (كما في لعبة الأورج)، ولوح الحِجر يلتصق بغلاف الفخذين.
  // يجب أن يسبق وضع الآلة وبناء الأحزمة لأنهما يقيسان سطح الجسم والثوب الفعليين.
  fixMaleCloth() {
    if (!(this.cfg && this.cfg.gender === 'male')) return;
    const has = (k) => new URLSearchParams(location.search).has(k);
    if (!has('noglutefix')) { try { this.qa.glutes = fixSeatedGlutes(this.rig, SEAT, { mode: 'drape', out: QP('gout', [0.006])[0] }); } catch (e) { console.warn('glute fix skipped', e); } }
    if (!has('nolapfix')) { try { this.qa.lap = fixSeatedLap(this.rig); } catch (e) { console.warn('lap fix skipped', e); } }
    if (!has('nohemfix')) { try { this.qa.hem = fixSeatedHem(this.rig); } catch (e) { console.warn('hem fix skipped', e); } }
    if (!has('nocalm')) { try { this.qa.fabric = calmFabric(this.rig); } catch (e) { console.warn('fabric calm skipped', e); } }
  }

  // العازفة: دشداشة ساترة فضفاضة تُبنى حول الجسم الجالس (robe.js — المعالجة نفسها المعتمدة في لعبة العود).
  // تُبنى بعد وضع الآلة (فينضغط القماش تحت قاعدتها وخلف ظهرها ولا يخترقها) وقبل الأحزمة (فتمرّ الأحزمة فوق الثوب).
  buildRobe() {
    const U = new URLSearchParams(location.search), male = this.cfg && this.cfg.gender === 'male';
    if (male || U.has('norobe')) return;
    try {
      if (!U.has('noglutefix')) this.qa.glutes = fixSeatedGlutes(this.rig, SEAT, { mode: 'drape', out: QP('gout', [0.012])[0] });
      const acc = this.acc; acc.root.updateMatrixWorld(true);
      const bx = new THREE.Box3(); for (const ch of acc.root.children) if (ch.name !== 'straps') bx.expandByObject(ch);     // جسم الآلة فقط (بلا الأحزمة)
      const yB = bx.min.y - 0.002, zB = bx.min.z - 0.002, zF = bx.max.z + 0.006;
      // الآلة صندوق يستقر على الفخذين وظهره إلى الصدر: ما يقع من القماش داخل حيّزها يُزاح إلى أقرب وجهيها (القاعدة أو الظهر)
      const press = (x, y, z) => { if (Math.abs(x) > 0.36 || y <= yB || z <= zB || z >= zF || y > bx.max.y) return [x, y, z]; return (y - yB) < (z - zB) ? [x, yB, z] : [x, y, zB]; };
      const oc = (this.cfg && this.cfg.outfit) || {};
      this.qa.robe = buildSeatedRobe(this.rig, SEAT, { color: oc.dishdasha, gold: oc.embroidery, teal: oc.embroidery2, press });
      this._tv = null;
    } catch (e) { console.warn('robe skipped', e); }
  }

  /** عند تبديل الشخصية: تُعاد الآلة إلى صدر هذه الشخصية وفخذيها، وتُعاد الأحزمة إلى كتفيها، ثم تُحدَّث الوضعية فورًا */
  activate() {
    if (this.accPlace) { this.acc.root.position.copy(this.accPlace.p); this.acc.root.quaternion.copy(this.accPlace.q); this.acc.root.updateMatrixWorld(true); }
    else this.placeAccordion();
    this.buildStraps();
    this.pose({ w: this.acc.getWidth(), R: this.rightState, L: this.leftState });
  }

  // ---------- مساحة الجسم: أعلى سطح للجسم في منطقة (x,y,z) ----------
  surfaceExtent(pred, axis, sign = 1, step = 5) {
    const rig = this.rig, p = new THREE.Vector3(); let best = sign > 0 ? -Infinity : Infinity;
    for (const m of rig.meshes) {
      const n = m.geometry.attributes.position.count;
      for (let i = 0; i < n; i += step) {
        rig.vertexWorld(m, i, p);
        if (!pred(p)) continue;
        const v = p[axis]; if (sign > 0 ? v > best : v < best) best = v;
      }
    }
    return best;
  }

  placeAccordion() {
    const rig = this.rig, acc = this.acc;
    // وجه الصدر الأمامي عند ارتفاع الصدر، وأعلى سطح للفخذين
    const chestZ = this.surfaceExtent((p) => Math.abs(p.x) < 0.14 && p.y > 0.80 && p.y < 1.05, 'z', 1);
    // بطن العازف (وأي بروز للدشداشة أمام الحوض) يقع أمام مستوى الصدر ويعلو الفخذين، فلا يجوز أن يُحسب «سطح فخذ».
    // نقيس أولًا أقصى امتداد أمامي للجذع في منطقة البطن (y 0.62..0.78) ثم نبدأ نافذة الفخذ بعده، فتُقاس الفخذ نفسها.
    const bellyZ = this.surfaceExtent((p) => Math.abs(p.x) < 0.16 && p.y > 0.66 && p.y < 0.80, 'z', 1);
    const zLo = Math.max(chestZ - 0.02, isFinite(bellyZ) ? bellyZ + 0.012 : -Infinity);
    const thighTop = this.surfaceExtent((p) => p.z > zLo && p.z < zLo + 0.22 && Math.abs(p.x) < 0.22 && p.y < 0.75 && p.y > 0.5, 'y', 1);
    this.qa.bellyZ = isFinite(bellyZ) ? +bellyZ.toFixed(3) : null;
    this.qa.chestZ = +chestZ.toFixed(3); this.qa.thighTop = +thighTop.toFixed(3);
    const tilt = QP('tilt', [4])[0] * Math.PI / 180;       // ميل الآلة قليلًا نحو الصدر
    const x0 = QP('ax', [-0.05])[0];                        // موضع الطرف الداخلي للصندوق الأيمن
    acc.root.position.set(x0, thighTop + QP('ay', [0.004])[0], chestZ + QP('az', [0.012])[0]);
    acc.root.rotation.set(-tilt, 0, 0);
    acc.root.updateMatrixWorld(true);
    this.accOrigin = acc.root.position.clone();
    this.accPlace = { p: acc.root.position.clone(), q: acc.root.quaternion.clone() };      // يُستعاد كما هو عند العودة إلى هذه الشخصية
  }

  // تحويل نقطة محلية في الآلة إلى العالم
  W(p) { return this.acc.root.localToWorld(new THREE.Vector3(p[0], p[1], p[2])); }
  Wd(d) { return v3(d).applyQuaternion(this.acc.root.quaternion); }
  // صندوق الباص يميل مع المروحة: نقاطه واتجاهاته تُحوَّل من إطاره هو
  WL(p) { return this.acc.leftBox.localToWorld(new THREE.Vector3(p[0], p[1], p[2])); }
  WdL(d) { return v3(d).applyQuaternion(this.acc.leftBox.getWorldQuaternion(new THREE.Quaternion())); }
  // إطار لوحة المفاتيح (مائل على شطفة الصندوق الأيمن): x خارج السطح سالبًا، y الارتفاع، z من مقدّمات البيض (جهة المعصم) نحو السود
  WK(p) { return this.acc.kb.localToWorld(new THREE.Vector3(p[0], p[1], p[2])); }
  WdK(d) { return v3(d).applyQuaternion(this.acc.kb.getWorldQuaternion(new THREE.Quaternion())); }

  // قياسات الجذع الحقيقية (من رؤوس الجسم والملابس المرتبطة بعظام الجذع فقط، فلا تدخل الذراعان)
  torsoVerts() {
    if (!this._tv) { const rig = this.rig; this._tv = rig.verts([rig.b('C', 'spine'), rig.b('C', 'chest'), rig.b('C', 'upperChest')].filter(Boolean), 0.3); }
    return this._tv;
  }
  torsoExtent(yLo, yHi, axis, sign, pred = () => true) {
    const rig = this.rig, p = new THREE.Vector3(); let best = sign > 0 ? -Infinity : Infinity;
    for (const e of this.torsoVerts()) { rig.vertexWorld(e.m, e.i, p); if (p.y < yLo || p.y > yHi || !pred(p)) continue; const v = p[axis]; if (sign > 0 ? v > best : v < best) best = v; }
    return best;
  }

  // حزاما الكتفين: من علاّقة الصندوق فوق الكتف، فخلف الظهر، فتحت الإبط على جانب الجذع، ثم إلى زر أسفل الصندوق (يتصل كلاهما بالصندوق نفسه).
  buildStraps() {
    const rig = this.rig, acc = this.acc;
    for (const [s, sg] of [['R', -1], ['L', 1]]) {
      const sh = rig.wp(s, 'upperArm');
      const topY = this.surfaceExtent((p) => Math.abs(p.x - sh.x * 0.8) < 0.04 && Math.abs(p.z - (sh.z - 0.01)) < 0.05 && p.y > sh.y - 0.03 && p.y < sh.y + 0.09, 'y', 1, 2);
      const x = sh.x * 0.72;
      const yAx = sh.y - 0.07;                                              // مستوى الإبط تقريبًا
      // الأسطح الخارجية الفعلية (بما فيها اللحاف) كي يمرّ الحزام فوقها لا تحتها ولا بعيدًا عنها
      const backAll = (y, xx) => { const z = this.surfaceExtent((p) => Math.abs(p.x - xx) < 0.05 && p.y > y - 0.03 && p.y < y + 0.03 && p.z < sh.z - 0.02, 'z', -1, 2); return isFinite(z) ? z : sh.z - 0.12; };
      const topAt = (xx, zz) => { const y = this.surfaceExtent((p) => Math.abs(p.x - xx) < 0.035 && Math.abs(p.z - zz) < 0.03 && p.y > sh.y - 0.06 && p.y < sh.y + 0.14, 'y', 1, 2); return isFinite(y) ? y : topY; };
      const half = (y) => { const v = Math.abs(this.torsoExtent(y - 0.03, y + 0.03, 'x', sg, (p) => Math.abs(p.z - (sh.z - 0.05)) < 0.08)); return isFinite(v) ? v : 0.15; };
      // ارتفاعات متناقصة بلا رجوع للأعلى (الرجوع للأعلى كان يصنع «ثنية Z» حادة عند الخاصرة): فوق الكتف ← الظهر ← الخاصرة تحت الإبط
      const m = 0.009, yB1 = sh.y - 0.10, yB2 = yAx - 0.08, yA = yAx - 0.17, yB = yAx - 0.23;
      const zS = sh.z - 0.075, yTop2 = topAt(x, zS);
      const pts = [
        new THREE.Vector3(x, topY + 0.007, sh.z),
        new THREE.Vector3(x, yTop2 + m, zS),
        new THREE.Vector3(x * 0.95, yB1, backAll(yB1, x * 0.95) - m),
        new THREE.Vector3(x * 0.92, yB2, backAll(yB2, x * 0.92) - m),
        new THREE.Vector3(sg * (half(yA) + 0.014), yA, sh.z - 0.09),
        new THREE.Vector3(sg * (half(yB) + 0.016), yB, sh.z - 0.0),
      ];
      // اتجاه «الخارج» عن الجذع لكل نقطة من الحزام (قطري أفقي عن محور الجذع، ويميل للأعلى فوق الكتف) ليبقى وجه الحزام ملاصقًا للجسم
      const zc = sh.z, ySh = sh.y;
      const outward = (w) => { const rx = w.x, rz = w.z - zc, rl = Math.hypot(rx, rz) || 1, up = Math.min(1, Math.max(0, (w.y - (ySh - 0.04)) / 0.05)); return new THREE.Vector3(rx / rl * (1 - up), up, rz / rl * (1 - up)); };
      acc.setShoulderPath(s, pts, 0.05, outward);
    }
    this._strapped = true;
  }

  // سطح المفتاح الخارجي (يتبع ضغط المفتاح لأنه محسوب من شبكته الفعلية)
  keySurface(k, extra = 0) { return k.mesh.localToWorld(new THREE.Vector3(-k.thick / 2 - PAD - extra, 0, k.touchZ)); }
  buttonSurface(b) { return b.mesh.localToWorld(new THREE.Vector3(0.00625 + PAD, 0, 0)); }

  // ---------- يد يمنى ----------
  // state: { base: موضع الإبهام (رقم عشري على المفاتيح البيضاء 0..19), digits: { d: {keyId, amt} } , hover: ارتفاع الأصابع الخاملة }
  solveRight(st) {
    const rig = this.rig, hm = this.hand.R, acc = this.acc, side = -1;
    // كل شيء في إطار لوحة المفاتيح kb: الأصابع تمتد على طول المفاتيح من مقدّمات البيض (حيث المعصم خارج الحافة الخلفية الخارجية)
    // نحو السود، وظهر اليد للخارج (−x). لذا يصل الإصبع إلى المفتاح الأسود بالتمدد للأمام بعيدًا عن جسم العازفة.
    const fl = V.norm(RF), nloc = [1, 0, 0];
    const f = ar(this.WdK(fl)), n = ar(this.WdK(nloc));
    // إطار اليد: y أصابع، z ظهر اليد = -n، x = y × z
    const yv = V.norm(f), zv0 = V.norm(V.mul(n, -1)), xv0 = V.cross(yv, zv0);
    // دوران خفيف للكف حول محور الأصابع: جهة الخنصر أقرب إلى المفاتيح (كيد عازف البيانو المرتخية)، فيبلغ الخنصر القصير مفاتيحه
    // يزداد الميل حين يضغط الخنصر، ويقل حين يضغط الإبهام (اليد تميل نحو الإصبع العامل)
    const amtOf = (d) => (st.digits[d] ? clamp(st.digits[d].amt ?? 0, 0, 1) * (1 - clamp(st.digits[d].lift ?? 0, 0, 1)) : 0);
    const roll = (HAND_ROLL + 9 * amtOf(4) + 4 * amtOf(3) - 9 * amtOf(0)) * Math.PI / 180, cr = Math.cos(roll), sr = Math.sin(roll);
    const xv = V.norm(V.sub(V.mul(xv0, cr), V.mul(zv0, sr))), zv = V.norm(V.add(V.mul(zv0, cr), V.mul(xv0, sr)));
    const kw = DIM.KEY_W;
    const slotY = (s) => (DIM.H - WHITE_COUNT * kw) / 2 + (WHITE_COUNT - s - 0.5) * kw;
    const tgt = [];                                  // أهداف الأصابع (0 إبهام .. 4 خنصر) بالإحداثيات المحلية للآلة ثم العالم
    const hover = (d) => {
      const sl = clamp(st.base + d, 0, WHITE_COUNT - 1);
      const lift = 0.0095 + 0.0035 * Math.abs(d - 2) * 0.5;
      // فوق المفاتيح البيضاء قرب مقدّماتها (z صغير)؛ الإبهام والبنصر والخنصر المرتخية أقرب للراحة فتتكوّر بدل أن تمتد
      const zz = HOVER_Z + shiftZ - (d === 0 ? 0.010 : d === 3 ? 0.010 : d === 4 ? 0.020 : 0);
      const top = zz > BLACK_ZONE ? -0.010 - 0.022 : -0.010 - 0.012;      // فوق منطقة السود: تحوم الأطراف فوق سطح الأسود الأعلى
      return this.WK([top - lift, slotY(sl), zz]);
    };
    let shiftZ = 0;                                  // تقدّم اليد على طول المفاتيح (نحو السود) — يُحسب أدناه من الأصابع الضاغطة
    const build = () => {
      tgt.length = 0;
      for (let d = 0; d < 5; d++) {
        const pr = st.digits[d], h = hover(d);
        if (pr && acc.keys[pr.keyId]) {
          const k = acc.keys[pr.keyId], tp = this.keySurface(k, d === 0 ? (k.black ? 0.006 : 0.0035) : 0);
          tgt.push(pr.lift > 0 ? tp.lerp(h, clamp(pr.lift, 0, 1)) : tp);
        } else tgt.push(h);
      }
    };
    build();
    const anchor = hover(2);
    // موضع المعصم: نضع هدف الوسطى عند إحداثيات الكف المرغوبة
    const mid = hm.fingers[1], tot = mid.L[0] + mid.L[1] + mid.L[2], mx = mid.k[0] * side, my = mid.k[1];
    const T = ar(anchor);
    let O = V.sub(V.sub(T, V.mul(xv, mx)), V.madd(V.mul(yv, my + R_ARCH[0] * tot), zv, -R_ARCH[1] * tot));
    // الكف تتبع الأصابع: إن لم يبلغ إصبعٌ هدفه (مفتاح أسود أبعد للأمام، أو ضغطة بالخنصر) تتقدّم اليد كلها نحوه بالقدر اللازم —
    // كما يدفع العازف يده للأمام نحو المفاتيح السوداء — مع إبقاء الكف فوق سطح المفاتيح بمسافة آمنة.
    const kbInv = this.acc.kb.matrixWorld.clone().invert(), kbM = this.acc.kb.matrixWorld;
    const reachOf = (i) => {                          // i: 0 إبهام، 1..4 الأصابع
      if (i === 0) { const th = hm.thumb; return { base: V.madd(V.madd(V.madd(O, xv, th.cmc[0] * side), yv, th.cmc[1]), zv, th.cmc[2]), lim: 0.9 * (th.L[0] + th.L[1] + th.L[2]) }; }
      const fd = hm.fingers[i - 1], L = fd.L[0] + fd.L[1] + fd.L[2];
      return { base: V.madd(V.madd(V.madd(O, xv, fd.k[0] * side), yv, fd.k[1]), zv, fd.k[2]), lim: 0.95 * L };
    };
    const O0 = O, dbg = [];
    for (let it = 0; it < 8; it++) {
      let worst = 0, mv = null, wi = -1;
      for (let i = 0; i < 5; i++) {
        if (!st.digits[i]) continue;                   // الأصابع الضاغطة وحدها تقود اليد؛ المرتخية تتبعها
        const { base, lim } = reachOf(i), dv = V.sub(ar(tgt[i]), base), D = V.len(dv), ex = D - lim;
        if (ex > worst) { worst = ex; mv = V.mul(dv, ex / D); wi = i; }
      }
      if (!mv || worst < 2e-4) break;
      dbg.push([wi, +(worst * 1000).toFixed(1)]);
      O = V.add(O, mv);
      const q = new THREE.Vector3(...O).applyMatrix4(kbInv);           // سقف الاقتراب: المعصم لا يهبط تحت 30 مم فوق سطح البيض
      if (q.x > -0.022 - 0.030) { q.x = -0.022 - 0.030; O = ar(q.applyMatrix4(kbM)); }
    }
    // الأصابع المرتخية تنتقل مع اليد على طول المفاتيح فلا تنطوي أكثر من اللازم
    { const a = new THREE.Vector3(...O).applyMatrix4(kbInv), b = new THREE.Vector3(...O0).applyMatrix4(kbInv); shiftZ = a.z - b.z; if (Math.abs(shiftZ) > 1e-5) build(); }
    const fr = Frame(O, xv, yv, zv); this.dbgR = dbg;
    const toL = (q) => { const d = V.sub(q, O); return [V.dot(d, xv), V.dot(d, yv), V.dot(d, zv)]; };
    this.handRFrame = fr;
    const fo = clamp((this.acc.getWidth() - 0.13) / 0.18, 0, 1);               // مع اتساع المنفاخ يبتعد المرفق الأيمن قليلًا للخارج/الخلف
    this.poseArm('R', fr, [RPOLE[0] - 0.4 * fo, RPOLE[1] + 0.25 * fo, RPOLE[2] - 0.75 * fo]);
    // بداية دافئة: نطبّق تصحيح التلامس الذي وُجد في الإطار السابق للإصبع نفسه على المفتاح نفسه، فيكفي غالبًا قياس واحد للتحقق (أداء)
    const warm = this._warmR || (this._warmR = new Map());
    for (const k of [...warm.keys()]) { const [d, id] = k.split(':'); const pr = st.digits[d]; if (!pr || pr.keyId !== id || (pr.lift ?? 0) > 0.9) warm.delete(k); }
    for (const [k, [dy, dl]] of warm) { const d = +k.split(':')[0]; tgt[d] = tgt[d].clone().add(new THREE.Vector3(...ar(this.WdK([-dl, dy, 0])))); }
    const chains = [];
    for (let i = 0; i < 4; i++) chains.push(fingerArch(hm.fingers[i], side, toL(ar(tgt[i + 1])), HAND_POLE, 0.7));
    let thumb = thumbChain(hm.thumb, side, toL(ar(tgt[0])), V.norm([0.2, 0.2, -0.5]), [0, 0.6, 0.6]); this.lastThumbShort = thumb.short;
    poseFingers(rig, hm, fr, chains, thumb);
    // تصحيح التلامس الجانبي: الإصبع الضاغط ينزل مع مفتاحه ~6 مم تحت سطح جيرانه، فإن امتد لحم طرفه (خصوصًا الإبهام العريض المائل)
    // خارج عرض مفتاحه دخل في المفتاح المجاور. نقيس الجلد الفعلي بعد الوضعية، ونزيح هدف ذلك الإصبع على عرض اللوحة بالقدر اللازم
    // ليبقى طرفه داخل مفتاحه، ونضبط عمقه ليستقر لحم الطرف على سطح مفتاحه (لا اختراق ولا تحليق — سُمك اللحم يختلف بين الأصابع والشخصيتين)، ثم نعيد حلّ الأصابع في الإطار نفسه (تكراران كحدّ أقصى) — لا تأخّر ولا اهتزاز بين الإطارات.
    for (let it = 0; it < 2; it++) {
      const sh = this.padSideShift(st);
      if (!sh) break;
      for (const [d, [dy, dl]] of sh) tgt[d] = tgt[d].clone().add(new THREE.Vector3(...ar(this.WdK([-dl, dy, 0]))));      // −x في إطار اللوحة = بعيدًا عن السطح
      for (const [d, [dy, dl]] of sh) { const k = d + ':' + st.digits[d].keyId, o = warm.get(k) || [0, 0]; warm.set(k, [clamp(o[0] + dy, -0.007, 0.007), clamp(o[1] + dl, -0.008, 0.008)]); }
      for (let i = 0; i < 4; i++) if (sh.has(i + 1)) chains[i] = fingerArch(hm.fingers[i], side, toL(ar(tgt[i + 1])), HAND_POLE, 0.7);
      if (sh.has(0)) { thumb = thumbChain(hm.thumb, side, toL(ar(tgt[0])), V.norm([0.2, 0.2, -0.5]), [0, 0.6, 0.6]); this.lastThumbShort = thumb.short; }
      poseFingers(rig, hm, fr, chains, thumb);
    }
    this.rChains = chains; this.rTargets = tgt;
  }

  /** لكل إصبع ضاغط: إزاحة جانبية (م، محور y للوحة) تُخرج جلد طرفه من المفاتيح المجاورة، ورفع (م) يُبقيه فوق سطح مفتاحه. Map(d → [dy, lift]) أو null */
  padSideShift(st) {
    const rig = this.rig, acc = this.acc, kbInv = acc.kb.matrixWorld.clone().invert(), p = new THREE.Vector3();
    const FN = ['index', 'middle', 'ring', 'little'], M = 0.0004;
    if (!this._padV) this._padV = {};
    const keys = Object.values(acc.keys);
    let out = null;
    for (let d = 0; d < 5; d++) {
      const pr = st.digits[d]; if (!pr || !acc.keys[pr.keyId] || (pr.lift ?? 0) > 0.9) continue;
      const k = acc.keys[pr.keyId];
      if (!this._padV[d]) { const bn = d === 0 ? ['thumb3', 'thumb2'] : [FN[d - 1] + '3', FN[d - 1] + '2']; this._padV[d] = rig.verts(bn.map((n) => rig.b('R', n)).filter(Boolean), 0.35).filter((_, j) => j % 3 === 0); }     // كل ثالث رأس (الشبكة كثيفة جدًا عند الأصابع) — أداء
      const near = keys.filter((q) => Math.abs(q.y - k.y) < 0.045);      // الجيران القريبون فقط (أداء)
      let up = 0, dn = 0, gap = Infinity;                     // up/dn: إزاحة جانبية لازمة، gap: أقل مسافة بين لحم الطرف وسطح مفتاحه (سالب = اختراق)
      for (const e of this._padV[d]) {
        rig.vertexWorld(e.m, e.i, p); p.applyMatrix4(kbInv);
        if (p.y < 0 || p.y > DIM.H || p.z < 0 || p.z > DIM.KB_LEN) continue;
        // المفتاح «المالك» لهذه النقطة بنفس قاعدة قياس الاختراق: الأسود يسبق الأبيض
        let own = null;
        for (const q of near) { if (Math.abs(p.y - q.y) <= q.wid / 2 && p.z >= q.zc - q.len / 2 && p.z <= q.zc + q.len / 2 && (!own || q.black)) own = q; }
        if (!own) continue;
        const depth = p.x - (own.pivot.position.x - own.thick / 2);
        if (own === k) { if (depth < own.thick) gap = Math.min(gap, -depth); continue; }
        if (depth <= -M || depth > own.thick + 0.004) continue;
        if (own.y > k.y) dn = Math.max(dn, p.y - (own.y - own.wid / 2) + M);
        else up = Math.max(up, own.y + own.wid / 2 - p.y + M);
      }
      // التلامس مع سطح المفتاح نفسه: الطرف يستقر على السطح (0.2 مم) فلا يخترقه ولا يحوم فوقه — فقط حين يكون الإصبع ضاغطًا فعلًا (لا أثناء الرفع)
      const contact = (pr.lift ?? 0) < 0.05 && isFinite(gap) ? gap - 0.0002 : 0;
      const lift = Math.abs(contact) > 0.0002 ? -clamp(contact, -0.004, 0.008) : 0;
      if (up > 0 || dn > 0 || lift !== 0) { (out || (out = new Map())).set(d, [clamp(up - dn, -0.007, 0.007), lift]); }
    }
    return out;
  }

  // ---------- يد يسرى ----------
  // state: { row: صف الفهرس (عشري 0..5 من الأعلى)، z: موضع العمود (0..7 عشري)، digits: { d(0..2): {bassId, amt} } }
  solveLeft(st, w) {
    const rig = this.rig, hm = this.hand.L, acc = this.acc, side = 1;
    const fl = V.norm(LF), nloc = [-1, 0, 0];
    const f = ar(this.WdL(fl)), n = ar(this.WdL(nloc));
    const yv = V.norm(f), zv = V.norm(V.mul(n, -1)), xv = V.cross(yv, zv);
    const xEnd = DIM.WL;                                           // وجه لوحة الباص المحلي
    const rowY = (r) => acc.DIM.H - ((acc.DIM.H - 6 * DIM.BASS_DY) / 2 + (r + 0.5) * DIM.BASS_DY);
    const colZ = (c) => (DIM.D - 8 * DIM.BASS_DZ) / 2 + (c + 0.5) * DIM.BASS_DZ;
    const tgt = [];
    // الأصابع: 0 سبابة، 1 وسطى، 2 بنصر (ثلاثة صفوف متجاورة)، 3 خنصر مرتخٍ
    const hoverL = (d) => this.WL([xEnd + 0.008 + 0.0063 + 0.00625 + 0.0075 + 0.0045 - 0.004 + 0.0005, rowY(clamp(st.row + d, 0, 5)), colZ(clamp(st.z, 0, 7))]);
    for (let d = 0; d < 3; d++) {
      const pr = st.digits[d], h = hoverL(d);
      if (pr && acc.buttons[pr.bassId]) {
        const tp = this.buttonSurface(acc.buttons[pr.bassId]);
        tgt.push(pr.lift > 0 ? tp.lerp(h, clamp(pr.lift, 0, 1)) : tp);
      } else tgt.push(h);
    }
    const r3 = clamp(st.row + 3, 0, 5);
    tgt.push(this.WL([xEnd + 0.034, rowY(r3) - 0.004, colZ(clamp(st.z, 0, 7)) + 0.004]));
    const mid = hm.fingers[1], tot = mid.L[0] + mid.L[1] + mid.L[2], mx = mid.k[0] * side, my = mid.k[1];
    const T = ar(hoverL(1));
    const O = V.sub(V.sub(T, V.mul(xv, mx)), V.madd(V.mul(yv, my + L_ARCH[0] * tot), zv, -L_ARCH[1] * tot));
    const fr = Frame(O, xv, yv, zv);
    const toL = (q) => { const d = V.sub(q, O); return [V.dot(d, xv), V.dot(d, yv), V.dot(d, zv)]; };
    this.handLFrame = fr;
    this.poseArm('L', fr, LPOLE_ARM);
    const warm = this._warmL || (this._warmL = new Map());
    const wkey = (d) => { const pr = st.digits[d]; return d + ':' + (d < 3 && pr && acc.buttons[pr.bassId] && (pr.lift ?? 0) <= 0.05 ? pr.bassId : 'h'); };
    for (const k of [...warm.keys()]) if (wkey(+k.split(':')[0]) !== k) warm.delete(k);
    for (const [k, off] of warm) { const d = +k.split(':')[0]; tgt[d] = tgt[d].clone().add(new THREE.Vector3(...ar(this.WdL(off)))); }
    const chains = [];
    for (let i = 0; i < 4; i++) chains.push(fingerArch(hm.fingers[i], side, toL(ar(tgt[i])), HAND_POLE, 0.7));
    // الإبهام خلف الصندوق: على حافته العليا الخلفية
    const thTarget = this.WL([xEnd + 0.012, DIM.H + 0.006, colZ(clamp(st.z, 0, 7)) - 0.03]);
    const thumb = thumbChain(hm.thumb, side, toL(ar(thTarget)), V.norm([-0.2, 0.2, -0.5]), [0, 0.6, 0.6]);
    poseFingers(rig, hm, fr, chains, thumb);
    // تلامس الأصابع الضاغطة مع الأزرار (كاليد اليمنى): الطرف يستقر على سطح زرّه، ولا يدخل لحمه في الأزرار المجاورة
    for (let it = 0; it < 2; it++) {
      const sh = this.padFixLeft(st);
      if (!sh) break;
      for (const [d, off] of sh) { tgt[d] = tgt[d].clone().add(new THREE.Vector3(...ar(this.WdL(off)))); chains[d] = fingerArch(hm.fingers[d], side, toL(ar(tgt[d])), HAND_POLE, 0.7); }
      for (const [d, off] of sh) { const k = wkey(d), o = warm.get(k) || [0, 0, 0]; warm.set(k, [clamp(o[0] + off[0], -0.004, 0.008), clamp(o[1] + off[1], -0.006, 0.006), clamp(o[2] + off[2], -0.006, 0.006)]); }
      poseFingers(rig, hm, fr, chains, thumb);
    }
    this.lChains = chains; this.lTargets = tgt;
  }

  pose(s) {
    this.acc.setWidth(s.w, s.fan);
    this.acc.root.updateMatrixWorld(true);
    this.solveRight(s.R);
    this.solveLeft(s.L, this.acc.getWidth());
    const fl = this.handLFrame, el = this.rig.wp('L', 'lowerArm');
    const dir = new THREE.Vector3(fl.o[0] - el.x, fl.o[1] - el.y, fl.o[2] - el.z).normalize();
    const pos = new THREE.Vector3(...fl.o).addScaledVector(dir, -0.014);
    const dorsum = this.leftDorsum();
    if (this._bassZ == null && dorsum.length) {               // المثبّتان على عمق الصندوق تحت ظهر الكف في الوضع الافتراضي (ثابتان بعدها كالحقيقة؛ تنزلق اليد تحت الحزام)
      const mid = dorsum[Math.floor(dorsum.length / 2)].clone(); this.acc.leftBox.worldToLocal(mid); this._bassZ = clamp(mid.z, 0.022, DIM.D - 0.022);     // على وجه الصندوق نفسه (لا خلفه)
    }
    if (this._bassZ != null) this.acc.setBassStrapZ(this._bassZ);
    this.acc.updateStraps({ pos, dir, up: new THREE.Vector3(...fl.z), dorsum });
  }

  /** تصحيح أطراف اليد اليسرى الضاغطة (إحداثيات صندوق الباص): Map(d → [dx, dy, dz]) أو null */
  padFixLeft(st) {
    const rig = this.rig, acc = this.acc, inv = acc.leftBox.matrixWorld.clone().invert(), p = new THREE.Vector3();
    const FN = ['index', 'middle', 'ring', 'little'], R = 0.0078, M = 0.0004, HOVER = 0.0015;
    // الأزرار في متناول الأصابع فقط (أداء): ضمن 21 سم من الرسغ (طول الكف مع الأصابع) في مستوى لوحة الباص
    // بحث مباشر في شبكة الأزرار المنتظمة (الزر تحت النقطة وجيرانه فقط) بدل المرور على 48 زرًا لكل رأس — أداء
    if (!this._btnGrid) { this._btnGrid = new Map(); for (const q of Object.values(acc.buttons)) this._btnGrid.set(q.data.row * 100 + q.data.col, q); }
    const DY = DIM.BASS_DY, DZ = DIM.BASS_DZ, py0 = (DIM.H - 6 * DY) / 2, pz0 = (DIM.D - 8 * DZ) / 2, cand = [];
    const btnsAt = (pp) => { cand.length = 0; const r0 = Math.round((DIM.H - pp.y - py0) / DY - 0.5), c0 = Math.round((pp.z - pz0) / DZ - 0.5);
      for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) { const q = this._btnGrid.get(r * 100 + c); if (q) cand.push(q); } return cand; };
    if (!this._padVL) this._padVL = {};
    let out = null;
    for (let d = 0; d < 4; d++) {
      const pr = st.digits[d], pressing = d < 3 && pr && acc.buttons[pr.bassId] && (pr.lift ?? 0) <= 0.05;
      const b = pressing ? acc.buttons[pr.bassId] : null;
      if (!pressing) {
        // الأصابع غير الضاغطة (أو أثناء الرفع): تبقى فوق كل الأزرار بهامش 1.5 مم — لحم طرف العازف أسمك فكان البنصر الحائم يلمس الزر تحته
        if (!this._padVL[d]) this._padVL[d] = rig.verts([FN[d] + '3', FN[d] + '2'].map((n) => rig.b('L', n)).filter(Boolean), 0.35).filter((_, j) => j % 3 === 0);
        let g0 = Infinity;
        for (const e of this._padVL[d]) { rig.vertexWorld(e.m, e.i, p); p.applyMatrix4(inv); for (const q of btnsAt(p)) { const dy = p.y - q.y, dz = p.z - q.z; if (dy * dy + dz * dz > R * R) continue; g0 = Math.min(g0, p.x - (DIM.WL + q.pivot.position.x + 0.00625)); } }
        if (isFinite(g0) && g0 < HOVER - 0.0002 && g0 > -0.01) (out || (out = new Map())).set(d, [HOVER - g0, 0, 0]);
        continue;
      }
      if (!this._padVL[d]) this._padVL[d] = rig.verts([FN[d] + '3', FN[d] + '2'].map((n) => rig.b('L', n)).filter(Boolean), 0.35).filter((_, j) => j % 3 === 0);
      let gap = Infinity, sy = 0, sz = 0, sm = 0;
      for (const e of this._padVL[d]) {
        rig.vertexWorld(e.m, e.i, p); p.applyMatrix4(inv);
        for (const q of btnsAt(p)) {
          const dy = p.y - q.y, dz = p.z - q.z, r2 = dy * dy + dz * dz; if (r2 > R * R) continue;
          const surf = DIM.WL + q.pivot.position.x + 0.00625, g = p.x - surf;
          if (q === b) { if (g > -0.006) gap = Math.min(gap, g); continue; }
          if (g >= M) continue;                                   // فوق سطح الجار: لا تماس
          const r = Math.sqrt(r2) || 1e-6, need = R - r + M;     // نُخرج النقطة من دائرة الزر المجاور جانبيًا
          if (need > sm) { sm = need; sy = dy / r * need; sz = dz / r * need; }
        }
      }
      const dx = isFinite(gap) && Math.abs(gap - 0.0002) > 0.0002 ? -clamp(gap - 0.0002, -0.004, 0.008) : 0;
      if (dx !== 0 || sm > 0) (out || (out = new Map())).set(d, [dx, sy, sz]);
    }
    return out;
  }

  /** نقاط ظهر الكف اليسرى (عالمية) عبر عرض اليد عند منتصف عظام المشط: يمرّ عليها حزام الباص ملامسًا الجلد من فوق.
   *  تُقاس من جلد اليد الفعلي في كل إطار (يختلف حجم يد العازف عن العازفة، وتتغير الوضعية أثناء العزف). */
  leftDorsum() {
    const rig = this.rig, fr = this.handLFrame; if (!fr) return [];
    if (!this._dorsV) {                                          // ظهر الكف مربوط بعظام المشط (metacarpal1..4) لا بعظمة الرسغ
      const sk = rig.meshes.find((m) => m.skeleton) && rig.meshes.find((m) => m.skeleton).skeleton, hb = rig.b('L', 'hand');
      const meta = sk ? sk.bones.filter((b) => /^metacarpal\dL$/i.test(b.name)) : [];
      this._dorsV = rig.verts([hb, ...meta].filter(Boolean), 0.4).filter((_, j) => j % 2 === 0);      // نصف الرؤوس يكفي لغلاف ظهر الكف (أداء)
    }
    const O = fr.o, X = fr.x, Y = fr.y, Z = fr.z, mid = this.hand.L.fingers[1];
    const A0 = 0.74 * mid.k[1], p = new THREE.Vector3();          // موضع الحزام على طول الكف: قبل المفاصل بقليل (منتصف المشط)
    if (this._bassZ != null) { const pl = this.dorsumPlane(); if (pl) return pl; }
    const NB = 7, bins = new Array(NB).fill(null); let bmin = Infinity, bmax = -Infinity; const pts = [];
    for (let i = 0; i < this._dorsV.length; i += 2) {
      const e = this._dorsV[i]; rig.vertexWorld(e.m, e.i, p);
      const d = [p.x - O[0], p.y - O[1], p.z - O[2]], a = V.dot(d, Y); if (Math.abs(a - A0) > 0.014) continue;
      const b = V.dot(d, X), c = V.dot(d, Z); pts.push([b, c]); if (b < bmin) bmin = b; if (b > bmax) bmax = b;
    }
    if (pts.length < 8) return [];
    const w = (bmax - bmin) / NB;
    for (const [b, c] of pts) { const k = Math.min(NB - 1, Math.floor((b - bmin) / w)); if (!bins[k] || c > bins[k][1]) bins[k] = [b, c]; }
    const out = [];
    for (let k = 1; k < NB - 1; k++) {                          // نتجاهل الحافتين (جانبا الكف) فيلتف الحزام عليهما بالانحناء الطبيعي
      if (!bins[k]) continue; const [b, c] = bins[k], h = c + 0.0030;   // فوق الجلد بنصف سُمك الحزام وهامش صغير
      out.push(new THREE.Vector3(O[0] + Y[0] * A0 + X[0] * b + Z[0] * h, O[1] + Y[1] * A0 + X[1] * b + Z[1] * h, O[2] + Y[2] * A0 + X[2] * b + Z[2] * h));
    }
    return out;
  }
  dorsumPlane() {
    const rig = this.rig, p = new THREE.Vector3();
    // الحزام مثبّت في الصندوق فيمرّ في مستوى ثابت (z = عمق المثبّتين في صندوق الباص)، واليد تنزلق تحته حين تنتقل بين أعمدة الأزرار.
    // نقيس مقطع ظهر الكف مع هذا المستوى نفسه (أعلى جلد في كل شريحة رأسية) فيلامس الحزام اليد في موضعها الحالي بلا اختراق ولا تعرّج.
    const lb = this.acc.leftBox, inv = lb.matrixWorld.clone().invert(), zz = this._bassZ, NS = 11, sl = new Array(NS).fill(null);
    let ylo = Infinity, yhi = -Infinity; const hits = [];
    for (let i = 0; i < this._dorsV.length; i++) {
      const e = this._dorsV[i]; rig.vertexWorld(e.m, e.i, p); p.applyMatrix4(inv);
      if (Math.abs(p.z - zz) > 0.017) continue;                  // عرض الحزام كله (±15 مم) وهامش
      hits.push([p.y, p.x]); if (p.y < ylo) ylo = p.y; if (p.y > yhi) yhi = p.y;
    }
    if (hits.length < 10) return null;
    const sw = (yhi - ylo) / NS;
    for (const [y, x] of hits) { const k = Math.min(NS - 1, Math.floor((y - ylo) / sw)); if (!sl[k] || x > sl[k][1]) sl[k] = [y, x]; }
    // غلاف علوي: ارتفاع كل شريحة = أعلى جلد فيها وفي جارتيها، فلا ينخفض الحزام بين نقطتين فيظهر الجلد من خلاله (الجلد الحقيقي لا يتبع كل نتوء)
    const hx = sl.map((v, k) => (v ? Math.max(v[1], sl[k - 1] ? sl[k - 1][1] : -1, sl[k + 1] ? sl[k + 1][1] : -1) : null));
    const plane = [];
    for (let k = 1; k < NS - 1; k++) if (sl[k]) plane.push(lb.localToWorld(new THREE.Vector3(hx[k] + 0.0050, sl[k][0], zz)));     // نصف سُمك الحزام + هامش للجلد
    return plane.length >= 2 ? plane : null;
  }

  // قياس اختراق اليدين للمفاتيح/الأزرار (مم): أعمق نقطة جلد داخل جسم المفتاح، وأقرب مسافة للأطراف من أهدافها
  penetration() {
    const rig = this.rig, acc = this.acc, p = new THREE.Vector3(), out = {};
    const names = ['hand', 'thumb1', 'thumb2', 'thumb3', ...['index', 'middle', 'ring', 'little'].flatMap((f) => [1, 2, 3].map((i) => f + i))];
    for (const s of ['R', 'L']) {
      const bones = names.map((n) => rig.b(s, n)).filter(Boolean);
      let worst = 0, where = null, n = 0;
      for (const bn of bones) for (const e of rig.verts([bn], 0.35)) {
        rig.vertexWorld(e.m, e.i, p); n++;
        let d = 0;
        if (s === 'R') { acc.kb.worldToLocal(p); d = this.keyPenetration(p); } else { acc.leftBox.worldToLocal(p); d = this.buttonPenetration(p); }
        if (d > worst) { worst = d; where = [bn.name, ...[p.x, p.y, p.z].map((v) => +v.toFixed(3))]; }
      }
      out[s] = { maxMm: +(worst * 1000).toFixed(1), at: where, verts: n };
    }
    return out;
  }

  // عمق دخول نقطة (إحداثيات لوحة المفاتيح kb) في أقرب مفتاح — يراعي الضغط الحالي للمفتاح
  keyPenetration(p) {
    const acc = this.acc; if (p.y < 0 || p.y > DIM.H || p.z < 0 || p.z > DIM.KB_LEN) return 0;
    let best = null;
    for (const k of Object.values(acc.keys)) {
      const half = k.wid / 2, zlo = k.zc - k.len / 2, zhi = k.zc + k.len / 2;
      if (Math.abs(p.y - k.y) <= half && p.z >= zlo && p.z <= zhi) { const surf = k.pivot.position.x - k.thick / 2, d = p.x - surf; if (d > 0 && d < k.thick + 0.004 && (best === null || k.black)) best = d; }
    }
    return best ?? 0;
  }
  buttonPenetration(p) {
    const acc = this.acc; if (p.y < 0 || p.y > DIM.H || p.z < 0 || p.z > DIM.D) return 0;
    let d = 0;
    for (const b of Object.values(acc.buttons)) {
      const dy = p.y - b.y, dz = p.z - b.z; if (dy * dy + dz * dz > 0.0078 * 0.0078) continue;
      const surf = DIM.WL + b.pivot.position.x + 0.00625; d = Math.max(d, surf - p.x);
    }
    return d;
  }

  report() { return { ...this.qa, reachR: this.qa.reachR, reachL: this.qa.reachL }; }
}
