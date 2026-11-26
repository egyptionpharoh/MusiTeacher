// =====================================================================
//  رالي النغم ثلاثي الأبعاد (Nagham Rally 3D) — MusiTeacher
//  نقطة البداية: المشهد والإضاءة والعالم، تحميل السائق/السائقة (الشخصية المشتركة للأورج ثلاثي الأبعاد)،
//  بناء المركبتين، المرآب (شاشة البداية)، لوحة المفاتيح، وحلقة الرسم.
// =====================================================================
import * as THREE from 'three';
import { World } from './world/world.js';
import { buildCar } from './vehicles/car.js';
import { buildMoto } from './vehicles/moto.js';
import { loadDriver } from './character/driver.js';
import { GameAudio } from './audio/audio.js';
import { Race } from './game/race.js';
import { FX } from './game/fx.js';
import { UI } from './ui/ui.js';
import { openSettings } from './ui/settings.js';
import { confirmBox } from './ui/dom.js';
import { RoadsideRadio } from './audio/roadside.js';
import * as CT from './data/contest.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const loadBar = $('#load-bar'), loadMsg = $('#load-msg');
const progress = (p, msg) => { loadBar.style.width = Math.round(p * 100) + '%'; if (msg) loadMsg.textContent = msg; };
function fail(m) { $('#loading').classList.add('hidden'); $('#nogl-msg').innerHTML = m; $('#nogl').classList.remove('hidden'); }

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
} catch (e) { fail('تعذّر تشغيل العرض ثلاثي الأبعاد على هذا الجهاز.<br>تحتاج اللعبة إلى متصفح حديث يدعم WebGL.'); throw e; }
const LOW = params.has('low') || (navigator.hardwareConcurrency || 8) <= 4;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1 : 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = !params.has('noshadow'); renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
const app = window.naghamRally = { scene, camera, renderer, cam: { shake: 0 }, drivers: {}, vehicles: {}, LOW };

progress(0.05, 'جارٍ بناء الحلبة…');
app.world = new World(scene, renderer, 'city');
app.audio = new GameAudio();
app.fx = new FX(scene);
app.race = new Race(app);
app.ui = new UI(app);

// ------------------------------------------------------------------ المسابقة: هوية المعلم، أو مسابقة مشاركة في الرابط
const shared = await CT.unpackFromHash(location.hash);
let uid = null;
if (!shared) { progress(0.06, 'جارٍ تجهيز مسابقاتك…'); uid = await CT.identify(); }
app.teacher = !shared && (!!uid || params.has('teacher'));
CT.setOwner(uid || 'local');
let contest = shared;
if (!contest) { contest = CT.activeContest(); if (!contest) contest = CT.demoContest(); }
app.contest = contest; app.CT = CT;
app.radio = new RoadsideRadio(app);
const S = contest.settings;
app.world.setTheme(S.theme); app.world.setFlag(S.flag !== false);

// ------------------------------------------------------------------ المركبات
app.vehicles.car = buildCar({ color: '#e63946', accent: '#ffffff', number: '7' });
app.vehicles.moto = buildMoto({ color: '#1f6feb', accent: '#ffffff', number: '21' });
for (const k in app.vehicles) { const v = app.vehicles[k]; v.root.visible = false; scene.add(v.root); }

// ------------------------------------------------------------------ السائق
async function getDriver(g, onP) {
  if (!app.drivers[g]) app.drivers[g] = await loadDriver(g, onP);
  return app.drivers[g];
}
function seat(driver, veh) {
  const r = veh.root, keepP = r.position.clone(), keepR = r.rotation.clone();
  r.position.set(0, 0, 0); r.rotation.set(0, 0, 0); r.updateMatrixWorld(true);
  driver.seatIn(veh);
  r.position.copy(keepP); r.rotation.copy(keepR); r.updateMatrixWorld(true);
  driver.updateHands(0);
}
app.setVehicle = (kind) => {
  const v = app.vehicles[kind]; if (!v) return;
  for (const k in app.vehicles) app.vehicles[k].root.visible = (k === kind);
  app.vehicle = v;
  if (app.driver) seat(app.driver, v);
};
let switching = null;
app.setDriver = async (g) => {
  if (switching) await switching;
  switching = (async () => {
    const old = app.driver;
    const d = await getDriver(g, (p) => app.ui.toast && 0);
    if (old && old !== d && old.root.parent) old.root.parent.remove(old.root);
    app.driver = d; seat(d, app.vehicle);
  })();
  await switching; switching = null;
};

try {
  const g0 = params.get('driver') === 'male' || params.get('driver') === 'female' ? params.get('driver') : S.driver;
  S.driver = g0;
  app.driver = await getDriver(g0, (p) => progress(0.1 + p * 0.6, 'جارٍ تحميل الشخصية…'));
  progress(0.8, 'تجهيز بدلة القيادة والخوذة…');
  app.setVehicle(params.get('vehicle') || S.vehicle);
} catch (e) { console.error(e); fail('تعذّر تحميل الشخصية.<br><small>' + (e.message || e) + '</small>'); throw e; }
progress(1, 'جاهز!');
$('#loading').classList.add('hidden');

// ------------------------------------------------------------------ المرآب (شاشة البداية)
const garage = { on: true, yaw: 0.6, drag: null }; app._garage = garage;
function garagePose(dt) {
  const v = app.vehicle; if (!v) return;
  v.root.position.set(0, 0, 0); v.root.rotation.set(0, Math.PI + garage.yaw, 0);
  if (!garage.drag) garage.yaw += dt * 0.18;
  v.setSteer(Math.sin(performance.now() / 1400) * 0.25); v.update(dt, 0, 0);
  app.driver.updateHands(Math.sin(performance.now() / 1400) * 0.25, Math.sin(performance.now() / 2100) * 0.4);
  const narrow = innerWidth < 860;
  const d = v.kind === 'moto' ? 4.2 : 5.6;
  camera.position.set(narrow ? 0 : 1.7, 1.9, d); camera.lookAt(narrow ? 0 : 1.25, 0.72, 0);
  camera.fov = 45; camera.updateProjectionMatrix();
  app.world.update(0.0, camera, dt);
}
const cv = $('#scene');
cv.addEventListener('pointerdown', (e) => { if (garage.on) garage.drag = { x: e.clientX, yaw: garage.yaw }; });
addEventListener('pointermove', (e) => { if (garage.drag) garage.yaw = garage.drag.yaw + (e.clientX - garage.drag.x) * 0.01; });
addEventListener('pointerup', () => { garage.drag = null; });

// ------------------------------------------------------------------ الجلسة: الأدوار بترتيب قائمة الأسماء
const valid = (c) => c.questions.map(CT.normalize).filter(CT.playable);
app.playableCount = (c) => valid(c).length;
/** يطبّق مسابقة على اللعبة (البيئة، العلم، المركبة، الشخصية) ويحدّث شاشة البداية */
app.useContest = (c) => {
  app.contest = c; const s = c.settings;
  if (app.world.theme !== s.theme) app.world.setTheme(s.theme);
  app.world.setFlag(s.flag !== false);
  if (app.vehicle && app.vehicle.kind !== s.vehicle) app.setVehicle(s.vehicle);
  if (app.driver && app.driver.gender !== s.driver) app.setDriver(s.driver);
  app.ui.showContest(c, { teacher: app.teacher });
  if (app.teacher) postShareState(c);
};
app.openSettings = () => { if (!app.teacher) return; openSettings(app); };
let session = null;
app.startContest = () => {
  document.querySelectorAll('.modal').forEach((m) => m.remove());
  const c = app.contest, s = c.settings;
  const pool = valid(c).map(CT.runtimeOf).filter(Boolean);
  if (!pool.length) { app.ui.toast(app.teacher ? 'لا توجد أسئلة صالحة في هذه المسابقة. أضف أسئلة من «إعدادات اللعبة للمعلم».' : 'لا توجد أسئلة في هذه المسابقة بعد.'); return; }
  const names = (c.names || []).filter(Boolean);
  const players = names.length ? names : [''];
  const per = names.length ? Math.max(1, s.perTurn | 0) : Math.min(20, pool.length);
  // لكل متسابق أسئلة مختلفة بالترتيب الذي وضعه المعلم (وتتكرر من البداية إن لم تكفِ)
  const sets = players.map((_, k) => Array.from({ length: per }, (_, j) => pool[(k * per + j) % pool.length]));
  session = { c, players, sets, turn: 0, results: [] };
  app.audio.ensure(); app.audio.preloadSfx();
  app.radio.setOptions(s.radio, s.radioVol); app.radio.load();
  garage.on = false; app.ui.showStart(false);
  app.race.camMode = s.camera === 'pov' ? 'pov' : 'chase';
  playTurn();
};
function playTurn() {
  const s = session.c.settings, k = session.turn;
  const set = session.sets[k];
  if (set[0] && set[0].audio) app.audio.preload(set[0].audio);
  app.race.start({ ...s, level: s.level || 1 }, set, session.players[k] || '');
}
app.onTurnEnd = (res) => {
  if (!session) return;
  res.name = session.players[session.turn] || 'متسابق';
  session.results.push(res);
  session.turn++;
  if (session.turn < session.players.length) {
    if (app.vehicle.setPlate && session.c.settings.plate !== false) app.vehicle.setPlate(session.players[session.turn] || '');
    app.ui.transition(res, session.players[session.turn], { index: session.turn, count: session.players.length }, () => playTurn());
  } else {
    const done = session; session = null;
    app.ui.final(done.c, done.results, { onAgain: () => app.startContest(), onMenu: () => app.toMenu() });
  }
};
app.restartTurn = () => { if (session) playTurn(); };
app.skipTurn = () => { if (!session) return; app.race.pause(false); app.race.end('skip'); };
app.toMenu = () => {
  session = null; app.race.stop(); app.ui.hud(false); app.ui.question(null); app.ui.feedback(null);
  document.querySelectorAll('.modal').forEach((m) => m.remove());
  if (app.vehicle.setPlate) app.vehicle.setPlate('');
  app.world.reset(); garage.on = true; app.ui.showStart(true); app.ui.showContest(app.contest, { teacher: app.teacher });
};
app.pause = (on) => {
  if (garage.on || !['drive', 'countdown', 'crash', 'finished', 'paused'].includes(app.race.state)) return;
  if (!!on === (app.race.state === 'paused')) return;            // لا نافذة استراحة ثانية ولا استئناف مكرر
  app.race.touch.gas = false; app.race.keys = {};
  app.race.pause(on); app.ui.pauseMenu(on);
};
app.toggleCamera = () => {
  if (app.contest.settings.allowCamera === false) return;
  app.race.setCam(app.race.camMode === 'pov' ? 'chase' : 'pov');
};

// ------------------------------------------------------------------ المشاركة عبر نظام المنصة (زر «مشاركة اللعبة مع الطلاب»)
async function postShareState(c) {
  if (window.parent === window) return;
  try { const p = await CT.packForStudents(c); window.parent.postMessage({ type: 'mt-share-state', hash: p.hash }, location.origin); } catch (e) { /* */ }
}
app.shareContest = async (c) => {
  const p = await CT.packForStudents(c);
  if (!p.count) { app.ui.toast('لا توجد أسئلة صالحة للمشاركة في هذه المسابقة.'); return; }
  if (p.dropped) {
    // تنبيه واضح قبل المشاركة: هذه الأسئلة لن تصل إلى الطلاب (فلا يظهر لهم سؤال ناقص)
    const list = p.droppedList.slice(0, 8).map((d) => `• ${d.prompt.slice(0, 70)} (${d.why})`).join('\n');
    const ok = await confirmBox(`${p.dropped} من أسئلة المسابقة لن تُرسل مع رابط الطلاب، لأنها تعتمد على صورة أو تسجيل رفعته من جهازك (لا يتسع لها الرابط) أو لأنها غير مكتملة. سيلعب الطلاب ${p.count} سؤالًا كاملًا فقط، ولن يظهر لهم أي سؤال ناقص.\n\n${list}${p.droppedList.length > 8 ? '\n…' : ''}`, { yes: 'مشاركة دون هذه الأسئلة', no: 'إلغاء' });
    if (!ok) return;
  }
  if (window.parent === window) { app.ui.toast('افتح اللعبة من داخل حسابك في MusiTeacher لمشاركتها مع الطلاب.'); return; }
  let acked = false;
  const on = (e) => { if (e.origin === location.origin && e.data && e.data.type === 'mt-share-ack') acked = true; };
  window.addEventListener('message', on);
  window.parent.postMessage({ type: 'mt-share-open', hash: p.hash }, location.origin);
  setTimeout(() => { window.removeEventListener('message', on); if (!acked) app.ui.toast('استخدم زر «🔗 مشاركة اللعبة مع الطلاب» أعلى صفحة اللعبة في MusiTeacher.', 5200); }, 1500);
};
app.toggleMute = () => { app.audio.ensure(); app.audio.setMuted(!app.audio.muted); };
app.fullscreen = () => { const t = document.documentElement; if (!document.fullscreenElement) (t.requestFullscreen ? t.requestFullscreen() : Promise.reject()).catch(() => {}); else document.exitFullscreen(); };

// ------------------------------------------------------------------ لوحة المفاتيح
addEventListener('keydown', (e) => {
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const R = app.race;
  const isEnter = e.code === 'Enter' || e.code === 'NumpadEnter';
  if (document.querySelector('.modal')) {
    // Enter يستأنف السباق من نافذة الاستراحة (ولا يُفعّل الزر المحدد معه فلا يحدث استئناف مزدوج)
    if (isEnter && R.state === 'paused') { e.preventDefault(); if (!e.repeat) app.pause(false); }
    else if ((e.code === 'Escape' || e.code === 'KeyP') && R.state === 'paused') app.pause(false);
    return;
  }
  R.keys[e.code] = true;
  if (garage.on) { if (isEnter) app.startContest(); return; }
  if (isEnter) { e.preventDefault(); if (!e.repeat) app.pause(true); return; }      // Enter: استراحة
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { R.steer(1); e.preventDefault(); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { R.steer(-1); e.preventDefault(); }
  else if (e.code === 'KeyR' || e.code === 'Space') { R.replay(); e.preventDefault(); }
  else if (/^Digit[1-5]$/.test(e.code)) R.goLane(+e.code.slice(5) - 1);
  else if (e.code === 'KeyC') app.toggleCamera();
  else if (e.code === 'KeyM') app.toggleMute();
  else if (e.code === 'Escape' || e.code === 'KeyP') app.pause(R.state !== 'paused');
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();       // ↓ لم يعد للفرملة (الدوّاسة وحدها تتحكم في السرعة)
});
addEventListener('keyup', (e) => { app.race.keys[e.code] = false; });
addEventListener('blur', () => { app.race.keys = {}; });
document.addEventListener('visibilitychange', () => { if (document.hidden && !garage.on && ['drive', 'countdown'].includes(app.race.state)) app.pause(true); });

// ------------------------------------------------------------------ الحلقة
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const headPos = new THREE.Vector3();
const TS = Math.max(0.25, Math.min(6, +(params.get('ts') || 1)));       // تسريع الزمن لاختبارات الأداء الآلية فقط
let prev = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000)) * TS; prev = now;
  if (garage.on) garagePose(dt); else app.race.update(dt);
  if (app.driver) { const h = app.driver.rig.b('C', 'head'); if (h) h.getWorldPosition(headPos); }
  app.fx.update(dt, headPos);
  renderer.render(scene, camera);
});
app.ui.showContest(app.contest, { teacher: app.teacher });
if (app.teacher) postShareState(app.contest);
app.ready = true;
window.done = true;
