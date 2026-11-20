// =====================================================================
//  Rhythm World 3D – عالم الإيقاع ثلاثي الأبعاد (MusiTeacher)
//  نقطة البداية: الحالة العامة، المشهد، المشغّل المتزامن (صوت ↔ حركة)، والتنقل بين الأقسام.
//  كل قسم في ملف مستقل داخل ui/، ومصنع الوسائل المطبوعة يُحمَّل عند الطلب فقط (print/factory.js).
// =====================================================================
import { World } from './three/world.js';
import { Audio, SOUNDS } from './audio/engine.js';
import { initVoices, speak, stop as stopSpeech, speechInfo } from './audio/speech.js';
import { FIG, TPB, GRADES, GRADE_NAMES, band, charactersFor, valueText, partTicks } from './data/figures.js';
import { introFor, PITCH } from './data/speech-texts.js';
import { figureSVG } from './notation/svg.js';
import * as explore from './ui/explore.js';
import * as present from './ui/present.js';
import * as lab from './ui/lab.js';
import * as studio from './ui/studio.js';
import * as names from './ui/names.js';
import { showSources } from './ui/sources.js';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const store = { get(k, d) { try { const v = localStorage.getItem('rw3d.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('rw3d.' + k, JSON.stringify(v)); } catch (e) { /* التخزين غير متاح */ } } };

const app = {
  $, el, store, FIG, figureSVG, valueText,
  state: { grade: store.get('grade', 1), mode: 'explore', bpm: 72, sound: store.get('sound', 'sustain') },
  audio: new Audio(), world: null, run: null, mapping: null,
  modes: { explore, present, lab, studio, names },
};
app.audio.sound = app.state.sound;
app.stage = () => band(app.state.grade);
app.characters = () => charactersFor(app.state.grade);

// ------------------------------------------------------------------ المشهد ثلاثي الأبعاد
try { app.world = new World($('#scene'), $('#labels')); } catch (e) { console.warn(e); $('#nogl').hidden = false; }
const W = () => app.world;
app.lineup = (items, opts) => { if (W()) W().setLineup(items, opts); };
document.querySelectorAll('#viewtools button').forEach((b) => b.addEventListener('click', () => {
  const v = b.dataset.v, w = W(); if (!w && v !== 'full') return;
  if (v === 'in') w.zoom(0.85); else if (v === 'out') w.zoom(1.18); else if (v === 'left') w.rotate(0.35); else if (v === 'right') w.rotate(-0.35); else if (v === 'reset') w.resetView();
  else if (v === 'full') app.fullscreen();
}));
app.fullscreen = () => { const t = document.documentElement; if (!document.fullscreenElement) (t.requestFullscreen ? t.requestFullscreen() : Promise.reject()).catch(() => {}); else document.exitFullscreen(); };

// ------------------------------------------------------------------ المشغّل: صوت حقيقي + حركة متزامنة
/**
 * items: عناصر المشهد [{ids}] بالترتيب · opts: bpm, loop, countIn, pulse, beatsPerBar, sound, onPart(globalFi, pi, rest), onEnd
 * يعزف التسلسل المسطّح ويوزّع الأحداث على الشخصيات (قفزة/موجات للصوت، إشارة صمت للسكتة، تعبئة خلايا الزمن).
 */
app.play = async (items, opts = {}) => {
  app.stopAll();
  const ids = [], map = [], starts = []; let tick = 0;
  items.forEach((it, ii) => { starts.push(tick); it.ids.forEach((id, fl) => { map.push({ ii, fl }); ids.push(id); tick += FIG[id].ticks; }); });
  app.mapping = { map, starts, total: tick, items };
  await app.audio.load(opts.sound || app.state.sound);
  const run = app.audio.play(ids, { bpm: opts.bpm || app.state.bpm, loop: !!opts.loop, countIn: opts.countIn ?? 0, pulse: opts.pulse !== false, beatsPerBar: opts.beatsPerBar || 4, sound: opts.sound || app.state.sound });
  if (!run) return null;
  run.opts = opts; app.run = run; if (W()) W().resetProgress();
  return run;
};
app.stopAll = () => { app.audio.stopAll(); app.run = null; if (W()) W().resetProgress(); app.onStop && app.onStop(); stopSpeech(); app.caption(null); if (W()) W().setTalking(-1); };
app.isPlaying = () => !!app.run;

function pump() {
  const run = app.run; if (!run) return;
  const now = app.audio.now, M = app.mapping;
  const due = run.events.filter((e) => e.t <= now + 0.012); if (due.length) run.events = run.events.filter((e) => e.t > now + 0.012);
  for (const e of due) {
    if (e.type === 'part') { const m = M.map[e.fi]; if (W()) W().hit(m.ii, m.fl, e.pi, e.dur, e.rest); run.opts.onPart && run.opts.onPart(e.fi, e.pi, e.rest, e); }
    else if (e.type === 'beat') { run.opts.onBeat && run.opts.onBeat(e.beat); }
    else if (e.type === 'count') { run.opts.onCount && run.opts.onCount(e.n); }
    else if (e.type === 'end') { const done = run.opts.onEnd; setTimeout(() => { if (app.run === run) { app.run = null; if (W()) W().resetProgress(); } done && done(); }, 350); }
  }
  // خلايا الزمن: تمتلئ حسب الموضع الحالي داخل كل شخصية (والنبض يستمر أثناء السكتة)
  if (W() && now >= run.start) {
    const cyc = M.total ? ((now - run.start) / (run.beatDur / TPB)) % Math.max(M.total, Math.ceil(M.total / TPB) * TPB) : 0;
    M.items.forEach((it, ii) => {
      const s = M.starts[ii], len = it.ids.reduce((a, id) => a + FIG[id].ticks, 0);
      const prog = (cyc - s) / TPB; const restNow = isRestAt(it.ids, cyc - s);
      W().setProgress(ii, prog >= 0 && cyc - s <= len + 0.5 ? prog : (cyc > s + len ? Math.ceil(len / TPB) : -1), restNow);
    });
  }
}
function isRestAt(ids, t) { let a = 0; for (const id of ids) for (const p of FIG[id].parts) { const d = partTicks(p); if (t >= a && t < a + d) return p.rest; a += d; } return false; }

// ------------------------------------------------------------------ الكلام: الشخصية تعرّف بنفسها
const capEl = $('#caption');
app.caption = (html) => { if (!html) { capEl.hidden = true; capEl.innerHTML = ''; return; } capEl.hidden = false; capEl.innerHTML = html; };
app.introduce = (id, itemIndex = 0, extra) => {
  app.audio.stopAll(); app.run = null;
  const f = FIG[id], lines = extra || introFor(id, app.stage()); if (!lines.length) return;
  if (W()) W().setTalking(itemIndex);
  const info = speechInfo();
  speak(lines, {
    pitch: PITCH[id] ?? 1.15,
    onSentence: (i) => app.caption(`<span class="who">${f.name}:</span>${lines.slice(0, i).map((s) => `<span class="past">${s}</span> `).join('')}${lines[i]}${info.voice ? '' : ' <small class="past">(نص مكتوب: لا يتوفر صوت عربي في هذا المتصفح)</small>'}`),
    onEnd: () => { if (W()) W().setTalking(-1); setTimeout(() => app.caption(null), 2500); },
  });
};
app.stopTalk = () => { stopSpeech(); if (W()) W().setTalking(-1); app.caption(null); };

// ------------------------------------------------------------------ الصفوف والأقسام
const gs = $('#grade');
GRADES.forEach((g) => gs.append(new Option('الصف ' + GRADE_NAMES[g - 1], g)));
gs.value = app.state.grade;
gs.addEventListener('change', () => { app.state.grade = +gs.value; store.set('grade', app.state.grade); app.setMode(app.state.mode, true); });

let current = null;
app.setMode = (mode, reenter) => {
  if (current && current.leave) current.leave(app);
  app.stopAll(); app.stopTalk();
  app.state.mode = mode; $('#main').dataset.mode = mode;
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  $('#side').innerHTML = ''; $('#bar').innerHTML = ''; $('#panel2d').innerHTML = ''; $('#panel2d').hidden = mode !== 'lab'; $('#bigname').hidden = true; $('#labels').innerHTML = '';
  app.onStop = null; if (W()) W().onPick = null;
  current = app.modes[mode]; current.enter(app);
  requestAnimationFrame(() => W() && W().resize());
};
document.querySelectorAll('#modes button').forEach((b) => b.addEventListener('click', () => app.setMode(b.dataset.mode)));
$('#btn-src').addEventListener('click', () => showSources(app));

// مصنع الوسائل التعليمية: يُحمَّل عند الطلب فقط، ويأخذ «السياق» الحالي من القسم المفتوح
app.printContext = () => (current && current.printContext ? current.printContext(app) : {});
app.openPrint = async (preset) => { app.stopAll(); const m = await import('./print/factory.js'); m.openFactory(app, preset || app.printContext()); };
$('#btn-print').addEventListener('click', () => app.openPrint());

app.soundSelect = () => {
  const l = el('label', null, 'الصوت '); const s = el('select');
  for (const k in SOUNDS) s.append(new Option(SOUNDS[k], k)); s.value = app.state.sound;
  s.addEventListener('change', () => { app.state.sound = s.value; app.audio.sound = s.value; store.set('sound', s.value); app.audio.load(s.value); }); l.append(s); return l;
};
app.tempoSlider = (min = 50, max = 140) => {
  const l = el('label', null, 'السرعة '); const r = el('input'); r.type = 'range'; r.min = min; r.max = max; r.value = app.state.bpm; const v = el('b', null, String(app.state.bpm));
  r.addEventListener('input', () => { app.state.bpm = +r.value; v.textContent = r.value; }); l.append(r, v); return l;
};
app.volume = () => { const l = el('label', null, 'مستوى الصوت '); const r = el('input'); r.type = 'range'; r.min = 0; r.max = 1; r.step = 0.01; r.value = app.audio.volume; r.addEventListener('input', () => app.audio.setVolume(+r.value)); l.append(r); return l; };

// ------------------------------------------------------------------ حلقة الإطار
function loop() { requestAnimationFrame(loop); pump(); const m = app.state.mode; if (W() && m !== 'lab' && !document.body.classList.contains('pf-open')) W().frame(); if (current && current.frame) current.frame(app); }
initVoices();
const q = new URLSearchParams(location.search);
if (q.get('grade')) { app.state.grade = Math.max(1, Math.min(12, +q.get('grade'))); gs.value = app.state.grade; }
app.setMode(app.modes[q.get('mode')] ? q.get('mode') : 'explore');
loop();
window.rw3d = app;   // للاختبار الآلي فقط
