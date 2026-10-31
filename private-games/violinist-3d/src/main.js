// =====================================================================
//  عارض عازفة الكمان — تجميع المشهد، الكاميرا المدارية (ماوس/لوحة مفاتيح/لمس)،
//  زوايا العرض، نقاط التركيز، تشغيل/إيقاف محاكاة العزف.
//  منطق الكاميرا والواجهة منقول من النسخة الأصلية دون تغيير في السلوك.
// =====================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { V, F } from './engine/math.js';
import { LegacyBuilder, setFrame } from './engine/three-adapter.js';
import { texWoodGrain, texRug } from './engine/textures.js';
import { VN, buildViolin } from './instruments/violin.js';
import { buildBow } from './instruments/bow.js';
import { buildVSetting } from './scene/setting.js';
import { Rig } from './character/rig.js';
import { applyOutfit } from './character/outfit.js';
import { applyMaterials } from './character/materials.js';
import { Violinist, defaultViolinFrame } from './character/violinist.js';
import { Face } from './character/face.js';
import { CONFIG } from './config.js';
import { POINTS_TEXT } from './ui/texts.js';
import { ViolinSynth } from './audio/violin-synth.js';
import { EXERCISES, SCALE_LIST, FINGER_LABEL, STRINGS, L_STRING, buildTimeline, stateAt, gapSeconds } from './teaching/exercise.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const canvas = $('#scene');
if (params.has('clean')) { const st = document.createElement('style'); st.textContent = 'body > *:not(canvas):not(script){display:none !important}'; document.head.appendChild(st); }

function fail(msg) {
  $('#loading').classList.add('hidden');
  $('#nogl-msg').innerHTML = msg;
  $('#nogl').classList.remove('hidden');
}

// ---------- المُصيِّر والمشهد والإضاءة ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  fail('تعذّر تشغيل العرض ثلاثي الأبعاد على هذا الجهاز.<br>يحتاج العارض إلى متصفح حديث يدعم WebGL 2 (مثل Chrome أو Edge أو Firefox أو Safari الحديث).');
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;

const keyDir = new THREE.Vector3(0.55, 1.25, 0.95).normalize();
const key = new THREE.DirectionalLight(0xfff1e2, 2.6);
const lc = new THREE.Vector3(0, 0.7, 0.15);
key.position.copy(lc).addScaledVector(keyDir, 3); key.target.position.copy(lc);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -1.15, right: 1.15, bottom: -1.0, top: 1.0, near: 0.1, far: 6 });
key.shadow.bias = -0.0009; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0xc8d2e6, 0.55); fill.position.set(-0.9, 0.45, 0.35).multiplyScalar(3); scene.add(fill);
const rim = new THREE.DirectionalLight(0xfff4ea, 0.95); rim.position.set(-0.3, 0.6, -1.0).multiplyScalar(3); scene.add(rim);
scene.add(new THREE.HemisphereLight(0x5c6170, 0x33281f, 0.9));

const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 30);
const R = new LegacyBuilder(scene, renderer);

// ---------- تحميل العازفة ----------
const progressEl = $('#loading-pct');
let usedModel = null, outfitInfo = null;
async function loadPlayer() {
  const onProgress = (e) => { if (e.lengthComputable && progressEl) progressEl.textContent = ` ${Math.round(e.loaded / e.total * 100)}%`; };
  
  const loadOne = async (url) => {
    if (/\.fbx(\?|$)/i.test(url)) {
      // ملف FBX يشير إلى صور قوام (png) غير موجودة بجانبه فتعطي 404. نستبدلها بصورة شفافة 1×1 (ونصنع المواد برمجيًا في materials.js).
      const manager = new THREE.LoadingManager();
      const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      manager.setURLModifier((u) => (/\.(png|jpe?g|tga|bmp|gif|tif)(\?|$)/i.test(u) ? PX : u));
      const obj = await new FBXLoader(manager).loadAsync(url, onProgress); return { scene: obj };
    }
    const draco = new DRACOLoader().setDecoderPath('./vendor/three/addons/libs/draco/gltf/').setDecoderConfig({ type: 'wasm' });
    return new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder).loadAsync(url, onProgress);
  };
  
  // خادم المشروع (tools/dev-server.mjs) يقدّم الملفات من جذر المشروع، لذلك المسار يبدأ بـ public/
  const candidates = [CONFIG.modelUrl];
  
  let gltf = null, lastErr = null;
  for (const u of candidates) { 
    try { gltf = await loadOne(u); usedModel = u; break; } catch (e) { lastErr = e; } 
  }
  
  // إذا فشل التحميل هنا، سيظهر الخطأ الفعلي لملف fbx وليس للنموذج الاحتياطي
  if (!gltf) {
    console.error("فشل تحميل ملف Violinist.fbx، تأكد أن الخادم يعمل وأنه لا توجد مشكلة في الملف نفسه.", lastErr);
    throw lastErr;
  }
  
  // ملف FBX المُصدَّر من Blender/MakeHuman يحمل معه مصابيح وكاميرات (PointLight شدته 1000 مع ظلال) فتُبيّض المشهد كله.
  // نحذفها ونعتمد إضاءة المشهد وحدها.
  const strays = []; gltf.scene.traverse((o) => { if (o.isLight || o.isCamera) strays.push(o); });
  strays.forEach((o) => o.parent && o.parent.remove(o));
  // الزي العماني واللحاف ومواد الجلد/العينين تُبنى قبل Rig حتى تدخل كلها في قياسات الجسم الفعلية
  outfitInfo = applyOutfit(gltf.scene, CONFIG);
  applyMaterials(gltf.scene, CONFIG);
  const rig = new Rig(gltf.scene, CONFIG);
  if (rig.missing.length) throw Object.assign(new Error('missing-bones'), { missing: rig.missing });
  
  const player = new Violinist(rig, CONFIG, { renderer });
  scene.add(gltf.scene);
  const pose0 = player.setup();
  
  gltf.scene.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
  });
  return { player, pose0, rig };
}

let face = null;
let player = null, pose0, rigInfo = null, loadError = null;
try {
  const r = await loadPlayer();
  player = r.player; pose0 = r.pose0; rigInfo = r.rig;
} catch (err) {
  console.warn('[violinist] ', err);
  loadError = err;
  pose0 = { violin: defaultViolinFrame(), bow: null };
}

// ---------- الكمان والقوس والكرسي ----------
const tex = {
  rug: R.texture(texRug()),
  wood: R.texture(texWoodGrain('#6e4529', '#2a160a', 3), true),
};
buildViolin(R, pose0.violin, { srK: pose0.srK ?? 1 });
const bow = buildBow(R);
buildVSetting(R, tex);
const placeBow = (frame) => { for (const k in bow) setFrame(bow[k], frame); };
if (pose0.bow) placeBow(pose0.bow); else for (const k in bow) bow[k].visible = false;

// رسالة إن لم يُعثر على النموذج (يبقى الكمان والمشهد قابلين للاستكشاف)
if (loadError) {
  const box = $('#model-msg');
  const missing = loadError.missing ? `<br>العظام غير المتعرَّف عليها: <code dir="ltr">${loadError.missing.join(', ')}</code><br>أضيفي أسماءها في <code>src/config.js</code> ← <code>boneMap</code>.` : '';
  box.innerHTML = `<b>لم يُحمَّل نموذج العازفة.</b> ضع ملف النموذج في <code dir="ltr">${CONFIG.modelUrl}</code> (أو violinist.fbx) ثم حدّث الصفحة. التفاصيل في README.md و docs/MODEL_SPEC.md.${missing}`;
  box.classList.remove('hidden');
  $('#play').disabled = true;
}

if (!loadError && usedModel && usedModel === CONFIG.fallbackModelUrl) {
  // الجسم المؤقت ملوّن (بنفسجي/أصفر): نعطيه لون بشرة قمحيًا
  const garments = new Set(player.outfit ? player.outfit.meshes : []);
  for (const m of player.rig.meshes) if (!garments.has(m)) {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    m.material = mats.map((mt) => new THREE.MeshPhysicalMaterial({ color: 0xb98466, roughness: 0.55, sheen: 0.25, sheenColor: new THREE.Color(0xffd9c0) }));
    if (m.material.length === 1) m.material = m.material[0];
  }
  const box = $('#model-msg');
  box.innerHTML = 'هذا <b>جسم مؤقت بلا ملامح وجه</b> يلبس الزي العماني. ضع نموذجك (violinist.fbx من MakeHuman أو violinist.glb) في <code dir="ltr">public/models/</code> ثم حدّث الصفحة.';
  box.classList.remove('hidden'); box.style.background = 'rgba(28,23,20,.9)'; box.style.borderColor = 'var(--line-strong)';
  box.addEventListener('click', () => box.classList.add('hidden'));
}

// ---------- نقاط مرجعية للكاميرا ----------
const vf = pose0.violin;
const Vw = (p) => F.pt(vf, p);
const lm = player ? player.landmarks() : {
  head: [0, 1.31, 0.03], chest: [0, 0.95, 0.02], hips: [0, 0.6, 0.05], kneeL: [0.12, 0.5, 0.45], kneeR: [-0.12, 0.5, 0.45],
  handR: Vw([0.15, 0.0, 0.05]), handL: Vw([0.03, 0.29, 0.04]),
};
const chinPt = Vw([-0.03, -0.12, 0.03]);
const contactPt = Vw(VN.stringAt(2, 0.028));
const violinCenter = Vw([0, 0.06, 0.0]);
const headC = lm.head;
const blockers = [
  [V.add(headC, [0, 0.06, 0.02]), 0.15], [[0, 0.95, 0.02], 0.2], [[0, 0.74, 0.02], 0.19], [[0, 0.53, 0.05], 0.2],
  [Vw([0, -0.08, -0.015]), 0.095], [Vw([0, 0.09, -0.015]), 0.075],
  [lm.kneeR, 0.1], [lm.kneeL, 0.1],
];

// ---------- الكاميرا المدارية (منقولة من الأصل) ----------
const DEF = { target: [0.04, 0.84, 0.16], theta: 0.42, phi: 1.38, r: 2.7 };
const cam = { fov: 0.62, pos: [0, 1, 3], target: DEF.target.slice(), shiftX: 0, shiftY: 0 };
const cur = { target: DEF.target.slice(), theta: DEF.theta, phi: DEF.phi, r: DEF.r };
const goal = { target: DEF.target.slice(), theta: DEF.theta, phi: DEF.phi, r: DEF.r };
let follow = 14;
const LIM = { rMin: 0.2, rMax: 5.5, phiMin: 0.1, phiMax: 1.95 };
let zoomScale = 1, pickPt = null;
let needsRender = true;

function clampGoal() {
  goal.r = Math.min(LIM.rMax, Math.max(LIM.rMin, goal.r));
  goal.phi = Math.min(LIM.phiMax, Math.max(LIM.phiMin, goal.phi));
  goal.target[0] = Math.min(1.0, Math.max(-1.0, goal.target[0]));
  goal.target[1] = Math.min(1.6, Math.max(0.05, goal.target[1]));
  goal.target[2] = Math.min(1.0, Math.max(-0.8, goal.target[2]));
  const minY = 0.06, rr = goal.r * zoomScale, y = goal.target[1] + rr * Math.cos(goal.phi);
  if (y < minY) goal.phi = Math.acos(Math.max(-1, Math.min(1, (minY - goal.target[1]) / rr)));
}
function camPos(s) {
  const sp = Math.sin(s.phi), r = s.r * zoomScale;
  return [s.target[0] + r * sp * Math.sin(s.theta), s.target[1] + r * Math.cos(s.phi), s.target[2] + r * sp * Math.cos(s.theta)];
}
function resolveCollisions(p) {
  for (let it = 0; it < 3; it++) for (const [c, rad] of blockers) {
    const d = V.sub(p, c), l = V.len(d);
    if (l < rad) p = V.madd(c, V.norm(d), rad);
  }
  if (p[1] < 0.04) p[1] = 0.04;
  return p;
}
function wrapTo(a, ref) { while (a - ref > Math.PI) a -= Math.PI * 2; while (a - ref < -Math.PI) a += Math.PI * 2; return a; }
function goTo(v, rate = 4.2) {
  pickPt = null;
  goal.target = v.target.slice(); goal.theta = wrapTo(v.theta, cur.theta); goal.phi = v.phi; goal.r = v.r;
  clampGoal(); follow = rate; needsRender = true;
}

// ---------- زوايا العرض ونقاط التركيز ----------
const VIEWS = {
  front: { target: [0.03, 0.84, 0.15], theta: 0, phi: 1.45, r: 2.6 },
  back: { target: [0.03, 0.84, 0.1], theta: Math.PI, phi: 1.45, r: 2.6 },
  right: { target: [0.03, 0.84, 0.14], theta: -Math.PI / 2, phi: 1.45, r: 2.6 },
  left: { target: [0.03, 0.84, 0.14], theta: Math.PI / 2, phi: 1.45, r: 2.6 },
  top: { target: [0.05, 0.72, 0.18], theta: 0.2, phi: 0.12, r: 2.5 },
  low: { target: [0.06, 0.98, 0.2], theta: 0.35, phi: 1.86, r: 2.1 },
  full: { target: [0.02, 0.72, 0.15], theta: 0.35, phi: 1.38, r: 3.3 },
  hands: { target: V.lerp(lm.handR, lm.handL, 0.5), theta: 0.15, phi: 1.2, r: 1.0 },
  reset: DEF,
};
const POINT_VIEWS = {
  sit: { view: { target: [0.02, 0.76, 0.12], theta: -1.22, phi: 1.45, r: 2.7 }, play: false },
  chin: { view: { target: V.lerp(chinPt, headC, 0.25), theta: 0.55, phi: 1.3, r: 0.85 }, play: false },
  lhand: { view: { target: lm.handL, theta: 0.8, phi: 1.0, r: 0.55 }, play: false },
  bowhold: { view: { target: lm.handR, theta: -0.55, phi: 1.12, r: 0.42 }, play: false },
  contact: { view: { target: contactPt, theta: -0.15, phi: 0.95, r: 0.6 }, play: true },
  details: { view: { target: violinCenter, theta: 0.38, phi: 0.92, r: 0.95 }, play: false },
};
const POINTS = {};
for (const k in POINT_VIEWS) POINTS[k] = { ...POINT_VIEWS[k], ...POINTS_TEXT[k] };

// ---------- التحريك والتمرين والصوت ----------
// مصدر بيانات واحد (teaching/exercise.js): الجدول الزمني يعطي لكل لحظة الوتر والإصبع وموضع القوس وضغط الأصابع،
// ونفس الحدث هو الذي يُرسل التردد إلى مولّد الصوت؛ فلا يوجد مسار صوت منفصل عن حركة العازفة.
const synth = new ViolinSynth();
let playing = false, paused = false, tAnim = 0;
let exIndex = 0, tl = buildTimeline(EXERCISES[0]), bpm = EXERCISES[0].bpm, beat = 0, schedNext = 0, loopOn = true, lastShownIdx = -2;
const playBtn = $('#play');
const modeEl = $('#mode');
let lastState = null;

function applyPose(t, p) {            // وضعية ثابتة أو المحاكاة التوضيحية القديمة (تُستخدم حين لا يوجد تمرين نشط)
  if (!player) return;
  const pose = player.pose(t, p);
  placeBow(pose.bow);
}
function applyTeach(st) {
  if (!player) return;
  const pose = player.poseState({ u: st.u, sBow: st.sBow, sFinger: st.sFinger, press: st.press, fy: st.fy });
  placeBow(pose.bow);
  lastState = st;
}
const stripEl = $('#strip');
function buildStrip() {
  stripEl.innerHTML = '';
  tl.events.forEach((e, i) => { const el = document.createElement('i'); el.textContent = e.note.en.replace('♯', '#').replace(/\d/, ''); el.title = `${e.note.ar} — وتر ${STRINGS[e.string].ar} — ${FINGER_LABEL[e.finger]}`; el.dataset.i = i; stripEl.appendChild(el); });
}
function showNow(st) {
  const nowEl = $('#now');
  if (!st) { nowEl.classList.add('silent'); $('#now-note').firstChild.nodeValue = '—'; $('#now-ar').textContent = 'لم يبدأ'; $('#now-string').textContent = $('#now-finger').textContent = $('#now-pos').textContent = $('#now-bow').textContent = $('#now-hz').textContent = '—'; $('#now-ex').textContent = EXERCISES[exIndex].title; return; }
  const e = st.event;
  nowEl.classList.toggle('silent', !st.sounding);
  $('#now-note').firstChild.nodeValue = e.note.en.replace('♯', '#');
  $('#now-ar').textContent = e.note.ar;
  $('#now-string').textContent = `${STRINGS[e.string].ar} (${STRINGS[e.string].name})`;
  $('#now-finger').innerHTML = FINGER_LABEL[e.finger] + (e.fnote ? ` <small class="fn">— ${e.fnote}</small>` : '');
  $('#now-pos').textContent = e.finger === 0 ? 'وتر مفتوح (لا عفق)' : `${((L_STRING - e.y) * 100).toFixed(1)} سم من العتبة`;
  $('#now-ex').innerHTML = `<b>${EXERCISES[exIndex].title}</b> · نغمة ${e.k + 1} من ${tl.events.length}`;
  $('#now-bow').textContent = e.bow === 'down' ? 'نزول ⬇ (من الكعب إلى الرأس)' : 'صعود ⬆ (من الرأس إلى الكعب)';
  $('#now-hz').textContent = e.hz.toFixed(1);
  if (lastShownIdx !== st.index) {
    lastShownIdx = st.index;
    stripEl.querySelectorAll('i').forEach((el, i) => { el.classList.toggle('on', i === st.index); el.classList.toggle('done', i < st.index); });
  }
}
// ساعة التمرين مربوطة بساعة الصوت (AudioContext.currentTime) متى كان الصوت يعمل، وإلا بساعة المتصفح.
// beat = نبضة الارتكاز + الزمن المنقضي × السرعة. النغمات تُجدول بزمن صوتي دقيق من نفس المرتكز،
// فلا يتباعد الصوت عن حركة القوس والأصابع حتى لو تباطأ الرسم.
let anchor = { t: 0, b: 0, src: 'p' };
const nowSec = () => (synth.ready ? synth.ctx.currentTime : performance.now() / 1000);
const srcNow = () => (synth.ready ? 'a' : 'p');
function reanchor() { anchor = { t: nowSec(), b: beat, src: srcNow() }; }
function scheduleAudio() {            // جدولة قبل الموعد بـ 0.4 ث (تحتمل توقفًا قصيرًا للمعالج دون فجوات)
  if (!synth.ready || anchor.src !== 'a') return;
  const sec = 60 / bpm, look = beat + 0.4 / sec;
  while (schedNext < tl.events.length && tl.events[schedNext].b0 < look) {
    const e = tl.events[schedNext++];
    const when = anchor.t + (e.b0 - anchor.b) * sec;
    const dur = Math.max(0.08, e.beats * sec - Math.min(e.beats * sec * 0.4, gapSeconds(bpm)));
    synth.playNote({ hz: e.hz, when, dur, dir: e.bow });
  }
}
function stopSound() { synth.stopAll(); }
// معايرة مسبقة: كل تركيبة (وتر × أصابع مضغوطة) تُحَلّ مرة بتكرارات أكثر قبل التشغيل، حتى لا يحدث توقف أثناء العزف
const warmed = new Set();
function warmUp(tlx) {
  if (!player) return;
  for (const e of tlx.events) {
    const st = stateAt(tlx, e.b0 + e.beats * 0.4, 60);
    const key = `${e.string}:${st.press.join('')}:${st.fy.map((v) => Math.round(v * 1e4)).join(',')}`;
    if (warmed.has(key)) continue; warmed.add(key);
    player.poseState({ u: st.u, sBow: st.sBow, sFinger: e.string, press: st.press, fy: st.fy });
  }
}
// ---------- التدريب بنفسي: الانتقال نغمة نغمة ----------
let manual = false, manualIdx = 0, manualAnim = null;
function manualGo(i, sound = true) {
  if (!player || !tl.events.length) return;
  manualIdx = Math.max(0, Math.min(tl.events.length - 1, i));
  const e = tl.events[manualIdx], sec = 60 / bpm;
  const st = stateAt(tl, e.b0 + e.beats * 0.4, bpm); st.sounding = true;
  applyTeach(st); showNow(st); needsRender = true;
  manualAnim = null;
  if (sound) {
    synth.unlock(); synth.stopAll();
    const dur = Math.max(0.9, e.beats * sec);
    if (synth.ctx) synth.playNote({ hz: e.hz, when: synth.ctx.currentTime + 0.03, dur, dir: e.bow });
    manualAnim = { t0: performance.now(), dur, e };                // حركة القوس على طول النغمة نفسها ثم يثبت
  }
  $('#step-prev').disabled = manualIdx === 0; $('#step-next').disabled = manualIdx === tl.events.length - 1;
}
function setExercise(i) {
  exIndex = Math.max(0, Math.min(EXERCISES.length - 1, i));
  tl = buildTimeline(EXERCISES[exIndex]); bpm = EXERCISES[exIndex].bpm; warmUp(tl);
  $('#tempo').value = bpm; $('#tempo-out').textContent = bpm; $('#ex-select').value = String(exIndex);
  buildStrip(); lastShownIdx = -2; manualAnim = null;
  syncPickers();
  restartFrom(0, playing);
  if (manual) manualGo(0, false);
}
// اختيار السلم والاتجاه: يُترجم إلى فهرس تمرين واحد في EXERCISES (المصدر الوحيد للنغمات)
function syncPickers() {
  const ex = EXERCISES[exIndex];
  $('#scale-select').value = ex.scale || 'other';
  $('#dirs').classList.toggle('hidden', !ex.scale);
  $('#ex-select').classList.toggle('hidden', !!ex.scale);
  document.querySelectorAll('[data-dir]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dir === ex.dir)));
}
function pickScaleDir(scale, dir) {
  const i = EXERCISES.findIndex((e) => scale === 'other' ? e.group === 'other' : (e.scale === scale && e.dir === dir));
  if (i >= 0) setExercise(i);
}
function setTrainMode(m) {
  document.querySelectorAll('[data-tmode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tmode === m)));
  $('#stepper').classList.toggle('hidden', m !== 'step');
  stripEl.classList.toggle('pick', m === 'step');
  if (m === 'step') { if (playing || paused) setPlaying(false); manual = true; manualGo(manualIdx < tl.events.length ? manualIdx : 0, false); }
  else { const was = manual; manual = false; manualAnim = null; loopOn = m === 'watch'; $('#loop').checked = loopOn; if (was) { stopSound(); setPlaying(false); } }
}
function restartFrom(b, andPlay) {
  stopSound(); beat = b; schedNext = tl.events.findIndex((e) => e.b0 >= b - 1e-6); if (schedNext < 0) schedNext = tl.events.length;
  tAnim = 0; lastShownIdx = -2;
  if (andPlay) { playing = true; paused = false; }
  reanchor();
  syncButtons();
  if (playing || paused) { const st = stateAt(tl, beat, bpm); applyTeach(st); showNow(st); } else applyPose(0, false);
  needsRender = true;
}
function syncButtons() {
  const on = playing && !paused;
  playBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  const narrow = window.innerWidth <= 760;
  playBtn.querySelector('.lbl').textContent = on ? 'إيقاف مؤقت' : (paused ? 'متابعة' : 'تشغيل التمرين');
  playBtn.querySelector('.ico').textContent = on ? '❚❚' : '▶';
  modeEl.textContent = on ? 'تمرين قيد العزف' : (paused ? 'متوقف مؤقتًا' : 'وضعية العزف الثابتة');
}
// تشغيل/إيقاف: start | pause | stop (يعود للوضعية الثابتة)
function setPlaying(p) {
  if (!player) p = false;
  if (p && manual) setTrainMode('watch');
  if (p) { synth.unlock(); playing = true; paused = false; if (beat >= tl.totalBeats) restartFrom(0, true); reanchor(); }
  else { playing = false; paused = false; stopSound(); beat = 0; schedNext = 0; lastShownIdx = -2; applyPose(0, false); showNow(null); stripEl.querySelectorAll('i').forEach((el) => el.classList.remove('on', 'done')); lastState = null; }
  syncButtons(); needsRender = true;
}
function pauseToggle() {
  if (!player) return;
  if (!playing) { setPlaying(true); return; }
  paused = !paused;
  if (paused) stopSound(); else { synth.unlock(); schedNext = tl.events.findIndex((e) => e.b0 >= beat - 1e-6); if (schedNext < 0) schedNext = tl.events.length; reanchor(); }
  syncButtons();
}
playBtn.addEventListener('click', () => { if (manual) setTrainMode('watch'); pauseToggle(); });
{
  const sel = $('#ex-select'), ssel = $('#scale-select');
  EXERCISES.forEach((e, i) => { if (e.group !== 'other') return; const o = document.createElement('option'); o.value = String(i); o.textContent = e.title; sel.appendChild(o); });
  sel.addEventListener('change', () => setExercise(+sel.value));
  SCALE_LIST.forEach((sc) => { const o = document.createElement('option'); o.value = sc.id; o.textContent = sc.title; ssel.appendChild(o); });
  { const o = document.createElement('option'); o.value = 'other'; o.textContent = 'تمارين أخرى (أوتار مفتوحة ولحن)'; ssel.appendChild(o); }
  ssel.addEventListener('change', () => pickScaleDir(ssel.value, (EXERCISES[exIndex].dir) || 'up'));
  document.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => pickScaleDir(ssel.value, b.dataset.dir)));
  document.querySelectorAll('[data-tmode]').forEach((b) => b.addEventListener('click', () => setTrainMode(b.dataset.tmode)));
  $('#step-prev').addEventListener('click', () => manualGo(manualIdx - 1));
  $('#step-next').addEventListener('click', () => manualGo(manualIdx + 1));
  $('#step-listen').addEventListener('click', () => manualGo(manualIdx));
  $('#stop-bar').addEventListener('click', () => { if (manual) setTrainMode('watch'); else setPlaying(false); });
  stripEl.addEventListener('click', (ev) => { const t = ev.target.closest('i'); if (manual && t) manualGo(+t.dataset.i); });
  $('#tempo').addEventListener('input', (ev) => { advanceClock(); reanchor(); bpm = +ev.target.value; $('#tempo-out').textContent = bpm; });
  $('#restart').addEventListener('click', () => { synth.unlock(); restartFrom(0, true); });
  $('#stop').addEventListener('click', () => setPlaying(false));
  $('#loop').addEventListener('change', (ev) => { loopOn = ev.target.checked; });
  $('#mute').addEventListener('click', (ev) => { const m = ev.currentTarget.getAttribute('aria-pressed') !== 'true'; ev.currentTarget.setAttribute('aria-pressed', String(m)); ev.currentTarget.textContent = m ? '🔇 الصوت مكتوم' : '🔊 الصوت يعمل'; synth.unlock(); synth.setMuted(m); });
  $('#teach-toggle').addEventListener('click', () => { const t = $('#teach'), min = t.classList.toggle('min'); $('#teach-toggle').setAttribute('aria-expanded', String(!min)); $('#teach-toggle').textContent = min ? '▾' : '▴'; });
  if (window.innerWidth <= 760 || window.innerHeight < 760) { $('#teach').classList.add('min'); $('#teach-toggle').textContent = '▾'; $('#teach-toggle').setAttribute('aria-expanded', 'false'); }
  buildStrip(); syncPickers();
}


// تُقدَّم الساعة من مؤقّت كل 20 مللي ثانية ومن كل إطار (مستقلة عن سرعة الرسم).
function advanceClock() {
  if (!playing || paused) return;
  if (anchor.src !== srcNow()) reanchor();
  beat = anchor.b + (nowSec() - anchor.t) * bpm / 60;
  if (beat >= tl.totalBeats) {
    if (loopOn) { anchor = { t: anchor.t + (tl.totalBeats - anchor.b) * 60 / bpm, b: 0, src: anchor.src }; beat = (nowSec() - anchor.t) * bpm / 60; schedNext = 0; lastShownIdx = -2; }
    else { beat = tl.totalBeats - 1e-4; playing = false; paused = false; stopSound(); syncButtons(); modeEl.textContent = 'انتهى التمرين'; return; }
  }
  scheduleAudio();
}
setInterval(advanceClock, 20);

// ---------- ربط الواجهة ----------
const info = $('#info');
function showPoint(k) {
  const p = POINTS[k];
  document.querySelectorAll('[data-point]').forEach(b => b.setAttribute('aria-pressed', b.dataset.point === k ? 'true' : 'false'));
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  $('#info-title').textContent = p.title;
  $('#info-text').textContent = p.text;
  const n = $('#info-note'); n.textContent = p.note || ''; n.classList.toggle('hidden', !p.note);
  info.classList.remove('hidden'); document.body.classList.add('has-info');
  if (window.innerHeight < 760) { $('#teach').classList.add('min'); $('#teach-toggle').textContent = '▾'; $('#teach-toggle').setAttribute('aria-expanded', 'false'); }
  updateShift();
  if (p.play && !playing) setPlaying(true);           // «القوس على الأوتار» يشغّل التمرين؛ بقية النقاط لا توقف تمرينًا جاريًا
  goTo(p.view, 3.6);
}
function showView(k) {
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === k && k !== 'reset' ? 'true' : 'false'));
  document.querySelectorAll('[data-point]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  if (!info.classList.contains('hidden')) { info.classList.add('hidden'); document.body.classList.remove('has-info'); updateShift(); }
  goTo(VIEWS[k]);
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
document.querySelectorAll('[data-point]').forEach(b => b.addEventListener('click', () => showPoint(b.dataset.point)));
$('#info-close').addEventListener('click', () => { info.classList.add('hidden'); document.body.classList.remove('has-info'); updateShift(); document.querySelectorAll('[data-point]').forEach(b => b.setAttribute('aria-pressed', 'false')); });
// ---------- وضع العرض / وضع التعلّم + طيّ لوحة الأدوات ----------
let viewMode = false;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* التخزين غير متاح: لا بأس */ } } };
function setViewMode(on, save = true) {
  viewMode = !!on;
  document.body.classList.toggle('mode-view', viewMode);
  const b = $('#mode-toggle'); b.setAttribute('aria-pressed', String(viewMode));
  b.querySelector('.lbl').textContent = viewMode ? 'وضع التعلّم' : 'وضع العرض';
  b.title = viewMode ? 'وضع التعلّم: إظهار اللوحات والإرشادات' : 'وضع العرض: إخفاء اللوحات لإظهار العازفة والكمان بأكبر مساحة';
  if (viewMode) { info.classList.add('hidden'); document.body.classList.remove('has-info'); document.querySelectorAll('[data-point]').forEach((x) => x.setAttribute('aria-pressed', 'false')); }
  if (save) store.set('mt-viewmode', viewMode ? '1' : '0');
  updateShift(); needsRender = true;
}
$('#mode-toggle').addEventListener('click', () => setViewMode(!viewMode));
function setPanelMin(min, save = true) {
  const p = $('#panel'); p.classList.toggle('min', min);
  const t = $('#panel-toggle'); t.setAttribute('aria-expanded', String(!min)); t.textContent = min ? '▾' : '▴';
  if (save) store.set('mt-panelmin', min ? '1' : '0');
  updateShift();
}
$('#panel-toggle').addEventListener('click', () => setPanelMin(!$('#panel').classList.contains('min')));
$('#reset-view').addEventListener('click', () => showView('reset'));
if (!params.has('clean')) { if (store.get('mt-panelmin') === '1') setPanelMin(true, false); if (store.get('mt-viewmode') === '1') setViewMode(true, false); }

// ---------- ملء الشاشة (Fullscreen API؛ لا يمكن للصفحة محاكاة F11 نفسه) ----------
const fsBtn = $('#fs-btn'), fsRoot = document.documentElement;
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const fsOk = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !!(fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen);
function fsSync() {
  const on = !!fsEl();
  fsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  const t = on ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'; fsBtn.title = t; fsBtn.setAttribute('aria-label', t);
  needsRender = true;
}
if (fsOk) {
  fsBtn.hidden = false;
  fsBtn.addEventListener('click', async () => {
    try {
      if (fsEl()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else await (fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen).call(fsRoot);
    } catch (err) { fsBtn.title = 'تعذّر ملء الشاشة في هذا المتصفح'; }
    fsSync();                                              // الحالة تُقرأ من المتصفح لا من افتراضنا
  });
  document.addEventListener('fullscreenchange', fsSync);
  document.addEventListener('webkitfullscreenchange', fsSync);
  fsSync();
}
const help = $('#help');
const toggleHelp = (show) => { help.classList.toggle('hidden', show === undefined ? !help.classList.contains('hidden') : !show); $('#help-btn').setAttribute('aria-expanded', help.classList.contains('hidden') ? 'false' : 'true'); };
$('#help-btn').addEventListener('click', () => toggleHelp());
$('#help-close').addEventListener('click', () => toggleHelp(false));
const nudge = (fn) => () => { fn(); follow = 8; clampGoal(); needsRender = true; firstInteraction(); };
$('#rot-l').addEventListener('click', nudge(() => { goal.theta -= 0.4; }));
$('#rot-r').addEventListener('click', nudge(() => { goal.theta += 0.4; }));
$('#zoom-in').addEventListener('click', nudge(() => { zoomAbout(0.78, pickPt); }));
$('#zoom-out').addEventListener('click', nudge(() => { zoomAbout(1 / 0.78, null); }));
document.querySelectorAll('[data-tab]').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === t ? 'true' : 'false'));
  $('#panel').dataset.active = t.dataset.tab;
}));

// ---------- الإدخال باللمس والماوس ----------
const pointers = new Map();
let mode = null, pinch0 = 0, mid0 = null, interacted = false;
const hint = $('#hint');
function firstInteraction() {
  if (interacted) return; interacted = true; hint.classList.add('fade');
  setTimeout(() => hint.classList.add('hidden'), 600);
}
function panBy(dx, dy) {
  const p = camPos(cur), fwd = V.norm(V.sub(cur.target, p));
  const right = V.norm(V.cross(fwd, [0, 1, 0])), up = V.cross(right, fwd);
  const k = cur.r * 0.0016;
  goal.target = V.add(goal.target, V.add(V.mul(right, -dx * k), V.mul(up, dy * k)));
}
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault(); canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  follow = 14; firstInteraction();
  if (pointers.size === 1) mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rotate';
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch0 = Math.hypot(a.x - b.x, a.y - b.y); mid0 = [(a.x + b.x) / 2, (a.y + b.y) / 2]; mode = 'pinch';
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (mode === 'rotate' && pointers.size === 1) { goal.theta -= dx * 0.0085; goal.phi -= dy * 0.0075; }
  else if (mode === 'pan' && pointers.size === 1) panBy(dx, dy);
  else if (mode === 'pinch' && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), m = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    if (pinch0 > 0 && d > 0) goal.r *= pinch0 / d;
    panBy(m[0] - mid0[0], m[1] - mid0[1]);
    pinch0 = d; mid0 = m;
  }
  clampGoal(); needsRender = true;
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size === 1) mode = 'rotate';
  if (pointers.size === 0) mode = null;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
// ---------- التكبير نحو النقطة المشار إليها ----------
// الفكرة: نُجري تكبيرًا بمقياس f حول نقطة الإصابة H على المجسم، فيصبح الهدف الجديد = H + (الهدف − H)·f ونصف القطر r·f،
// ويكون موضع الكاميرا = H + (موضعها − H)·f؛ أي تقترب الكاميرا من النقطة نفسها وتبقى النقطة في مكانها على الشاشة تقريبًا.
const raycaster = new THREE.Raycaster();
let lastPickT = 0;
function pickAt(clientX, clientY) {
  const rc = canvas.getBoundingClientRect();
  if (!rc.width) return null;
  raycaster.setFromCamera(new THREE.Vector2(((clientX - rc.left) / rc.width) * 2 - 1, -((clientY - rc.top) / rc.height) * 2 + 1), camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const h of hits) {
    const o = h.object;
    if (!o.visible || o.renderOrder >= 10 || (o.material && (o.material.depthTest === false || o.material.transparent && o.material.opacity < 0.3))) continue;
    return [h.point.x, h.point.y, h.point.z];
  }
  return null;
}
function zoomAbout(f, H) {
  const r0 = goal.r;
  goal.r = Math.min(LIM.rMax, Math.max(LIM.rMin, goal.r * f));
  const fe = goal.r / r0;                                   // المقياس الفعلي بعد حدود التقريب
  if (H && fe !== 1) goal.target = V.add(H, V.mul(V.sub(goal.target, H), fe));
  clampGoal(); needsRender = true;
}
canvas.addEventListener('wheel', (e) => {
  e.preventDefault(); firstInteraction(); follow = 14;
  const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
  const f = Math.exp(dy * 0.0011);
  const now = performance.now();
  if (f < 1 && now - lastPickT > 90) { lastPickT = now; const h = pickAt(e.clientX, e.clientY); if (h) pickPt = h; }   // التقريب فقط يتمركز على الماوس
  zoomAbout(f, f < 1 ? pickPt : null);
}, { passive: false });
// نقرة قصيرة (بلا سحب) على المجسم تحدد نقطة التكبير لأزرار +/−؛ ونقرة مزدوجة تقرّب إليها مباشرة
let downAt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5 || performance.now() - downAt.t > 450) return;
  pickPt = pickAt(e.clientX, e.clientY);
});
canvas.addEventListener('dblclick', (e) => {
  const h = pickAt(e.clientX, e.clientY); if (!h) return;
  pickPt = h; firstInteraction(); follow = 6; zoomAbout(0.5, h);
});

const typing = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
  let handled = true;
  switch (true) {
    case e.key === 'ArrowLeft': goal.theta -= 0.09; break;
    case e.key === 'ArrowRight': goal.theta += 0.09; break;
    case e.key === 'ArrowUp': goal.phi -= 0.07; break;
    case e.key === 'ArrowDown': goal.phi += 0.07; break;
    case e.key === '+' || e.key === '=' || e.code === 'NumpadAdd': zoomAbout(0.88, pickPt); break;
    case e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.code === 'Minus': goal.r /= 0.88; break;
    case e.code === 'KeyR': showView('reset'); break;
    case e.code === 'KeyV': setViewMode(!viewMode); break;
    case e.key === 'Escape': toggleHelp(false); handled = false; break;
    default: handled = false;
  }
  if (handled) { e.preventDefault(); follow = 10; firstInteraction(); clampGoal(); needsRender = true; }
});

// ---------- العرض ----------
function render() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const c = renderer.domElement;
  const dpr = renderer.getPixelRatio();
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) renderer.setSize(W, H, false);
  camera.fov = cam.fov * 180 / Math.PI;
  camera.aspect = W / H;
  camera.position.set(...cam.pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(...cam.target);
  camera.updateProjectionMatrix();
  camera.projectionMatrix.elements[8] = -cam.shiftX;
  camera.projectionMatrix.elements[9] = -cam.shiftY;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  renderer.render(scene, camera);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const k = 1 - Math.exp(-dt * follow);
  let moving = false;
  for (const key of ['theta', 'phi', 'r']) {
    const d = goal[key] - cur[key];
    if (Math.abs(d) > 1e-5) { cur[key] += d * k; moving = true; } else cur[key] = goal[key];
  }
  for (let i = 0; i < 3; i++) {
    const d = goal.target[i] - cur.target[i];
    if (Math.abs(d) > 1e-6) { cur.target[i] += d * k; moving = true; } else cur.target[i] = goal.target[i];
  }
  if (!moving && follow < 14) follow = 14;
  advanceClock();
  let curSt = null;
  if (playing && !paused) { curSt = stateAt(tl, beat, bpm); applyTeach(curSt); showNow(curSt); moving = true; }
  else if (manual && manualAnim) {
    const el = (performance.now() - manualAnim.t0) / 1000, f = Math.min(0.9, el / manualAnim.dur), e = manualAnim.e;
    curSt = stateAt(tl, e.b0 + f * e.beats, bpm); curSt.sounding = el < manualAnim.dur; applyTeach(curSt); showNow(curSt); moving = true;
    if (el >= manualAnim.dur) manualAnim = null;
  }
  if (face) { face.update(dt, { playing: (playing && !paused) || manual, st: curSt || ((playing || manual) ? lastState : null) }); moving = true; }
  if (moving || needsRender) {
    cam.target = cur.target.slice();
    cam.pos = resolveCollisions(camPos(cur));
    render();
    needsRender = false;
  }
  requestAnimationFrame(frame);
}
// المنطقة الحرة = الشاشة ناقص كل ما تغطيه اللوحات (يسار: المعلومات والتمرين، يمين: الأدوات، أسفل: الشريط).
// السبب الجذري للحجب: الإزاحة القديمة كانت تراعي اللوحة اليمنى فقط، فيُحسب مركز المشهد وكأن العمود الأيسر (بطاقتان بعرض ~380 بكسل) غير موجود.
const rectOf = (el) => (el && !el.classList.contains('hidden') && el.getBoundingClientRect().width) ? el.getBoundingClientRect() : null;
function updateShift() {
  if (params.has('clean')) { cam.shiftX = cam.shiftY = 0; zoomScale = 1; needsRender = true; return; }     // وضع اللقطات: بلا إزاحة للوحات
  const W = canvas.clientWidth, H = canvas.clientHeight, asp = W / H;
  const tc = $('#teach'); document.documentElement.style.setProperty('--teach-h', (tc ? tc.getBoundingClientRect().height : 0) + 'px');
  cam.fov = asp < 1 ? 0.86 : 0.62;
  let x0 = 0, x1 = W, y0 = 0, y1 = H;
  const pr = $('#panel').getBoundingClientRect(), br = document.querySelector('.bar').getBoundingClientRect();
  document.documentElement.style.setProperty('--bar-h', Math.round(br.height) + 'px');
  const prOn = pr.width > 0;                                   // اللوحة الجانبية مخفية في وضع العرض
  if (window.innerWidth > 760) {
    x1 = prOn ? pr.left - 10 : W;
    for (const el of (viewMode ? [] : [info, tc])) { const r = rectOf(el); if (r) x0 = Math.max(x0, r.right + 10); }   // بطاقة النغمة المصغّرة في وضع العرض لا تُزيح المشهد
    y1 = Math.max(H * 0.5, br.top - 8);
    zoomScale = Math.min(1.7, Math.max(1, H / (y1 - y0), 0.5 * asp / ((x1 - x0) / (y1 - y0))));
    if (viewMode) zoomScale *= 0.8;
  } else {
    zoomScale = Math.min(1.5, Math.max(1, 0.56 / asp));
    y1 = Math.min(prOn ? pr.top : H, br.top) - 6;
    const top = info.classList.contains('hidden') ? document.querySelector('.top') : info;
    const tr = top.getBoundingClientRect(); if (tr.height) y0 = tr.bottom + 6;
  }
  cam.shiftX = ((x0 + x1) / 2 - W / 2) / (W / 2);
  cam.shiftY = Math.max(-0.6, Math.min(0.6, (H / 2 - (y0 + y1) / 2) / (H / 2)));
  needsRender = true;
}
window.addEventListener('resize', updateShift);
if (window.ResizeObserver && !params.has('clean')) { const ro = new ResizeObserver(() => updateShift()); ['#teach', '#info', '#panel'].forEach(q => { const e = document.querySelector(q); if (e) ro.observe(e); }); }
updateShift();
syncButtons();

// ---------- لوحة التحقق (index.html?qa=1) ----------
function qaReport() { return player ? player.report() : { error: String(loadError && loadError.message) }; }
if (params.has('qa') && player) {
  // علامات التحقق: الفك (أحمر)، أعلى مسند الذقن (أخضر)، نقطة الكتف (أزرق)، أسفل مسند الكتف (أصفر)
  const mk = (pos, color) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color, depthTest: false })); m.position.set(...pos); m.renderOrder = 10; scene.add(m); };
  const jv = new THREE.Vector3(); player.rig.vertexWorld(player.jawVert.m, player.jawVert.i, jv);
  mk(jv.toArray(), 0xff2020); mk(F.pt(vf, [VN.chinrestTop[0], VN.chinrestTop[1], 0.0335]), 0x20ff40);
  mk(player.collar, 0x3080ff); mk(F.pt(vf, [0, -0.108, -VN.ribs - 0.027 * player.srK]), 0xffd020);
}
if (params.has('qa')) {
  const pre = $('#qa'); pre.classList.remove('hidden');
  const upd = () => { pre.textContent = JSON.stringify(qaReport(), null, 1); };
  upd(); setInterval(() => { if (playing) upd(); }, 1000);
  pre.addEventListener('click', upd);
}

warmUp(tl); if (player) applyPose(0, false);          // معايرة أصابع التمرين الأول ثم العودة للوضعية الثابتة
if (player && (!params.has('clean') || params.has('face'))) {
  try { face = new Face(player); if (!face.enabled) face = null; } catch (err) { console.warn('[face] ', err); face = null; }
}

// واجهة صغيرة للاختبار الآلي
window.violinViewer = {
  get face() { return face; },
  state: () => ({ theta: cur.theta, phi: cur.phi, r: cur.r, target: cur.target.slice(), pos: cam.pos.slice(), playing }),
  snap() { Object.assign(cur, { theta: goal.theta, phi: goal.phi, r: goal.r, target: goal.target.slice() }); needsRender = true; },
  showView, showPoint, setPlaying, goTo, qa: qaReport, setViewMode, setPanelMin, setTrainMode, manualGo,
  teach: {
    state: () => ({ playing, paused, beat, bpm, exercise: EXERCISES[exIndex].id, index: lastState ? lastState.index : null, sounding: lastState ? lastState.sounding : null, audio: synth.ctx ? synth.ctx.state : 'not-created' }),
    timeline: () => tl.events.map((e) => ({ k: e.k, string: STRINGS[e.string].name, finger: e.finger, beats: e.beats, y_mm: +(e.y * 1000).toFixed(2), hz: +e.hz.toFixed(2), note: e.note.en, bow: e.bow })),
    setExercise, restart: () => { synth.unlock(); restartFrom(0, true); }, pause: pauseToggle, stop: () => setPlaying(false), setBpm: (v) => { advanceClock(); reanchor(); bpm = v; $('#tempo').value = v; $('#tempo-out').textContent = v; },
    seek: (b) => { restartFrom(b, false); playing = false; const st = stateAt(tl, b, bpm); applyTeach(st); showNow(st); needsRender = true; return { note: st.event.note.en, string: STRINGS[st.event.string].name, finger: st.event.finger, press: st.press, sBow: st.sBow, u: st.u, sounding: st.sounding }; },
    audioLog: () => synth.log.slice(), synth,
    // فحص الاتساق: في منتصف كل نغمة نقيس من شبكة الجسم الفعلية موضع تلامس الإصبع الأعلى المضغوط ونحوّله إلى تردد ونقارنه بتردد الصوت
    verify() {
      if (!player) return null;
      const out = [];
      for (const e of tl.events) {
        const st = stateAt(tl, e.b0 + e.beats * 0.4, 60); applyTeach(st);
        if (e.finger === 0) { out.push({ k: e.k, note: e.note.en, string: STRINGS[e.string].name, finger: 0, hz: +e.hz.toFixed(2), measuredHz: null, cents: 0, open: true }); continue; }
        const c = player.fingerContact(e.finger - 1), hzM = STRINGS[e.string].hz * 0.325 / c.cy;
        out.push({ k: e.k, note: e.note.en, string: STRINGS[e.string].name, finger: e.finger, hz: +e.hz.toFixed(2), measuredHz: +hzM.toFixed(2), cents: +(1200 * Math.log2(hzM / e.hz)).toFixed(1), contactMm: +(c.cy * 1000).toFixed(2), targetMm: +(e.y * 1000).toFixed(2) });
      }
      return out;
    },
  },
  poseAt(t) { if (player) { applyPose(t, true); needsRender = true; } },
  ready: true, modelLoaded: !!player, loadError: loadError ? String(loadError.message) : null,
  bones: rigInfo ? { L: Object.keys(rigInfo.bones.L).length, R: Object.keys(rigInfo.bones.R).length, C: Object.keys(rigInfo.bones.C) } : null,
};

if (params.has('qa')) { window.violinViewer.player = player; window.violinViewer.scene = scene; window.violinViewer.camera = camera; window.violinViewer.lights = { key, fill, rim }; }       // للفحص من وحدة التحكم فقط

Object.assign(cam, { pos: camPos(cur), target: cur.target.slice() });
render();
$('#loading').classList.add('hidden');
requestAnimationFrame(frame);
setTimeout(() => { if (!interacted) { hint.classList.add('fade'); setTimeout(() => hint.classList.add('hidden'), 600); } }, 9000);

