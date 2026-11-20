// ============================================================================
// rhythm.js — النواة الإيقاعية لمسابقة التدوين والإملاء الإيقاعي (MusiTeacher)
// مستقلة تمامًا عن لعبة الإملاء اللحني: لا نغمات ولا مدرج ولا أسماء درجات.
//
// كل الأزمنة بالـ«تِك»: النوار = 12 تِك (يقبل القسمة على 4 للدوبل كروش وعلى 3 للتريوليه)
// فلا توجد أي أخطاء تقريب في جمع الأزمنة أو مقارنتها.
// يعمل في المتصفح (window.RD) وفي Node للاختبار (module.exports).
// ============================================================================
(function (root) {
  'use strict';

  const TPB = 12;                                   // تِك لكل وحدة (نوار)
  const BASE = { w: 48, h: 24, q: 12, e: 6, s: 3 };  // روند، بلانش، نوار، كروش، دوبل كروش

  // p(base, {dot, tup, rest}) — جزء واحد من شكل إيقاعي
  const p = (b, o) => Object.assign({ b, dot: 0, tup: 0, rest: false }, o || {});
  const partTicks = (x) => {
    let t = BASE[x.b];
    if (x.dot) t = t * 3 / 2;
    if (x.tup === 3) t = t * 2 / 3;
    return t;
  };

  // --------------------------------------------------------------------------
  // العلامات والأشكال الإيقاعية
  //  name: الاسم المعروض · syl: النطق بطريقة إيمي باري كما يرد في نصوص الأدلة (حيث يوجد)
  //  aka: صيغ أخرى للاسم (للبحث وللتوافق مع الأسماء القديمة في اللعبة)
  //  kind: note | rest | group
  // --------------------------------------------------------------------------
  const FIGURES = [
    { id: 'w',    name: 'روند',            syl: '',        kind: 'note',  parts: [p('w')] },
    { id: 'hd',   name: 'بلانش بوانتيه',    syl: '',        kind: 'note',  parts: [p('h', { dot: 1 })], aka: ['بلانش بوانتية'] },
    { id: 'h',    name: 'بلانش',           syl: '',        kind: 'note',  parts: [p('h')] },
    { id: 'qd',   name: 'نوار بوانتيه',     syl: '',        kind: 'note',  parts: [p('q', { dot: 1 })], aka: ['نوار بوانتية'] },
    { id: 'q',    name: 'نوار',            syl: 'تا',      kind: 'note',  parts: [p('q')] },
    { id: 'e',    name: 'كروش',            syl: '',        kind: 'note',  parts: [p('e')] },
    { id: 's',    name: 'دوبل كروش',        syl: '',        kind: 'note',  parts: [p('s')] },
    { id: 'rw',   name: 'سكتة الروند',      syl: '',        kind: 'rest',  parts: [p('w', { rest: true })], aka: ['سكتة روند'] },
    { id: 'rh',   name: 'سكتة البلانش',     syl: '',        kind: 'rest',  parts: [p('h', { rest: true })], aka: ['سكتة بلانش'] },
    { id: 'rq',   name: 'سكتة النوار',      syl: '',        kind: 'rest',  parts: [p('q', { rest: true })], aka: ['سكتة نوار'] },
    { id: 're',   name: 'سكتة الكروش',      syl: '',        kind: 'rest',  parts: [p('e', { rest: true })], aka: ['سكتة كروش'] },
    { id: 'rs',   name: 'سكتة الدوبل كروش',  syl: '',        kind: 'rest',  parts: [p('s', { rest: true })], aka: ['سكتة دوبل كروش', 'سكتة تيفي'] },
    { id: 'ee',   name: 'تاتي',            syl: 'تاتي',    kind: 'group', parts: [p('e'), p('e')], aka: ['طاتي', 'كروشان'] },
    { id: 'ssss', name: 'تفاتيفي',          syl: 'تفاتيفي', kind: 'group', parts: [p('s'), p('s'), p('s'), p('s')], aka: ['طفاتيفي'] },
    { id: 'ess',  name: 'تاتيفي',           syl: 'تاتيفي',  kind: 'group', parts: [p('e'), p('s'), p('s')], aka: ['طاتيفي'] },
    { id: 'sse',  name: 'تفاتي',            syl: 'تفاتي',   kind: 'group', parts: [p('s'), p('s'), p('e')], aka: ['طفاتي'] },
    { id: 'ses',  name: 'تفافي',            syl: 'تفافي',   kind: 'group', parts: [p('s'), p('e'), p('s')], aka: ['طفافي'] },
    { id: 'eds',  name: 'تافي',             syl: 'تافي',    kind: 'group', parts: [p('e', { dot: 1 }), p('s')], aka: ['طافي'] },
    { id: 'sed',  name: 'تفا',              syl: 'تفا',     kind: 'group', parts: [p('s'), p('e', { dot: 1 })], aka: ['طافا', 'تافا'] },
    { id: 'ss',   name: 'تيفي',             syl: 'تيفي',    kind: 'group', parts: [p('s'), p('s')], aka: ['دوبل كروشان'] },
    { id: 'trip', name: 'تريوليه',          syl: 'تري-يو-ليه', kind: 'group', parts: [p('e', { tup: 3 }), p('e', { tup: 3 }), p('e', { tup: 3 })] },
  ];
  const FIG = {};
  FIGURES.forEach((f) => {
    f.ticks = f.parts.reduce((a, x) => a + partTicks(x), 0);
    f.beats = f.ticks / TPB;
    FIG[f.id] = f;
  });

  const figure = (id) => FIG[id] || null;
  const seqTicks = (ids) => ids.reduce((a, id) => a + (FIG[id] ? FIG[id].ticks : 0), 0);

  /** يحول قيمة بالتِك إلى نص عربي مقروء: 1½ ، ¼ ، 2 … */
  function beatsText(ticks) {
    const whole = Math.floor(ticks / TPB), rem = ticks % TPB;
    const FR = { 3: '¼', 4: '⅓', 6: '½', 8: '⅔', 9: '¾' };
    if (!rem) return String(whole);
    const fr = FR[rem] || (rem + '/12');
    return whole ? whole + fr : fr;
  }

  // --------------------------------------------------------------------------
  // الخط الزمني المسموع لمازورة: [{t, d, rest}] بالتِك.
  // السكتات المتجاورة تُدمج (سكتتا نوار = صمت زمنين = سكتة بلانش في السمع).
  // --------------------------------------------------------------------------
  function timeline(ids) {
    const out = [];
    let t = 0;
    ids.forEach((id) => {
      const f = FIG[id]; if (!f) return;
      f.parts.forEach((x) => {
        const d = partTicks(x);
        const last = out[out.length - 1];
        if (x.rest && last && last.rest && last.t + last.d === t) last.d += d;
        else out.push({ t, d, rest: !!x.rest });
        t += d;
      });
    });
    return out;
  }
  const tlKey = (tl) => tl.map((e) => (e.rest ? 'r' : 'n') + e.t + ':' + e.d).join(',');
  const onsets = (tl) => tl.filter((e) => !e.rest).map((e) => e.t);

  /**
   * ما يُسمَع فعلًا بصوت آلة إيقاعية: العلامة الأقصر من rollTicks ضربة واحدة لا يُسمع امتدادها
   * (فـ«كروش + سكتة كروش» = «نوار» سمعيًا)، والأطول تُؤدّى «رولًا» ممتدًا بطولها فيُسمع امتدادها.
   * rollTicks = Infinity لآلة بلا رول (كالتصفيق): لا يُسمع امتداد أي علامة.
   */
  function audibleKey(ids, rollTicks) {
    const R = rollTicks == null ? Infinity : rollTicks;
    return timeline(ids).filter((e) => !e.rest).map((e) => (e.d >= R ? 'R' + e.t + ':' + e.d : 'H' + e.t)).join(',');
  }

  /** هل النمطان متطابقان سمعيًا (نفس مواضع الضربات ونفس امتدادها ونفس مواضع الصمت)؟ */
  function sameRhythm(a, b) { return tlKey(timeline(a)) === tlKey(timeline(b)); }

  // --------------------------------------------------------------------------
  // تصحيح مازورة واحدة
  //  status: 'exact' (مطابقة للعلامات نفسها) | 'equivalent' (إيقاع مسموع مطابق بكتابة أخرى) | 'wrong'
  //  issues: [{type, beat?, text}]  type: empty | duration | subdivision | distribution | rests | length
  // --------------------------------------------------------------------------
  function gradeMeasure(user, correct, beats, opts) {
    const rollTicks = opts && opts.rollTicks;
    const cap = beats * TPB;
    const uT = seqTicks(user), issues = [];
    if (!user.length) {
      return { status: 'wrong', issues: [{ type: 'empty', text: 'المازورة فارغة.' }] };
    }
    if (user.join('|') === correct.join('|')) return { status: 'exact', issues: [] };
    if (uT === cap && sameRhythm(user, correct)) {
      return { status: 'equivalent', issues: [{ type: 'notation', text: 'الإيقاع صحيح بكتابة مختلفة؛ الكتابة المعتادة: ' + correct.map((id) => FIG[id].name).join(' + ') + '.' }] };
    }
    if (uT === cap && opts && 'rollTicks' in opts && audibleKey(user, rollTicks) === audibleKey(correct, rollTicks)) {
      // مثل «كروش + سكتة كروش» بدل «نوار»: الضربات في مواضعها، والفرق في امتداد لا تُظهره ضربة الآلة الإيقاعية
      return { status: 'equivalent', issues: [{ type: 'inaudible-length', text: 'النقرات في مواضعها الصحيحة؛ والفرق في امتداد علامة قصيرة لا تُظهره ضربة الآلة الإيقاعية. الكتابة الأدق: ' + correct.map((id) => FIG[id].name).join(' + ') + '.' }] };
    }
    if (uT !== cap) {
      issues.push({ type: 'duration', text: 'مجموع الأزمنة ' + beatsText(uT) + ' والميزان يحتاج ' + beats + (uT < cap ? ' (ناقصة).' : ' (زائدة).') });
    }
    const uTL = timeline(user), cTL = timeline(correct);
    const uOn = onsets(uTL), cOn = onsets(cTL);
    // تحليل كل ضربة (وحدة) على حدة — في المازورة الناقصة تُحلَّل الضربات المدوَّنة فقط
    const lastBeat = uT < cap ? Math.ceil(uT / TPB) : beats;
    if (lastBeat < beats) issues.push({ type: 'duration', text: (lastBeat + 1 === beats ? 'الضربة ' + beats : 'الضربات من ' + (lastBeat + 1) + ' إلى ' + beats) + ' غير مدوَّنة.' });
    for (let b = 0; b < lastBeat; b++) {
      const lo = b * TPB, hi = lo + TPB;
      const uo = uOn.filter((t) => t >= lo && t < hi), co = cOn.filter((t) => t >= lo && t < hi);
      const restAt = (tl, t) => tl.some((e) => e.rest && e.t <= t && t < e.t + e.d);
      const silentWhereSound = co.some((t) => restAt(uTL, t)) || uo.some((t) => restAt(cTL, t));
      if (uo.join() === co.join()) continue;
      if (silentWhereSound) issues.push({ type: 'rests', beat: b + 1, text: 'الضربة ' + (b + 1) + ': موضع السكتة غير صحيح.' });
      else if (uo.length !== co.length) issues.push({ type: 'subdivision', beat: b + 1, text: 'الضربة ' + (b + 1) + ': تقسيم الضربة غير صحيح (' + (uo.length > co.length ? 'نقرات أكثر' : 'نقرات أقل') + ' مما سُمع).' });
      else issues.push({ type: 'distribution', beat: b + 1, text: 'الضربة ' + (b + 1) + ': توزيع النقرات داخل الضربة غير صحيح.' });
    }
    if (uT === cap && issues.length === 0) {
      // مواضع البدايات صحيحة، والاختلاف في امتداد العلامة مقابل السكتة (مثل نوار + سكتة نوار بدل بلانش)
      issues.push({ type: 'length', text: 'مواضع النقرات صحيحة، لكن امتداد العلامات أو السكتات بعدها غير صحيح.' });
    }
    return { status: 'wrong', issues };
  }

  /**
   * تصحيح الإجابة كاملة.
   *  userMeasures / correctMeasures: مصفوفات من معرّفات الأشكال لكل مازورة
   *  opts.acceptEquivalent (افتراضي true): قبول الكتابة المكافئة سمعيًا
   *  النقاط: 10 لكل مازورة صحيحة + 10 مكافأة للنمط الكامل.
   */
  function gradeAnswer(userMeasures, correctMeasures, beats, opts) {
    const acceptEq = !opts || opts.acceptEquivalent !== false;
    const per = correctMeasures.map((c, i) => {
      const r = gradeMeasure(userMeasures[i] || [], c, beats, opts);
      r.ok = r.status === 'exact' || (acceptEq && r.status === 'equivalent');
      if (r.status === 'equivalent' && !acceptEq) r.issues = [{ type: 'notation', text: 'الإيقاع المسموع صحيح، لكن المطلوب في هذا التمرين كتابة الشكل الإيقاعي نفسه: ' + c.map((id) => FIG[id].name).join(' + ') + '.' }];
      return r;
    });
    const okCount = per.filter((r) => r.ok).length;
    const all = okCount === per.length;
    const points = okCount * 10 + (all ? 10 : 0);
    return { measures: per, okCount, total: per.length, all, points, maxPoints: per.length * 10 + 10 };
  }

  /** فحص التدوين الحر: هل كل مازورة مكتملة وفق الميزان؟ */
  function checkComposition(measures, beats) {
    const cap = beats * TPB;
    return measures.map((m, i) => {
      const t = seqTicks(m);
      if (!m.length) return { ok: false, text: 'المازورة (' + (i + 1) + ') فارغة.' };
      if (t === cap) return { ok: true, text: '' };
      return { ok: false, text: 'المازورة (' + (i + 1) + '): مجموعها ' + beatsText(t) + ' والمطلوب ' + beats + (t < cap ? '، ينقصها ' + beatsText(cap - t) + '.' : '، تزيد ' + beatsText(t - cap) + '.') };
    });
  }

  // --------------------------------------------------------------------------
  // جدول التشغيل الصوتي (دالة نقية — تُختبر في Node، ويستعملها محرك الصوت)
  //  events: [{type:'note'|'click'|'count', t, d (ثوانٍ), accent, m, i, k}]
  //  countIn: عدد الموازير التمهيدية (عدّ قبل البدء) · metronome: نبض الوحدة أثناء التمرين
  // --------------------------------------------------------------------------
  // النبر داخل المازورة: الأولى قوية، والثالثة في الرباعي متوسطة، والباقي ضعيف؛ وما بين الضربات أضعف.
  // الفروق معتدلة (نحو 2.6–4 ديسيبل) حتى يُدرَك أول المازورة دون مبالغة.
  const ACCENT = { 2: [1, 0.74], 3: [1, 0.74, 0.74], 4: [1, 0.74, 0.86, 0.74] };
  const OFFBEAT = 0.63;
  function velocityAt(tickInMeasure, beats) {
    if (tickInMeasure % TPB) return OFFBEAT;
    const a = ACCENT[beats] || [1];
    return a[(tickInMeasure / TPB) % a.length] != null ? a[(tickInMeasure / TPB) % a.length] : 0.74;
  }

  function buildSchedule(measures, beats, bpm, opts) {
    opts = opts || {};
    const sec = 60 / bpm / TPB;                 // ثوانٍ لكل تِك
    const countIn = opts.countIn == null ? 1 : opts.countIn;
    const lead = countIn * beats * TPB;
    const ev = [];
    for (let b = 0; b < countIn * beats; b++) {
      ev.push({ type: 'count', t: b * TPB * sec, d: 0.05, accent: b % beats === 0, beat: b % beats, vel: velocityAt((b % beats) * TPB, beats) });
    }
    let mStart = lead;
    measures.forEach((ids, m) => {
      let t = mStart;
      ids.forEach((id, i) => {
        const f = FIG[id]; if (!f) return;
        f.parts.forEach((x, k) => {
          const d = partTicks(x);
          if (!x.rest) ev.push({ type: 'note', t: t * sec, d: d * sec, m, i, k, ticks: t - mStart, len: d, vel: velocityAt(t - mStart, beats), strong: (t - mStart) === 0 });
          t += d;
        });
      });
      if (opts.metronome) {
        for (let b = 0; b < beats; b++) ev.push({ type: 'click', t: (mStart + b * TPB) * sec, d: 0.04, accent: b === 0, beat: b, vel: velocityAt(b * TPB, beats), m });
      }
      mStart += beats * TPB;
    });
    ev.sort((a, b) => a.t - b.t || (a.type === 'note' ? 1 : -1));
    return { events: ev, total: mStart * sec, lead: lead * sec, secPerTick: sec };
  }

  // --------------------------------------------------------------------------
  // مولّد الإملاء: يملأ كل مازورة بخلايا إيقاعية سليمة التدوين (كل خلية تبدأ على ضربة)
  // --------------------------------------------------------------------------
  // pos: مواضع البداية المسموحة (رقم الضربة) لكل ميزان. غير مذكور = أي ضربة.
  const CELLS = [
    { seq: ['q'] }, { seq: ['rq'], rest: true }, { seq: ['ee'] }, { seq: ['ssss'] }, { seq: ['ess'] },
    { seq: ['sse'] }, { seq: ['ses'] }, { seq: ['eds'] }, { seq: ['sed'] }, { seq: ['trip'] },
    { seq: ['e', 're'], rest: true }, { seq: ['re', 'e'], rest: true },
    { seq: ['h'], pos: { 2: [0], 3: [0, 1], 4: [0, 2] } },
    { seq: ['rh'], rest: true, pos: { 2: [0], 3: [0], 4: [0, 2] } },
    { seq: ['qd', 'e'], pos: { 2: [0], 3: [0, 1], 4: [0, 2] } },
    { seq: ['hd'], pos: { 3: [0], 4: [0, 1] } },
    { seq: ['w'], pos: { 4: [0] } },
    { seq: ['rw'], rest: true, pos: { 4: [0] } },
  ];
  CELLS.forEach((c) => { c.ticks = seqTicks(c.seq); c.beats = c.ticks / TPB; });

  function makeRng(seed) {
    if (seed == null) return Math.random;
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  /**
   * generate({ allowed: [ids], focus: [ids], beats, measures, seed })
   *  allowed: الأشكال المسموح بها في المستوى (الخلية مقبولة إن كانت كل أشكالها مسموحة)
   *  focus: الأشكال الجديدة في المستوى (تُرجَّح وتُضمن مرة واحدة على الأقل إن أمكن)
   */
  function generate(o) {
    const rnd = makeRng(o.seed);
    const allowed = new Set(o.allowed);
    const focus = new Set(o.focus || []);
    const beats = o.beats, nM = o.measures;
    const cells = CELLS.filter((c) => c.seq.every((id) => allowed.has(id)) && (!c.pos || c.pos[beats]));
    if (!cells.some((c) => c.beats === 1 && !c.rest)) {
      // لا توجد خلية من ضربة واحدة بصوت (مثل اختيار روند وحده) — نضيف النوار حتى يمكن ملء أي ميزان
      cells.push(CELLS[0]);
    }
    const weightOf = (c) => (c.seq.some((id) => focus.has(id)) ? 3 : 1) * (c.rest ? 0.45 : 1) * (c.beats >= 3 ? 0.6 : 1);
    const pick = (list) => {
      const tot = list.reduce((a, c) => a + weightOf(c), 0);
      let r = rnd() * tot;
      for (const c of list) { r -= weightOf(c); if (r <= 0) return c; }
      return list[list.length - 1];
    };
    const one = () => {
      const out = [];
      for (let m = 0; m < nM; m++) {
        let b = 0; const seq = [];
        let tries = 0;
        while (b < beats) {
          const fits = cells.filter((c) => c.beats <= beats - b && (!c.pos || (c.pos[beats] || []).includes(b)) &&
            !(m === 0 && b === 0 && c.rest));            // لا نبدأ التمرين بصمت
          const c = pick(fits);
          seq.push(...c.seq); b += c.beats;
          if (++tries > 50) break;
        }
        // مازورة كلها سكتات لا تصلح للإملاء
        if (timeline(seq).every((e) => e.rest)) { m--; continue; }
        out.push(seq);
      }
      return out;
    };
    let best = one();
    if (focus.size) {
      for (let i = 0; i < 40 && !best.some((ms) => ms.some((id) => focus.has(id))); i++) best = one();
    }
    // تجنب تكرار المازورة نفسها في كل الموازير
    for (let i = 0; i < 20 && nM > 1 && best.every((ms) => ms.join() === best[0].join()); i++) best = one();
    return best;
  }

  /** تقسيم تسلسل أشكال إلى موازير (لنماذج الدليل المكتوبة كتسلسل واحد) */
  function splitMeasures(ids, beats) {
    const cap = beats * TPB, out = [[]];
    let t = 0;
    ids.forEach((id) => {
      if (t >= cap) { out.push([]); t = 0; }
      out[out.length - 1].push(id); t += FIG[id].ticks;
    });
    return out;
  }

  const API = {
    TPB, FIGURES, FIG, CELLS, figure, partTicks, seqTicks, beatsText, timeline, sameRhythm,
    gradeMeasure, gradeAnswer, checkComposition, buildSchedule, generate, splitMeasures, makeRng, audibleKey, velocityAt, ACCENT,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.RD = API;
})(typeof window !== 'undefined' ? window : globalThis);
