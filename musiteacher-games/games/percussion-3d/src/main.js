// =====================================================================
//  عالم الآلات الإيقاعية الشرقية — MusiTeacher
//  خمس آلات واقعية ثلاثية الأبعاد تُعزف بالنقر/اللمس/لوحة المفاتيح، بتسجيلات حقيقية، مع الدُم والتك ومواضع النبر.
//  البنية: data/ (آلات وأنماط) · audio/ (محرّك الصوت) · models/ (النماذج والخامات) · game/ (ساعة الإيقاع) · هذا الملف (المشهد والواجهة).
// =====================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { INSTRUMENTS, STROKES, instById, strokeAt } from './data/instruments.js';
import { RHYTHMS, rhythmById } from './data/rhythms.js';
import { AudioEngine } from './audio/engine.js';
import { BUILDERS, animateHead } from './models/builders.js';
import { Transport, judge } from './game/transport.js';

const $ = (s) => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); } for (const c of kids.flat()) if (c != null) e.append(c); return e; };
const params = new URLSearchParams(location.search);

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
const S = { inst: INSTRUMENTS[0], mode: 'explore', level: 's', zonesOn: false, model: null, hits: [], ripples: [], flashes: { dum: 0, tak: 0 }, marks: new Map(), loopStats: null };
const view = { theta: 0.35, phi: 1.0, d: 1, target: new THREE.Vector3(), g: { theta: 0.35, phi: 1.0, d: 1 } };
const zoneMeshes = []; let zoneLabels = [];
const transport = new Transport(audio, onStep);
transport.play = (cell, time, gain) => audio.hit(S.inst, cell.stroke, cell.level, { when: time, gain });
transport.setPattern(rhythmById(RHYTHMS[0].id));

// ---------- بناء الآلة ----------
function disposeModel() {
  if (!S.model) return; scene.remove(S.model.group);
  S.model.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); for (const m of [].concat(o.material)) { if (m.map) m.map.dispose(); m.dispose(); } } });
  zoneMeshes.length = 0; S.model = null;
}
function selectInstrument(id) {
  const inst = instById(id) || INSTRUMENTS[0]; S.inst = inst; disposeModel();
  const m = BUILDERS[inst.model](); S.model = m; scene.add(m.group); S.hits = []; S.ripples = [];
  // مواضع الضرب: قرص وحلقة ملوّنان فوق الرقمة بلون الضربة
  for (const z of inst.zones) {
    const geo = z.r[0] === 0 ? new THREE.CircleGeometry(m.R * z.r[1], 64) : new THREE.RingGeometry(m.R * z.r[0], m.R * Math.min(1, z.r[1]), 64);
    const zm = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: STROKES[z.stroke].color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    zm.rotation.x = -Math.PI / 2; zm.position.y = m.top + 0.0012; zm.renderOrder = 3; zm.userData.zone = z; m.group.add(zm); zoneMeshes.push(zm);
  }
  const size = Math.max(m.R * 2.3, m.height * 1.15); view.g.d = size / (2 * Math.tan(camera.fov * Math.PI / 360)) * 1.28; view.target.set(0, m.height * 0.55, 0);
  floor.scale.setScalar(Math.max(0.5, m.R * 5)); const sc = Math.max(0.3, m.R * 2.2 + m.height * 0.6); Object.assign(key.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc }); key.shadow.camera.updateProjectionMatrix();
  document.querySelectorAll('#insts button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === inst.id)));
  buildZoneLabels(); setMode(S.mode);
  $('#loading').classList.remove('hidden');
  audio.load(inst).then((ok) => { if (S.inst === inst) { $('#loading').classList.add('hidden'); if (!ok) setFb('تعذّر تحميل أصوات هذه الآلة. تحقّق من الاتصال ثم أعد المحاولة.', 'bad'); } });
}
function buildZoneLabels() {
  const box = $('#zlabels'); box.replaceChildren(); zoneLabels = [];
  for (const z of S.inst.zones) { const mid = z.r[0] === 0 ? 0 : (z.r[0] + Math.min(1, z.r[1])) / 2; const e = h('div', { class: 'zl ' + z.stroke }, STROKES[z.stroke].ar); box.append(e); zoneLabels.push({ e, p: new THREE.Vector3(-S.model.R * mid * 0.92, S.model.top + 0.004, S.model.R * mid * 0.38) }); }
}

// ---------- الضربة: صوت + حركة ----------
function zonePoint(stroke) {
  const z = S.inst.zones.find((q) => q.stroke === stroke), R = S.model.R;
  if (z.r[0] === 0) { const a = Math.random() * 6.283, r = R * 0.16 * Math.random(); return { x: r * Math.sin(a), z: r * Math.cos(a) }; }
  const a = 0.5 + Math.random() * 0.7, r = R * (z.r[0] + Math.min(1, z.r[1])) / 2; return { x: r * Math.sin(a), z: r * Math.cos(a) };
}
/** الحركة فقط (تُستدعى لحظة سماع الضربة) */
function visual(stroke, level, pt) {
  if (!S.model) return; const p = pt || zonePoint(stroke), R = S.model.R, rho = Math.hypot(p.x, p.z) / R;
  S.hits.push({ x: p.x, z: p.z, amp: (level === 's' ? 0.05 : 0.024) * (stroke === 'dum' ? 1 : 0.6), t: 0 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 40), new THREE.MeshBasicMaterial({ color: STROKES[stroke].color, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, S.model.top + 0.002, p.z); ring.renderOrder = 6; ring.userData = { t: 0, r0: R * (level === 's' ? 0.07 : 0.045) }; S.model.group.add(ring); S.ripples.push(ring);
  S.flashes[stroke] = 1;
  for (const j of S.model.jingles) j.userData.jingle.k = Math.max(j.userData.jingle.k, (level === 's' ? 1 : 0.55) * (stroke === S.inst.jinglesStroke || rho > 0.5 ? 1 : 0.45));
  const pad = document.querySelector(`.pad.${stroke}`); if (pad) { pad.classList.add('flash'); clearTimeout(pad._t); pad._t = setTimeout(() => pad.classList.remove('flash'), 110); }
}
/** ضربة من المستخدم: صوت فوري + حركة + (في وضع العزف) مقارنة بالنمط */
function strike(stroke, pt, level = S.level) {
  if (!S.model) return; const p = pt || zonePoint(stroke), rho = Math.min(1, Math.hypot(p.x, p.z) / S.model.R);
  const when = audio.hit(S.inst, stroke, level, { rho });
  visual(stroke, level, p);
  if (S.mode === 'play' && transport.playing && when != null) rate(stroke, audio.now);
}
function rate(stroke, t) {
  const j = judge(transport, stroke, t); if (!j) { setFb('خارج موضع الضربات — تابع المؤشر المتحرك', 'near'); return; }
  const key = j.loopNo + ':' + j.idx; if (S.marks.has(key)) return;
  const cls = j.ok ? 'good' : j.strokeOk ? 'near' : 'bad'; S.marks.set(key, cls);
  const cell = document.querySelector(`.cell[data-i="${j.idx}"]`); if (cell) { cell.classList.remove('good', 'near', 'bad'); cell.classList.add(cls); }
  setFb(j.ok ? 'في وقتها تمامًا ✓' : j.strokeOk ? (j.dt < 0 ? 'مبكرة قليلًا' : 'متأخرة قليلًا') : `الضربة المطلوبة هنا: ${STROKES[transport.pattern.cells[j.idx].stroke].ar}`, cls);
}
function onStep(cell, idx, time, loopNo) {
  if (idx < 0) { setPlayBtn(); return; }
  document.querySelectorAll('.cell.on').forEach((c) => c.classList.remove('on'));
  const el = document.querySelector(`.cell[data-i="${idx}"]`); if (el) el.classList.add('on');
  if (idx === 0 && S.mode === 'play') {                      // بداية دورة: ملخّص الدورة السابقة ومسح العلامات
    if (loopNo > 0) { let good = 0; const need = transport.pattern.cells.filter(Boolean).length; for (const [k, v] of S.marks) if (k.startsWith((loopNo - 1) + ':') && v === 'good') good++; if ([...S.marks.keys()].some((k) => k.startsWith((loopNo - 1) + ':'))) setFb(good === need ? 'أحسنت في الأداء — كل الضربات في وقتها' : `الدورة السابقة: ${good} من ${need} ضربات في وقتها`, good === need ? 'good' : ''); }
    for (const k of [...S.marks.keys()]) if (!k.startsWith(loopNo + ':')) S.marks.delete(k);
    document.querySelectorAll('.cell').forEach((c) => c.classList.remove('good', 'near', 'bad'));
  }
  if (cell && transport.guide > 0) visual(cell.stroke, cell.level);
}
function setFb(txt, cls = '') { const f = $('#fb'); if (f) { f.textContent = txt; f.style.color = cls ? `var(--${cls})` : ''; } }

// ---------- الواجهة ----------
const MODES = [['explore', 'اكتشف'], ['strokes', 'الضربات'], ['accent', 'النبر والإيقاع'], ['play', 'اعزف']];
$('#insts').append(...INSTRUMENTS.map((i) => h('button', { 'data-id': i.id, 'aria-pressed': 'false', onclick: () => selectInstrument(i.id) }, i.name)));
function hearBtn(stroke, level, label) { return h('button', { onpointerdown: (e) => { e.preventDefault(); strike(stroke, null, level); } }, label); }
function setMode(m) {
  S.mode = m; const inst = S.inst, P = $('#panel');
  const withTL = m === 'accent' || m === 'play'; if (!withTL && transport.playing) { transport.stop(); audio.stopAll(); }
  transport.guide = m === 'play' ? (S.guideOn === false ? 0 : 0.55) : 1;
  S.zonesOn = m !== 'explore'; view.g.phi = m === 'explore' ? 1.05 : 0.62; view.g.theta = m === 'explore' ? 0.35 : 0;
  $('#timeline').classList.toggle('hidden', !withTL); if (withTL) buildTimeline();
  const modes = h('div', { id: 'modes' }, MODES.map(([k, l]) => h('button', { 'aria-pressed': String(k === m), onclick: () => setMode(k) }, l)));
  const title = [h('h2', {}, inst.name), h('span', { class: 'badge' }, inst.family)];
  let body = [];
  if (m === 'explore') {
    body = [...inst.facts.flatMap(([t, d]) => [h('h3', {}, t), h('p', {}, d)]),
      h('h3', {}, 'استمع إلى الصوت'), h('div', { class: 'lis' }, hearBtn('dum', 's', '● دُم'), hearBtn('tak', 's', '○ تك')),
      h('div', { class: 'box', id: 'part' }, 'أدر الآلة بالسحب، وكبّرها بالعجلة أو بإصبعين. انقر أي جزء لمعرفة اسمه ووظيفته، أو انقر الرقمة لسماع صوتها.')];
  } else if (m === 'strokes') {
    const card = (s) => h('div', { class: 'sk ' + s }, h('b', {}, `${s === 'dum' ? '●' : '○'} ${STROKES[s].ar}`), h('span', {}, ` — ${STROKES[s].hint}`),
      h('p', {}, `موضعها على ${inst.name}: ${inst.where[s]}.`), h('div', { class: 'row' }, hearBtn(s, 's', 'ضربة قوية'), hearBtn(s, 'w', 'ضربة خفيفة')));
    body = [h('p', {}, 'لكل ضربة موضع على الآلة ولون ثابت. انقر الموضع الملوّن على الرقمة واسمع الفرق.'), card('dum'), card('tak'),
      inst.zonesAssumed ? h('div', { class: 'note' }, 'الدرس يذكر أن لكل من الدُم والتك مكانًا على هذا الطبل دون تحديده؛ الموضعان المعروضان هنا تقريب تعليمي.') : null,
      h('div', { class: 'note', html: 'لوحة المفاتيح: <kbd>D</kbd> أو <kbd>مسافة</kbd> للدُم · <kbd>K</kbd> للتك · مع <kbd>Shift</kbd> ضربة خفيفة.' })];
  } else if (m === 'accent') {
    body = [h('p', {}, 'النبر هو الضربة الأقوى في الميزان. شاهد النمط واسمع الفرق بين الضربة القوية والخفيفة.'),
      h('div', { class: 'legend' }, h('span', {}, h('i', { class: 'dot dum s' }, 'دُم'), 'قوية'), h('span', {}, h('i', { class: 'dot dum w' }, 'دُم'), 'خفيفة'), h('span', {}, h('i', { class: 'dot tak s' }, 'تك'), 'قوية'), h('span', {}, h('i', { class: 'dot tak w' }, 'تك'), 'خفيفة')),
      h('div', { class: 'box' }, 'العلامة ‹ > › فوق الخانة تدل على موضع النبر. الدائرة الأكبر = ضربة أقوى. الأرقام هي نبضات الميزان.'),
      h('div', { class: 'box', id: 'about' }, transport.pattern.about)];
  } else {
    body = [h('p', {}, 'شغّل النمط ثم اعزف معه: انقر موضع الدُم أو التك على الآلة (أو الزرّين أسفلها) عندما يصل المؤشر إلى الخانة.'),
      h('div', { class: 'box' }, 'إطار أخضر: الضربة في وقتها · أصفر: مبكرة أو متأخرة قليلًا · أحمر: نوع الضربة مختلف.'),
      h('div', { class: 'box', id: 'about' }, transport.pattern.about),
      h('div', { class: 'note', html: 'لوحة المفاتيح: <kbd>D</kbd> أو <kbd>مسافة</kbd> للدُم · <kbd>K</kbd> للتك · مع <kbd>Shift</kbd> ضربة خفيفة.' })];
  }
  P.replaceChildren(modes, ...title, ...body.filter(Boolean),
    h('div', { class: 'note' }, inst.id === 'kasir' || inst.id === 'rahmani' ? 'الأصوات تسجيلات حقيقية لطبول جلدية قريبة الطابع (لا تتوفر بعدُ تسجيلات مرخّصة لهذه الآلة نفسها).' : 'الأصوات تسجيلات حقيقية مرخّصة (CC0).'));
  buildPads();
}
function buildPads() {
  const lv = (k, l) => h('button', { 'aria-pressed': String(S.level === k), onclick: () => { S.level = k; buildPads(); } }, l);
  $('#pads').replaceChildren(
    h('button', { class: 'pad dum', onpointerdown: (e) => { e.preventDefault(); strike('dum'); } }, '● دُم', h('small', {}, S.inst.where.dum)),
    h('button', { class: 'pad tak', onpointerdown: (e) => { e.preventDefault(); strike('tak'); } }, '○ تك', h('small', {}, S.inst.where.tak)),
    h('div', { class: 'mini' }, 'الشدّة', lv('s', 'قوية'), lv('w', 'خفيفة')),
    h('div', { class: 'mini' }, '🔊', h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(audio.volume), 'aria-label': 'مستوى الصوت', oninput: (e) => audio.setVolume(+e.target.value) })),
    h('div', { class: 'mini' }, h('button', { title: 'إعادة المنظر', onclick: () => { view.g.theta = S.mode === 'explore' ? 0.35 : 0; view.g.phi = S.mode === 'explore' ? 1.05 : 0.62; } }, '⟲ المنظر')));
}
function setPlayBtn() { const b = $('#tp-play'); if (b) b.textContent = transport.playing ? '■ إيقاف' : '▶ تشغيل'; if (!transport.playing) document.querySelectorAll('.cell.on').forEach((c) => c.classList.remove('on')); }
function buildTimeline() {
  const p = transport.pattern, row = h('div', { class: 'tl-row', style: `grid-template-columns:repeat(${p.total},1fr)` });
  p.cells.forEach((c, i) => {
    const beat = i % p.div === 0, cell = h('div', { class: 'cell' + (beat && i ? ' beat' : ''), 'data-i': String(i) });
    if (beat) cell.append(h('span', { class: 'bn' }, String(i / p.div + 1)));
    if (c) { if (c.level === 's') cell.append(h('span', { class: 'ac' }, '>')); cell.append(h('i', { class: `dot ${c.stroke} ${c.level}` }, STROKES[c.stroke].ar)); } else cell.append(h('span', { class: 'rest' }, '·'));
    cell.addEventListener('pointerdown', () => { if (c && !transport.playing) strike(c.stroke, null, c.level); });
    row.append(cell);
  });
  const sel = h('select', { 'aria-label': 'النمط الإيقاعي', onchange: (e) => { transport.setPattern(rhythmById(e.target.value)); S.marks.clear(); buildTimeline(); const a = $('#about'); if (a) a.textContent = transport.pattern.about; } }, RHYTHMS.map((r) => h('option', { value: r.id }, `${r.name} (${r.meter[0]}/${r.meter[1]})`))); sel.value = p.id;
  const out = h('output', {}, String(transport.bpm));
  const ctl = h('div', { class: 'tl-ctl' },
    h('button', { id: 'tp-play', onclick: async () => { if (transport.playing) { transport.stop(); audio.stopAll(); } else { audio.ensure(); await audio.load(S.inst); S.marks.clear(); transport.start(); } setPlayBtn(); } }, '▶ تشغيل'), sel,
    h('label', {}, 'السرعة', h('input', { type: 'range', min: '50', max: '140', step: '2', value: String(transport.bpm), oninput: (e) => { transport.setBpm(+e.target.value); out.textContent = e.target.value; } }), out),
    h('label', {}, h('input', { type: 'checkbox', ...(transport.loop ? { checked: '' } : {}), onchange: (e) => { transport.loop = e.target.checked; } }), 'تكرار'),
    S.mode === 'play' ? h('label', {}, h('input', { type: 'checkbox', ...(S.guideOn === false ? {} : { checked: '' }), onchange: (e) => { S.guideOn = e.target.checked; transport.guide = e.target.checked ? 0.55 : 0; } }), 'عزف مرافق') : null,
    h('span', { id: 'fb' }));
  $('#timeline').replaceChildren(row, ctl); setPlayBtn();
}

// ---------- الإدخال: العزف بالنقر/اللمس (عند الضغط لا عند الرفع) وتدوير الآلة بالسحب ----------
const ray = new THREE.Raycaster(), ptrs = new Map(); let pinch0 = 0;
function pick(e) {
  const r = canvas.getBoundingClientRect(); ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, camera);
  return ray.intersectObject(S.model.group, true).find((x) => x.object.userData.part);
}
canvas.addEventListener('pointerdown', (e) => {
  if (!S.model) return; canvas.setPointerCapture(e.pointerId);
  const hit = pick(e), rec = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, played: false, hit };
  if (hit) {
    const lp = S.model.group.worldToLocal(hit.point.clone());
    if (hit.object === S.model.head) { strike(strokeAt(S.inst, Math.hypot(lp.x, lp.z) / S.model.R), { x: lp.x, z: lp.z }); rec.played = true; }
    else if (S.inst.jinglesStroke && /الصنوج/.test(hit.object.userData.part.n)) { const k = S.model.R * 0.97 / Math.hypot(lp.x, lp.z); strike(S.inst.jinglesStroke, { x: lp.x * k, z: lp.z * k }); rec.played = true; }
  }
  ptrs.set(e.pointerId, rec);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 && !a.played && !b.played) view.g.d *= pinch0 / d; pinch0 = d; return; }
  if (p.played) return;
  view.g.theta -= dx * 0.008; view.g.phi = Math.max(0.12, Math.min(1.5, view.g.phi - dy * 0.006));
});
const up = (e) => {
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); if (!p) return;
  if (S.mode === 'explore' && p.hit && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6) { const pt = p.hit.object.userData.part, box = $('#part'); if (box) box.innerHTML = `<b>${pt.n}</b><br>${pt.d}`; }
};
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); view.g.d *= Math.exp(e.deltaY * 0.0012); }, { passive: false });
addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  for (const s of ['dum', 'tak']) if (STROKES[s].keys.includes(e.code)) { e.preventDefault(); strike(s, null, e.shiftKey ? 'w' : S.level); }
});

// ---------- حلقة الرسم ----------
function resize() { const w = stage.clientWidth, hh = stage.clientHeight; if (!w || !hh) return; renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(stage);
const v3 = new THREE.Vector3(); let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; requestAnimationFrame(frame);
  transport.frame();
  const m = S.model; if (!m) return;
  const dmin = m.R * 1.6, dmax = Math.max(m.R, m.height) * 9; view.g.d = Math.max(dmin, Math.min(dmax, view.g.d));
  const k = 1 - Math.exp(-dt * 9); view.theta += (view.g.theta - view.theta) * k; view.phi += (view.g.phi - view.phi) * k; view.d += (view.g.d - view.d) * k;
  const tgtY = S.mode === 'explore' ? m.height * 0.5 : m.top * 0.8; view.target.y += (tgtY - view.target.y) * k;
  camera.position.set(view.target.x + view.d * Math.sin(view.phi) * Math.sin(view.theta), view.target.y + view.d * Math.cos(view.phi), view.target.z + view.d * Math.sin(view.phi) * Math.cos(view.theta)); camera.lookAt(view.target);
  S.hits = animateHead(m.head, S.hits, dt);
  for (const r of S.ripples) { r.userData.t += dt; const t = r.userData.t / 0.38; r.scale.setScalar(r.userData.r0 * (1 + 2.6 * t)); r.material.opacity = Math.max(0, 0.95 * (1 - t)); }
  S.ripples = S.ripples.filter((r) => { if (r.userData.t < 0.38) return true; m.group.remove(r); r.geometry.dispose(); r.material.dispose(); return false; });
  for (const j of m.jingles) { const J = j.userData.jingle; if (J.k > 0.01) { J.k *= Math.exp(-dt * 9); j.position.y = J.y + Math.sin(now * 0.09 + J.y * 900) * 0.0016 * J.k; j.rotation.z = Math.sin(now * 0.07 + J.y * 500) * 0.12 * J.k; } else if (J.k) { J.k = 0; j.position.y = J.y; j.rotation.z = 0; } }
  for (const s of ['dum', 'tak']) S.flashes[s] *= Math.exp(-dt * 7);
  for (const z of zoneMeshes) z.material.opacity = (S.zonesOn ? 0.13 : 0) + 0.4 * S.flashes[z.userData.zone.stroke];
  const w = stage.clientWidth, hh = stage.clientHeight;
  for (const L of zoneLabels) { v3.copy(L.p).applyMatrix4(m.group.matrixWorld).project(camera); L.e.style.opacity = S.zonesOn ? '1' : '0'; L.e.style.transform = `translate(${(v3.x + 1) / 2 * w}px, ${(1 - v3.y) / 2 * hh}px) translate(-50%,-50%)`; }
  if (!window.__noRender) renderer.render(scene, camera);
}
resize(); selectInstrument(params.get('inst') || INSTRUMENTS[0].id); if (params.get('mode')) setMode(params.get('mode'));
requestAnimationFrame(frame);
window.percCam = camera; window.percViewer = { S, audio, transport, selectInstrument, setMode, strike, view, get ready() { return !!S.model && audio.ready(S.inst); } };
