// =====================================================================
//  آلات الباند – MusiTeacher: واجهة الآلات، مساحة العرض التفاعلية، عزف الباند، وقائمة المصادر.
// =====================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { INSTRUMENTS, instById, soundKeys, glockSample, noteName, SCORE, SOURCES, LEVELS } from './data.js';
import { BUILDERS } from './models.js';
import { AudioEngine } from './audio.js';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const app = $('#app'), canvas = $('#scene'), stage = $('#view'), labels = $('#labels');
const audio = new AudioEngine();
const S = { view: 'home', inst: null, level: 's', tab: 'def', live: new Map(), queue: [], holds: new Map(), band: { on: false, bpm: SCORE.bpm, me: new Set(), start: 0, next: 0, cur: -1 } };

// ------------------------------------------------------------------ المشهد
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { $('#nogl').hidden = false; }
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, 0.01, 30), root = new THREE.Group(); scene.add(root);
function setupScene(sc, rd) {
  rd.outputColorSpace = THREE.SRGBColorSpace; rd.toneMapping = THREE.ACESFilmicToneMapping; rd.toneMappingExposure = 1.05; rd.shadowMap.enabled = true; rd.shadowMap.type = THREE.PCFSoftShadowMap;
  const pm = new THREE.PMREMGenerator(rd); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; sc.environmentIntensity = 0.75;
  const key = new THREE.DirectionalLight(0xfff1dc, 2.4); key.position.set(1.2, 2.4, 1.6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01;
  Object.assign(key.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4, near: 0.1, far: 8 }); sc.add(key); sc.add(key.target);
  const rim = new THREE.DirectionalLight(0x9fc4ff, 0.9); rim.position.set(-1.6, 1.2, -1.4); sc.add(rim); sc.add(new THREE.HemisphereLight(0xdfe6ff, 0x2a2018, 0.45));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: 0.38 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor); return floor;
}
let floor = null; if (renderer) { renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); floor = setupScene(scene, renderer); }
const VIEW = { cymbals: [-0.55, 0.12], glock: [0.3, 0.62], snare: [0.4, 0.5], wood: [0.5, 0.42], bass: [0.5, 0.12], tamb: [0.3, 0.2], claves: [0.15, 0.5], triangle: [0.2, 0.08], maracas: [0.2, 0.15] };
const cam = { az: 0.45, el: 0.22, dist: 1, target: new THREE.Vector3(), min: 0.2, max: 4, home: null };
function placeCam(c = camera, o = cam) { const ce = Math.cos(o.el); c.position.set(o.target.x + o.dist * ce * Math.sin(o.az), o.target.y + o.dist * Math.sin(o.el), o.target.z + o.dist * ce * Math.cos(o.az)); c.lookAt(o.target); }
function fit(group, o = cam, c = camera, pad = 1.2) {
  const box = new THREE.Box3().setFromObject(group), sp = box.getBoundingSphere(new THREE.Sphere());
  const half = THREE.MathUtils.degToRad(c.fov / 2), asp = Math.min(1, c.aspect); o.target.copy(sp.center); o.dist = sp.radius / Math.sin(Math.atan(Math.tan(half) * asp)) * pad;
  o.min = o.dist * 0.35; o.max = o.dist * 2.2; return box;
}
function resize() { if (!renderer) return; const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(stage);

function dispose(obj) { obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); }
function build(id) { const inst = instById(id), mdl = BUILDERS[inst.model](inst); mdl.inst = inst; mdl.group.userData.inst = id; return mdl; }
/** يرفع الآلة المحمولة باليد فوق الأرضية، ويضع ما له قاعدة على الأرض */
function seat(mdl, lift = 0.16) { const box = new THREE.Box3().setFromObject(mdl.group); const grounded = ['bass', 'snare', 'glock', 'wood'].includes(mdl.inst.id); mdl.group.position.y += (grounded ? 0 : lift) - box.min.y; }
function clearLive() { for (const m of S.live.values()) { root.remove(m.group); dispose(m.group); } S.live.clear(); labels.innerHTML = ''; stopHolds(); }

// ------------------------------------------------------------------ الصوت والعزف
function fireModel(id, act, level, d) { const m = S.live.get(id); if (m) m.fire(act, level, d || {}); flash(id); }
function trigger(id, actId, level = S.level, d = {}, when) {
  const inst = instById(id), act = inst.acts.find((a) => a.id === actId) || inst.acts[0]; let voice = null;
  if (inst.bars) { const midi = d.midi ?? inst.bars[d.bar ?? 0]; if (d.bar == null) d.bar = inst.bars.indexOf(midi); const g = glockSample(midi, level); voice = audio.play(g.key, { rate: g.rate, when, gain: level === 'w' ? 0.85 : g.key.includes('medium') ? 1.25 : 1, group: 'gl' + midi, fade: 0.02 }); }
  else {
    const keys = act.snd[level] || act.snd.s, gain = !act.snd[level] && level === 'w' ? (act.soft ?? 0.5) : 1;
    if (act.burst) act.burst.forEach((o, i) => { voice = audio.play(keys, { when: (when ?? audio.now) + o, gain: gain * (act.gains ? act.gains[i] : i % 2 ? 0.8 : 1) }); });
    else voice = audio.play(keys, { when, gain, group: act.group, fade: act.fade, loop: act.hold && !when ? [0.4, 0.6] : null });
  }
  if (when && when > audio.now + 0.02) S.queue.push({ t: when, f: () => fireModel(id, act.id, level, d) }); else fireModel(id, act.id, level, d);
  return { voice, act };
}
function startHold(token, id, actId, d) { const r = trigger(id, actId, S.level, d); if (r.act.hold) S.holds.set(token, { id, voice: r.voice }); }
function endHold(token) { const h = S.holds.get(token); if (!h) return; S.holds.delete(token); if (h.voice) h.voice.stop(0.07); const m = S.live.get(h.id); if (m && m.stop) m.stop(); }
function stopHolds() { for (const k of [...S.holds.keys()]) endHold(k); }

// ------------------------------------------------------------------ الواجهة الرئيسية
function buildHome() {
  const cards = $('#cards'); cards.innerHTML = '';
  const bc = el('button', 'card bandc', `<span class="ic">🎼</span><span><b>عزف الباند</b><i style="direction:rtl">الآلات معًا في مدوّنة «${SCORE.title}» من دليل المعلم — استمع، ثم اعزف أحد الأدوار.</i></span>`); bc.onclick = () => go('band'); cards.append(bc);
  for (const inst of INSTRUMENTS) {
    const c = el('button', 'card', `<span class="th"><img alt="${inst.ar}" data-th="${inst.id}"></span><span class="tx"><b>${inst.ar}</b><i>${inst.en}</i><br><span class="tag ${inst.src === 'guide' ? 'g' : ''}">${inst.src === 'guide' ? 'من دليل المعلم' : 'آلة مضافة'}</span></span>`);
    c.onclick = () => go('inst', inst.id); cards.append(c);
  }
  thumbs();
}
function thumbs() {   // صورة مصغّرة لكل آلة تُرسم من نموذجها نفسه، واحدة تلو الأخرى
  let rd; try { rd = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return; }
  rd.setSize(400, 300, false); const sc = new THREE.Scene(); setupScene(sc, rd); const c = new THREE.PerspectiveCamera(32, 4 / 3, 0.01, 30); let i = 0;
  const next = () => {
    if (i >= INSTRUMENTS.length) { rd.dispose(); rd.forceContextLoss(); return; }
    if (S.view !== 'home') { setTimeout(next, 600); return; }   // لا تزاحم العزف: تُستكمل المصغّرات عند العودة إلى الواجهة
    const m = build(INSTRUMENTS[i++].id); seat(m); sc.add(m.group); m.update(0.016); const vw = VIEW[m.inst.id] || [0.45, 0.2], o = { az: vw[0], el: vw[1], dist: 1, target: new THREE.Vector3() }; fit(m.group, o, c, 1.08); placeCam(c, o);
    rd.render(sc, c); const img = document.querySelector(`img[data-th="${m.inst.id}"]`); if (img) img.src = rd.domElement.toDataURL('image/png'); sc.remove(m.group); dispose(m.group); setTimeout(next, 30);
  };
  next();
}

// ------------------------------------------------------------------ التنقل
function go(view, id) {
  stopBand(); clearLive(); audio.stopAll(); S.view = view; app.className = view + (app.classList.contains('src-open') ? ' src-open' : '');
  $('#nav-home').classList.toggle('on', view !== 'band'); $('#nav-band').classList.toggle('on', view === 'band');
  $('#nav-home').textContent = view === 'home' ? 'الآلات' : '→ كل الآلات';
  if (view === 'inst') openInst(id); else if (view === 'band') openBand(); else S.inst = null;
  resize();
}
function loadSounds(ids) { const ld = $('#loading'); ld.hidden = false; const keys = ids.flatMap((i) => soundKeys(instById(i))); return audio.load(keys).then((ok) => { ld.hidden = true; if (!ok) { ld.hidden = false; ld.textContent = 'تعذّر تحميل بعض التسجيلات. تحقق من الاتصال ثم أعد فتح الآلة.'; } return ok; }); }

function openInst(id) {
  const inst = instById(id) || INSTRUMENTS[0]; S.inst = inst; S.tab = 'def'; const m = build(inst.id); seat(m); S.live.set(inst.id, m); root.add(m.group); resize();
  [cam.az, cam.el] = VIEW[inst.id] || [0.45, 0.2]; fit(m.group); cam.home = { az: cam.az, el: cam.el, dist: cam.dist }; m.box = new THREE.Box3().setFromObject(m.group);
  $('#hint').textContent = 'انقر على الآلة للعزف · اسحب للتدوير · العجلة أو إصبعان للتكبير';
  buildPanel(); buildBar(); loadSounds([inst.id]);
}
function buildPanel() {
  const inst = S.inst, p = $('#panel'), i = INSTRUMENTS.indexOf(inst), m = S.live.get(inst.id); p.innerHTML = '';
  const head = el('div', null, `<h2>${inst.ar}</h2><div class="en">${inst.en}</div><span class="tag">${inst.family}</span> <span class="tag ${inst.src === 'guide' ? 'g' : ''}">${inst.src === 'guide' ? 'النص من دليل المعلم' : 'آلة مضافة · معلومات من مراجع عامة'}</span>`); p.append(head);
  const tabs = el('div', 'row tabs'); const body = el('div');
  const T = { def: 'التعريف', parts: 'الأجزاء', how: 'طريقة العزف' };
  const show = (k) => {
    S.tab = k; [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.k === k)); body.innerHTML = ''; labels.innerHTML = '';
    if (k === 'parts') { const c = el('div', 'chips'); m.parts.forEach((o, j) => { const b = el('button', null, `${o.userData.part.n}<small>${o.userData.part.d}</small>`); b.onclick = () => { [...c.children].forEach((x) => x.classList.remove('on')); b.classList.add('on'); showPart(o); }; c.append(b); if (!j) setTimeout(() => S.tab === 'parts' && b.click(), 50); }); body.append(c); }
    else { body.append(el('div', 'body', k === 'def' ? inst.def : inst.how)); const ul = el('ul', 'try'); inst.acts.forEach((a) => ul.append(el('li', null, `<b>${a.ar}:</b> ${a.hint}${a.extra ? ' <span class="tag">أسلوب إضافي</span>' : ''}`))); body.append(el('div', 'tag g', 'جرّب على الآلة'), ul); }
  };
  for (const k in T) { const b = el('button', null, T[k]); b.dataset.k = k; b.onclick = () => show(k); tabs.append(b); }
  p.append(tabs, body);
  const nav = el('div', 'row'); const prev = el('button', null, '→ السابقة'), next = el('button', null, 'التالية ←'); prev.style.flex = next.style.flex = '1';
  prev.onclick = () => go('inst', INSTRUMENTS[(i + INSTRUMENTS.length - 1) % INSTRUMENTS.length].id); next.onclick = () => go('inst', INSTRUMENTS[(i + 1) % INSTRUMENTS.length].id); nav.append(prev, next); p.append(nav);
  show('def');
}
let partSel = null;
function showPart(o) { partSel = { o, t: 0, base: o.scale.clone() }; labels.innerHTML = ''; const l = el('div', 'lb', o.userData.part.n); labels.append(l); partSel.l = l; }
function buildBar() {
  const inst = S.inst, bar = $('#bar'); bar.innerHTML = '';
  for (const a of inst.acts) {
    if (!a.snd) continue; const b = el('button', 'act', `${a.ar}${a.key ? `<kbd>${a.key.replace('Key', '')}</kbd>` : ''}`); b.title = a.hint;
    b.onpointerdown = (e) => { e.preventDefault(); b.classList.add('down'); startHold(b, inst.id, a.id); };
    b.onpointerup = b.onpointerleave = b.onpointercancel = () => { b.classList.remove('down'); endHold(b); }; bar.append(b);
  }
  if (inst.bars) bar.append(el('label', null, 'انقر على القضبان، أو استخدم الأرقام 1–9 ثم 0 و Q W E'));
  const seg = el('div', 'seg'); for (const k in LEVELS) { const b = el('button', S.level === k ? 'on' : '', LEVELS[k]); b.onclick = () => { S.level = k; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); }; seg.append(b); } bar.append(seg);
  bar.append(volume()); const rv = el('button', null, 'إعادة ضبط العرض'); rv.onclick = () => { Object.assign(cam, cam.home); }; bar.append(rv);
}
function volume() { const l = el('label', null, 'الصوت'); const r = el('input'); r.type = 'range'; r.min = 0; r.max = 1; r.step = 0.01; r.value = audio.volume; r.oninput = () => audio.setVolume(+r.value); l.append(r); return l; }

// ------------------------------------------------------------------ عزف الباند
const BAND_POS = { bass: [0, -0.62, 1], glock: [0, 0.28, 1.25], jingles: [-0.62, 0.05, 1.7], castanets: [-0.33, 0.42, 1.7], triangle: [0.36, 0.42, 1.5], cymbals: [0.72, 0.02, 1.15] };
function openBand() {
  S.inst = null; resize();
  for (const r of SCORE.rows) { const m = build(r.inst), [x, z, k] = BAND_POS[r.inst]; m.group.scale.setScalar(k); seat(m, 0.3); m.group.position.x = x; m.group.position.z = z; S.live.set(r.inst, m); root.add(m.group); m.box = new THREE.Box3().setFromObject(m.group); const l = el('div', 'lb nm', r.inst === 'glock' ? 'الإكسيليفون المعدني' : instById(r.inst).ar); labels.append(l); m.label = l; }
  cam.az = 0; cam.el = 0.42; fit(root, cam, camera, 0.7); cam.home = { az: cam.az, el: cam.el, dist: cam.dist };
  $('#hint').textContent = 'شغّل المدوّنة للاستماع · انقر على أي آلة لتعزفها بنفسك · اسحب للتدوير';
  const bar = $('#bar'); bar.innerHTML = ''; const sc = el('div'); sc.id = 'score';
  SCORE.rows.forEach((r, ri) => {
    const row = el('div', 'r'), b = el('button', null, r.ar); b.title = 'اضغط لتعزف هذا الدور بنفسك (يتوقف العزف الآلي له)';
    b.onclick = () => { S.band.me.has(ri) ? S.band.me.delete(ri) : S.band.me.add(ri); b.classList.toggle('me'); row.querySelectorAll('.c').forEach((c) => c.classList.toggle('mute', S.band.me.has(ri))); }; row.append(b);
    for (let i = 0; i < SCORE.steps; i++) { const on = r.notes ? r.notes[i] != null : r.hits.includes(i); const c = el('div', 'c' + (on ? ' n' : '') + (i % 4 === 0 && i ? ' b' : ''), on && r.notes ? noteName(r.notes[i]) : ''); c.dataset.i = i; row.append(c); }
    sc.append(row);
  });
  bar.append(sc); const pl = el('button', 'act', '▶ تشغيل'); pl.id = 'bplay'; pl.onclick = () => (S.band.on ? stopBand() : startBand()); bar.append(pl);
  const tl = el('label', null, `السرعة <b id="bpmv">${S.band.bpm}</b>`); const tr = el('input'); tr.type = 'range'; tr.min = 60; tr.max = 132; tr.value = S.band.bpm; tr.oninput = () => { S.band.bpm = +tr.value; $('#bpmv').textContent = tr.value; }; tl.append(tr); bar.append(tl, volume());
  S.band.me.clear(); loadSounds(SCORE.rows.map((r) => r.inst));
}
const stepDur = () => 60 / S.band.bpm / 2;
function startBand() { if (!audio.ensure()) return; S.band.on = true; S.band.next = 0; S.band.t = audio.now + 0.15; $('#bplay').textContent = '■ إيقاف'; $('#bplay').classList.add('down'); }
function stopBand() { S.band.on = false; S.queue.length = 0; S.band.cur = -1; const b = $('#bplay'); if (b) { b.textContent = '▶ تشغيل'; b.classList.remove('down'); } document.querySelectorAll('#score .cur').forEach((c) => c.classList.remove('cur')); }
function schedule() {
  const B = S.band; if (!B.on) return;
  while (B.t < audio.now + 0.2) {
    const i = B.next % SCORE.steps, t = B.t;
    SCORE.rows.forEach((r, ri) => { if (B.me.has(ri)) return; if (r.notes) { if (r.notes[i] != null) trigger('glock', 'bar', 's', { midi: r.notes[i] }, t); } else if (r.hits.includes(i)) trigger(r.inst, 'hit', r.inst === 'cymbals' || i % 4 === 0 ? 's' : 'w', {}, t); });
    S.queue.push({ t, f: () => { B.cur = i; document.querySelectorAll('#score .c').forEach((c) => c.classList.toggle('cur', +c.dataset.i === i)); } });
    B.next++; B.t += stepDur();
  }
}
setInterval(schedule, 25);
function flash(id) { const m = S.live.get(id); if (m && m.label) { m.label.classList.add('hit'); clearTimeout(m.lt); m.lt = setTimeout(() => m.label.classList.remove('hit'), 160); } }

// ------------------------------------------------------------------ الإدخال: نقر للعزف، سحب للتدوير
const ray = new THREE.Raycaster(), ptr = new Map(); let pinch = 0;
function pick(e) {
  const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  for (const h of ray.intersectObject(root, true)) { let o = h.object, act = null, part = null, inst = null, bar = null; while (o) { if (!act && o.userData.act) { act = o.userData.act; bar = o.userData.bar; } if (!part && o.userData.part) part = o; if (o.userData.inst) inst = o.userData.inst; o = o.parent; } if (act) return { act, bar, part, inst, point: h.point, object: h.object }; }
  return null;
}
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); audio.ensure();
  if (ptr.size > 1) return; const h = pick(e); if (!h) return;
  startHold(e.pointerId, h.inst, h.act, { point: h.point, object: h.object, bar: h.bar });
  if (S.view === 'inst' && S.tab === 'parts' && h.part) { const j = S.live.get(h.inst).parts.indexOf(h.part), b = document.querySelectorAll('.chips button')[j]; if (b) b.click(); }
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptr.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) cam.dist = THREE.MathUtils.clamp(cam.dist * pinch / d, cam.min, cam.max); pinch = d; return; }
  cam.az -= dx * 0.006; cam.el = THREE.MathUtils.clamp(cam.el + dy * 0.005, -0.25, 1.35);
});
const up = (e) => { ptr.delete(e.pointerId); pinch = 0; endHold(e.pointerId); };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = THREE.MathUtils.clamp(cam.dist * Math.exp(e.deltaY * 0.001), cam.min, cam.max); }, { passive: false });
const BARKEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyQ', 'KeyW', 'KeyE'];
addEventListener('keydown', (e) => {
  if (e.repeat || e.target.tagName === 'INPUT') return;
  if (S.view === 'inst') { const inst = S.inst; if (inst.bars) { const b = BARKEYS.indexOf(e.code); if (b >= 0 && b < inst.bars.length) trigger(inst.id, 'bar', S.level, { bar: b }); return; } const a = inst.acts.find((x) => x.key === e.code) || (e.code === 'Space' ? inst.acts[0] : null); if (a) { e.preventDefault(); startHold('k' + e.code, inst.id, a.id); } }
  else if (S.view === 'band') { const i = ['Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(e.code); if (i >= 0) trigger(SCORE.rows[i + 1].inst, 'hit'); if (e.code === 'Space') { e.preventDefault(); S.band.on ? stopBand() : startBand(); } }
});
addEventListener('keyup', (e) => endHold('k' + e.code));

// ------------------------------------------------------------------ المصادر والمراجع (قائمة جانبية لا تغطي العرض)
function buildSources() {
  const s = $('#sources'), box = el('div', 'in'); const hd = el('div', 'row', '<h3 style="flex:1">المصادر والمراجع</h3>'); const x = el('button', null, '✕ إغلاق'); x.onclick = () => toggleSources(false); hd.append(x); box.append(hd);
  for (const g of SOURCES) { box.append(el('h4', null, g.h)); for (const it of g.items) box.append(el('div', 'it', `<b>${it.t}</b>${it.d || ''}${it.u ? `<br><a href="${it.u}" target="_blank" rel="noopener noreferrer">${it.u}</a>` : ''}${it.l ? `<div class="lic">الترخيص: ${it.l}</div>` : ''}`)); }
  s.append(box);
}
function toggleSources(on = !app.classList.contains('src-open')) { app.classList.toggle('src-open', on); $('#nav-src').classList.toggle('on', on); $('#nav-src').setAttribute('aria-expanded', on); if (on && matchMedia('(max-width: 900px)').matches) setTimeout(() => $('#sources').scrollIntoView({ behavior: 'smooth' }), 260); }
$('#nav-src').onclick = () => toggleSources(); $('#nav-home').onclick = () => go('home'); $('#nav-band').onclick = () => go('band');

// ------------------------------------------------------------------ حلقة العرض
const clock = new THREE.Clock(), v3 = new THREE.Vector3();
function project(p, l) { v3.copy(p).project(camera); l.style.left = `${(v3.x * 0.5 + 0.5) * stage.clientWidth}px`; l.style.top = `${(-v3.y * 0.5 + 0.5) * stage.clientHeight}px`; }
function frame() {
  requestAnimationFrame(frame); const dt = Math.min(0.05, clock.getDelta());
  while (S.queue.length && S.queue[0].t <= audio.now + 0.012) S.queue.shift().f();
  if (!renderer || S.view === 'home') return;
  for (const m of S.live.values()) { m.update(dt); if (m.label) { v3.set((m.box.min.x + m.box.max.x) / 2, m.box.min.y - 0.03, m.box.max.z); project(v3.clone(), m.label); } }
  if (partSel && partSel.l.isConnected) { partSel.t += dt; const k = 1 + 0.07 * Math.max(0, Math.sin(partSel.t * 9)) * Math.exp(-partSel.t * 2.5); partSel.o.scale.copy(partSel.base).multiplyScalar(k); const b = new THREE.Box3().setFromObject(partSel.o); project(b.getCenter(new THREE.Vector3()).setY(b.max.y + 0.02), partSel.l); } else if (partSel) { partSel.o.scale.copy(partSel.base); partSel = null; }
  placeCam(); if (!window.__noRender) renderer.render(scene, camera);
}
buildHome(); buildSources(); frame();
const q = new URLSearchParams(location.search); if (q.get('view') === 'band') go('band'); else if (q.get('inst')) go('inst', q.get('inst'));
window.bandApp = { pick, S, audio, go, trigger, cam, toggleSources, startBand, stopBand, screenOf: (o) => { const r = canvas.getBoundingClientRect(), b = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(camera); return [r.left + (b.x * 0.5 + 0.5) * r.width, r.top + (-b.y * 0.5 + 0.5) * r.height]; } };
