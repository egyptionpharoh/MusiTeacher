// =====================================================================
//  العازفة والأكورديون: الجلوس، حمل الآلة، الأشرطة، وحركة اليدين والأصابع على المفاتيح والأزرار.
//  تُحلّ الذراعان بالـIK (من SeatedPlayer)، والأصابع بقوس (fingerArch) نحو نقاط تلامس فعلية على الآلة.
//  ما يخصّ الأكورديون فقط (لا حركة منسوخة من الكمان): يد يمنى فوق المفاتيح تتحرك على العمود الرأسي،
//  ويد يسرى تحتضن طرف صندوق الباص وتتحرك معه أثناء تمدد المنفاخ.
// =====================================================================
import * as THREE from 'three';
import { V, Frame, F, ik2 } from '../../_shared/3d/engine/math.js';
import { SeatedPlayer } from '../../_shared/3d/character/seated-player.js';
import { FINGERS, fingerArch, thumbChain, poseHandRotation, poseFingers } from '../../_shared/3d/character/hand.js';
import { DIM } from '../instrument/accordion-model.js';
import { WHITE_COUNT } from '../instrument/accordion-data.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const ar = (v) => [v.x, v.y, v.z];
const QP = (k, d) => { const q = new URLSearchParams(location.search).get(k); return q ? q.split(',').map(Number) : d; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ثوابت قابلة للضبط عبر الرابط أثناء المعايرة (لا تؤثر في الاستعمال العادي)
const RF = QP('rf', [0.0, -0.2, 1.0]);        // اتجاه أصابع اليد اليمنى (إحداثيات الآلة)
const LF = QP('lf', [0.0, -0.1, 1.0]);          // اتجاه أصابع اليد اليسرى
const RPOLE = QP('rpole', [-0.75, 0.35, -0.2]);
const LPOLE_ARM = QP('lepole', [0.75, -0.35, -0.3]);
const R_ARCH = QP('rarch', [0.40, 0.64]);       // (أمام، نحو الراحة) كسور من طول الإصبع لموضع الطرف بالنسبة لجذر الإصبع
const L_ARCH = QP('larch', [0.46, 0.66]);
const PAD = QP('pad', [0.0088])[0];             // سُمك لحم الطرف: الهدف يوضع فوق السطح بهذا المقدار
const HAND_POLE = QP('hpole', [0, 1, 0.6]);

export class Accordionist extends SeatedPlayer {
  constructor(rig, config, accordion) { super(rig, config); this.acc = accordion; }

  setup() {
    this.baseSetup();
    this.placeAccordion();
    this.buildStraps();
    this.rightState = { base: 6.0, digits: {} }; this.leftState = { row: 0.5, z: 2.6, digits: {} };
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
    const thighTop = this.surfaceExtent((p) => p.z > chestZ - 0.02 && p.z < chestZ + 0.20 && Math.abs(p.x) < 0.22 && p.y < 0.75 && p.y > 0.5, 'y', 1);
    this.qa.chestZ = +chestZ.toFixed(3); this.qa.thighTop = +thighTop.toFixed(3);
    const tilt = QP('tilt', [4])[0] * Math.PI / 180;       // ميل الآلة قليلًا نحو الصدر
    const x0 = QP('ax', [-0.05])[0];                        // موضع الطرف الداخلي للصندوق الأيمن
    acc.root.position.set(x0, thighTop + QP('ay', [0.004])[0], chestZ + QP('az', [0.012])[0]);
    acc.root.rotation.set(-tilt, 0, 0);
    acc.root.updateMatrixWorld(true);
    this.accOrigin = acc.root.position.clone();
  }

  // تحويل نقطة محلية في الآلة إلى العالم
  W(p) { return this.acc.root.localToWorld(new THREE.Vector3(p[0], p[1], p[2])); }
  Wd(d) { return v3(d).applyQuaternion(this.acc.root.quaternion); }
  // صندوق الباص يميل مع المروحة: نقاطه واتجاهاته تُحوَّل من إطاره هو
  WL(p) { return this.acc.leftBox.localToWorld(new THREE.Vector3(p[0], p[1], p[2])); }
  WdL(d) { return v3(d).applyQuaternion(this.acc.leftBox.getWorldQuaternion(new THREE.Quaternion())); }

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
      const yA = yAx - 0.02, yB = yAx - 0.14, m = 0.009;
      const zS = sh.z - 0.075, yTop2 = topAt(x, zS);
      const pts = [
        new THREE.Vector3(x, topY + 0.007, sh.z),
        new THREE.Vector3(x, yTop2 + m, zS),
        new THREE.Vector3(x * 0.95, topY - 0.14, backAll(topY - 0.14, x * 0.95) - m),
        new THREE.Vector3(x * 0.92, topY - 0.26, backAll(topY - 0.26, x * 0.92) - m),
        new THREE.Vector3(sg * (half(yA) + 0.014), yA - 0.05, sh.z - 0.1),
        new THREE.Vector3(sg * (half(yB) + 0.016), yB - 0.04, sh.z - 0.0),
      ];
      acc.setShoulderPath(s, pts, 0.05);
    }
    this._strapped = true;
  }

  // سطح المفتاح الخارجي (يتبع ضغط المفتاح لأنه محسوب من شبكته الفعلية)
  keySurface(k, zoff, extra = 0) { return k.mesh.localToWorld(new THREE.Vector3(-k.thick / 2 - PAD - extra, 0, zoff)); }
  buttonSurface(b) { return b.mesh.localToWorld(new THREE.Vector3(0.00625 + PAD, 0, 0)); }

  // ---------- يد يمنى ----------
  // state: { base: موضع الإبهام (رقم عشري على المفاتيح البيضاء 0..19), digits: { d: {keyId, amt} } , hover: ارتفاع الأصابع الخاملة }
  solveRight(st) {
    const rig = this.rig, hm = this.hand.R, acc = this.acc, side = -1;
    const fl = V.norm(RF), nloc = [1, 0, 0];
    const f = ar(this.Wd(fl)), n = ar(this.Wd(nloc));
    // إطار اليد: y أصابع، z ظهر اليد = -n، x = y × z
    const yv = V.norm(f), zv = V.norm(V.mul(n, -1)), xv = V.cross(yv, zv);
    const fr0 = Frame([0, 0, 0], xv, yv, zv);
    const kw = DIM.KEY_W;
    const slotY = (s) => (DIM.H - WHITE_COUNT * kw) / 2 + (WHITE_COUNT - s - 0.5) * kw;
    const tgt = [];                                  // أهداف الأصابع (0 إبهام .. 4 خنصر) بالإحداثيات المحلية للآلة ثم العالم
    const hover = (d) => {
      const sl = clamp(st.base + d, 0, WHITE_COUNT - 1);
      const lift = 0.0095 + 0.0035 * Math.abs(d - 2) * 0.5;
      return this.W([-DIM.WR - 0.009 - 0.012 - lift, slotY(sl), 0.115 - (d === 0 ? 0.012 : d === 3 ? 0.010 : d === 4 ? 0.017 : 0)]);     // الخنصر والبنصر المرتخيان أقرب للراحة فيتكوّران بدل أن يمتدا
    };
    for (let d = 0; d < 5; d++) {
      const pr = st.digits[d], h = hover(d);
      if (pr && acc.keys[pr.keyId]) {
        const k = acc.keys[pr.keyId], tp = this.keySurface(k, k.black ? 0.0 : 0.022, d === 0 ? 0.0035 : 0);
        tgt.push(pr.lift > 0 ? tp.lerp(h, clamp(pr.lift, 0, 1)) : tp);
      } else tgt.push(h);
    }
    const anchor = hover(2);
    // موضع المعصم: نضع هدف الوسطى عند إحداثيات الكف المرغوبة
    const mid = hm.fingers[1], tot = mid.L[0] + mid.L[1] + mid.L[2], mx = mid.k[0] * side, my = mid.k[1];
    const T = ar(anchor);
    const O = V.sub(V.sub(T, V.mul(xv, mx)), V.madd(V.mul(yv, my + R_ARCH[0] * tot), zv, -R_ARCH[1] * tot));
    const fr = Frame(O, xv, yv, zv);
    const toL = (q) => { const d = V.sub(q, O); return [V.dot(d, xv), V.dot(d, yv), V.dot(d, zv)]; };
    this.handRFrame = fr;
    const fo = clamp((this.acc.getWidth() - 0.13) / 0.18, 0, 1);               // مع اتساع المنفاخ يبتعد المرفق الأيمن قليلًا للخارج/الخلف
    this.poseArm('R', fr, [RPOLE[0] - 0.4 * fo, RPOLE[1] + 0.25 * fo, RPOLE[2] - 0.75 * fo]);
    const chains = [];
    for (let i = 0; i < 4; i++) chains.push(fingerArch(hm.fingers[i], side, toL(ar(tgt[i + 1])), HAND_POLE, 0.7));
    const thumb = thumbChain(hm.thumb, side, toL(ar(tgt[0])), V.norm([0.2, 0.2, -0.5]), [0, 0.6, 0.6]);
    poseFingers(rig, hm, fr, chains, thumb);
    this.rChains = chains; this.rTargets = tgt;
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
    const chains = [];
    for (let i = 0; i < 4; i++) chains.push(fingerArch(hm.fingers[i], side, toL(ar(tgt[i])), HAND_POLE, 0.7));
    // الإبهام خلف الصندوق: على حافته العليا الخلفية
    const thTarget = this.WL([xEnd + 0.012, DIM.H + 0.006, colZ(clamp(st.z, 0, 7)) - 0.03]);
    const thumb = thumbChain(hm.thumb, side, toL(ar(thTarget)), V.norm([-0.2, 0.2, -0.5]), [0, 0.6, 0.6]);
    poseFingers(rig, hm, fr, chains, thumb);
    this.lChains = chains; this.lTargets = tgt;
  }

  pose(s) {
    this.acc.setWidth(s.w);
    this.acc.root.updateMatrixWorld(true);
    this.solveRight(s.R);
    this.solveLeft(s.L, this.acc.getWidth());
    const fl = this.handLFrame, el = this.rig.wp('L', 'lowerArm');
    const dir = new THREE.Vector3(fl.o[0] - el.x, fl.o[1] - el.y, fl.o[2] - el.z).normalize();
    const pos = new THREE.Vector3(...fl.o).addScaledVector(dir, -0.014);
    this.acc.updateStraps({ pos, dir, up: new THREE.Vector3(...fl.z) });
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
        if (s === 'R') { acc.root.worldToLocal(p); d = this.keyPenetration(p); } else { acc.leftBox.worldToLocal(p); d = this.buttonPenetration(p); }
        if (d > worst) { worst = d; where = [bn.name, ...[p.x, p.y, p.z].map((v) => +v.toFixed(3))]; }
      }
      out[s] = { maxMm: +(worst * 1000).toFixed(1), at: where, verts: n };
    }
    return out;
  }

  // عمق دخول نقطة (إحداثيات الآلة المحلية) في أقرب مفتاح/لوحة — يراعي الضغط الحالي للمفتاح
  keyPenetration(p) {
    const acc = this.acc; if (p.y < 0 || p.y > DIM.H || p.z < 0.02 || p.z > 0.15) return 0;
    const kw = DIM.KEY_W, y0 = (DIM.H - WHITE_COUNT * kw) / 2;
    let best = null, bd = 1e9;
    for (const k of Object.values(acc.keys)) {
      const half = (k.black ? 0.0108 : kw - 0.0011) / 2, zlo = k.zc - k.len / 2, zhi = k.zc + k.len / 2;
      if (Math.abs(p.y - k.y) <= half && p.z >= zlo && p.z <= zhi) { const surf = -DIM.WR + k.pivot.position.x - k.thick / 2, d = p.x - surf; if (d > 0 && d < k.thick + 0.004 && (best === null || k.black)) best = d; }
    }
    if (best !== null) return best;
    const plateFace = -DIM.WR - 0.010;            // لوحة المفاتيح بين المفاتيح
    return Math.max(0, p.x - plateFace) * 0;
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
