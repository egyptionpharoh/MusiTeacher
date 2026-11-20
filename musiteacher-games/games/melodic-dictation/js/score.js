// ============================================================================
// score.js — نموذج بيانات النوتة
// كل علامة تحمل جزأين منفصلين تمامًا:
//   pitch  : { step, octave, alter }   ← بيانات النغمة (القراءة الصولفائية)
//   rhythm : { base, dots }            ← بيانات القيمة الزمنية (القراءة الإيقاعية)
// القراءة الإيقاعية لا تقرأ ولا تكتب إلا rhythm، والصولفائية لا تغيّر rhythm عند تحريك النغمة.
// الموازير لا تُخزَّن؛ بل تُستنتج من تتابع القيم الزمنية والميزان (فلا يمكن أن تختل).
// ============================================================================
(function (MT) {
  'use strict';
  const T = MT.theory;
  const EPS = 1e-6;
  const FORMAT = 'musiteacher.melodic-score';
  const VERSION = 2;
  const MAX_NOTES = 1500;

  let idSeq = 1;
  const newId = () => 'n' + Date.now().toString(36) + (idSeq++).toString(36);

  function makeNote(kind, pitch, rhythm, extra) {
    return Object.assign({
      id: newId(),
      kind: kind === 'rest' ? 'rest' : 'note',
      pitch: kind === 'rest' || !pitch ? null : { step: pitch.step, octave: pitch.octave, alter: pitch.alter === undefined ? null : pitch.alter },
      rhythm: normRhythm(rhythm),
      tie: false,
    }, extra || {});
  }

  // القيمة الزمنية: { base, dots, tuplet? }  — tuplet: 3 للتريوليه فقط (لا يجتمع مع البوانتيه)
  function normRhythm(r) {
    const out = { base: r.base, dots: r.dots ? 1 : 0 };
    if (r.tuplet === 3 && T.TUPLET_BASES.includes(r.base)) { out.tuplet = 3; out.dots = 0; }
    return out;
  }

  function emptyScore(opts) {
    opts = opts || {};
    return {
      title: opts.title || 'نوتة جديدة',
      composer: opts.composer || '',
      key: opts.key || 'C',
      beats: opts.beats || 4,
      beatType: 4,
      tempo: opts.tempo || 80,
      minMeasures: opts.minMeasures || 2,
      rhythmOnly: !!opts.rhythmOnly, // تمرين إيقاعي فقط (آلة إيقاعية/أنماط): لا نغمات للقراءة الصولفائية
      notes: [],
      marks: {}, // علامات على مستوى المازورة: { "3": { repeatStart, repeatEnd, text } }
    };
  }

  const clone = (x) => JSON.parse(JSON.stringify(x));

  // ---------------------------------------------------------------- التخطيط
  // يعيد الموازير بترتيب العلامات. العلامة التي لا يتسع لها باقي المازورة تبدأ مازورة جديدة
  // (فتظهر المازورة السابقة «ناقصة» بوضوح بدل أن تنكسر البيانات).
  function layout(score) {
    const cap = score.beats * (4 / score.beatType);
    const measures = [];
    let cur = { index: 0, items: [], used: 0 };
    let time = 0;
    score.notes.forEach((n, idx) => {
      const d = T.durationOf(n.rhythm);
      if (cur.used + d > cap + EPS && cur.used > EPS) {
        measures.push(cur);
        time += cap;
        cur = { index: measures.length, items: [], used: 0 };
      }
      cur.items.push({ note: n, idx, start: cur.used, dur: d, abs: time + cur.used });
      cur.used = T.q(cur.used + d);
      if (cur.used >= cap - EPS) {
        measures.push(cur);
        time += cap;
        cur = { index: measures.length, items: [], used: 0 };
      }
    });
    if (cur.items.length || measures.length === 0) measures.push(cur);
    while (measures.length < (score.minMeasures || 1)) measures.push({ index: measures.length, items: [], used: 0 });
    measures.forEach(m => {
      m.cap = cap;
      m.full = m.used >= cap - EPS;
      m.over = m.used > cap + EPS;
    });
    // آخر مازورة بها علامات (لتمييز «قيد الكتابة» عن «ناقصة»)
    let lastFilled = -1;
    measures.forEach((m, i) => { if (m.items.length) lastFilled = i; });
    measures.forEach((m, i) => { m.incomplete = m.items.length > 0 && !m.full && i < lastFilled; });
    return { cap, measures, lastFilled };
  }

  // تحويل فعّال: علامة التحويل العارضة تسري حتى نهاية المازورة، وإلا فعلامة السلم الأساسية
  function effectiveAlters(score, lay) {
    lay = lay || layout(score);
    const key = T.KEYS[score.key] || T.KEYS.C;
    const out = new Array(score.notes.length).fill(0);
    lay.measures.forEach(m => {
      const local = {};
      m.items.forEach(it => {
        const n = it.note;
        if (n.kind !== 'note' || !n.pitch) return;
        const k = n.pitch.step + n.pitch.octave;
        if (n.pitch.alter !== null && n.pitch.alter !== undefined) local[k] = n.pitch.alter;
        out[it.idx] = local[k] !== undefined ? local[k] : (key.alters[n.pitch.step] || 0);
      });
    });
    return out;
  }

  // ----------------------------------------------------------- المحرر + التراجع
  class ScoreDoc {
    constructor(score) {
      this.score = score || emptyScore();
      this.past = []; this.future = [];
      this.listeners = [];
    }
    onChange(fn) { this.listeners.push(fn); }
    emit(reason) { this.listeners.forEach(fn => fn(reason)); }
    snapshot() { return JSON.stringify(this.score); }
    commit(mutator, reason) {
      const before = this.snapshot();
      const res = mutator(this.score);
      if (res && res.error) return res;
      if (this.snapshot() === before) return res || { ok: true };
      this.past.push(before);
      if (this.past.length > 150) this.past.shift();
      this.future = [];
      this.emit(reason || 'edit');
      return res || { ok: true };
    }
    load(score, reason) { this.score = score; this.past = []; this.future = []; this.emit(reason || 'load'); }
    undo() { if (!this.past.length) return false; this.future.push(this.snapshot()); this.score = JSON.parse(this.past.pop()); this.emit('undo'); return true; }
    redo() { if (!this.future.length) return false; this.past.push(this.snapshot()); this.score = JSON.parse(this.future.pop()); this.emit('redo'); return true; }
    layout() { return layout(this.score); }

    // هل تتسع المازورة رقم mIdx لزيادة زمنها بمقدار delta؟
    _fits(lay, mIdx, delta) {
      const m = lay.measures[mIdx];
      if (!m) return true;
      return m.used + delta <= lay.cap + EPS;
    }

    // إدراج علامة عند الموضع index داخل المازورة mIdx (أو في النهاية)
    insert(index, note) {
      if (this.score.notes.length >= MAX_NOTES) return { error: 'وصلت النوتة إلى الحد الأقصى لعدد العلامات.' };
      const lay = layout(this.score);
      const d = T.durationOf(note.rhythm);
      if (d > lay.cap + EPS) return { error: 'قيمة ' + T.valueName(note.kind, note.rhythm) + ' (' + T.beatsText(d) + ') أطول من زمن المازورة كلها في الميزان ' + this.score.beats + '/4.' };
      let mIdx;
      if (index >= this.score.notes.length) {
        // الإلحاق في آخر النوتة
        const last = lay.measures[lay.lastFilled] || lay.measures[0];
        if (last && !last.full && last.items.length) {
          const remain = T.q(lay.cap - last.used);
          if (d > remain + EPS) {
            return { error: 'المازورة ' + (last.index + 1) + ' يتبقى فيها ' + T.beatsText(remain) + ' فقط، و' + T.valueName(note.kind, note.rhythm) + ' زمنها ' + T.beatsText(d) + '. اختر قيمة أصغر أو أكمل المازورة.', code: 'measure-full', remain };
          }
        }
        index = this.score.notes.length;
      } else {
        const it = this._itemOf(lay, index);
        mIdx = it ? it.m.index : 0;
        if (!this._fits(lay, mIdx, d)) {
          const m = lay.measures[mIdx];
          return { error: 'لا يتسع زمن المازورة ' + (mIdx + 1) + ' لعلامة إضافية: المتبقي فيها ' + T.beatsText(T.q(lay.cap - m.used)) + '.', code: 'measure-full' };
        }
      }
      return this.commit(s => { s.notes.splice(index, 0, note); return { ok: true, index }; }, 'insert');
    }

    _itemOf(lay, idx) {
      for (const m of lay.measures) for (const it of m.items) if (it.idx === idx) return { m, it };
      return null;
    }

    remove(idx) {
      if (idx < 0 || idx >= this.score.notes.length) return { error: 'لا توجد علامة محددة.' };
      return this.commit(s => {
        s.notes.splice(idx, 1);
        if (idx > 0 && s.notes[idx - 1]) s.notes[idx - 1].tie = s.notes[idx - 1].tie && !!s.notes[idx] && sameP(s.notes[idx - 1], s.notes[idx]);
        return { ok: true };
      }, 'remove');
    }

    // يغيّر النغمة فقط (لا يلمس القيمة الزمنية)
    setPitch(idx, pitch) {
      const n = this.score.notes[idx];
      if (!n) return { error: 'لا توجد علامة محددة.' };
      if (n.kind === 'rest') return { error: 'السكتة ليس لها نغمة.' };
      return this.commit(s => {
        const t = s.notes[idx];
        t.pitch = { step: pitch.step, octave: pitch.octave, alter: pitch.alter === undefined ? (t.pitch ? t.pitch.alter : null) : pitch.alter };
        // الرباط الزمني يصح فقط بين نغمتين متطابقتين
        if (t.tie && s.notes[idx + 1] && !sameP(t, s.notes[idx + 1])) t.tie = false;
        if (idx > 0 && s.notes[idx - 1].tie && !sameP(s.notes[idx - 1], t)) s.notes[idx - 1].tie = false;
        return { ok: true };
      }, 'pitch');
    }

    setAccidental(idx, alter) {
      const n = this.score.notes[idx];
      if (!n || n.kind !== 'note' || !n.pitch) return { error: 'حدّد نغمة على المدرج أولًا ثم اختر علامة التحويل.' };
      return this.commit(s => { s.notes[idx].pitch.alter = s.notes[idx].pitch.alter === alter ? null : alter; return { ok: true }; }, 'pitch');
    }

    // يغيّر القيمة الزمنية فقط (لا يلمس النغمة)
    setRhythm(idx, rhythm, kind) {
      const n = this.score.notes[idx];
      if (!n) return { error: 'لا توجد علامة محددة.' };
      const lay = layout(this.score);
      const loc = this._itemOf(lay, idx);
      const newD = T.durationOf(rhythm);
      if (newD > lay.cap + EPS) return { error: 'هذه القيمة أطول من زمن المازورة.' };
      const delta = T.q(newD - T.durationOf(n.rhythm));
      if (loc && delta > EPS && !this._fits(lay, loc.m.index, delta)) {
        return { error: 'لا يتسع زمن المازورة ' + (loc.m.index + 1) + ' لهذه القيمة: المتبقي فيها ' + T.beatsText(T.q(lay.cap - loc.m.used)) + ' فقط.', code: 'measure-full' };
      }
      return this.commit(s => {
        const t = s.notes[idx];
        t.rhythm = normRhythm(rhythm);
        if (kind && kind !== t.kind) {
          if (kind === 'rest') { t._pitchMemo = t.pitch; t.pitch = null; t.kind = 'rest'; t.tie = false; }
          else { t.kind = 'note'; t.pitch = t._pitchMemo || null; delete t._pitchMemo; }
        }
        return { ok: true };
      }, 'rhythm');
    }

    toggleTie(idx) {
      const s = this.score; const a = s.notes[idx], b = s.notes[idx + 1];
      if (!a || a.kind !== 'note') return { error: 'حدّد نغمة لربطها بالنغمة التي تليها.' };
      if (!b || b.kind !== 'note' || !sameP(a, b)) return { error: 'الرباط الزمني يربط نغمتين متتاليتين لهما الاسم والموضع نفسه.' };
      return this.commit(sc => { sc.notes[idx].tie = !sc.notes[idx].tie; return { ok: true }; }, 'tie');
    }

    setMeta(patch) {
      return this.commit(s => {
        Object.keys(patch).forEach(k => { s[k] = patch[k]; });
        return { ok: true };
      }, 'meta');
    }

    setMark(mIdx, patch) {
      return this.commit(s => {
        const m = Object.assign({}, s.marks[mIdx] || {}, patch);
        Object.keys(m).forEach(k => { if (!m[k]) delete m[k]; });
        if (Object.keys(m).length) s.marks[mIdx] = m; else delete s.marks[mIdx];
        return { ok: true };
      }, 'mark');
    }

    clear() { return this.commit(s => { s.notes = []; s.marks = {}; return { ok: true }; }, 'clear'); }
  }

  function sameP(a, b) {
    return a && b && a.pitch && b.pitch && a.pitch.step === b.pitch.step && a.pitch.octave === b.pitch.octave && (a.pitch.alter || 0) === (b.pitch.alter || 0);
  }

  // --------------------------------------------------- تسلسل التشغيل (مع الإعادات)
  // يعيد قائمة أحداث بأزمنة مطلقة (بوحدة النوار)، ويضم العلامات المربوطة في صوت واحد
  function playbackEvents(score, opts) {
    opts = opts || {};
    const lay = layout(score);
    const alters = effectiveAlters(score, lay);
    // ترتيب الموازير بعد تطبيق علامات الإعادة ‖: :‖
    const order = [];
    let repStart = 0;
    const done = new Set();
    for (let i = 0; i < lay.measures.length; i++) {
      const mk = score.marks[i] || {};
      if (mk.repeatStart) repStart = i;
      order.push(i);
      if (mk.repeatEnd && !done.has(i) && opts.repeats !== false) {
        done.add(i);
        for (let j = repStart; j <= i; j++) order.push(j);
        repStart = i + 1;
      }
    }
    const lastUsed = lay.lastFilled;
    const events = [];
    let t = 0;
    let open = null; // نغمة مربوطة ما زال صوتها ممتدًا
    order.forEach((mi, k) => {
      if (mi > lastUsed) return;
      const m = lay.measures[mi];
      m.items.forEach(it => {
        const n = it.note;
        const at = t + it.start;
        if (open && n.kind === 'note' && open.lastIdx === it.idx - 1 && Math.abs(open.t + open.dur - at) < EPS) {
          open.dur = T.q(open.dur + it.dur); open.lastIdx = it.idx; open.idxs.push(it.idx);
          events.push({ t: at, dur: it.dur, idx: it.idx, idxs: [it.idx], silent: true, kind: 'note', measure: mi, orderPos: k });
          if (!n.tie) open = null;
        } else {
          const ev = {
            t: at, dur: it.dur, idx: it.idx, idxs: [it.idx], lastIdx: it.idx, measure: mi, orderPos: k,
            kind: n.kind, pitched: n.kind === 'note' && !!n.pitch,
            midi: n.kind === 'note' && n.pitch ? T.midiOf(n.pitch.step, n.pitch.octave, alters[it.idx]) : null,
          };
          events.push(ev);
          open = (n.kind === 'note' && n.tie) ? ev : null;
        }
      });
      // المازورة الأخيرة المكتوبة قد تكون ناقصة: لا نضيف صمتًا زائدًا في نهايتها
      t += (mi === lastUsed && k === order.length - 1) ? m.used : lay.cap;
    });
    // إن لم تكن آخر مازورة في الترتيب هي الأخيرة المكتوبة
    const total = events.length ? Math.max(...events.map(e => e.t + e.dur)) : 0;
    return { events: events, total: total, cap: lay.cap };
  }

  // ------------------------------------------------------ الحفظ والاستيراد
  const VALUE_KEYS = { 4: 'whole', 2: 'half', 1: 'quarter', 0.5: 'eighth', 0.25: '16th' };
  function serialize(score, extra) {
    const out = {
      format: FORMAT,
      version: VERSION,
      app: 'MusiTeacher — مسابقة التدوين والإملاء اللحني',
      savedAt: new Date().toISOString(),
      score: {
        title: score.title || '',
        composer: score.composer || '',
        key: score.key,
        clef: 'treble',
        time: { beats: score.beats, beatType: score.beatType || 4 },
        tempo: score.tempo,
        measures: score.minMeasures,
        rhythmOnly: !!score.rhythmOnly,
        marks: score.marks || {},
        notes: score.notes.map(n => {
          const o = { type: n.kind, rhythm: { value: VALUE_KEYS[n.rhythm.base], dots: n.rhythm.dots ? 1 : 0 } };
          if (n.rhythm.tuplet === 3) o.rhythm.tuplet = 3;
          if (n.kind === 'note') {
            o.pitch = n.pitch ? { step: n.pitch.step, octave: n.pitch.octave, accidental: n.pitch.alter === null || n.pitch.alter === undefined ? null : ({ '1': 'sharp', '-1': 'flat', '0': 'natural' })[n.pitch.alter] } : null;
            if (n.tie) o.tie = true;
          }
          return o;
        }),
      },
    };
    if (extra) out.extra = extra;
    return out;
  }

  // يتحقق من الملف بدقة ويعيد { score } أو يرمي خطأ برسالة عربية واضحة — دون لمس العمل الحالي
  function deserialize(data) {
    const fail = (msg) => { const e = new Error(msg); e.userMessage = msg; throw e; };
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { fail('الملف ليس بصيغة نوتة صالحة (تعذّرت قراءة محتواه).'); }
    }
    if (!data || typeof data !== 'object') fail('الملف فارغ أو غير صالح.');
    if (data.format !== FORMAT) fail('هذا الملف ليس نوتة محفوظة من لعبة التدوين والإملاء اللحني.');
    if (typeof data.version !== 'number' || data.version > VERSION) fail('هذا الملف محفوظ بإصدار أحدث من اللعبة، حدّث الصفحة ثم حاول مجددًا.');
    const s = data.score;
    if (!s || typeof s !== 'object') fail('الملف لا يحتوي على بيانات النوتة.');
    const key = T.KEYS[s.key] ? s.key : null;
    if (!key) fail('السلم الموسيقي في الملف غير معروف: ' + String(s.key));
    const beats = s.time && Number(s.time.beats);
    if (![2, 3, 4].includes(beats)) fail('الميزان في الملف غير مدعوم (المدعوم: 2/4 و3/4 و4/4).');
    const tempo = Number(s.tempo);
    if (!(tempo >= 30 && tempo <= 220)) fail('السرعة في الملف غير صالحة.');
    if (!Array.isArray(s.notes)) fail('قائمة العلامات في الملف غير صالحة.');
    if (s.notes.length > MAX_NOTES) fail('الملف يحتوي على عدد كبير جدًا من العلامات.');
    const ACC = { sharp: 1, flat: -1, natural: 0 };
    const notes = s.notes.map((o, i) => {
      const where = ' (العلامة رقم ' + (i + 1) + ')';
      if (!o || (o.type !== 'note' && o.type !== 'rest')) fail('نوع علامة غير معروف' + where);
      const v = o.rhythm && T.VALUE_BY_KEY[o.rhythm.value];
      if (!v) fail('قيمة زمنية غير معروفة' + where);
      const dots = o.rhythm.dots ? 1 : 0;
      if (dots && v.base === 0.25) fail('دوبل كروش بوانتيه غير مدعوم' + where);
      const tuplet = o.rhythm.tuplet === undefined || o.rhythm.tuplet === null ? 0 : o.rhythm.tuplet;
      if (tuplet && (tuplet !== 3 || dots || !T.TUPLET_BASES.includes(v.base))) fail('تريوليه غير صالح' + where);
      let pitch = null;
      if (o.type === 'note' && o.pitch) {
        const st = o.pitch.step, oc = Number(o.pitch.octave);
        if (!T.STEPS.includes(st) || !Number.isInteger(oc)) fail('نغمة غير صالحة' + where);
        const pos = T.posOf({ step: st, octave: oc });
        if (pos < T.MIN_POS || pos > T.MAX_POS) fail('نغمة خارج نطاق المدرج المدعوم' + where);
        const acc = o.pitch.accidental;
        if (acc !== null && acc !== undefined && !(acc in ACC)) fail('علامة تحويل غير معروفة' + where);
        pitch = { step: st, octave: oc, alter: acc === null || acc === undefined ? null : ACC[acc] };
      }
      const n = makeNote(o.type, pitch, { base: v.base, dots, tuplet: tuplet || undefined });
      if (o.type === 'note' && o.tie) n.tie = true;
      return n;
    });
    const marks = {};
    if (s.marks && typeof s.marks === 'object') {
      Object.keys(s.marks).forEach(k => {
        const i = parseInt(k, 10); const m = s.marks[k];
        if (!(i >= 0) || !m || typeof m !== 'object') return;
        const mm = {};
        if (m.repeatStart) mm.repeatStart = true;
        if (m.repeatEnd) mm.repeatEnd = true;
        if (typeof m.text === 'string' && m.text.length <= 20) mm.text = m.text;
        if (Object.keys(mm).length) marks[i] = mm;
      });
    }
    const score = {
      title: String(s.title || 'نوتة بلا اسم').slice(0, 80),
      composer: String(s.composer || '').slice(0, 80),
      key, beats, beatType: 4, tempo: Math.round(tempo),
      minMeasures: Math.max(1, Math.min(64, parseInt(s.measures, 10) || 2)),
      rhythmOnly: !!s.rhythmOnly,
      notes, marks,
    };
    // تنبيهات غير مانعة
    const lay = layout(score);
    const warnings = [];
    if (lay.measures.some(m => m.incomplete)) warnings.push('بعض الموازير في الملف غير مكتملة الزمن، وقد ظهرت مميزة باللون البرتقالي.');
    return { score, warnings, extra: data.extra || null };
  }

  MT.score = { FORMAT, VERSION, makeNote, normRhythm, emptyScore, clone, layout, effectiveAlters, ScoreDoc, playbackEvents, serialize, deserialize, sameP, newId };
})(window.MT = window.MT || {});
