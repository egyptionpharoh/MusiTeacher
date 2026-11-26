// =====================================================================
//  منطق جولة متسابق واحد: القيادة (السرعة والمسارات)، تجهيز كل سؤال مسبقًا (الصور والصوت ولافتات البوابة)
//  قبل عرضه، المفترقات والتقييم (10 نقاط لكل إجابة صحيحة)، أنماط اللعب، الكاميرا (خلفية/قريبة/علوية/منظور السائق)،
//  والارتطام الكرتوني. لا يتعامل مع DOM مباشرة: يستدعي ui.* فقط، ويبلغ main عن نهاية الجولة عبر app.onTurnEnd.
//
//  سبب «ظهور الخيارات واختفائها» في النسخة السابقة وعلاجه:
//   ١) مؤقّت التغذية الراجعة للسؤال السابق كان يُخفي بطاقات الخيارات بعد أن يكون السؤال التالي قد ظهر.
//      الآن لكل سؤال رقم (qid) ولا يُخفي المؤقت إلا بطاقات سؤاله هو.
//   ٢) السؤال كان يُعرض ثم تُرسم صوره واحدة تلو الأخرى (انتظار غير متزامن) فتظهر البطاقات ناقصة.
//      الآن يُجهَّز السؤال كاملًا (صور اللوحة والخيارات + صوت الراديو + لافتات البوابة) قبل عرضه، ويُعرض دفعة واحدة.
//   ٣) أي سؤال تفشل صوره أو صوته في التحميل يُتخطّى مع تسجيل السبب في وحدة التحكم، ولا يظهر ناقصًا.
// =====================================================================
import * as THREE from 'three';
import { Junction, laneXs, COMMIT, finishLine } from '../world/gates.js';
import { ROAD_W } from '../world/world.js';
import { signImage, rasterImage } from '../world/signs.js';
import { POINTS } from '../data/contest.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const CRUISE = [0, 13, 16, 19, 22];          // م/ث حسب المستوى (≈ 47 – 79 كم/س)
export const CAMS = ['chase', 'pov', 'close', 'high'];

/** يجهّز صور سؤال (اللوحة + الخيارات) بعد التأكد من تحميل كل صورة نقطية؛ يرمي خطأ إن تعذّر شيء */
export async function prepareImages(ch) {
  const specs = [ch.cue, ...ch.options.map((o) => o.sign)].filter(Boolean);
  for (const s of specs) if (s.t === 'img') { const im = await rasterImage(s.src); if (!im) throw new Error('تعذّر تحميل صورة'); }
  const cue = ch.cue ? await signImage(ch.cue, 520, 220, {}) : null;
  const opts = await Promise.all(ch.options.map((o) => signImage(o.sign, 360, 200, {})));
  return { cue, opts };
}

const C_UP = 2.8, C_HOLD = 3.8, C_DOWN = 2.8;   // الكاميرا السينمائية: زمن الصعود والتحليق والهبوط (ث)
export class Race {
  constructor(app) {
    this.app = app; this.state = 'idle';
    this.keys = {}; this.touch = { gas: false };
    this.oldJ = []; this.camMode = 'chase'; this.camPos = new THREE.Vector3(0, 3, 8); this.camLook = new THREE.Vector3();
    this.tok = 0;
  }

  // ------------------------------------------------------------------ بدء جولة متسابق
  start(settings, challenges, who) {
    const A = this.app;
    this.stop(true);
    if (A.audio.ctx && A.audio.ctx.state === 'suspended') A.audio.ctx.resume();   // بعد «إعادة الجولة» من نافذة الاستراحة
    this.S = settings; this.list = challenges; this.idx = -1; this.who = who || '';
    this.z = 0; this.x = laneXs(4)[1]; this.vx = 0; this.v = 0; this.vC = CRUISE[settings.level || 1] || 16;
    this.lanes = laneXs(4); this.lane = 1; this.j = null; this.oldJ = []; this.results = [];
    this.score = 0; this.ok = 0; this.streak = 0; this.bestStreak = 0; this.time = 0;
    this.replaysLeft = 0; this.gapT = 2.2; this.boostT = 0; this.finishZ = null; this.crashT = 0; this.ended = false;
    this.prep = []; this.prepare(0); this.prepare(1);
    if (this.finishObj) { A.scene.remove(this.finishObj); this.finishObj = null; }
    // «رحلة عُمان»: المحطة الحالية يحددها main.js قبل بدء الدور (world.syncTurn)
    const W = A.world; this.travel = null; this.cine = null; W.veil(0); W.reset();
    this.gateNext = true;
    const veh = A.vehicle; veh.root.position.set(this.x, 0, 0); veh.root.rotation.set(0, Math.PI, 0);
    if (veh.setPlate) veh.setPlate(settings.plate !== false ? this.who : '');
    this.camPos.set(this.x, 6, 14);
    this.state = 'countdown'; this.cd = 3.6; this.lastCd = 4;
    A.ui.hud(true); A.ui.question(null); A.ui.feedback(null);
    A.ui.contestant(this.who);
    A.audio.engine(0, veh.kind, true);
    this._applyCam();
  }

  // ------------------------------------------------------------------ تحكم
  steer(d) {
    if (this.state !== 'drive') return;
    if (this.inCommit()) { this.app.ui.flash('locked'); return; }
    this.lane = clamp(this.lane + d, 0, this.lanes.length - 1);
  }
  goLane(i) {
    if (this.state !== 'drive' || !this.j) return;
    if (this.inCommit()) { this.app.ui.flash('locked'); return; }
    this.lane = clamp(i, 0, this.lanes.length - 1);
  }
  inCommit() { return this.j && !this.j.passed && this.z < this.j.z + COMMIT + 2 && this.z > this.j.z - 1; }
  async replay() {
    if (!this.j || this.j.passed || this.state !== 'drive') return;
    const S = this.S, J = this.j;
    if (!J.ch.audio) return;
    if (S.replays >= 0 && this.replaysLeft <= 0) { this.app.ui.flash('noReplay'); return; }
    if (S.replays >= 0) this.replaysLeft--;
    this.app.ui.audioState(true, this.replaysLeft, S.replays, true);
    const d = await this.app.audio.playSpec(J.ch.audio);
    setTimeout(() => { if (this.j === J) this.app.ui.audioState(true, this.replaysLeft, S.replays, false); }, d * 1000);
  }

  // ------------------------------------------------------------------ التجهيز المسبق
  prepare(i) {
    if (i < 0 || i >= this.list.length) return null;
    if (!this.prep[i]) {
      const ch = this.list[i], A = this.app;
      this.prep[i] = (async () => {
        try {
          const imgs = await prepareImages(ch);
          if (ch.audio && (await A.audio.preload(ch.audio)) === false) throw new Error('تعذّر تحميل الصوت');
          return { ch, imgs };
        } catch (e) { console.warn(`[رالي النغم] تخطّي سؤال لم يكتمل تحميله (${ch.qid || i}):`, e.message || e); return { ch, bad: true }; }
      })();
    }
    return this.prep[i];
  }

  // ------------------------------------------------------------------ المفترقات
  async spawnNext() {
    const tok = this.tok;
    let P = null;
    while (!P) {
      this.idx++;
      if (this.idx >= this.list.length) { this.spawnFinish(); return; }
      this.prepare(this.idx + 1);
      const r = await this.prepare(this.idx);
      if (tok !== this.tok || this.state !== 'drive') return;
      if (!r.bad) P = r; else this.results.push({ ch: r.ch, skipped: true });
    }
    const ch = P.ch;
    const dist = Math.max(120, this.vC * this.S.answerTime);
    // أول سؤال في محطة لها بوابة ولاية: الاختيارات تُعلَّق على البوابة العُمانية (تنويع بصري فقط؛ قواعد المفترق كما هي)
    const W = this.app.world, gate = this.gateNext && W.T && W.T.gate; this.gateNext = false;
    const J = new Junction(this.app.scene, ch, this.z - dist, { approach: dist + 40, style: gate ? 'gate' : null, name: gate ? W.T.name.replace('مسقط – ', '') : '', night: W.night });
    await J.ready;
    if (tok !== this.tok || this.state !== 'drive') { J.dispose(); return; }
    // المسافة الفعلية بعد التجهيز (السائق تقدّم قليلًا أثناءه)
    J.passed = false; J.t0 = this.time; J.dist = Math.max(40, this.z - J.z);
    this.j = J; this.lanes = J.xs;
    let best = 0; J.xs.forEach((x, i) => { if (Math.abs(x - this.x) < Math.abs(J.xs[best] - this.x)) best = i; }); this.lane = best;
    this.replaysLeft = this.S.replays;
    this.qid = (this.qid || 0) + 1;
    this.app.ui.question(ch, this.idx + 1, this.list.length, P.imgs, this.qid);      // متزامن: كل الصور جاهزة
    if (ch.audio) {
      this.app.ui.audioState(true, this.replaysLeft, this.S.replays, true);
      setTimeout(async () => {
        if (this.j !== J || J.passed || this.state !== 'drive') return;
        const d = await this.app.audio.playSpec(ch.audio);
        setTimeout(() => { if (this.j === J) this.app.ui.audioState(true, this.replaysLeft, this.S.replays, false); }, d * 1000);
      }, 600);
    } else this.app.ui.audioState(false);
  }
  spawnFinish() {
    this.finishZ = this.z - Math.max(90, this.vC * 5);
    this.finishObj = finishLine(this.app.scene, this.finishZ);
    this.lanes = laneXs(4);
    this.app.ui.question(null); this.app.ui.banner('🏁 الطريق إلى خط النهاية!');
  }
  judge() {
    const J = this.j, A = this.app; J.passed = true;
    let chosen = 0; J.xs.forEach((x, i) => { if (Math.abs(x - this.x) < Math.abs(J.xs[chosen] - this.x)) chosen = i; });
    const ok = chosen === J.ch.answer;
    J.reveal(chosen, J.ch.answer);
    A.audio.stopQuestion();
    const rec = { ch: J.ch, chosen, ok, took: this.time - J.t0, points: ok ? POINTS : 0 };
    this.results.push(rec);
    const correctLabel = J.ch.options[J.ch.answer].label;
    if (ok) {
      this.ok++; this.score += POINTS; this.streak++; this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.boostT = 1.6; A.audio.correct(); A.fx.confetti(this.x, this.z - 2);
      A.ui.feedback({ ok: true, points: POINTS, explain: J.ch.explain, qid: this.qid });
      this.gapT = Math.max(2.6, A.radio ? A.radio.breakTime(this.z, this.vC) : 0);   // استراحة المذياع إن كان محلّه قريبًا
    } else {
      this.streak = 0;
      if (this.S.mode === 'turns') {
        this.state = 'crash'; this.crashT = 0; J.scatter(chosen, this.v); A.audio.crash(); A.fx.stars(true);
        A.ui.feedback({ ok: false, crash: true, correctLabel, letter: J.ch.answer, explain: J.ch.explain, qid: this.qid });
      } else {
        J.scatter(chosen, this.v); A.audio.wrong();
        this.v *= this.S.mode === 'training' ? 0.35 : 0.6;
        A.ui.feedback({ ok: false, correctLabel, letter: J.ch.answer, explain: J.ch.explain, qid: this.qid });
        A.cam.shake = 0.5;
      }
      this.gapT = 4.2;                                     // وقت كافٍ لقراءة الشرح قبل السؤال التالي
    }
    A.ui.question(null, 0, 0, null, null, true);
    this.oldJ.push(J); this.j = null;
    // «رحلة عُمان»: عند بلوغ نصيب المحطة من الأسئلة تبدأ المحطة التالية على الطريق أمام السائق
    const W = A.world;
    const nextStop = W.journey ? W.answered() : -1;
    if (nextStop >= 0 && this.state === 'drive' && this.idx < this.list.length - 1) { W.beginTravel(nextStop, this.z); this.gateNext = true; }   // المحطة التالية تُبنى على الطريق أمام السائق (بلا ستار ولا توقف)
    this._planCine();
  }

  // ------------------------------------------------------------------ كل إطار
  update(dt) {
    const A = this.app, veh = A.vehicle;
    if (this.state === 'idle' || this.state === 'paused') return;
    if (this.state === 'over') { for (const J of this.oldJ) J.update(dt); this._camera(dt); A.world.update(this.z, A.camera, dt); return; }
    if (this.state === 'countdown') {
      this.cd -= dt; const n = Math.ceil(this.cd);
      if (n !== this.lastCd && n >= 0) { this.lastCd = n; A.ui.countdown(n); A.audio.beep(n === 0); }
      if (this.cd <= 0) { this.state = 'drive'; A.ui.countdown(-1); this.gapT = 1.0; this._planCine(); }
      veh.update(dt, 0, 0); A.driver.updateHands(0, 0);
      this._camera(dt); A.world.update(this.z, A.camera, dt);
      return;
    }
    this.time += dt;
    // ---- السرعة ----
    const k = this.keys, T = this.touch;
    // دوّاسة البنزين: الضغط المستمر يرفع السرعة تدريجيًا حتى ١٫٤٥ من سرعة السير، والترك يعيدها بهدوء إلى سرعة السير
    const gas = k.ArrowUp || k.KeyW || T.gas;
    let target = this.vC; if (gas) target = this.vC * 1.45;
    if (this.boostT > 0) { this.boostT -= dt; target = Math.max(target, this.vC * 1.5); }
    if (this.state === 'crash' || this.state === 'finished') target = 0;
    const acc = target > this.v ? (this.state === 'drive' ? 5 : 4) : (this.state === 'drive' ? 4 : 11);
    this.v += clamp(target - this.v, -acc * dt, acc * dt);
    this.z -= this.v * dt;
    veh.brakeLight(target < this.v - 1.5);
    if (veh.setDash) veh.setDash(this.v * 3.6);
    // ---- الحركة الجانبية ----
    const tx = this.lanes[this.lane] ?? this.x;
    const nsub = Math.max(1, Math.ceil(dt / 0.016)), h = dt / nsub;
    for (let s = 0; s < nsub; s++) { const ax = (tx - this.x) * 16 - this.vx * 7.5; this.vx = clamp(this.vx + ax * h, -7, 7); this.x += this.vx * h; }
    if (this.inCommit()) { const w = ROAD_W / this.lanes.length, c = this.lanes[this.lane]; this.x = clamp(this.x, c - w / 2 + 0.9, c + w / 2 - 0.9); }
    this.x = clamp(this.x, -ROAD_W / 2 + 0.9, ROAD_W / 2 - 0.9);
    // ---- المركبة والسائق ----
    if (this.state !== 'crash') { veh.root.position.set(this.x, 0, this.z); veh.root.rotation.set(0, Math.PI - this.vx * 0.035, 0); }
    const steerA = clamp(-this.vx * 0.09, -0.5, 0.5);
    veh.setSteer(steerA); veh.update(dt, this.v, this.vx);
    A.driver.updateHands(steerA, this.camMode === 'pov' ? steerA * 0.5 : steerA * 1.4);
    A.audio.engine(this.v, veh.kind, this.state !== 'finished');
    // ---- الجدولة ----
    if (this.state === 'drive') {
      if (!this.j && this.finishZ == null) { this.gapT -= dt; if (this.gapT <= 0) { this.gapT = 99; this.spawnNext(); } }
      if (this.j && !this.j.passed) {
        const dz = this.z - this.j.z;
        A.ui.distance(dz, dz / Math.max(1, this.v), this.inCommit(), this.j.dist, this.lane);
        if (this.z <= this.j.z + 0.2) this.judge();
      }
      if (this.finishZ != null && this.z <= this.finishZ) this.finish();
    }
    // ---- الارتطام الكرتوني (قفزة ودوران ونجوم، بلا أذى) ----
    if (this.state === 'crash') {
      this.crashT += dt; const t = this.crashT, p = clamp(t / 1.3, 0, 1);
      veh.root.position.set(this.x, Math.sin(Math.PI * p) * 1.6, this.z);
      veh.root.rotation.set(Math.sin(Math.PI * p) * 0.5, Math.PI + p * Math.PI * 2, Math.sin(p * Math.PI * 2) * 0.35);
      A.cam.shake = Math.max(A.cam.shake || 0, 0.4 * (1 - p));
      if (t > 1.3) veh.root.rotation.set(0, Math.PI, Math.sin(t * 4) * 0.03);
      if (t > 3.0 && !this.ended) { this.ended = true; this.end('crash'); }
    }
    if (A.radio) A.radio.update();
    for (const J of this.oldJ) J.update(dt);
    if (this.j) this.j.update(dt);
    this.oldJ = this.oldJ.filter((J) => { if (this.z < J.z - 70) { J.dispose(); return false; } return true; });
    this._camera(dt);
    A.world.update(this.z, A.camera, dt);
  }

  finish() {
    if (this.state === 'finished') return;
    this.state = 'finished'; this.app.audio.finish(); this.app.fx.confetti(this.x, this.z - 4, 3);
    const tok = this.tok; setTimeout(() => { if (tok === this.tok && !this.ended) { this.ended = true; this.end('finish'); } }, 2400);
  }
  end(reason) {
    const A = this.app; this.state = 'over';
    this.travel = null; A.world.veil(0); if (this.cine && this.cine.out) this._applyCam(); this.cine = null;
    A.audio.engine(0, A.vehicle.kind, false); A.audio.stopQuestion(); A.fx.stars(false);
    if (A.radio) A.radio.stop(0.4);
    const played = this.results.filter((r) => !r.skipped);
    const skipped = this.results.length - played.length;
    const total = this.list.length - skipped;                     // الأسئلة الصالحة المخصّصة لهذا المتسابق
    const res = { name: this.who, reason, score: this.score, ok: this.ok, answered: played.length, total, max: total * POINTS, time: this.time, bestStreak: this.bestStreak, results: played, skipped, mode: this.S.mode };
    if (A.onTurnEnd) A.onTurnEnd(res);
  }
  /** يوقف الجولة ويزيل البوابات (quiet: دون تغيير الواجهة) */
  stop() {
    this.tok++; this.state = 'idle';
    this.travel = null; if (this.app.world) this.app.world.veil(0);
    for (const J of this.oldJ) J.dispose(); if (this.j) this.j.dispose(); this.oldJ = []; this.j = null;
    if (this.finishObj) { this.app.scene.remove(this.finishObj); this.finishObj = null; }
    this.app.audio.stopQuestion(); this.app.audio.engine(0, 'car', false); this.app.fx.stars(false);
    if (this.app.radio) this.app.radio.stop(0.1);
    this._applyCam('chase');
  }
  pause(on) {
    if (on && this.state !== 'idle' && this.state !== 'paused' && this.state !== 'over') { this._prev = this.state; this.state = 'paused'; this.app.audio.ctx && this.app.audio.ctx.suspend(); }
    else if (!on && this.state === 'paused') { this.state = this._prev; this.app.audio.ctx && this.app.audio.ctx.resume(); }
  }

  speedOf(level) { return CRUISE[level || 1] || 16; }
  // ------------------------------------------------------------------ الكاميرا
  setCam(mode) { if (!CAMS.includes(mode)) return; this.camMode = mode; if (this.state !== 'idle') this._applyCam(); }
  /** منظور السائق: تُخفى الخوذة (الكاميرا داخلها) ويقترب المستوى القريب، ويصغر الشريط السفلي للواجهة */
  _applyCam(force) {
    const A = this.app, pov = (force || this.camMode) === 'pov';
    const d = A.driver, kind = A.vehicle && A.vehicle.kind;
    if (d && d.helmets) for (const k in d.helmets) if (d.helmets[k]) d.helmets[k].visible = !pov && k === kind;
    for (const k in A.vehicles || {}) for (const o of A.vehicles[k].povHide || []) o.visible = !pov;   // قوس الحماية أمام العين مباشرة
    // في منظور راكب الدراجة تكون العين قريبة جدًا من الرأس: نطوي عظمة الرأس (مع الشعر والوجه) فلا يظهر شيء منها داخل الكاميرا
    const hb = d && d.rig && d.rig.b('C', 'head');
    if (hb) { if (hb.userData.s0 == null) hb.userData.s0 = hb.scale.x; const col = pov && A.vehicle && A.vehicle.pov && A.vehicle.pov.collapse; hb.scale.setScalar(col ? 0.001 : hb.userData.s0); }
    A.camera.near = pov ? 0.03 : 0.1; A.camera.updateProjectionMatrix();
    document.body.classList.toggle('pov', pov);
    if (A.ui && A.ui.camState) A.ui.camState(force || this.camMode);
  }
  /** الكاميرا السينمائية: عند معلم بارز تنتقل تلقائيًا إلى لقطة درون أو لقطة جانبية قصيرة ثم تعود بسلاسة إلى منظور القيادة.
   *  لا تبدأ والمفترق قريب (أقل من ١٠٠ م)، وتنسحب فورًا إذا اقترب (٥٨ م) حتى يرى الطالب الطريق والمسارات عند الاختيار. */
  /** بعد الإجابة (أو عند الانطلاق): إن كان أمام السائق معلم له لقطة سينمائية، يؤجَّل السؤال التالي حتى تنتهي اللقطة — فلا تعمل الكاميرا السينمائية أثناء أي سؤال */
  _planCine() {
    if (this.S.cine === false || this.state !== 'drive' || this.finishZ != null || this.idx >= this.list.length - 1) return;
    const W = this.app.world, o = W.cineAhead(this.z); if (!o) return;
    const wait = Math.max(0, this.z - o.position.z - W.cineRange(o)) / Math.max(8, this.vC);
    this.gapT = Math.max(this.gapT, wait + C_UP + C_HOLD + C_DOWN + 0.3);
  }
  /** الكاميرا السينمائية (درون): صعود تدريجي ناعم، ثم تحليق هادئ يُظهر المعلم ومحيطه، ثم هبوط تدريجي إلى منظور القيادة.
   *  تعمل فقط في الاستراحة بين سؤالين (لا سؤال ظاهر)، ولكل معلم لقطة واحدة في المسابقة. */
  _cine(dt) {
    const A = this.app, W = A.world; let c = this.cine;
    const ok = this.state === 'drive' && this.S.cine !== false && this.finishZ == null;
    if (!c) {
      if (!ok || this.j) return null;
      const o = W.cineTarget(this.z); if (!o) return null;
      W.cineSeen.add(o.userData.ckey);
      if (this.gapT < 90) this.gapT = Math.max(this.gapT, C_UP + C_HOLD + C_DOWN + 0.3);
      c = this.cine = { o, type: o.userData.cine, k: 0, t: 0, down: 0, k0: 1, pos: new THREE.Vector3(), look: new THREE.Vector3() };
    }
    c.t += dt;
    const o = c.o, ox = o.position.x, oz = o.position.z, mid = Math.abs(ox) < 3, sg = mid ? 1 : Math.sign(ox), h = o.userData.half || 12, ly = o.userData.lookY || 9;
    const ss = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };       // تسارع وتباطؤ ناعمان في الطرفين
    if (!c.down && (c.t > C_UP + C_HOLD || !ok || this.j || this.z - oz < -h * 0.3)) { c.down = c.t; c.k0 = c.k; }
    if (!c.down) c.k = ss(c.t / C_UP);
    else { const u = (c.t - c.down) / C_DOWN; c.k = c.k0 * (1 - ss(u)); if (u >= 1) { if (c.out) this._applyCam(); this.cine = null; return null; } }
    const sway = Math.sin(c.t * 0.42), bob = Math.sin(c.t * 0.6) * 0.7, sea = o.position.y < 0;
    if (c.type === 'side') { c.pos.set(-sg * 10, 3.2 + bob * 0.3, this.z + 8.5); c.look.set(ox * 0.5, 5, this.z - 5 + (oz - this.z) * 0.7); }
    else { c.pos.set((mid ? 38 : -sg * (sea ? 6 : 13)) + sway * 2.2, (sea ? 20 : 24) + Math.min(h, 60) * 0.16 + bob, this.z + 30 - c.t * 0.8); c.look.set(ox * 0.6, ly * 0.55, Math.min(this.z - 14, oz + (this.z - oz) * 0.35)); }
    return c;
  }
  _camera(dt) {
    const c = this._cine(dt);
    if (!c) return this._camBase(dt);
    const cam = this.app.camera, out = c.k > 0.1;
    if (this.camMode === 'pov' && out !== !!c.out) { c.out = out; this._applyCam(out ? 'chase' : undefined); }   // خارج المركبة تظهر الخوذة وما يُخفى في منظور السائق
    this._camBase(dt);
    const e = c.k;
    cam.position.lerp(c.pos, e); cam.up.lerp(new THREE.Vector3(0, 1, 0), e).normalize();
    cam.lookAt(this.camLook.clone().lerp(c.look, e));
    cam.fov += (56 - cam.fov) * e; cam.updateProjectionMatrix();
  }
  _camBase(dt) {
    const A = this.app, cam = A.camera, veh = A.vehicle, C = veh.camera;
    if (this.camMode === 'pov' && this.state !== 'crash') return this._pov(dt);
    const vp = veh.root.position;
    let back = C.back, up = C.up;
    if (this.camMode === 'close') { back *= 0.7; up *= 0.75; }
    if (this.camMode === 'high') { back *= 1.9; up *= 3.2; }
    const speedK = clamp(this.v / 25, 0, 1);
    const want = new THREE.Vector3(vp.x * 0.75, up + speedK * 0.3, this.z + back + speedK * 0.8);
    this.camPos.lerp(want, 1 - Math.pow(0.002, dt));
    cam.position.copy(this.camPos); cam.up.set(0, 1, 0);
    if (A.cam.shake > 0) { cam.position.x += (Math.random() - 0.5) * A.cam.shake; cam.position.y += (Math.random() - 0.5) * A.cam.shake * 0.6; A.cam.shake = Math.max(0, A.cam.shake - dt); }
    const look = new THREE.Vector3(vp.x * 0.9, C.look, this.z - (this.camMode === 'high' ? 18 : 10));
    this.camLook.lerp(look, 1 - Math.pow(0.0005, dt));
    cam.lookAt(this.camLook);
    const fov = C.fov + speedK * 8 + (this.boostT > 0 ? 5 : 0);
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix();
  }
  _pov(dt) {
    const A = this.app, cam = A.camera, veh = A.vehicle, P = veh.pov || { fwd: 0.13, up: 0.07, fov: 75, pitch: -0.08 };
    const head = A.driver && A.driver.rig.b('C', 'head');
    veh.root.updateMatrixWorld(true);
    const q = new THREE.Quaternion(); veh.body.getWorldQuaternion(q);          // يشمل ميل الدراجة
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const eye = new THREE.Vector3();
    if (head) head.getWorldPosition(eye); else eye.copy(veh.root.position).add(new THREE.Vector3(0, 1, 0));
    eye.addScaledVector(fwd, P.fwd).addScaledVector(up, P.up);
    const speedK = clamp(this.v / 25, 0, 1);
    eye.y += Math.sin(this.time * 31) * 0.004 * speedK;                         // اهتزاز خفيف مع السرعة
    if (A.cam.shake > 0) { eye.x += (Math.random() - 0.5) * A.cam.shake * 0.2; A.cam.shake = Math.max(0, A.cam.shake - dt); }
    cam.position.copy(eye);
    // اتجاه النظر: إلى الأمام مع ميل بسيط للأسفل، ويتبع الميل الجانبي جزئيًا (طبيعي للراكب)
    const flatUp = new THREE.Vector3(0, 1, 0).lerp(up, veh.kind === 'moto' ? 0.6 : 0.25).normalize();
    cam.up.copy(flatUp);
    const target = eye.clone().addScaledVector(fwd, 20).addScaledVector(flatUp, 20 * Math.tan(P.pitch));
    this.camLook.lerp(target, this.camLook.distanceTo(target) > 30 ? 1 : 1 - Math.pow(0.0001, dt));
    cam.lookAt(this.camLook);
    const fov = P.fov + speedK * 6 + (this.boostT > 0 ? 4 : 0);
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix();
  }
}
