// =====================================================================
//  المسرح ثلاثي الأبعاد: آلات الفن مصطفّة على منصة، وكل آلة تتحرك لحظة صدور صوتها.
//  مُصيِّر واحد فقط للصفحة كلها: يلتقط صورًا مصغّرة للآلات (لبطاقاتها) ثم يعرض المسرح — فلا يُستهلك إلا سياق WebGL واحد.
// =====================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BUILDERS } from './models.js';

export class Stage {
  constructor(canvas) {
    this.canvas = canvas; this.items = []; this.clock = new THREE.Clock(); this.active = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    const r = this.renderer; r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); this.slow = 0; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.08;
    this.env = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene = this.makeScene(true);
    this.camera = new THREE.PerspectiveCamera(30, 2, 0.05, 30);
    this.row = new THREE.Group(); this.scene.add(this.row);
    this.cache = new Map();
  }
  makeScene(floor) {
    const s = new THREE.Scene(); s.environment = this.env;
    const key = new THREE.DirectionalLight(0xfff0dc, 2.3); key.position.set(1.2, 2.6, 2.2); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.006;
    Object.assign(key.shadow.camera, { left: -2.6, right: 2.6, top: 1.6, bottom: -1.6, near: 0.1, far: 9 }); s.add(key);
    const rim = new THREE.DirectionalLight(0xffd9a0, 0.7); rim.position.set(-1.6, 1.2, -1.4); s.add(rim);
    s.add(new THREE.HemisphereLight(0xfff4e0, 0x3a2a18, 0.5));
    if (floor) { const f = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.ShadowMaterial({ opacity: 0.32 })); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; s.add(f); }
    return s;
  }
  model(id) { const b = BUILDERS[id](); return b; }
  /** صور مصغّرة شفافة الخلفية لكل آلة (تُلتقط مرة واحدة عند التحميل) */
  thumbs(ids, px = 300) {
    const out = {}, r = this.renderer, prev = r.getPixelRatio();
    r.setPixelRatio(1); r.setSize(px, px, false);
    for (const id of ids) {
      const s = this.makeScene(true), m = this.model(id); s.add(m.group);
      const box = new THREE.Box3().setFromObject(m.group), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 20), d = Math.max(sz.x, sz.y * 1.05, sz.z * 0.8) / (2 * Math.tan(13 * Math.PI / 180)) * 1.22;
      cam.position.set(c.x + d * 0.22, c.y + d * 0.36, c.z + d * 0.9); cam.lookAt(c.x, c.y - sz.y * 0.03, c.z);
      r.render(s, cam); out[id] = this.canvas.toDataURL('image/png');
      s.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    r.setPixelRatio(prev); return out;
  }
  setArt(art) {
    for (const it of this.items) { this.row.remove(it.group); it.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    this.items = [];
    const ms = art.tracks.map((t) => ({ inst: t.inst, name: t.info.name, ...this.model(t.info.model) }));
    const gap = 0.16; let W = ms.reduce((s, m) => s + m.size.w, 0) + gap * (ms.length - 1), x = -W / 2;
    // الترتيب من اليمين إلى اليسار بترتيب المدوّنة (المسار الأول في أقصى اليمين)
    ms.forEach((m, i) => {
      const cx = -(x + m.size.w / 2); x += m.size.w + gap;
      const z = -0.12 * Math.cos((i / Math.max(1, ms.length - 1) - 0.5) * Math.PI);
      m.group.position.set(cx, 0, ms.length > 2 ? z : 0); m.group.userData.y0 = 0;
      this.row.add(m.group); this.items.push({ ...m, x: cx, t: 9, k: 'D', audible: true, fresh: false, top: m.size.h });
    });
    this.W = W; this.Hmax = Math.max(...ms.map((m) => m.size.h)); this.fit();
  }
  fit() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.dirty = true; const cam = this.camera; cam.aspect = w / h;
    const vf = cam.fov * Math.PI / 180, need = Math.max((this.W + 0.5) / (2 * Math.tan(vf / 2) * cam.aspect), (this.Hmax + 0.42) / (2 * Math.tan(vf / 2)));
    cam.position.set(0, this.Hmax * 0.5 + need * 0.3, need * 0.98); cam.lookAt(0, this.Hmax * 0.4, 0); cam.updateProjectionMatrix();
  }
  hit(inst, k) { const it = this.items.find((q) => q.inst === inst); if (it) { it.t = 0; it.k = k; it.fresh = true; } }
  /** إحداثيات الشاشة (نسبة مئوية) لموضع تسمية كل آلة */
  labels() {
    const v = new THREE.Vector3();
    return this.items.map((it) => { v.set(it.x, -0.02, it.group.position.z + 0.16); v.project(this.camera); return { inst: it.inst, name: it.name, x: (v.x + 1) * 50, y: (1 - v.y) * 50, t: it.t }; });
  }
  /**
   * يُرسم المسرح عند الحاجة فقط (حركة ضربة جارية أو تغيير في الحجم)، وبحد أقصى 40 إطارًا/ث،
   * مع خفض الجودة تلقائيًا على الأجهزة البطيئة — حتى لا يزاحم الرسمُ جدولةَ الصوت أبدًا.
   */
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    let busy = this.dirty;
    for (const it of this.items) { it.t += dt; if (it.t < 0.5 || it.fresh) busy = true; it.hit(it.group, it.t, it.k, it.fresh); it.fresh = false; }
    if (!busy) return;
    const now = performance.now(); if (!this.dirty && now - (this.lastR || 0) < 25) return;
    // زمن الرسم الحقيقي يظهر في الفاصل بين إطار مرسوم وما بعده (عمل البطاقة الرسومية لا يُحتسب داخل render نفسها)
    const gap = this.lastR ? now - this.lastR : 0;
    this.dirty = false; this.lastR = now;
    this.renderer.render(this.scene, this.camera);
    if (gap > 70) { this.slow += gap > 150 ? 3 : 1; if (this.slow > 12) this.degrade(); } else if (gap && gap < 40) this.slow = Math.max(0, this.slow - 1);
  }
  /** خفض الجودة على الأجهزة البطيئة: 1) دقة أقل 2) صور ثابتة بدل المسرح الحي (onSlow) — دون إعادة بناء المظللات حتى لا يتقطع الصوت */
  degrade() {
    this.level = (this.level || 0) + 1; this.slow = 0;
    if (this.level >= 2) { this.static = true; if (this.onSlow) this.onSlow(); return; }
    const r = this.renderer;
    if (this.level === 1) r.setPixelRatio(1);
    if (this.level === 2) { r.setPixelRatio(0.75); r.shadowMap.enabled = false; this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
    this.fit();
  }
}
