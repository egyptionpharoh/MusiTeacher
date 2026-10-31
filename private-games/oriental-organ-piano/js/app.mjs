// app.mjs — واجهة Oriental Maestro: الأوضاع، الأجزاء (رئيسي/طبقة/يسرى)، الإيقاع، المقامات، الأدوات التعليمية.
// المبدأ: كل ما يُكتب على المفتاح أو الشاشة وكل ما يُسمع يأتي من pitchOf/labelOf في theory.mjs بالضبط نفسه.

import { makeTuning, pitchOf, labelOf, westernName, easternInfo, midiToHz, MIDI_MIN, MIDI_MAX, EASTERN_Q_MIN, EASTERN_Q_MAX } from './theory.mjs';
import { buildKeyMap } from './keymap.mjs';
import { MAQAMAT, MAQAM_BY_ID, SCALES, SCALE_BY_ID, degreesOf, shiftsFor, degreePcs } from './maqamat.mjs';
import { RHYTHMS, RHYTHM_BY_ID, GROUPS, HERITAGE, SOURCES, LANES, stepsOf, fillLanes, validateCustom } from './rhythms.mjs';
import { VOICES, CATEGORIES, LICENSES, voicesFor, DEFAULT_VOICE } from './voices.mjs';
import { Engine } from './engine.mjs';
import { Sequencer, TapTempo } from './sequencer.mjs';

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const PC = (m) => ((m % 12) + 12) % 12;
const isBlack = (m) => [1, 3, 6, 8, 10].includes(PC(m));

// ---------------------------------------------------------------- الحالة (تُحفظ في المتصفح)
const STORE = 'mt-oriental-maestro-v3';
const DEFAULTS = {
  mode: 'eastern', part: 'upper',
  modes: {
    western: { voices: { upper: 'piano', layer: 'strings', lower: 'bass' }, names: 'western', group: 'west', rhythm: 'pop', scale: 'C-maj' },
    eastern: { voices: { upper: 'eorgan', layer: 'strings', lower: 'bass' }, names: 'both', group: 'egypt', rhythm: 'maqsum', maqam: 'rast', shifts: null, qc: 50 },
  },
  layer: false, split: false, splitPoint: 60, sustainLatch: false, transpose: 0, octave: { upper: 0, layer: 0, lower: -1 },
  vol: { master: 80, upper: 85, layer: 60, lower: 70, drums: 75 }, fx: { reverb: 35, chorus: 0 }, mod: 0,
  bpm: 100, riq: false, metro: false, metroBeats: 4, bassAcc: false,
  kb: { size: 61, start: 36 }, octaveNum: true, flats: false, degrees: true, hints: false,
  panels: true, teach: false, memories: [null, null, null, null], custom: [],
};
let S = structuredClone(DEFAULTS);
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved && typeof saved === 'object') S = deepMerge(structuredClone(DEFAULTS), saved);
} catch (e) { /* تخزين غير متاح: نعمل بالإعدادات الافتراضية */ }
function deepMerge(a, b) {
  for (const k of Object.keys(b)) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) deepMerge(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}
let saveTimer = 0;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* */ } }, 250); }
const M = () => S.modes[S.mode];
// الإيقاعات المخصصة المحفوظة (تُتحقق مجددًا عند التحميل)
let CUSTOM = [];
function loadCustom() { CUSTOM = []; for (const c of S.custom || []) { try { CUSTOM.push(validateCustom(c)); } catch (e) { /* يُتجاهل التالف */ } } }
loadCustom();
const rhythmById = (id) => RHYTHM_BY_ID[id] || CUSTOM.find((r) => r.id === id) || null;

// ---------------------------------------------------------------- الضبط والأسماء
function currentTuning() {
  if (S.mode === 'western') return makeTuning({ mode: 'western' });
  const E = S.modes.eastern;
  const shifts = E.shifts || (MAQAM_BY_ID[E.maqam] ? shiftsFor(E.maqam) : { 4: -1, 11: -1 });
  return makeTuning({ mode: 'eastern', shifts, quarterCents: E.qc || 50 });
}
let TUNING = currentTuning();
function currentScale() {
  if (S.mode === 'western') return SCALE_BY_ID[S.modes.western.scale] || null;
  const E = S.modes.eastern;
  return E.shifts ? null : (MAQAM_BY_ID[E.maqam] || null);
}
/** تهجئة المفاتيح السوداء: بحسب درجات المقام/السلّم إن وُجدت، وإلا بحسب اختيار المستخدم. */
function spellingMap() {
  const sc = currentScale(), map = new Map();
  if (sc) for (const d of [...degreesOf(sc), ...degreesOf(sc, { descending: true })]) map.set(PC(d.midi), d.western);
  return map;
}
let SPELL = spellingMap();
const SOLF = ['دو', 'ري', 'مي', 'فا', 'صول', 'لا', 'سي'], WHITE = [0, 2, 4, 5, 7, 9, 11];
/** الاسم الغربي المعروض لدرجة مسموعة: تهجئة المقام إن وُجدت، وإلا اسم المفتاح نفسه مع ½♭/½♯ للمفتاح الأبيض المزاح. */
function westSpelled(m, L) {
  const sp = SPELL.get(PC(m));
  if (sp) return sp;
  const shift = L.cents === 0 ? 0 : (L.cents < 0 ? -1 : 1);
  if (shift && WHITE.includes(PC(m))) return SOLF[WHITE.indexOf(PC(m))] + (shift < 0 ? '½♭' : '½♯');
  return L.western.short;
}
/** المفتاح → الدرجة المسموعة في جزء ما (مع التصوير والأوكتاف). */
function soundingMidi(key, part) { return clamp(key + S.transpose + 12 * (S.octave[part] || 0), MIDI_MIN, MIDI_MAX); }
function zoneOf(key) { return S.split && key < S.splitPoint ? 'lower' : 'upper'; }
// ---------------------------------------------------------------- الصوت
let ctx = null, engine = null, seq = null, seqTimer = 0;
const tap = new TapTempo();
function audioReady() { return !!engine; }
async function powerOn() {
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC({ latencyHint: 'interactive' });
  if (ctx.state === 'suspended') await ctx.resume();
  engine = new Engine(ctx, { gameBase: './', sharedBase: './_shared/' });
  engine.warmDrums();
  seq = new Sequencer({
    now: () => ctx.currentTime,
    trigger: (sound, time, vel) => { engine.playDrum(sound, time, vel); if (S.bassAcc && (sound === 'dum' || sound === 'kick' || sound === 'rahmani')) bassHit(time); },
    onStep: (st) => scheduleUI(st),
    onState: (s) => { if (s === 'stop') updateTransport(); if (s === 'changed') { updateRhythmUI(); drawSteps(); } },
  });
  seqTimer = setInterval(() => seq.tick(), 25);
  applyAllAudio();
  ['upper', 'layer', 'lower'].forEach((p) => ensureVoice(M().voices[p], true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ctx.state === 'suspended') ctx.resume(); });
}
function applyAllAudio() {
  if (!engine) return;
  engine.setMaster(S.vol.master / 100);
  ['upper', 'layer', 'lower', 'drums'].forEach((p) => engine.setPartVolume(p, S.vol[p] / 100));
  applyFx();
  engine.modDepth = S.mod / 100;
  seq.setBpm(S.bpm); seq.riq = S.riq; seq.clearCache();
  seq.metro = { on: S.metro, beats: S.metroBeats, accent: true };
  const r = rhythmById(M().rhythm); if (!seq.running) seq.setRhythm(r);
}
function applyFx() {
  if (!engine) return;
  for (const p of ['upper', 'layer', 'lower']) engine.setFx(p, { reverb: S.fx.reverb / 100, chorus: S.fx.chorus / 100 }, M().voices[p]);
  engine.setFx('drums', { reverb: S.fx.reverb / 100, chorus: 0 }, null);
}
const loadingToasts = new Map();
function ensureVoice(id, quiet) {
  if (!engine) return;
  const v = VOICES[id];
  if (v.kind === 'pluck') { engine.warmPluck(id, visibleKeys().map((k) => pitchOf(soundingMidi(k, 'upper'), TUNING).hz)); return; }
  if (v.kind !== 'sample' || engine.voiceReady(id)) return;
  renderVoices();
  engine.ensureVoice(id, (n, t) => { if (!quiet) toast(`تحميل أصوات «${v.ar}»… ${n}/${t}`, 1500); }).then((ok) => {
    renderVoices();
    if (!ok) toast(`تعذّر تحميل أصوات «${v.ar}». تحقق من الاتصال ثم اختر الصوت مرة أخرى.`, 5000);
    else if (!quiet) toast(`✔ أصوات «${v.ar}» جاهزة`, 1500);
  });
}

// ---------------------------------------------------------------- العزف
const active = new Map();        // مصدر الضغط (مؤشر/زر/MIDI) → { key, handles:[{part,h}] }
const sustained = [];            // أصوات مرفوعة الإصبع لكن الرنين مفعّل
let sustainHeld = false;         // مفتاح المسافة أو دواسة MIDI
const lastHz = { upper: 0, layer: 0, lower: 0 };
const heldLower = [];            // للباص المصاحب
let lastNote = null;
const sustainOn = () => S.sustainLatch || sustainHeld;

function pressKey(key, src, vel = 0.8, opts = {}) {
  if (!audioReady()) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (active.has(src)) releaseKey(src);
  if (splitPick) { setSplitPoint(key); return; }
  if (syncArmed && !seq.running) { syncArmed = false; startRhythm(); }
  const zone = zoneOf(key);
  const parts = zone === 'lower' ? ['lower'] : (S.layer ? ['upper', 'layer'] : ['upper']);
  const handles = [];
  for (const part of parts) {
    const vid = M().voices[part];
    const m = soundingMidi(key, part);
    const p = pitchOf(m, TUNING);
    const legato = [...active.values()].some((a) => a.handles.some((x) => x.part === part));
    const h = engine.noteOn(part, vid, p.hz, { vel, pan: (key - 66) / 60, glideFrom: legato ? lastHz[part] : 0 });
    if (h) { handles.push({ part, h }); lastHz[part] = p.hz; }
    else if (VOICES[vid].kind === 'sample') { ensureVoice(vid); toast(`أصوات «${VOICES[vid].ar}» ما زالت تُحمَّل…`, 1200); }
  }
  active.set(src, { key, handles });
  if (zone === 'lower') heldLower.push(key);
  setKeyOn(key, true);
  showNote(key, zone);
  if (!opts.fromRecorder) recordEvent('on', key, vel);
  quizCheck(key);
}
function releaseKey(src) {
  const a = active.get(src);
  if (!a) return;
  active.delete(src);
  const i = heldLower.lastIndexOf(a.key); if (i >= 0) heldLower.splice(i, 1);
  if (sustainOn()) sustained.push(...a.handles.map((x) => x.h));
  else a.handles.forEach((x) => engine.noteOff(x.h));
  if (![...active.values()].some((o) => o.key === a.key)) setKeyOn(a.key, false);
  if (!String(src).startsWith('rec:')) recordEvent('off', a.key);
}
function setSustainHeld(on) { sustainHeld = on; if (!sustainOn()) flushSustain(); updateSustainUI(); }
function flushSustain() { while (sustained.length) engine.noteOff(sustained.pop()); }
function panic() {
  for (const src of [...active.keys()]) releaseKey(src);
  sustained.length = 0; engine && engine.panic();
  $$('.key.on').forEach((k) => k.classList.remove('on'));
  if (seq && seq.running) stopRhythm();
  recStopPlayback();
}
function bassHit(time) {
  if (!S.split || !heldLower.length) return;
  const key = heldLower[heldLower.length - 1];
  const m = clamp(soundingMidi(key, 'lower') - 12, MIDI_MIN, MIDI_MAX);
  const h = engine.noteOn('lower', 'bass', pitchOf(m, TUNING).hz, { vel: 0.85, when: time });
  if (h) engine.noteOff(h, time + Math.min(0.5, 30 / S.bpm));
  if (!engine.voiceReady('bass')) ensureVoice('bass', true);
}

// ---------------------------------------------------------------- لوحة المفاتيح
const KB = $('keyboard');
let keyEls = new Map();
function visibleKeys() { const out = []; for (let m = S.kb.start; m < S.kb.start + S.kb.size; m++) out.push(m); return out; }
function normalizeKb() {
  S.kb.size = [37, 49, 61, 76].includes(S.kb.size) ? S.kb.size : 61;
  const maxStart = MIDI_MAX - S.kb.size + 1;
  S.kb.start = clamp(S.kb.start, MIDI_MIN, maxStart);
  // يبدأ دائمًا بمفتاح أبيض (دو، وفي 76 مي)
  while (isBlack(S.kb.start)) S.kb.start--;
}
function buildKeyboard() {
  normalizeKb();
  KB.textContent = ''; keyEls = new Map();
  const keys = visibleKeys();
  const ww = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--key-w')) || 34;
  const bw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bk-w')) || 21;
  let whiteIndex = 0;
  for (const m of keys) {
    const el = document.createElement('div');
    el.className = 'key ' + (isBlack(m) ? 'b' : 'w');
    el.dataset.m = m;
    el.innerHTML = '<span class="hint"></span><span class="n2"></span><span class="n1"></span><span class="oct"></span>';
    let cx;
    if (isBlack(m)) {
      if (m === keys[0]) continue;
      el.style.left = (whiteIndex * ww - bw / 2) + 'px';
      cx = whiteIndex * ww;
    } else { cx = whiteIndex * ww + ww / 2; whiteIndex++; }
    KB.appendChild(el); keyEls.set(m, el);
    // مسطرة العلامات فوق المفاتيح: رقم درجة المقام وعلامة ربع التون (لا تزاحم أسماء المفاتيح)
    const rk = document.createElement('span'); rk.className = 'rk' + (isBlack(m) ? ' rb' : ''); rk.style.left = cx + 'px';
    KB.appendChild(rk); el._rk = rk;
  }
  // إن انتهت اللوحة بمفتاح أسود نحذفه (شكل غير واقعي)
  const last = keys[keys.length - 1]; if (isBlack(last) && keyEls.get(last)) { keyEls.get(last).remove(); keyEls.delete(last); }
  $('kbRange').textContent = westernName(keys[0]).scientific + ' – ' + westernName(last - (isBlack(last) ? 1 : 0)).scientific;
  $$('#sizeSeg button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.size === S.kb.size));
  refreshKeys();
  centerKeyboard();
}
function centerKeyboard() {
  const sc = $('kbScroll'), el = keyEls.get(60) || keyEls.get(S.kb.start);
  if (sc.scrollWidth > sc.clientWidth && el) sc.scrollLeft = el.offsetLeft - sc.clientWidth / 2 + 40;
}
function refreshKeys() {
  const names = M().names;
  KB.classList.toggle('labels-none', names === 'none');
  KB.classList.toggle('no-oct', !S.octaveNum);
  KB.classList.toggle('no-hints', !S.hints);
  const sc = currentScale();
  const degs = sc && S.degrees ? degreePcs(sc) : new Map();
  const tonicPc = sc ? PC(degreesOf(sc)[0].midi) : -1;
  const hintMap = new Map([...buildKeyMap(kbBase).entries()].map(([code, m]) => [m, code.replace(/^Key|^Digit/, '')]));
  for (const [m, el] of keyEls) {
    const part = zoneOf(m), s = soundingMidi(m, part);
    const L = labelOf(s, TUNING, { display: 'both', accidental: S.flats ? 'flat' : 'sharp' });
    const p = pitchOf(s, TUNING);
    const west = westSpelled(s, L);
    const east = L.eastern;
    let n1 = '', n2 = '';
    if (names === 'western') n1 = west;
    else if (names === 'eastern') { n1 = east || west; }
    else if (names === 'both') { n1 = west; n2 = east || ''; }
    el.querySelector('.n1').textContent = n1;
    el.querySelector('.n2').textContent = n2;
    el.querySelector('.oct').textContent = names !== 'none' && (!east || names !== 'eastern') ? L.octave : '';
    el.querySelector('.hint').textContent = hintMap.get(m) || '';
    el.classList.toggle('lowerZone', part === 'lower');
    el.classList.toggle('splitStart', S.split && m === S.splitPoint);
    el.title = `${west} ${L.octave}${east ? ' — ' + east : ''} — ${p.hz.toFixed(2)} هرتز`;
    const d = degs.get(PC(s));
    const rk = el._rk;
    rk.innerHTML = (d ? `<i class="deg${d === 'desc' ? ' desc' : ''}${PC(s) === tonicPc && d !== 'desc' ? ' tonic' : ''}">${d === 'desc' ? '↓' : d}</i>` : '')
      + (p.shift ? `<i class="qtmark${p.shift > 0 ? ' up' : ''}">${p.shift < 0 ? '½♭' : '½♯'}</i>` : '');
    el.classList.toggle('shifted', !!p.shift);
    el.classList.toggle('tonic', PC(s) === tonicPc && !!d);
  }
  $('splitName').textContent = westernName(S.splitPoint).scientific;
}
function setKeyOn(m, on) { const el = keyEls.get(m); if (el) el.classList.toggle('on', on); }

// المؤشر (فأرة/لمس/قلم): عدة أصابع، والسحب ينتقل بين المفاتيح (غليساندو)، والشدة من موضع الضغط على المفتاح
const pointerKey = new Map();
function keyFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  const k = el && el.closest && el.closest('.key');
  return k && KB.contains(k) ? { m: +k.dataset.m, el: k } : null;
}
function velFrom(e, el) { const r = el.getBoundingClientRect(); return clamp(0.45 + 0.55 * ((e.clientY - r.top) / r.height), 0.3, 1); }
KB.addEventListener('pointerdown', (e) => {
  const k = keyFromPoint(e.clientX, e.clientY); if (!k) return;
  e.preventDefault();
  try { KB.setPointerCapture(e.pointerId); } catch (err) { /* */ }
  pointerKey.set(e.pointerId, k.m);
  pressKey(k.m, 'p' + e.pointerId, velFrom(e, k.el));
});
KB.addEventListener('pointermove', (e) => {
  if (!pointerKey.has(e.pointerId)) return;
  const k = keyFromPoint(e.clientX, e.clientY);
  if (!k || k.m === pointerKey.get(e.pointerId)) return;
  pointerKey.set(e.pointerId, k.m);
  pressKey(k.m, 'p' + e.pointerId, velFrom(e, k.el));
});
const endPointer = (e) => { if (!pointerKey.has(e.pointerId)) return; pointerKey.delete(e.pointerId); releaseKey('p' + e.pointerId); };
KB.addEventListener('pointerup', endPointer);
KB.addEventListener('pointercancel', endPointer);
KB.addEventListener('contextmenu', (e) => e.preventDefault());

// لوحة الحاسوب: e.code (موضع الزر الفعلي) فيعمل مع الكيبورد العربي
let kbBase = 48;
let KEYMAP = buildKeyMap(kbBase);
function setKbBase(b) { kbBase = clamp(b, 24, 84); kbBase -= PC(kbBase); KEYMAP = buildKeyMap(kbBase); refreshKeys(); $('kbHint').textContent = `لوحة الحاسوب: Z = ${westernName(kbBase).scientific}، Q = ${westernName(kbBase + 12).scientific} — [ ] لتحريكها — مسافة = رنين`; }
document.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input[type=text],input[type=number],select,textarea,dialog')) return;
  if (!audioReady()) return;
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) setSustainHeld(true); return; }
  if (e.code === 'Escape') { panic(); return; }
  if (e.code === 'BracketLeft') { setKbBase(kbBase - 12); return; }
  if (e.code === 'BracketRight') { setKbBase(kbBase + 12); return; }
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const m = KEYMAP.get(e.code);
  if (m != null) { e.preventDefault(); pressKey(m, 'k' + e.code, 0.8); }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') { setSustainHeld(false); return; }
  if (KEYMAP.has(e.code)) releaseKey('k' + e.code);
});
window.addEventListener('blur', () => { for (const src of [...active.keys()]) if (String(src).startsWith('k')) releaseKey(src); setSustainHeld(false); });

// ---------------------------------------------------------------- الشاشة
function showNote(key, zone) {
  const part = zone === 'lower' ? 'lower' : 'upper';
  const m = soundingMidi(key, part);
  const L = labelOf(m, TUNING, { display: 'both', accidental: S.flats ? 'flat' : 'sharp' });
  const sp = westSpelled(m, L);
  const names = M().names;
  const main = names === 'eastern' && L.eastern ? L.eastern : `${sp} ${L.octave}`;
  $('lcdNote').textContent = main;
  const parts = [];
  if (L.eastern && (names === 'both' || (names !== 'eastern' && S.mode === 'eastern'))) parts.push(L.eastern + (L.alias ? ` (أو ${L.alias})` : ''));
  if (names === 'eastern' && L.eastern) parts.push(`${sp} ${L.octave}`);
  parts.push(L.western.scientific);
  parts.push(L.hz.toFixed(2) + ' هرتز');
  if (L.cents) parts.push((L.cents > 0 ? '+' : '') + L.cents + ' سنت');
  if (S.transpose || S.octave[part]) parts.push('مُصوَّر');
  $('lcdNoteSub').textContent = parts.join(' · ');
  lastNote = { key, m };
}
function updateLcd() {
  const up = VOICES[M().voices.upper];
  $('lcdMode').textContent = S.mode === 'eastern' ? 'ORIENTAL ORGAN' : 'WESTERN PIANO';
  let v = up.ar;
  if (S.layer) v += ' + ' + VOICES[M().voices.layer].ar;
  if (S.split) v += ' | يسرى: ' + VOICES[M().voices.lower].ar;
  $('lcdVoice').textContent = v;
  const r = rhythmById(M().rhythm);
  $('lcdRhythm').textContent = r ? `${r.ar} ${r.meter}` : 'بلا إيقاع';
  $('lcdTempo').textContent = `♩=${S.bpm}`;
  const sc = currentScale();
  $('lcdMaqam').textContent = S.mode === 'eastern' ? (sc ? 'مقام ' + sc.ar : 'أرباع مخصصة') : (sc ? sc.ar : '');
  const st = [];
  if (S.transpose) st.push('تصوير ' + (S.transpose > 0 ? '+' : '') + S.transpose);
  if (sustainOn()) st.push('رنين');
  if (syncArmed) st.push('بانتظار أول مفتاح…');
  $('lcdStatus').textContent = st.join(' · ');
}
function drawSteps() {
  const box = $('lcdSteps'); box.textContent = '';
  if (metroOnly) { for (let i = 0; i < S.metroBeats; i++) { const c = document.createElement('i'); c.textContent = i + 1; c.className = 'beat' + (i === 0 ? ' D' : ''); box.appendChild(c); } return; }
  const r = (seq && seq.running && seq.rhythm) || rhythmById(M().rhythm);
  if (!r) return;
  const n = stepsOf(r);
  const lane = r.lanes.dt || r.lanes.kick || r.lanes.rah || Object.values(r.lanes)[0];
  const other = r.lanes.snare || r.lanes.kas || r.lanes.clap || '';
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    let ch = lane[i];
    if (!r.lanes.dt) ch = lane[i] !== '-' ? 'D' : (other[i] && other[i] !== '-' ? 'T' : '-');
    c.textContent = ch === '-' ? '' : ch === 'D' ? 'D' : ch === 'k' ? 'k' : 'T';
    c.className = (ch === '-' ? '' : ch) + (i % r.sub === 0 ? ' beat' : '');
    box.appendChild(c);
  }
}
function scheduleUI(st) {
  const delay = Math.max(0, (st.time - ctx.currentTime) * 1000);
  setTimeout(() => {
    const cells = $('lcdSteps').children;
    for (const c of cells) c.classList.remove('now');
    if (cells[st.step]) cells[st.step].classList.add('now');
  }, delay);
}

// ---------------------------------------------------------------- الأصوات (واجهة)
let showAllVoices = false;
function renderVoices() {
  const grid = $('voiceGrid'); grid.textContent = '';
  const { primary, other } = voicesFor(S.mode);
  const list = showAllVoices ? [...primary, ...other] : primary;
  const cur = M().voices[S.part];
  for (const id of list) {
    const v = VOICES[id];
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'vbtn'; b.dataset.voice = id;
    const tag = v.kind === 'sample' ? 'تسجيل حقيقي' : v.kind === 'pluck' ? 'نمذجة فيزيائية' : 'تركيب صوتي';
    b.innerHTML = `<span class="ic">${v.icon}</span>${esc(v.ar)}<span class="src">${tag}</span>`;
    b.setAttribute('aria-pressed', id === cur);
    if (engine && v.kind === 'sample') { const st = engine.setState(v.set); b.classList.toggle('loading', st === 'loading'); b.classList.toggle('failed', st === 'failed'); }
    b.onclick = () => selectVoice(id);
    grid.appendChild(b);
  }
  $('btnAllVoices').textContent = showAllVoices ? 'أصوات هذا الوضع فقط ▴' : `كل الأصوات (${other.length} أخرى) ▾`;
  const cv = VOICES[cur];
  const lic = LICENSES[cv.lic];
  $('voiceInfo').innerHTML = `<b>${esc(cv.ar)}:</b> ${esc(cv.info)} <span class="src">— ${esc(lic.name)}</span>`;
  $('voiceModeHint').textContent = { upper: 'الرئيسي', layer: 'الطبقة الثانية', lower: 'يسار نقطة التقسيم' }[S.part];
  $$('.part-tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.part === S.part));
  $('ledLayer').classList.toggle('on', S.layer);
  $('ledSplit').classList.toggle('on', S.split);
}
function selectVoice(id) {
  M().voices[S.part] = id;
  if (S.part === 'layer' && !S.layer) setLayer(true);
  if (S.part === 'lower' && !S.split) setSplit(true);
  ensureVoice(id);
  applyFx(); renderVoices(); updateLcd(); save();
}

// ---------------------------------------------------------------- الإيقاعات (واجهة)
let syncArmed = false;
function renderRhythmGroups() {
  const box = $('rhythmGroups'); box.textContent = '';
  for (const g of GROUPS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'rg';
    b.textContent = g.icon + ' ' + g.ar; b.setAttribute('aria-pressed', M().group === g.id);
    b.onclick = () => { M().group = g.id; renderRhythmGroups(); renderRhythms(); save(); };
    box.appendChild(b);
  }
}
function renderRhythms() {
  const grid = $('rhythmGrid'); grid.textContent = '';
  const g = M().group;
  const list = g === 'mine' ? CUSTOM : RHYTHMS.filter((r) => r.group === g);
  if (!list.length) grid.innerHTML = `<p class="rhythm-info">${g === 'mine' ? 'لا توجد إيقاعات محفوظة بعد. افتح «🎓 أدوات تعليمية ← ✍️ محرر الإيقاع» لإنشاء نمط تحققت منه.' : ''}</p>`;
  if (g === 'gulf') {
    const h = document.createElement('button'); h.type = 'button'; h.className = 'rbtn'; h.innerHTML = '🏺 الفنون التراثية<small>بطاقات موثّقة</small>';
    h.onclick = openHeritage; grid.appendChild(h);
  }
  for (const r of list) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'rbtn';
    b.innerHTML = `${esc(r.ar)}<small>${esc(r.meter)}</small>`;
    b.setAttribute('aria-pressed', M().rhythm === r.id);
    b.onclick = () => selectRhythm(r.id);
    grid.appendChild(b);
  }
  updateRhythmUI();
}
function selectRhythm(id) {
  const r = rhythmById(id); if (!r) return;
  M().rhythm = id;
  if (!seq || !seq.running) { S.bpm = r.bpm; }
  if (seq) { seq.setBpm(S.bpm); seq.setRhythm(r); }
  renderRhythms(); updateBpmUI(); drawSteps(); updateLcd(); save();
  if (seq && seq.running) toast(`«${r.ar}» يبدأ مع بداية الدورة التالية`, 1400);
}
function updateRhythmUI() {
  const r = rhythmById(M().rhythm);
  $('rhythmMeter').textContent = r ? `${r.ar} · ${r.meter}` : '';
  $('rhythmInfo').innerHTML = r ? `${esc(r.info || '')}${r.src && r.src.length ? ` <span class="src">— المصدر: ${r.src.map((s) => esc(SOURCES[s].split(',')[0])).join('؛ ')}</span>` : ''}` : '';
}
let metroOnly = false;
function startRhythm() {
  if (!audioReady()) return;
  if (metroOnly) stopMetroOnly();
  const r = rhythmById(M().rhythm);
  seq.setRhythm(r || null);
  seq.metro = { on: S.metro || !r, beats: S.metroBeats, accent: true };
  seq.start(); syncArmed = false; updateTransport(); drawSteps();
}
/** المترونوم وحده: نقرات بنبر على الوحدة الأولى بحسب الميزان المختار، دون إيقاع. */
function toggleMetroOnly() {
  if (!audioReady()) return;
  if (metroOnly) { stopMetroOnly(); return; }
  if (seq.running) seq.stop();
  metroOnly = true; seq.setRhythm(null); seq.rhythm = null;
  seq.metro = { on: true, beats: S.metroBeats, accent: true }; seq.start();
  $('btnMetroOnly').setAttribute('aria-pressed', true); updateTransport(); drawSteps();
}
function stopMetroOnly() { metroOnly = false; seq.stop(); $('btnMetroOnly').setAttribute('aria-pressed', false); const r = rhythmById(M().rhythm); seq.setRhythm(r); updateTransport(); }
function stopRhythm() { if (metroOnly) { stopMetroOnly(); return; } seq.stop(); syncArmed = false; updateTransport(); $$('#lcdSteps i').forEach((c) => c.classList.remove('now')); }
function updateTransport() {
  const on = !!(seq && seq.running && !metroOnly);
  const b = $('btnStart'); b.textContent = on ? '⏹ إيقاف' : '▶ تشغيل'; b.classList.toggle('on', on);
  $('btnSync').classList.toggle('armed', syncArmed); $('btnSync').setAttribute('aria-pressed', syncArmed);
  updateLcd();
}
function updateBpmUI() { $('bpmVal').textContent = S.bpm; $('bpmSlider').value = S.bpm; if (seq) seq.setBpm(S.bpm); updateLcd(); }
function setBpm(b) { S.bpm = clamp(Math.round(b), 40, 220); updateBpmUI(); save(); }

// ---------------------------------------------------------------- المقامات وأرباع التون
function renderMaqamRow() {
  const sel = $('maqamSel'); sel.textContent = '';
  const eastern = S.mode === 'eastern';
  const list = eastern ? MAQAMAT : SCALES;
  if (eastern) { const o = document.createElement('option'); o.value = 'custom'; o.textContent = '— أرباع مخصصة —'; sel.appendChild(o); }
  for (const m of list) { const o = document.createElement('option'); o.value = m.id; o.textContent = eastern ? `${m.ar} على ${degreesOf(m)[0].eastern || degreesOf(m)[0].western}` : m.ar; sel.appendChild(o); }
  sel.value = eastern ? (S.modes.eastern.shifts ? 'custom' : S.modes.eastern.maqam) : S.modes.western.scale;
  sel.previousSibling && (sel.parentElement.firstChild.textContent = eastern ? 'المقام ' : 'السلّم ');
  $('qtButtons').hidden = !eastern; $('qcSlider').parentElement.hidden = !eastern;
  // أزرار أرباع التون لكل درجة من الاثنتي عشرة: طبيعي ← ½♭ ← ½♯
  const box = $('qtButtons'); box.textContent = '';
  if (eastern) {
    for (let pc = 0; pc < 12; pc++) {
      const s = TUNING.shifts[pc];
      const b = document.createElement('button'); b.type = 'button'; b.className = 'qtb' + (s < 0 ? ' down' : s > 0 ? ' up' : '');
      const w = westernName(60 + pc, { accidental: isBlack(60 + pc) && !S.flats ? 'sharp' : 'flat' }).short;
      b.innerHTML = `${esc(w)}<small>${s < 0 ? '½♭' : s > 0 ? '½♯' : 'طبيعي'}</small>`;
      b.title = 'اضغط للتبديل: طبيعي ← نصف بيمول ← نصف دييز';
      b.onclick = () => cycleQt(pc);
      box.appendChild(b);
    }
    $('qcVal').textContent = S.modes.eastern.qc; $('qcSlider').value = S.modes.eastern.qc;
  }
  renderMaqamInfo();
}
function renderMaqamInfo() {
  const sc = currentScale(), info = $('maqamInfo');
  if (!sc) { info.innerHTML = 'أرباع مخصصة: اضغط زر الدرجة لتبديلها (طبيعي ← ½♭ ← ½♯). الأسماء على المفاتيح تتبع الدرجة المسموعة.'; return; }
  const ds = degreesOf(sc);
  const degHtml = ds.map((d, i) => `<span class="deg"><b>${i + 1}</b> ${esc(d.western)}${d.eastern && S.mode === 'eastern' ? ' · ' + esc(d.eastern) : ''}</span>`).join('');
  const ajnas = sc.ajnas ? ' — الأجناس: ' + sc.ajnas.map(([n, i]) => `${n} على ${ds[i].eastern || ds[i].western}`).join('، ') : '';
  info.innerHTML = `${degHtml}<br>${esc(sc.note || '')}${esc(ajnas)}${S.mode === 'western' ? ' — البيانو الغربي يعزف بالسلّم المعدّل (12 نصف تون متساوية) بلا أرباع تون.' : ''}`;
}
function cycleQt(pc) {
  const E = S.modes.eastern;
  const cur = E.shifts ? [...E.shifts] : [...TUNING.shifts];
  cur[pc] = { 0: -1, '-1': 1, 1: 0 }[cur[pc]];
  E.shifts = cur; E.maqam = 'custom';
  retune();
}
function setMaqam(id) {
  if (S.mode === 'eastern') {
    const E = S.modes.eastern;
    if (id === 'custom') { E.shifts = E.shifts || [...TUNING.shifts]; E.maqam = 'custom'; }
    else { E.maqam = id; E.shifts = null; }
  } else S.modes.western.scale = id;
  retune();
}
/** إعادة الضبط: النغمات المضغوطة الآن تكمل بطبقتها، والجديدة بالضبط الجديد (مثل أزرار الأرباع في الأورج الحقيقي). */
function retune() {
  TUNING = currentTuning(); SPELL = spellingMap();
  renderMaqamRow(); refreshKeys(); updateLcd(); save();
}
function playScale(desc) {
  const sc = currentScale(); if (!sc || !audioReady()) return;
  const ds = degreesOf(sc, { descending: desc });
  const vid = M().voices.upper, t0 = ctx.currentTime + 0.1, dur = 60 / clamp(S.bpm, 60, 140);
  ds.forEach((d, i) => {
    // الدرجة تُعزف بترددها الصحيح ولو لم يكن ضبط المفاتيح الحالي يتضمنها
    const hz = midiToHz(d.midi, d.shift * TUNING.quarterCents, TUNING.a4);   // نفس صيغة pitchOf تمامًا
    const h = engine.noteOn('upper', vid, hz, { when: t0 + i * dur, vel: 0.8 });
    if (h) engine.noteOff(h, t0 + (i + 0.92) * dur);
    setTimeout(() => {
      $('lcdNote').textContent = S.mode === 'eastern' && d.eastern ? d.eastern : d.western;
      $('lcdNoteSub').textContent = `${i + 1}/${ds.length} · ${d.western} · ${hz.toFixed(2)} هرتز`;
      const k = keyEls.get(d.midi - S.transpose); if (k) { k.classList.add('on'); setTimeout(() => k.classList.remove('on'), dur * 900); }
    }, (t0 + i * dur - ctx.currentTime) * 1000);
  });
  if (!engine.voiceReady(vid)) ensureVoice(vid);
}

// ---------------------------------------------------------------- الأوضاع والأجزاء
function setMode(mode) {
  if (mode !== 'western' && mode !== 'eastern') return;
  S.mode = mode;
  // النغمات المضغوطة تكمل بطبقتها حتى رفع الإصبع؛ لا تُقطع ولا تعلق
  TUNING = currentTuning(); SPELL = spellingMap();
  $$('.mode-btn').forEach((b) => b.setAttribute('aria-checked', b.dataset.mode === mode));
  document.body.dataset.mode = mode;
  ['upper', 'layer', 'lower'].forEach((p) => ensureVoice(M().voices[p], true));
  applyFx();
  if (seq) { const r = rhythmById(M().rhythm); if (seq.running) { if (r) seq.setRhythm(r); } else seq.setRhythm(r); }
  $$('#namesSeg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.names === M().names));
  renderVoices(); renderRhythmGroups(); renderRhythms(); renderMaqamRow(); refreshKeys(); drawSteps(); updateLcd(); save();
}
function setLayer(on) { S.layer = on; $('btnLayer').setAttribute('aria-pressed', on); renderVoices(); updateLcd(); save(); }
function setSplit(on) { S.split = on; $('btnSplit').setAttribute('aria-pressed', on); renderVoices(); refreshKeys(); updateLcd(); save(); }
let splitPick = false;
function setSplitPoint(m) { S.splitPoint = m; splitPick = false; $('btnSplitPoint').classList.remove('armed'); if (!S.split) setSplit(true); refreshKeys(); toast(`نقطة التقسيم: ${westernName(m).scientific} — ما قبلها لليد اليسرى`, 1800); save(); }
function updateSustainUI() { $('btnSustain').setAttribute('aria-pressed', sustainOn()); updateLcd(); }
function updateOctaveUI() { $('ocVal').textContent = (S.octave[S.part] > 0 ? '+' : '') + S.octave[S.part]; $('trVal').textContent = (S.transpose > 0 ? '+' : '') + S.transpose; }

// ---------------------------------------------------------------- الذاكرة (Registration)
let storeArmed = false;
const SNAP_KEYS = ['mode', 'modes', 'layer', 'split', 'splitPoint', 'transpose', 'octave', 'vol', 'fx', 'mod', 'bpm', 'riq', 'metro', 'metroBeats', 'bassAcc'];
function memStore(i) { S.memories[i] = structuredClone(Object.fromEntries(SNAP_KEYS.map((k) => [k, S[k]]))); storeArmed = false; $('btnStore').setAttribute('aria-pressed', false); renderMem(); flash(i); toast(`حُفظت الإعدادات في الذاكرة ${i + 1}`, 1600); save(); }
function memRecall(i) {
  const m = S.memories[i]; if (!m) { toast('الذاكرة فارغة: اضغط «حفظ» ثم رقمها لحفظ الإعدادات الحالية', 2500); return; }
  for (const k of SNAP_KEYS) if (k in m) S[k] = structuredClone(m[k]);
  syncControls(); setMode(S.mode); applyAllAudio(); flash(i); toast(`استُعيدت الذاكرة ${i + 1}`, 1400);
}
function renderMem() { $$('.mem').forEach((b) => b.classList.toggle('has', !!S.memories[+b.dataset.slot])); }
function flash(i) { const b = $$('.mem')[i]; b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 400); }

// ---------------------------------------------------------------- المسجّل
let rec = { on: false, t0: 0, events: [], playing: false, timers: [] };
function recordEvent(type, key, vel) { if (rec.on) rec.events.push({ t: performance.now() - rec.t0, type, key, vel }); }
function recToggle() {
  if (rec.playing) recStopPlayback();
  if (!rec.on) { rec = { on: true, t0: performance.now(), events: [], playing: false, timers: [] }; $('recBtn').textContent = '⏹ إيقاف التسجيل'; $('recInfo').textContent = '● يسجّل…'; }
  else { rec.on = false; $('recBtn').textContent = '⏺ تسجيل'; $('recInfo').textContent = rec.events.filter((e) => e.type === 'on').length + ' نغمة مسجّلة'; }
  $('recPlay').disabled = rec.on || !rec.events.length; $('recClear').disabled = rec.on || !rec.events.length;
}
function recPlay() {
  if (rec.playing) { recStopPlayback(); return; }
  if (!rec.events.length) return;
  rec.playing = true; $('recPlay').textContent = '⏹ إيقاف';
  rec.events.forEach((e, i) => rec.timers.push(setTimeout(() => {
    if (e.type === 'on') pressKey(e.key, 'rec:' + e.key, e.vel, { fromRecorder: true }); else releaseKey('rec:' + e.key);
    if (i === rec.events.length - 1) recStopPlayback();
  }, e.t)));
}
function recStopPlayback() {
  rec.timers.forEach(clearTimeout); rec.timers = [];
  for (const src of [...active.keys()]) if (String(src).startsWith('rec:')) releaseKey(src);
  rec.playing = false; $('recPlay').textContent = '▶ استماع';
}

// ---------------------------------------------------------------- التدريبات
let quiz = null;
function quizPool() {
  const sc = currentScale();
  if (sc) return [...degreesOf(sc)].filter((d) => keyEls.has(d.midi - S.transpose) && (S.mode !== 'eastern' || TUNING.shifts[PC(d.midi)] === d.shift));
  const out = [];
  for (const m of visibleKeys()) if (m >= 60 && m <= 72) { const p = pitchOf(m, TUNING); out.push({ q: p.q, midi: m, shift: p.shift, eastern: easternInfo(m, TUNING)?.name || null, western: westernName(m, { shift: p.shift }).short }); }
  return out;
}
function startQuiz(type) {
  if (!audioReady()) return;
  quiz = { type, right: 0, wrong: 0, target: null, n: 0 };
  $('quizBox').hidden = false;
  nextQuestion();
}
function nextQuestion() {
  if (!quiz) return;
  $$('.key.target').forEach((k) => k.classList.remove('target'));
  quiz.n++;
  const box = $('quizBox');
  if (quiz.type === 'qt') {
    quiz.target = Math.random() < 0.5 ? 'sikah' : 'busalik';
    const v = M().voices.upper, t0 = ctx.currentTime + 0.1;
    const play = (hz, t, d) => { const h = engine.noteOn('upper', v, hz, { when: t }); if (h) engine.noteOff(h, t + d); };
    const rast = midiToHz(60), e = quiz.target === 'sikah' ? midiToHz(64, -(S.modes.eastern.qc || 50)) : midiToHz(64);
    play(rast, t0, 0.7); play(e, t0 + 0.9, 1.1);
    box.innerHTML = `<span class="q">استمع: الراست (دو) ثم نغمة ثانية… هل هي سيكاه (مي½♭) أم بوسليك (مي)؟</span>
      <button type="button" class="fbtn small" data-a="sikah">سيكاه (مي½♭)</button><button type="button" class="fbtn small" data-a="busalik">بوسليك (مي)</button>
      <button type="button" class="fbtn small" data-a="again">🔁 أعد</button>${quizFoot()}`;
    $$('button[data-a]', box).forEach((b) => b.onclick = () => {
      if (b.dataset.a === 'again') { quiz.n--; nextQuestion(); return; }
      const ok = b.dataset.a === quiz.target; ok ? quiz.right++ : quiz.wrong++;
      box.querySelector('.q').innerHTML = ok ? '<span class="ok">✔ صحيح!</span> الفرق ربع تون فقط (' + (S.modes.eastern.qc || 50) + ' سنتًا).' : `<span class="bad">✘ ليست كذلك:</span> كانت ${quiz.target === 'sikah' ? 'سيكاه (مي½♭)' : 'بوسليك (مي)'}.`;
      setTimeout(nextQuestion, 1500);
    });
    return;
  }
  const pool = quizPool();
  if (!pool.length) { box.innerHTML = '<span class="q">لا توجد نغمات ظاهرة للتدريب: حرّك لوحة المفاتيح لتظهر دو4.</span>'; return; }
  quiz.target = pool[Math.floor(Math.random() * pool.length)];
  const t = quiz.target;
  const nm = S.mode === 'eastern' && t.eastern ? `${t.eastern} (${t.western})` : t.western + ' ' + westernName(t.midi).octave;
  if (quiz.type === 'find') box.innerHTML = `<span class="q">🎯 اعزف: ${esc(nm)}</span>${quizFoot()}`;
  else {
    box.innerHTML = `<span class="q">👂 استمع ثم اعزف النغمة نفسها على لوحة المفاتيح</span><button type="button" class="fbtn small" id="qAgain">🔁 أعد</button>${quizFoot()}`;
    const playT = () => { const h = engine.noteOn('upper', M().voices.upper, midiToHz(t.midi, t.shift * TUNING.quarterCents, TUNING.a4), { when: ctx.currentTime + 0.05 }); if (h) engine.noteOff(h, ctx.currentTime + 1.2); };
    playT(); $('qAgain').onclick = playT;
  }
}
function quizFoot() { return `<span class="score">✔ ${quiz.right} · ✘ ${quiz.wrong}</span><button type="button" class="fbtn small" onclick="this.closest('.quiz').hidden=true;window.__mtQuizEnd&&window.__mtQuizEnd()">إنهاء</button>`; }
window.__mtQuizEnd = () => { quiz = null; $$('.key.target').forEach((k) => k.classList.remove('target')); };
function quizCheck(key) {
  if (!quiz || quiz.type === 'qt' || !quiz.target) return;
  const m = soundingMidi(key, zoneOf(key));
  const p = pitchOf(m, TUNING);
  const ok = p.q === quiz.target.q;
  const el = keyEls.get(key);
  ok ? quiz.right++ : quiz.wrong++;
  const box = $('quizBox');
  box.querySelector('.score').textContent = `✔ ${quiz.right} · ✘ ${quiz.wrong}`;
  if (ok) { box.querySelector('.q').innerHTML = '<span class="ok">✔ أحسنت!</span>'; quiz.target = null; setTimeout(nextQuestion, 900); }
  else {
    if (el) { el.classList.add('wrong'); setTimeout(() => el.classList.remove('wrong'), 400); }
    const tk = keyEls.get(quiz.target.midi - S.transpose); if (tk && quiz.wrong % 2 === 0) tk.classList.add('target');
    box.querySelector('.score').textContent = `✔ ${quiz.right} · ✘ ${quiz.wrong}`;
  }
}

// ---------------------------------------------------------------- النوافذ
function dialog(title, html) { $('dlgTitle').textContent = title; $('dlgBody').innerHTML = html; const d = $('dlg'); if (!d.open) d.showModal(); return $('dlgBody'); }
$('dlgClose').onclick = () => $('dlg').close();
$('dlg').addEventListener('click', (e) => { if (e.target.id === 'dlg') $('dlg').close(); });
function openInfo() {
  const rows = Object.entries(VOICES).map(([id, v]) => `<tr><td>${v.icon} ${esc(v.ar)}</td><td>${v.kind === 'sample' ? 'عينات مسجلة' : v.kind === 'pluck' ? 'نمذجة فيزيائية' : 'تركيب صوتي'}</td><td>${esc(LICENSES[v.lic].name)}</td><td>${esc(LICENSES[v.lic].license)}</td></tr>`).join('');
  const rsrc = Object.entries(SOURCES).map(([k, s]) => `<li><b>[${k}]</b> ${esc(s)}</li>`).join('');
  dialog('نظام التسمية والمصادر والتراخيص', `
  <h4>التسميات الغربية</h4>
  <p>السلّم المعدّل المتساوي (12 نصف تون)، <b>لا4 = A4 = 440 هرتز</b>، وترقيم الأوكتاف العلمي: <b>دو4 = C4 = دو الوسطى = 261.63 هرتز</b>. رقم الأوكتاف يتغير عند كل «دو» ويُكتب منفصلًا عن اسم النغمة. علامات التحويل: دييز ♯ ، بيمول ♭ ، نصف دييز ½♯ ، نصف بيمول ½♭.</p>
  <h4>التسميات الشرقية</h4>
  <p>المرجع: جدول «أسماء أهم درجات السلم العربي، الطبيعية منها والمحوّلة بنصف البعد وربعه» في كتاب المنهج (ص 49): <b>49 درجة</b> بخطوة ربع تون من <b>يكاه (صول3)</b> إلى <b>جواب النوى (صول5)</b>، والراست = دو4. «نيم X» = X ناقص ربع تون، و«تيك X» = X زائد ربع تون.</p>
  <p>الاسم يُشتق دائمًا من <b>الدرجة المسموعة</b> لا من المفتاح: فالسيكاه سيكاه سواء جاءت من مي مخفوضة ربعًا أو من ري♯ مرفوعة ربعًا، والاسم والتردد يخرجان من الدالة نفسها فلا يظهر اسم نغمة ويُسمع غيرها. خارج مدى الجدول (تحت صول3 وفوق صول5) يُعرض الاسم الغربي بدل اختراع اسم.</p>
  <p>ربع التون = 50 سنتًا في التدوين المعتاد (24 ربعًا في الأوكتاف). ولأن الأداء الفعلي للسيكاه والأوج يتفاوت بين المدارس والمناطق، يمكن ضبط قيمته من 30 إلى 50 سنتًا («ربع التون» في صف المقامات)، فيتغير التردد ويبقى الاسم.</p>
  <h4>مصادر الأصوات وتراخيصها</h4>
  <table><tr><th>الصوت</th><th>طريقة التوليد</th><th>المصدر</th><th>الترخيص</th></tr>${rows}</table>
  <p class="src">FluidR3_GM SoundFont: Copyright © 2000-2002, 2008 Frank Wen — مرخّص بـ MIT (حزمة Debian fluid-soundfont) وبـ CC BY 3.0 (مستودع gleitz/midi-js-soundfonts). تُعرض هذه الإشارة امتثالًا لشرط ذكر المصدر. عينات VCSL وVSCO 2 CE في الملكية العامة (CC0) ونذكرها للشفافية.</p>
  <p class="src">أُعيد ضبط طبقة كل عينة بالقياس (انحراف معظمها ضمن ±10 سنتات)، وعينة الأورج الكلاسيكي تُعزف بأوكتاف أعلى لأن أقوى أجزائها في طبقة 16 قدمًا.</p>
  <h4>الإيقاعات</h4>
  <p>كل إيقاع عربي في المكتبة اتفق على صيغته الأساسية مصدران على الأقل. الأصوات الإيقاعية مولَّدة برمجيًا (لا تسجيلات). «الحشوة» تنويع تعليمي من تأليف MusiTeacher.</p><ul>${rsrc}</ul>
  <p>الفنون العُمانية والخليجية التراثية معروضة في بطاقات موثّقة بدل أنماط مختلقة — انظر «🏺 التراث العُماني والخليجي».</p>`);
}
function openHelp() {
  dialog('طريقة الاستخدام', `
  <h4>الوضعان</h4><p><b>🎹 البيانو الغربي</b>: سلّم معدّل وأسماء غربية وأصوات غربية وسلالم كبيرة/صغيرة. <b>🪕 الأورج الشرقي</b>: أرباع التون والمقامات والأسماء الشرقية والأصوات والإيقاعات الشرقية. لكل وضع إعداداته المحفوظة، والتبديل لا يقطع النغمات المضغوطة.</p>
  <h4>الأجزاء</h4><p><b>الرئيسي</b> هو الصوت الأساسي. <b>الطبقة</b> صوت ثانٍ يُعزف معه (زر «طبقة»). <b>اليد اليسرى</b> صوت لما قبل نقطة التقسيم (زر «تقسيم»). اختر الجزء أولًا ثم الصوت. «نقطة التقسيم»: اضغطه ثم اضغط المفتاح.</p>
  <h4>الإيقاع</h4><p>اختر الإيقاع ثم «تشغيل». <b>بدء متزامن</b>: يبدأ الإيقاع مع أول مفتاح. <b>حشوة</b>: تنويع لدورة واحدة. <b>ختام</b>: يكمل الدورة ويختم بضربة. <b>باص مع الإيقاع</b>: مع التقسيم، يعزف الباص النغمة التي تضغطها اليسرى على كل «دُم». تغيير الإيقاع أثناء العزف يحدث مع بداية الدورة التالية.</p>
  <h4>المقامات وأرباع التون</h4><p>اختر المقام فتُضبط المفاتيح تلقائيًا (مثل مي وسي ½♭ في الراست)، وتُلوَّن درجاته على المفاتيح. أو اضغط أزرار الدرجات لتبديل كل منها: طبيعي ← ½♭ ← ½♯.</p>
  <h4>لوحة الحاسوب</h4><p><kbd>Z</kbd>…<kbd>M</kbd> أوكتاف، و<kbd>Q</kbd>…<kbd>P</kbd> الذي يليه (السوداء: <kbd>S D G H J</kbd> و<kbd>2 3 5 6 7 9 0</kbd>). <kbd>[</kbd> <kbd>]</kbd> لتحريك أوكتاف لوحة الحاسوب. <kbd>مسافة</kbd> رنين ما دامت مضغوطة. <kbd>Esc</kbd> إيقاف كل الأصوات. يعمل مع لوحة الحاسوب العربية أيضًا.</p>
  <h4>اللمس والسبورة</h4><p>يمكن العزف بعدة أصابع، والسحب على المفاتيح ينتقل بينها. الضغط قرب طرف المفتاح أقوى من الضغط قرب أعلاه. زر «لوحة التحكم» يخفي اللوحات ويكبّر المفاتيح.</p>
  <h4>الذاكرة</h4><p>اضغط «حفظ» ثم رقمًا (1–4) لحفظ الأصوات والإيقاع والسرعة والتقسيم… واضغط الرقم لاستعادتها.</p>`);
}
function openHeritage() {
  dialog('التراث العُماني والخليجي', `<p>هذه بطاقات تعريفية موثّقة. لم نضع لها حلقات إيقاعية جاهزة لأننا لم نجد لها تدوينًا إيقاعيًا موثوقًا، ولأن اختزال فن تراثي كامل في حلقة غير دقيقة يضلل الطالب. يستطيع المعلم إدخال نمط تحقق منه مع مختصين في «✍️ محرر الإيقاع» بطبول الرحماني والكاسر والطار والتصفيق والصنوج.</p>` +
    HERITAGE.map((h) => `<div class="card"><h5>${esc(h.ar)} <small class="src">— ${esc(h.where)}</small></h5><p>${esc(h.text)}</p><p class="src">المصدر: ${esc(h.src)}</p></div>`).join(''));
}

// محرر الإيقاع
function openEditor(base) {
  const r = base || { ar: '', beats: 4, sub: 2, bpm: 90, lanes: { rah: 'x-------', kas: '--x---x-', clap: '----x---' } };
  const ed = { ar: r.ar, beats: r.beats, sub: r.sub, bpm: r.bpm, info: r.info || '', id: r.id, lanes: {} };
  const ORDER = ['dt', 'rah', 'kas', 'tar', 'clap', 'snj', 'riq', 'kick', 'snare', 'hat'];
  const n = () => ed.beats * ed.sub;
  ORDER.forEach((l) => { ed.lanes[l] = (r.lanes[l] || '').padEnd(n(), '-').slice(0, n()); });
  const body = dialog(base ? 'تعديل إيقاع' : 'محرر الإيقاع', '');
  const draw = () => {
    const N = n();
    ORDER.forEach((l) => { ed.lanes[l] = (ed.lanes[l] || '').padEnd(N, '-').slice(0, N); });
    body.innerHTML = `<p class="src">أدخل نمطًا تحققت منه (مثلًا من مختص أو تسجيل ميداني). انقر الخانة لتبديلها؛ في مسار الدربكة: دُم ← تك ← كا ← سكوت.</p>
      <div class="form-row"><label>الاسم <input type="text" id="edName" maxlength="40" value="${esc(ed.ar)}"></label>
      <label>الوحدات <input type="number" id="edBeats" min="2" max="16" value="${ed.beats}"></label>
      <label>تقسيم الوحدة <select id="edSub"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>
      <label>السرعة <input type="number" id="edBpm" min="40" max="240" value="${ed.bpm}"></label></div>
      <div class="grid-ed"><table>${ORDER.map((l) => `<tr><td class="lane">${LANES[l].ar}</td>${[...ed.lanes[l]].map((ch, i) => `<td><button type="button" class="cell${ch !== '-' ? ' on' : ''}${i % ed.sub === 0 ? ' beat' : ''}" data-l="${l}" data-i="${i}">${ch === '-' ? '' : ch}</button></td>`).join('')}</tr>`).join('')}</table></div>
      <div class="form-row"><label style="flex:1">ملاحظة/مصدر <input type="text" id="edInfo" maxlength="200" style="width:100%" value="${esc(ed.info)}"></label></div>
      <div class="form-row"><button type="button" class="fbtn small" id="edPlay">▶ استماع</button><button type="button" class="fbtn small" id="edSave">💾 حفظ في «إيقاعاتي»</button>${base ? '<button type="button" class="fbtn small danger" id="edDel">🗑 حذف</button>' : ''}<span class="src" id="edMsg"></span></div>
      ${CUSTOM.length ? '<h4>إيقاعاتي</h4>' + CUSTOM.map((c) => `<button type="button" class="fbtn small" data-edit="${c.id}">${esc(c.ar)} ${esc(c.meter)}</button>`).join(' ') : ''}`;
    body.querySelector('#edSub').value = ed.sub;
    const sync = () => { ed.ar = body.querySelector('#edName').value; ed.beats = +body.querySelector('#edBeats').value; ed.sub = +body.querySelector('#edSub').value; ed.bpm = +body.querySelector('#edBpm').value; ed.info = body.querySelector('#edInfo').value; };
    body.querySelectorAll('.cell').forEach((b) => b.onclick = () => {
      sync();
      const l = b.dataset.l, i = +b.dataset.i, a = [...ed.lanes[l]];
      const cyc = l === 'dt' ? { '-': 'D', D: 'T', T: 'k', k: '-' } : { '-': 'x', x: 'X', X: '-' };
      a[i] = cyc[a[i]] || '-'; ed.lanes[l] = a.join(''); draw();
    });
    ['#edBeats', '#edSub'].forEach((s) => body.querySelector(s).onchange = () => { sync(); if (ed.beats >= 2 && ed.beats <= 16) draw(); });
    body.querySelector('#edPlay').onclick = () => {
      sync();
      try { const c = validateCustom({ ...ed, ar: ed.ar || 'معاينة', id: 'u-preview' }); if (!audioReady()) return; seq.setBpm(c.bpm); S.bpm = c.bpm; updateBpmUI(); seq.stop(); seq.setRhythm(c); seq.metro = { on: false, beats: 4 }; seq.start(); updateTransport(); body.querySelector('#edMsg').textContent = 'يعزف… اضغط «⏹ إيقاف» في لوحة الإيقاع'; }
      catch (e) { body.querySelector('#edMsg').textContent = '⚠ ' + e.message; }
    };
    body.querySelector('#edSave').onclick = () => {
      sync();
      try {
        const c = validateCustom(ed);
        const i = S.custom.findIndex((x) => x.id === c.id);
        if (i >= 0) S.custom[i] = c; else S.custom.push(c);
        loadCustom(); M().group = 'mine'; M().rhythm = c.id; save();
        renderRhythmGroups(); renderRhythms(); drawSteps();
        body.querySelector('#edMsg').textContent = '✔ حُفظ في «إيقاعاتي»'; ed.id = c.id;
      } catch (e) { body.querySelector('#edMsg').textContent = '⚠ ' + e.message; }
    };
    const del = body.querySelector('#edDel');
    if (del) del.onclick = () => { S.custom = S.custom.filter((x) => x.id !== base.id); loadCustom(); save(); renderRhythms(); $('dlg').close(); };
    body.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openEditor(CUSTOM.find((c) => c.id === b.dataset.edit)));
  };
  draw();
}

// ---------------------------------------------------------------- MIDI (لوحة مفاتيح حقيقية)
async function connectMidi() {
  if (!navigator.requestMIDIAccess) { toast('هذا المتصفح لا يدعم توصيل لوحات MIDI (جرّب Chrome أو Edge).', 3500); return; }
  try {
    const access = await navigator.requestMIDIAccess();
    let n = 0;
    const bind = () => { n = 0; access.inputs.forEach((inp) => { n++; inp.onmidimessage = onMidi; }); };
    bind(); access.onstatechange = bind;
    toast(n ? `✔ متصل بـ ${n} لوحة MIDI` : 'لا توجد لوحة MIDI متصلة حاليًا (وصّلها ثم اضغط الزر مرة أخرى)', 2500);
    $('btnMidi').setAttribute('aria-pressed', n > 0);
  } catch (e) { toast('لم يُسمح بالوصول إلى MIDI.', 3000); }
}
function onMidi(ev) {
  const [st, d1, d2] = ev.data, cmd = st & 0xf0;
  if (cmd === 0x90 && d2 > 0) pressKey(d1, 'm' + d1, 0.25 + 0.75 * d2 / 127);
  else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) releaseKey('m' + d1);
  else if (cmd === 0xb0 && d1 === 64) setSustainHeld(d2 >= 64);
}

// ---------------------------------------------------------------- ملء الشاشة (داخل المنصة: منصة اللعبة في الصفحة الأم)
function fsContext() {
  try { const fe = window.frameElement; if (fe && fe.ownerDocument) return { doc: fe.ownerDocument, el: fe.closest('.vlp-stage') || fe }; } catch (e) { /* */ }
  return { doc: document, el: document.documentElement };
}
const isFull = () => { const c = fsContext(); return !!(c.doc.fullscreenElement || c.doc.webkitFullscreenElement || document.fullscreenElement); };
function toggleFull() {
  const c = fsContext();
  if (isFull()) { const d = (c.doc.fullscreenElement || c.doc.webkitFullscreenElement) ? c.doc : document; (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
  const req = c.el.requestFullscreen || c.el.webkitRequestFullscreen;
  if (req) { const p = req.call(c.el); if (p && p.catch) p.catch(() => toast('تعذّر ملء الشاشة في هذا المتصفح', 2500)); }
}
function updateFullBtn() { const on = isFull(), b = $('btnFull'); b.textContent = on ? '🗗' : '⛶'; b.title = on ? 'تصغير الشاشة' : 'ملء الشاشة'; b.setAttribute('aria-pressed', on); setTimeout(() => { buildKeyboard(); }, 120); }

// ---------------------------------------------------------------- أدوات عامة
let toastT = 0;
function toast(msg, ms = 2200) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms); }
function knob(id, key, setter) {
  const el = $('k' + id), out = $('v' + id);
  el.value = key(); out.textContent = key();
  el.oninput = () => { setter(+el.value); out.textContent = el.value; save(); };
}
function syncControls() {
  knob('Master', () => S.vol.master, (v) => { S.vol.master = v; engine && engine.setMaster(v / 100); });
  for (const [id, p] of [['Upper', 'upper'], ['Layer', 'layer'], ['Lower', 'lower'], ['Drums', 'drums']]) knob(id, () => S.vol[p], (v) => { S.vol[p] = v; engine && engine.setPartVolume(p, v / 100); });
  knob('Reverb', () => S.fx.reverb, (v) => { S.fx.reverb = v; applyFx(); });
  knob('Chorus', () => S.fx.chorus, (v) => { S.fx.chorus = v; applyFx(); });
  knob('Mod', () => S.mod, (v) => { S.mod = v; if (engine) engine.modDepth = v / 100; });
  $('btnLayer').setAttribute('aria-pressed', S.layer); $('btnSplit').setAttribute('aria-pressed', S.split);
  $('chkRiq').checked = S.riq; $('chkMetro').checked = S.metro; $('chkBass').checked = S.bassAcc; $('metroBeats').value = S.metroBeats;
  $('chkOctave').checked = S.octaveNum; $('chkFlats').checked = S.flats; $('chkDegrees').checked = S.degrees; $('chkHints').checked = S.hints;
  updateOctaveUI(); updateBpmUI(); updateSustainUI();
}

// ---------------------------------------------------------------- ربط الأزرار
function bind() {
  $$('.mode-btn').forEach((b) => b.onclick = () => setMode(b.dataset.mode));
  $$('.part-tab').forEach((t) => t.onclick = () => { S.part = t.dataset.part; renderVoices(); updateOctaveUI(); save(); });
  $('btnAllVoices').onclick = () => { showAllVoices = !showAllVoices; renderVoices(); };
  $('btnLayer').onclick = () => setLayer(!S.layer);
  $('btnSplit').onclick = () => setSplit(!S.split);
  $('btnSplitPoint').onclick = () => { splitPick = !splitPick; $('btnSplitPoint').classList.toggle('armed', splitPick); if (splitPick) toast('اضغط الآن المفتاح الذي يبدأ عنده الجزء الأيمن', 2500); };
  $('btnSustain').onclick = () => { S.sustainLatch = !S.sustainLatch; if (!sustainOn()) flushSustain(); updateSustainUI(); save(); };
  $('trDown').onclick = () => { S.transpose = clamp(S.transpose - 1, -6, 6); updateOctaveUI(); refreshKeys(); updateLcd(); save(); };
  $('trUp').onclick = () => { S.transpose = clamp(S.transpose + 1, -6, 6); updateOctaveUI(); refreshKeys(); updateLcd(); save(); };
  $('ocDown').onclick = () => { S.octave[S.part] = clamp(S.octave[S.part] - 1, -2, 2); updateOctaveUI(); refreshKeys(); save(); };
  $('ocUp').onclick = () => { S.octave[S.part] = clamp(S.octave[S.part] + 1, -2, 2); updateOctaveUI(); refreshKeys(); save(); };
  $('btnPanic').onclick = panic;
  $$('.mem').forEach((b) => b.onclick = () => (storeArmed ? memStore(+b.dataset.slot) : memRecall(+b.dataset.slot)));
  $('btnStore').onclick = () => { storeArmed = !storeArmed; $('btnStore').setAttribute('aria-pressed', storeArmed); if (storeArmed) toast('اختر رقم الذاكرة (1–4) لحفظ الإعدادات الحالية', 2500); };
  $('btnMidi').onclick = connectMidi;
  $('btnStart').onclick = () => { if (!audioReady()) return; if (seq.running && !metroOnly) stopRhythm(); else startRhythm(); };
  $('btnMetroOnly').onclick = toggleMetroOnly;
  $('btnSync').onclick = () => { if (seq && seq.running) return; syncArmed = !syncArmed; updateTransport(); };
  $('btnFill').onclick = () => { if (seq && seq.running) { seq.fill(); toast('حشوة في الدورة التالية', 1000); } };
  $('btnEnd').onclick = () => { if (seq && seq.running) seq.end(); };
  $('bpmDown').onclick = () => setBpm(S.bpm - 1); $('bpmUp').onclick = () => setBpm(S.bpm + 1);
  $('bpmSlider').oninput = (e) => setBpm(+e.target.value);
  $('btnTap').onclick = () => { const b = tap.tap(performance.now() / 1000); if (b) setBpm(b); };
  $('chkRiq').onchange = (e) => { S.riq = e.target.checked; if (seq) { seq.riq = S.riq; seq.clearCache(); } save(); };
  $('chkMetro').onchange = (e) => { S.metro = e.target.checked; if (seq) seq.metro = { on: S.metro || !seq.rhythm, beats: S.metroBeats, accent: true }; save(); };
  $('chkBass').onchange = (e) => { S.bassAcc = e.target.checked; if (S.bassAcc) { if (!S.split) setSplit(true); ensureVoice('bass', true); toast('اضغط نغمة باليد اليسرى (يسار نقطة التقسيم) والإيقاع يعمل', 2500); } save(); };
  $('metroBeats').onchange = (e) => { S.metroBeats = +e.target.value; if (seq) seq.metro = { ...seq.metro, beats: S.metroBeats }; drawSteps(); save(); };
  $('maqamSel').onchange = (e) => setMaqam(e.target.value);
  $('btnScaleUp').onclick = () => playScale(false); $('btnScaleDown').onclick = () => playScale(true);
  $('qcSlider').oninput = (e) => { S.modes.eastern.qc = +e.target.value; $('qcVal').textContent = e.target.value; TUNING = currentTuning(); refreshKeys(); save(); };
  $$('#namesSeg button').forEach((b) => b.onclick = () => { M().names = b.dataset.names; $$('#namesSeg button').forEach((x) => x.setAttribute('aria-pressed', x === b)); refreshKeys(); save(); });
  $('chkOctave').onchange = (e) => { S.octaveNum = e.target.checked; refreshKeys(); save(); };
  $('chkFlats').onchange = (e) => { S.flats = e.target.checked; refreshKeys(); renderMaqamRow(); save(); };
  $('chkDegrees').onchange = (e) => { S.degrees = e.target.checked; refreshKeys(); save(); };
  $('chkHints').onchange = (e) => { S.hints = e.target.checked; refreshKeys(); save(); };
  $$('[data-quiz]').forEach((b) => b.onclick = () => startQuiz(b.dataset.quiz));
  $('btnHeritage').onclick = openHeritage; $('btnEditor').onclick = () => openEditor();
  $('recBtn').onclick = recToggle; $('recPlay').onclick = recPlay;
  $('recClear').onclick = () => { rec.events = []; $('recInfo').textContent = ''; $('recPlay').disabled = true; $('recClear').disabled = true; };
  $$('#sizeSeg button').forEach((b) => b.onclick = () => { S.kb.size = +b.dataset.size; if (S.kb.size === 76) S.kb.start = 28; else S.kb.start = S.kb.size === 37 ? 48 : 36; buildKeyboard(); save(); });
  $('kbLeft').onclick = () => { S.kb.start -= 12; buildKeyboard(); save(); };
  $('kbRight').onclick = () => { S.kb.start += 12; buildKeyboard(); save(); };
  $('btnPanels').onclick = () => { S.panels = !S.panels; applyPanels(); save(); };
  $('btnTeach').onclick = () => { S.teach = !S.teach; applyPanels(); save(); };
  $('btnHelp').onclick = openHelp; $('btnInfo').onclick = openInfo; $('footInfo').onclick = openInfo;
  $('btnFull').onclick = toggleFull;
  const fsc = fsContext();
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => { document.addEventListener(ev, updateFullBtn); if (fsc.doc !== document) fsc.doc.addEventListener(ev, updateFullBtn); });
  window.addEventListener('resize', () => { clearTimeout(bind.rt); bind.rt = setTimeout(buildKeyboard, 150); });
}
function applyPanels() {
  $('organ').classList.toggle('collapsed', !S.panels);
  $('btnPanels').setAttribute('aria-pressed', S.panels);
  $('teach').hidden = !S.teach; $('btnTeach').setAttribute('aria-pressed', S.teach);
}

// ---------------------------------------------------------------- البدء
function init() {
  if (window.innerWidth < 700 && S.kb.size > 37) { S.kb.size = 37; S.kb.start = 48; }
  bind(); syncControls(); applyPanels(); renderMem();
  setMode(S.mode); setKbBase(48); buildKeyboard();
  $('btnPower').onclick = async () => {
    $('btnPower').disabled = true; $('btnPower').textContent = '…';
    try { await powerOn(); } catch (e) { $('btnPower').disabled = false; $('btnPower').textContent = '⏻ تشغيل الأورج'; toast('تعذّر تشغيل الصوت في هذا المتصفح: ' + e.message, 5000); return; }
    $('splash').hidden = true; $('app').hidden = false; buildKeyboard(); updateLcd(); drawSteps(); renderVoices();
  };
  // واجهة صغيرة للاختبار الآلي (لا تؤثر في الاستخدام)
  window.MTOrgan = { toggleMetroOnly, get metroOnly() { return metroOnly; }, get S() { return S; }, get engine() { return engine; }, get seq() { return seq; }, get tuning() { return TUNING; }, pressKey, releaseKey, setMode, selectVoice, selectRhythm, setMaqam, startRhythm, stopRhythm, panic, keyEls: () => keyEls, setSplit, setLayer, setSplitPoint, setSustainHeld, playScale, startQuiz, memStore, memRecall, cycleQt, active, refreshKeys, isFull, openEditor, validateCustom };
}
init();
