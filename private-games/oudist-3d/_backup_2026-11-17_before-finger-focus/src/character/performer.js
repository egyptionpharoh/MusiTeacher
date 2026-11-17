// =====================================================================
//  «المؤدّي»: يحوّل النغمة (نقرة على خريطة الزند، أو حدث من تمرين) إلى حركة متزامنة لليدين وصوت في لحظة واحدة.
//  التوقيت (T = لحظة الصوت):
//   • اليسرى: الإصبع يتحرك إلى موضعه قبل T ويكتمل الضغط قبل T بـ 25 مللي ثانية؛ يرتفع عند نهاية مدة النغمة
//     (أو قبل نغمة تحتاجه)، ويُكتم الوتر لحظة رفع الإصبع إن كان ما زال يرنّ بتلك النغمة.
//   • اليمنى: مسار طرف الريشة من إطارات مفتاحية: تجهيز فوق الوتر في جهة الاقتراب ← نزول إلى مستوى الوتر ←
//     عبور الوتر نفسه عند T تمامًا (↓ نحو الأرض أو ↑ نحو الأعلى) ← متابعة قصيرة ← ارتفاع خفيف. الحركة من الرسغ:
//     زاوية انثناء الرسغ تتبع إزاحة الطرف فلا يتحرك الساعد إلا قليلًا.
//   • الصوت يُجدول على ساعة Web Audio للحظة T نفسها، واهتزاز الوتر المرئي يبدأ عندها.
// =====================================================================
import { OUD } from '../instrument/oud-model.js';
import { COURSES, midiOf } from '../instrument/oud-data.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const LEAD = 0.13;             // زمن الحركة قبل الصوت عند نقرة المستخدم (ث)
const SETTLE = 0.025;          // يكتمل ضغط الإصبع قبل لحظة الصوت بهذا القدر (ث)
const POS_K = 0.6;             // نسبة ما تتحركه الكف من المسافة حين تتراجع السبابة إلى نصف الوضع (والباقي مدّ إصبع)

export class Performer {
  constructor(player, audio, oud) {
    this.p = player; this.audio = audio; this.oud = oud;
    this.t = 0; this.notes = []; this.strokes = []; this.fing = {}; this.lastEventT = -99; this.activeNotes = 0;
    this.onEvent = null; this.dir = 'down'; this.speedK = 1;
    this.restTip = player.restState().R.tip.slice(); this.tip = this.restTip.slice(); this.flex = 0;
    this.lastCourse = 3; this.stats = { plucks: 0, syncErrMs: [] };
    this.handCourse = 3; this.handPos = 2; this.holds = {};
  }
  // ---------- تخطيط اليد اليسرى ----------
  // لكل نغمة: نافذة التحضير (متى يبدأ الإصبع حركته قبل الصوت)، ومتى يغادر الإصبع نغمته السابقة.
  //  • إصبع ينتقل من موضع إلى موضع آخر: يغادر الأول في الوقت المناسب (تُقصَّر النغمة السابقة قليلًا كما يفعل العازف).
  //  • هبوط على الوتر نفسه إلى إصبع أدنى: يُجهَّز الإصبع الأدنى مبكرًا تحت الأعلى («الإصبع المُعَدّ») فلا تنقطع النغمة.
  planLeft() {
    const N = this.notes, last = {}, HOME = [0, 2, 3, 4, 5];
    // مسافة انتقال الطرف التقريبية (م) من موضع إلى موضع: على امتداد الزند + عبر الأوتار
    const travel = (c0, s0, c1, s1) => Math.hypot(OUD.stopY(s0) - OUD.stopY(s1), (c0 - c1) * 0.008);
    let pv = null;
    for (const n of N) {
      if (n.finger > 0) {
        if (!n.plucked) {
          const pf = last[n.finger];
          const moved = pf && (pf.course !== n.course || pf.semis !== n.semis);
          // زمن التحضير يتناسب مع المسافة: الانتقال البعيد (تراجع السبابة إلى نصف الوضع، تبديل وتر) يبدأ أبكر فيبقى هادئًا
          const d = moved ? travel(pf.course, pf.semis, n.course, n.semis) : travel(n.course, HOME[n.finger], n.course, n.semis);
          let prep = clamp(0.16 + d * 4, 0.18, 0.34);
          if (moved) {
            prep = Math.min(prep, Math.max(0.08, (n.T - pf.T) * 0.5));
            pf.relT = Math.min(pf.relT ?? Infinity, pf.T + pf.dur, n.T - prep);
          } else if (pv && pv.finger > n.finger && pv.course === n.course && pv.semis > n.semis) prep = clamp(n.T - pv.T - 0.06, prep, 0.45);
          n.prepWin = Math.max(0.04, Math.min(prep, n.T - SETTLE - (n.tSched ?? -Infinity) - 0.005));
        }
        last[n.finger] = n;
      }
      pv = n;
    }
  }
  // ---------- الجدولة ----------
  /** نغمة واحدة: { course, semis, finger, risha: 'down'|'up', vel, dur (ث) } عند الزمن T (ساعة المؤدّي) */
  schedule(n, T) {
    const note = { ...n, T, dur: n.dur ?? 0.9, midi: n.midi ?? midiOf(n.course, n.semis), vel: n.vel ?? 0.72, id: (this._id = (this._id || 0) + 1), sounded: false, plucked: false, tSched: this.t };
    if (!note.risha) { note.risha = this.dir; this.dir = this.dir === 'down' ? 'up' : 'down'; }
    this.notes.push(note); this.notes.sort((a, b) => a.T - b.T);
    this.planStrokes(); this.planLeft();
    return note;
  }
  /** نقرة المستخدم: تُعزف بعد زمن حركة قصير جدًا */
  playNow(n) { this.audio && this.audio.init(); this.audio && this.audio.resume(); return this.schedule({ dur: 1.4, ...n }, this.t + LEAD); }
  /** تشغيل تمرين: events بالضربات، bpm، بدءًا من الآن + مهلة */
  playSequence(events, bpm, delay = 0.6, from = 0) {
    this.stop(); const beat = 60 / bpm, t0 = this.t + delay;
    const evs = events.slice(from), s0 = evs.length ? evs[0].start : 0;
    const list = evs.map((e, i) => this.schedule({ course: e.course, semis: e.semis, finger: e.finger, risha: e.risha, midi: e.midi, vel: 0.7, dur: e.beats * beat * 0.94, idx: from + i }, t0 + (e.start - s0) * beat));
    if (this.audio && this.audio.prewarm) this.audio.prewarm(list.map((n) => [n.course, n.midi, n.finger === 0, n.vel]));
    this.seqEnd = list.length ? list[list.length - 1].T + list[list.length - 1].dur : this.t;
    return list;
  }
  stop() {
    this.notes = this.notes.filter((n) => n.T <= this.t && n.plucked);    // ما بدأ يكمل حتى يُرفع الإصبع
    for (const n of this.notes) n.relT = Math.min(n.relT ?? Infinity, this.t + 0.05);
    this.planStrokes(); this.seqEnd = null;
  }
  get playing() { return this.seqEnd != null && this.t < this.seqEnd + 0.1; }
  sinceNote() { return this.activeNotes > 0 ? 0 : this.t - this.lastEventT; }

  // ---------- مسار الريشة ----------
  planStrokes() {
    this.strokes = this.notes.filter((n) => !n.plucked || n.T > this.t - 0.4).map((n) => ({ T: n.T, course: n.course, d: n.risha === 'up' ? -1 : 1, vel: n.vel, id: n.id }));
  }
  // الإطارات المفتاحية لضربة: [زمن، موضع الطرف (محلي)]
  strokeKeys(s, gapBefore) {
    const y = OUD.yPluck + (s.course - 2.5) * 0.0018, xc = OUD.courseX(s.course, y), zs = OUD.zStr(y), d = s.d;
    const k = this.speedK, ta = clamp(gapBefore * 0.45, 0.035, 0.11) * k, tb = 0.045 * k;
    return [
      [s.T - ta - 0.05 * k, [xc - d * 0.0085, y, zs + 0.0045]],          // تجهيز: فوق مستوى الأوتار في جهة الاقتراب
      [s.T - ta, [xc - d * 0.0058, y, zs - 0.0012]],                     // ينزل إلى مستوى الوتر (بين الأوتار المجاورة)
      [s.T, [xc, y, zs - 0.0019]],                                          // العبور: الطرف تحت أعلى الوتر — يلمسه ويعبره
      [s.T + tb, [xc + d * 0.0068, y, zs - 0.0010]],                       // متابعة
      [s.T + tb + 0.09 * k, [xc + d * 0.0092, y, zs + 0.0040]],            // ارتفاع خفيف بعد الضربة
    ];
  }
  tipAt(t) {
    const S = this.strokes; if (!S.length) return null;
    // الضربة الحالية/التالية
    let i = S.findIndex((s) => s.T + 0.2 > t); if (i < 0) i = S.length - 1;
    const keys = [];
    for (let j = Math.max(0, i - 1); j <= Math.min(S.length - 1, i + 1); j++) { const gap = j > 0 ? S[j].T - S[j - 1].T : 1; keys.push(...this.strokeKeys(S[j], gap)); }
    keys.sort((a, b) => a[0] - b[0]);
    // تنظيف الإطارات المتداخلة زمنيًا (ضربات سريعة متتالية): نحذف ما يسبق الإطار السابق
    const K = []; for (const k of keys) { if (K.length && k[0] <= K[K.length - 1][0] + 0.004) { if (k[0] - K[K.length - 1][0] > -0.02 && Math.abs(k[1][2] - K[K.length - 1][1][2]) > 0) { /* إطار التجهيز يُدمج */ } continue; } K.push(k); }
    if (t <= K[0][0]) return { pos: K[0][1], before: K[0][0] - t };
    if (t >= K[K.length - 1][0]) return { pos: K[K.length - 1][1], after: t - K[K.length - 1][0] };
    for (let j = 0; j < K.length - 1; j++) if (t >= K[j][0] && t <= K[j + 1][0]) { const u = (t - K[j][0]) / Math.max(1e-6, K[j + 1][0] - K[j][0]); return { pos: lerp3(K[j][1], K[j + 1][1], sstep(u)) }; }
    return { pos: K[K.length - 1][1] };
  }

  // ---------- كل إطار ----------
  update(dt) {
    this.t += dt; const t = this.t, A = this.audio;
    // 1) الصوت: جدولة دقيقة قبل الموعد بقليل
    for (const n of this.notes) {
      if (!n.sounded && n.T - t < 0.16) {
        n.sounded = true;
        if (A && A.ctx) { const when = A.now + Math.max(0, n.T - t); A.pluck(n.course, n.midi, n.finger === 0, n.vel, when); n.audioWhen = when; }
      }
      if (!n.plucked && t >= n.T) {
        n.plucked = true; this.oud.pluck(n.course, n.vel); this.stats.plucks++; this.activeNotes++; this.lastEventT = t; this.lastCourse = n.course;
        this.onEvent && this.onEvent({ type: 'on', ...n });
      }
      if (n.plucked && !n.done && t >= (n.relT ?? (n.T + n.dur))) {
        n.done = true; this.activeNotes = Math.max(0, this.activeNotes - 1); this.lastEventT = t;
        if (n.finger > 0 && A && A.voices && A.voices[n.course] && A.voices[n.course].midi === n.midi && A.voices[n.course].active) {
          const later = this.notes.some((m) => m !== n && m.course === n.course && m.T > n.T && m.T <= t + 0.03);
          if (!later) A.damp(n.course, A.now, 0.045);
        }
        this.onEvent && this.onEvent({ type: 'off', ...n });
      }
    }
    this.notes = this.notes.filter((n) => !(n.done && t > (n.relT ?? (n.T + n.dur)) + 0.6));
    if (this.strokes.length && this.strokes[0].T < t - 0.6) this.planStrokes();
    // 2) اليد اليسرى: لكل إصبع النغمة التي تخصه الآن
    const releaseOf = (n) => n.relT ?? (n.T + n.dur), prepOf = (n) => n.prepWin ?? 0.18;
    // الوتر الذي تعمل عليه الكف ووضعها على الزند: من أحدث نغمة مضغوطة بدأ تحضيرها (الأوتار المطلقة لا تحرّك الكف)
    { let hn = null, pn = null;
      for (const n of this.notes) { if (n.finger > 0 && t >= n.T - prepOf(n) - 0.06) { if (!hn || n.T > hn.T) hn = n; if (n.finger === 1 && (!pn || n.T > pn.T)) pn = n; } }
      if (hn) this.handCourse = hn.course;
      if (pn) this.handPos = pn.semis < 2 ? pn.semis : 2; }
    const L = { f: {}, course: this.handCourse, shift: POS_K * (OUD.stopY(this.handPos) - OUD.stopY(2)) };
    for (let f = 1; f <= 4; f++) {
      let best = null;
      for (const n of this.notes) { if (n.finger !== f) continue; if (t < n.T - prepOf(n) || t > releaseOf(n) + 0.07) continue; if (!best || n.T > best.T) best = n; }
      if (!best) continue;
      // مقدار الضغط: أقصى قيمة بين النغمات التي على الموضع نفسه (نغمة مكررة بالإصبع نفسه: يبقى ضاغطًا ولا يرتفع بينهما)
      let amt = 0;
      for (const n of this.notes) {
        if (n.finger !== f || n.course !== best.course || n.semis !== best.semis) continue;
        const a0 = n.T - prepOf(n), a1 = n.T - SETTLE, r0 = releaseOf(n), r1 = r0 + 0.07;
        if (t < a0 || t > r1) continue;
        amt = Math.max(amt, t < a1 ? sstep((t - a0) / (a1 - a0)) : t < r0 ? 1 : 1 - sstep((t - r0) / (r1 - r0)));
      }
      L.f[f] = { course: best.course, semis: best.semis, amt, T: best.T };
      if (amt > 0.9) { const h = this.holds[f]; if (!h || h.course !== best.course || h.semis !== best.semis) this.holds[f] = { course: best.course, semis: best.semis, kept: false, rel: null }; }
    }
    // الأصابع المُبقاة: حين يُعزف بإصبع أعلى على الوتر نفسه يبقى الإصبع الأدنى في موضعه (لا يتحرك إلا من يحتاج إلى الحركة)،
    // ويُرفع حين ينتهي ذلك أو يُطلب الوتر مطلقًا أو بنغمة أخفض من موضعه.
    for (let f = 1; f <= 3; f++) {
      const h = this.holds[f]; if (!h) continue;
      const own = L.f[f];
      if (own && (own.course !== h.course || own.semis !== h.semis)) { delete this.holds[f]; continue; }
      const keep = this.notes.some((m) => m.finger > f && m.course === h.course && m.semis > h.semis && t >= m.T - prepOf(m) - 0.3 && t < releaseOf(m))
        && !this.notes.some((m) => m.course === h.course && (m.finger === 0 || m.semis < h.semis) && t > m.T - 0.12 && t < releaseOf(m));
      if (keep) { h.kept = true; h.rel = null; L.f[f] = { course: h.course, semis: h.semis, amt: 1, held: true }; }
      else if (!own) {
        if (!h.kept) { delete this.holds[f]; continue; }
        if (h.rel == null) h.rel = t;
        const a = 1 - sstep((t - h.rel) / 0.08);
        if (a <= 0) delete this.holds[f]; else L.f[f] = { course: h.course, semis: h.semis, amt: a, held: true };
      }
    }
    // الأوتار المطلقة: لا يبقى إصبع ضاغط على وتر يُضرب مطلقًا. والإصبع الذي يستعد لنغمة تالية على الوتر نفسه ينتقل فوق موضعه
    // دون أن يلمس الوتر ما دام يرنّ مطلقًا، ثم ينزل قبيل نغمته (لا ينتظر ثم يقفز).
    for (const n of this.notes) if (n.finger === 0 && t > n.T - 0.06 && t < releaseOf(n)) for (const f in L.f) {
      const q = L.f[f]; if (q.course !== n.course) continue;
      if (q.T != null && q.T > n.T) q.amt = Math.min(q.amt, 0.5 + 0.5 * sstep((t - (q.T - SETTLE - 0.075)) / 0.075));
      else q.amt = Math.min(q.amt, clamp((n.T - SETTLE - t) / 0.035, 0, 1));
    }
    // الوتر المرئي: يُنزَل عند موضع أعلى إصبع ضاغط على كل مجموعة
    for (const c of COURSES) {
      let y = null, s = -1; for (const f in L.f) { const q = L.f[f]; if (q.course === c.index && q.amt > 0.85 && q.semis > s) { s = q.semis; y = OUD.stopY(q.semis); } }
      this.oud.setPress(c.index, y);
    }
    // علامة الموضع على اللوحة: للنغمة التي ترنّ الآن على كل وتر (من لحظة الصوت حتى رفع الإصبع)
    if (this.oud.setMark) for (const c of COURSES) {
      let cur = null; for (const n of this.notes) if (n.course === c.index && n.plucked && !n.done && (!cur || n.T > cur.T)) cur = n;
      this.oud.setMark(c.index, cur ? (cur.finger === 0 ? 'open' : OUD.stopY(cur.semis)) : null);
    }
    // 3) اليد اليمنى: مسار طرف الريشة + انثناء الرسغ
    const r = this.tipAt(t);
    let goal = r ? r.pos : this.restTip;
    if (r && ((r.after ?? 0) > 0.6 || (r.before ?? 0) > 0.8)) goal = lerp3(goal, this.restAt(goal), clamp(((r.after ?? 0) - 0.6) / 0.8 + ((r.before ?? 0) > 0.8 ? 1 : 0), 0, 1));
    const k = 1 - Math.exp(-dt * (r && (r.before == null || r.before < 0.4) && (r.after == null || r.after < 0.3) ? 60 : 8));
    const active = r && (r.before == null || r.before < 0.4) && (r.after == null || r.after < 0.3);
    this.tip = active ? goal.slice() : lerp3(this.tip, goal, k);     // أثناء الضربة: المسار نفسه بلا تأخير (تزامن الصوت)
    // لحظة العبور الفعلية (للاختبار): الطرف يقطع خط الوتر المستهدف
    this.tipCrossT = null;
    const nx = this.strokes.find((s) => Math.abs(s.T - t) < 0.05);
    if (nx) {
      const y = OUD.yPluck + (nx.course - 2.5) * 0.0018, xc = OUD.courseX(nx.course, y), side = (this.tip[0] - xc) * nx.d;
      if (nx._side != null && nx._side < 0 && side >= 0 && nx.crossT == null) { nx.crossT = t - dt * side / Math.max(1e-9, side - nx._side); nx.crossZ = this.tip[2] - OUD.zStr(y); this.stats.syncErrMs.push(+((nx.crossT - nx.T) * 1000).toFixed(1)); (this.stats.crossZmm = this.stats.crossZmm || []).push(+(nx.crossZ * 1000).toFixed(2)); }
      nx._side = side;
    }
    const xMid = OUD.courseX(this.lastCourse, OUD.yPluck);
    this.flex = clamp((this.tip[0] - xMid) / 0.095 / (Math.PI / 180), -12, 12);
    this.p.dt = dt; this.p.pose({ L, R: { tip: this.tip, flex: this.flex } });
  }
  restAt(tip) { return [tip[0], tip[1], OUD.zStr(OUD.yPluck) + 0.008]; }
  /** حالة اليدين عند تبديل الشخصية: تبقى كما هي (التوقيت لا يتغير) */
  snapshot() { return null; }
}
