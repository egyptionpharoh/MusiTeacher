// =====================================================================
//  أداء اليدين: يحوّل جدول الضربات (على ساعة الصوت) إلى حركة يد متزامنة:
//  استعداد مرفوع ← هبوط سريع ← ملامسة الجلد لحظة الصوت تمامًا ← ارتداد فوري ← انتقال إلى الضربة التالية.
//  الحركة «بلا حالة»: تُحسب في كل إطار من الزمن الحالي والضربات المجدولة فقط، فلا تتراكم أخطاء عند تغيير السرعة أو الإيقاف والإعادة.
//
//  اليد الأخرى (اليسرى) لها وظيفة حسب الآلة (data/performance.js → support):
//   grip  آلة خفيفة (الرق، المزهر): تُرفع الآلة عن الأرض وتميل نحو العازف، واليسرى تمسك الإطار (الإبهام على الجدار أو في فتحة الإبهام)
//   rim   الطبلة: اليسرى مستندة على الحافة، ومنها تنقر «الكا» بالبنصر والخنصر
//   side  الكاسر والرحماني: كفّ اليسرى مسنودة على جانب الطبل
//  كل الوضعيات محسوبة في «إحداثيات الآلة» نفسها؛ لذلك حين تتحرك الآلة المحمولة (تنفّس، ارتداد الضربة) تتحرك اليدان معها
//  دون أن تنفصل القبضة أو تتغيّر نقطة الملامسة.
//  حيوية بشرية: تنفّس وتمايل خفيف جدًا مستقل عن الإيقاع (ساعة الصفحة لا ساعة الصوت)، ويتلاشى في اليد الضاربة قرب كل ضربة.
// =====================================================================
import * as THREE from 'three';
import { FINGERS } from './hands.js';
import { SHAPES, PERFORMANCE } from '../data/performance.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const easeIn = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t);            // تسارع نحو الجلد
const easeOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t)); // ارتداد سريع ثم تباطؤ
const PAD = 0.0072;                                                  // سُمك الإصبع من محور العظمة إلى باطنه (تقريبًا)
const TAU = Math.PI * 2;
/** التنفّس: دورة ~4.3 ث مع تموّج أبطأ حتى لا يبدو تكرارًا آليًا */
const breath = (T) => 0.8 * Math.sin(TAU * T / 4.3) + 0.2 * Math.sin(TAU * T / 9.7 + 1.3);
/** انجراف بطيء غير دوري تقريبًا (مجموع موجتين غير متناسبتين) */
const drift = (T, ph = 0) => 0.6 * Math.sin(TAU * T / 13.1 + ph) + 0.4 * Math.sin(TAU * T / 5.9 + ph * 2.1);

/** إطار يد من اتجاه الأصابع الأفقي (yaw) وميلها (pitch) ودوران الكف حول محورها (roll) */
export function axesFrom(yaw, pitch, roll = 0) {
  const y = V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).normalize();
  const z = V(0, 1, 0); z.sub(y.clone().multiplyScalar(z.dot(y))).normalize(); if (roll) z.applyAxisAngle(y, roll);
  const x = V().crossVectors(y, z).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
/** إطار من اتجاه الأصابع y وتقريب لظهر الكف zHint */
function axesDir(y, zHint) {
  y = y.clone().normalize(); const z = zHint.clone().sub(y.clone().multiplyScalar(zHint.dot(y))).normalize(); const x = V().crossVectors(y, z).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
const cloneFingers = (f) => { const o = {}; for (const k of FINGERS) o[k] = (f[k] || [0, 0, 0]).slice(); return o; };
const clonePose = (p) => ({ ...p, o: p.o.clone(), q: p.q.clone(), fingers: cloneFingers(p.fingers), thumbAim: p.thumbAim ? p.thumbAim.clone() : null });
function lerpPose(a, b, t) {
  const out = {};
  out.o = a.o.clone().lerp(b.o, t);
  out.q = a.q.clone().slerp(b.q, t);
  out.wrist = a.wrist + (b.wrist - a.wrist) * t; out.spread = a.spread + (b.spread - a.spread) * t;
  out.fingers = {}; for (const f of FINGERS) { const A = a.fingers[f], B = b.fingers[f]; out.fingers[f] = [0, 1, 2].map((j) => A[j] + (B[j] - A[j]) * t); }
  out.thumbAim = a.thumbAim && b.thumbAim ? a.thumbAim.clone().lerp(b.thumbAim, t) : (t < 0.5 ? a.thumbAim : b.thumbAim) || null;
  return out;
}

export class HandPerformer {
  /** hands: كائن Hands · clock(): الزمن المرئي الحالي على ساعة الصوت */
  constructor(hands, clock) {
    this.hands = hands; this.clock = clock; this.events = { L: [], R: [] }; this.cache = new Map(); this.inst = null; this.model = null; this.slow = 1; this.cur = { L: null, R: null };
    this.enabled = true; this.amt = 0; this.alive = true;                // amt: مقدار «تقديم» الآلة المحمولة (0 على الأرض، 1 في يد العازف)
    this.now = () => performance.now() / 1000;                           // ساعة الحيوية (مستقلة عن الإيقاع)
    this.spring = { y: [0, 0], rx: [0, 0], rz: [0, 0] };                // ارتداد الآلة المحمولة بعد الضربة [قيمة، سرعة]
  }

  /** آلة جديدة: تُمسح الضربات والوضعيات المخزنة، وتُحسب وضعيتا الراحة لليدين */
  setInstrument(inst, model, group) {
    this.inst = inst; this.model = model; this.group = group; this.perf = PERFORMANCE[inst.id];
    this.sup = this.perf.support || null; this.present = this.perf.present || null;
    this.cache.clear(); this.clear(); for (const k in this.spring) this.spring[k] = [0, 0];
    this.applyGroup(this.now());
    this.idle = { R: null, L: null };
    const st = Object.entries(this.perf.strokes).find(([, s]) => s.hand === 'R');
    if (st) {
      const p = this.raised(st[0], this.anchor(st[0]));
      // وضع الراحة لليد الضاربة: أعلى قليلًا وأقرب إلى العازف ومائلة إلى يمينه
      this.idle.R = { ...p, o: p.o.clone().add(V(0.05, 0.035, 0.09)), wrist: p.wrist * 0.5, fingers: cloneFingers(p.fingers) };
      for (const f of FINGERS) this.idle.R.fingers[f] = this.idle.R.fingers[f].map((a) => a + 0.12);
    }
    if (this.sup) this.idle.L = this.support();
    this.cur = { L: null, R: null };
  }
  clear() { this.events.L.length = 0; this.events.R.length = 0; }
  /** موضع الضربة على الجلد (إحداثيات الآلة) — الكا تُشتق من قبضة اليد الحاملة */
  anchor(stroke) {
    if (stroke === 'ka' && this.sup) return this.kaContact().anchor.clone();
    const s = this.perf.strokes[stroke], r = s.rho * this.model.R; return V(r * Math.sin(s.ang), this.model.top, r * Math.cos(s.ang));
  }

  // ---------- قياس اليد في إحداثيات الآلة ----------
  toLocal(v) { return this.group.worldToLocal(v); }
  joint(side, f, j) { return this.toLocal(this.hands.joint(side, f, j)); }
  tip(side, f) { return this.toLocal(this.hands.tip(side, f)); }
  backAxis(q) { return V(0, 0, 1).applyQuaternion(q); }

  /** وضعية الملامسة لضربة اليد الضاربة عند نقطة target (إحداثيات الآلة) */
  contact(stroke, target) {
    const s = this.perf.strokes[stroke];
    if (s.hand === 'L' && this.sup) return this.kaContact();
    const key = `${stroke}|${target.x.toFixed(4)}|${target.z.toFixed(4)}`; if (this.cache.has(key)) return this.cache.get(key);
    const shape = SHAPES[s.shape], side = s.hand;
    const q = axesFrom(side === 'R' ? this.perf.yawR : this.perf.yawL, this.perf.pitch, 0);
    const pose = { o: V(), q, wrist: 0, spread: shape.spread, fingers: cloneFingers(shape.fingers), thumbAim: null };
    this.apply(side, pose);
    const zAx = this.backAxis(q), pts = [];
    for (const f of shape.contact) {
      if (shape.pads) { for (const j of [2, 3]) pts.push(this.joint(side, f, j).addScaledVector(zAx, -PAD)); pts.push(this.tip(side, f).addScaledVector(zAx, -PAD * 0.6)); }
      else pts.push(this.tip(side, f).addScaledVector(zAx, -PAD * 0.5).add(V(0, -0.003, 0)));
    }
    let minY = Infinity; const c = V(); for (const p of pts) { minY = Math.min(minY, p.y); c.add(p); } c.multiplyScalar(1 / pts.length);
    pose.o.add(V(target.x - c.x, target.y + 0.0008 - minY, target.z - c.z));
    this.cache.set(key, pose); return pose;
  }
  /** وضعية الاستعداد قبل الضربة: اليد مرفوعة والكف مرفوعة عند المعصم */
  raised(stroke, target, level = 's') {
    const s = this.perf.strokes[stroke];
    if (s.hand === 'L' && this.sup) return this.support();             // الكا: تبدأ من القبضة نفسها ولا تتحرك إلا الإصبعان
    const c = this.contact(stroke, target), shape = SHAPES[s.shape];
    const k = level === 's' ? 1 : 0.6, p = clonePose(c); p.wrist = c.wrist + s.wrist * k;
    p.o.y += (level === 's' ? s.lift : s.liftW);
    if (shape.lifted) for (const f in shape.lifted) p.fingers[f] = shape.lifted[f].slice();
    else for (const f of FINGERS) if (f !== 'thumb') p.fingers[f] = p.fingers[f].map((a, j) => a - (j === 0 ? 0.12 : 0.04) * k);
    return p;
  }

  // ---------- اليد الأخرى: الإمساك / الإسناد ----------
  /** وضعية اليد اليسرى الوظيفية لهذه الآلة (مخزّنة) */
  support() {
    if (this.cache.has('support')) return this.cache.get('support');
    const sp = this.sup, m = this.model, R = m.R, u = V(Math.sin(sp.ang), 0, Math.cos(sp.ang));
    const pose = sp.kind === 'side' ? this.sideSupport(u) : this.rimSupport(u);
    this.cache.set('support', pose); return pose;
  }
  /** الإطار (grip) أو الحافة (rim): أطراف السبابة والوسطى على الجلد داخل الحافة، والكف تتقوّس فوق الإطار، والإبهام على الجدار الخارجي أو في فتحته */
  rimSupport(u) {
    const sp = this.sup, m = this.model, R = m.R;
    const P = u.clone().multiplyScalar(sp.rho * R).setY(m.top);
    const xOf = (q) => V(1, 0, 0).applyQuaternion(q);
    // نبحث عن ميل الكف وانحناء السبابة والوسطى بحيث: أطرافهما على الجلد داخل الحافة، ومفاصلهما القاعدية فوق الإطار بقليل (≈ 1.8 سم)
    // وخارج الحافة (الأصابع ملتفّة فوقها كالخطّاف) — وهي قبضة حمل الدف/المزهر الحقيقية من الإطار
    const make = (pitch, a, b) => {
      const dir = u.clone().negate().add(V(0, 0, -0.3)).normalize(); dir.y = pitch; dir.normalize();
      const q = axesDir(dir, V(0, 1, 0));
      const pose = { o: V(), q, wrist: 0, spread: 0.55, thumbAim: null,
        fingers: { index: [a, b, b * 0.55], middle: [a, b * 1.04, b * 0.55], ring: [a + 0.1, b * 0.8, b * 0.4], little: [a + 0.15, b * 0.8, b * 0.4], thumb: [0, 0.25, 0.15] } };
      const zAx = this.backAxis(q);
      for (let it = 0; it < 2; it++) {
        this.apply('L', pose);
        const pts = []; for (const f of ['index', 'middle']) { pts.push(this.joint('L', f, 3).addScaledVector(zAx, -PAD)); pts.push(this.tip('L', f).addScaledVector(zAx, -PAD * 0.6)); }
        let minY = Infinity; const c = V(); for (const p of pts) { minY = Math.min(minY, p.y); c.add(p); } c.multiplyScalar(1 / pts.length);
        pose.o.add(V(P.x - c.x, m.top + 0.0006 - minY, P.z - c.z));
      }
      this.apply('L', pose);
      const mc = ['index', 'middle'].map((f) => this.joint('L', f, 1)), pip = ['index', 'middle'].map((f) => this.joint('L', f, 2));
      const hMcp = Math.min(...mc.map((p) => p.y)) - m.top, rMcp = Math.min(...mc.map((p) => Math.hypot(p.x, p.z)));
      const hPip = Math.min(...pip.map((p) => p.y)) - m.top;
      // الكلفة: ارتفاع المفصل القاعدي ≈ 1.8 سم، ويقع خارج الحافة، والمفصل الأوسط أيضًا فوق الإطار
      const cost = Math.abs(hMcp - 0.028) * 3 + Math.max(0, R + 0.004 - rMcp) * 6 + Math.max(0, rMcp - R - 0.02) * 4 + Math.max(0, 0.008 - hPip) * 6;
      return { pose, cost };
    };
    let best = null;
    for (const pitch of [-0.45, -0.3, -0.15, 0, 0.15]) for (const a of [-0.2, 0.1, 0.4, 0.7]) for (const b of [0.9, 1.3, 1.7, 2.1]) { const r = make(pitch, a, b); if (!best || r.cost < best.cost) best = { ...r, pitch, a, b }; }
    for (let it = 0; it < 2; it++) for (const [dp, da, db] of [[-0.06, 0, 0], [0.06, 0, 0], [0, -0.08, 0], [0, 0.08, 0], [0, 0, -0.12], [0, 0, 0.12]]) { const r = make(best.pitch + dp, best.a + da, best.b + db); if (r.cost < best.cost) best = { ...r, pitch: best.pitch + dp, a: best.a + da, b: best.b + db }; }
    const pose = best.pose; this.gripFit = { cost: +best.cost.toFixed(4), pitch: best.pitch, a: best.a, b: best.b };
    // الإبهام: على الجدار الخارجي أسفل الحافة (من جهة الإبهام)، أو داخل فتحة الإبهام في المزهر
    const xAx = xOf(pose.q), t = xAx.clone().sub(u.clone().multiplyScalar(xAx.dot(u))).setY(0).normalize();
    if (sp.thumb === 'hole') pose.thumbAim = u.clone().multiplyScalar(R - 0.008).setY(m.top - 0.038);   // مركز فتحة الإبهام (builders.js)
    else pose.thumbAim = u.clone().multiplyScalar(R + 0.012).add(t.clone().multiplyScalar(0.025)).setY(m.top - 0.03);
    // البنصر والخنصر: ملتفّان فوق الحافة أيضًا، وطرفاهما فوق الجلد داخل الحافة بنحو 1.2 سم (جاهزان للكا)
    pose.kaRho = (sp.rho + 0.01) * R;
    this.fingerReach(pose, ['ring', 'little'], m.top + 0.012, pose.kaRho, ['ring']);   // الخنصر أقصر فيتبع البنصر
    return pose;
  }
  /** الجانب (side): الكف مسطّحة على جدار الطبل الخارجي، والأصابع إلى أعلى مائلة بعيدًا عن العازف */
  sideSupport(u) {
    const sp = this.sup, m = this.model, h = m.top - sp.drop, rs = this.surfaceRadius(u, h);
    let tAway = V(Math.cos(sp.ang), 0, -Math.sin(sp.ang)); if (tAway.z > 0) tAway.negate();
    const q = axesDir(V(0, 1, 0).add(tAway.multiplyScalar(0.45)), u);
    const pose = { o: V(), q, wrist: 0, spread: 0.25, thumbAim: null,
      fingers: { index: [0, 0.03, 0.02], middle: [0, 0.03, 0.02], ring: [0.01, 0.03, 0.02], little: [0.02, 0.04, 0.02], thumb: [0.25, 0.2, 0.1] } };
    const zAx = this.backAxis(q);
    for (let it = 0; it < 3; it++) {
      this.apply('L', pose);
      const H = this.hands, wr = this.toLocal(H.wristPos('L')), m1 = this.joint('L', 'middle', 1);
      const palm = wr.clone().lerp(m1, 0.55).addScaledVector(zAx, -PAD * 1.6);
      const pts = [palm]; for (const f of ['index', 'middle', 'ring']) for (const j of [2, 3]) pts.push(this.joint('L', f, j).addScaledVector(zAx, -PAD));
      // نزيح اليد على امتداد u حتى تلامس أقرب نقطة الجدارَ، وعموديًا حتى يكون وسط الكف على الارتفاع h
      let minR = Infinity; for (const p of pts) minR = Math.min(minR, Math.hypot(p.x, p.z));
      pose.o.addScaledVector(u, rs + 0.0006 - minR); pose.o.y += h - palm.y;
    }
    // الإبهام ممدود على الجدار نفسه إلى جهة الإبهام وأسفل قليلًا (لا يدخل الطبل)
    const xAx = V(1, 0, 0).applyQuaternion(q), t = xAx.clone().sub(u.clone().multiplyScalar(xAx.dot(u))).setY(0).normalize();
    pose.thumbAim = u.clone().multiplyScalar(rs + 0.004).add(t.multiplyScalar(0.05)).setY(h - 0.045);
    pose.surf = { u, rs, h };
    return pose;
  }
  /** نصف قطر السطح الخارجي للآلة في الاتجاه u وعلى الارتفاع h (بإسقاط شعاع على المجسّم نفسه) */
  surfaceRadius(u, h) {
    const g = this.group, o = g.localToWorld(u.clone().multiplyScalar(this.model.R * 4).setY(h)), tgt = g.localToWorld(V(0, h, 0));
    const ray = new THREE.Raycaster(o, tgt.sub(o).normalize());
    const hit = ray.intersectObject(g, true).find((q) => !q.object.userData.shell && q.object.visible);
    if (!hit) return this.model.R;
    const p = this.toLocal(hit.point.clone()); return Math.hypot(p.x, p.z);
  }
  /** يضبط ثني إصبعين معًا حتى يصل طرفاهما إلى الارتفاع y (بحث ثنائي؛ الثني يخفض الطرف) */
  fingerTo(pose, fingers, y) {
    const base = {}; for (const f of fingers) base[f] = pose.fingers[f].slice();
    const set = (a) => { for (const f of fingers) pose.fingers[f] = [base[f][0] + a, base[f][1] + a * 1.1, base[f][2] + a * 0.5]; };
    const err = (a) => { set(a); this.apply('L', pose); return Math.min(...fingers.map((f) => this.tip('L', f).y)) - y; };
    // مسح ثم تضييق (ارتفاع الطرف ليس دالة رتيبة دائمًا في زاوية الثني)
    let bestA = 0, bestE = Infinity; for (let a = -0.6; a <= 1.6001; a += 0.1) { const e = Math.abs(err(a)); if (e < bestE) { bestE = e; bestA = a; } }
    for (let step = 0.05; step > 0.002; step /= 2) for (const a of [bestA - step, bestA + step]) { const e = Math.abs(err(a)); if (e < bestE) { bestE = e; bestA = a; } }
    set(bestA); return bestE;
  }
  /** يضبط انثناء إصبعين (المفصل القاعدي والأوسط) حتى يصل طرفاهما إلى الارتفاع y وعلى بعد rho من محور الآلة */
  fingerReach(pose, fingers, y, rho, measure = fingers) {
    const err = (a, b) => { for (const f of fingers) pose.fingers[f] = [a + (f === 'little' ? 0.05 : 0), b, b * 0.55]; this.apply('L', pose);
      let e = 0; for (const f of measure) { const t = this.tip('L', f); e += Math.abs(t.y - y) + Math.abs(Math.hypot(t.x, t.z) - rho) * 0.8; } return e; };
    let best = [0, 0], bestE = Infinity;
    for (let a = -0.5; a <= 0.7001; a += 0.1) for (let b = 0; b <= 2.1001; b += 0.15) { const e = err(a, b); if (e < bestE) { bestE = e; best = [a, b]; } }
    for (let st = 0.06; st > 0.004; st /= 2) for (const [da, db] of [[st, 0], [-st, 0], [0, st], [0, -st]]) { const e = err(best[0] + da, best[1] + db); if (e < bestE) { bestE = e; best = [best[0] + da, best[1] + db]; } }
    err(best[0], best[1]); return bestE;
  }
  /** وضعية «الكا»: القبضة نفسها، وينزل البنصر والخنصر حتى يلمس طرفاهما الجلد */
  kaContact() {
    if (this.cache.has('ka')) return this.cache.get('ka');
    const sup = this.support(), p = clonePose(sup); this.fingerReach(p, ['ring', 'little'], this.model.top + PAD * 0.5, sup.kaRho || this.model.R * 0.9, ['ring']);
    this.apply('L', p); const a = this.tip('L', 'ring'); p.anchor = V(a.x, this.model.top, a.z);
    this.cache.set('ka', p); return p;
  }

  apply(side, pose) {
    const g = this.group; g.updateMatrixWorld(true);
    const gq = g.getWorldQuaternion(new THREE.Quaternion()), qw = gq.clone().multiply(pose.q);
    const x = V(1, 0, 0).applyQuaternion(qw), y = V(0, 1, 0).applyQuaternion(qw), z = V(0, 0, 1).applyQuaternion(qw);
    this.hands.pose(side, { o: pose.o.clone().applyMatrix4(g.matrixWorld), x, y, z, wrist: pose.wrist, fingers: pose.fingers, spread: pose.spread,
      thumbAim: pose.thumbAim ? pose.thumbAim.clone().applyMatrix4(g.matrixWorld) : null });
  }

  /**
   * يضيف ضربة مجدولة: t زمنها على ساعة الصوت (لحظة الملامسة = لحظة بدء الصوت)، target نقطة على الجلد (افتراضيًا: موضع الضربة).
   */
  add(stroke, t, level = 's', target = null, onContact = null) {
    const s = this.perf.strokes[stroke]; if (!s) return;
    const tg = target && s.hand === 'R' ? V(target.x, this.model.top, target.z) : this.anchor(stroke);
    const ev = { stroke, t, level, target: tg, s, onContact, done: false, created: this.clock(), slow: this.slow };
    const q = this.events[s.hand]; q.push(ev); q.sort((a, b) => a.t - b.t);
    return ev;
  }
  /** مدة الاقتراب اللازمة قبل ضربة (لجدولة صوت العرض بعدها) */
  lead(stroke, slow = this.slow) { const s = this.perf.strokes[stroke]; return (s ? s.down : 0.08) * slow + 0.25 * slow; }

  // ---------- الآلة المحمولة: الرفع والميل + التنفّس + ارتداد الضربة ----------
  impulse(e) {
    if (!this.present) return;
    const k = (e.stroke === 'dum' ? 1 : e.stroke === 'tak' ? 0.45 : 0.25) * (e.level === 's' ? 1 : 0.6), R = this.model.R;
    this.spring.y[1] -= 0.085 * k;                                     // تنخفض الآلة قليلًا تحت الضربة ثم تعيدها القبضة
    this.spring.rx[1] += 0.9 * k * (e.target.z / R) * 0.06;             // وتميل نحو موضع الضربة
    this.spring.rz[1] -= 0.9 * k * (e.target.x / R) * 0.06;
  }
  stepSprings(dt) {
    const K = 700, C = 2 * Math.sqrt(K) * 0.42;
    for (let left = Math.min(dt, 0.1); left > 0; left -= 1 / 240) {
      const h = Math.min(1 / 240, left);
      for (const k in this.spring) { const s = this.spring[k]; s[1] += (-K * s[0] - C * s[1]) * h; s[0] += s[1] * h; }
    }
  }
  applyGroup(T) {
    const g = this.group; if (!g) return;
    const P = this.present, a = this.amt;
    if (!P) { g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.updateMatrixWorld(true); return; }
    const al = this.alive ? 1 : 0;
    g.position.set(0, a * (P.lift + al * 0.0017 * breath(T) + this.spring.y[0]), a * al * 0.0012 * drift(T, 2.2));
    g.rotation.set(a * (P.tilt + al * 0.006 * breath(T + 0.6) + this.spring.rx[0]), 0, a * (al * 0.007 * drift(T, 0.7) + this.spring.rz[0]));
    g.updateMatrixWorld(true);
  }

  update(dt) {
    if (!this.model) return;
    const tv = this.clock(), T = this.now();
    for (const side of ['R', 'L']) for (const e of this.events[side]) if (!e.done && e.t <= tv) { e.done = true; if (tv - e.t < 0.25) { this.impulse(e); if (e.onContact) e.onContact(e); } }
    this.amt += ((this.enabled ? 1 : 0) - this.amt) * (1 - Math.exp(-dt * 5));
    if (!this.enabled && this.amt < 0.002) this.amt = 0;
    this.stepSprings(dt);
    this.applyGroup(T);
    if (!this.enabled) { for (const s of ['L', 'R']) if (!this.hands.side[s].hidden) this.hands.hide(s); this.cur = { L: null, R: null }; return; }
    for (const side of ['R', 'L']) {
      if (!this.idle[side]) { if (!this.hands.side[side].hidden) this.hands.hide(side); continue; }
      const q = this.events[side];
      while (q.length && q[0].t < tv - 3) q.shift();
      let prev = null, next = null;
      for (const e of q) { if (e.t <= tv) prev = e; else { next = e; break; } }
      const pose = side === 'L' && this.sup ? this.solveSupport(tv, prev, next, T) : this.solve(side, tv, prev, next, T);
      if (!pose.live) {                                   // لا ضربات قريبة: انتقال ناعم إلى وضع الراحة
        const c = this.cur[side] || pose;
        this.cur[side] = lerpPose(c, pose, this.cur[side] ? 1 - Math.exp(-dt * 6) : 1);
      } else this.cur[side] = pose;
      this.apply(side, this.cur[side]);
    }
  }
  solve(side, tv, prev, next, T) {
    const idle = this.life(this.idle[side], T, 1);
    const dn = (e) => e.s.down * e.slow, rb = (e) => e.s.reb * e.slow;
    const cNext = next ? easeIn(1 - (next.t - tv) / dn(next)) : 0;
    const cPrev = prev && tv - prev.t < rb(prev) ? 1 - easeOut((tv - prev.t) / rb(prev)) : 0;
    const R = (e) => this.raised(e.stroke, e.target, e.level);
    let base;
    const prevActive = prev && tv - prev.t < 1.2 * prev.slow;
    if (next && next.t - tv < 1.4 * next.slow) {
      const from = prevActive ? R(prev) : idle;
      const start = prevActive ? prev.t + Math.min(rb(prev), (next.t - prev.t) * 0.45) : Math.max(next.created, next.t - dn(next) - 0.45 * next.slow);
      const end = next.t - dn(next) * (prevActive ? 0.6 : 1);
      base = lerpPose(from, R(next), end > start ? smooth((tv - start) / (end - start)) : 1);
    } else if (prevActive) base = lerpPose(R(prev), idle, smooth((tv - prev.t - rb(prev)) / (1.2 * prev.slow - rb(prev))));
    else return { ...idle, live: false };
    let out = base;
    if (cNext >= cPrev && cNext > 0) out = lerpPose(base, this.contact(next.stroke, next.target), cNext);
    else if (cPrev > 0) out = lerpPose(base, this.contact(prev.stroke, prev.target), cPrev);
    out.live = true; return out;
  }
  /** اليد الأخرى: القبضة/الإسناد مع حيوية خفيفة، وتنزل الإصبعان للكا عند الحاجة */
  solveSupport(tv, prev, next, T) {
    const rest = this.life(this.support(), T, 1, true);
    const dn = (e) => e.s.down * e.slow, rb = (e) => e.s.reb * e.slow;
    const cNext = next ? easeIn(1 - (next.t - tv) / dn(next)) : 0;
    const cPrev = prev && tv - prev.t < rb(prev) ? 1 - easeOut((tv - prev.t) / rb(prev)) : 0;
    const c = Math.max(cNext, cPrev);
    if (c <= 0) return { ...rest, live: true };
    const out = lerpPose(rest, this.kaContact(), c); out.live = true; return out;
  }
  /**
   * الحيوية البشرية (مستقلة عن الإيقاع): تنفّس وتمايل خفيف جدًا وحركات استقرار صغيرة في الأصابع.
   * support=true: يد ممسكة/مسنودة — لا تتحرك إلا بما لا يفصلها عن الآلة (الأصابع الحرة، وانزلاق ضئيل على الجدار).
   */
  life(p, T, w, support) {
    if (!this.alive || w <= 0) return p;
    const out = clonePose(p), b = breath(T + (support ? 1.1 : 0)), d1 = drift(T, support ? 3.1 : 0.3), d2 = drift(T * 1.31, support ? 5.2 : 1.7);
    if (!support) {
      out.o.y += 0.0022 * b * w; out.o.z += 0.0012 * d1 * w; out.o.x += 0.0008 * d2 * w;
      out.wrist += 0.035 * b * w;
      for (const f of ['index', 'middle', 'ring', 'little']) out.fingers[f][0] += 0.03 * drift(T * 0.8, FINGERS.indexOf(f)) * w;
      return out;
    }
    if (this.sup.kind === 'side') {
      out.o.y += 0.0007 * d1 * w;                                        // انزلاق ضئيل على الجدار
      out.o.addScaledVector(p.surf.u, 0.0005 * (b + 1) * w);              // تخفيف الضغط مع الزفير (لا يدخل الجدار أبدًا)
      out.fingers.little[0] -= 0.04 * (d2 + 1) * 0.5 * w; out.fingers.ring[1] -= 0.02 * (d1 + 1) * 0.5 * w;
      out.fingers.thumb[1] += 0.06 * d2 * w;
    } else {
      // السبابة والوسطى تشدّان القبضة وترخيانها قليلًا (الرفع فقط، فلا تخترقان الجلد)، والبنصر والخنصر الحرّان يتحرّكان أكثر
      out.fingers.index[1] -= 0.03 * (d1 + 1) * 0.5 * w; out.fingers.middle[1] -= 0.025 * (d2 + 1) * 0.5 * w;
      out.fingers.ring[0] += 0.05 * d2 * w; out.fingers.little[0] += 0.06 * d1 * w;
    }
    return out;
  }
}
