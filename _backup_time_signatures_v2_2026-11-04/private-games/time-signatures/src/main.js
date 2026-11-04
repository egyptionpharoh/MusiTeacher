// =====================================================================
//  طريقة أداء الموازين الإيقاعية — المايسترو ثلاثية الأبعاد (المشهد، الشخصية، الحركة، المسار، الكاميرا).
//  الشخصية نفسها المستعملة في «عازفة الأكورديون ثلاثية الأبعاد» (النموذج والهيكل والزي والمواد من _shared/3d)،
//  تُحمَّل مرة واحدة وتُعاد استعمالها عند تغيير الميزان أو النمط. لا يُستورد أي ملف من مجلد الأكورديون.
// =====================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Rig } from '../_shared/3d/character/rig.js';
import { applyOutfit } from '../_shared/3d/character/outfit.js';
import { applyMaterials } from '../_shared/3d/character/materials.js';
import { loadMorph, applyMaleMorph, addMaleFace } from '../_shared/3d/character/gender.js';
import { CONFIG } from './config.js';
import { Conductor } from './conductor.js';
import { ConductorLife } from './life.js';
import { Pulse } from './audio.js';
import { Transport } from './transport.js';
import { METERS, handAt, pathSamples } from './patterns.js';
import { buildUI } from './ui.js';

const $ = (s) => document.querySelector(s);
const QS = new URLSearchParams(location.search);
const canvas = $('#scene');
function fail(m) { $('#loading').classList.add('hidden'); $('#nogl-msg').innerHTML = m; $('#nogl').classList.remove('hidden'); }

let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: QS.has('shot') }); }
catch (e) { fail('تعذّر تشغيل العرض ثلاثي الأبعاد على هذا الجهاز.<br>يحتاج إلى متصفح حديث يدعم WebGL.'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const PODIUM_H = 0.14;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.34; pmrem.dispose();
const key = new THREE.DirectionalLight(0xfff1e2, 2.4); key.position.set(1.2, 3.4, 3.2); key.target.position.set(0, 1, 0);
key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -1.2, right: 1.2, bottom: -0.2, top: 2.2, near: 0.5, far: 9 }); key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0xc8d2e6, 0.7); fill.position.set(-2.5, 1.6, 1.8); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffe7b8, 1.1); rim.position.set(-0.8, 2.2, -3); scene.add(rim);
scene.add(new THREE.HemisphereLight(0x5c6170, 0x2a2219, 0.95));
const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), new THREE.MeshStandardMaterial({ color: 0x23293f, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
// منصة القيادة
const podium = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.54, PODIUM_H, 48), new THREE.MeshStandardMaterial({ color: 0x5a3b24, roughness: 0.55, metalness: 0.05 }));
podium.position.y = PODIUM_H / 2; podium.castShadow = podium.receiveShadow = true; scene.add(podium);
const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.505, 0.012, 8, 64), new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.6, roughness: 0.35 }));
rimRing.rotation.x = Math.PI / 2; rimRing.position.y = PODIUM_H; scene.add(rimRing);

const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 30);

// ---------- تحميل الشخصية (مرة واحدة لكل شخصية، ثم تُخزَّن) ----------
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const mgr = new THREE.LoadingManager(); mgr.setURLModifier((u) => (/\.(png|jpe?g|tga|bmp|gif|tif)(\?|$)/i.test(u) ? PX : u));
const PKEY = 'mt-performer-gender';                         // الاختيار نفسه المشترك بين ألعاب الشخصيات ثلاثية الأبعاد
const readGender = () => { const qg = QS.get('performer'); if (qg === 'male' || qg === 'female') return qg; try { return localStorage.getItem(PKEY) === 'male' ? 'male' : 'female'; } catch (e) { return 'female'; } };
const cfgFor = (g) => (g === 'male' ? { ...CONFIG, ...CONFIG.male, outfit: { ...CONFIG.outfit, ...CONFIG.male.outfit }, podiumH: PODIUM_H } : { ...CONFIG, gender: 'female', podiumH: PODIUM_H });
let fbxBuffer = null;                                        // ملف النموذج يُنزَّل مرة واحدة حتى لو بُنيت الشخصيتان
const stats = { modelLoads: 0, charBuilds: 0 };
async function loadCharacter(g, onProgress) {
  const cfg = cfgFor(g);
  if (!fbxBuffer) {
    fbxBuffer = await new Promise((res, rej) => new THREE.FileLoader(mgr).setResponseType('arraybuffer').load(cfg.modelUrl, res, onProgress, rej));
    stats.modelLoads++;
  }
  const root = new FBXLoader(mgr).parse(fbxBuffer, cfg.modelUrl.replace(/[^/]*$/, ''));
  const strays = []; root.traverse((o) => { if (o.isLight || o.isCamera) strays.push(o); }); strays.forEach((o) => o.parent && o.parent.remove(o));
  if (g === 'male') applyMaleMorph(root, await loadMorph(cfg.morphUrl));
  applyOutfit(root, cfg);
  if (g === 'male') addMaleFace(root);
  applyMaterials(root, cfg);
  const rig = new Rig(root, cfg);
  if (rig.missing.length) throw new Error('missing-bones:' + rig.missing.join(','));
  const player = new Conductor(rig, cfg);
  player.setup();
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  let life = null; try { const l = new ConductorLife(player); life = l.ok ? l : null; } catch (e) { console.warn('life disabled', e); }
  stats.charBuilds++;
  return { g, root, rig, player, life };
}
const chars = {};
let cur = null;
try {
  const pct = $('#loading-pct'), g0 = readGender();
  chars[g0] = await loadCharacter(g0, (e) => { if (e.lengthComputable && pct) pct.textContent = ` ${Math.round(e.loaded / e.total * 100)}%`; });
  cur = chars[g0]; scene.add(cur.root);
} catch (e) { console.error(e); fail('تعذّر تحميل شخصية المايسترو.<br><small>' + (e.message || e) + '</small>'); throw e; }

// ---------- الحالة ----------
const audio = new Pulse();
const transport = new Transport(() => audio.now());
const S = {
  meter: METERS[+QS.get('meter')] ? +QS.get('meter') : 4,
  hands: 'right',                 // right | both | mirror
  override: null,                 // أنماط مختلفة عمدًا (تمرين اكتشف الخطأ)
  show: { path: true, points: true, numbers: true, trail: true, halo: true, label: true },
  sound: true,
  blend: 1,
  lastBeat: null,
};
const listeners = new Set();

// ---------- المسار الإرشادي ونقاط النبضات ----------
const guide = new THREE.Group(); scene.add(guide);
const pathMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.85, depthWrite: false });
const ACC_COL = { strong: '#dc2626', medium: '#f59e0b', weak: '#2563eb' };
const texCache = new Map();
function discTex(label, col, ring) {
  const k = label + col + ring; if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.beginPath(); x.arc(64, 64, 54, 0, 7); x.fillStyle = col; x.fill();
  x.lineWidth = 9; x.strokeStyle = ring ? '#ffffff' : 'rgba(255,255,255,.85)'; x.stroke();
  if (label) { x.fillStyle = '#fff'; x.font = 'bold 70px Cairo, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, 64, 70); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set(k, t); return t;
}
let markers = [];
function planeOf(side) { return (u, v) => new THREE.Vector3(...cur.player.palmPoint(u, v, side)); }
function rebuildGuide() {
  for (const o of [...guide.children]) { guide.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== pathMat) o.material.dispose(); }
  markers = [];
  const m = S.meter, bo = S.override, sides = S.hands === 'both' ? ['R', 'L'] : [S.hands === 'mirror' ? 'L' : 'R'];
  for (const side of sides) {
    const P = planeOf(side), pts = pathSamples(m, 48, bo).map(([u, v]) => P(u, v).add(new THREE.Vector3(0, 0, 0.035)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), pts.length * 2, 0.0042, 6, true), pathMat);
    tube.renderOrder = 2; tube.userData.kind = 'path'; guide.add(tube);
    const bs = bo || METERS[m].beats;
    bs.forEach((b, i) => {
      const acc = METERS[m].accents[i];
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(S.show.numbers ? String(i + 1) : '', ACC_COL[acc], false), depthTest: false, transparent: true }));
      sp.position.copy(P(b.P[0], b.P[1])).add(new THREE.Vector3(0, 0, 0.05));
      sp.scale.setScalar(0.052); sp.renderOrder = 5; sp.userData = { kind: 'beat', i, side, flash: 0, acc };
      guide.add(sp); if (side === sides[0]) markers.push(sp);
    });
  }
  applyShow();
}
function applyShow() { for (const o of guide.children) o.visible = o.userData.kind === 'path' ? S.show.path : S.show.points; }

// أثر اليد (ذيل متلاشٍ) وهالة اليد القائدة واسمها
const TRAIL_N = 46;
const trail = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85, depthWrite: false }), TRAIL_N);
trail.frustumCulled = false; trail.renderOrder = 3; scene.add(trail);
const hist = [];
const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(255,214,90,.55)'); g.addColorStop(1, 'rgba(255,214,90,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const halo = [0, 1].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.setScalar(0.17); s.renderOrder = 4; scene.add(s); return s; });
function textSprite(txt) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = 'rgba(10,19,48,.86)'; const r = 40; x.beginPath(); x.roundRect ? x.roundRect(8, 14, 496, 100, r) : x.rect(8, 14, 496, 100); x.fill();
  x.strokeStyle = '#ffcc00'; x.lineWidth = 5; x.stroke();
  x.fillStyle = '#fff'; x.font = 'bold 60px Cairo, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.fillText(txt, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(0.2, 0.05, 1); s.renderOrder = 6; scene.add(s); return s;
}
const labels = { R: textSprite('اليد اليمنى'), L: textSprite('اليد اليسرى') };

// ---------- الكاميرا ----------
const VIEWS = {
  front: { th: 0, ph: 1.52, d: 3.0, t: [-0.04, 1.08, 0.12] },
  angle: { th: -0.66, ph: 1.47, d: 3.3, t: [-0.06, 0.98, 0.1] },
  behind: { th: Math.PI + 0.46, ph: 0.8, d: 2.3, t: [-0.16, 1.08, 0.38] },
  hands: { th: 0, ph: 1.55, d: 1.95, t: [-0.05, 1.06, 0.24] },
};
const cam = { name: 'front', goal: null, cur: null };
function viewGoal(name) { const v = VIEWS[name]; return { th: v.th, ph: v.ph, d: v.d, t: new THREE.Vector3(v.t[0], v.t[1] + PODIUM_H, v.t[2]) }; }
cam.goal = viewGoal(QS.get('view') in VIEWS ? QS.get('view') : 'front'); cam.cur = { ...cam.goal, t: cam.goal.t.clone() };
if (QS.get('view') in VIEWS) cam.name = QS.get('view');
function applyCam(k = 1) {
  const g = cam.goal, c = cam.cur;
  c.th += (g.th - c.th) * k; c.ph += (g.ph - c.ph) * k; c.d += (g.d - c.d) * k; c.t.lerp(g.t, k);
  const dd = c.d * Math.min(2.1, Math.max(1, 0.95 / Math.max(0.01, camera.aspect)));    // شاشات رأسية: نبعد الكاميرا
  camera.position.set(c.t.x + dd * Math.sin(c.ph) * Math.sin(c.th), c.t.y + dd * Math.cos(c.ph), c.t.z + dd * Math.sin(c.ph) * Math.cos(c.th));
  camera.lookAt(c.t); camera.updateMatrixWorld(true);
}
function setView(name) { if (!VIEWS[name]) return; cam.name = name; cam.goal = viewGoal(name); setGhost(name === 'behind'); emit({ type: 'view', name }); }
// العرض من الخلف (من فوق الكتف): الدشداشة والأكمام شفافة جزئيًا (كالأشعة) حتى لا تحجب اليد القائدة؛
// غطاء الرأس (اللحاف/المصر) والجلد واليدان تبقى كما هي، والزاوية مختارة بحيث لا يحجب الرأس واللحاف اليد (مقاس آليًا).
function setGhost(on) {
  for (const c of Object.values(chars)) c.root.traverse((o) => {
    if (!o.isMesh || !/^Outfit_(dishdasha|sleeves|cuff)/.test(o.name)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m.userData.ghost0) m.userData.ghost0 = { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite };
      const g = m.userData.ghost0, sleeve = /sleeve|cuff/i.test(o.name);
      m.transparent = on ? true : g.transparent; m.opacity = on ? (sleeve ? 0.55 : 0.3) : g.opacity; m.depthWrite = on ? false : g.depthWrite; m.needsUpdate = true;
    }
    o.renderOrder = on ? 1 : 0;
  });
  S.ghost = on;
}
// تدوير حر اختياري بالسحب، وتقريب بالعجلة
{
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, th: cam.goal.th, ph: cam.goal.ph }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const w = canvas.clientWidth || 800; cam.goal.th = drag.th - (e.clientX - drag.x) / w * 3; cam.goal.ph = Math.min(1.75, Math.max(0.9, drag.ph - (e.clientY - drag.y) / w * 2)); if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 6) cam.name = 'free'; });
  const end = (e) => { if (drag && cam.name === 'free') emit({ type: 'view', name: 'free' }); drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.goal.d = Math.min(4, Math.max(1, cam.goal.d * (e.deltaY > 0 ? 1.08 : 0.93))); cam.name = 'free'; emit({ type: 'view', name: 'free' }); }, { passive: false });
}

// ---------- الحركة ----------
function emit(ev) { for (const f of listeners) { try { f(ev); } catch (e) { console.error(e); } } }
function sides() { return S.hands === 'both' ? ['R', 'L'] : [S.hands === 'mirror' ? 'L' : 'R']; }
function setMeter(m) { if (!METERS[m]) return; S.meter = m; S.override = null; stopAll(); S.blend = 0; rebuildGuide(); emit({ type: 'meter', m }); }
function setHands(h) { if (!['right', 'both', 'mirror'].includes(h)) return; S.hands = h; S.blend = 0; rebuildGuide(); emit({ type: 'hands', h }); }
function setOverride(bo) { S.override = bo; S.blend = 0; rebuildGuide(); }
function setShow(k, v) { S.show[k] = v; if (k === 'numbers') rebuildGuide(); else applyShow(); }
function stopAll() { transport.reset(); audio.hush(); S.lastBeat = null; S.lastPos = -1; hist.length = 0; emit({ type: 'stop' }); }
transport.onPause = (p) => { audio.cancelAfter(transport.timeOf(p) + 0.01); emit({ type: 'pause', p }); };

let schedTimer = null;
function scheduler() {
  for (const ev of transport.due(0.16)) {
    if (S.sound) audio.click(ev.t, METERS[S.meter].accents[((ev.b % S.meter) + S.meter) % S.meter]);
  }
}
async function ensureAudio() { await audio.init(); if (!schedTimer) schedTimer = setInterval(scheduler, 25); }

const DEG = Math.PI / 180;
function frame(dt) {
  const p = transport.pos(audio.heardNow());
  const h = handAt(S.meter, p, S.override);
  // حدث النبضة: لحظة عبور الإكتوس (من الزمن المسموع، فيتطابق مع النقرة). إن مرّت أكثر من نبضة بين إطارين تُعلن كلها بالترتيب.
  if (transport.playing || p === transport.held) {
    const from = S.lastPos == null ? -1 : S.lastPos;
    if (p >= 0 && p > from) {
      for (let k = Math.max(0, Math.floor(from + 1e-6) + 1); k <= Math.floor(p + 1e-6); k++) {
        if (k === S.lastBeat) continue;
        S.lastBeat = k; const i = ((k % S.meter) + S.meter) % S.meter;
        const mk = markers[i]; if (mk) mk.userData.flash = 1;
        if (cur.life) cur.life.beat(i === 0);
        emit({ type: 'beat', i, k, accent: METERS[S.meter].accents[i] });
      }
    }
    if (p < 0) S.lastBeat = null;
  }
  S.lastPos = p;
  const active = sides(), st = { R: { rest: true }, L: { rest: true } };
  const vel = 1 / Math.max(0.2, transport.dur);
  for (const s of active) st[s] = { u: h.u, v: h.v, du: transport.playing ? h.du * vel : 0, dv: transport.playing ? h.dv * vel : 0 };
  S.blend = Math.min(1, S.blend + dt / 0.4);
  if (cur.life) cur.life.pre(dt);
  cur.player.pose(st, S.blend >= 1 ? 1 : 1 - Math.pow(0.002, dt));
  if (cur.life) cur.life.update(dt, { viewer: camera.position, hand: cur.player.palmNow(active[0]), playing: transport.playing });
  // الأثر
  const palm = cur.player.palmNow(active[0]);
  if (transport.playing) { hist.unshift(palm); if (hist.length > TRAIL_N) hist.length = TRAIL_N; } else if (hist.length) hist.pop();
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < TRAIL_N; i++) {
    const q = hist[i]; const sc = q && S.show.trail ? 0.0085 * (1 - i / TRAIL_N) + 0.0015 : 0;
    m4.makeScale(sc, sc, sc); if (q) m4.setPosition(q[0], q[1], q[2] + 0.03); trail.setMatrixAt(i, m4);
  }
  trail.instanceMatrix.needsUpdate = true;
  // الهالة والاسم
  halo.forEach((s, i) => { const sd = active[i]; s.visible = !!sd && S.show.halo; if (s.visible) s.position.set(...cur.player.palmNow(sd)); });
  for (const sd of ['R', 'L']) { const lb = labels[sd], on = S.show.label && active.includes(sd); lb.visible = on; if (on) { const q = cur.player.palmNow(sd); lb.position.set(q[0], q[1] + 0.1, q[2] + 0.02); } }
  for (const mk of markers) { const f = mk.userData.flash; mk.scale.setScalar(0.052 * (1 + 0.55 * f)); mk.userData.flash = Math.max(0, f - dt * 2.6); }
}

function resize() {
  const r = canvas.parentElement.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement); resize();

// تبديل شخصية المايسترو دون إعادة تحميل اللعبة: تُبنى الأخرى مرة واحدة وتُخزَّن
let switching = null;
function setPerformer(g) {
  if (g !== 'male' && g !== 'female') return Promise.resolve(cur.g);
  if (cur.g === g) return Promise.resolve(g);
  if (switching) return switching;
  switching = (async () => {
    await null;
    try {
      emit({ type: 'performer', status: 'loading' });
      if (!chars[g]) chars[g] = await loadCharacter(g);
      scene.remove(cur.root); cur = chars[g]; scene.add(cur.root);
      S.blend = 0; rebuildGuide(); setGhost(cam.name === 'behind');
      try { localStorage.setItem(PKEY, g); } catch (e) { /* */ }
      emit({ type: 'performer', status: 'done', g }); return g;
    } catch (e) { console.error(e); emit({ type: 'performer', status: 'error' }); return cur.g; }
    finally { switching = null; }
  })();
  return switching;
}

/** إسقاط نقاط النبضات على الشاشة (لتمرين «أين تقع النبضة؟») */
function beatScreenPoints() {
  const r = canvas.getBoundingClientRect();
  return markers.map((mk) => { const v = mk.position.clone().project(camera); return { i: mk.userData.i, x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; });
}

rebuildGuide(); setGhost(cam.name === 'behind');
$('#loading').classList.add('hidden');

const engine = {
  S, METERS, transport, audio, stats, get player() { return cur.player; }, get performer() { return cur.g; },
  setMeter, setHands, setShow, setView, setOverride, setPerformer, stopAll, ensureAudio, beatScreenPoints,
  get view() { return cam.name; },
  /** هل الكاميرا أمام المايسترو؟ (فتظهر حركتها معكوسة كالمرآة) */
  facing() { const g = cam.goal; return Math.cos(g.th) > 0; },
  on(f) { listeners.add(f); return () => listeners.delete(f); },
};
const ui = buildUI(engine);

let prev = performance.now(), running = true;
function tick(now) {
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
  applyCam(1 - Math.pow(0.0008, dt)); frame(dt); ui.frame && ui.frame(dt);
  if (!window.__noRender) renderer.render(scene, camera);
}
renderer.setAnimationLoop(tick);
// إيقاف كل شيء عند إخفاء الصفحة/إغلاقها: لا حركة ولا صوت يستمر بعد الإغلاق
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (transport.playing) { stopAll(); } renderer.setAnimationLoop(null); running = false; if (audio.ctx) audio.ctx.suspend().catch(() => {}); }
  else if (!running) { prev = performance.now(); renderer.setAnimationLoop(tick); running = true; }
});
addEventListener('pagehide', () => { stopAll(); renderer.setAnimationLoop(null); if (schedTimer) clearInterval(schedTimer); audio.close(); });

window.conductorViewer = {
  THREE, scene, camera, renderer, engine, ui, VIEWS, applyCam, handAt,
  get rig() { return cur.rig; }, get player() { return cur.player; }, get life() { return cur.life; },
  frame(dt = 1 / 60) { applyCam(1); frame(dt); },
  ready: true,
};
