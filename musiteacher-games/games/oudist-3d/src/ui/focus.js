// =====================================================================
//  Finger Focus — «وضع التركيز على الأصابع والأوتار».
//  يعرض العزف نفسه (لا رسمًا فوقه) من كاميرتين قريبتين ثابتتين على الآلة:
//    • لوحة الزند: اليد اليسرى مواجهةً — الأوتار أفقية والأنف إلى اليمين، تتبع الكاميرا وضع اليد إن انتقلت على الزند.
//    • لوحة الريشة: اليد اليمنى وموضع الضرب.
//  والوسائل البصرية كلها مربوطة بحالة المؤدّي الفعلية (perf.notes / perf.lastL)، لا بمؤقّت مستقل:
//    • الوتر العامل يتلوّن بلون مجموعته ما دامت نغمته ترنّ.
//    • الإصبع الضاغط يتلوّن تدريجيًا بمقدار ضغطه الفعلي (amt) فيرى الطالب لحظة اكتمال الضغط قبل الصوت ولحظة الرفع.
//    • دائرة «النغمة التالية» تظهر على موضعها قبل موعدها، فتُرى الحركة الاستباقية.
//    • نقاط دليل باهتة على مواضع نغمات التمرين (الزند بلا دساتين).
//    • بطاقة النغمة الحالية: الاسم + الوتر + الإصبع + المسافة من الأنف + اتجاه الريشة.
//  views: 'off' | 'fingers' (الزند وحده) | 'both' (اليدان معًا، شاشة مقسومة).
// =====================================================================
import * as THREE from 'three';
import { OUD } from '../instrument/oud-model.js';
import { COURSES, FINGER_AR, intervalAr, arNum } from '../instrument/oud-data.js';

export const COURSE_COLORS = ['#f0b04a', '#f5c35c', '#ffd884', '#52d69a', '#e08af0', '#62d4ee'];   // قرار … كردان
const DIRB = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('ffb') || '-0.85,0.25,0.75,0.015,0.24').split(',').map(Number);
const FN = ['index', 'middle', 'ring', 'little'];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

export class FingerFocus {
  constructor(ctx, root, names) {
    this.ctx = ctx; this.root = root; this.nm = names;
    this.view = 'off'; this.track = true; this.zoomK = 1; this.shiftY = 0;
    this.camA = new THREE.PerspectiveCamera(30, 1, 0.01, 10); this.camB = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
    this.panes = []; this.tints = new WeakMap(); this.fk = [0, 0, 0, 0, 0]; this.fc = [0, 0, 0, 0, 0];
    this.strK = COURSES.map(() => 0); this.strMat = null;
    // ----- عناصر ثلاثية الأبعاد: دائرة النغمة التالية + نقاط الدليل -----
    const oud = ctx.oud;
    this.next = new THREE.Mesh(new THREE.CircleGeometry(0.0062, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false }));
    this.next.renderOrder = 20; this.next.raycast = () => {}; this.next.visible = false; oud.root.add(this.next);
    this.nextRing = new THREE.Mesh(new THREE.RingGeometry(0.0066, 0.0078, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false }));
    this.nextRing.renderOrder = 21; this.nextRing.raycast = () => {}; this.next.add(this.nextRing);
    this.guide = new THREE.Group(); this.guide.visible = false; oud.root.add(this.guide);
    this.guideMat = new THREE.MeshBasicMaterial({ color: 0xfff3c8, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
    // ----- عناصر الواجهة -----
    this.dom = el('div', 'ff hidden'); this.dom.id = 'ff';
    this.card = el('div', 'ff-card'); this.cName = el('b', 'ff-name'); this.cSub = el('div', 'ff-sub'); this.cNext = el('div', 'ff-nextline'); this.card.append(this.cName, this.cSub, this.cNext);
    this.capA = el('div', 'ff-cap', 'اليد اليسرى — الأصابع على الزند'); this.capB = el('div', 'ff-cap', 'اليد اليمنى — الريشة');
    this.div = el('div', 'ff-div'); this.tagCur = el('div', 'ff-tag cur hidden'); this.tagNext = el('div', 'ff-tag nxt hidden');
    this.dom.append(this.div, this.capA, this.capB, this.card, this.tagCur, this.tagNext); root.append(this.dom);
  }
  get on() { return this.view !== 'off'; }
  setView(v) {
    this.view = v; this.dom.classList.toggle('hidden', !this.on); document.body.classList.toggle('ff-on', this.on);
    this.guide.visible = this.on && this.track;
    if (!this.on) { this.next.visible = false; this.clearTints(); }
  }
  setTrack(b) { this.track = b; this.guide.visible = this.on && b; if (!b) { this.next.visible = false; this.clearTints(); } }
  zoom(f) { this.zoomK = clamp(this.zoomK * (1 + f), 0.55, 1.8); }

  /** نقاط الدليل: مواضع نغمات التمرين المضغوطة (مرة لكل تمرين) */
  setPiece(events) {
    this.guide.clear(); if (!events) return;
    const seen = new Set(), g = new THREE.CircleGeometry(0.0021, 14);
    for (const e of events) {
      if (!e.semis) continue; const k = e.course + ':' + e.semis; if (seen.has(k)) continue; seen.add(k);
      const y = OUD.stopY(e.semis), d = new THREE.Mesh(g, this.guideMat); d.raycast = () => {};
      d.position.set(OUD.courseX(e.course, y), y, OUD.fbTop(y) + 0.0004); this.guide.add(d);
    }
  }

  // ---------- تلوين الأصابع (ألوان رؤوس شبكة اليد اليسرى) ----------
  tintOf(rig) {
    let t = this.tints.get(rig); if (t) return t;
    t = { f: {}, meshes: new Set() };
    for (let f = 1; f <= 4; f++) {
      const bones = [1, 2, 3].map((j) => rig.b('L', FN[f - 1] + j)).filter(Boolean);
      t.f[f] = rig.verts(bones, 0.5); for (const e of t.f[f]) t.meshes.add(e.m);
    }
    for (const m of t.meshes) {
      const g = m.geometry; if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      for (const mat of (Array.isArray(m.material) ? m.material : [m.material])) if (mat && !mat.vertexColors) { mat.vertexColors = true; mat.needsUpdate = true; }
    }
    this.tints.set(rig, t); return t;
  }
  paintFinger(t, f, k, col) {
    for (const e of t.f[f]) { const c = e.m.geometry.attributes.color; c.setXYZ(e.i, 1 + (col.r - 1) * k, 1 + (col.g - 1) * k, 1 + (col.b - 1) * k); c.needsUpdate = true; }
  }
  clearTints() {
    const rig = this.ctx.rig && this.ctx.rig(); const t = rig && this.tints.get(rig);
    if (t) for (let f = 1; f <= 4; f++) if (this.fk[f] > 0) { this.paintFinger(t, f, 0, new THREE.Color(1, 1, 1)); this.fk[f] = 0; }
    if (this.strMat) this.ctx.oud.strings.forEach((s, i) => { const m = this.strMat[i]; m.color.copy(m.userData.c0); m.emissive.setHex(0); }); this.strK.fill(0);
  }
  paintStrings(dt, active) {
    const S = this.ctx.oud.strings;
    if (!this.strMat) this.strMat = S.map((s) => { const m = s.vib.mesh.material.clone(); m.userData.c0 = m.color.clone(); s.vib.mesh.material = m; s.fix.mesh.material = m; return m; });
    COURSES.forEach((c) => {
      const goal = active.has(c.index) ? 1 : 0, k = this.strK[c.index] += (goal - this.strK[c.index]) * (1 - Math.exp(-dt / 0.06));
      const col = new THREE.Color(COURSE_COLORS[c.index]);
      S.forEach((s, i) => { if (s.course !== c.index) return; const m = this.strMat[i]; m.color.copy(m.userData.c0).lerp(col, 0.85 * k); m.emissive.copy(col).multiplyScalar(0.55 * k); });
    });
  }

  // ---------- المنطقة الحرة من الشاشة واللوحتان ----------
  layout() {
    const W = innerWidth, H = innerHeight, q = (s) => this.root.querySelector(s);
    const top = q('#topbar'), side = q('#side'), strip = q('#note-strip');
    let x0 = 0, x1 = W, y0 = top && top.offsetParent ? top.getBoundingClientRect().bottom + 6 : 0, y1 = H;
    if (strip && !strip.classList.contains('hidden') && strip.offsetParent) { const r = strip.getBoundingClientRect(); if (r.top > H / 2) y1 = r.top - 6; else y0 = Math.max(y0, r.bottom + 6); }
    if (side && side.classList.contains('open') && W >= 760) x1 = side.getBoundingClientRect().left - 6;
    else if (side && side.classList.contains('open')) y1 = Math.min(y1, side.getBoundingClientRect().top - 6);
    const w = Math.max(120, x1 - x0), h = Math.max(120, y1 - y0);
    this.panes = this.view === 'both' ? [{ cam: this.camA, x: x0, y: y0, w, h: Math.round(h * 0.58) }, { cam: this.camB, x: x0, y: y0 + Math.round(h * 0.58), w, h: h - Math.round(h * 0.58) }] : [{ cam: this.camA, x: x0, y: y0, w, h }];
    const A = this.panes[0], B = this.panes[1];
    this.div.style.cssText = B ? `left:${x0}px;width:${w}px;top:${B.y - 1}px` : 'display:none';
    this.capA.style.cssText = `left:${x0 + 10}px;top:${A.y + A.h - 26}px`;
    this.capB.style.cssText = B ? `left:${x0 + 10}px;top:${B.y + B.h - 26}px` : 'display:none';
    this.card.style.left = (x0 + 10) + 'px'; this.card.style.top = (A.y + 8) + 'px';
  }
  aim(dt) {
    const oud = this.ctx.oud, perf = this.ctx.perf, toW = (x, y, z) => oud.toWorld(new THREE.Vector3(x, y, z));
    const o = toW(0, 0, 0), ax = toW(1, 0, 0).sub(o).normalize(), ay = toW(0, 1, 0).sub(o).normalize(), az = toW(0, 0, 1).sub(o).normalize();
    // الكاميرا تتبع وضع اليد على الزند بنعومة
    const sGoal = perf.lastL ? perf.lastL.shift || 0 : 0; this.shiftY += (sGoal - this.shiftY) * (1 - Math.exp(-dt / 0.35));
    const place = (cam, pane, ly, span, dir, lx = OUD.courseX(3, ly)) => {
      const tgt = toW(lx, ly, OUD.zStr(ly) + 0.004);
      cam.aspect = pane.w / pane.h; const tv = Math.tan(cam.fov * Math.PI / 360), d = Math.max(span / 2 / (tv * cam.aspect), 0.105 / 2 / tv) * this.zoomK;
      const v = ax.clone().multiplyScalar(dir[0]).addScaledVector(ay, dir[1]).addScaledVector(az, dir[2]).normalize();
      cam.position.copy(tgt).addScaledVector(v, d); cam.up.copy(ax).multiplyScalar(ax.y >= 0 ? 1 : -1); cam.lookAt(tgt); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    };
    place(this.camA, this.panes[0], OUD.stopY(3.4) + this.shiftY * 0.85, 0.2, [0.16, 0.1, 1]);
    if (this.panes[1]) place(this.camB, this.panes[1], OUD.yPluck + (DIRB[3] ?? 0.02), DIRB[4] ?? 0.27, DIRB, OUD.courseX(5, OUD.yPluck) - Math.sign(OUD.courseX(5, OUD.yPluck) - OUD.courseX(0, OUD.yPluck)) * -0.012);
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
  project(p, tag, dx = 0, dy = 0) {
    const A = this.panes[0], v = p.clone().project(this.camA);
    const ok = v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1; tag.classList.toggle('hidden', !ok);
    if (ok) tag.style.transform = `translate(${A.x + (v.x * 0.5 + 0.5) * A.w + dx}px, ${A.y + (-v.y * 0.5 + 0.5) * A.h + dy}px) translate(-50%,-100%)`;
  }
  describe(n) {
    const c = COURSES[n.course];
    const where = n.finger ? `${FINGER_AR[n.finger]} (${arNum(n.finger)}) · ${intervalAr(n.semis) || arNum(n.semis / 2) + ' درجة'} من الأنف` : 'مطلق — بلا إصبع';
    return `وتر ${c.ar} · ${where}` + (n.slur ? ' · حلية بلا ريشة' : ` · ريشة ${n.risha === 'up' ? 'صاعدة ↑' : 'نازلة ↓'}`);
  }
  frame(dt) {
    if (!this.on) return;
    this.layout(); this.aim(dt);
    const perf = this.ctx.perf, oud = this.ctx.oud, t = perf.t;
    let cur = null, nxt = null;
    for (const n of perf.notes) { if (n.plucked) { if (!cur || n.T > cur.T) cur = n; } else if (!nxt || n.T < nxt.T) nxt = n; }
    if (cur && cur.done && t - (cur.relT ?? (cur.T + cur.dur)) > 0.9) cur = null;
    this.card.classList.toggle('hidden', !cur && !nxt);
    const head = cur || nxt;
    if (head) {
      const col = COURSE_COLORS[head.course];
      this.cName.textContent = this.nm(head.midi, false) || COURSES[head.course].ar; this.card.style.borderColor = col; this.cName.style.color = col;
      this.cSub.textContent = this.describe(head);
      this.cNext.textContent = cur && nxt ? `التالية: ${this.nm(nxt.midi, false) || ''} — ${nxt.finger ? FINGER_AR[nxt.finger] : 'مطلق'}، وتر ${COURSES[nxt.course].ar}` : (cur ? '' : 'استعد…');
    }
    if (!this.track) { this.tagCur.classList.add('hidden'); this.tagNext.classList.add('hidden'); return; }
    // الأوتار: ما يرنّ الآن
    const active = new Set(); for (const n of perf.notes) if (n.plucked && !n.done) active.add(n.course);
    this.paintStrings(dt, active);
    // الأصابع: بمقدار الضغط الفعلي
    const rig = this.ctx.rig && this.ctx.rig();
    if (rig) {
      const T = this.tintOf(rig), L = perf.lastL;
      for (let f = 1; f <= 4; f++) {
        const q = L && L.f[f], k = q ? clamp(q.amt, 0, 1) * (q.held ? 0.3 : 1) : 0, c = q ? q.course : this.fc[f];
        if (Math.abs(k - this.fk[f]) > 0.02 || (k > 0 && c !== this.fc[f]) || (k === 0 && this.fk[f] !== 0)) { this.paintFinger(T, f, k * 0.8, new THREE.Color(COURSE_COLORS[c]).multiplyScalar(0.62)); this.fk[f] = k; this.fc[f] = c; }
      }
    }
    // وسم النغمة الحالية ودائرة/وسم التالية
    const pt = (n) => { const y = n.semis > 0 ? OUD.stopY(n.semis) : OUD.yNut - 0.004; return new THREE.Vector3(OUD.courseX(n.course, y), y, (n.semis > 0 ? OUD.fbTop(y) : OUD.zN) + 0.0012); };
    if (cur && !cur.done) { this.tagCur.textContent = `${this.nm(cur.midi, false) || ''} · ${arNum(cur.finger)}`; this.tagCur.style.borderColor = COURSE_COLORS[cur.course]; this.project(oud.toWorld(pt(cur)), this.tagCur, 0, -16); }
    else this.tagCur.classList.add('hidden');
    const lead = nxt ? nxt.T - t : 9;
    if (nxt && lead < 1.6 && !(cur && cur.course === nxt.course && cur.semis === nxt.semis && !cur.done)) {
      const p = pt(nxt), a = clamp((1.6 - lead) / 0.5, 0, 1), col = new THREE.Color(COURSE_COLORS[nxt.course]);
      this.next.position.copy(p); this.next.visible = true; this.next.scale.setScalar(nxt.semis > 0 ? 1 : 1.25);
      this.next.material.color.copy(col); this.next.material.opacity = 0.42 * a; this.nextRing.material.color.copy(col); this.nextRing.material.opacity = 0.95 * a;
      this.tagNext.textContent = `${this.nm(nxt.midi, false) || ''} · ${arNum(nxt.finger)}`; this.tagNext.style.borderColor = COURSE_COLORS[nxt.course];
      this.project(oud.toWorld(p), this.tagNext, 0, cur && !cur.done && Math.abs(nxt.semis - cur.semis) < 1.2 ? 30 : -16); if (cur && !cur.done && Math.abs(nxt.semis - cur.semis) < 1.2) this.tagNext.style.transform += ' translateY(100%)';
    } else { this.next.visible = false; this.tagNext.classList.add('hidden'); }
  }
}
