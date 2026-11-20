/*!
 * MusiTeacher — محرك العينات الصوتية المشترك (MTAudio)
 * ----------------------------------------------------------------------------------
 * يُستعمل من كل الألعاب التي تعزف بعينات حقيقية. الفكرة:
 *   - كل آلة = مجلد في  _shared/samples/<set>/  فيه manifest.json + ملفات mp3.
 *   - manifest.json:  { set, kind: "sustained" | "sustained-loop" | "decaying" | "struck",
 *                       notes: { "A4": 69, ... }, gains: { "A4": 1.2, ... }, label }
 *   - تحميل كسول بالتوازي، وفك ترميز مرة واحدة، وذاكرة مؤقتة لكل (مجموعة).
 *   - اختيار أقرب عينة (± maxShift نصف نغمة) مع تبديل «دوّار» بين أقرب عينتين، وانحراف طفيف عشوائي
 *     في الطبقة والمستوى حتى لا يبدو تكرار النغمة آليًا.
 *   - الشدة (velocity) تتحكم في المستوى وفي سطوع الصوت (مرشح تمرير منخفض).
 *   - للآلات المستمرة (الكمان/الأكورديون): غلاف هجوم/إطلاق + تكرار متقاطع (crossfade loop) للنغمات الأطول من العينة.
 *   - إن فشل التحميل: تبقى الدالة ready=false فتستمر اللعبة بصوتها المولَّد الاحتياطي ولا يتعطل شيء.
 *
 * إضافة آلة جديدة:  ضع المجلد في _shared/samples/<set>/ مع manifest.json، ثم في اللعبة:
 *     MTAudio.attach(audioInstance, { set: 'اسم_المجموعة', ... });
 * ----------------------------------------------------------------------------------
 * عينات الآلات مرخّصة؛ بياناتها في _shared/credits.json وتُعرض في نافذة «حقوق الصوت» داخل اللعبة.
 */
(function (root) {
  'use strict';

  // مسار المجلد المشترك يُستنتج من مسار هذا السكربت نفسه (يعمل مع /play/<id>/_shared/…)
  var SCRIPT_URL = (document.currentScript && document.currentScript.src) || (location.href);
  var BASE = new URL('./', SCRIPT_URL).href;

  var INSTANCES = [];
  var SETS = {};        // مجموعات محمّلة: set -> { manifest, bufs: Map(note->{midi,buf,gain}) , state, promise }

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function loadSet(ctx, set, opts) {
    var key = set;
    if (SETS[key] && SETS[key].promise) return SETS[key];
    var S = SETS[key] = { set: set, manifest: null, bufs: [], state: 'loading', loaded: 0, total: 0, promise: null, error: null };
    var base = (opts && opts.base) || (BASE + 'samples/');
    S.promise = (async function () {
      try {
        var mr = await fetch(base + set + '/manifest.json', { credentials: 'same-origin' });
        if (!mr.ok) throw new Error('manifest ' + mr.status);
        var man = await mr.json(); S.manifest = man;
        var names = Object.keys(man.notes);
        // نسمح بتحديد مدى النغمات المطلوبة لتقليل التحميل (اختياري)
        if (opts && opts.range) names = names.filter(function (n) { var m = man.notes[n]; return m >= opts.range[0] - 6 && m <= opts.range[1] + 6; });
        S.total = names.length;
        var queue = names.slice(), workers = [];
        var worker = async function () {
          while (queue.length) {
            var n = queue.shift();
            var r = await fetch(base + set + '/' + n + '.' + (man.ext || 'mp3'), { credentials: 'same-origin' });
            if (!r.ok) throw new Error(n + ' ' + r.status);
            var ab = await r.arrayBuffer();
            var buf = await ctx.decodeAudioData(ab);
            S.bufs.push({ name: n, midi: man.notes[n], buf: buf, gain: (man.gains && man.gains[n]) || 1 });
            S.loaded++;
            if (opts && opts.onprogress) opts.onprogress(S.loaded, S.total);
          }
        };
        for (var i = 0; i < 6; i++) workers.push(worker());
        await Promise.all(workers);
        S.bufs.sort(function (a, b) { return a.midi - b.midi; });
        S.state = 'ready';
      } catch (e) {
        S.state = 'failed'; S.error = String(e && e.message || e);
        if (root.console) console.warn('[MTAudio] تعذّر تحميل عينات', set, S.error);
      }
      return S;
    })();
    return S;
  }

  // ---------------------------------------------------------------------------------
  function Sampler(ctx, cfg) {
    this.ctx = ctx; this.cfg = Object.assign({
      set: '', out: null, maxShift: 3, variation: 1,          // variation: 0..1 — شدة التنويع العشوائي
      attack: 0.006, release: 0.18, minHold: 0.08,            // minHold: أقل مدة قبل بدء الإطلاق (آلات النقر)
      level: 0.9, loopXfade: 0.22, loopStart: 0.55,
      kindOverride: null, velFilter: true, onstate: null,
    }, cfg || {});
    this.log = []; this.state = 'loading'; this.S = null;
    var self = this;
    this.S = loadSet(ctx, this.cfg.set, this.cfg);
    this.S.promise.then(function (S) { self.state = S.state; self.kind = self.cfg.kindOverride || (S.manifest && S.manifest.kind) || 'sustained'; if (self.cfg.onstate) self.cfg.onstate(S.state, S); });
  }
  Object.defineProperty(Sampler.prototype, 'ready', { get: function () { return this.S.state === 'ready' && this.S.bufs.length > 0; } });

  Sampler.prototype._pick = function (midi) {
    var arr = this.S.bufs, best = -1, bd = 1e9, second = -1, sd = 1e9;
    for (var i = 0; i < arr.length; i++) {
      var d = Math.abs(arr[i].midi - midi);
      if (d < bd) { second = best; sd = bd; best = i; bd = d; } else if (d < sd) { second = i; sd = d; }
    }
    // تبديل دوّار: حين تحتاج النغمة إلى إزاحة طبقة (لا توجد عينة مطابقة) نختار أحيانًا العينة الثانية الأقرب
    // إن كانت ضمن الحد المسموح، فيتنوع التلوين الصوتي للنغمات المتكررة. العينة المطابقة تماماً تُستعمل دائمًا.
    if (second >= 0 && bd >= 1 && sd <= Math.min(this.cfg.maxShift, 2.5) && sd - bd <= 1.5 && this.cfg.variation > 0 && Math.random() < 0.32 * this.cfg.variation) return arr[second];
    return arr[best];
  };

  /**
   * يعزف نغمة. midi قد يكون كسريًا (للمقامات الربعية). dur بالثواني (يبدأ الإطلاق بعدها).
   * o: { vel: 0..1, cents, gain, release, out (عقدة خرج بديلة لهذه النغمة) }
   */
  Sampler.prototype.play = function (midi, when, dur, o) {
    if (!this.ready) return null;
    o = o || {};
    var c = this.ctx, cfg = this.cfg, kind = this.kind;
    var s = this._pick(midi);
    var vr = cfg.variation;
    var jit = vr * rnd(-2.5, 2.5);                                 // سنتات
    var semis = midi - s.midi + ((o.cents || 0) + jit) / 100;
    var rate = Math.pow(2, semis / 12);
    var t0 = Math.max(when || 0, c.currentTime + 0.003);
    var vel = o.vel == null ? 0.8 : clamp(o.vel, 0.05, 1);
    var level = cfg.level * s.gain * (o.gain == null ? 1 : o.gain) * (0.35 + 0.65 * Math.pow(vel, 1.15)) * (1 + vr * rnd(-0.04, 0.04));
    var rel = o.release != null ? o.release : cfg.release;
    var hold = Math.max(dur, cfg.minHold);
    var t1 = t0 + hold;

    var env = c.createGain(); env.gain.value = 0;
    var tail = env;
    if (cfg.velFilter && vel < 0.95 && kind !== 'sustained-loop') {
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5;
      lp.frequency.value = clamp(1800 + 16000 * vel * vel, 1800, 18000);
      env.connect(lp); tail = lp;
    }
    tail.connect(o.out || cfg.out || c.destination);

    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(level, t0 + cfg.attack);
    var srcs = [];
    var bufDur = s.buf.duration / rate;
    var needLoop = (kind === 'sustained-loop') && (hold + rel > bufDur - 0.05);
    var endAll;
    if (!needLoop) {
      var src = c.createBufferSource(); src.buffer = s.buf; src.playbackRate.value = rate;
      src.connect(env); src.start(t0); srcs.push(src);
      endAll = t0 + bufDur;
    } else {
      // تكرار متقاطع: كل مقطع يبدأ من loopStart ويتداخل مع السابق بزمن xf (طاقة متساوية)
      var xf = cfg.loopXfade, L0 = Math.min(cfg.loopStart, s.buf.duration * 0.25);
      var segStart = t0, off = 0, first = true;
      var guard = 0;
      while (segStart < t1 + rel && guard++ < 40) {
        var segDur = (s.buf.duration - off) / rate;
        var g = c.createGain();
        var sr = c.createBufferSource(); sr.buffer = s.buf; sr.playbackRate.value = rate;
        sr.connect(g); g.connect(env);
        if (!first) { g.gain.setValueAtTime(0, segStart); g.gain.linearRampToValueAtTime(1, segStart + xf); } else g.gain.value = 1;
        var segEnd = segStart + segDur;
        g.gain.setValueAtTime(1, Math.max(segStart + xf, segEnd - xf)); g.gain.linearRampToValueAtTime(0, segEnd);
        sr.start(segStart, off); sr.stop(segEnd + 0.02); srcs.push(sr);
        first = false; off = L0; segStart = segEnd - xf;
      }
      endAll = segStart + xf;
    }
    // الإطلاق عند نهاية النغمة (للآلات «الضاربة» يرنّ الصوت طبيعيًا حتى النهاية إن كان minHold كبيرًا)
    env.gain.setValueAtTime(level, Math.max(t0 + cfg.attack + 0.001, t1));
    env.gain.setTargetAtTime(0, Math.max(t0 + cfg.attack + 0.001, t1), rel / 3);
    var stopAt = Math.min(endAll + 0.05, t1 + rel * 1.4 + 0.05);
    for (var i = 0; i < srcs.length; i++) { try { srcs[i].stop(Math.max(stopAt, t0 + 0.02)); } catch (e) { /* مجدول */ } }

    var voice = {
      start: t0, midi: midi, sample: s.name, rate: rate,
      stop: function (at, fade) {
        fade = fade == null ? 0.06 : fade;
        try { env.gain.cancelScheduledValues(at); env.gain.setValueAtTime(env.gain.value, at); env.gain.setTargetAtTime(0, at, fade / 3); for (var k = 0; k < srcs.length; k++) srcs[k].stop(at + fade * 3); } catch (e) { /* انتهى */ }
      },
      onended: null,
    };
    srcs[0].onended = function () { try { env.disconnect(); } catch (e) { /* */ } if (voice.onended) voice.onended(); };
    this.log.push({ midi: +midi.toFixed(2), sample: s.name, rate: +rate.toFixed(4), t0: +t0.toFixed(3), dur: +dur.toFixed(3), vel: +vel.toFixed(2) });
    if (this.log.length > 400) this.log.shift();
    return voice;
  };

  // ---------------------------------------------------------------------------------
  /**
   * يضيف وضع «العينات الحقيقية» إلى كائن صوت قائم (له ctx و dry و voices و play).
   * cfg.args(a, b) يحوّل وسائط play الإضافية للعبة إلى { vel, gain, cents }.
   * عند عدم جاهزية العينات تعمل دالة play الأصلية (الصوت المولَّد) كما هي.
   */
  function attach(inst, cfg) {
    if (inst.__mt) return inst.__mt;
    cfg = cfg || {};
    var out = cfg.out ? cfg.out(inst) : inst.dry;
    var sampler = new Sampler(inst.ctx, Object.assign({}, cfg, {
      out: out,
      onstate: function (st, S) {
        if (st === 'ready') { inst.mode = 'samples'; }
        if (inst.onModeChange) inst.onModeChange(inst.mode);
        if (cfg.onstate) cfg.onstate(st, S);
      },
    }));
    var orig = inst.play.bind(inst);
    inst.play = function (midi, when, dur, a, b) {
      if (sampler.ready) {
        var extra = cfg.args ? cfg.args(a, b, midi) : {};
        var v = sampler.play(midi, when, dur, extra);
        if (v) { if (inst.voices) { inst.voices.add(v); v.onended = function () { inst.voices.delete(v); }; } return v; }
      }
      return orig(midi, when, dur, a, b);
    };
    inst.sampler = sampler; inst.__mt = sampler;
    INSTANCES.push(inst);                                   // لأغراض الاختبار والتشخيص
    return sampler;
  }

  root.MTAudio = { Sampler: Sampler, attach: attach, loadSet: loadSet, base: BASE, instances: INSTANCES, _sets: SETS };
})(typeof window !== 'undefined' ? window : this);
