// الأكورديون الافتراضي — تجميع المشهد والكاميرا والعازفة (المرحلة الأساسية؛ الصوت والواجهة تُضاف في ملفات منفصلة).
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Rig } from '../_shared/3d/character/rig.js';
import { applyOutfit } from '../_shared/3d/character/outfit.js';
import { applyMaterials } from '../_shared/3d/character/materials.js';
import { loadMorph, applyMaleMorph, addMaleFace } from '../_shared/3d/character/gender.js';
import { buildAccordion } from './instrument/accordion-model.js';
import { Accordionist } from './character/accordionist.js';
import { CONFIG } from './config.js';
import { Performer } from './character/performer.js';
import { Life } from './character/life.js';
import { AccordionAudio } from './audio/accordion-audio.js';
import { buildUI } from './ui/ui.js';
import { buildStage } from './instrument/stage.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#scene');
if (new URLSearchParams(location.search).has('clean')) { const st = document.createElement('style'); st.textContent = '#ui,#mt-ip-mark{display:none !important}'; document.head.appendChild(st); }
function fail(m) { $('#loading').classList.add('hidden'); $('#nogl-msg').innerHTML = m; $('#nogl').classList.remove('hidden'); }
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: new URLSearchParams(location.search).has('shot') }); }
catch (e) { fail('تعذّر تشغيل العرض ثلاثي الأبعاد على هذا الجهاز.<br>يحتاج إلى متصفح حديث يدعم WebGL 2.'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.34;
const key = new THREE.DirectionalLight(0xfff1e2, 2.5); key.position.set(1.4, 3.2, 3.0); key.target.position.set(0, 0.9, 0.2);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -1.1, right: 1.1, bottom: -1, top: 1, near: 0.5, far: 8 }); key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0xc8d2e6, 0.6); fill.position.set(-2.5, 1.5, 1.5); scene.add(fill);
const rim = new THREE.DirectionalLight(0xfff4ea, 0.9); rim.position.set(-0.6, 1.8, -3); scene.add(rim);
scene.add(new THREE.HemisphereLight(0x5c6170, 0x33281f, 0.9));
const floor = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshStandardMaterial({ color: 0x3b3027, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

scene.add(buildStage());
const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 30);

// ---------- تحميل ----------
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const mgr = new THREE.LoadingManager(); mgr.setURLModifier((u) => (/\.(png|jpe?g|tga|bmp|gif|tif)(\?|$)/i.test(u) ? PX : u));
const pctEl = $('#loading-pct');
// ---------- الشخصيتان: العازفة (الأصل) والعازف (من النموذج نفسه بأهداف MakeHuman الذكرية) ----------
// اختيار المعلم يُحفظ في المتصفح (مشترك بين لعبتي الكمان والأكورديون)، ويمكن فرضه بالرابط ?performer=male|female.
const PKEY = 'mt-performer-gender';
const readGender = () => { const qg = new URLSearchParams(location.search).get('performer'); if (qg === 'male' || qg === 'female') return qg; try { return localStorage.getItem(PKEY) === 'male' ? 'male' : 'female'; } catch (e) { return 'female'; } };
const cfgFor = (g) => (g === 'male' ? { ...CONFIG, ...CONFIG.male, outfit: { ...CONFIG.outfit, ...CONFIG.male.outfit } } : { ...CONFIG, gender: 'female' });
async function loadCharacter(g, onProgress) {
  const cfg = cfgFor(g);
  const root = await new FBXLoader(mgr).loadAsync(CONFIG.modelUrl, onProgress);
  const strays = []; root.traverse((o) => { if (o.isLight || o.isCamera) strays.push(o); }); strays.forEach((o) => o.parent && o.parent.remove(o));
  if (g === 'male') applyMaleMorph(root, await loadMorph(cfg.morphUrl));
  applyOutfit(root, cfg);
  if (g === 'male') addMaleFace(root);          // قبل المواد: يحتاج أسماء مواد الشفتين الأصلية
  applyMaterials(root, cfg);
  const rg = new Rig(root, cfg);
  if (rg.missing.length) throw new Error('missing-bones:' + rg.missing.join(','));
  const pl = new Accordionist(rg, cfg, acc);
  pl.setup();
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  return { g, cfg, root, rig: rg, player: pl, life: null };
}
const chars = {};
let player, acc, rig, cur = null;
try {
  acc = buildAccordion(); scene.add(acc.root);
  acc.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const g0 = readGender();
  chars[g0] = await loadCharacter(g0, (e) => { if (e.lengthComputable && pctEl) pctEl.textContent = ` ${Math.round(e.loaded / e.total * 100)}%`; });
  cur = chars[g0]; scene.add(cur.root); player = cur.player; rig = cur.rig;
} catch (e) { console.error(e); fail('تعذّر تحميل الشخصية.<br><small>' + (e.message || e) + '</small>'); throw e; }
const audio = new AccordionAudio(); audio.init();
const perf = new Performer(player, audio);
const makeLife = (pl) => { try { const l = new Life(pl, { getCamPos: () => camera.position }); return l.ok ? l : null; } catch (e) { console.warn('life disabled', e); return null; } };
let life = cur.life = makeLife(player);
// تبديل الشخصية دون إعادة تحميل اللعبة: الآلة والصوت والتمارين وحالة الواجهة كما هي؛ تُحمَّل الشخصية الأخرى مرة واحدة ثم تُخزَّن.
let switching = null;
function setPerformer(g, onStatus) {
  if (g !== 'male' && g !== 'female') return Promise.resolve(cur && cur.g);
  if (cur && cur.g === g) return Promise.resolve(g);
  if (switching) return switching;
  switching = (async () => {
    try {
      if (!chars[g]) { onStatus && onStatus('loading'); chars[g] = await loadCharacter(g); chars[g].life = makeLife(chars[g].player); }
      const c = chars[g];
      perf.releaseAll();                                  // نرفع النغمات الجارية لحظة التبديل ثم يُستأنف العزف مباشرة
      if (cur) scene.remove(cur.root);
      scene.add(c.root);
      c.player.activate();                                // يعيد وضع الآلة على جسم هذه الشخصية وأحزمتها
      cur = c; player = c.player; rig = c.rig; life = c.life; perf.p = c.player;
      try { localStorage.setItem(PKEY, g); } catch (e) { /* تصفح خاص */ }
      onStatus && onStatus('done', g);
      return g;
    } catch (e) { console.error(e); onStatus && onStatus('error', e); return cur && cur.g; }
    finally { switching = null; }
  })();
  return switching;
}
$('#loading').classList.add('hidden');

// ---------- كاميرا مدارية ----------
const cam = { goal: { th: 0.55, ph: 1.28, d: 1.9, t: new THREE.Vector3(0, 0.88, 0.2) }, cur: null };
const q = new URLSearchParams(location.search);
if (q.has('th')) cam.goal.th = +q.get('th'); if (q.has('ph')) cam.goal.ph = +q.get('ph'); if (q.has('d')) cam.goal.d = +q.get('d');
if (q.has('t')) { const a = q.get('t').split(',').map(Number); cam.goal.t.set(a[0], a[1], a[2]); }
cam.cur = { th: cam.goal.th, ph: cam.goal.ph, d: cam.goal.d, t: cam.goal.t.clone() };
function applyCam(k = 1) {
  const g = cam.goal, c = cam.cur;
  c.th += (g.th - c.th) * k; c.ph += (g.ph - c.ph) * k; c.d += (g.d - c.d) * k; c.t.lerp(g.t, k);
  const dd = c.d * Math.min(2.2, Math.max(1, 1 / Math.max(0.01, camera.aspect)));      // شاشات رأسية (هاتف): نبعد الكاميرا ليبقى العرض كاملًا
  camera.position.set(c.t.x + dd * Math.sin(c.ph) * Math.sin(c.th), c.t.y + dd * Math.cos(c.ph), c.t.z + dd * Math.sin(c.ph) * Math.cos(c.th));
  camera.lookAt(c.t); camera.updateMatrixWorld(true);
}
const ui = buildUI({ scene, camera, renderer, canvas, acc, perf, audio, cam, performer: { get: () => cur && cur.g, set: setPerformer } });
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

let prev = performance.now();
function tick(dt, draw = true) { applyCam(1 - Math.pow(0.0005, dt)); if (life) life.pre(dt); perf.update(dt); if (life) life.update(dt, { active: perf.activeNotes, sinceNote: perf.sinceNote(), bellowsV: perf.bel.v }); ui.frame(dt); if (draw && !window.__noRender) renderer.render(scene, camera); else scene.updateMatrixWorld(true); }
renderer.setAnimationLoop((now) => { const dt = Math.min(0.05, (now - prev) / 1000); prev = now; tick(dt); });

window.accordionViewer = {
  THREE, scene, camera, renderer, acc, cam, get life() { return life; }, get rig() { return rig; }, get player() { return player; }, get performer() { return cur && cur.g; }, setPerformer,
  look(th, ph, d, t) { Object.assign(cam.goal, { th, ph, d }); if (t) cam.goal.t.set(...t); applyCam(1); cam.cur.th = cam.goal.th; },
  hands(R, L, w) { player.pose({ w: w ?? acc.getWidth(), R: R || player.rightState, L: L || player.leftState }); },
  tick, perf, audio, ui, qa: () => player.qa, pen: () => player.penetration(),
  ready: true,
};
