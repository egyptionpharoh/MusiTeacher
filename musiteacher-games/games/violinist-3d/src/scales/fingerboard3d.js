// زند الكمان ثلاثي الأبعاد للعبة السلالم.
// يعيد استخدام الكمان نفسه من المشروع (buildViolin + VN) دون أي تعديل عليه.
// الزند معروض أفقيًا: الأنف (والرأس) على اليسار، والفرس جهة اليمين — فكلما اتجهنا يمينًا ارتفعت النغمة،
// تمامًا كما تتقدم النغمات على المدرج من اليسار إلى اليمين. وتر «مي» في الأعلى ووتر «صول» في الأسفل.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Frame } from '../engine/math.js';
import { LegacyBuilder } from '../engine/three-adapter.js';
import { VN, buildViolin } from '../instruments/violin.js';
import { STRINGS, stopFromBridge } from './scale-data.js';

const L = VN.yNut;                      // طول الوتر المهتز في النموذج (الفرس عند y = 0 والأنف عند y = 0.325 م)
const LIFT = 0.0032;                    // رفع الدائرة فوق الوتر قليلًا حتى لا يخترقها
const VIEW = { yMin: 0.098, yMax: 0.372 };   // الجزء الظاهر من الكمان على امتداده
const FONT = "'Tajawal','Segoe UI',Tahoma,Arial,sans-serif";

// نقطة الضغط على الوتر (إحداثيات الكمان المحلية)
export function stopPoint(string, semis) {
  const y = semis === 0 ? L + 0.0062 : stopFromBridge(L, semis);   // الوتر المفتوح: الدائرة فوق الأنف مباشرة
  const p = VN.stringAt(string, y);
  return new THREE.Vector3(p[0], p[1], p[2] + LIFT);
}

// ---------- خامات الدوائر ----------
const TEX = new Map();
function markerTexture(kind, label) {
  const key = kind + ':' + label;
  if (TEX.has(key)) return TEX.get(key);
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), C = N / 2;
  x.clearRect(0, 0, N, N);
  if (kind === 'active') {
    const g = x.createRadialGradient(C - 26, C - 30, 10, C, C, 118);
    g.addColorStop(0, '#fff1c4'); g.addColorStop(0.45, '#f4c75e'); g.addColorStop(1, '#b97a1e');
    x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 14;
    x.beginPath(); x.arc(C, C, 108, 0, Math.PI * 2); x.fillStyle = g; x.fill();
    x.shadowBlur = 0; x.lineWidth = 10; x.strokeStyle = '#6b420c'; x.stroke();
    x.fillStyle = '#2a1805';
  } else if (kind === 'held') {
    x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 10;
    x.beginPath(); x.arc(C, C, 100, 0, Math.PI * 2); x.fillStyle = 'rgba(246,238,224,.93)'; x.fill();
    x.shadowBlur = 0; x.lineWidth = 9; x.strokeStyle = '#a87a3c'; x.stroke();
    x.fillStyle = '#5a3e1c';
  } else if (kind === 'next') {
    x.beginPath(); x.arc(C, C, 100, 0, Math.PI * 2); x.fillStyle = 'rgba(20,14,8,.55)'; x.fill();
    x.setLineDash([22, 14]); x.lineWidth = 11; x.strokeStyle = '#f0c260'; x.stroke(); x.setLineDash([]);
    x.fillStyle = '#f6d48a';
  } else if (kind === 'open') {
    x.beginPath(); x.arc(C, C, 104, 0, Math.PI * 2); x.fillStyle = 'rgba(20,14,8,.6)'; x.fill();
    x.lineWidth = 16; x.strokeStyle = '#f4c75e'; x.stroke();
    x.fillStyle = '#fbe3a6';
  } else if (kind === 'open-next') {
    x.beginPath(); x.arc(C, C, 100, 0, Math.PI * 2); x.fillStyle = 'rgba(20,14,8,.5)'; x.fill();
    x.setLineDash([22, 14]); x.lineWidth = 11; x.strokeStyle = '#f0c260'; x.stroke(); x.setLineDash([]);
    x.fillStyle = '#f6d48a';
  } else if (kind === 'ring') {
    x.beginPath(); x.arc(C, C, 112, 0, Math.PI * 2); x.lineWidth = 8; x.strokeStyle = 'rgba(247,210,126,1)'; x.stroke();
  }
  if (label !== '') {
    x.font = `800 ${kind === 'active' ? 150 : 132}px ${FONT}`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(label, C, C + 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  TEX.set(key, t);
  return t;
}
function labelTexture(text, active) {
  const key = 'lbl:' + text + ':' + active;
  if (TEX.has(key)) return TEX.get(key);
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const r = 52;
  x.beginPath(); x.roundRect(8, 12, W - 16, H - 24, r);
  x.fillStyle = active ? 'rgba(244,199,94,.96)' : 'rgba(18,13,9,.78)'; x.fill();
  x.lineWidth = 4; x.strokeStyle = active ? '#fff0c2' : 'rgba(212,163,115,.55)'; x.stroke();
  x.font = `800 64px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = active ? '#2a1805' : '#f1e6d6';
  x.direction = 'rtl';
  x.fillText(text, W / 2, H / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  TEX.set(key, t);
  return t;
}

const SIZE = { active: 0.0098, held: 0.0080, next: 0.0084, open: 0.0094, 'open-next': 0.0084 };
const OPACITY = { active: 1, held: 0.92, next: 0.62, open: 1, 'open-next': 0.6 };

export class Fingerboard3D {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.42;
    scene.add(new THREE.HemisphereLight(0xfff2dc, 0x2a1d12, 0.55));
    const key = new THREE.DirectionalLight(0xffe4c0, 1.5); key.position.set(-0.3, 0.9, 0.6); scene.add(key);
    const rim = new THREE.DirectionalLight(0xc9a16a, 0.8); rim.position.set(0.5, -0.6, 0.4); scene.add(rim);
    this.scene = scene;

    // الكمان: نُدير مجموعة الكمان 90° حول z ← محور الزند أفقي (الرأس يسارًا)، ووتر مي في الأعلى
    const violin = new THREE.Group();
    violin.rotation.z = Math.PI / 2;
    scene.add(violin);
    this.violin = violin;
    const R = new LegacyBuilder(violin, renderer);
    buildViolin(R, Frame([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]));
    // لوحة الأصابع: أبنوس مطفأ قليلًا حتى لا يلمع لمعانًا أبيض أمام الكاميرا القريبة وتبرز الدوائر الذهبية فوقه
    violin.traverse((o) => {
      if (o.isMesh && o.name === 'fingerboard') {
        o.material = o.material.clone();
        o.material.roughness = 0.62; o.material.clearcoat = 0.12; o.material.clearcoatRoughness = 0.6;
      }
    });

    // توهج الأوتار: جزء كامل خافت + الجزء المهتز (من الإصبع حتى الفرس) أكثر إشراقًا
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
    this.glow = STRINGS.map((s) => {
      const mk = (color, op) => {
        const m = new THREE.Mesh(cyl, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.renderOrder = 5; violin.add(m); return m;
      };
      return { core: mk(0xffd27a), halo: mk(0xffb640), dim: mk(0xffc96a), v: 0, target: 0, stopY: L };
    });

    // أسماء الأوتار عند الرأس
    this.labels = STRINGS.map((s, i) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(s.ar, false), depthTest: false, transparent: true }));
      const p = VN.stringAt(i, L + 0.032);
      sp.position.set((i - 1.5) * 0.0108, p[1], p[2] + 0.012);
      sp.scale.set(0.0118, 0.0059, 1);
      sp.renderOrder = 20; violin.add(sp);
      return sp;
    });

    this.markers = new Map();   // key → {sprite, ring, target...}
    this.camState = { tilt: 0.26, yaw: 0.0, zoom: 1, tTilt: 0.26, tYaw: 0, tZoom: 1 };
    this.camera = new THREE.PerspectiveCamera(22, 1, 0.01, 5);
    this._bindInput();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
    this.clock = new THREE.Clock();
    renderer.setAnimationLoop(() => this._frame());
  }

  resize() {
    const el = this.canvas.parentElement;
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // state: { active:{string,semis,finger}, held:[...], next:{...}|null, showNumbers, showNext, showHeld }
  setState(st) {
    this.state = st;
    const want = new Map();
    const lbl = (f) => st.showNumbers === false ? '' : String(f);
    if (st.showHeld !== false) for (const h of st.held || []) want.set(`${h.string}:${h.finger}`, { kind: 'held', ...h });
    if (st.next && st.showNext !== false) {
      const n = st.next, k = `${n.string}:${n.finger}`;
      const same = st.active && st.active.string === n.string && st.active.finger === n.finger;
      if (!same) want.set(k, { kind: n.finger === 0 ? 'open-next' : 'next', ...n });
    }
    if (st.active) {
      const a = st.active;
      want.set(`${a.string}:${a.finger}`, { kind: a.finger === 0 ? 'open' : 'active', ...a });
    }
    // إنشاء/تحديث
    for (const [k, w] of want) {
      let m = this.markers.get(k);
      if (!m) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, opacity: 0 }));
        sp.renderOrder = 30; this.violin.add(sp);
        const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture('ring', ''), transparent: true, depthTest: false, opacity: 0, blending: THREE.AdditiveBlending }));
        ring.renderOrder = 29; this.violin.add(ring);
        m = { sprite: sp, ring, op: 0, size: SIZE[w.kind] * 0.4 };
        this.markers.set(k, m);
      }
      m.kind = w.kind; m.alive = true;
      m.sprite.material.map = markerTexture(w.kind, lbl(w.finger)); m.sprite.material.needsUpdate = true;
      const p = stopPoint(w.string, w.semis);
      m.sprite.position.copy(p); m.ring.position.copy(p);
      m.tOp = OPACITY[w.kind]; m.tSize = SIZE[w.kind];
      if (w.kind === 'active' || w.kind === 'open') m.pulse = 0;
    }
    for (const [k, m] of this.markers) if (!want.has(k)) { m.alive = false; m.tOp = 0; }

    // الأوتار
    this.glow.forEach((g, i) => {
      const a = st.active && st.active.string === i;
      g.target = a ? 1 : 0;
      if (a) g.stopY = st.active.semis === 0 ? L : stopFromBridge(L, st.active.semis);
      this._placeGlow(g, i);
      this.labels[i].material.map = labelTexture(STRINGS[i].ar, a); this.labels[i].material.needsUpdate = true;
    });
  }

  _placeGlow(g, i) {
    const seg = (mesh, y0, y1, r) => {
      const a = VN.stringAt(i, y0), b = VN.stringAt(i, y1);
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
      const d = B.clone().sub(A), len = d.length();
      mesh.visible = len > 1e-5;
      if (!mesh.visible) return;
      mesh.position.copy(A).add(B).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      mesh.scale.set(r, len, r);
    };
    seg(g.dim, g.stopY, L, 0.0007);           // من الأنف إلى الإصبع (لا يهتز)
    seg(g.core, 0.004, g.stopY, 0.00062);     // الجزء المهتز
    seg(g.halo, 0.004, g.stopY, 0.0019);
  }

  _bindInput() {
    const c = this.canvas; let drag = null;
    c.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, tilt: this.camState.tTilt, yaw: this.camState.tYaw }; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const s = this.camState;
      s.tYaw = Math.max(-0.45, Math.min(0.45, drag.yaw - (e.clientX - drag.x) * 0.004));
      s.tTilt = Math.max(-0.15, Math.min(0.95, drag.tilt + (e.clientY - drag.y) * 0.004));
    });
    const end = () => { drag = null; };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    c.addEventListener('dblclick', () => this.resetView());
    c.addEventListener('wheel', (e) => { e.preventDefault(); const s = this.camState; s.tZoom = Math.max(0.8, Math.min(2.2, s.tZoom * (e.deltaY > 0 ? 0.92 : 1.08))); }, { passive: false });
  }
  resetView() { Object.assign(this.camState, { tTilt: 0.26, tYaw: 0, tZoom: 1 }); }

  _updateCamera(dt) {
    const s = this.camState, k = 1 - Math.exp(-dt * 7);
    s.tilt += (s.tTilt - s.tilt) * k; s.yaw += (s.tYaw - s.yaw) * k; s.zoom += (s.tZoom - s.zoom) * k;
    const cam = this.camera;
    const W = (VIEW.yMax - VIEW.yMin) * 1.04 / s.zoom;
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    // نضمن ظهور الطول الكامل أفقيًا وعرض لوحة الأصابع عموديًا
    const dW = (W / 2) / (tanV * cam.aspect), dH = (0.05 / s.zoom) / tanV;
    const d = Math.max(dW, dH);
    const cx = -(VIEW.yMin + VIEW.yMax) / 2 + (s.zoom > 1 ? -0.03 * (s.zoom - 1) : 0);   // التكبير يقترب من منطقة الأصابع
    const target = new THREE.Vector3(cx, 0, 0.026);
    const dir = new THREE.Vector3(Math.sin(s.yaw), -Math.sin(s.tilt) * Math.cos(s.yaw), Math.cos(s.tilt) * Math.cos(s.yaw)).normalize();
    cam.position.copy(target).addScaledVector(dir, d);
    cam.up.set(0, 1, 0);
    cam.lookAt(target);
  }

  _frame() {
    const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
    this._updateCamera(dt);
    const k = 1 - Math.exp(-dt * 10);
    for (const [key, m] of this.markers) {
      m.op += (m.tOp - m.op) * k;
      m.size += (m.tSize - m.size) * k;
      const s = m.size * (m.kind === 'active' || m.kind === 'open' ? 1 + 0.03 * Math.sin(t * 4) : 1);
      m.sprite.scale.set(s, s, 1);
      m.sprite.material.opacity = m.op;
      const pulseOn = m.alive && (m.kind === 'active' || m.kind === 'open');
      if (pulseOn) { m.pulse = (m.pulse + dt * 0.9) % 1; const r = m.tSize * (1.05 + m.pulse * 0.9); m.ring.scale.set(r, r, 1); m.ring.material.opacity = (1 - m.pulse) * 0.7 * m.op; }
      else m.ring.material.opacity *= 0.85;
      if (!m.alive && m.op < 0.01) { this.violin.remove(m.sprite, m.ring); this.markers.delete(key); }
    }
    this.glow.forEach((g) => {
      g.v += (g.target - g.v) * (1 - Math.exp(-dt * 9));
      const shimmer = 0.85 + 0.15 * Math.sin(t * 22);
      g.core.material.opacity = g.v * 0.95;
      g.halo.material.opacity = g.v * 0.32 * shimmer;
      g.dim.material.opacity = g.v * 0.28;
    });
    this.renderer.render(this.scene, this.camera);
  }

  // لأغراض الاختبار: موضع نقطة على الشاشة (بكسل) داخل اللوحة
  project(string, semis) {
    const p = stopPoint(string, semis); this.violin.updateMatrixWorld(true);
    const w = p.applyMatrix4(this.violin.matrixWorld).project(this.camera);
    const el = this.canvas;
    return { x: (w.x + 1) / 2 * el.clientWidth, y: (1 - w.y) / 2 * el.clientHeight };
  }
}
