// المصدر الموسيقي الموحّد لـ«نوتات النشيد والمارشات»:
// نص مدوَّن مختصر ← نموذج مازورات/أحداث يُستخدم في الرسم والتشغيل والمزامنة والألعاب وتغيير السرعة وأسماء النغمات.
//
// صيغة النص (مسافات بين الرموز):
//   (Ed4 = نصف بيمول مطبوع، Ft4 = نصف دييز. الأدلة المقامية مثل key=rast-C في MAQAMAT.)
//   A4:8   نغمة: الحرف + الأوكتاف : القيمة (1 مستديرة، 2 بيضاء، 4 سوداء، 8 كروش، 16 دبل كروش) + نقاط اختيارية (A4:8.)
//          الحرف بلا علامة يأخذ دليل السلم، أو العلامة الأسبق في المازورة نفسها على الموضع نفسه.
//          F#4 / Bb4 / En4 = علامة تحويل مطبوعة (n = بيكار). ~ في آخر النغمة = رباط مع التالية.
//   G4:g   نغمة زينة (أتشياكاتورا) تُلحق بالنغمة التالية، بلا طول في الميزان.
//   R:4    سكتة.   (3 A4:8 G4:8 F4:8)  ثلاثية.   {D}  رمز أكورد.   "نص"  عنوان قسم فوق المدرج.
//   |  ||  |]  |:  :|  :|]   فواصل.   [1 [2  خانة النهاية للمازورة الحالية.
//   $ علامة الرجوع (سينيو) · tocoda · coda · fine · ds (رجوع منفَّذ إلى العلامة) · dc (رجوع إلى البداية)
//   dsign (علامة رجوع مطبوعة لا تُنفَّذ لأن مسارها غير محسوم). في الرجوع لا تُكرَّر الإعادات وتؤخذ خانة النهاية الأخيرة.
export const TPQ = 48; // نبضات لكل سوداء
const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARPS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLATS = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
export const KEYS = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6,
};
const AR_STEP = { C: 'دو', D: 'ري', E: 'مي', F: 'فا', G: 'صول', A: 'لا', B: 'سي' };
const AR_KEY = { C: 'دو الكبير', G: 'صول الكبير', D: 'ري الكبير', A: 'لا الكبير', F: 'فا الكبير', Bb: 'سي بيمول الكبير', Eb: 'مي بيمول الكبير', Ab: 'لا بيمول الكبير' };

/** أدلة المقامات العربية (علامات ربع التون: -0.5 = نصف بيمول، 0.5 = نصف دييز) */
export const MAQAMAT = {
  'rast-C': { label: 'مقام الراست على دو', sig: [['B', -0.5], ['E', -0.5]] },
  'rast-F': { label: 'مقام الراست على فا', sig: [['B', -1], ['E', -0.5], ['A', -0.5]] },
};
export function keyAlters(key) {
  const m = {}; STEPS.forEach((s) => { m[s] = 0; });
  if (MAQAMAT[key]) { MAQAMAT[key].sig.forEach(([st, a]) => { m[st] = a; }); return m; }
  const f = KEYS[key]; if (f === undefined) throw new Error(`مفتاح غير معروف: ${key}`);
  if (f > 0) SHARPS.slice(0, f).forEach((s) => { m[s] = 1; });
  if (f < 0) FLATS.slice(0, -f).forEach((s) => { m[s] = -1; });
  return m;
}
/** الدليل للرسم: [{step, alter}] بالترتيب المطبوع */
export function keySignature(key) {
  if (MAQAMAT[key]) return { type: 'maqam', items: MAQAMAT[key].sig.map(([step, alter]) => ({ step, alter })) };
  const f = KEYS[key];
  return f > 0 ? { type: '#', items: SHARPS.slice(0, f).map((step) => ({ step, alter: 1 })) } : f < 0 ? { type: 'b', items: FLATS.slice(0, -f).map((step) => ({ step, alter: -1 })) } : { type: '', items: [] };
}
export const keyLabel = (key) => (MAQAMAT[key] ? MAQAMAT[key].label : AR_KEY[key] || key);
export function keySigLabel(key) {
  if (MAQAMAT[key]) { const p = MAQAMAT[key].sig.map(([st, a]) => `${AR_STEP[st]} ${accWord(a)}`); return p.length > 2 ? `${p.slice(0, -1).join('، ')} و${p[p.length - 1]}` : p.join(' و'); }
  const f = KEYS[key]; if (!f) return 'دون علامات تحويل';
  const n = Math.abs(f); const w = f > 0 ? 'دييز' : 'بيمول';
  return n === 1 ? `${w} واحد` : n === 2 ? `${w}ان` : `${['', '', '', 'ثلاثة', 'أربعة', 'خمسة', 'ستة'][n]} ${f > 0 ? 'دييزات' : 'بيمولات'}`;
}
const ACC_AR = { 1: 'دييز', '-1': 'بيمول', 2: 'دبل دييز', '-2': 'دبل بيمول', '-0.5': 'نصف بيمول', 0.5: 'نصف دييز', 0: 'بيكار' };
const ACC_LAT = { 1: '#', '-1': 'b', 2: '##', '-2': 'bb', '-0.5': '½b', 0.5: '½#' };
export const accWord = (a) => ACC_AR[a] || '';
export const diatonic = (step, octave) => octave * 7 + STEPS.indexOf(step);
export const midiOf = (step, alter, octave) => 12 * (octave + 1) + SEMI[step] + alter;
export const freqOf = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export function noteName(ev, { latin = false } = {}) {
  if (!ev || ev.kind !== 'note') return '';
  const acc = ev.alter ? (latin ? ACC_LAT[ev.alter] : ' ' + ACC_AR[ev.alter]) : '';
  return latin ? `${ev.step}${acc}${ev.octave}` : `${AR_STEP[ev.step]}${acc}`;
}
export const stepName = (s) => AR_STEP[s];

const VALUE_AR = { 1: 'مستديرة', 2: 'بيضاء', 4: 'سوداء', 8: 'كروش', 16: 'دبل كروش', 32: 'تريبل كروش' };
export function valueName(ev) {
  if (!ev) return '';
  let s = (ev.kind === 'rest' ? 'سكتة ' : '') + VALUE_AR[ev.base];
  if (ev.dots === 1) s += ' منقوطة'; if (ev.dots === 2) s += ' بنقطتين';
  if (ev.tuplet) s += ' (ضمن ثلاثية)';
  return s;
}
/** الطول بالسوداء، نصًا (مثل 1.5) */
export const beatsOf = (ticks) => Math.round((ticks / TPQ) * 1000) / 1000;

function durTicks(base, dots, tup) {
  let t = (TPQ * 4) / base; let add = t / 2;
  for (let i = 0; i < dots; i++) { t += add; add /= 2; }
  if (tup) t = (t * 2) / tup;
  return t;
}
export function measureCapacity(time) { const [n, d] = time.split('/').map(Number); return (n * TPQ * 4) / d; }
/** وحدة تجميع العوارض: السوداء في x/4 والسوداء المنقوطة في 6/8 */
export function beatUnit(time) { const [n, d] = time.split('/').map(Number); return d === 8 && n % 3 === 0 ? TPQ * 1.5 : (TPQ * 4) / d; }

function tokenize(text) {
  const out = []; const re = /"([^"]*)"|(\S+)/g; let m;
  while ((m = re.exec(text))) out.push(m[1] !== undefined ? { q: m[1] } : m[2]);
  return out;
}

/**
 * يحوّل نص الأغنية إلى نموذج. يرمي خطأ يحدد المازورة عند أي خلل (قيمة لا تكمل الميزان، رمز مجهول...).
 * @returns {{key,time,tempo,measures:Array,capacity:number,beat:number}}
 */
export function parseSong(src, { key: key0, time: time0, tempo: tempo0 } = {}) {
  const lines = String(src).split('\n').map((l) => l.replace(/^\s+|\s+$/g, '')).filter((l) => l && !l.startsWith('#'));
  let key = key0 || 'C', time = time0 || '4/4', tempo = tempo0 || null; const body = [];
  for (const l of lines) {
    if (/^(key|time|tempo)=/.test(l)) {
      for (const kv of l.split(/\s+/)) { const [k, v] = kv.split('='); if (k === 'key') key = v; if (k === 'time') time = v; if (k === 'tempo') tempo = Number(v); }
    } else body.push(l);
  }
  const ka = keyAlters(key); const cap = measureCapacity(time);
  const measures = []; let cur = null; let tup = null; let tupId = 0; let pendingStart = false; let pendingVolta = 0; let graces = [];
  const open = () => {
    cur = { index: measures.length, events: [], chords: [], labels: [], startRepeat: pendingStart, endRepeat: false, volta: pendingVolta, bar: 'single', segno: false, coda: false, toCoda: false, fine: false, ds: false, dc: false, dsSign: false, mem: {} };
    pendingStart = false; pendingVolta = 0; measures.push(cur);
  };
  const ensure = () => { if (!cur) open(); };
  const close = (bar) => {
    if (!cur) return; if (tup) throw new Error(`ثلاثية غير مغلقة في المازورة ${cur.index + 1}`);
    if (!cur.events.length) { // فاصل بلا محتوى: يعدّل خصائص المازورة السابقة إن وُجدت
      return;
    }
    cur.bar = bar; delete cur.mem; cur = null;
  };
  const toks = tokenize(body.join(' '));
  for (const raw of toks) {
    if (typeof raw === 'object') { ensure(); cur.labels.push({ at: cur.events.length, text: raw.q }); continue; }
    let t = raw;
    if (t === '|' || t === '||' || t === '|]') { close(t === '|' ? 'single' : t === '||' ? 'double' : 'final'); continue; }
    if (t === '|:') { if (cur && cur.events.length) close('single'); if (cur && !cur.events.length) cur.startRepeat = true; else pendingStart = true; continue; }
    if (t === ':|' || t === ':|]') { if (!cur) throw new Error('إشارة إعادة بلا مازورة'); cur.endRepeat = true; close(t === ':|' ? 'repeat' : 'repeat'); continue; }
    if (/^\[\d$/.test(t)) { const n = Number(t[1]); if (cur && !cur.events.length) cur.volta = n; else if (cur) { cur.volta = n; } else pendingVolta = n; continue; }
    if (t === '$') { ensure(); cur.segno = true; continue; }
    if (t === 'coda') { ensure(); cur.coda = true; continue; }
    if (t === 'tocoda') { cur.toCoda = true; continue; }
    if (t === 'fine') { cur.fine = true; continue; }
    if (t === 'ds') { cur.ds = true; continue; }
    if (t === 'dc') { cur.dc = true; continue; }
    if (t === 'dsign') { cur.dsSign = true; continue; }
    if (/^\{.+\}$/.test(t)) { ensure(); cur.chords.push({ at: cur.events.length, text: t.slice(1, -1) }); continue; }
    if (/^\(3$/.test(t)) { if (tup) throw new Error('ثلاثية متداخلة'); tup = { n: 3, id: ++tupId, count: 0 }; continue; }
    let closeTup = false; if (t.endsWith(')')) { closeTup = true; t = t.slice(0, -1); }
    let tie = false; if (t.endsWith('~')) { tie = true; t = t.slice(0, -1); }
    let m = /^R:(\d+)(\.*)$/.exec(t);
    ensure();
    const gm = /^([A-G])(##|bb|#|b|n|d|t)?(\d):g$/.exec(t);
    if (gm) {
      const [, step, accTok, oct] = gm; const octave = Number(oct); const pos = step + octave;
      const acc = accTok ? ({ '#': 1, b: -1, n: 0, '##': 2, bb: -2, d: -0.5, t: 0.5 })[accTok] : null;
      const alter = acc !== null ? acc : cur.mem[pos] !== undefined ? cur.mem[pos] : ka[step];
      graces.push({ step, octave, alter, printed: acc, midi: midiOf(step, alter, octave), pos: diatonic(step, octave) });
      continue;
    }
    if (m) {
      const base = Number(m[1]); const dots = m[2].length;
      cur.events.push({ kind: 'rest', base, dots, dur: durTicks(base, dots, tup && tup.n), tuplet: tup ? { n: tup.n, id: tup.id } : null });
    } else if ((m = /^([A-G])(##|bb|#|b|n|d|t)?(\d):(\d+)(\.*)$/.exec(t))) {
      const [, step, accTok, oct, b, d] = m; const octave = Number(oct); const base = Number(b); const dots = d.length;
      const acc = accTok ? ({ '#': 1, b: -1, n: 0, '##': 2, bb: -2, d: -0.5, t: 0.5 })[accTok] : null;
      const pos = step + octave; const prev = cur.events.length ? lastNote(cur.events) : (measures.length > 1 ? lastNote(measures[measures.length - 2].events) : null);
      let alter;
      if (acc !== null) { alter = acc; cur.mem[pos] = acc; }
      else if (prev && prev.tieNext && prev.step === step && prev.octave === octave) alter = prev.alter;
      else if (cur.mem[pos] !== undefined) alter = cur.mem[pos];
      else alter = ka[step];
      if (!VALUE_AR[base]) throw new Error(`قيمة غير معروفة ${t}`);
      const ev = { kind: 'note', step, octave, alter, printed: acc, base, dots, dur: durTicks(base, dots, tup && tup.n), tuplet: tup ? { n: tup.n, id: tup.id } : null, tieNext: tie, tiePrev: false };
      ev.midi = midiOf(step, alter, octave); ev.pos = diatonic(step, octave);
      if (graces.length) { ev.graces = graces; graces = []; }
      if (prev && prev.tieNext) { if (prev.midi !== ev.midi) throw new Error(`رباط بين نغمتين مختلفتين في المازورة ${cur.index + 1}`); ev.tiePrev = true; }
      cur.events.push(ev);
    } else throw new Error(`رمز غير مفهوم «${raw}» في المازورة ${cur.index + 1}`);
    if (tup) { tup.count++; if (closeTup) { if (tup.count !== 3) throw new Error(`ثلاثية بعدد ${tup.count} في المازورة ${cur.index + 1}`); tup = null; } }
    else if (closeTup) throw new Error(`قوس إغلاق بلا ثلاثية في المازورة ${cur.index + 1}`);
  }
  if (cur) { if (cur.events.length) { cur.bar = 'final'; delete cur.mem; } else measures.pop(); }
  // التحقق من الميزان وحساب مواضع الأحداث
  measures.forEach((ms, i) => {
    let t = 0; ms.events.forEach((e, j) => { e.start = t; e.index = j; t += e.dur; });
    ms.dur = t; ms.number = i + 1;
    if (Math.abs(t - cap) > 0.001) throw new Error(`المازورة ${i + 1}: مجموع القيم ${beatsOf(t)} سوداء والميزان ${time} يتطلب ${beatsOf(cap)}`);
  });
  return { key, time, tempo, capacity: cap, beat: beatUnit(time), measures };
}
function lastNote(evs) { for (let i = evs.length - 1; i >= 0; i--) if (evs[i].kind === 'note') return evs[i]; return null; }

/** علامات التحويل التي يجب طباعتها (حسب دليل السلم وذاكرة المازورة)، مع الإبقاء على العلامات التذكيرية المدونة في الأصل */
export function printedAccidentals(song, { keepCourtesy = true } = {}) {
  const ka = keyAlters(song.key); const res = [];
  song.measures.forEach((ms) => {
    const mem = {}; res.push(ms.events.map((e) => {
      if (e.kind !== 'note') return null;
      const pos = e.step + e.octave; const expected = mem[pos] !== undefined ? mem[pos] : ka[e.step];
      if (e.tiePrev) { mem[pos] = e.alter; return null; }
      mem[pos] = e.alter;
      if (e.alter !== expected) return e.alter;
      return keepCourtesy && e.printed !== null && e.printed !== undefined ? e.printed : null;
    }));
  });
  return res;
}

/** نقل كامل (نغمات + دليل) مع الحفاظ على تهجئة صحيحة: steps = إزاحة سلّمية، semis = إزاحة نصف تون */
export function transposeSong(song, toKey, steps, semis) {
  const out = { ...song, key: toKey, measures: song.measures.map((ms) => ({ ...ms, events: ms.events.map((e) => {
    if (e.kind !== 'note') return { ...e };
    const d = diatonic(e.step, e.octave) + steps; const octave = Math.floor(d / 7); const step = STEPS[((d % 7) + 7) % 7];
    const midi = e.midi + semis; const alter = midi - midiOf(step, 0, octave);
    if (Math.abs(alter) > 2) throw new Error('نقل غير ممكن بتهجئة سليمة');
    return { ...e, step, octave, alter, midi, pos: d, printed: null };
  }) })) };
  return out;
}

/**
 * ترتيب العزف: يطبق الإعادات وخانات النهاية، والرجوع إلى العلامة (ds) والذهاب إلى الخاتمة وFine.
 * @param {{repeats?:boolean, jumps?:boolean}} opt
 * @returns {number[]} فهارس المازورات بالترتيب
 */
export function playOrder(song, { repeats = true, jumps = true } = {}) {
  const M = song.measures; const out = []; let i = 0; let pass = 1; let sectionStart = 0; let afterJump = false; let jumped = false; let guard = 0;
  const maxVolta = (from) => { let mx = 0; for (let k = from; k < M.length && (M[k].volta || k === from); k++) mx = Math.max(mx, M[k].volta); return mx; };
  while (i < M.length) {
    if (++guard > 20000) throw new Error('حلقة تشغيل غير منتهية');
    const m = M[i];
    if (m.startRepeat && !afterJump && sectionStart !== i) { sectionStart = i; pass = 1; }
    if (m.volta) {
      const take = afterJump || !repeats ? maxVolta(firstOfVoltaRun(M, i)) : pass;
      if (m.volta !== take) { i++; continue; }
    }
    out.push(i);
    if (afterJump && m.toCoda) { const c = M.findIndex((x) => x.coda); if (c >= 0) { i = c; continue; } }
    if (afterJump && m.fine) break;
    if (m.endRepeat && repeats && !afterJump && pass === 1) { pass = 2; i = sectionStart; continue; }
    if (m.endRepeat) { sectionStart = i + 1; pass = 1; }
    if ((m.ds || m.dc) && jumps && !jumped) { jumped = true; afterJump = true; const s = m.dc ? 0 : M.findIndex((x) => x.segno); i = s >= 0 ? s : 0; continue; }
    i++;
    // الخاتمة لا تُعزف في المرور الأول إن كانت بعد ds
    if (jumps && !afterJump && i < M.length && M[i].coda && M.some((x) => x.ds)) break;
  }
  return out;
}
function firstOfVoltaRun(M, i) { let k = i; while (k > 0 && M[k - 1].volta) k--; return k; }

/**
 * الخط الزمني للتشغيل والمزامنة: كل حدث بموضعه بالسوداء من البداية.
 * النغمات المربوطة تُدمج صوتيًا (soundDur) مع بقاء كل جزء ظاهرًا للمؤشر.
 */
export function buildTimeline(song, order) {
  const cap = song.capacity; const events = []; const measureStarts = [];
  order.forEach((mi, k) => {
    const t0 = (k * cap) / TPQ; measureStarts.push({ mi, at: t0 });
    song.measures[mi].events.forEach((e, ei) => {
      events.push({ k, mi, ei, at: t0 + e.start / TPQ, dur: e.dur / TPQ, kind: e.kind, midi: e.midi, tiePrev: !!e.tiePrev, tieNext: !!e.tieNext, graces: e.graces ? e.graces.map((g) => g.midi) : null });
    });
  });
  // دمج الأربطة: مدة الصوت = مجموع السلسلة
  for (let i = 0; i < events.length; i++) {
    const e = events[i]; if (e.kind !== 'note' || e.tiePrev) continue;
    let d = e.dur; let j = i; while (events[j].tieNext && events[j + 1] && events[j + 1].tiePrev) { j++; d += events[j].dur; }
    e.soundDur = d;
  }
  return { events, measureStarts, total: (order.length * cap) / TPQ };
}
/** أقرب حدث عند زمن معين (بالسوداء) — بحث ثنائي */
export function eventAt(timeline, beat) {
  const ev = timeline.events; let lo = 0, hi = ev.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (ev[mid].at <= beat + 1e-9) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}

/** بصمة إيقاع المازورة (للألعاب ومنع التكرار) */
export const rhythmSig = (ms) => ms.events.map((e) => (e.kind === 'rest' ? 'r' : e.tiePrev ? 't' : 'n') + e.dur).join(' ');
export const pitchSig = (ms) => ms.events.map((e) => (e.kind === 'rest' ? 'r' : e.midi) + ':' + e.dur).join(' ');
