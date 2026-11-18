// =====================================================================
//  Finger Focus — «وضع التركيز على الأصابع والأوتار» للكمان (على نمط لعبة العود).
//  يعرض العزف نفسه (لا رسمًا فوقه) من كاميرتين قريبتين ثابتتين على الآلة:
//    • لوحة الأصابع: اليد اليسرى على لوحة الأصابع — الأوتار أفقية، والعتبة (جهة الرأس) إلى اليمين، ووتر مي في الأعلى.
//    • لوحة القوس: موضع تلامس القوس مع الأوتار بين الفرس ولوحة الأصابع، مع اليد اليمنى.
//  الوسائل البصرية كلها مربوطة بحالة العزف الفعلية (stateAt) لا بمؤقّت مستقل:
//    • الوتر الذي يُعزف الآن يتلوّن بلونه ما دام يرنّ.
//    • كل إصبع يتلوّن بمقدار ضغطه الفعلي (press) فيرى الطالب لحظة اكتمال الضغط قبل الصوت ولحظة الرفع.
//    • دائرة «النغمة التالية» تظهر على موضعها على الوتر قبل موعدها (عند العتبة إن كانت وترًا مفتوحًا).
//    • نقاط دليل باهتة على مواضع نغمات التمرين على لوحة الأصابع (الكمان بلا دساتين).
//    • بطاقة النغمة: الاسم + الوتر + الإصبع + البعد عن العتبة + اتجاه القوس، والنغمة التالية.
//  view: 'off' | 'fingers' (لوحة الأصابع وحدها) | 'both' (اليدان معًا، شاشة مقسومة).
// =====================================================================
import * as THREE from 'three';
import { VN } from '../instruments/violin.js';
import { STRINGS, FINGER_LABEL, L_STRING } from '../teaching/exercise.js';

export const STRING_COLORS = ['#f0b04a', '#52d69a', '#e08af0', '#62d4ee'];   // صول ري لا مي
const FINGERS = ['index', 'middle', 'ring', 'little'];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const qp = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const vec = (k, d) => (qp.get(k) || d).split(',').map(Number);
const DIR_A = vec('ffa', '-0.6,-0.1,1'), DIR_B = vec('ffb', '0.9,0.6,0.25');   // اتجاه الكاميرتين في إحداثيات الكمان (x عرض، y طول، z خارج الصدر)
const TGT_B = vec('fftb', '0.035,0.06,0.04'), SPAN_B = +(qp.get('ffsb') || 0.28);

export class FingerFocus {
  /** ctx: { scene, vf: () => إطار الكمان, strings: () => شبكات الأوتار الأربع, rig: () => هيكل العازف } */
  constructor(ctx, root) {
    this.ctx = ctx; this.root = root;
    this.view = 'off'; this.track = true; this.zoomK = 1;
    this.camA = new THREE.PerspectiveCamera(30, 1, 0.01, 10); this.camB = new THREE.PerspectiveCamera(32, 1, 0.01, 10);
    this.panes = []; this.tints = new WeakMap(); this.fk = [0, 0, 0, 0]; this.fc = [0, 0, 0, 0];
    this.strK = [0, 0, 0, 0]; this.strMeshes = null;
    const mat = (o) => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false, ...o });
    this.next = new THREE.Mesh(new THREE.CircleGeometry(0.0042, 28), mat()); this.next.renderOrder = 20; this.next.raycast = () => {};
    this.nextRing = new THREE.Mesh(new THREE.RingGeometry(0.0046, 0.0056, 32), mat()); this.nextRing.renderOrder = 21; this.nextRing.raycast = () => {};
    this.next.add(this.nextRing); this.next.visible = false; ctx.scene.add(this.next);
    this.guide = new THREE.Group(); this.guide.visible = false; ctx.scene.add(this.guide);
    this.guideMat = new THREE.MeshBasicMaterial({ color: 0xfff3c8, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false });
    // ----- عناصر الواجهة -----
    this.dom = el('div', 'ff hidden'); this.dom.id = 'ff';
    this.card = el('div', 'ff-card'); this.cName = el('b', 'ff-name'); this.cSub = el('div', 'ff-sub'); this.cNext = el('div', 'ff-nextline'); this.card.append(this.cName, this.cSub, this.cNext);
    this.capA = el('div', 'ff-cap', 'اليد اليسرى — الأصابع على الأوتار'); this.capB = el('div', 'ff-cap', 'اليد اليمنى — القوس على الأوتار');
    this.div = el('div', 'ff-div'); this.tagCur = el('div', 'ff-tag cur hidden'); this.tagNext = el('div', 'ff-tag nxt hidden');
    this.dom.append(this.div, this.capA, this.capB, this.card, this.tagCur, this.tagNext); root.append(this.dom);
  }
  get on() { return this.view !== 'off'; }
  setView(v) {
    this.view = v; this.dom.classList.toggle('hidden', !this.on); document.body.classList.toggle('ff-on', this.on);
    this.guide.visible = this.on && this.track;
    if (!this.on) { this.next.visible = false; this.clearTints(); }
  }
  setTrack(b) { this.track = b; this.guide.visible = this.on && b; if (!b) { this.next.visible = false; this.clearTints(); this.tagCur.classList.add('hidden'); this.tagNext.classList.add('hidden'); } }
  zoom(f) { this.zoomK = clamp(this.zoomK * (1 + f), 0.55, 1.8); }
  W(p) { const f = this.ctx.vf(); return new THREE.Vector3(f.o[0] + f.x[0] * p[0] + f.y[0] * p[1] + f.z[0] * p[2], f.o[1] + f.x[1] * p[0] + f.y[1] * p[1] + f.z[1] * p[2], f.o[2] + f.x[2] * p[0] + f.y[2] * p[1] + f.z[2] * p[2]); }
  D(d) { const f = this.ctx.vf(); return new THREE.Vector3(f.x[0] * d[0] + f.y[0] * d[1] + f.z[0] * d[2], f.x[1] * d[0] + f.y[1] * d[1] + f.z[1] * d[2], f.x[2] * d[0] + f.y[2] * d[1] + f.z[2] * d[2]).normalize(); }
  /** نقطة إيقاف الإصبع على الوتر s (y = طول الجزء المهتز من الفرس)؛ الوتر المفتوح: عند العتبة */
  stopPt(s, y, lift = 0.0011) { const yy = y >= L_STRING - 1e-6 ? VN.yNut - 0.006 : y, p = VN.stringAt(s, yy); return this.W([p[0], p[1], p[2] + lift]); }

  /** نقاط الدليل: مواضع نغمات التمرين المضغوطة على سطح لوحة الأصابع */
  setPiece(events) {
    this.guide.clear(); if (!events) return;
    const seen = new Set(), g = new THREE.CircleGeometry(0.0016, 14), f = this.ctx.vf();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...f.x), new THREE.Vector3(...f.y), new THREE.Vector3(...f.z)));
    for (const e of events) {
      if (e.rest || !e.finger) continue; const k = e.string + ':' + e.y.toFixed(4); if (seen.has(k)) continue; seen.add(k);
      const p = VN.stringAt(e.string, e.y), d = new THREE.Mesh(g, this.guideMat); d.raycast = () => {};
      d.position.copy(this.W([p[0], p[1], VN.zFb(p[1]) + 0.0004])); d.quaternion.copy(q); this.guide.add(d);
    }
  }
  // ---------- تلوين الأصابع (ألوان رؤوس شبكة اليد اليسرى حسب وزن عظام كل إصبع) ----------
  tintOf(rig) {
    let t = this.tints.get(rig); if (t) return t;
    t = { f: {}, mats: new Set() };
    for (let f = 1; f <= 4; f++) t.f[f] = [];
    for (const m of rig.meshes) {
      const g = m.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight; if (!si || !sw) continue;
      const ids = {}; for (let f = 1; f <= 4; f++) { const set = new Set([1, 2, 3, 4].map((j) => rig.bones.L[FINGERS[f - 1] + j]).filter(Boolean).map((b) => m.skeleton.bones.indexOf(b)).filter((i) => i >= 0)); if (set.size) ids[f] = set; }
      if (!Object.keys(ids).length) continue;
      const hit = { 1: [], 2: [], 3: [], 4: [] };
      for (let v = 0; v < si.count; v++) for (const f in ids) { let w = 0; for (let c = 0; c < 4; c++) if (ids[f].has(si.getComponent(v, c))) w += sw.getComponent(v, c); if (w >= 0.5) hit[f].push(v); }
      if (![1, 2, 3, 4].some((f) => hit[f].length)) continue;
      if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      for (let f = 1; f <= 4; f++) for (const v of hit[f]) t.f[f].push({ m, i: v });
      for (const mt of (Array.isArray(m.material) ? m.material : [m.material])) if (mt) t.mats.add(mt);
    }
    // كل شبكة أخرى تشارك المادة نفسها تحتاج ألوانًا بيضاء، وإلا ظهرت سوداء
    this.ctx.scene.traverse((o) => { if (!o.isMesh || o.geometry.attributes.color) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; if (ms.some((mt) => t.mats.has(mt))) o.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(o.geometry.attributes.position.count * 3).fill(1), 3)); });
    for (const mt of t.mats) if (!mt.vertexColors) { mt.vertexColors = true; mt.needsUpdate = true; }
    this.tints.set(rig, t); return t;
  }
  paintFinger(t, f, k, col) {
    const touched = new Set();
    for (const e of t.f[f]) { const c = e.m.geometry.attributes.color; c.setXYZ(e.i, 1 + (col.r - 1) * k, 1 + (col.g - 1) * k, 1 + (col.b - 1) * k); touched.add(c); }
    for (const c of touched) c.needsUpdate = true;
  }
  clearTints() {
    const rig = this.ctx.rig && this.ctx.rig(), t = rig && this.tints.get(rig);
    if (t) for (let f = 1; f <= 4; f++) if (this.fk[f - 1] > 0) { this.paintFinger(t, f, 0, new THREE.Color(1, 1, 1)); this.fk[f - 1] = 0; }
    if (this.strMeshes) this.strMeshes.forEach((m) => { if (m.material.userData.c0) m.material.color.copy(m.material.userData.c0); if (m.material.emissive) m.material.emissive.setHex(0); });
    this.strK.fill(0);
  }
  paintStrings(dt, active) {
    const S = this.ctx.strings(); if (S.length !== 4) return;
    if (!this.strMeshes || this.strMeshes[0] !== S[0]) { this.strMeshes = S; S.forEach((m) => { m.material = m.material.clone(); m.material.userData.c0 = m.material.color.clone(); }); }
    for (let s = 0; s < 4; s++) {
      const goal = active === s ? 1 : 0, k = this.strK[s] += (goal - this.strK[s]) * (1 - Math.exp(-dt / 0.06));
      const col = new THREE.Color(STRING_COLORS[s]), m = S[s].material;
      m.color.copy(m.userData.c0).lerp(col, 0.85 * k); if (m.emissive) m.emissive.copy(col).multiplyScalar(0.6 * k);
    }
  }
  // ---------- المنطقة الحرة من الشاشة واللوحتان ----------
  layout() {
    const W = innerWidth, H = innerHeight, rect = (s) => { const e = document.querySelector(s); if (!e || e.classList.contains('hidden')) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
    const teach = rect('#teach'), bar = rect('.bar');
    let x0 = 0, x1 = W, y0 = 8, y1 = bar ? bar.top - 8 : H;
    if (W > 760) { if (teach) x0 = teach.right + 10; }
    else if (teach && teach.top > H / 3) y1 = Math.min(y1, teach.top - 6);
    const w = Math.max(140, x1 - x0), h = Math.max(140, y1 - y0);
    this.panes = this.view === 'both'
      ? [{ cam: this.camA, x: x0, y: y0, w, h: Math.round(h * 0.56) }, { cam: this.camB, x: x0, y: y0 + Math.round(h * 0.56), w, h: h - Math.round(h * 0.56) }]
      : [{ cam: this.camA, x: x0, y: y0, w, h }];
    const A = this.panes[0], B = this.panes[1];
    this.div.style.cssText = B ? `left:${x0}px;width:${w}px;top:${B.y - 1}px` : 'display:none';
    this.capA.style.cssText = `left:${x0 + 10}px;top:${A.y + A.h - 26}px`;
    this.capB.style.cssText = B ? `left:${x0 + 10}px;top:${B.y + B.h - 26}px` : 'display:none';
    this.card.style.left = (x0 + 10) + 'px'; this.card.style.top = (A.y + 8) + 'px';
  }
  aim() {
    const place = (cam, pane, tgt, span, minH, dir, up) => {
      cam.aspect = pane.w / pane.h; const tv = Math.tan(cam.fov * Math.PI / 360), d = Math.max(span / 2 / (tv * cam.aspect), minH / 2 / tv) * this.zoomK;
      cam.position.copy(tgt).addScaledVector(this.D(dir), d); cam.up.copy(up); cam.lookAt(tgt); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    };
    const yA = 0.268, pa = VN.stringAt(1, yA), pb = VN.stringAt(2, yA);
    place(this.camA, this.panes[0], this.W([(pa[0] + pb[0]) / 2, yA, VN.zFb(yA) + 0.004]), 0.17, 0.075, DIR_A, this.D([1, 0, 0]));
    if (this.panes[1]) place(this.camB, this.panes[1], this.W(TGT_B), SPAN_B, 0.12, DIR_B, this.D([0, 0, 1]));
  }
  /** يُستدعى من حلقة الرسم؛ يعيد true إن تولّى الرسم */
  render(renderer, scene) {
    if (!this.on || !this.panes.length) return false;
    const W = innerWidth, H = innerHeight;
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.clear();
    renderer.setScissorTest(true);
    for (const p of this.panes) { renderer.setViewport(p.x, H - p.y - p.h, p.w, p.h); renderer.setScissor(p.x, H - p.y - p.h, p.w, p.h); renderer.render(scene, p.cam); }
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
    return true;
  }
  project(p, tag, below) {
    const A = this.panes[0], v = p.clone().project(this.camA);
    const ok = v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1; tag.classList.toggle('hidden', !ok);
    if (ok) tag.style.transform = `translate(${A.x + (v.x * 0.5 + 0.5) * A.w}px, ${A.y + (-v.y * 0.5 + 0.5) * A.h}px) translate(-50%, ${below ? '45%' : '-135%'})`;
  }
  describe(e) {
    const where = e.finger ? `${FINGER_LABEL[e.finger]} · ${((L_STRING - e.y) * 100).toFixed(1)} سم من العتبة` : 'وتر مفتوح — بلا إصبع';
    return `وتر ${STRINGS[e.string].ar} · ${where} · القوس ${e.bow === 'down' ? 'نازل ⬇' : 'صاعد ⬆'}`;
  }
  /** st: حالة العزف الحالية (stateAt) أو null */
  frame(dt, st) {
    if (!this.on) return;
    this.layout(); this.aim();
    const e = st && st.event && !st.event.rest ? st.event : null;
    let nx = st ? st.next : null; if (nx && nx.rest) nx = null;
    const head = e || nx;
    this.card.classList.toggle('hidden', !head);
    if (head) {
      const col = STRING_COLORS[head.string];
      this.cName.textContent = `${head.note.en.replace('♯', '#')} · ${head.note.ar}`; this.card.style.borderColor = col; this.cName.style.color = col;
      this.cSub.textContent = this.describe(head);
      this.cNext.textContent = e && nx ? `التالية: ${nx.note.ar} — ${nx.finger ? FINGER_LABEL[nx.finger] : 'وتر مفتوح'}، وتر ${STRINGS[nx.string].ar}` : (st && st.event && st.event.rest ? 'سكتة' : '');
    }
    if (!this.track) return;
    this.paintStrings(dt, st && st.sounding && e ? e.string : -1);
    // الأصابع: بمقدار الضغط الفعلي، بلون الوتر الذي تضغط عليه
    const rig = this.ctx.rig && this.ctx.rig();
    if (rig) {
      const T = this.tintOf(rig), s = st ? Math.round(st.sFinger) : 0;
      for (let f = 1; f <= 4; f++) {
        const k = st ? clamp(st.press[f - 1], 0, 1) * (e && f < e.finger ? 0.35 : 1) : 0;      // الأصابع الأدنى الباقية على الوتر: تلوين خفيف
        if (Math.abs(k - this.fk[f - 1]) > 0.02 || (k > 0 && s !== this.fc[f - 1])) { this.paintFinger(T, f, k * 0.8, new THREE.Color(STRING_COLORS[s]).multiplyScalar(0.62)); this.fk[f - 1] = k; this.fc[f - 1] = s; }
      }
    }
    // وسم النغمة الحالية، ودائرة النغمة التالية ووسمها
    if (e && st.sounding) { this.tagCur.textContent = `${e.note.en.replace('♯', '#')} · ${e.finger || '0'}`; this.tagCur.style.borderColor = STRING_COLORS[e.string]; this.project(this.stopPt(e.string, e.y), this.tagCur, false); }
    else this.tagCur.classList.add('hidden');
    const lead = nx && st ? (nx.b0 - st.beat) * 60 / st.bpm : 9;
    if (nx && lead < 1.6 && !(e && e.string === nx.string && Math.abs(e.y - nx.y) < 1e-6)) {
      const p = this.stopPt(nx.string, nx.y, 0.0018), a = clamp((1.6 - lead) / 0.5, 0, 1), col = new THREE.Color(STRING_COLORS[nx.string]);
      this.next.position.copy(p); this.next.quaternion.copy(this.camA.quaternion); this.next.visible = true;
      this.next.material.color.copy(col); this.next.material.opacity = 0.42 * a; this.nextRing.material.color.copy(col); this.nextRing.material.opacity = 0.95 * a;
      this.tagNext.textContent = `${nx.note.en.replace('♯', '#')} · ${nx.finger || '0'}`; this.tagNext.style.borderColor = STRING_COLORS[nx.string];
      this.project(p, this.tagNext, e && e.string === nx.string);
    } else { this.next.visible = false; this.tagNext.classList.add('hidden'); }
  }
}
