// =====================================================================
//  عالم الآلات الإيقاعية الشرقية — MusiTeacher
//  مسرح ثلاثي الأبعاد كبير في المنتصف + درج شرح قابل للطي، وأربع وظائف: اكتشف · الضربات · النبر والإيقاع · اعزف.
//  يدان بشريتان حقيقيتان (من نموذج العازفة المشترك) تؤدّيان كل ضربة في موضعها لحظة صدور الصوت تمامًا.
//  البنية: data/ (آلات، أداء، ضروب، تخزين) · audio/ · models/ · hands/ (اليدان وحركتهما) · notation/ · game/ (ساعة الإيقاع) · ui/
// =====================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { INSTRUMENTS, instById, strokeAt } from './data/instruments.js';
import { PERFORMANCE, SHAPE_AR, HAND_AR, VERIFIED_AR, SUPPORT_AR, anchorOf, soundOf } from './data/performance.js';
import { SOURCES, PENDING, EXERCISES, DURUB, catalog, buildPiece, strokeOfK } from './data/rhythms.js';
import { loadMine, saveMine, storeError, newId, gridToPattern, patternToGrid } from './data/store.js';
import { AudioEngine } from './audio/engine.js';
import { BUILDERS, animateHead } from './models/builders.js';
import { Transport, judge } from './game/transport.js';
import { renderNotation } from './notation/notation.js';
import { Hands } from './hands/hands.js';
import { HandPerformer } from './hands/motion.js';
import { openEditor } from './ui/editor.js';

const $ = (s) => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const k in attrs) { const v = attrs[k]; if (v === false || v == null) continue; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v); } for (const c of kids.flat()) if (c != null && c !== false) e.append(c); return e; };
const params = new URLSearchParams(location.search);
const STK = {
  dum: { ar: 'دُم', sym: '●', color: '#e9a23b', keys: ['KeyD', 'KeyF', 'Space'] },
  tak: { ar: 'تك', sym: '○', color: '#39c5b3', keys: ['KeyJ', 'KeyK'] },
  ka: { ar: 'كا', full: 'تك باليد اليسرى (كا)', sym: '◌', color: '#a98bf0', keys: ['KeyL'] },
};

// ---------- المشهد ----------
const canvas = $('#scene'), stage = $('#stage');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { $('#loading').classList.add('hidden'); const n = $('#nogl'); n.classList.remove('hidden'); n.textContent = 'تعذّر تشغيل العرض ثلاثي الأبعاد على هذا الجهاز أو المتصفح.'; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 20);
const key = new THREE.DirectionalLight(0xfff0dc, 2.4); key.position.set(0.9, 1.8, 1.2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.004;
Object.assign(key.shadow.camera, { left: -0.6, right: 0.6, top: 0.6, bottom: -0.6, near: 0.1, far: 5 }); scene.add(key);
const rim = new THREE.DirectionalLight(0xbfd4ff, 0.7); rim.position.set(-1.2, 0.8, -1); scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(1.2, 64), new THREE.MeshStandardMaterial({ color: 0x2a1f16, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// ---------- الحالة ----------
const audio = new AudioEngine();
const S = { inst: INSTRUMENTS[0], mode: 'explore', level: 's', model: null, hits: [], ripples: [], fx: [], marks: new Map(), slow: false, accentOn: true, accompany: true,
  pieceDef: null, piece: null, score: null, sel: null, hover: null, tour: null, mine: loadMine(), handsState: 'loading', accentExample: 'ex24a', playId: 'maqsum' };
const view = { theta: 0.35, phi: 1.0, d: 1, target: new THREE.Vector3(), g: { theta: 0.35, phi: 1.0, d: 1 } };
const transport = new Transport(audio);
let hands = null, performer = null;
const zl = [];                       // علامات مؤقتة

// ---------- اليدان ----------
Hands.load('./_shared/3d/models/character-girl.fbx').then((H) => {
  hands = H; scene.add(H.root);
  performer = new HandPerformer(H, () => audio.heardNow); performer.enabled = S.mode !== 'explore';
  if (S.model) performer.setInstrument(S.inst, S.model, S.model.group);
  S.handsState = 'ready'; setHandNote();
}).catch((e) => { console.warn('hands', e); S.handsState = 'failed'; setHandNote(); });
function setHandNote() { const n = $('#handnote'); n.classList.toggle('hidden', S.handsState === 'ready' || S.mode === 'explore'); n.textContent = S.handsState === 'loading' ? 'جارٍ تحميل اليدين…' : 'تعذّر تحميل اليدين؛ الأصوات والمدوّنة تعمل بدونهما.'; }

// ---------- بناء الآلة ----------
function disposeModel() {
  if (!S.model) return; clearHalo(); scene.remove(S.model.group);
  S.model.group.traverse((o) => { if (o.isMesh && !o.userData.shell) { o.geometry.dispose(); for (const m of [].concat(o.material)) { if (m.map) m.map.dispose(); m.dispose(); } } });
  S.model = null;
}
function selectInstrument(id) {
  const inst = instById(id) || INSTRUMENTS[0];
  if (transport.playing) stopPlay();
  S.inst = inst; disposeModel(); endTour();
  const m = BUILDERS[inst.model](); S.model = m; scene.add(m.group); S.hits = []; S.ripples = []; S.fx = []; S.sel = null;
  view.target.set(0, m.height * 0.55, 0);
  floor.scale.setScalar(Math.max(0.5, m.R * 5)); const sc = Math.max(0.35, m.R * 2.2 + m.height * 0.6); Object.assign(key.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc }); key.shadow.camera.updateProjectionMatrix();
  document.querySelectorAll('#insts button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === inst.id)));
  if (performer) performer.setInstrument(inst, m, m.group);
  $('#partcard').classList.add('hidden');
  setMode(S.mode);
  $('#loading').classList.remove('hidden');
  audio.load(inst).then((ok) => { if (S.inst === inst) { $('#loading').classList.add('hidden'); if (!ok) toast('تعذّر تحميل أصوات هذه الآلة. تحقّق من الاتصال ثم أعد المحاولة.', true); } });
}
const hasKa = () => !!PERFORMANCE[S.inst.id].strokes.ka;

// ---------- الضربة: صوت + يد + أثر مرئي، كلها على الزمن نفسه ----------
/**
 * stroke: dum | tak | ka · opt.when زمن الصوت (الافتراضي: الآن) · opt.target نقطة على الجلد · opt.slow معامل التصوير البطيء للاقتراب
 */
function perform(stroke, opt = {}) {
  if (!S.model) return null;
  const P = PERFORMANCE[S.inst.id]; if (!P.strokes[stroke]) stroke = stroke === 'ka' ? 'tak' : 'dum';
  const ctx = audio.ensure(); if (!ctx) return null;
  const level = opt.level || S.level, sp = P.strokes[stroke];
  const loc = opt.target || (performer ? performer.anchor(stroke) : anchorOf(S.inst, stroke, S.model.R)), rho = Math.min(1, Math.hypot(loc.x, loc.z) / S.model.R);
  const t = audio.hit(S.inst, soundOf(S.inst, stroke), level, { when: opt.when ?? ctx.currentTime, rho, gain: (opt.gain ?? 1) * (sp.gain ?? 1) });
  if (t == null) return null;
  if (performer && S.mode !== 'explore') { performer.slow = opt.slow || 1; performer.add(stroke, t, level, opt.target ? { x: loc.x, z: loc.z } : null); performer.slow = 1; }
  S.fx.push({ t, fn: () => visual(stroke, level, loc, opt.noteIndex) });
  return t;
}
/** عرض الضربة قبل صوتها بزمن الاقتراب (أزرار «شاهد») */
function demo(stroke, level = 's', slow = S.slow ? 4 : 1) {
  const ctx = audio.ensure(); if (!ctx) return;
  const lead = performer && S.mode !== 'explore' ? performer.lead(PERFORMANCE[S.inst.id].strokes[stroke] ? stroke : 'tak', slow) : 0;
  return perform(stroke, { level, when: ctx.currentTime + lead + (ctx.outputLatency || 0), slow });
}
/** الأثر المرئي لحظة الملامسة: تموّج الجلد + حلقة + علامة مؤقتة باسم الضربة + الصنوج */
function visual(stroke, level, p, noteIndex) {
  if (!S.model) return; const R = S.model.R, rho = Math.hypot(p.x, p.z) / R;
  S.hits.push({ x: p.x, z: p.z, amp: (level === 's' ? 0.05 : 0.026) * (stroke === 'dum' ? 1 : 0.6), t: 0 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 40), new THREE.MeshBasicMaterial({ color: STK[stroke].color, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, S.model.top + 0.002, p.z); ring.renderOrder = 6; ring.userData = { t: 0, r0: R * (level === 's' ? 0.08 : 0.05) }; S.model.group.add(ring); S.ripples.push(ring);
  const sp = PERFORMANCE[S.inst.id].strokes[stroke];
  for (const j of S.model.jingles) j.userData.jingle.k = Math.max(j.userData.jingle.k, (level === 's' ? 1 : 0.55) * (sp && sp.jingles || rho > 0.5 ? 1 : 0.4));
  if (S.mode !== 'explore') {                           // العلامة لا تظهر إلا لحظة الضربة
    const e = h('div', { class: 'zl ' + stroke }, STK[stroke].ar); $('#zlabels').append(e);
    zl.push({ e, p: new THREE.Vector3(p.x, S.model.top + 0.012, p.z), t: 0 }); while (zl.length > 6) zl.shift().e.remove();
  }
  const pad = document.querySelector(`.pad.${stroke}`); if (pad) { pad.classList.add('flash'); clearTimeout(pad._t); pad._t = setTimeout(() => pad.classList.remove('flash'), 120); }
  if (noteIndex != null && S.score) S.score.flash(noteIndex);
}

// ---------- إبراز الأجزاء (هالة حمراء) ----------
const haloMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, side: THREE.BackSide, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false });
const halo = { name: null, swaps: [], shells: [] };
function clearHalo() {
  for (const [m, orig, clone] of halo.swaps) { m.material = orig; [].concat(clone).forEach((c) => c.dispose()); }
  for (const s of halo.shells) s.parent && s.parent.remove(s);
  halo.swaps = []; halo.shells = []; halo.name = null;
}
function highlight(name) {
  if (halo.name === name) return; clearHalo(); if (!name || !S.model) return; halo.name = name;
  S.model.group.traverse((o) => {
    if (!o.isMesh || !o.userData.part || o.userData.part.n !== name) return;
    const orig = o.material, clone = [].concat(orig).map((m) => { const c = m.clone(); if (c.emissive) { c.emissive.set(0xff2a1a); c.emissiveIntensity = 0.5; } return c; });
    o.material = Array.isArray(orig) ? clone : clone[0]; halo.swaps.push([o, orig, clone]);
    if (o !== S.model.head) { const sh = new THREE.Mesh(o.geometry, haloMat); sh.userData.shell = true; sh.position.copy(o.position); sh.quaternion.copy(o.quaternion); sh.scale.copy(o.scale).multiplyScalar(1.04); sh.renderOrder = 2; o.parent.add(sh); halo.shells.push(sh); }
  });
}
function partsOf() { const seen = new Map(); S.model.group.traverse((o) => { if (o.isMesh && o.userData.part && !o.userData.shell && !seen.has(o.userData.part.n)) seen.set(o.userData.part.n, o.userData.part); }); return [...seen.values()]; }
function showPart(pt, fromTour) {
  S.sel = pt.n; highlight(pt.n);
  const c = $('#partcard'); c.classList.remove('hidden');
  c.replaceChildren(h('button', { class: 'x', 'aria-label': 'إغلاق', onclick: () => { c.classList.add('hidden'); S.sel = null; highlight(null); } }, '✕'), h('b', {}, pt.n), h('p', {}, pt.d));
  document.querySelectorAll('.parts button').forEach((b) => b.classList.toggle('on', b.dataset.n === pt.n));
  if (fromTour) aimAt(pt.n);
}
function aimAt(name) {
  const box = new THREE.Box3(); S.model.group.traverse((o) => { if (o.isMesh && o.userData.part && o.userData.part.n === name) box.expandByObject(o); });
  const c = box.getCenter(new THREE.Vector3()); if (Math.hypot(c.x, c.z) > S.model.R * 0.3) view.g.theta = Math.atan2(c.x, c.z);
  view.g.phi = c.y < S.model.height * 0.35 ? 1.35 : c.y > S.model.top - 0.01 && Math.hypot(c.x, c.z) < S.model.R * 0.5 ? 0.7 : 1.1;
}
// جولة المعلم: الأجزاء جزءًا جزءًا
function startTour() {
  const list = partsOf(); S.tour = { list, i: 0, auto: false, timer: 0 }; tourStep(0);
}
function tourStep(i) {
  const T = S.tour; if (!T) return; T.i = (i + T.list.length) % T.list.length; showPart(T.list[T.i], true);
  const box = $('#tour'); box.classList.remove('hidden');
  box.replaceChildren(h('button', { onclick: () => tourStep(T.i + 1), 'aria-label': 'الجزء التالي' }, '→ التالي'), h('span', {}, `${T.i + 1} / ${T.list.length}`),
    h('button', { onclick: () => tourStep(T.i - 1), 'aria-label': 'الجزء السابق' }, 'السابق ←'),
    h('button', { 'aria-pressed': String(T.auto), onclick: () => { T.auto = !T.auto; T.timer = 0; tourStep(T.i); } }, T.auto ? '⏸ إيقاف التلقائي' : '▶ تلقائي'),
    h('button', { onclick: endTour }, 'إنهاء الجولة'));
}
function endTour() { if (!S.tour) return; S.tour = null; $('#tour').classList.add('hidden'); }

// ---------- المقاطع (ضروب وتمارين) ----------
function minePieces() { return S.mine.map((x) => ({ id: x.id, name: x.name, meter: x.meter, bpm: x.bpm, p: gridToPattern(x), kind: 'mine' })); }
function allDefs() { return catalog(S.inst, hasKa(), minePieces()).flatMap((g) => g.items); }
function loadPiece(def) {
  if (transport.playing) stopPlay();
  try { S.piece = buildPiece(def); } catch (e) { toast('تعذّر قراءة المدوّنة: ' + e.message, true); return; }
  S.pieceDef = def; transport.setPiece(S.piece); S.marks.clear();
  buildTimeline();
}
transport.onHit = (hit, t, k) => {
  if (!S.accompany && S.mode === 'play') return;
  const st = strokeOfK(hit.k), anyAcc = S.piece.hits.some((x) => x.acc);
  const level = !S.accentOn ? 'w' : anyAcc ? (hit.acc ? 's' : 'w') : 's';
  const gain = !S.accentOn ? 0.95 : anyAcc ? (hit.acc ? 1 : 0.72) : 0.9;
  perform(st, { level, when: t, gain, noteIndex: noteIndexOf(hit) });
};
transport.onPos = (p) => { if (S.score) S.score.update(p); if (S.editorPos) S.editorPos(p); if (p == null) setPlayBtn(); };
transport.onEnd = () => setPlayBtn();
function noteIndexOf(hit) { let gi = 0; for (let b = 0; b < hit.bar; b++) gi += S.piece.bars[b].length; return gi + hit.ni; }
async function startPlay() {
  audio.ensure(); await audio.load(S.inst); if (performer) performer.clear(); S.marks.clear();
  transport.start(0.35); setPlayBtn();
}
function stopPlay() { transport.stop(); audio.stopAll(); if (performer) performer.clear(); S.fx = []; setPlayBtn(); }
function setPlayBtn() { const b = $('#tp-play'); if (b) { b.textContent = transport.playing ? '■ إيقاف' : '▶ تشغيل'; b.classList.toggle('primary', !transport.playing); } }

// ---------- شريط المدوّنة ----------
function buildTimeline() {
  const tl = $('#timeline'), def = S.pieceDef, pc = S.piece; if (!def || !pc) return;
  const box = h('div', { class: 'scorebox' });
  const ctl = h('div', { class: 'tl-ctl' });
  ctl.append(h('button', { id: 'tp-play', class: 'primary', onclick: () => (transport.playing ? stopPlay() : startPlay()) }, '▶ تشغيل'),
    h('button', { title: 'من البداية', onclick: () => { stopPlay(); startPlay(); } }, '⏮ من البداية'));
  if (S.mode === 'play') {
    const groups = catalog(S.inst, hasKa(), minePieces());
    const sel = h('select', { 'aria-label': 'اختر الضرب أو التمرين الإيقاعي', onchange: (e) => {
      const v = e.target.value; if (v === '__new') { e.target.value = def.id; openEditorFor(null); return; }
      const d = allDefs().find((x) => x.id === v); if (d) { S.playId = d.id; loadPiece(d); setMode('play', true); }
    } },
    h('option', { value: '', disabled: '' }, 'اختر الضرب أو التمرين الإيقاعي'),
    groups.map((g) => h('optgroup', { label: g.label }, g.items.map((it) => h('option', { value: it.id }, `${it.name} (${it.meter[0]}/${it.meter[1]})`)))),
    h('optgroup', { label: 'بانتظار تدوين موثّق' }, PENDING.map((p) => h('option', { disabled: '', value: '' }, `${p.name} — غير متاح`))),
    h('option', { value: '__new' }, '+ أنشئ تمرينًا خاصًا بي'));
    sel.value = def.id; ctl.append(sel);
  }
  const out = h('output', {}, String(transport.bpm));
  ctl.append(h('label', {}, 'السرعة', h('input', { type: 'range', min: '40', max: '200', step: '2', value: String(transport.bpm), 'aria-label': 'السرعة (نبضة في الدقيقة)', oninput: (e) => { transport.setBpm(+e.target.value); out.textContent = e.target.value; } }), out),
    h('label', {}, h('input', { type: 'checkbox', checked: transport.loop ? '' : false, onchange: (e) => { transport.loop = e.target.checked; } }), 'تكرار'));
  if (S.mode === 'play') ctl.append(h('label', { title: 'أطفئه لتعزف أنت مع المؤشر وتُقيَّم ضرباتك' }, h('input', { type: 'checkbox', checked: S.accompany ? '' : false, onchange: (e) => { S.accompany = e.target.checked; setFb(S.accompany ? '' : 'اعزف أنت الآن: انقر الجلد أو أزرار الضربات مع المؤشر.'); } }), 'اليد والصوت المرافقان'));
  ctl.append(h('span', { class: 'tl-meta' }, `${def.name} · ${pc.meter[0]}/${pc.meter[1]}`), h('span', { id: 'fb' }));
  tl.replaceChildren(box, ctl);
  S.score = renderNotation(box, pc, { label: S.inst.name, onNote: (n) => clickNote(n) });
  setPlayBtn();
}
/** النقر على علامة في المدوّنة: إضاءة + أداء اليد + الصوت (والسكتة: بلا ضربة) */
function clickNote(n) {
  const gi = S.piece.bars.flat().indexOf(n);
  if (n.k === 'R' || n.tied) { if (S.score) S.score.flash(gi); return; }
  const anyAcc = S.piece.hits.some((x) => x.acc), level = anyAcc ? (n.acc ? 's' : 'w') : 's';
  demoNote(strokeOfK(n.k), level, gi);
}
function demoNote(stroke, level, gi) { const ctx = audio.ensure(); if (!ctx) return; const lead = performer ? performer.lead(PERFORMANCE[S.inst.id].strokes[stroke] ? stroke : 'tak', 1) : 0; perform(stroke, { level, when: ctx.currentTime + lead, gain: level === 's' ? 1 : 0.72, noteIndex: gi }); }
function setFb(txt, cls = '') { const f = $('#fb'); if (f) { f.textContent = txt; f.style.color = cls ? { good: '#15803d', near: '#a16207', bad: '#b91c1c' }[cls] : ''; } }
function rate(stroke, t) {
  const j = judge(transport, stroke, t); if (!j) { setFb('خارج موضع الضربات — تابع المؤشر', 'near'); return; }
  const k = j.loopNo + ':' + j.h.u; if (S.marks.has(k)) return; S.marks.set(k, 1);
  setFb(j.ok ? 'في وقتها تمامًا ✓' : j.strokeOk ? (j.dt < 0 ? 'مبكرة قليلًا' : 'متأخرة قليلًا') : `المطلوب هنا: ${j.h.k === 'D' ? 'دُم' : 'تك'}`, j.ok ? 'good' : j.strokeOk ? 'near' : 'bad');
}

// ---------- الواجهة ----------
const MODES = [['explore', 'اكتشف'], ['strokes', 'الضربات'], ['accent', 'النبر والإيقاع'], ['play', 'اعزف']];
$('#insts').append(...INSTRUMENTS.map((i) => h('button', { 'data-id': i.id, 'aria-pressed': 'false', onclick: () => selectInstrument(i.id) }, i.name)));
$('#modes').append(...MODES.map(([k, l]) => h('button', { role: 'tab', 'data-mode': k, 'aria-selected': 'false', onclick: () => setMode(k) }, l)));
const acc = (title, open, ...body) => h('details', { class: 'acc', open: open ? '' : false }, h('summary', {}, title), h('div', { class: 'body' }, ...body));
function exclusive(root) { const list = [...root.querySelectorAll('details.acc')]; list.forEach((d) => d.addEventListener('toggle', () => { if (d.open && d.isConnected) list.forEach((o) => { if (o !== d && o.open) o.open = false; }); })); }
const factTitle = (t) => (t === 'خصائصها' ? 'الخصائص والاستخدامات' : t);

/** المنظر الافتراضي: في «اكتشف» الآلة وحدها؛ وفي غيره منظر أمامي جانبي أبعد قليلًا لتظهر الآلة واليدان معًا */
function resetView() { const ex = S.mode === 'explore'; view.g.theta = ex ? 0.35 : 0; view.g.phi = ex ? 1.05 : 0.72; if (S.model) view.g.d = (ex ? viewDist() : (S.model.R * 2.3 + 0.2) / (2 * Math.tan(camera.fov * Math.PI / 360)) * 1.25) * Math.max(1, 0.95 / (camera.aspect || 1)); }   // الشاشة الطولية (الهاتف): نبتعد حتى تتسع الآلة عرضًا
function viewDist() { const m = S.model, size = Math.max(m.R * 2.3, m.height * 1.15); return size / (2 * Math.tan(camera.fov * Math.PI / 360)) * 1.28; }
function setMode(m, keepPiece) {
  const prevMode = S.mode; S.mode = m; const inst = S.inst, P = PERFORMANCE[inst.id], pan = $('#panel');
  if (prevMode !== m && transport.playing) stopPlay();
  document.querySelectorAll('#modes button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
  if (m !== 'explore') { endTour(); S.sel = null; highlight(null); $('#partcard').classList.add('hidden'); $('#tip').classList.add('hidden'); }
  resetView();
  const withTL = m === 'accent' || m === 'play';
  $('#timeline').classList.toggle('hidden', !withTL);
  if (performer) performer.enabled = m !== 'explore';
  setHandNote();
  const head = [h('h2', {}, inst.name), h('span', { class: 'badge' }, inst.family)];
  let body = [];
  if (m === 'explore') {
    const f = Object.fromEntries(inst.facts.map(([t, d]) => [factTitle(t), d]));
    body = [
      ...['الوصف', 'الخامات', 'طريقة العزف', 'الخصائص والاستخدامات'].filter((t) => f[t]).map((t, i) => acc(t, i === 0, h('p', {}, f[t]))),
      acc('استمع إلى الصوت', false, h('p', {}, 'استمع إلى كل ضربة منفصلة:'),
        h('div', { class: 'row' }, h('button', { class: 'btn dum', onclick: () => perform('dum', { level: 's' }) }, '● دُم'), h('button', { class: 'btn tak', onclick: () => perform('tak', { level: 's' }) }, '○ تك')),
        h('p', { class: 'note' }, 'ويمكنك أيضًا النقر على جلد الآلة نفسها.')),
      acc('أجزاء الآلة', false, h('p', {}, 'مرّر المؤشر على أي جزء من المجسّم لترى اسمه، وانقره لتعرف وظيفته.'),
        h('div', { class: 'parts' }, partsOf().map((pt) => h('button', { class: 'btn', 'data-n': pt.n, onclick: () => { endTour(); showPart(pt, true); } }, pt.n))),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: startTour }, '▶ جولة الأجزاء (عرض المعلم)'))),
    ];
  } else if (m === 'strokes') {
    body = [h('p', {}, 'لكل ضربة يد وموضع وهيئة أصابع. اضغط «شاهد» لترى اليد تتحرك إلى الموضع وتضرب وترتد، ويصدر الصوت لحظة الملامسة.')];
    for (const [k, sp] of Object.entries(P.strokes)) {
      const sound = k === 'dum' ? 'جهير عميق' : k === 'tak' ? 'حادّ واضح' + (sp.jingles ? '، مع رنين الصنوج' : '') : 'عينة التك بشدة أخفّ (لا يتوفر تسجيل مستقل لـ«كا»)';
      const motion = sp.fingersOnly ? 'تبقى اليد ممسكة بالآلة ويتحرك الإصبعان فقط: نقرة سريعة ثم ارتفاع فوري' : `هبوط سريع (${Math.round(sp.down * 1000)} ملّي ثانية) ثم ارتداد فوري عن الجلد (${Math.round(sp.reb * 1000)} ملّي ثانية)`;
      body.push(acc(`${STK[k].sym} ${STK[k].full || STK[k].ar}`, k === 'dum',
        h('dl', { class: 'kv' }, h('dt', {}, 'اليد'), h('dd', {}, HAND_AR[sp.hand]), h('dt', {}, 'الموضع'), h('dd', {}, sp.where), h('dt', {}, 'الأصابع'), h('dd', {}, SHAPE_AR[sp.shape]),
          h('dt', {}, 'الحركة'), h('dd', {}, motion), h('dt', {}, 'الصوت'), h('dd', {}, sound), h('dt', {}, 'المصدر'), h('dd', {}, VERIFIED_AR[sp.verified])),
        h('div', { class: 'row' }, h('button', { class: 'btn ' + k, onclick: () => demo(k, 's', 1) }, '▶ شاهد الضربة'), h('button', { class: 'btn', onclick: () => demo(k, 's', 4) }, '🐢 ببطء'),
          h('button', { class: 'btn', onclick: () => demo(k, 's') }, 'قوية'), h('button', { class: 'btn', onclick: () => demo(k, 'w') }, 'خفيفة'))));
    }
    if (P.support) body.push(acc('✋ اليد الأخرى', false, h('p', {}, SUPPORT_AR[P.support.thumb === 'hole' ? 'hole' : P.support.kind]),
      h('p', { class: 'note' }, P.present ? 'الآلة خفيفة فتُرفع في يد العازف؛ تتنفّس اليد الحاملة مع الآلة وتمتص ارتداد كل ضربة دون أن تترك الإطار.' : 'الآلة ثقيلة فتبقى على الأرض، واليد تثبّتها فقط ولا تحمل وزنها.')));
    if (inst.zonesAssumed) body.push(h('div', { class: 'note warn' }, 'الدرس يذكر أن لكل من الدُم والتك مكانًا على هذا الطبل دون تحديده؛ الموضعان هنا تقريب تعليمي. أما هيئة اليد فمن دليل المعلم: «الدُّم بضمّ أصابع اليد، والتك بفتحها».'));
    if (Object.values(P.strokes).some((s) => s.review)) body.push(h('div', { class: 'note warn' }, 'نص الدرس: «تُنقر الدُم على الحافة، والتك في الوسط — عكس الدف والطبلة». التزمت اللعبة بنص الدرس، مع أن مراجع الدفوف الإطارية العامة تضع الدُم قرب الوسط؛ هذه النقطة معروضة للمراجعة الموسيقية.'));
    body.push(h('div', { class: 'note', html: 'لوحة المفاتيح: <kbd>D</kbd> أو <kbd>مسافة</kbd> دُم · <kbd>K</kbd> تك' + (hasKa() ? ' · <kbd>L</kbd> كا' : '') + ' · مع <kbd>Shift</kbd> ضربة خفيفة.' }));
  } else if (m === 'accent') {
    if (!keepPiece) { const d = EXERCISES.find((x) => x.id === S.accentExample) || EXERCISES[0]; loadPiece({ ...d, kind: 'exercise' }); }
    const ex = (id) => { const d = EXERCISES.find((x) => x.id === id) || DURUB.find((x) => x.id === id); return h('button', { class: 'btn', onclick: () => { S.accentExample = id; loadPiece(d); } }, `${d.name} (${d.meter[0]}/${d.meter[1]})`); };
    body = [
      acc('مفهوم النبر', true, h('p', {}, 'النبر هو إبراز ضربة معيّنة بأدائها أقوى من الضربات المجاورة لها. تُكتب فوق الضربة المنبورة علامة ‹>›.'),
        h('p', {}, 'في الدرس: الدُّم هي «النبر القوي» والتك هي «النبر الخفيف».')),
      acc('القوية والخفيفة', false, h('p', {}, 'اسمع الضربة نفسها بشدّتين، وشاهد ارتفاع اليد قبل كل منهما:'),
        h('div', { class: 'row' }, h('button', { class: 'btn dum', onclick: () => demo('dum', 's', 1) }, 'دُم قوية >'), h('button', { class: 'btn dum', onclick: () => demo('dum', 'w', 1) }, 'دُم خفيفة')),
        h('div', { class: 'row' }, h('button', { class: 'btn tak', onclick: () => demo('tak', 's', 1) }, 'تك قوية >'), h('button', { class: 'btn tak', onclick: () => demo('tak', 'w', 1) }, 'تك خفيفة'))),
      acc('موضع النبر في الميزان', false, h('p', {}, 'يقع النبر الأقوى عادة على أول نبضة في الميزان:'),
        h('dl', { class: 'kv' }, h('dt', {}, '2/4'), h('dd', {}, 'قوية – ضعيفة'), h('dt', {}, '3/4'), h('dd', {}, 'قوية – ضعيفة – ضعيفة'), h('dt', {}, '4/4'), h('dd', {}, 'قوية – ضعيفة – متوسطة – ضعيفة')),
        h('div', { class: 'row' }, ex('ex24a'), ex('ex34a'), ex('ex44a'))),
      acc('أمثلة', false, h('p', {}, 'افتح مثالًا ثم انقر أي علامة في المدوّنة لتؤدّيها اليد، أو شغّله كاملًا:'), h('div', { class: 'row' }, ex('ex24b'), ex('ex44c'), ex('maqsum'), ex('waltz'))),
      acc('الاستماع والمقارنة', false, h('p', {}, 'شغّل المثال الحالي مرة بالنبر كما هو مكتوب، ومرة بضربات متساوية، ولاحظ الفرق:'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { S.accentOn = true; stopPlay(); startPlay(); } }, '▶ بالنبر'), h('button', { class: 'btn', onclick: () => { S.accentOn = false; stopPlay(); startPlay(); } }, '▶ بلا نبر (متساوية)'))),
    ];
    S.accentOn = true;
  } else {
    if (!keepPiece) { const d = allDefs().find((x) => x.id === S.playId) || allDefs()[0]; loadPiece(d); }
    const def = S.pieceDef;
    const srcs = (def.src || []).map((k) => SOURCES[k]).filter(Boolean);
    body = [
      acc('عن هذا الإيقاع', true, h('dl', { class: 'kv' }, h('dt', {}, 'الاسم'), h('dd', {}, def.name), h('dt', {}, 'الميزان'), h('dd', {}, `${def.meter[0]}/${def.meter[1]}`),
          def.kind === 'exercise' ? [h('dt', {}, 'المستوى'), h('dd', {}, ['', 'مبتدئ', 'متوسط', 'متقدم'][def.level]), h('dt', {}, 'المهارات'), h('dd', {}, def.skills)] : null,
          h('dt', {}, 'النوع'), h('dd', {}, { durub: 'ضرب عربي (الهيكل الأساسي)', omani: 'فن عُماني — مسار هذه الآلة', exercise: 'تمرين تعليمي من اللعبة', mine: 'من تماريني' }[def.kind] || '')),
        def.note ? h('p', { class: 'note' }, def.note) : null,
        srcs.length ? [h('b', {}, 'المصادر:'), h('ul', { class: 'src' }, srcs.map((s) => h('li', {}, s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.cite) : s.cite)))] : null,
        def.kind !== 'mine' ? h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => copyToMine(def) }, '⧉ انسخه إلى تماريني لأعدّله')) : null),
      acc('كيف أتدرّب؟', false, h('p', {}, 'شغّل الإيقاع وتابع المؤشر واليد. ثم أطفئ «اليد والصوت المرافقان» واعزف أنت بالنقر على الجلد أو بأزرار الضربات؛ تظهر ملاحظة على كل ضربة.'),
        h('p', {}, 'انقر أي علامة في المدوّنة لتؤدّيها اليد وحدها. السكتة لا تُعزف لكن الزمن يستمر خلالها.')),
      acc(`تماريني (${S.mine.length})`, def.kind === 'mine', mineList()),
    ];
  }
  pan.replaceChildren(...head, ...body.filter(Boolean),
    h('div', { class: 'note' }, inst.id === 'kasir' || inst.id === 'rahmani' ? 'الأصوات تسجيلات حقيقية لطبول جلدية قريبة الطابع (لا تتوفر بعدُ تسجيلات مرخّصة لهذه الآلة نفسها).' : 'الأصوات تسجيلات حقيقية مرخّصة (CC0).'));
  exclusive(pan);
  if (withTL && !S.piece) { const d = allDefs()[0]; loadPiece(d); } else if (withTL) buildTimeline();
  buildPads();
}
function mineList() {
  const err = storeError();
  const io = h('div', { class: 'row' },
    h('button', { class: 'btn primary', onclick: () => openEditorFor(null) }, '+ أنشئ تمرينًا خاصًا بي'),
    h('button', { class: 'btn', onclick: exportMine, disabled: S.mine.length ? false : '' }, '⇩ تصدير ملف'),
    h('label', { class: 'btn', tabindex: '0' }, '⇧ استيراد ملف', h('input', { type: 'file', accept: '.json,application/json', class: 'hidden', onchange: importMine })));
  if (!S.mine.length) return [err ? h('div', { class: 'note warn' }, err) : null, h('p', {}, 'لا توجد تمارين محفوظة بعد.'), io];
  return [err ? h('div', { class: 'note warn' }, err) : null, h('div', { class: 'mine' }, S.mine.map((x) => h('div', { class: 'it' }, h('b', {}, x.name), h('small', {}, `${x.meter[0]}/${x.meter[1]} · ${x.bars.length} مازورة`),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => { S.playId = x.id; loadPiece(minePieces().find((p) => p.id === x.id)); setMode('play', true); } }, '▶ فتح'),
      h('button', { class: 'btn', onclick: () => openEditorFor(x) }, '✎ تعديل'),
      h('button', { class: 'btn', onclick: () => { const c = { ...JSON.parse(JSON.stringify(x)), id: newId(), name: x.name + ' (نسخة)', created: Date.now(), updated: Date.now() }; commitMine([...S.mine, c], 'نُسخ التمرين.'); } }, '⧉ نسخ'),
      h('button', { class: 'btn danger', onclick: () => { if (confirm(`حذف «${x.name}» نهائيًا؟`)) commitMine(S.mine.filter((q) => q.id !== x.id), 'حُذف التمرين.'); } }, 'حذف'))))), io];
}
function commitMine(list, msg) {
  if (!saveMine(list)) { toast(storeError(), true); return false; }
  S.mine = list; if (msg) toast(msg);
  if (S.mode === 'play') { if (S.pieceDef && S.pieceDef.kind === 'mine' && !list.some((q) => q.id === S.pieceDef.id)) { S.playId = 'maqsum'; setMode('play'); } else setMode('play', true); }
  return true;
}
function copyToMine(def) {
  const g = patternToGrid(def.p, def.meter); if (!g) { toast('هذا الإيقاع يحتوي رباطًا زمنيًا لا تدعمه الشبكة بعد؛ لا يمكن نسخه.', true); return; }
  openEditorFor({ id: null, name: def.name + ' — نسختي', meter: def.meter, res: g.res, bpm: def.bpm || 84, bars: g.bars }, true);
}
function openEditorFor(x, asNew) {
  if (transport.playing) stopPlay();
  openEditor({ root: $('#editor'), ex: x, hasKa: hasKa(), instName: S.inst.name,
    audition: (k, a) => { if (!audio.ready(S.inst)) return; const st = strokeOfK(k); audio.hit(S.inst, soundOf(S.inst, PERFORMANCE[S.inst.id].strokes[st] ? st : 'tak'), a ? 's' : 'w', { gain: a ? 1 : 0.75 }); },
    onSave: (ex) => {
      const now = Date.now();
      if (!ex.id || asNew) ex.id = newId();
      const old = S.mine.find((q) => q.id === ex.id), item = { ...ex, created: old ? old.created : now, updated: now };
      const list = old ? S.mine.map((q) => (q.id === ex.id ? item : q)) : [...S.mine, item];
      if (!saveMine(list)) return { ok: false, msg: storeError() };
      S.mine = list; S.playId = item.id; S.prevPiece = null; toast('حُفظ التمرين في «تماريني».');
      S.mode = 'play'; loadPiece(minePieces().find((p) => p.id === item.id)); setMode('play', true);
      return { ok: true };
    },
    play: (def, onPos) => { loadPreview(def); S.editorPos = onPos; startPlay(); },
    stop: () => { stopPlay(); S.editorPos && S.editorPos(null); S.editorPos = null; if (S.prevPiece) { const p = S.prevPiece; S.prevPiece = null; S.pieceDef = p.def; S.piece = p.pc; transport.setPiece(p.pc); buildTimeline(); } },
    playing: () => transport.playing,
    onClose: () => { S.editorPos = null; },
  });
}
function loadPreview(def) { if (!S.prevPiece && S.pieceDef) S.prevPiece = { def: S.pieceDef, pc: S.piece }; S.pieceDef = def; S.piece = buildPiece(def); transport.setPiece(S.piece); S.score = null; }
function exportMine() {
  const blob = new Blob([JSON.stringify({ app: 'percussion-3d', version: 1, exported: new Date().toISOString(), exercises: S.mine }, null, 1)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `تماريني-الإيقاع-${new Date().toISOString().slice(0, 10)}.json` }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function importMine(e) {
  const f = e.target.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text()), arr = Array.isArray(j) ? j : j.exercises;
    if (!Array.isArray(arr)) throw new Error('bad');
    const ok = arr.filter((x) => x && Array.isArray(x.bars) && Array.isArray(x.meter) && x.name).map((x) => ({ ...x, id: newId(), imported: Date.now() }));
    for (const x of ok) gridToPattern(x);                 // تحقّق: يجب أن تتحول كل شبكة إلى مدوّنة سليمة
    if (!ok.length) throw new Error('empty');
    commitMine([...S.mine, ...ok], `استُورد ${ok.length} تمرين.`);
  } catch (err) { toast('الملف غير صالح أو لا يحتوي تمارين.', true); }
}
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.remove('hidden'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), bad ? 6000 : 2600); }

function buildPads() {
  const P = PERFORMANCE[S.inst.id], pads = [];
  for (const k of ['dum', 'tak', 'ka']) if (P.strokes[k]) pads.push(h('button', { class: 'pad ' + k, onpointerdown: (e) => { e.preventDefault(); userStrike(k); } }, `${STK[k].sym} ${STK[k].ar}`, h('small', {}, P.strokes[k].where)));
  const lv = (k, l) => h('button', { 'aria-pressed': String(S.level === k), onclick: () => { S.level = k; buildPads(); } }, l);
  $('#pads').replaceChildren(...[...pads,
    h('div', { class: 'mini' }, 'الشدّة', lv('s', 'قوية'), lv('w', 'خفيفة')),
    S.mode === 'strokes' ? h('div', { class: 'mini' }, h('button', { 'aria-pressed': String(S.slow), onclick: () => { S.slow = !S.slow; buildPads(); } }, '🐢 تصوير بطيء')) : null,
    h('div', { class: 'mini' }, '🔊', h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(audio.volume), 'aria-label': 'مستوى الصوت', oninput: (e) => audio.setVolume(+e.target.value) })),
    h('div', { class: 'mini' }, h('button', { title: 'إعادة المنظر', onclick: () => resetView() }, '⟲ المنظر'))].filter(Boolean));
}
/** ضربة من المتعلم (زر أو لوحة مفاتيح): في وضع الضربات تُعرض بالاقتراب الكامل، وفي غيره فورية */
function userStrike(k, level = S.level) {
  if (S.mode === 'strokes') { demo(k, level); return; }
  const t = perform(k, { level });
  if (S.mode === 'play' && transport.playing && t != null) rate(k, t);
}

// ---------- الإدخال: النقر على الجلد، التمرير فوق الأجزاء، التدوير والتكبير ----------
const ray = new THREE.Raycaster(), ptrs = new Map(); let pinch0 = 0, hoverAt = null;
function pick(x, y) {
  const r = canvas.getBoundingClientRect(); ray.setFromCamera({ x: (x - r.left) / r.width * 2 - 1, y: -(y - r.top) / r.height * 2 + 1 }, camera);
  return ray.intersectObject(S.model.group, true).find((q) => q.object.userData.part && !q.object.userData.shell);
}
canvas.addEventListener('pointerdown', (e) => {
  if (!S.model) return; canvas.setPointerCapture(e.pointerId);
  const hit = pick(e.clientX, e.clientY), rec = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, played: false, hit };
  if (hit) {
    const lp = S.model.group.worldToLocal(hit.point.clone());
    if (hit.object === S.model.head) { const st = strokeAt(S.inst, Math.hypot(lp.x, lp.z) / S.model.R); const t = perform(st, { target: { x: lp.x, z: lp.z } }); rec.played = true; if (S.mode === 'play' && transport.playing && t != null) rate(st, t); }
    else if (S.model.jingles.length && /الصنوج/.test(hit.object.userData.part.n)) { const k = S.model.R * 0.9 / Math.max(1e-4, Math.hypot(lp.x, lp.z)); perform('tak', { target: { x: lp.x * k, z: lp.z * k } }); rec.played = true; }
  }
  ptrs.set(e.pointerId, rec);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) { if (S.mode === 'explore' && e.pointerType !== 'touch') hoverAt = { x: e.clientX, y: e.clientY }; return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 && !a.played && !b.played) view.g.d *= pinch0 / d; pinch0 = d; return; }
  if (p.played) return;
  view.g.theta -= dx * 0.008; view.g.phi = Math.max(0.12, Math.min(1.5, view.g.phi - dy * 0.006));
});
canvas.addEventListener('pointerleave', () => { hoverAt = null; S.hover = null; $('#tip').classList.add('hidden'); highlight(S.sel); });
const up = (e) => {
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); if (!p) return;
  if (S.mode === 'explore' && p.hit && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6) { endTour(); showPart(p.hit.object.userData.part); }
};
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); view.g.d *= Math.exp(e.deltaY * 0.0012); }, { passive: false });
addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || !$('#editor').classList.contains('hidden')) return;
  for (const s of ['dum', 'tak', 'ka']) if (STK[s].keys.includes(e.code) && PERFORMANCE[S.inst.id].strokes[s]) { e.preventDefault(); userStrike(s, e.shiftKey ? 'w' : S.level); }
});
// الدرج
const mainEl = $('#main'), dbtn = $('#drawer-btn');
function setDrawer(open) { mainEl.classList.toggle('closed', !open); dbtn.setAttribute('aria-expanded', String(open)); dbtn.textContent = open ? '✕ إخفاء الشرح' : '☰ الشرح'; }
dbtn.addEventListener('click', () => setDrawer(mainEl.classList.contains('closed')));
setDrawer(params.get('drawer') ? params.get('drawer') === '1' : innerWidth > 900);

// ---------- حلقة الرسم ----------
function resize() { const w = stage.clientWidth, hh = stage.clientHeight; if (!w || !hh) return; const was = camera.aspect; renderer.setSize(w, hh, false); camera.aspect = w / hh; lastOff = -1; camera.updateProjectionMatrix(); if (S.model && (was < 1) !== (camera.aspect < 1)) resetView(); }
new ResizeObserver(resize).observe(stage);
const v3 = new THREE.Vector3(); let last = performance.now(), lastOff = -1; const bottomEl = $('#bottom');
function frame(now) {
  const dtR = Math.min(0.5, (now - last) / 1000), dt = Math.min(0.05, dtR); last = now; requestAnimationFrame(frame);   // dtR: الزمن الحقيقي (للآثار المؤقتة حتى لو تباطأ الرسم)
  const tv = audio.heardNow;
  transport.frame(tv);
  if (S.fx.length) { const due = S.fx.filter((f) => f.t <= tv); if (due.length) { S.fx = S.fx.filter((f) => f.t > tv); due.forEach((f) => f.fn()); } }
  const m = S.model; if (!m) return;
  if (performer) performer.update(dt);   // يحرّك اليدين، ويرفع الآلة المحمولة أو يعيدها إلى الأرض حسب الوضع
  // جولة تلقائية
  if (S.tour && S.tour.auto) { S.tour.timer += dt; if (S.tour.timer > 4.5) { S.tour.timer = 0; tourStep(S.tour.i + 1); } }
  // التمرير فوق الأجزاء: تلميح + هالة حمراء
  if (hoverAt && S.mode === 'explore') {
    const q = pick(hoverAt.x, hoverAt.y), pt = q && q.object.userData.part, tip = $('#tip');
    if (pt) { const r = stage.getBoundingClientRect(); tip.textContent = pt.n; tip.classList.remove('hidden'); tip.style.transform = `translate(${hoverAt.x - r.left + 14}px, ${hoverAt.y - r.top - 38}px)`; canvas.style.cursor = 'pointer'; }
    else { tip.classList.add('hidden'); canvas.style.cursor = ''; }
    S.hover = pt ? pt.n : null; highlight(S.hover || S.sel); hoverAt = null;
  }
  const dmin = m.R * 1.6, dmax = Math.max(m.R, m.height) * 9; view.g.d = Math.max(dmin, Math.min(dmax, view.g.d));
  const k = 1 - Math.exp(-dt * 9); view.theta += (view.g.theta - view.theta) * k; view.phi += (view.g.phi - view.phi) * k; view.d += (view.g.d - view.d) * k;
  const lift = performer && performer.present ? performer.amt * performer.present.lift : 0;   // الآلة المحمولة مرفوعة في يد العازف
  const tgtY = S.mode === 'explore' ? m.height * 0.5 : m.top * 0.85 + 0.02 + lift; view.target.y += (tgtY - view.target.y) * k;
  const dz = S.mode === 'explore' ? 0 : m.R * 0.25; view.target.z += (dz - view.target.z) * k;
  // مركز المشهد في الجزء الظاهر فوق الشريط السفلي (المدوّنة والأزرار) لا خلفه — حتى تبقى الآلة واليدان مرئية
  const bh = bottomEl.offsetHeight, offY = Math.round(Math.min(bh, stage.clientHeight * 0.55) * (S.mode === 'explore' ? 0.5 : 0.9));
  if (offY !== lastOff) { lastOff = offY; const w0 = stage.clientWidth, h0 = stage.clientHeight; camera.aspect = w0 / (h0 + offY); if (offY > 0) camera.setViewOffset(w0, h0 + offY, 0, offY, w0, h0); else camera.clearViewOffset(); camera.updateProjectionMatrix(); }
  camera.position.set(view.target.x + view.d * Math.sin(view.phi) * Math.sin(view.theta), view.target.y + view.d * Math.cos(view.phi), view.target.z + view.d * Math.sin(view.phi) * Math.cos(view.theta)); camera.lookAt(view.target);
  S.hits = animateHead(m.head, S.hits, dtR);
  for (const r of S.ripples) { r.userData.t += dtR; const t = r.userData.t / 0.38; r.scale.setScalar(r.userData.r0 * (1 + 2.6 * t)); r.material.opacity = Math.max(0, 0.95 * (1 - t)); }
  S.ripples = S.ripples.filter((r) => { if (r.userData.t < 0.38) return true; m.group.remove(r); r.geometry.dispose(); r.material.dispose(); return false; });
  for (const j of m.jingles) { const J = j.userData.jingle; if (J.k > 0.01) { J.k *= Math.exp(-dt * 9); j.position.y = J.y + Math.sin(now * 0.09 + J.y * 900) * 0.0016 * J.k; j.rotation.z = Math.sin(now * 0.07 + J.y * 500) * 0.12 * J.k; } else if (J.k) { J.k = 0; j.position.y = J.y; j.rotation.z = 0; } }
  const w = stage.clientWidth, hh = stage.clientHeight;
  for (let i = zl.length - 1; i >= 0; i--) { const L = zl[i]; L.t += dtR; if (L.t > 0.75) { L.e.remove(); zl.splice(i, 1); continue; } v3.copy(L.p).applyMatrix4(m.group.matrixWorld).project(camera); L.e.style.opacity = String(Math.min(1, (0.75 - L.t) / 0.3)); L.e.style.transform = `translate(${(v3.x + 1) / 2 * w}px, ${(1 - v3.y) / 2 * hh - 26 - L.t * 18}px) translate(-50%,-50%)`; }
  if (!window.__noRender) renderer.render(scene, camera);
}
resize(); selectInstrument(params.get('inst') || INSTRUMENTS[0].id); if (params.get('mode')) setMode(params.get('mode'));
requestAnimationFrame(frame);
window.percCam = camera;
window.percViewer = { S, audio, transport, get performer() { return performer; }, get hands() { return hands; }, selectInstrument, setMode, perform, demo, view, loadPiece, allDefs, clickNote, openEditorFor, commitMine, highlight, showPart, partsOf, startTour, tourStep, stopPlay, startPlay,
  rateAt: (stroke, t) => { rate(stroke, t); const f = $('#fb'); return f && f.textContent; },
  get ready() { return !!S.model && audio.ready(S.inst); } };
