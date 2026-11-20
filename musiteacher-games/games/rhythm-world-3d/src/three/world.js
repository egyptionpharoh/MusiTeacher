// =====================================================================
//  عالم الإيقاع: استوديو موسيقي ثلاثي الأبعاد، ومسرح تقف عليه الشخصيات فوق «الخط الإيقاعي».
//  هوية MusiTeacher: لوحة خشبية محفورة صغيرة على الجدار الخلفي — جزء من المشهد لا طبقة فوقه.
// =====================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildFigure, animateFigure } from './glyph3d.js';
import { FIG, TPB } from '../data/figures.js';

export const S = 0.12;          // متر لكل «مسافة مدرج»
const LINE_Y = 0.95;            // ارتفاع الخط الإيقاعي عن الأرض

function canvasTex(w, h, draw, srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function woodFloor() {
  return canvasTex(1024, 1024, (x, w, h) => {
    for (let i = 0; i < 16; i++) { const y = i * h / 16; const base = [176, 128, 84].map((v) => v + (Math.random() * 18 - 9)); x.fillStyle = `rgb(${base})`; x.fillRect(0, y, w, h / 16);
      for (let k = 0; k < 40; k++) { x.strokeStyle = `rgba(80,45,20,${0.05 + Math.random() * 0.08})`; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); const yy = y + Math.random() * h / 16; x.moveTo(0, yy); x.bezierCurveTo(w * 0.3, yy + 6, w * 0.6, yy - 6, w, yy + 2); x.stroke(); }
      x.fillStyle = 'rgba(40,20,8,0.5)'; x.fillRect(0, y, w, 2); const off = (i % 2) * w / 2 + w / 4; x.fillRect(off, y, 2, h / 16); }
  });
}
let _glow = null;
function glowTex() { return _glow || (_glow = canvasTex(256, 256, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,214,140,0.9)'); g.addColorStop(0.5, 'rgba(255,190,110,0.25)'); g.addColorStop(1, 'rgba(255,190,110,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); })); }
function plaqueTexture() {
  return canvasTex(1024, 360, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6b4226'); g.addColorStop(1, '#4a2b17'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 70; k++) { x.strokeStyle = `rgba(30,14,5,${0.08 + Math.random() * 0.12})`; x.lineWidth = 1 + Math.random() * 2.5; x.beginPath(); const y = Math.random() * h; x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + 10, w * 0.7, y - 10, w, y + 4); x.stroke(); }
    x.strokeStyle = 'rgba(232,200,130,0.55)'; x.lineWidth = 6; x.strokeRect(22, 22, w - 44, h - 44);
    const engrave = (txt, y, font, fill) => { x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillText(txt, w / 2 + 3, y + 3); x.fillStyle = fill; x.fillText(txt, w / 2, y); };
    x.direction = 'ltr';
    engrave('♫ MusiTeacher', 150, '700 120px "Cairo", "Segoe UI", sans-serif', '#e9cf8f');
    x.direction = 'rtl';
    engrave('Rhythm World · عالم الإيقاع', 270, '600 64px "Cairo", "Segoe UI", sans-serif', '#d6b878');
  });
}

export class World {
  constructor(canvas, labels) {
    this.canvas = canvas; this.labels = labels; this.items = []; this.waves = []; this.clock = new THREE.Clock(); this.time = 0; this.talk = 0; this.talkTarget = -1;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2)); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const sc = this.scene = new THREE.Scene(); sc.background = new THREE.Color('#1d1a24'); sc.fog = new THREE.Fog('#1d1a24', 9, 18);
    const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; sc.environmentIntensity = 0.55;
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 40);
    this.cam = { az: 0, el: 0.12, dist: 3, target: new THREE.Vector3(0, LINE_Y, 0), goal: null };
    this.buildRoom();
    this.stage = new THREE.Group(); sc.add(this.stage);
    this.ray = new THREE.Raycaster(); this.onPick = null;
    this.bindInput(); new ResizeObserver(() => this.resize()).observe(canvas.parentElement); this.resize();
  }

  buildRoom() {
    const sc = this.scene;
    const key = new THREE.DirectionalLight(0xfff0dc, 2.2); key.position.set(2.5, 5, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 4, bottom: -2, near: 0.5, far: 15 }); sc.add(key);
    const rim = new THREE.DirectionalLight(0x9fb8ff, 0.9); rim.position.set(-4, 3, -2); sc.add(rim);
    sc.add(new THREE.HemisphereLight(0xfff6e8, 0x2b2030, 0.55));
    const spot = new THREE.SpotLight(0xffe8c4, 26, 12, 0.55, 0.6, 1.4); spot.position.set(0, 5.2, 2.6); spot.target.position.set(0, LINE_Y, 0); sc.add(spot, spot.target);
    // الأرضية الخشبية
    const ft = woodFloor(); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(4, 4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.55 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
    // الجدار الخلفي بألواح صوتية
    const wallMat = new THREE.MeshStandardMaterial({ color: '#3a3346', roughness: 0.95 });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), wallMat); wall.position.set(0, 3, -3.2); wall.receiveShadow = true; sc.add(wall);
    const panelCols = ['#4a3f5c', '#544766', '#3f3a55'];
    for (let i = -5; i <= 5; i++) for (let j = 0; j < 2; j++) {
      if ((i === -2 || i === -1) && j === 0) continue;   // مكان اللوحة
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.08), new THREE.MeshStandardMaterial({ color: panelCols[(i + j + 6) % 3], roughness: 1 }));
      p.position.set(i * 1.3, 1.25 + j * 1.35, -3.14); p.receiveShadow = true; sc.add(p);
    }
    // جانبان مائلان
    for (const s of [-1, 1]) { const w2 = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), wallMat); w2.position.set(s * 7, 3, 0.5); w2.rotation.y = -s * Math.PI / 2.4; sc.add(w2); }
    // منصة المسرح
    const st = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.55, 0.16, 72, 1, false, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: '#2a2433', roughness: 0.5, metalness: 0.1 }));
    st.position.set(0, 0.08, 0.4); st.rotation.y = Math.PI; st.receiveShadow = true; st.castShadow = true; sc.add(st);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(3.47, 0.018, 8, 90, Math.PI), new THREE.MeshStandardMaterial({ color: '#e3c170', emissive: '#7a5a1a', emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 }));
    edge.rotation.x = -Math.PI / 2; edge.position.set(0, 0.165, 0.4); edge.rotation.z = Math.PI; sc.add(edge);
    // لوحة MusiTeacher الخشبية المحفورة (تُرسم بعد تحميل الخط العربي)
    this.plaque = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.53, 0.05), [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ color: '#4a2b17', roughness: 0.7 })).concat([new THREE.MeshStandardMaterial({ color: '#5a3520', roughness: 0.55 }), new THREE.MeshStandardMaterial({ color: '#4a2b17' })]));
    this.plaque.position.set(-2.0, 1.78, -3.12); this.plaque.castShadow = true; sc.add(this.plaque);
    const lamp = new THREE.PointLight(0xffd9a0, 1.4, 2.0, 1.6); lamp.position.set(-2.0, 2.3, -2.75); sc.add(lamp);
    const paintPlaque = () => { this.plaque.material[4].map = plaqueTexture(); this.plaque.material[4].color.set('#ffffff'); this.plaque.material[4].needsUpdate = true; };
    (document.fonts && document.fonts.load ? Promise.all([document.fonts.load('700 40px "Cairo"'), document.fonts.load('600 40px "Cairo"')]) : Promise.resolve()).then(paintPlaque, paintPlaque);
    // الخط الإيقاعي (قضيب مضيء تقف عليه الشخصيات)
    this.line = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 12), new THREE.MeshStandardMaterial({ color: '#d9d2e8', emissive: '#6a5f86', emissiveIntensity: 0.7, metalness: 0.4, roughness: 0.3 }));
    this.line.rotation.z = Math.PI / 2; this.line.position.set(0, LINE_Y, -0.03); sc.add(this.line);
  }

  // ------------------------------------------------------------------ الشخصيات
  /** items: [{ids, key, label, sub, color, cells(bool)}] · opts: {gap(م), showCells} */
  setLineup(items, opts = {}) {
    for (const it of this.items) { this.stage.remove(it.root); it.label && it.label.remove(); it.root.traverse((o) => { if (o.geometry && o.geometry !== undefined && !o.geometry.userData.shared) { /* الهندسة مشتركة جزئيًا */ } }); }
    this.items = []; this.waves.forEach((w) => this.stage.remove(w.m)); this.waves = [];
    const gap = opts.gap ?? 0.55; let widths = 0;
    items.forEach((it) => {
      const root = new THREE.Group(); const fig = buildFigure(it.ids, { color: it.color });
      fig.scale.setScalar(S); root.add(fig);
      const w = fig.userData.width * S;
      // خلايا الزمن تحت الشخصية: كل خلية = زمن (نوار)، تمتلئ أثناء العزف
      const ticks = it.ids.reduce((a, id) => a + FIG[id].ticks, 0); const cells = new THREE.Group(); const cellW = 0.2;
      const nC = Math.ceil(ticks / TPB);
      for (let c = 0; c < nC; c++) {
        const frac = Math.min(1, ticks / TPB - c);
        const box = new THREE.Mesh(new THREE.BoxGeometry(cellW * frac - 0.02, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: '#3b3550', emissive: '#000000', roughness: 0.5 }));
        box.position.set((c - (nC - 1) / 2) * cellW - (1 - frac) * cellW / 2, Math.min(fig.userData.bottom, -1.3) * S - 0.09, 0.12); cells.add(box);
      }
      cells.visible = opts.showCells !== false; root.add(cells);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(Math.max(0.3, w * 0.6), 40), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, opacity: 0.55 }));
      glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0.172 - LINE_Y, 0.05); root.add(glow);
      root.position.y = LINE_Y; this.stage.add(root);
      const label = document.createElement('div'); label.className = 'tag3d'; label.innerHTML = it.label || ''; if (it.label) this.labels.append(label);
      this.items.push({ ...it, root, fig, w, cells, nC, ticks, label, hits: [] }); widths += Math.max(w, nC * cellW);
    });
    let x = -(widths + gap * (items.length - 1)) / 2;
    for (const it of this.items) { const ww = Math.max(it.w, it.nC * 0.2); it.root.position.x = x + ww / 2; it.home = it.root.position.clone(); x += ww + gap; }
    const len = Math.max(2.5, widths + gap * items.length + 1.2); this.line.scale.y = len;
    this.fit(opts.keepView);
  }
  showCells(on) { for (const it of this.items) it.cells.visible = on; }

  fit(keep, animate = false) {
    if (!this.items.length) return;
    this.stage.updateMatrixWorld(true);
    const box = new THREE.Box3(); for (const it of this.items) box.expandByObject(it.fig);
    for (const it of this.items) if (it.cells.visible) box.expandByObject(it.cells);
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const fov = THREE.MathUtils.degToRad(this.camera.fov), asp = this.camera.aspect;
    const needH = (size.y * 1.22 + 0.1) / 2 / Math.tan(fov / 2), needW = (size.x * 1.15 + 0.2) / 2 / Math.tan(fov / 2) / asp;
    const dist = Math.max(1.4, needH, needW);
    const goal = { target: new THREE.Vector3(c.x, c.y - size.y * 0.06, 0), dist, az: keep ? this.cam.az : 0, el: keep ? this.cam.el : 0.12 };
    this.cam.min = dist * 0.35; this.cam.max = dist * 2.5;
    if (animate) this.cam.goal = goal; else { this.cam.goal = null; this.cam.target.copy(goal.target); this.cam.dist = dist; this.cam.az = goal.az; this.cam.el = goal.el; }
  }

  /** يضيء جزءًا أثناء العزف: صوت (موجات + قفزة) أو صمت (إشارة صمت هادئة، والخلية تستمر) */
  hit(itemIndex, fi, pi, dur, rest) {
    const it = this.items[itemIndex]; if (!it) return;
    const part = it.fig.userData.parts.get(fi + ':' + pi); if (!part) return;
    const grp = it.fig.userData.parts.get(fi + ':*');
    const all = grp ? [...it.fig.userData.parts.entries()].filter(([k]) => k.startsWith(fi + ':')).map(([, v]) => v) : null;
    it.hits.push({ part, t0: this.time, dur, rest, all });
    if (!rest) {
      const head = part.meshes[0]; const wp = new THREE.Vector3(); head.getWorldPosition(wp); this.stage.worldToLocal(wp);
      const n = Math.max(1, Math.min(6, Math.round(dur / 0.28)));
      for (let k = 0; k < n; k++) this.waves.push({ t0: this.time + k * 0.28, pos: wp.clone().add(new THREE.Vector3(0.07, 0, 0)), m: null, life: 0.9 });
    }
  }
  /** يعبّئ خلايا الزمن حتى الموضع (بالأزمنة) لعنصر واحد؛ -1 يفرغها */
  setProgress(itemIndex, beats, rest) {
    const it = this.items[itemIndex]; if (!it) return;
    it.cells.children.forEach((b, c) => { const on = beats > c; b.material.emissive.set(on ? (rest ? '#4b5d78' : '#e9a23b') : '#000000'); b.material.emissiveIntensity = on ? 0.9 : 0; b.material.color.set(on ? (rest ? '#6d7f9a' : '#f5c066') : '#3b3550'); });
  }
  resetProgress() { this.items.forEach((_, i) => this.setProgress(i, -1)); }
  setTalking(index) { this.talkTarget = index; }

  // ------------------------------------------------------------------ الإدخال والكاميرا
  bindInput() {
    const c = this.canvas, ptr = new Map(); let pinch = 0, moved = 0;
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey }); moved = 0; this.cam.goal = null; });
    c.addEventListener('pointermove', (e) => {
      const p = ptr.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (ptr.size === 2) { const [a, b] = [...ptr.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) this.cam.dist = THREE.MathUtils.clamp(this.cam.dist * pinch / d, this.cam.min || 0.5, this.cam.max || 10); pinch = d; return; }
      if (p.b === 2 || p.shift) { const k = this.cam.dist * 0.0012; const right = new THREE.Vector3(Math.cos(this.cam.az), 0, -Math.sin(this.cam.az)); this.cam.target.addScaledVector(right, -dx * k); this.cam.target.y = THREE.MathUtils.clamp(this.cam.target.y + dy * k, 0.3, 2.5); return; }
      this.cam.az -= dx * 0.006; this.cam.el = THREE.MathUtils.clamp(this.cam.el + dy * 0.004, -0.35, 1.2);
    });
    const up = (e) => { const p = ptr.get(e.pointerId); ptr.delete(e.pointerId); pinch = 0; if (p && moved < 6 && this.onPick) { const i = this.pick(e); if (i >= 0) this.onPick(i); } };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', (e) => { ptr.delete(e.pointerId); pinch = 0; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.cam.goal = null; this.cam.dist = THREE.MathUtils.clamp(this.cam.dist * Math.exp(e.deltaY * 0.001), this.cam.min || 0.5, this.cam.max || 10); }, { passive: false });
  }
  pick(e) {
    const r = this.canvas.getBoundingClientRect(); this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hits = this.ray.intersectObjects(this.items.map((i) => i.root), true); if (!hits.length) return -1;
    let o = hits[0].object; while (o && !this.items.some((i) => i.root === o)) o = o.parent; return this.items.findIndex((i) => i.root === o);
  }
  zoom(f) { this.cam.goal = null; this.cam.dist = THREE.MathUtils.clamp(this.cam.dist * f, this.cam.min || 0.5, this.cam.max || 10); }
  rotate(a) { this.cam.goal = null; this.cam.az += a; }
  resetView() { this.fit(false, true); }
  resize() { const p = this.canvas.parentElement; const w = p.clientWidth, h = p.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); if (this.items.length && this.cam.goal) this.fit(true); }

  // ------------------------------------------------------------------ حلقة الإطار
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta()); this.time += dt; const T = this.time;
    const C = this.cam;
    if (C.goal) { const k = Math.min(1, dt * 4); C.target.lerp(C.goal.target, k); C.dist += (C.goal.dist - C.dist) * k; C.az += (C.goal.az - C.az) * k; C.el += (C.goal.el - C.el) * k; if (Math.abs(C.goal.dist - C.dist) < 0.002 && Math.abs(C.goal.az - C.az) < 0.001) C.goal = null; }
    const ce = Math.cos(C.el); this.camera.position.set(C.target.x + C.dist * ce * Math.sin(C.az), C.target.y + C.dist * Math.sin(C.el), C.target.z + C.dist * ce * Math.cos(C.az)); this.camera.lookAt(C.target);
    this.talk += ((this.talkTarget >= 0 ? 1 : 0) - this.talk) * Math.min(1, dt * 8);
    this.items.forEach((it, i) => {
      animateFigure(it.fig, dt, T, i === this.talkTarget ? this.talk : 0);
      it.root.position.y = LINE_Y + (i === this.talkTarget ? Math.abs(Math.sin(T * 5)) * 0.025 * this.talk : 0);
      // القفزات
      for (const v of it.fig.userData.parts.values()) v.meshes.forEach((m, j) => m.position.copy(v.base[j]));
      it.hits = it.hits.filter((h) => T - h.t0 < Math.max(0.45, h.dur));
      for (const h of it.hits) {
        const a = T - h.t0; const k = h.rest ? 0 : Math.sin(Math.min(1, a / 0.22) * Math.PI) * (h.all ? 0.18 : 0.35);
        const apply = (part) => part && part.meshes.forEach((m, j) => { m.position.y = part.base[j].y + k; });
        if (h.all && !h.rest) h.all.forEach((pp) => apply(pp)); else apply(h.part);
        if (h.part.face) { const f = h.part.face; f.position.y = f.userData.base.y + k + (h.rest ? 0 : 0.1 * Math.sin(a * 20) * Math.exp(-a * 6)); if (h.rest && f.userData.mouth) f.userData.mouth.scale.set(0.3, 0.3, 1); }
      }
      if (it.label && it.label.isConnected) { const v = new THREE.Vector3(it.root.position.x, LINE_Y + Math.min(it.fig.userData.bottom, -1.3) * S - 0.13, 0.1).project(this.camera); const r = this.canvas.getBoundingClientRect(); it.label.style.left = `${(v.x * 0.5 + 0.5) * r.width}px`; it.label.style.top = `${(-v.y * 0.5 + 0.5) * r.height}px`; it.label.style.display = v.z < 1 ? '' : 'none'; }
    });
    // موجات الصوت
    this.waves = this.waves.filter((w) => {
      const a = T - w.t0; if (a < 0) return true;
      if (!w.m) { w.m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.8, depthWrite: false })); w.m.position.copy(w.pos); this.stage.add(w.m); }
      const k = a / w.life; w.m.scale.setScalar(0.08 + k * 0.42); w.m.material.opacity = 0.75 * (1 - k);
      if (k >= 1) { this.stage.remove(w.m); w.m.geometry.dispose(); w.m.material.dispose(); return false; } return true;
    });
    if (!window.__noRender) this.renderer.render(this.scene, this.camera);
  }
}
