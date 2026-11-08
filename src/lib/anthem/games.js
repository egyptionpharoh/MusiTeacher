// «تدرّب على المارش»: مولدات أسئلة مستخرجة من بيانات النوتة الأصلية نفسها (لا إجابات مكتوبة يدويًا).
import { TPQ, keyAlters, midiOf, noteName, accWord, valueName, rhythmSig, pitchSig, beatsOf } from './notation.js';

const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export function rng(seed = Date.now()) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** موضع النغمة على المدرج بالعربية (للتغذية الراجعة) */
export function placeText(ev) {
  const p = ev.pos - 30; // 0 = الخط الأول
  if (p >= 0 && p <= 8) return p % 2 === 0 ? `على الخط ${['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'][p / 2]}` : `في المسافة ${['الأولى', 'الثانية', 'الثالثة', 'الرابعة'][(p - 1) / 2]}`;
  if (p === -1) return 'تحت الخط الأول مباشرة'; if (p === 9) return 'فوق الخط الخامس مباشرة';
  const ORD = ['الأول', 'الثاني', 'الثالث'];
  if (p < 0) { const n = Math.floor((-p) / 2); return p % 2 === 0 ? `على الخط الإضافي ${ORD[n - 1]} تحت المدرج` : `تحت الخط الإضافي ${ORD[n - 1]}`; }
  const n = Math.floor((p - 8) / 2); return p % 2 === 0 ? `على الخط الإضافي ${ORD[n - 1]} فوق المدرج` : `فوق الخط الإضافي ${ORD[n - 1]}`;
}
/** سبب العلامة: من دليل السلم أو من علامة مطبوعة */
export function alterReason(song, mi, ei) {
  const ev = song.measures[mi].events[ei]; const ka = keyAlters(song.key);
  if (!ev.alter) return ev.printed === 0 ? 'وعليها علامة بيكار تلغي أثر الدليل.' : '';
  if (ev.printed !== null && ev.printed !== undefined) return `وعليها علامة ${accWord(ev.alter)} مطبوعة.`;
  if (ka[ev.step] === ev.alter) return `ودليل ${Math.abs(ev.alter) === 0.5 ? 'المقام' : 'السلم'} يجعلها ${noteName(ev)}.`;
  return 'وأثر العلامة السابقة في المازورة نفسها مستمر.';
}
const notesOf = (ms) => ms.events.map((e, ei) => ({ e, ei })).filter((x) => x.e.kind === 'note' && !x.e.tiePrev);

// ------------------------------------------------------------------ 1) التعرف على النغمة
export function noteQuestion(song, r, { measures } = {}) {
  const pool = (measures || song.measures.map((_, i) => i)).flatMap((mi) => notesOf(song.measures[mi]).map((x) => ({ mi, ...x })));
  if (!pool.length) return null;
  const { mi, ei, e } = pick(r, pool); const ka = keyAlters(song.key);
  const answer = noteName(e); const names = new Set([answer]); const opts = [answer];
  const d0 = STEPS.indexOf(e.step);
  for (const off of shuffle(r, [1, -1, 2, -2, 3, -3])) {
    const st = STEPS[(d0 + off + 70) % 7]; const nm = noteName({ kind: 'note', step: st, alter: ka[st] });
    if (!names.has(nm)) { names.add(nm); opts.push(nm); } if (opts.length === 4) break;
  }
  return { type: 'note', mi, ei, answer, options: shuffle(r, opts), explain: explainNote(song, mi, ei), value: valueName(e) };
}
export function explainNote(song, mi, ei) { const e = song.measures[mi].events[ei]; const why = alterReason(song, mi, ei); return `النغمة ${placeText(e)} في مفتاح صول، فهي «${STEP_AR[e.step]}»${why ? '، ' + why : '.'}`; }
const STEP_AR = { C: 'دو', D: 'ري', E: 'مي', F: 'فا', G: 'صول', A: 'لا', B: 'سي' };

// ------------------------------------------------------------------ 2) التعرف على الإيقاع
export function rhythmQuestion(song, r) {
  const bySig = new Map(); song.measures.forEach((ms, mi) => { if (notesOf(ms).length < 2) return; const k = rhythmSig(ms); if (!bySig.has(k)) bySig.set(k, mi); });
  const uniq = [...bySig.values()]; if (uniq.length < 3) return null;
  const answer = pick(r, uniq); const others = shuffle(r, uniq.filter((x) => x !== answer)).slice(0, 3);
  return { type: 'rhythm', answer, options: shuffle(r, [answer, ...others]), explain: `الإيقاع المسموع: ${rhythmWords(song.measures[answer])}.` };
}
export function rhythmWords(ms) { return ms.events.map((e) => valueName(e)).join('، '); }

// ------------------------------------------------------------------ 3) أكمل المازورة (مع احترام الميزان)
export function completeQuestion(song, r) {
  const cap = song.capacity; const beat = song.beat; const cands = [];
  song.measures.forEach((ms, mi) => {
    const cut = cap - beat; const k = ms.events.findIndex((e) => Math.abs(e.start - cut) < 0.01);
    if (k <= 0) return; const hidden = ms.events.slice(k);
    if (!hidden.some((e) => e.kind === 'note') || !ms.events.slice(0, k).some((e) => e.kind === 'note')) return;
    if (hidden.some((e) => e.tieNext) || ms.events[k].tiePrev) return;
    cands.push({ mi, k });
  });
  if (!cands.length) return null;
  const { mi, k } = pick(r, cands); const ms = song.measures[mi]; const hidden = ms.events.slice(k); const ka = keyAlters(song.key);
  const sig = (evs) => evs.map((e) => (e.kind === 'rest' ? 'r' : e.midi) + ':' + e.dur).join(' ');
  const opts = [{ id: 'orig', events: hidden, fits: true, original: true }];
  // (ب) الإيقاع نفسه بنغمات أخرى: يحترم الميزان ولا يطابق اللحن
  const shift = pick(r, [1, -1, 2]); const moved = hidden.map((e) => (e.kind === 'note' ? stepShift(e, shift, ka) : e));
  if (sig(moved) !== sig(hidden)) opts.push({ id: 'pitch', events: moved, fits: true, original: false });
  // (ج) قيمة خاطئة: تكسر الميزان
  const broken = hidden.map((e, i) => (i === hidden.length - 1 ? { ...e, base: e.base > 4 ? e.base / 2 : e.base * 2, dur: e.base > 4 ? e.dur * 2 : e.dur / 2 } : e));
  opts.push({ id: 'dur', events: broken, fits: false, original: false });
  // (د) مقطع من مازورة أخرى بالطول نفسه إن وُجد ومختلف
  const other = shuffle(r, cands.filter((c) => c.mi !== mi)).map((c) => song.measures[c.mi].events.slice(c.k)).find((evs) => sig(evs) !== sig(hidden) && !opts.some((o) => sig(o.events) === sig(evs)) && !evs.some((e) => e.tiePrev || e.tieNext));
  if (other) opts.push({ id: 'other', events: other, fits: true, original: false });
  const options = shuffle(r, opts).map((o) => ({ ...o, beats: beatsOf(o.events.reduce((a, e) => a + e.dur, 0)) }));
  return { type: 'complete', mi, k, need: beatsOf(beat), options, answer: 'orig' };
}
function stepShift(e, n, ka) {
  const d = e.octave * 7 + STEPS.indexOf(e.step) + n; const step = STEPS[((d % 7) + 7) % 7]; const octave = Math.floor(d / 7);
  const alter = ka[step]; return { ...e, step, octave, alter, printed: null, midi: midiOf(step, alter, octave), pos: d };
}

// ------------------------------------------------------------------ 4) رتّب النغمات
export function orderQuestion(song, r) {
  const cands = song.measures.map((ms, mi) => ({ ms, mi })).filter(({ ms }) => { const n = ms.events.filter((e) => e.kind === 'note').length; return ms.events.length >= 3 && ms.events.length <= 6 && n >= 3 && new Set(ms.events.map((e) => (e.kind === 'rest' ? 'r' : e.midi) + ':' + e.dur)).size >= 3 && !ms.events.some((e) => e.tiePrev || e.tieNext); });
  if (!cands.length) return null;
  const { ms, mi } = pick(r, cands); const tiles = ms.events.map((e, i) => ({ id: 't' + i, e, label: e.kind === 'rest' ? valueName(e) : `${noteName(e)} · ${valueName(e)}` }));
  let shuffled; let guard = 0; do { shuffled = shuffle(r, tiles); } while (sameSeq(shuffled.map((t) => t.e), ms.events) && ++guard < 20);
  return { type: 'order', mi, tiles: shuffled, answer: tiles.map((t) => t.id) };
}
const evKey = (e) => (e.kind === 'rest' ? 'r' : e.midi) + ':' + e.dur;
export const sameSeq = (a, b) => a.length === b.length && a.every((e, i) => evKey(e) === evKey(b[i]));
/** التحقق من ترتيب الطالب (النغمات المتطابقة قابلة للتبادل) */
export function checkOrder(song, q, ids) {
  const byId = Object.fromEntries(q.tiles.map((t) => [t.id, t.e])); const evs = ids.map((id) => byId[id]);
  const target = song.measures[q.mi].events; const firstWrong = evs.findIndex((e, i) => !target[i] || evKey(e) !== evKey(target[i]));
  return { ok: firstWrong === -1 && evs.length === target.length, firstWrong };
}

// ------------------------------------------------------------------ 5) استمع وحدّد المازورة
export function listenQuestion(song, r, size = 4) {
  const n = song.measures.length; const starts = [];
  for (let s = 0; s + size <= n; s++) { const w = song.measures.slice(s, s + size); const sigs = new Set(w.map(pitchSig)); if (sigs.size === size && w.filter((m) => notesOf(m).length).length === size) starts.push(s); }
  if (!starts.length) return null;
  const s = pick(r, starts); const mis = Array.from({ length: size }, (_, i) => s + i);
  return { type: 'listen', mis, answer: pick(r, mis) };
}

// ------------------------------------------------------------------ 6) تحدي المارش
export function challenge(song, r, count = 10) {
  const makers = [noteQuestion, rhythmQuestion, listenQuestion, completeQuestion, noteQuestion];
  const out = []; let guard = 0;
  while (out.length < count && guard++ < count * 10) { const q = pick(r, makers)(song, r); if (q) out.push(q); }
  return out;
}

// ------------------------------------------------------------------ 7) تدرّب على مازورة: النقر مع الإيقاع
/** مواضع بدايات النغمات (بالسوداء من أول المازورة) — السكتات وامتدادات الأربطة لا تُنقر */
export function onsets(song, mi) { return song.measures[mi].events.filter((e) => e.kind === 'note' && !e.tiePrev).map((e) => e.start / TPQ); }
/**
 * تقييم النقرات: لكل بداية أقرب نقرة ضمن السماحية.
 * @param {number[]} targets بالسوداء   @param {number[]} taps بالسوداء   @param {number} tol بالسوداء
 */
export function scoreTaps(targets, taps, tol = 0.2) {
  const used = new Set(); const res = targets.map((t) => {
    let best = -1, bd = Infinity; taps.forEach((x, i) => { if (used.has(i)) return; const d = Math.abs(x - t); if (d < bd) { bd = d; best = i; } });
    if (best >= 0 && bd <= tol) { used.add(best); return { at: t, hit: true, delta: taps[best] - t }; }
    return { at: t, hit: false, delta: null };
  });
  const hits = res.filter((x) => x.hit).length;
  return { results: res, hits, extra: taps.length - used.size, total: targets.length, score: targets.length ? Math.round((100 * Math.max(0, hits - (taps.length - used.size) * 0.5)) / targets.length) : 0 };
}
