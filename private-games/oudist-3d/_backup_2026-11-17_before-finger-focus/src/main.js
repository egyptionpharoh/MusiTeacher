// =====================================================================
//  عازف العود ثلاثي الأبعاد — تجميع المشهد والكاميرا والعازف/العازفة والصوت والواجهة.
//  البنية مثل ألعاب الكمان والأكورديون والأورج: نفس نموذج الشخصية المشترك (_shared/3d/character) ونفس آلية تبديل الشخصية،
//  مع آلة وحركة عزف خاصة بالعود (src/instrument و src/character).
// =====================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Rig } from '../_shared/3d/character/rig.js';
import { applyOutfit } from '../_shared/3d/character/outfit.js';
import { applyMaterials } from '../_shared/3d/character/materials.js';
import { loadMorph, applyMaleMorph, addMaleFace } from '../_shared/3d/character/gender.js';
import { buildOud, buildRisha } from './instrument/oud-model.js';
import { buildStage } from './instrument/stage.js';
import { Oudist } from './character/oudist.js';
import { Performer } from './character/performer.js';
import { Life } from './character/life.js';
import { OudAudio } from './audio/oud-audio.js';
import { CONFIG } from './config.js';
import { buildUI } from './ui/ui.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const canvas = $('#scene');
if (params.has('clean')) { const st = document.createElement('style'); st.textContent = '#ui,#mt-ip-mark{display:none !important}'; document.head.appendChild(st); }
function fail(m) { $('#loading').classList.add('hidden'); $('#nogl-msg').innerHTML = m; $('#nogl').classList.remove('hidden'); }
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') }); }
catch (e) { fail('تعذّر تشغيل العرض ثلاثي الأبعاد على هذا الجهاز.<br>يحتاج إلى متصفح حديث يدعم WebGL 2.'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.36;
const key = new THREE.DirectionalLight(0xfff1e2, 2.3); key.position.set(-1.4, 3.0, 2.6); key.target.position.set(0, 0.8, 0.3);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -1.2, right: 1.2, bottom: -1.1, top: 1.1, near: 0.5, far: 8 }); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0xc8d2e6, 0.7); fill.position.set(2.4, 1.5, 2.0); scene.add(fill);
const rim = new THREE.DirectionalLight(0xfff4ea, 0.85); rim.position.set(0.6, 1.9, -3); scene.add(rim);
scene.add(new THREE.HemisphereLight(0x5c6170, 0x33281f, 0.9));
const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshStandardMaterial({ color: 0x3b3027, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
scene.add(buildStage());
const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 30);

// ---------- تحميل ----------
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const mgr = new THREE.LoadingManager(); mgr.setURLModifier((u) => (/\.(png|jpe?g|tga|bmp|gif|tif)(\?|$)/i.test(u) ? PX : u));
const pctEl = $('#loading-pct');
// اختيار المعلم يُحفظ في المتصفح (مشترك بين ألعاب العازف ثلاثية الأبعاد)، ويمكن فرضه بالرابط ?performer=male|female.
// الافتراضي في لعبة العود: العازف (كما في صور المرجع)، ما لم يكن المعلم قد اختار غيره في لعبة أخرى.
const PKEY = 'mt-performer-gender';
const readGender = () => { const qg = params.get('performer'); if (qg === 'male' || qg === 'female') return qg; try { const v = localStorage.getItem(PKEY); return v === 'female' ? 'female' : 'male'; } catch (e) { return 'male'; } };
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
  const pl = new Oudist(rg, cfg, oud);
  pl.setup();
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  return { g, cfg, root, rig: rg, player: pl, life: null };
}
const chars = {};
let oud, risha, player, rig, cur = null;
try {
  oud = buildOud(); scene.add(oud.root);
  risha = buildRisha(); scene.add(risha);
  const g0 = readGender();
  chars[g0] = await loadCharacter(g0, (e) => { if (e.lengthComputable && pctEl) pctEl.textContent = ` ${Math.round(e.loaded / e.total * 100)}%`; });
  cur = chars[g0]; scene.add(cur.root); if (cur.player.extras) scene.add(cur.player.extras); player = cur.player; rig = cur.rig;
} catch (e) { console.error(e); fail('تعذّر تحميل الشخصية.<br><small>' + (e.message || e) + '</small>'); throw e; }
const audio = new OudAudio();
const perf = new Performer(player, audio, oud);
const makeLife = (pl) => { try { const l = new Life(pl, { getCamPos: () => camera.position }); return l.ok ? l : null; } catch (e) { console.warn('life disabled', e); return null; } };
let life = cur.life = makeLife(player);

// تبديل الشخصية دون إعادة تحميل اللعبة: العود والصوت والتمرين والكاميرا وحالة الواجهة كما هي؛ تُحمَّل الشخصية الأخرى مرة واحدة ثم تُخزَّن.
let switching = null;
function setPerformer(g, onStatus) {
  if (g !== 'male' && g !== 'female') return Promise.resolve(cur && cur.g);
  if (cur && cur.g === g) return Promise.resolve(g);
  if (switching) return switching;
  switching = (async () => {
    try {
      if (!chars[g]) { onStatus && onStatus('loading'); chars[g] = await loadCharacter(g); chars[g].life = makeLife(chars[g].player); }
      const c = chars[g];
      if (cur) { scene.remove(cur.root); if (cur.player.extras) scene.remove(cur.player.extras); }
      scene.add(c.root); if (c.player.extras) scene.add(c.player.extras);
      cur = c; player = c.player; rig = c.rig; life = c.life; perf.p = c.player;
      c.player.activate();                                 // العود يعود إلى حِجر هذه الشخصية وصدرها
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
const cam = { goal: { th: 0.42, ph: 1.22, d: 1.65, t: new THREE.Vector3(0.05, 0.86, 0.28) }, cur: null };
if (params.has('th')) cam.goal.th = +params.get('th'); if (params.has('ph')) cam.goal.ph = +params.get('ph'); if (params.has('d')) cam.goal.d = +params.get('d');
if (params.has('t')) { const a = params.get('t').split(',').map(Number); cam.goal.t.set(a[0], a[1], a[2]); }
cam.cur = { th: cam.goal.th, ph: cam.goal.ph, d: cam.goal.d, t: cam.goal.t.clone() };
function applyCam(k = 1) {
  const g = cam.goal, c = cam.cur;
  c.th += (g.th - c.th) * k; c.ph += (g.ph - c.ph) * k; c.d += (g.d - c.d) * k; c.t.lerp(g.t, k);
  const dd = c.d * Math.min(2.2, Math.max(1, 1 / Math.max(0.01, camera.aspect)));      // شاشات رأسية (هاتف): نبعد الكاميرا ليبقى العرض كاملًا
  camera.position.set(c.t.x + dd * Math.sin(c.ph) * Math.sin(c.th), c.t.y + dd * Math.cos(c.ph), c.t.z + dd * Math.sin(c.ph) * Math.cos(c.th));
  camera.lookAt(c.t); camera.updateMatrixWorld(true);
}
const ui = buildUI({ scene, camera, renderer, canvas, oud, risha, perf, audio, cam, performer: { get: () => cur && cur.g, set: setPerformer }, player: () => player });
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

let prev = performance.now();
function tick(dt, draw = true) {
  applyCam(1 - Math.pow(0.0005, dt));
  if (life) life.pre(dt);
  perf.update(dt);
  player.placeRisha(risha);
  oud.update(dt);
  if (life) life.update(dt, { active: perf.activeNotes, sinceNote: perf.sinceNote() });
  ui.frame(dt);
  if (draw && !window.__noRender) renderer.render(scene, camera); else scene.updateMatrixWorld(true);
}
// ساعة الحركة تتبع ساعة الصوت حين يعمل الصوت: فلا تتأخر الريشة عن الصوت ولو هبط معدل الإطارات على جهاز ضعيف
let prevA = null;
renderer.setAnimationLoop((now) => {
  const raw = Math.max(0, (now - prev) / 1000); prev = now;
  let dt = Math.min(0.05, raw);
  // على الإطارات البطيئة: الزمن الفعلي المنقضي (بحد 0.25 ث) وليس 0.05 — ويُفضَّل زمن ساعة الصوت إن اتفق مع الزمن الفعلي
  if (raw > 0.05) dt = Math.min(0.25, raw);
  if (audio.ctx && audio.ctx.state === 'running') { const a = audio.ctx.currentTime; if (prevA != null && Math.abs((a - prevA) - raw) < 0.03) dt = Math.max(0, Math.min(0.25, a - prevA)); prevA = a; } else prevA = null;
  if (!window.__paused) tick(dt);
});

window.oudViewer = {
  THREE, scene, camera, renderer, oud, risha, cam, get life() { return life; }, get rig() { return rig; }, get player() { return player; }, get performer() { return cur && cur.g; }, setPerformer,
  look(th, ph, d, t) { Object.assign(cam.goal, { th, ph, d }); if (t) cam.goal.t.set(...t); applyCam(1); },
  tick, perf, audio, ui, qa: () => player.report(), pen: () => player.penetration(),
  ready: true,
};
