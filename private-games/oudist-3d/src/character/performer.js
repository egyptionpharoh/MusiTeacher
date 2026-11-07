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
const LEAD = 0.085;            // زمن الحركة قبل الصوت عند نقرة المستخدم (ث)

export class Performer {
  constructor(player, audio, oud) {
    this.p = player; this.audio = audio; this.oud = oud;
    this.t = 0; this.notes = []; this.strokes = []; this.fing = {}; this.lastEventT = -99; this.activeNotes = 0;
    this.onEvent = null; this.dir = 'down'; this.speedK = 1;
    this.restTip = player.restState().R.tip.slice(); this.tip = this.restTip.slice(); this.flex = 0;
    this.lastCourse = 3; this.stats = { plucks: 0, syncErrMs: [] };
  }
  // ---------- الجدولة ----------
  /** نغمة واحدة: { course, semis, finger, risha: 'down'|'up', vel, dur (ث) } عند الزمن T (ساعة المؤدّي) */
  schedule(n, T) {
    const note = { ...n, T, dur: n.dur ?? 0.9, midi: n.midi ?? midiOf(n.course, n.semis), vel: n.vel ?? 0.72, id: (this._id = (this._id || 0) + 1), sounded: false, plucked: false };
    if (!note.risha) { note.risha = this.dir; this.dir = this.dir === 'down' ? 'up' : 'down'; }
    this.notes.push(note); this.notes.sort((a, b) => a.T - b.T);
    this.planStrokes();
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
    const L = { f: {}, lastCourse: this.lastCourse };
    const releaseOf = (n) => n.relT ?? (n.T + n.dur);
    for (let f = 1; f <= 4; f++) {
      let best = null, amt = 0;
      for (const n of this.notes) {
        if (n.finger !== f) continue;
        const prep = Math.min(0.2, Math.max(0.09, (n.prepWin || 0.18)));
        const a0 = n.T - prep, a1 = n.T - 0.025, r0 = releaseOf(n), r1 = r0 + 0.07;
        if (t < a0 || t > r1) continue;
        // نغمة لاحقة على الإصبع نفسه تسبق رفع السابقة: يرتفع السابق قبيل تحضير اللاحق
        const v = t < a1 ? sstep((t - a0) / (a1 - a0)) : t < r0 ? 1 : 1 - sstep((t - r0) / (r1 - r0));
        if (!best || n.T > best.T) { best = n; amt = v; }
      }
      if (best) L.f[f] = { course: best.course, semis: best.semis, amt };
    }
    // الأوتار المطلقة: لا يبقى إصبع ضاغط على وتر يُضرب مطلقًا
    for (const n of this.notes) if (n.finger === 0 && t > n.T - 0.06 && t < releaseOf(n)) for (const f in L.f) if (L.f[f].course === n.course) L.f[f].amt = Math.min(L.f[f].amt, clamp((n.T - 0.025 - t) / 0.035, 0, 1));
    // الوتر المرئي: يُنزَل عند موضع أعلى إصبع ضاغط على كل مجموعة
    for (const c of COURSES) {
      let y = null, s = -1; for (const f in L.f) { const q = L.f[f]; if (q.course === c.index && q.amt > 0.85 && q.semis > s) { s = q.semis; y = OUD.stopY(q.semis); } }
      this.oud.setPress(c.index, y);
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
