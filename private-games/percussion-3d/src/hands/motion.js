// =====================================================================
//  أداء اليدين: يحوّل جدول الضربات (على ساعة الصوت) إلى حركة يد متزامنة:
//  استعداد مرفوع ← هبوط سريع ← ملامسة الجلد لحظة الصوت تمامًا ← ارتداد فوري ← انتقال إلى الضربة التالية.
//  الحركة «بلا حالة»: تُحسب في كل إطار من الزمن الحالي والضربات المجدولة فقط، فلا تتراكم أخطاء عند تغيير السرعة أو الإيقاف والإعادة.
// =====================================================================
import * as THREE from 'three';
import { FINGERS } from './hands.js';
import { SHAPES, PERFORMANCE } from '../data/performance.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const easeIn = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t);            // تسارع نحو الجلد
const easeOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t)); // ارتداد سريع ثم تباطؤ
const PAD = 0.0072;                                                  // سُمك الإصبع من محور العظمة إلى باطنه (تقريبًا)

/** إطار يد من اتجاه الأصابع الأفقي (yaw) وميلها (pitch) ودوران الكف حول محورها (roll) */
export function axesFrom(yaw, pitch, roll = 0) {
  const y = V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).normalize();
  const z = V(0, 1, 0); z.sub(y.clone().multiplyScalar(z.dot(y))).normalize(); if (roll) z.applyAxisAngle(y, roll);
  const x = V().crossVectors(y, z).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
const cloneFingers = (f) => { const o = {}; for (const k of FINGERS) o[k] = (f[k] || [0, 0, 0]).slice(); return o; };
function lerpPose(a, b, t) {
  const out = {};
  out.o = a.o.clone().lerp(b.o, t);
  out.q = a.q.clone().slerp(b.q, t);
  out.wrist = a.wrist + (b.wrist - a.wrist) * t; out.spread = a.spread + (b.spread - a.spread) * t;
  out.fingers = {}; for (const f of FINGERS) { const A = a.fingers[f], B = b.fingers[f]; out.fingers[f] = [0, 1, 2].map((j) => A[j] + (B[j] - A[j]) * t); }
  return out;
}

export class HandPerformer {
  /** hands: كائن Hands · clock(): الزمن المرئي الحالي على ساعة الصوت */
  constructor(hands, clock) { this.hands = hands; this.clock = clock; this.events = { L: [], R: [] }; this.cache = new Map(); this.inst = null; this.model = null; this.slow = 1; this.cur = { L: null, R: null }; }

  /** آلة جديدة: تُمسح الضربات وتُحسب وضعيات الاستعداد */
  setInstrument(inst, model, group) {
    this.inst = inst; this.model = model; this.group = group; this.perf = PERFORMANCE[inst.id]; this.cache.clear(); this.clear();
    this.usesL = Object.values(this.perf.strokes).some((s) => s.hand === 'L');
    this.idle = {};
    for (const side of ['R', 'L']) {
      const st = Object.entries(this.perf.strokes).find(([, s]) => s.hand === side);
      if (!st) { this.idle[side] = null; continue; }
      const p = this.raised(st[0], this.anchor(st[0]));
      // وضع الراحة: أعلى قليلًا وأقرب إلى العازف
      this.idle[side] = { ...p, o: p.o.clone().add(V(side === 'R' ? 0.05 : -0.04, 0.035, 0.09)), wrist: p.wrist * 0.5, fingers: cloneFingers(p.fingers) };
      for (const f of FINGERS) this.idle[side].fingers[f] = this.idle[side].fingers[f].map((a) => a + 0.12);
    }
    this.cur = { L: null, R: null };
  }
  clear() { this.events.L.length = 0; this.events.R.length = 0; }
  anchor(stroke) { const s = this.perf.strokes[stroke], r = s.rho * this.model.R; return V(r * Math.sin(s.ang), this.model.top, r * Math.cos(s.ang)); }

  /** وضعية الملامسة لضربة عند نقطة target (إحداثيات العالم): نضع اليد ثم نقيس موضع باطن/أطراف الأصابع ثم نزيحها حتى تلامس الجلد تمامًا */
  contact(stroke, target) {
    const key = `${stroke}|${target.x.toFixed(4)}|${target.z.toFixed(4)}`; if (this.cache.has(key)) return this.cache.get(key);
    const s = this.perf.strokes[stroke], shape = SHAPES[s.shape], side = s.hand;
    const yaw = side === 'R' ? this.perf.yawR : this.perf.yawL;
    const q = axesFrom(yaw, this.perf.pitch, 0);
    const pose = { o: V(), q, wrist: 0, spread: shape.spread, fingers: cloneFingers(shape.fingers) };
    this.apply(side, pose);
    // نقاط الملامسة: باطن السُّلاميات (flat) أو الأطراف (tips/ka)
    const H = this.hands, zAx = V(0, 0, 1).applyQuaternion(q), pts = [];
    for (const f of shape.contact) {
      if (shape.pads) { for (const j of [2, 3]) pts.push(H.joint(side, f, j).addScaledVector(zAx, -PAD)); pts.push(H.tip(side, f).addScaledVector(zAx, -PAD * 0.6)); }
      else pts.push(H.tip(side, f).addScaledVector(zAx, -PAD * 0.5).add(V(0, -0.003, 0)));
    }
    let minY = Infinity; const c = V(); for (const p of pts) { minY = Math.min(minY, p.y); c.add(p); } c.multiplyScalar(1 / pts.length);
    pose.o.add(V(target.x - c.x, target.y + 0.0008 - minY, target.z - c.z));
    this.cache.set(key, pose); return pose;
  }
  /** وضعية الاستعداد قبل الضربة: اليد مرفوعة والكف مرفوعة عند المعصم (أو الأصبعان مرفوعان فقط في الكا) */
  raised(stroke, target, level = 's') {
    const s = this.perf.strokes[stroke], c = this.contact(stroke, target), shape = SHAPES[s.shape];
    const k = level === 's' ? 1 : 0.6, p = { o: c.o.clone(), q: c.q.clone(), wrist: c.wrist + s.wrist * k, spread: c.spread, fingers: cloneFingers(c.fingers) };
    p.o.y += (level === 's' ? s.lift : s.liftW);
    if (shape.lifted) for (const f in shape.lifted) p.fingers[f] = shape.lifted[f].slice();
    else for (const f of FINGERS) if (f !== 'thumb') p.fingers[f] = p.fingers[f].map((a, j) => a - (j === 0 ? 0.12 : 0.04) * k);
    return p;
  }
  apply(side, pose) {
    const x = V(1, 0, 0).applyQuaternion(pose.q), y = V(0, 1, 0).applyQuaternion(pose.q), z = V(0, 0, 1).applyQuaternion(pose.q);
    this.hands.pose(side, { o: pose.o, x, y, z, wrist: pose.wrist, fingers: pose.fingers, spread: pose.spread });
  }

  /**
   * يضيف ضربة مجدولة: t زمنها على ساعة الصوت (لحظة الملامسة = لحظة بدء الصوت)، target نقطة على الجلد (افتراضيًا: موضع الضربة).
   * onContact يُستدعى مرة واحدة عند الملامسة (للتموّج وإضاءة العلامة).
   */
  add(stroke, t, level = 's', target = null, onContact = null) {
    const s = this.perf.strokes[stroke]; if (!s) return;
    const tg = target ? V(target.x, this.model.top, target.z) : this.anchor(stroke);
    const ev = { stroke, t, level, target: tg, s, onContact, done: false, created: this.clock(), slow: this.slow };
    const q = this.events[s.hand]; q.push(ev); q.sort((a, b) => a.t - b.t);
    return ev;
  }
  /** مدة الاقتراب اللازمة قبل ضربة (لجدولة صوت العرض بعدها) */
  lead(stroke, slow = this.slow) { const s = this.perf.strokes[stroke]; return (s ? s.down : 0.08) * slow + 0.25 * slow; }

  update(dt) {
    if (!this.model) return;
    const tv = this.clock();
    for (const side of ['R', 'L']) {
      if (!this.idle[side]) { if (!this.hands.side[side].hidden) this.hands.hide(side); continue; }
      const q = this.events[side];
      while (q.length && q[0].t < tv - 3) q.shift();
      let prev = null, next = null;
      for (const e of q) { if (e.t <= tv) prev = e; else { next = e; break; } }
      for (const e of q) if (!e.done && e.t <= tv) { e.done = true; if (e.onContact && tv - e.t < 0.25) e.onContact(e); }
      const pose = this.solve(side, tv, prev, next);
      if (!pose.live) {                                   // لا ضربات قريبة: انتقال ناعم إلى وضع الراحة
        const c = this.cur[side] || pose;
        this.cur[side] = lerpPose(c, pose, this.cur[side] ? 1 - Math.exp(-dt * 6) : 1);
      } else this.cur[side] = pose;
      this.apply(side, this.cur[side]);
    }
  }
  solve(side, tv, prev, next) {
    const idle = this.idle[side];
    const dn = (e) => e.s.down * e.slow, rb = (e) => e.s.reb * e.slow;
    // قيمة الملامسة لكل من الضربتين المجاورتين
    const cNext = next ? easeIn(1 - (next.t - tv) / dn(next)) : 0;
    const cPrev = prev && tv - prev.t < rb(prev) ? 1 - easeOut((tv - prev.t) / rb(prev)) : 0;
    const R = (e) => this.raised(e.stroke, e.target, e.level);
    // وضع الاستعداد المتنقّل بين ضربتين
    let base;
    const prevActive = prev && tv - prev.t < 1.2 * prev.slow;
    if (next && next.t - tv < 1.4 * next.slow) {
      const from = prevActive ? R(prev) : idle;
      const start = prevActive ? prev.t + Math.min(rb(prev), (next.t - prev.t) * 0.45) : Math.max(next.created, next.t - dn(next) - 0.45 * next.slow);
      const end = next.t - dn(next) * (prevActive ? 0.6 : 1);
      base = lerpPose(from, R(next), end > start ? smooth((tv - start) / (end - start)) : 1);
    } else if (prevActive) base = R(prev);
    else return { ...idle, live: false };
    let out = base;
    if (cNext >= cPrev && cNext > 0) out = lerpPose(base, this.contact(next.stroke, next.target), cNext);
    else if (cPrev > 0) out = lerpPose(base, this.contact(prev.stroke, prev.target), cPrev);
    out.live = true; return out;
  }
}
