// =====================================================================
//  الواجهة: الميزان، مراحل التعلم (شاهد · شاهد ببطء · مع النبض · تدرّب)، التحكم، الكاميرا، شريط النبضات، الأنشطة.
// =====================================================================
import { METERS, SCHOOLS, DIR_AR, DIR_ARROW, ACCENT_AR, BEAT_ORD, beatDur, wrongVariant, wrongArrows } from './patterns.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rnd = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const PRAISE = ['أحسنت! 👏', 'رائع! إحساس ممتاز بالنبض 🎵', 'ممتاز يا مايسترو! 🌟', 'إجابة صحيحة، واصل! 💪', 'عمل جميل! 🎼'];
const ENCOURAGE = ['لا بأس، لنشاهد معًا مرة أخرى 🙂', 'قريب! انظر إلى اتجاه اليد بتمعّن 👀', 'محاولة جيدة، ركّز على النبضة القوية الأولى 🎯'];

const STAGES = {
  watch: { info: 'شاهد المايسترو وهي تؤدي إشارات الميزان باليد اليمنى. لاحظ أن الحركة تهبط إلى <b>النبضة الأولى القوية</b> دائمًا، وأن كل نبضة لها اتجاه ونقطة (إكتوس) ثم ارتداد خفيف.', slow: false, sound: false, step: false },
  slow: { info: 'الحركة نفسها بنصف السرعة. استعمل <b>«النبضة التالية»</b> لتتقدم اليد نبضة واحدة ثم تتوقف عند موضعها، وتابع الرقم والاتجاه أسفل الشاشة.', slow: true, sound: false, step: true },
  pulse: { info: 'الآن مع <b>النبض المسموع</b>: كل نقرة تقع لحظة وصول اليد إلى نقطة النبضة، والنقرة الأقوى هي النبضة الأولى. عُدّ بصوت مرتفع مع المايسترو، ثم قلّدها بيدك اليمنى.', slow: false, sound: true, step: false },
  practice: { info: 'اختر نشاطًا. في الأنشطة تُعرض الحركة من خلف المايسترو حتى تكون يمينها هي يمينك.', slow: false, sound: true, step: false },
};
const VIEW_NOTE = {
  front: '👀 أنت أمام المايسترو وجهًا لوجه: يدها اليمنى تظهر على <b>يسار</b> الشاشة، فما تراه معكوس كالمرآة. لتقليدها بيدك اليمنى اختر «من الخلف»، أو اطلب من المعلم «وضع المرآة».',
  behind: '🧍 أنت خلف المايسترو: <b>يمينها هو يمينك</b> — قلّد الحركة بيدك اليمنى مباشرة.',
  angle: '↗️ زاوية جانبية: لاحظ عمق الحركة، ونزول اليد إلى نقطة النبضة ثم ارتدادها.',
  hands: '✋ تكبير منطقة اليدين.',
  free: '🖐 زاوية حرة (اسحب للتدوير، والعجلة للتقريب). اختر زاوية من «العرض والكاميرا» للعودة.',
};
const HANDS_NOTE = {
  both: '🙌 اليدان معًا بحركة متناظرة: تتحركان للداخل وللخارج معًا. اليد اليمنى هي التي تحمل النمط كما في الدليل.',
  mirror: '🪞 وضع المرآة (للمعلم أمام الصف): تؤدي المايسترو باليد <b>اليسرى</b> صورةً معكوسة، فإذا قلّدها الطلاب المقابلون لها بيدهم اليمنى كانت حركتهم صحيحة.',
};

export function buildUI(E) {
  const S = E.S, T = E.transport, A = E.audio;
  // الميزان مع اتجاهات الطريقة المختارة (المنحنية أو الأسهم)
  const Mx = (m = S.meter) => ({ ...METERS[m], dirs: E.dirs(m) });
  const ui = { stage: 'watch', score: 0, streak: 0, act: null, tok: 0, hot: null, saved: null, hideMeter: false };
  const get = (k, d) => { try { const v = localStorage.getItem('mt-ts-' + k); return v == null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem('mt-ts-' + k, v); } catch (e) { /* */ } };

  // ---------------- الإعدادات الأولية
  $('#bpm').value = get('bpm', '72'); $('#bpmVal').textContent = $('#bpm').value;
  $('#vol').value = get('vol', '80'); A.setVolume($('#vol').value / 100);
  $('#voice').value = get('voice', 'wood'); A.setVoice($('#voice').value);
  const dur = () => beatDur(+$('#bpm').value, $('#slow').checked ? 0.5 : 1);

  // ---------------- الميزان
  function renderMeters() { $$('#meters button').forEach((b) => b.setAttribute('aria-checked', String(!ui.hideMeter && +b.dataset.m === S.meter))); }
  $$('#meters button').forEach((b) => b.addEventListener('click', () => { abortAct(); E.setMeter(+b.dataset.m); put('meter', b.dataset.m); }));
  if (!new URLSearchParams(location.search).has('meter') && METERS[+get('meter', '4')]) E.setMeter(+get('meter', '4'));

  // ---------------- طريقة الأداء (مدرستان، كلتاهما معروضة دون تفضيل)
  function renderSchool() {
    $$('#schools button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.school === E.school)));
    $('#schoolInfo').textContent = SCHOOLS[E.school].desc;
  }
  $$('#schools button').forEach((b) => b.addEventListener('click', () => { abortAct(); E.setSchool(b.dataset.school); put('school', b.dataset.school); }));
  if (!new URLSearchParams(location.search).has('school') && SCHOOLS[get('school', 'curved')]) E.setSchool(get('school', 'curved'));

  // ---------------- شريط النبضات
  // نص الاتجاه: الكلمات دائمًا من وجهة نظر المايسترو (كما في الدليل)، والسهم كما يظهر على الشاشة.
  // في العرض الأمامي تظهر الحركة معكوسة، فنكتب «يسار المايسترو» مع سهم يشير إلى حيث تتحرك اليد على الشاشة.
  const SIDE = { left: 'يسار', right: 'يمين' };
  const flipD = (d) => d.replace(/left|right/, (h) => (h === 'left' ? 'right' : 'left'));     // سهم الشاشة المعكوس (يشمل القطري)
  function dirText(d) {
    const h = (d.match(/left|right/) || [])[0];
    if (!h) return DIR_ARROW[d] + ' ' + DIR_AR[d];
    const facing = E.facing(), v = d.startsWith('up') ? 'أعلى ' : d.startsWith('down') ? 'أسفل ' : '';
    const words = (suffix) => (v ? 'قطريًا إلى ' + v : 'إلى ') + SIDE[h] + suffix;
    if (S.hands === 'mirror') return DIR_ARROW[facing ? d : flipD(d)] + ' ' + words('ك');
    return facing ? DIR_ARROW[flipD(d)] + ' ' + words(' المايسترو') : DIR_ARROW[d] + ' ' + DIR_AR[d];
  }
  function renderBeats() {
    const M = Mx();
    $('#hudTitle').textContent = ui.hideMeter ? 'ما الميزان؟ شاهد واستمع…' : `${M.name} ${M.sig} — ${M.n} نبضات في المازورة`;
    $('#beats').innerHTML = M.dirs.map((d, i) => `<div class="beat ${M.accents[i]}" data-i="${i}"><div class="n">${ui.hideMeter ? '?' : i + 1}</div>` +
      `<div class="a">${ui.hideMeter ? '' : 'نبر ' + ACCENT_AR[M.accents[i]]}</div><div class="d">${ui.hideMeter ? '' : dirText(d)}</div></div>`).join('');
    $('#caption').innerHTML = ui.hideMeter ? '' : 'اضغط <b>▶ ابدأ</b>: تبدأ المايسترو بضربة تحضير ثم النبضة الأولى.';
  }
  let lastPrep = false;
  E.on((ev) => {
    if (ev.type === 'meter') { renderMeters(); renderBeats(); }
    if (ev.type === 'school') { renderSchool(); renderBeats(); }
    if (ev.type === 'beat' && !ui.hideMeter) {
      $$('#beats .beat').forEach((b) => b.classList.toggle('now', +b.dataset.i === ev.i));
      const M = Mx(), d = M.dirs[ev.i];
      $('#caption').innerHTML = `<b>${ev.i + 1}</b> — النبضة ${BEAT_ORD[ev.i]} · نبر ${ACCENT_AR[ev.accent]} · ${dirText(d)}`;
    }
    if (ev.type === 'stop') { $$('#beats .beat').forEach((b) => b.classList.remove('now', 'prep')); if (!ui.hideMeter) $('#caption').innerHTML = 'اضغط <b>▶ ابدأ</b>: تبدأ المايسترو بضربة تحضير ثم النبضة الأولى.'; }
    if (ev.type === 'view') { $$('#views button').forEach((b) => b.classList.toggle('on', b.dataset.view === ev.name)); renderNote(); renderBeats(); }
    if (ev.type === 'hands') { $$('#hands button').forEach((b) => b.classList.toggle('on', b.dataset.hands === ev.h)); renderNote(); renderBeats(); }
    if (ev.type === 'performer') {
      $$('#performer button').forEach((b) => { b.classList.toggle('on', b.dataset.g === E.performer); b.disabled = ev.status === 'loading'; });
      if (ev.status === 'loading') $('#caption').textContent = 'جارٍ تحميل الشخصية…';
      if (ev.status === 'done') renderBeats();
    }
  });
  function renderNote() { const parts = [VIEW_NOTE[E.view] || '']; if (HANDS_NOTE[S.hands]) parts.push(HANDS_NOTE[S.hands]); $('#viewNote').innerHTML = parts.join('<br>'); }

  // ---------------- التحكم في الأداء
  async function play() {
    await E.ensureAudio(); S.sound = $('#sound').checked;
    if (T.playing) { E.stopAll(); return; }
    if (T.held > -1 + 1e-6) T.start(dur(), { from: T.held }); else T.start(dur());
  }
  async function restart() { await E.ensureAudio(); S.sound = $('#sound').checked; E.stopAll(); T.start(dur()); }
  async function step() { await E.ensureAudio(); S.sound = $('#sound').checked; T.step(dur()); }
  $('#btnPlay').addEventListener('click', play);
  $('#btnRestart').addEventListener('click', restart);
  $('#btnStep').addEventListener('click', step);
  function speedChanged() { $('#bpmVal').textContent = $('#bpm').value; put('bpm', $('#bpm').value); if (T.playing) { A.cancelAfter(A.now()); T.setDur(dur()); } }
  $('#bpm').addEventListener('input', speedChanged);
  $('#slow').addEventListener('change', speedChanged);
  $('#sound').addEventListener('change', () => { S.sound = $('#sound').checked; if (!S.sound) A.hush(); });
  $('#voice').addEventListener('change', () => { A.setVoice($('#voice').value); put('voice', $('#voice').value); });
  $('#vol').addEventListener('input', () => { const v = $('#vol').value / 100; A.setVolume(v); A.setMuted(v === 0); $('#volIcon').textContent = v === 0 ? '🔇' : '🔊'; put('vol', $('#vol').value); });
  $('#volIcon').addEventListener('click', (e) => { e.preventDefault(); const m = !A.muted; A.setMuted(m); $('#volIcon').textContent = m ? '🔇' : '🔊'; });
  addEventListener('keydown', (e) => {
    if (e.target.closest('input,select,textarea,button') || !$('#modal').hidden) return;
    if (e.code === 'Space' && !ui.act) { e.preventDefault(); play(); }
    if (e.key === 'Escape' && ui.act) abortAct();
  });

  // ---------------- العرض
  const SHOW = { shPath: 'path', shPoints: 'points', shNumbers: 'numbers', shTrail: 'trail', shLabel: 'label' };
  for (const id in SHOW) $('#' + id).addEventListener('change', () => { E.setShow(SHOW[id], $('#' + id).checked); if (SHOW[id] === 'label') E.setShow('halo', $('#' + id).checked); });
  function syncShow() { for (const id in SHOW) $('#' + id).checked = !!S.show[SHOW[id]]; }
  // وضع المرآة معناه مواجهة الطلاب؛ فالعرض من الخلف يعيد اليد اليمنى، واختيار المرآة يعيد العرض الأمامي
  $$('#views button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.view === 'behind' && S.hands === 'mirror') E.setHands('right'); E.setView(b.dataset.view); }));
  $$('#hands button').forEach((b) => b.addEventListener('click', () => { E.setHands(b.dataset.hands); if (b.dataset.hands === 'mirror' && !E.facing()) E.setView('front'); }));
  $$('#performer button').forEach((b) => b.addEventListener('click', () => E.setPerformer(b.dataset.g)));
  $$('#performer button').forEach((b) => b.classList.toggle('on', b.dataset.g === E.performer));
  $$('#hands button').forEach((b) => b.classList.toggle('on', b.dataset.hands === S.hands));
  $$('#views button').forEach((b) => b.classList.toggle('on', b.dataset.view === E.view));

  // ---------------- المراحل
  function setStage(st) {
    abortAct(); E.stopAll();
    ui.stage = st; const C = STAGES[st];
    $$('#stages button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.stage === st)));
    $('#stageInfo').innerHTML = C.info;
    $('#slow').checked = C.slow; $('#sound').checked = C.sound; S.sound = C.sound;
    $('#btnStep').hidden = !C.step;
    $('#practiceBox').hidden = st !== 'practice';
    $('#transportBox').querySelector('.row').hidden = st === 'practice';
    $('#hud').classList.toggle('big', st === 'pulse');
    put('stage', st);
  }
  $$('#stages button').forEach((b) => b.addEventListener('click', () => setStage(b.dataset.stage)));

  // ---------------- ملء الشاشة (يكبّر منصة اللعبة في الصفحة الأم كبقية الألعاب)
  function fsContext() {
    try { const fe = window.frameElement; if (fe && fe.ownerDocument) return { doc: fe.ownerDocument, el: fe.closest('.vlp-stage') || fe }; } catch (e) { /* أصل مختلف */ }
    return { doc: document, el: document.documentElement };
  }
  const fsEl = (d) => d.fullscreenElement || d.webkitFullscreenElement;
  const isFull = () => { const c = fsContext(); return !!(fsEl(c.doc) || fsEl(document)); };
  function toggleFull() {
    const c = fsContext();
    if (isFull()) { const d = fsEl(c.doc) ? c.doc : document; (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d); return; }
    const req = c.el.requestFullscreen || c.el.webkitRequestFullscreen;
    if (req) { try { const pr = req.call(c.el); if (pr && pr.catch) pr.catch(() => {}); } catch (e) { /* */ } }
  }
  function updateFullBtn() { const on = isFull(), b = $('#btnFull'); b.textContent = on ? '🗗' : '⛶'; b.dataset.tip = on ? 'تصغير الشاشة' : 'ملء الشاشة'; b.setAttribute('aria-label', b.dataset.tip); b.classList.toggle('on', on); }
  $('#btnFull').addEventListener('click', toggleFull);
  { const fc = fsContext(); ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => { fc.doc.addEventListener(ev, updateFullBtn); if (fc.doc !== document) document.addEventListener(ev, updateFullBtn); }); }

  // ---------------- التلميحات
  const tip = $('#tip');
  const showTip = (el) => { const t = el.dataset.tip; if (!t) return; tip.textContent = t; tip.hidden = false; const r = el.getBoundingClientRect(); const w = tip.offsetWidth; tip.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2)) + 'px'; tip.style.top = (r.bottom + 8 + tip.offsetHeight > innerHeight ? r.top - tip.offsetHeight - 8 : r.bottom + 8) + 'px'; };
  document.addEventListener('pointerover', (e) => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); else tip.hidden = true; });
  document.addEventListener('focusin', (e) => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); });
  document.addEventListener('focusout', () => { tip.hidden = true; });

  // ---------------- النوافذ: المساعدة والمصادر
  function modal(html) { $('#mBody').innerHTML = html; $('#modal').hidden = false; $('#mClose').focus(); }
  $('#mClose').addEventListener('click', () => { $('#modal').hidden = true; });
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal').hidden = true; });
  $('#btnHelp').addEventListener('click', () => modal(HELP));
  $('#btnSources').addEventListener('click', () => modal(sourcesHtml()));

  // ================================================================ الأنشطة
  const acts = { dir: actDir, order: actOrder, where: actWhere, meter: actMeter, spot: actSpot, challenge: actChallenge };
  $$('#acts button').forEach((b) => b.addEventListener('click', () => startAct(b.dataset.act)));
  $('#qClose').addEventListener('click', abortAct);
  class Abort extends Error {}
  const live = (tok) => { if (tok !== ui.tok) throw new Abort(); };
  function snapshot() { return { show: { ...S.show }, view: E.view, meter: S.meter, hands: S.hands }; }
  function restore() {
    const s = ui.saved; if (!s) return; ui.saved = null;
    ui.hideMeter = false;
    if (S.override) E.setOverride(null);
    if (S.meter !== s.meter) E.setMeter(s.meter);
    for (const k in s.show) if (S.show[k] !== s.show[k]) E.setShow(k, s.show[k]);
    if (S.hands !== s.hands) E.setHands(s.hands);
    if (s.view !== E.view && s.view !== 'free') E.setView(s.view);
    syncShow(); renderMeters(); renderBeats();
  }
  function abortAct() {
    if (!ui.act) return;
    ui.tok++; ui.act = null; clearHot();
    $('#quiz').hidden = true; $('#warnNote').hidden = true; $('#hud').hidden = false;
    $$('#acts button').forEach((b) => b.classList.remove('on'));
    E.stopAll(); restore();
    if (ui._resolve) { ui._resolve(null); ui._resolve = null; }
  }
  async function startAct(name) {
    abortAct();
    await E.ensureAudio();
    ui.saved = snapshot(); ui.act = name; const tok = ++ui.tok;
    $('#hud').hidden = true;                              // شريط النبضات يكشف الاتجاهات: يُخفى أثناء الأنشطة
    $$('#acts button').forEach((b) => b.classList.toggle('on', b.dataset.act === name));
    try { await acts[name](tok); }
    catch (e) { if (!(e instanceof Abort)) console.error(e); }
  }
  // تشغيل حتى الإكتوس k ثم انتظار التوقف
  function runTo(k, tok, sound = true) {
    return new Promise((res) => {
      S.sound = sound;
      const off = E.on((ev) => { if (ev.type === 'pause' || ev.type === 'stop') { off(); res(); } });
      T.runTo(dur(), k);
    }).then(() => live(tok));
  }
  function fromReady() { E.stopAll(); }
  function quiz({ title, text, opts, cls = '' }) {
    $('#quiz').hidden = false; $('#qTitle').textContent = title; $('#qText').innerHTML = text; $('#qFeed').textContent = ''; $('#qFeed').className = '';
    $('#qNext').hidden = true;
    const box = $('#qOpts'); box.innerHTML = '';
    return new Promise((res) => {
      ui._resolve = res;
      opts.forEach((o) => {
        const b = document.createElement('button'); b.innerHTML = o.label; b.dataset.v = o.v; if (cls) b.className = cls;
        b.addEventListener('click', () => { if (o.onClick) o.onClick(b); else if (ui._resolve === res) { ui._resolve = null; res(o.v); } });
        box.appendChild(b);
      });
    });
  }
  function mark(v, correct) { $$('#qOpts button').forEach((b) => { b.disabled = true; if (b.dataset.v == correct) b.classList.add('ok'); else if (b.dataset.v == v) b.classList.add('bad'); }); }
  function feedback(ok, extra = '') {
    if (ok) { ui.score += 10; ui.streak++; } else ui.streak = 0;
    $('#score').textContent = ui.score; $('#streak').textContent = ui.streak >= 3 ? `🔥 ${ui.streak} متتالية` : '';
    const f = $('#qFeed'); f.className = ok ? 'ok' : 'bad';
    f.innerHTML = (ok ? PRAISE[rnd(PRAISE.length)] : ENCOURAGE[rnd(ENCOURAGE.length)]) + (extra ? '<br><span style="font-weight:600;color:#1b2233">' + extra + '</span>' : '');
    if (ok && ui.streak > 0 && ui.streak % 3 === 0) celebrate(14);
    return ok;
  }
  function waitNext(tok, label = 'التالي ◀') {
    $('#qNext').hidden = false; $('#qNext').textContent = label;
    return new Promise((res) => { $('#qNext').onclick = () => { $('#qNext').onclick = null; res(); }; ui._resolve = res; }).then(() => live(tok));
  }
  $('#qReplay').addEventListener('click', () => { if (ui.replay) ui.replay(); });
  function celebrate(n = 26) {
    const c = $('#celebrate'); c.hidden = false; c.innerHTML = '';
    const sy = ['🎵', '🎶', '⭐', '🎼', '✨', '🥁'];
    for (let i = 0; i < n; i++) { const e = document.createElement('i'); e.textContent = sy[i % sy.length]; e.style.left = Math.random() * 100 + '%'; e.style.animationDelay = Math.random() * 0.6 + 's'; c.appendChild(e); }
    setTimeout(() => { c.hidden = true; c.innerHTML = ''; }, 3200);
  }
  const dirBtn = (d) => ({ v: d, label: `${DIR_ARROW[d]} ${DIR_AR[d].replace('إلى ', '')}` });
  const allDirs = () => (S.school === 'arrows' ? ['down', 'left', 'right', 'up', 'upleft', 'upright'] : ['down', 'left', 'right', 'up']);

  // 1) إلى أين تتجه اليد؟ — تتوقف المايسترو عند نبضة، ويختار الطالب اتجاه النبضة التالية
  async function actDir(tok, inChallenge = false) {
    E.setView('behind'); E.setShow('path', false); E.setShow('points', false); syncShow();
    const M = Mx(), n = M.n, k = rnd(n), next = (k + 1) % n;
    fromReady(); ui.replay = () => { fromReady(); runTo(n + k, tok).catch(() => {}); };
    quiz({ title: '🧭 إلى أين تتجه اليد؟', text: 'شاهد… ستتوقف المايسترو عند إحدى النبضات.', opts: [] });
    await runTo(n + k, tok);
    ui.expect = M.dirs[next];
    const ans = await quiz({ title: '🧭 إلى أين تتجه اليد؟', text: `${M.name} ${M.sig}: توقفت اليد عند <b>النبضة ${k + 1}</b>.<br>إلى أين تتجه اليد في <b>النبضة ${next + 1}</b>؟ <small>(الاتجاه من وجهة نظر المايسترو، وأنت خلفها فهو اتجاهك أيضًا)</small>`, opts: allDirs().map(dirBtn) });
    live(tok); const ok = ans === M.dirs[next]; mark(ans, M.dirs[next]);
    feedback(ok, `في ${M.name} تتجه النبضة ${BEAT_ORD[next]} ${DIR_AR[M.dirs[next]]}${next === 0 ? ' (النبضة الأولى القوية دائمًا إلى الأسفل)' : ''}.`);
    await runTo(n + k + 1, tok);
    if (inChallenge) return ok;
    await waitNext(tok); return actDir(tok);
  }

  // 2) رتّب الإشارات — يضغط الطالب الأسهم بترتيب نبضات الميزان
  async function actOrder(tok) {
    E.setView('behind'); E.setShow('path', false); E.setShow('points', false); syncShow();
    const M = Mx(), cards = shuffle(M.dirs.map((d, i) => ({ d, i }))); ui.expect = M.dirs;
    let pos = 0, errors = 0;
    ui.replay = null; fromReady();
    await new Promise((res) => {
      quiz({ title: '🔢 رتّب الإشارات', text: `${M.name} ${M.sig}: اضغط الإشارات بترتيب النبضات. اختر إشارة <b>النبضة 1</b>.`, cls: 'card',
        opts: cards.map((c) => ({ v: c.i, label: `${DIR_ARROW[c.d]}<small>${DIR_AR[c.d]}</small>`, onClick: (b) => {
          if (b.classList.contains('done')) return;
          const want = M.dirs[pos];
          if (c.d === want) { b.classList.add('done'); b.disabled = true; b.innerHTML = `<b>${pos + 1}</b> ${DIR_ARROW[c.d]}<small>${DIR_AR[c.d]}</small>`; pos++;
            if (pos < M.n) $('#qText').innerHTML = `أحسنت. اختر إشارة <b>النبضة ${pos + 1}</b>.`; else { ui._resolve = null; res(); } }
          else { errors++; b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 320); $('#qFeed').className = 'bad'; $('#qFeed').textContent = `ليست هذه. النبضة ${pos + 1} ${pos === 0 ? 'هي النبضة القوية…' : '— فكّر في اتجاه اليد بعد النبضة ' + pos}`; }
        } })) });
      ui._resolve = () => res();
    });
    live(tok);
    $('#qText').innerHTML = 'شاهد المايسترو تؤدي الترتيب الصحيح:';
    feedback(errors === 0, errors ? `رتّبتها مع ${errors} محاولة خاطئة. الترتيب: ${M.dirs.map((d, i) => (i + 1) + ' ' + DIR_ARROW[d]).join(' · ')}` : `الترتيب: ${M.dirs.map((d, i) => (i + 1) + ' ' + DIR_ARROW[d]).join(' · ')}`);
    await runTo(2 * M.n, tok);
    await waitNext(tok, 'نشاط جديد ◀'); return actOrder(tok);
  }

  // 3) أين تقع النبضة؟ — المسار مرسوم بنقاط بلا أرقام، ويضغط الطالب موضع نبضة معيّنة
  async function actWhere(tok, inChallenge = false) {
    const M = Mx(), j = rnd(M.n);
    E.setShow('numbers', false); E.setShow('points', true); E.setShow('path', true); syncShow();
    if (E.view !== 'behind' && E.view !== 'front') E.setView('behind');
    fromReady(); ui.replay = () => { fromReady(); runTo(M.n, tok).catch(() => {}); };
    quiz({ title: '📍 أين تقع النبضة؟', text: 'شاهد مسار اليد ونقاط النبضات…', opts: [] });
    await runTo(M.n, tok);
    const pick = new Promise((res) => {
      quiz({ title: '📍 أين تقع النبضة؟', text: `${M.name} ${M.sig}: ${S.school === 'arrows' ? `اضغط على <b>سهم النبضة ${j + 1}</b> (${BEAT_ORD[j]}).` : `اضغط على موضع <b>النبضة ${j + 1}</b> (${BEAT_ORD[j]}) على المسار.`}`, opts: [] });
      ui._resolve = res; ui.expect = j; showHot(res);
    });
    const ans = await pick; live(tok);
    const ok = ans === j;
    hotMark(ans, j);
    feedback(ok, `النبضة ${BEAT_ORD[j]} في ${M.name}: ${DIR_ARROW[M.dirs[j]]} ${DIR_AR[M.dirs[j]]}.`);
    E.setShow('numbers', true); syncShow();
    await new Promise((r) => setTimeout(r, 900)); live(tok); clearHot();
    if (inChallenge) return ok;
    await waitNext(tok); E.setShow('numbers', false); syncShow(); return actWhere(tok);
  }
  function showHot(res) {
    clearHot(); ui.hot = { res, els: [] };
    for (const p of E.beatScreenPoints()) {
      const b = document.createElement('button'); b.className = 'hot'; b.setAttribute('aria-label', 'نقطة نبضة'); b.dataset.i = p.i;
      b.addEventListener('click', () => { if (ui._resolve === res) { ui._resolve = null; res(p.i); } });
      $('#hotspots').appendChild(b); ui.hot.els.push(b);
    }
    placeHot();
  }
  function placeHot() { if (!ui.hot) return; const pts = E.beatScreenPoints(); ui.hot.els.forEach((b, i) => { const p = pts[i]; if (p) { b.style.left = p.x + 'px'; b.style.top = p.y + 'px'; } }); }
  function hotMark(v, j) { if (!ui.hot) return; ui.hot.els.forEach((b) => { if (+b.dataset.i === j) { b.classList.add('ok'); b.textContent = j + 1; } else if (+b.dataset.i === v) b.classList.add('bad'); }); }
  function clearHot() { $('#hotspots').innerHTML = ''; ui.hot = null; }

  // 4) ما الميزان؟ — بلا أرقام ولا مسار؛ يشاهد الطالب ويسمع مازورتين ويحدد الميزان
  let lastM = 0;
  async function actMeter(tok, inChallenge = false) {
    let m; do { m = [2, 3, 4][rnd(3)]; } while (m === lastM && Math.random() < 0.7); lastM = m;
    ui.hideMeter = true; E.setMeter(m); renderMeters(); renderBeats();
    E.setShow('path', false); E.setShow('points', false); syncShow();
    E.setView('front');
    ui.replay = () => { fromReady(); runTo(2 * m, tok).catch(() => {}); };
    quiz({ title: '🎼 ما الميزان؟', text: 'شاهد حركة المايسترو واستمع إلى النبر (النقرة الأقوى = النبضة الأولى)…', opts: [] });
    await runTo(2 * m, tok);
    ui.expect = m;
    const ans = await quiz({ title: '🎼 ما الميزان؟', text: 'ما الميزان الذي أدّت المايسترو إشاراته؟', opts: [2, 3, 4].map((x) => ({ v: x, label: `${METERS[x].sig} ${METERS[x].short}` })) });
    live(tok); const ok = ans === m; mark(ans, m);
    ui.hideMeter = false; renderMeters(); renderBeats();
    feedback(ok, `إنه ${METERS[m].name} ${METERS[m].sig}: ${METERS[m].n} نبضات، اتجاهاتها ${E.dirs(m).map((d) => DIR_ARROW[d]).join(' ')}.`);
    E.setShow('path', true); E.setShow('points', true); syncShow();
    if (inChallenge) return ok;
    await waitNext(tok); return actMeter(tok);
  }

  // 5) اكتشف الخطأ — تؤدي المايسترو النمط صحيحًا أو بخطأ مقصود (تنبيه ظاهر)، ويحكم الطالب
  async function actSpot(tok, inChallenge = false) {
    const M = Mx(), wrong = Math.random() < 0.6 ? (S.school === 'arrows' ? wrongArrows(S.meter) : wrongVariant(S.meter)) : null;
    $('#warnNote').hidden = false; $('#warnNote').innerHTML = '⚠️ في هذا النشاط قد تؤدي المايسترو النمط <b>بخطأ مقصود</b> لتكتشفه. النمط الصحيح يُعرض بعد الإجابة.';
    E.setOverride(wrong ? wrong.beats : null);
    E.setShow('path', false); E.setShow('points', false); syncShow();
    E.setView('behind');
    ui.replay = () => { fromReady(); runTo(2 * M.n, tok).catch(() => {}); };
    quiz({ title: '🔍 اكتشف الخطأ', text: `شاهد إشارات ${M.name} ${M.sig}…`, opts: [] });
    await runTo(2 * M.n, tok);
    ui.expect = wrong ? 'bad' : 'ok';
    let ans = await quiz({ title: '🔍 اكتشف الخطأ', text: `هل كانت إشارات ${M.name} صحيحة؟`, opts: [{ v: 'ok', label: '✅ صحيحة' }, { v: 'bad', label: '❌ فيها خطأ' }] });
    live(tok);
    let ok = (ans === 'bad') === !!wrong; mark(ans, wrong ? 'bad' : 'ok');
    let extra = '';
    if (wrong && ans === 'bad') {
      ui.expect = wrong.wrongBeat;                         // أي نبضة اختلف اتجاهها تُقبل (wrongBeats)
      const b = await quiz({ title: '🔍 اكتشف الخطأ', text: 'أحسنت الملاحظة! في أي نبضة كان الخطأ؟', opts: M.dirs.map((_, i) => ({ v: i, label: `النبضة ${i + 1}` })) });
      live(tok); ok = wrong.wrongBeats.includes(b); mark(b, ok ? b : wrong.wrongBeat);
    }
    if (wrong) extra = wrong.wrongBeats.map((i) => `النبضة ${BEAT_ORD[i]} اتجهت ${DIR_AR[wrong.dirs[i]]}، والصحيح ${DIR_AR[M.dirs[i]]}`).join('؛ ') + '.';
    else extra = 'كانت الإشارات صحيحة تمامًا.';
    feedback(ok, extra + ' شاهد النمط الصحيح الآن:');
    $('#warnNote').hidden = true;
    E.setOverride(null); E.setShow('path', true); E.setShow('points', true); syncShow();
    fromReady(); await runTo(M.n, tok);
    if (inChallenge) return ok;
    await waitNext(tok); return actSpot(tok);
  }

  // 6) التحدي: ستة أسئلة متنوعة
  async function actChallenge(tok) {
    const seq = shuffle(['dir', 'where', 'meter', 'spot', 'dir', 'meter']);
    let good = 0;
    for (let q = 0; q < seq.length; q++) {
      live(tok);
      if (seq[q] !== 'meter') { const m = [2, 3, 4][rnd(3)]; E.setMeter(m); }
      const r = await { dir: actDir, where: actWhere, meter: actMeter, spot: actSpot }[seq[q]](tok, true);
      if (r) good++;
      $('#qTitle').textContent = `🏆 التحدي — السؤال ${q + 1} من ${seq.length}`;
      await waitNext(tok, q + 1 < seq.length ? 'السؤال التالي ◀' : 'النتيجة ◀');
      E.setShow('numbers', true); syncShow();
    }
    const stars = good >= 6 ? '⭐⭐⭐' : good >= 4 ? '⭐⭐' : good >= 2 ? '⭐' : '';
    celebrate(good >= 4 ? 36 : 14);
    $('#quiz').hidden = false; $('#qTitle').textContent = '🏆 نتيجة التحدي';
    $('#qText').innerHTML = `<div style="font-size:1.6rem;text-align:center">${stars || '🎵'}</div><div style="text-align:center"><b>${good}</b> من ${seq.length} إجابات صحيحة</div>` +
      `<p>${good >= 5 ? 'أداء مايسترو حقيقي! أنت جاهز لقيادة الصف 🎼' : good >= 3 ? 'أداء جيد! راجع «شاهد ببطء» للنبضات التي أخطأت فيها ثم أعد التحدي.' : 'بداية جيدة! شاهد كل ميزان ببطء مع النبض، ثم جرّب التحدي من جديد.'}</p>`;
    $('#qOpts').innerHTML = ''; $('#qFeed').textContent = '';
    await waitNext(tok, 'تحدٍّ جديد ◀'); E.setMeter(ui.saved ? ui.saved.meter : S.meter); return actChallenge(tok);
  }

  // ---------------- الإطار
  let wasPlaying = null;
  ui.frame = () => {
    if (wasPlaying !== T.playing) {
      wasPlaying = T.playing;
      const b = $('#btnPlay'); b.textContent = T.playing ? '⏹ إيقاف' : '▶ ابدأ'; b.classList.toggle('stop', T.playing); b.classList.toggle('go', !T.playing);
    }
    const p = T.pos ? (T.playing ? T.pos(A.heardNow()) : T.held) : -1;
    const prep = T.playing && p < 0 && p > -1;
    if (prep !== lastPrep) {
      lastPrep = prep;
      const lastI = S.meter - 1;
      $$('#beats .beat').forEach((b) => b.classList.toggle('prep', prep && +b.dataset.i === lastI));
      if (prep && !ui.hideMeter) $('#caption').innerHTML = '<b>تحضير…</b> ارتداد الضربة الأخيرة يقود اليد إلى النبضة الأولى (بلا نقرة).';
    }
    if (ui.hot) placeHot();
  };

  // ---------------- البدء
  renderMeters(); renderSchool(); renderBeats(); renderNote(); syncShow();
  setStage(STAGES[get('stage', 'watch')] && get('stage', 'watch') !== 'practice' ? get('stage', 'watch') : 'watch');
  ui.setStage = setStage; ui.startAct = startAct; ui.abortAct = abortAct;
  return ui;
}

// ================================================================ النصوص
const HELP = `<h2>طريقة الاستخدام</h2>
<ol>
<li><b>اختر الميزان</b>: الثنائي 2/4، أو الثلاثي 3/4، أو الرباعي 4/4.</li>
<li><b>شاهد</b>: المايسترو تؤدي إشارات الميزان باليد اليمنى، والمسار الذهبي يرسم طريق اليد، والدوائر المرقمة مواضع النبضات (الأحمر = النبضة الأولى القوية).</li>
<li><b>شاهد ببطء</b>: الحركة نفسها بنصف السرعة، و«النبضة التالية» تقدّم اليد نبضة واحدة.</li>
<li><b>مع النبض</b>: نقرة مسموعة لحظة وصول اليد إلى كل نبضة، والأقوى هي الأولى. عُدّ وقلّد المايسترو.</li>
<li><b>تدرّب</b>: أنشطة قصيرة: اتجاه النبضة التالية، ترتيب الإشارات، موضع النبضة، تمييز الميزان، اكتشاف الخطأ، والتحدي.</li>
</ol>
<h3>مصطلحات</h3>
<ul>
<li><b>النبضة (الإكتوس)</b>: اللحظة التي تصل فيها اليد إلى نقطة النبضة وتغيّر اتجاهها؛ عندها تُسمع النقرة.</li>
<li><b>الارتداد</b>: الحركة الخفيفة بعد النبضة، تمهّد للنبضة التالية.</li>
<li><b>ضربة التحضير</b>: حركة قبل البدء (ارتداد الضربة الأخيرة) تُعلِم المجموعة بالسرعة، ثم تهبط اليد إلى النبضة الأولى.</li>
</ul>
<h3>الاتجاهات والمرآة</h3>
<p>الاتجاهات المكتوبة (يمين/يسار) من وجهة نظر المايسترو نفسها. في العرض الأمامي ترى المايسترو وجهًا لوجه فتظهر حركتها معكوسة كالمرآة؛ اختر «من الخلف» لترى الحركة كما ستؤديها أنت بيدك اليمنى.
وللمعلم الذي يقف أمام الصف خيار «مرآة» في «اليد القائدة»: تؤدي المايسترو باليد اليسرى صورة معكوسة، فيقلّدها الطلاب المقابلون لها بيدهم اليمنى صحيحة.</p>
<h3>اختصارات</h3>
<p>مسافة: تشغيل/إيقاف · Esc: إنهاء النشاط · السحب على المشهد: تدوير الكاميرا · العجلة: تقريب وإبعاد.</p>`;

function sourcesHtml() {
  const src = (m) => { const s = METERS[m].source; return `<li><b>${METERS[m].name} ${METERS[m].sig}</b>: دليل المعلم لمادة الفنون الموسيقية — ${s.grade}، درس «${s.lesson}»، ${s.proc} و${s.model}.<blockquote>«…${esc(s.text)}…»</blockquote><small>${esc(s.note)}</small></li>`; };
  return `<h2>المصادر وحقوق المحتوى</h2>
<h3>اتجاهات الإشارات (من أدلة المعلم)</h3>
<p>اتجاهات نبضات كل ميزان منقولة من أدلة المعلم لمادة الفنون الموسيقية (الفصل الدراسي الأول) الصادرة عن وزارة التعليم في سلطنة عُمان، كما هي مسجلة في بنك دروس MusiTeacher:</p>
<ul>${src(4)}${src(2)}${src(3)}</ul>
<p class="muted"><small>لم تتضمن المقتطفات المتاحة بيانات الطبعة وأرقام الصفحات لهذه الأدلة.</small></p>
<h3>طريقة «مسار الأسهم المستقيمة»</h3>
<p>مضافة طريقةً ثانية من مخططات الأسهم المرقّمة التي زوّد بها صاحب المنصة اللعبة: الثنائي 1 إلى الأسفل ثم 2 إلى الأعلى؛ الثلاثي 1 إلى الأسفل ثم 2 أفقيًا إلى اليمين ثم 3 قطريًا إلى أعلى اليسار؛
الرباعي 1 إلى الأسفل ثم 2 قطريًا إلى أعلى اليسار ثم 3 أفقيًا إلى اليمين ثم 4 قطريًا إلى أعلى اليسار. رأس كل سهم هو موضع النبضة ولحظة سماعها، واليد تسكن لحظة بعد النبضة ثم تنطلق نحو رأس السهم التالي.
في الثنائي يقع السهمان على الخط الرأسي نفسه، ورُسما متجاورين للوضوح كما في المخطط. الطريقتان تعرضان الاتجاهات نفسها تقريبًا بأسلوبين، ولا تعني إحداهما أن الأخرى خاطئة.</p>
<h3>تشريح الحركة (المسار المنحني)</h3>
<p>الأدلة تحدد الاتجاه والترتيب واليد. أما تفاصيل الحركة — نقطة النبضة (الإكتوس) حيث يتغير الاتجاه، والارتداد بعدها بثلث إلى نصف حجم الضربة، وضربة التحضير، وكِبَر الضربة الأخيرة لأنها تعود إلى نقطة بدء الضربة الأولى، واليدان المتناظرتان — فهي من مراجع تعليم القيادة العامة،
مثل: <i>Music in Motion — Basic Beat Patterns and Gesture Anatomy</i> (Pressbooks)، وهي الأنماط القياسية المعروفة في تعليم القيادة الموسيقية.</p>
<p>اخترنا «النمط القياسي البسيط» (Legato مبسّط) المناسب للمرحلة: لكل نبضة نقطة واضحة بلا زخارف. في الثنائي تتجه الثانية صاعدة إلى الأعلى نحو اليمين ثم ترتد إلى القمة، وهي الصورة المتداولة لعبارة الدليل «لأسفل ثم لأعلى».</p>
<h3>ما الذي طوّرته MusiTeacher؟</h3>
<p>المشهد ثلاثي الأبعاد، وحساب حركة الذراع واليد من مستوى القيادة، والتزامن مع النبض المسموع، والمسار ونقاط النبضات، والمراحل والأنشطة والتحدي — من تصميم MusiTeacher وليست منقولة من الأدلة. نمط «اكتشف الخطأ» خاطئ عمدًا ويُعلَن ذلك للطالب قبل عرضه.</p>
<h3>اللعبة الأصلية</h3>
<p>هذه نسخة مطوّرة من لعبة «طريقة أداء الموازين» — إعداد وبرمجة: Hussien Elmalek. أُزيل منها «تحليل الأداء» الذي كان يعرض رسائل عشوائية لا تقيس شيئًا، واستُبدل بأنشطة تُصحَّح فعليًا.</p>
<h3>الشخصية والأصوات</h3>
<p>شخصية المايسترو هي شخصية «عازفة الأكورديون ثلاثية الأبعاد» نفسها (نموذج MakeHuman بالزي العماني) من مكتبة MusiTeacher المشتركة.
أصوات النبض تسجيلات حقيقية للبلوك الخشبي والكلافيس من <b>Versilian Community Sample Library (VCSL)</b> بترخيص <b>CC0 1.0</b> (ملك عام). التفاصيل في audio/CREDITS.md.</p>
<div class="legal"><b>⚖️ تنبيه بشأن الحقوق</b><br>هذه اللعبة ليست منشورًا رسميًا لوزارة التعليم، وذِكر الأدلة مصدرًا لا يعني أن الوزارة اعتمدت اللعبة أو رعتها أو راجعتها. الاقتباسات قصيرة وللإحالة التعليمية.</div>`;
}
