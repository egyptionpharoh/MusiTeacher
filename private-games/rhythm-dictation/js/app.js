// ============================================================================
// app.js — واجهة مسابقة التدوين والإملاء الإيقاعي (MusiTeacher)
// النمطان: ✍️ التدوين والقراءة الإيقاعية (حر بلا نقاط) · 🎧 الإملاء الإيقاعي (مسابقة بنقاط ودور)
// مصدر أسئلة الإملاء: 🎯 أسئلة المستويات (مولّدة) أو 📘 نماذج إيقاعية من دليل المعلم.
// ترتيب الواجهة: النمط ← المستوى ← تعليمات المستوى ← العلامات ← الموازير ← أدوات التحكم.
// ============================================================================
(function () {
  'use strict';
  const RD = window.RD, CT = window.RDContent, GL = window.RDGlyphs, AU = window.RDAudio;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function h(tag, attrs, html) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    if (html != null) el.innerHTML = html;
    return el;
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem('rd.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rd.' + k, JSON.stringify(v)); } catch (e) { /* */ } },
  };

  // ------------------------------------------------------------------ الحالة
  const ALL_IDS = RD.FIGURES.map((f) => f.id);
  const defaults = { level: 'g3', beats: 2, measures: 2, bpm: 70, timer: 0, plays: 0, questions: 5, metro: false, clap: false, names: true, equiv: true,
    custom: ['q', 'rq', 'ee', 'h'], voice: 'timpani', src: 'levels', guideId: null };
  const state = {
    mode: 'free',
    s: Object.assign({}, defaults, store.get('settings', {})),
    players: [], pmode: 'solo', turn: 0, asked: 0,
    answer: [[]], target: 0, sel: null, hist: [],
    q: null,            // سؤال الإملاء: { pattern, beats, phase, plays, result, timerLeft, timerStarted, voice, model }
    playing: false, freeMarks: null,
  };
  if (!Array.isArray(state.s.custom) || !ALL_IDS.includes(state.s.custom[0])) state.s.custom = defaults.custom.slice();
  if (!AU.VOICES[state.s.voice]) state.s.voice = 'timpani';
  if (!CT.MODELS.length) state.s.src = 'levels';
  const saveSettings = () => store.set('settings', state.s);

  const LEVEL_ALL = { id: 'all', n: '∞', short: 'كل العلامات', label: 'كل العلامات والأشكال', grade: 'مراجعة شاملة', allowed: CT.LEVELS[CT.LEVELS.length - 1].allowed, focus: [], meters: [2, 3, 4] };
  const LEVEL_CUSTOM = { id: 'custom', n: '🛠️', short: 'مخصص', label: 'مستوى مخصص', grade: 'يختاره المعلم', meters: [2, 3, 4] };
  function level() {
    const id = state.s.level;
    if (id === 'custom') return Object.assign({}, LEVEL_CUSTOM, { allowed: state.s.custom, focus: [] });
    if (id === 'all') return LEVEL_ALL;
    return CT.LEVELS.find((l) => l.id === id) || CT.LEVELS[2];
  }
  const isGuide = () => state.mode === 'dictation' && state.s.src === 'guide' && CT.MODELS.length > 0;
  const guideModel = () => CT.MODELS.find((m) => m.id === state.s.guideId) || CT.MODELS[0];
  function paletteIds() {
    if (isGuide()) return LEVEL_ALL.allowed;
    const L = level();
    return ALL_IDS.filter((id) => L.allowed.includes(id));
  }
  const active = () => state.mode === 'dictation' && state.q && state.q.phase !== 'graded';
  const curBeats = () => (state.mode === 'dictation' && state.q ? state.q.beats : isGuide() ? guideModel().beats : state.s.beats);
  const curMeasures = () => (state.mode === 'dictation' && state.q ? state.q.pattern.length : isGuide() ? guideModel().measures.length : state.s.measures);
  const curBpm = () => state.s.bpm;
  const editable = () => (state.mode === 'dictation' ? !!state.q && (state.q.phase === 'listening' || state.q.phase === 'answering') : true);

  // ------------------------------------------------------------------ أدوات عامة
  let toastT = null;
  function toast(msg, kind) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (kind ? ' ' + kind : ''); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function modal(title, body, actions) {
    $('#modalTitle').textContent = title;
    const b = $('#modalBody'); b.textContent = ''; if (typeof body === 'string') b.innerHTML = body; else if (body) b.appendChild(body);
    const a = $('#modalActions'); a.textContent = '';
    (actions || [{ label: 'حسنًا', cls: 'primary' }]).forEach((x) => a.appendChild(h('button', { type: 'button', class: 'btn ' + (x.cls || 'ghost'), onclick: () => { if (x.run && x.run() === false) return; closeModal(); } }, esc(x.label))));
    $('#modal').hidden = false;
  }
  function closeModal() { $('#modal').hidden = true; }
  function celebrate() {
    const box = $('#confetti'); box.textContent = '';
    const colors = ['#f59e0b', '#ffcc00', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + 'vw'; c.style.background = colors[i % colors.length];
      c.style.animationDelay = (Math.random() * 0.5) + 's'; c.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
      box.appendChild(c);
    }
    setTimeout(() => { box.textContent = ''; }, 3600);
  }
  // ألعاب نارية خفيفة على لوحة رسم (نحو 3.5 ثوانٍ، لا تعيق الضغط)
  function fireworks(intensity) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { celebrate(); return; }
    const cv = $('#fireworks'); cv.hidden = false;
    const W = cv.width = innerWidth, H = cv.height = innerHeight, g = cv.getContext('2d');
    const colors = ['#fbbf24', '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#ffffff'];
    const parts = []; let bursts = intensity === 'small' ? 3 : 7, t0 = performance.now(), last = 0;
    function burst() {
      const x = W * (0.15 + Math.random() * 0.7), y = H * (0.15 + Math.random() * 0.35), c = colors[Math.floor(Math.random() * colors.length)];
      for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 4.5; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c }); }
    }
    (function frame(now) {
      if (bursts > 0 && now - last > 420) { burst(); bursts--; last = now; }
      g.clearRect(0, 0, W, H);
      parts.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.985; p.life -= 0.012; g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; g.fillRect(p.x, p.y, 3, 3); });
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      if (now - t0 < 4200 && (parts.length || bursts > 0)) requestAnimationFrame(frame); else { g.clearRect(0, 0, W, H); cv.hidden = true; }
    })(performance.now());
  }

  // ------------------------------------------------------------------ الإرشادات (عند مرور المؤشر)
  let tipT = null, tipEl = null;
  function showTip(el) {
    const t = $('#tip'); const txt = el.getAttribute('data-tip'); if (!txt) return;
    t.textContent = txt; t.hidden = false;
    const r = el.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2; x = Math.max(6, Math.min(innerWidth - tw - 6, x));
    const up = r.top > th + 14;
    t.style.left = x + 'px'; t.style.top = (up ? r.top - th - 10 : r.bottom + 10) + 'px';
    t.className = 'tip ' + (up ? 'up' : 'down');
  }
  function hideTip() { clearTimeout(tipT); tipEl = null; $('#tip').hidden = true; }
  function bindTips() {
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (el === tipEl) return;
      hideTip(); if (!el) return;
      tipEl = el; tipT = setTimeout(() => showTip(el), 380);
    });
    document.addEventListener('focusin', (e) => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el && el.matches(':focus-visible')) showTip(el); });
    ['focusout', 'mousedown', 'scroll', 'keydown'].forEach((ev) => document.addEventListener(ev, hideTip, true));
  }

  // ------------------------------------------------------------------ البداية والمتسابقون
  function renderPlayersSetup() {
    const box = $('#playersBox'); box.textContent = '';
    const saved = store.get('players', null);
    const names = state.pmode === 'solo' ? [(saved && saved.solo) || ''] : ((saved && saved.teams) || ['المجموعة الأولى', 'المجموعة الثانية']);
    names.forEach((n, i) => {
      const row = h('div', { class: 'prow' });
      row.appendChild(h('input', { class: 'name-input', type: 'text', maxlength: 30, value: n, placeholder: state.pmode === 'solo' ? 'اسم المتسابق (اختياري)' : 'اسم المجموعة ' + (i + 1), 'aria-label': 'اسم المتسابق ' + (i + 1) }));
      if (state.pmode === 'teams' && names.length > 2) row.appendChild(h('button', { type: 'button', class: 'x', 'aria-label': 'حذف', onclick: () => { row.remove(); updateAdd(); } }, '✕'));
      box.appendChild(row);
    });
    updateAdd();
  }
  function updateAdd() { $('#btnAddPlayer').hidden = state.pmode !== 'teams' || $$('#playersBox .prow').length >= 6; }
  function startGame() {
    const names = $$('#playersBox .name-input').map((i, k) => i.value.trim() || (state.pmode === 'solo' ? 'المتسابق' : 'المجموعة ' + (k + 1)));
    const saved = store.get('players', {}) || {};
    if (state.pmode === 'solo') saved.solo = $$('#playersBox .name-input')[0].value.trim(); else saved.teams = names;
    store.set('players', saved);
    state.players = names.map((name) => ({ name, points: 0, ok: 0, answered: 0 }));
    state.turn = 0; state.asked = 0; state.q = null;
    AU.resume(); AU.setVoice(state.s.voice);          // تفعيل الصوت وتحميل أصوات الآلة بأول لمسة
    $('#splash').hidden = true; $('#app').hidden = false;
    // المجموعات جاءت للمسابقة → الإملاء. المتسابق الفرد → آخر نمط استعمله (أول مرة: التدوين والقراءة، وهو الأول في الترتيب)
    setMode(state.pmode === 'teams' ? 'dictation' : store.get('mode', 'free'));
    if (!store.get('coachSeen', false)) $('#coach').hidden = false;
  }

  // ------------------------------------------------------------------ الإعدادات
  function fillSettings() {
    const vs = $('#sVoice'); if (!vs.options.length) Object.keys(AU.VOICES).forEach((k) => vs.appendChild(h('option', { value: k }, esc(AU.VOICES[k].label))));
    vs.value = state.s.voice;
    $('#sBeats').value = state.s.beats; $('#sMeasures').value = state.s.measures; $('#sBpm').value = state.s.bpm;
    $('#sTimer').value = state.s.timer; $('#sPlays').value = state.s.plays; $('#sQuestions').value = state.s.questions;
    $('#sMetro').checked = state.s.metro; $('#sClap').checked = state.s.clap; $('#sNames').checked = state.s.names; $('#sEquiv').checked = state.s.equiv;
    document.body.classList.toggle('hide-names', !state.s.names);
    $('#clapper').hidden = !state.s.clap;
    const G = isGuide() && guideModel();
    $('#settingsSummary').textContent = '· ' + (G ? G.beats + '/4 · ' + G.measures.length + ' موازير' : state.s.beats + '/4 · ' + state.s.measures + (state.s.measures > 2 ? ' موازير' : state.s.measures === 2 ? ' مازورتان' : ' مازورة')) +
      ' · السرعة ' + state.s.bpm + ' · ' + AU.VOICES[state.s.voice].label.split(' (')[0];
  }
  function bindSettings() {
    $('#sBeats').addEventListener('change', (e) => { state.s.beats = +e.target.value; saveSettings(); afterLayoutChange(true); });
    $('#sMeasures').addEventListener('change', (e) => { state.s.measures = +e.target.value; saveSettings(); afterLayoutChange(false); });
    $('#sBpm').addEventListener('change', (e) => { const v = Math.max(40, Math.min(160, parseInt(e.target.value, 10) || 70)); state.s.bpm = v; e.target.value = v; saveSettings(); fillSettings(); });
    $('#sVoice').addEventListener('change', (e) => { state.s.voice = e.target.value; saveSettings(); AU.setVoice(state.s.voice); fillSettings(); preview(); });
    $('#btnPreview').addEventListener('click', preview);
    $('#sTimer').addEventListener('change', (e) => { state.s.timer = +e.target.value; saveSettings(); });
    $('#sPlays').addEventListener('change', (e) => { state.s.plays = +e.target.value; saveSettings(); renderActions(); });
    $('#sQuestions').addEventListener('change', (e) => { state.s.questions = +e.target.value; saveSettings(); renderScore(); renderActions(); });
    $('#sMetro').addEventListener('change', (e) => { state.s.metro = e.target.checked; saveSettings(); });
    $('#sClap').addEventListener('change', (e) => { state.s.clap = e.target.checked; saveSettings(); fillSettings(); });
    $('#sNames').addEventListener('change', (e) => { state.s.names = e.target.checked; saveSettings(); fillSettings(); });
    $('#sEquiv').addEventListener('change', (e) => { state.s.equiv = e.target.checked; saveSettings(); });
    $('#settingsWrap').addEventListener('toggle', () => store.set('settingsOpen', $('#settingsWrap').open));
  }
  // معاينة الصوت: نوار، تاتي، بلانش في 2/4 (ضربات + رول) — لا تمس السؤال أو الإجابة
  function preview() {
    if (active()) { toast('المعاينة غير متاحة أثناء السؤال.', 'err'); return; }
    playPattern([['q', 'ee'], ['h']], 2, { countIn: 0, noLight: true, preview: true });
  }
  function openCustom() {
    const grid = h('div', { class: 'chk-grid' });
    RD.FIGURES.forEach((f) => {
      const lab = h('label', null, '');
      lab.appendChild(h('input', { type: 'checkbox', value: f.id, checked: state.s.custom.includes(f.id) }));
      lab.appendChild(document.createTextNode(f.name + ' (' + RD.beatsText(f.ticks) + ')'));
      grid.appendChild(lab);
    });
    const wrap = h('div'); wrap.appendChild(h('p', { class: 'muted' }, 'اختر العلامات والأشكال التي درسها الطلبة. تتكون أسئلة الإملاء منها فقط (ويُضاف النوار تلقائيًا إن لم يمكن ملء الميزان بغيره).'));
    wrap.appendChild(grid);
    modal('اختر العلامات الإيقاعية للدرس', wrap, [
      { label: 'إلغاء' },
      { label: 'حفظ واعتماد 👍', cls: 'green', run: () => {
        const ids = $$('input', grid).filter((i) => i.checked).map((i) => i.value);
        if (!ids.length) { toast('اختر علامة واحدة على الأقل.', 'err'); return false; }
        state.s.custom = ids; state.s.level = 'custom'; saveSettings(); afterLayoutChange(true); return true;
      } },
    ]);
  }
  function afterLayoutChange(clear) {
    if (active()) return;
    if (state.mode === 'dictation' && state.q) { state.q = null; hideResult(); }
    const n = curMeasures();
    state.answer = clear ? Array.from({ length: n }, () => []) : Array.from({ length: n }, (_, i) => state.answer[i] || []);
    state.target = 0; state.sel = null; state.hist = []; state.freeMarks = null;
    renderAll();
  }

  // ------------------------------------------------------------------ المستويات (شجرة بارزة أعلى التمرين)
  function selectLevel(id) {
    if (active()) { toast('أنهِ السؤال الحالي أولًا.', 'err'); return; }
    if (id === 'custom') { openCustom(); return; }
    state.s.level = id;
    const L = level();
    if (L.meters && !L.meters.includes(+state.s.beats)) state.s.beats = L.meters[0];
    if (L.bpm) state.s.bpm = L.bpm;
    saveSettings(); afterLayoutChange(true);
  }
  function selectModel(id) {
    if (active()) { toast('أنهِ السؤال الحالي أولًا.', 'err'); return; }
    state.s.guideId = id; const M = guideModel(); state.s.bpm = M.bpm; saveSettings(); afterLayoutChange(true);
  }
  function setSrc(src) {
    if (active()) { toast('أنهِ السؤال الحالي أولًا.', 'err'); return; }
    state.s.src = src; if (src === 'guide') { const M = guideModel(); state.s.guideId = M.id; state.s.bpm = M.bpm; }
    else { const L = level(); if (L.bpm) state.s.bpm = L.bpm; }
    saveSettings(); afterLayoutChange(true);
  }
  function renderLevels() {
    document.body.classList.toggle('src-guide', isGuide());
    $$('.src-btn').forEach((b) => { const on = b.dataset.src === (isGuide() ? 'guide' : 'levels'); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); b.disabled = !!active(); });
    $('#srcGuide').hidden = !CT.MODELS.length;
    const tree = $('#levelTree'); tree.textContent = '';
    const lock = !!active();
    if (isGuide()) {
      $('#levelsTitle').textContent = 'اختر النموذج';
      const M0 = guideModel();
      CT.MODELS.forEach((M, i) => {
        const b = h('button', { type: 'button', class: 'lnode' + (M.id === M0.id ? ' on' : '') + (i === CT.MODELS.length - 1 ? ' last' : ''), role: 'radio', 'aria-checked': String(M.id === M0.id), 'data-model': M.id, disabled: lock,
          'data-tip': M.title + ' — ص ' + M.page }, '<span class="dot">📘</span><span class="ln-name">' + esc(M.model) + '</span><span class="ln-grade">ص ' + M.page + '</span>');
        b.addEventListener('click', () => selectModel(M.id));
        tree.appendChild(b);
      });
    } else {
      $('#levelsTitle').textContent = 'اختر المستوى';
      const cur = state.s.level, idx = CT.LEVELS.findIndex((l) => l.id === cur);
      CT.LEVELS.forEach((L, i) => {
        const b = h('button', { type: 'button', class: 'lnode' + (L.id === cur ? ' on' : '') + (idx > i ? ' done' : '') + (i === CT.LEVELS.length - 1 ? ' last' : ''), role: 'radio', 'aria-checked': String(L.id === cur),
          'data-level': L.id, disabled: lock, 'data-tip': L.label + ' · ' + L.grade },
          '<span class="dot">' + L.n + '</span><span class="ln-name">' + esc(L.short) + '</span><span class="ln-grade">' + esc(L.grade) + '</span>');
        b.addEventListener('click', () => selectLevel(L.id));
        tree.appendChild(b);
      });
      [LEVEL_ALL, LEVEL_CUSTOM].forEach((L) => {
        const b = h('button', { type: 'button', class: 'lnode extra' + (L.id === cur ? ' on' : ''), role: 'radio', 'aria-checked': String(L.id === cur), 'data-level': L.id, disabled: lock,
          'data-tip': L.id === 'custom' ? 'المعلم يختار العلامات التي درسها الطلبة' : 'كل العلامات والأشكال في المستويات الثمانية' },
          '<span class="dot">' + L.n + '</span><span class="ln-name">' + esc(L.short) + '</span><span class="ln-grade">' + esc(L.grade) + '</span>');
        b.addEventListener('click', () => selectLevel(L.id));
        tree.appendChild(b);
      });
    }
    renderLevelInfo();
  }
  function chips(ids) {
    return '<span class="li-new">' + ids.map((id) => '<span class="chip">' + GL.glyph(id).svg + esc(RD.FIG[id].name) + '</span>').join('') + '</span>';
  }
  function renderLevelInfo() {
    const box = $('#levelInfo');
    const doFree = 'كوّن تمرينًا من العلامات بالأسفل ثم «تحقق من التدوين» و«استمع لما دوّنته»، أو اضغط «تمرين قراءة» لتقرأه بطريقة إيمي باري.';
    const doDict = 'اضغط «ابدأ السؤال»: تُسمع مازورة عدّ ثم النمط. استمع ودوّن ما سمعته في الموازير، ثم «سلّم الإجابة».';
    if (isGuide()) {
      const M = guideModel();
      box.innerHTML = '<div class="li-head">📘 ' + esc(M.title) + '</div>' +
        '<div>نماذج إيقاعية جاهزة من دليل المعلم: يُسمع النموذج كما ورد في الدليل (مع نبض النوار)، ويدوّنه الطالب إملاءً، وتُحتسب النقاط كأي سؤال في المسابقة.</div>' +
        '<div class="quote"><b>نص النشاط في الدليل:</b> «' + esc(M.task) + '»</div>' +
        '<div class="li-do">تكييف MusiTeacher: ' + esc(M.adapt) + '</div>' +
        '<div class="cite">المصدر: ' + esc(CT.citation(M)) + ' · الميزان ' + M.beats + '/4 · السرعة المقترحة ' + M.bpm + '</div>';
      return;
    }
    const L = level();
    let head = '📍 ' + (L.id === 'all' || L.id === 'custom' ? esc(L.label) : 'المستوى ' + L.n + ': ' + esc(L.short)) + (L.grade ? ' — ' + esc(L.grade) : '');
    let body = '';
    if (L.lesson) body += '<div>من درس: «' + esc(L.lesson) + '»</div>';
    if (L.focus && L.focus.length) body += '<div>الجديد في هذا المستوى: ' + chips(L.focus) + '</div>';
    if (L.id === 'custom') body += '<div>العلامات المختارة: ' + chips(state.s.custom) + ' <button type="button" class="btn small ghost" id="btnEditCustom" data-tip="تعديل العلامات المختارة">تعديل الاختيار</button></div>';
    body += '<div>عدد العلامات والأشكال المتاحة: ' + paletteIds().length + '</div>';
    body += '<div class="li-do">' + (state.mode === 'free' ? doFree : doDict) + '</div>';
    box.innerHTML = '<div class="li-head">' + head + '</div>' + body;
    const ec = $('#btnEditCustom'); if (ec) ec.addEventListener('click', openCustom);
  }

  // ------------------------------------------------------------------ الأنماط
  function setMode(mode) {
    if (active() && mode !== 'dictation') { toast('أنهِ السؤال الحالي (سلّم الإجابة) قبل تغيير النمط.', 'err'); return; }
    stopPlayback();
    state.mode = mode; store.set('mode', mode);
    document.body.classList.remove('mode-dictation', 'mode-free');
    document.body.classList.add('mode-' + mode);
    $$('.tab').forEach((t) => { const on = t.dataset.mode === mode; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
    if (!(mode === 'dictation' && state.q && state.q.phase === 'graded')) hideResult();
    if (!(mode === 'dictation' && state.q)) state.answer = Array.from({ length: curMeasures() }, () => []);
    state.target = 0; state.sel = null; state.hist = []; state.freeMarks = null;
    renderHelp(false);
    renderAll();
  }

  // ------------------------------------------------------------------ الرسم
  function renderAll() {
    const locked = !!active();
    $('#levelsCard').classList.toggle('locked', locked);
    $$('#settings select, #settings input, #settings button').forEach((el) => { el.disabled = locked; });
    $$('.tab').forEach((t) => { t.disabled = locked && t.dataset.mode !== 'dictation'; });
    fillSettings(); renderLevels(); renderScore(); renderActions(); renderPalette(); renderStaff();
  }
  function renderScore() {
    const box = $('#players'); box.textContent = '';
    state.players.forEach((p, i) => box.appendChild(h('div', { class: 'pchip' + (i === state.turn && state.asked < state.s.questions ? ' turn' : '') },
      esc(p.name) + ' <b>' + p.points + '</b> <small>نقطة · ✅ ' + p.ok + '</small>')));
    let info = '';
    if (state.mode === 'dictation') {
      const n = state.s.questions, q = state.q;
      const turn = state.players.length > 1 && state.asked < n ? ' · الدور: ' + esc(state.players[state.turn].name) : '';
      if (q && q.phase !== 'graded') info = 'السؤال ' + (state.asked + 1) + ' من ' + n + turn;
      else if (state.asked >= n) info = 'انتهت الجولة (' + n + ' أسئلة)';
      else if (state.asked) info = 'أُجيب ' + state.asked + ' من ' + n + turn;
      else info = 'الجولة: ' + n + ' أسئلة' + turn;
    } else info = 'تدوين وقراءة حرة — لا تُحتسب نقاط';
    $('#qinfo').innerHTML = info;
    if (state.mode !== 'dictation') $('#timer').hidden = true;
  }

  function renderActions() {
    const box = $('#actions'); box.textContent = '';
    const add = (label, cls, fn, opts) => { const b = h('button', Object.assign({ type: 'button', class: 'btn ' + (cls || ''), onclick: fn }, opts || {}), label); box.appendChild(b); return b; };
    const stopBtn = () => add('⏹ إيقاف', 'ghost', () => { stopPlayback(); onPlayEnd(); }, { disabled: !state.playing, id: 'btnStop', 'data-tip': 'إيقاف الصوت فورًا' });
    if (state.mode === 'dictation') {
      const q = state.q;
      if (!q || q.phase === 'graded') {
        if (state.asked >= state.s.questions) {
          add('🏆 النتائج النهائية', 'primary', showFinal, { 'data-tip': 'عرض ترتيب المتسابقين والفائز' });
          add('🔄 جولة جديدة', 'ghost', newRound, { 'data-tip': 'تصفير النقاط وبدء جولة جديدة بالمتسابقين أنفسهم' });
        } else {
          add(q ? '⏭ السؤال التالي' : '▶ ابدأ السؤال', 'primary', startQuestion, { id: 'btnStartQ', 'data-tip': 'تشغيل نمط إيقاعي جديد بعد مازورة عدّ، ثم دوّنه' });
          if (!q) box.appendChild(h('span', { class: 'hint' }, 'يبدأ الوقت (إن ضُبط) بعد انتهاء الاستماع الأول.'));
        }
      } else {
        const limit = state.s.plays, left = limit ? limit - q.plays : Infinity;
        add('🔁 أعد الاستماع' + (limit ? ' (' + Math.max(0, left) + ')' : ''), 'teal', replay, { id: 'btnReplay', disabled: q.phase === 'listening' || left <= 0, 'data-tip': 'إعادة تشغيل النمط نفسه من البداية (لا يتغير السؤال)' });
        if (q.model && q.model.byMeasure) q.model.measures.forEach((m, i) => add('المازورة ' + (i + 1), 'ghost small', () => playPattern([m], q.beats, { offset: i, voice: q.voice }),
          { disabled: q.phase === 'listening', 'data-tip': 'استمع للمازورة ' + (i + 1) + ' وحدها (كما يطلب الدليل)' }));
        stopBtn();
        box.appendChild(h('span', { class: 'spacer' }));
        add('✔ سلّم الإجابة', 'green', () => submit(false), { id: 'btnSubmit', 'data-tip': 'اعتماد الإجابة والانتقال إلى النتيجة (مرة واحدة)' });
      }
    } else {
      add('🔊 استمع لما دوّنته', 'teal', () => playPattern(state.answer, curBeats(), { highlight: true }), { id: 'btnPlayMine', 'data-tip': 'تشغيل النمط الذي دوّنته، مع إضاءة كل علامة لحظة سماعها' });
      add('✅ تحقق من التدوين', 'green', checkFree, { 'data-tip': 'التحقق من أن مجموع كل مازورة يساوي الميزان' });
      add('🎲 تمرين قراءة', 'violet', readingExercise, { 'data-tip': 'ملء الموازير بنمط من المستوى لتقرأه بطريقة إيمي باري وتصفقه' });
      stopBtn();
    }
  }

  function renderPalette() {
    const box = $('#palette'); box.textContent = '';
    const L = level(), focus = isGuide() ? [] : (L.focus || []);
    paletteIds().forEach((id) => {
      const f = RD.FIG[id], g = GL.glyph(id);
      const b = h('button', { type: 'button', class: 'pcard' + (f.kind === 'rest' ? ' rest' : '') + (focus.includes(id) ? ' focus' : ''), draggable: 'true', 'data-id': id,
        'aria-label': f.name + '، قيمته ' + RD.beatsText(f.ticks) + ' زمن',
        'data-tip': f.name + ' (' + RD.beatsText(f.ticks) + ' زمن): اضغط لإضافته إلى المازورة المحددة، أو اسحبه إليها' + (f.aka ? ' · يُكتب أيضًا: ' + f.aka.join('، ') : '') });
      b.innerHTML = g.svg + '<span class="pname">' + esc(f.name) + '</span>' + (f.syl && f.syl !== f.name ? '<span class="psyl">' + esc(f.syl) + '</span>' : '') +
        '<span class="pval">' + RD.beatsText(f.ticks) + ' زمن</span>';
      b.addEventListener('click', () => (state.sel ? replaceSelected(id) : addFigure(id)));
      // stopPropagation: طبقة الحماية تمنع السحب على مستوى النافذة (ردعًا لنسخ الصور)، وسحب العلامات هنا وظيفة تعليمية
      b.addEventListener('dragstart', (e) => { e.stopPropagation(); hideTip(); e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'copy'; });
      box.appendChild(b);
    });
  }

  function itemHTML(id, sel) {
    const f = RD.FIG[id];
    return '<div class="item' + (sel ? ' sel' : '') + '" data-id="' + id + '" data-tip="اضغط لتحديده، ثم اختر شكلًا لاستبداله أو احذفه">' + GL.glyph(id).svg +
      '<span class="lbl">' + esc(f.name) + '</span>' + (f.syl && f.syl !== f.name ? '<span class="syl">' + esc(f.syl) + '</span>' : '<span class="syl">&nbsp;</span>') + '</div>';
  }
  function measuresInto(container, measures, beats, opts) {
    opts = opts || {};
    container.textContent = '';
    container.appendChild(h('div', { class: 'tsig', 'aria-label': 'الميزان ' + beats + ' على 4' }, '<span>' + beats + '</span><span>4</span>'));
    const wrap = h('div', { class: 'measures' + (opts.edit ? ' editable' : '') });
    const cap = beats * RD.TPB;
    measures.forEach((m, i) => {
      const cls = ['measure'];
      if (opts.edit && i === state.target) cls.push('target');
      const r = opts.marks && opts.marks[i];
      if (r) cls.push(r.ok ? (r.status === 'equivalent' ? 'eq' : 'ok') : 'bad');
      if (opts.changed && opts.changed[i]) cls.push('changed');
      const el = h('div', { class: cls.join(' '), 'data-m': i });
      const items = h('div', { class: 'items' });
      if (!m.length) items.innerHTML = '<span class="empty-hint">' + (opts.edit ? 'اضغط علامة لإضافتها هنا، أو اسحبها' : '—') + '</span>';
      else items.innerHTML = m.map((id, k) => itemHTML(id, opts.edit && state.sel && state.sel.m === i && state.sel.k === k)).join('');
      el.appendChild(items);
      el.appendChild(h('div', { class: 'mlight', 'aria-hidden': 'true' }, '<i></i>'));
      const used = RD.seqTicks(m);
      const leftCls = used === cap ? 'full' : used > cap ? 'over' : '';
      const leftTxt = used === cap ? 'مكتملة ✓' : used > cap ? 'زائدة ' + RD.beatsText(used - cap) : 'متبقٍ ' + RD.beatsText(cap - used);
      el.appendChild(h('div', { class: 'mfoot' }, '<span class="num">م' + (i + 1) + '</span>' + (opts.edit ? '<span class="left ' + leftCls + '">' + leftTxt + '</span>' : '')));
      if (r) el.appendChild(h('span', { class: 'badge ' + (r.ok ? (r.status === 'equivalent' ? 'eq' : 'ok') : 'bad') }, r.ok ? (r.status === 'equivalent' ? '✓ مكافئ' : '✓ صحيح') : '✗'));
      if (opts.edit) {
        el.addEventListener('click', (e) => {
          const it = e.target.closest('.item');
          if (it && editable()) { selectItem(i, $$('.item', items).indexOf(it)); return; }
          state.target = i; state.sel = null; renderStaff();
        });
        el.addEventListener('dragover', (e) => { if (!editable()) return; e.preventDefault(); el.classList.add('over'); });
        el.addEventListener('dragleave', () => el.classList.remove('over'));
        el.addEventListener('drop', (e) => {
          e.preventDefault(); el.classList.remove('over');
          const id = e.dataTransfer.getData('text/plain'); if (!RD.FIG[id]) return;
          const it = e.target.closest('.item');
          addFigure(id, i, it ? $$('.item', items).indexOf(it) : null);   // الإفلات على علامة = إدراج قبلها
        });
      }
      wrap.appendChild(el);
    });
    container.appendChild(wrap);
  }
  function renderStaff() {
    const n = curMeasures();
    while (state.answer.length < n) state.answer.push([]);
    if (state.answer.length > n) state.answer.length = n;
    const marks = state.mode === 'dictation' ? state.q && state.q.result && state.q.result.measures : state.freeMarks;
    const ed = editable();
    measuresInto($('#staff'), state.answer, curBeats(), { edit: ed, marks });
    $('#staffTitle').textContent = state.mode === 'free' ? 'تدوينك' : 'إجابتك';
    $('#btnUndo').disabled = !ed || !state.hist.length;
    $('#btnClear').disabled = !ed || state.answer.every((m) => !m.length);
    $('#btnDelSel').disabled = !ed || !state.sel;
    renderBeatline();
  }

  // ------------------------------------------------------------------ التدوين والتعديل
  const snap = () => { state.hist.push(JSON.stringify(state.answer)); if (state.hist.length > 80) state.hist.shift(); };
  const room = (k) => curBeats() * RD.TPB - RD.seqTicks(state.answer[k]);
  function cantEdit() {
    toast(state.mode === 'dictation' ? (state.q ? 'انتهى هذا السؤال. اضغط «السؤال التالي».' : 'اضغط «ابدأ السؤال» أولًا.') : 'لا يمكن التعديل الآن.', 'err');
  }
  /** mIndex: مازورة الإفلات (لا تنتقل العلامة إلى غيرها) · at: موضع الإدراج داخلها */
  function addFigure(id, mIndex, at) {
    if (!editable()) { cantEdit(); return; }
    const f = RD.FIG[id];
    let i = mIndex != null ? mIndex : state.target;
    if (room(i) < f.ticks) {
      if (mIndex != null) { toast('لا تتسع المازورة (' + (i + 1) + ') لـ«' + f.name + '». المتبقي: ' + RD.beatsText(Math.max(0, room(i))) + ' زمن.', 'err'); return; }
      let k = i + 1; while (k < state.answer.length && room(k) < f.ticks) k++;
      if (k >= state.answer.length) { toast('لا تتسع المازورة (' + (i + 1) + ') لـ«' + f.name + '». المتبقي: ' + RD.beatsText(Math.max(0, room(i))) + ' زمن. احذف علامة أو اختر مازورة أخرى.', 'err'); return; }
      i = k;
    }
    snap();
    if (at != null && at >= 0) state.answer[i].splice(at, 0, id); else state.answer[i].push(id);
    state.freeMarks = null; state.sel = null;
    if (room(i) === 0) { let k = i + 1; while (k < state.answer.length && room(k) === 0) k++; state.target = k < state.answer.length ? k : i; }
    else state.target = i;
    renderStaff();
  }
  function selectItem(m, k) {
    if (state.sel && state.sel.m === m && state.sel.k === k) state.sel = null; else state.sel = { m, k };
    state.target = m; renderStaff();
    if (state.sel) toast('تم تحديد «' + RD.FIG[state.answer[m][k]].name + '»: اختر شكلًا لاستبداله، أو «حذف المحدد».');
  }
  function replaceSelected(id) {
    if (!editable()) { cantEdit(); return; }
    const { m, k } = state.sel, old = RD.FIG[state.answer[m][k]], f = RD.FIG[id];
    if (room(m) + old.ticks < f.ticks) { toast('لا يتسع مكان «' + old.name + '» لـ«' + f.name + '» في المازورة (' + (m + 1) + ').', 'err'); return; }
    snap(); state.answer[m][k] = id; state.sel = null; state.freeMarks = null; renderStaff();
  }
  function deleteSelected() {
    if (!editable() || !state.sel) return;
    snap(); state.answer[state.sel.m].splice(state.sel.k, 1); state.target = state.sel.m; state.sel = null; state.freeMarks = null; renderStaff();
  }
  function undo() {
    if (!editable() || !state.hist.length) return;
    state.answer = JSON.parse(state.hist.pop()); state.sel = null; state.freeMarks = null; renderStaff();
  }
  function clearAll() {
    if (!editable()) return;
    snap(); state.answer = state.answer.map(() => []); state.target = 0; state.sel = null; state.freeMarks = null;
    if (state.mode === 'free') $('#feedback').hidden = true;
    renderStaff();
  }

  // ------------------------------------------------------------------ الصوت والضوء المتحرك ومساعد التصفيق
  let raf = 0, play = null;   // play: { sch, t0, container, offset, beats }
  function renderBeatline(cur, count) {
    const bl = $('#beatline'); const b = curBeats();
    let html = '';
    for (let i = 0; i < b; i++) html += '<i class="' + (i === 0 ? 'strong' : '') + (cur === i ? ' on' : '') + '"></i>';
    if (count) html += '<span class="cnt">عدّ تمهيدي</span>';
    bl.innerHTML = html;
  }
  function clearLights() {
    $$('.mlight i').forEach((x) => { x.style.width = '0'; });
    $$('.measure.playing').forEach((x) => x.classList.remove('playing'));
  }
  // يُحسب الموضع من ساعة الصوت نفسها (لا من مؤقت منفصل)، فيتطابق الضوء مع ما يُسمع، ويتقدم من اليسار إلى اليمين
  function lightLoop() {
    if (!play) return;
    const { sch, t0, container, offset, beats } = play;
    const el = AU.now() - t0;
    const mTicks = beats * RD.TPB;
    clearLights();
    if (el < sch.lead) {
      renderBeatline(Math.floor(el / (sch.secPerTick * RD.TPB)) % beats, true);
    } else {
      const ticks = (el - sch.lead) / sch.secPerTick;
      const m = Math.floor(ticks / mTicks);
      const ms = $$(container + ' .measure');
      const mEl = ms[m + (offset || 0)];
      if (mEl && ticks < (sch.total - sch.lead) / sch.secPerTick) {
        mEl.classList.add('playing');
        $('.mlight i', mEl).style.width = Math.min(100, ((ticks - m * mTicks) / mTicks) * 100) + '%';
        renderBeatline(Math.floor((ticks - m * mTicks) / RD.TPB));
      }
    }
    raf = requestAnimationFrame(lightLoop);
  }
  function stopLights() { cancelAnimationFrame(raf); play = null; clearLights(); renderBeatline(); }
  function clapHit(strong) {
    if (!state.s.clap) return;
    const c = $('#clapper');
    c.classList.remove('hit', 'strong'); void c.offsetWidth;
    c.classList.add('hit'); if (strong) c.classList.add('strong');
    $('#clapLabel').textContent = strong ? 'قوية' : 'ضعيفة';
    clearTimeout(clapHit.t); clapHit.t = setTimeout(() => { c.classList.remove('hit', 'strong'); }, 110);
  }
  function stopPlayback() {
    AU.stopAll(); state.playing = false; stopLights();
    $$('.item.now').forEach((x) => x.classList.remove('now'));
    const c = $('#clapper'); c.classList.remove('hit', 'strong'); $('#clapLabel').textContent = 'مساعد التصفيق';
  }
  function onPlayEnd() {
    state.playing = false; stopLights();
    $$('.item.now').forEach((x) => x.classList.remove('now'));
    $('#clapper').classList.remove('hit', 'strong'); $('#clapLabel').textContent = 'مساعد التصفيق';
    if (state.mode === 'dictation' && state.q && state.q.phase === 'listening') { state.q.phase = 'answering'; startTimer(); }
    renderActions();
  }
  /** opts: { highlight, offset (رقم المازورة عند تشغيل مازورة واحدة), countIn, noLight, voice, lightIn, preview } */
  async function playPattern(measures, beats, opts) {
    opts = opts || {};
    if (!measures.some((m) => m.length)) { toast('لا يوجد ما يُسمَع بعد. أضف علامات إلى الموازير.', 'err'); return; }
    const metro = isGuide() || (state.q && state.q.model) ? true : state.s.metro;
    if (opts.voice) AU.setVoice(opts.voice);
    const sch = RD.buildSchedule(measures, beats, opts.bpm || curBpm(), { countIn: opts.countIn == null ? 1 : opts.countIn, metronome: opts.preview ? false : metro });
    stopLights();
    state.playing = true; renderActions();
    const res = AU.play(sch, {
      start: (t0) => { if (!opts.noLight) { play = { sch, t0, container: opts.lightIn || '#staff', offset: opts.offset || 0, beats }; raf = requestAnimationFrame(lightLoop); } },
      event: (ev) => {
        if (ev.type !== 'note') return;
        clapHit(ev.strong);
        if (opts.highlight) {
          $$('.item.now').forEach((x) => x.classList.remove('now'));
          const mEl = $$('#staff .measure')[ev.m + (opts.offset || 0)];
          const it = mEl && $$('.item', mEl)[ev.i];
          if (it) it.classList.add('now');
        }
      },
    });
    const r = await res;
    if (r && (r.noAudio || r.failed)) { toast(r.failed ? 'تعذّر تحميل أصوات الآلة. تحقّق من الاتصال ثم أعد المحاولة.' : 'المتصفح لا يدعم تشغيل الصوت هنا.', 'err'); onPlayEnd(); }
    else if (r && !r.stopped) onPlayEnd();
    if (opts.voice && opts.voice !== state.s.voice) AU.setVoice(state.s.voice);
    return r;
  }

  // ------------------------------------------------------------------ الإملاء (المسابقة)
  let timerT = null;
  function startTimer() {
    stopTimer();
    const q = state.q;
    if (!q || !state.s.timer || q.timerStarted) return;
    q.timerStarted = true; q.timerLeft = state.s.timer;
    $('#timer').hidden = false; showTimer();
    timerT = setInterval(() => {
      if (!state.q || state.q !== q || q.phase === 'graded') { stopTimer(); return; }
      q.timerLeft--; showTimer();
      if (q.timerLeft <= 0) { stopTimer(); submit(true); }
    }, 1000);
  }
  function showTimer() { const q = state.q; $('#timerVal').textContent = q ? Math.max(0, q.timerLeft) : 0; $('#timer').classList.toggle('warn', !!q && q.timerLeft <= 10); }
  function stopTimer() { clearInterval(timerT); timerT = null; }

  function startQuestion() {
    if (active()) return;
    let pattern, beats, model = null;
    if (isGuide()) { model = guideModel(); pattern = model.measures.map((m) => m.slice()); beats = model.beats; }
    else {
      const L = level();
      if (!L.allowed || !L.allowed.length) { openCustom(); return; }
      beats = +state.s.beats;
      pattern = RD.generate({ allowed: L.allowed, focus: L.focus, beats, measures: +state.s.measures });
    }
    // صوت الآلة يُثبَّت للسؤال كله (الإعدادات مقفلة حتى التسليم)
    state.q = { pattern, beats, model, phase: 'listening', plays: 1, result: null, timerLeft: state.s.timer, timerStarted: false, voice: state.s.voice };
    state.answer = pattern.map(() => []); state.target = 0; state.sel = null; state.hist = [];
    $('#timer').hidden = !state.s.timer; showTimer();
    hideResult(); renderAll();
    playPattern(pattern, beats, { voice: state.q.voice });
  }
  function replay() {
    const q = state.q; if (!q || q.phase !== 'answering') return;
    if (state.s.plays && q.plays >= state.s.plays) { toast('انتهت مرات الاستماع المسموح بها لهذا السؤال.', 'err'); return; }
    q.plays++;
    playPattern(q.pattern, q.beats, { voice: q.voice });   // النمط نفسه تمامًا: الإعادة لا تغيّر السؤال
    renderActions();
  }
  function submit(byTimeout) {
    const q = state.q;
    if (!q || q.phase === 'graded') return;            // تسليم واحد فقط لكل سؤال
    stopPlayback(); stopTimer();
    q.phase = 'graded'; state.sel = null;
    q.result = RD.gradeAnswer(state.answer, q.pattern, q.beats, { acceptEquivalent: state.s.equiv, rollTicks: AU.rollTicksFor(q.voice) });
    const P = state.players[state.turn];
    P.points += q.result.points; P.answered++; if (q.result.all) P.ok++;
    state.asked++;
    state.turn = (state.turn + 1) % state.players.length;    // الدور ينتقل فور التسليم إلى المتسابق التالي
    let changed = null, B = null;
    if (q.model && q.model.compareWith) {
      B = CT.MODELS.find((x) => x.id === q.model.compareWith);
      changed = q.model.measures.map((m, i) => !RD.sameRhythm(m, B.measures[i]));
    }
    showResult(q.result, { byTimeout, who: state.players.length > 1 ? P.name : '', pattern: q.pattern, beats: q.beats, voice: q.voice,
      solutionTitle: q.model ? 'النموذج كما في الدليل' + (changed ? ' — الموازير المميزة بالبنفسجي تغيّرت عن ' + B.model : '') : null, changed });
    if (B) { $('#compareWrap').hidden = false; $('#compareTitle').textContent = 'للمقارنة: ' + B.model; measuresInto($('#compare'), B.measures, B.beats, { changed }); }
    if (q.result.all) celebrate();
    renderAll();
    if (state.asked >= state.s.questions) setTimeout(showFinal, 900);
  }

  /** الفائز من النتيجة الفعلية: { kind: 'winner'|'tie'|'none'|'solo', top, names } — لا يُختار فائز عشوائيًا عند التعادل */
  function winnerOf(players) {
    const top = Math.max(...players.map((p) => p.points));
    const best = players.filter((p) => p.points === top);
    if (players.length === 1) return { kind: 'solo', top, names: [players[0].name] };
    if (top <= 0) return { kind: 'none', top, names: [] };
    return { kind: best.length === 1 ? 'winner' : 'tie', top, names: best.map((p) => p.name) };
  }
  function showFinal() {
    if (state.asked < state.s.questions) return;         // لا إعلان قبل حسم الجولة
    const W = winnerOf(state.players);
    const maxPts = state.s.questions * ((isGuide() ? guideModel().measures.length : state.s.measures) * 10 + 10);
    const ranked = state.players.map((p) => Object.assign({}, p)).sort((a, b) => b.points - a.points);
    const wrap = h('div');
    const win = h('div', { class: 'win' });
    if (W.kind === 'winner') win.innerHTML = '<div class="trophy">🏆</div><div class="wname">' + esc(W.names[0]) + '</div><div class="wmsg">مبارك الفوز بالجولة! ' + W.top + ' نقطة 🎉</div>';
    else if (W.kind === 'tie') win.innerHTML = '<div class="trophy">🤝</div><div class="wname">تعادل!</div><div class="wmsg">' + W.names.map(esc).join(' و ') + ' — ' + W.top + ' نقطة لكلٍّ منهم. أداء رائع!</div>';
    else if (W.kind === 'solo') {
      const good = W.top >= maxPts / 2;
      win.innerHTML = '<div class="trophy">' + (good ? '🌟' : '💪') + '</div><div class="wname">' + esc(W.names[0]) + '</div><div class="wmsg">' + (good ? 'أحسنت! ' : 'واصل التدريب، ستتحسن! ') + W.top + ' نقطة من ' + maxPts + '</div>';
    } else win.innerHTML = '<div class="trophy">🎧</div><div class="wmsg">لم يحصل أحد على نقاط في هذه الجولة. جرّبوا مستوى أسهل أو سرعة أبطأ.</div>';
    wrap.appendChild(win);
    if (state.players.length > 1) {
      const t = h('table', { class: 'rank' });
      t.innerHTML = '<tr><th>الترتيب</th><th>المتسابق</th><th>النقاط</th><th>إجابات كاملة</th><th>أسئلة</th></tr>' +
        ranked.map((p, k) => '<tr class="' + (p.points === W.top && W.top > 0 ? 'first' : '') + '"><td>' + (k + 1) + (p.points === W.top && W.top > 0 ? ' 🏆' : '') + '</td><td>' + esc(p.name) + '</td><td>' + p.points + '</td><td>' + p.ok + '</td><td>' + p.answered + '</td></tr>').join('');
      wrap.appendChild(t);
    }
    wrap.appendChild(h('p', { class: 'muted' }, 'النقاط: 10 لكل مازورة صحيحة، و10 مكافأة عند صحة النمط كاملًا.'));
    modal(W.kind === 'tie' ? '🤝 نتيجة الجولة: تعادل' : '🏆 نتيجة الجولة', wrap, [{ label: 'متابعة' }, { label: '🔄 جولة جديدة', cls: 'primary', run: newRound }, { label: '👥 تغيير المتسابقين', run: backToSplash }]);
    const big = W.kind === 'winner' || (W.kind === 'solo' && W.top >= maxPts / 2);
    if (big || W.kind === 'tie') { fireworks(big ? 'big' : 'small'); AU.fanfare(big ? 'big' : 'small'); }
  }
  function newRound() {
    state.players.forEach((p) => { p.points = 0; p.ok = 0; p.answered = 0; });
    state.turn = 0; state.asked = 0; state.q = null; stopTimer(); $('#timer').hidden = true;
    state.answer = Array.from({ length: curMeasures() }, () => []); state.hist = []; state.sel = null;
    hideResult(); renderAll();
  }
  function backToSplash() {
    stopPlayback(); stopTimer(); state.q = null; hideResult();
    $('#app').hidden = true; $('#splash').hidden = false; renderPlayersSetup();
  }

  // ------------------------------------------------------------------ عرض النتيجة
  function hideResult() { $('#feedback').hidden = true; $('#solutionWrap').hidden = true; $('#compareWrap').hidden = true; }
  function showResult(r, o) {
    const fb = $('#feedback');
    const st = Math.round((r.okCount / r.total) * 3);
    let head;
    if (r.all) head = r.measures.some((m) => m.status === 'equivalent') ? 'إجابة صحيحة إيقاعيًا 🌟' : 'إجابة صحيحة تمامًا! 🌟';
    else if (r.okCount) head = 'إجابة صحيحة جزئيًا';
    else head = 'الإجابة غير صحيحة';
    let html = '<h3>' + (o.byTimeout ? '⏰ انتهى الوقت — ' : '') + head + '</h3>' +
      '<div class="stars" aria-label="' + r.okCount + ' من ' + r.total + '">' + '★'.repeat(st) + '☆'.repeat(3 - st) + '</div>' +
      '<div class="pts">' + (o.who ? esc(o.who) + ': ' : '') + '+' + r.points + ' نقطة (من ' + r.maxPoints + ') · موازير صحيحة: ' + r.okCount + ' من ' + r.total + '</div>';
    const notes = [];
    r.measures.forEach((m, i) => m.issues.forEach((x) => notes.push('المازورة (' + (i + 1) + '): ' + x.text)));
    if (notes.length) html += '<ul>' + notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>';
    fb.innerHTML = html; fb.className = 'feedback ' + (r.all ? 'good' : r.okCount ? 'mid' : 'bad'); fb.hidden = false;
    $('#solutionWrap').hidden = false;
    $('#solutionTitle').textContent = o.solutionTitle || 'النمط الذي سُمِع (الحل)';
    measuresInto($('#solution'), o.pattern, o.beats, { changed: o.changed });
    $('#btnPlaySolution').onclick = () => playPattern(o.pattern, o.beats, { voice: o.voice, lightIn: '#solution' });
  }

  // ------------------------------------------------------------------ التدوين والقراءة الحرة
  function checkFree() {
    const beats = curBeats();
    const res = RD.checkComposition(state.answer, beats);
    state.freeMarks = res.map((x) => ({ ok: x.ok, status: x.ok ? 'exact' : 'wrong' }));
    renderStaff();
    const fb = $('#feedback');
    const bad = res.filter((x) => !x.ok);
    if (!bad.length) {
      fb.className = 'feedback good';
      fb.innerHTML = '<h3>تدوين سليم ✅</h3>كل مازورة تساوي ' + beats + ' أزمنة. الآن اقرأ التمرين بطريقة إيمي باري مع التصفيق، ثم اضغط «استمع لما دوّنته» للتحقق من أدائك.';
    } else {
      fb.className = 'feedback bad';
      fb.innerHTML = '<h3>راجع الموازير</h3><ul>' + bad.map((x) => '<li>' + esc(x.text) + '</li>').join('') + '</ul>';
    }
    fb.hidden = false;
  }
  function readingExercise() {
    const L = level(); snap();
    state.answer = RD.generate({ allowed: L.allowed, focus: L.focus, beats: curBeats(), measures: curMeasures() });
    state.freeMarks = null; state.target = 0; state.sel = null;
    const fb = $('#feedback'); fb.className = 'feedback mid';
    fb.innerHTML = '<h3>تمرين قراءة إيقاعية</h3>حلّل التمرين (الميزان، عدد الموازير، العلامات والأشكال)، ثم اقرأه بطريقة إيمي باري مازورة مازورة مع التصفيق، ثم كاملًا. اضغط «استمع لما دوّنته» للتحقق.';
    fb.hidden = false;
    renderStaff();
  }

  // ------------------------------------------------------------------ التعليمات (زر ℹ️) — محفوظة كما هي مع تحديثها
  function renderHelp(open) {
    const sec = (t, body) => '<section><h4>' + t + '</h4>' + body + '</section>';
    let html;
    if (state.mode === 'dictation') {
      html = sec('🎧 الإملاء الإيقاعي', '<ul><li>اختر المستوى من الشجرة أعلى الصفحة (أو «📘 نماذج إيقاعية من دليل المعلم»)، ثم اضغط «ابدأ السؤال».</li><li>تُسمع مازورة عدّ تمهيدي (كلافيس)، ثم النمط بصوت آلة إيقاعية حقيقية: العلامات القصيرة ضربات، والطويلة (بلانش فأكثر) رول ممتد، والصمت سكتة. الضربة الأولى في المازورة أقوى قليلًا.</li><li>دوّن ما سمعته: اضغط العلامة لتُضاف إلى المازورة المحددة (الإطار البرتقالي)، أو اسحبها إلى المازورة. اضغط علامة داخل المازورة لتحديدها ثم استبدلها أو احذفها.</li><li>«أعد الاستماع» يعيد النمط نفسه دون تغيير السؤال، ويتحرك الضوء تحت المازورة التي تُسمع الآن.</li><li>«سلّم الإجابة» مرة واحدة لكل سؤال؛ وعند انتهاء الوقت تُسلَّم الإجابة كما هي تلقائيًا.</li></ul>') +
        sec('🏅 التصحيح والنقاط', '<ul><li>10 نقاط لكل مازورة صحيحة، و10 مكافأة عند صحة النمط كاملًا. لا تُحتسب النقاط إلا مرة واحدة.</li><li>تُقارن الإجابة بالإيقاع المسموع: مواضع النقرات وامتداد العلامات ومواضع السكتات — لا بمجموع الأزمنة وحده.</li><li>الكتابة المكافئة (مثل كروش + كروش بدل تاتي) تُقبل مع تنبيه، ويمكن للمعلم إلغاء قبولها. وامتداد العلامة القصيرة لا تُظهره ضربة الآلة، فيُقبل مع بيان الكتابة الأدق.</li><li>في المجموعات ينتقل الدور تلقائيًا، ويُعلن الفائز (أو التعادل) بعد آخر سؤال.</li></ul>');
    } else {
      html = sec('✍️ التدوين والقراءة الإيقاعية', '<ul><li>اختر المستوى من الشجرة أعلى الصفحة، فتظهر علاماته في «العلامات والأشكال الإيقاعية».</li><li>كوّن تمرينًا إيقاعيًا وفق الميزان، ثم اضغط «تحقق من التدوين» لمعرفة صحة مجموع كل مازورة.</li><li>اقرأ التمرين بطريقة إيمي باري مع التصفيق، ثم «استمع لما دوّنته» للتحقق؛ تُضاء كل علامة لحظة سماعها، ويتحرك الضوء تحت المازورة الحالية.</li><li>«تمرين قراءة» يملأ الموازير بنمط من المستوى المختار لتدريب القراءة الإيقاعية.</li></ul>');
    }
    $('#helpBody').innerHTML = html;
    if (open != null) $('#help').hidden = !open;
  }

  // ------------------------------------------------------------------ ملء الشاشة
  function fsContext() {
    try { const fe = window.frameElement; if (fe && fe.ownerDocument) return { doc: fe.ownerDocument, el: fe.closest('.vlp-stage') || fe }; } catch (e) { /* أصل مختلف */ }
    return { doc: document, el: document.documentElement };
  }
  const fsEl = (d) => d.fullscreenElement || d.webkitFullscreenElement;
  function isFull() { const c = fsContext(); return !!(fsEl(c.doc) || fsEl(document)); }
  function toggleFull() {
    const c = fsContext();
    if (isFull()) { const d = fsEl(c.doc) ? c.doc : document; (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d); return; }
    const req = c.el.requestFullscreen || c.el.webkitRequestFullscreen;
    if (!req) { toast('المتصفح لا يدعم ملء الشاشة هنا.', 'err'); return; }
    try { const pr = req.call(c.el); if (pr && pr.catch) pr.catch(() => toast('تعذّر ملء الشاشة في هذا المتصفح.', 'err')); } catch (e) { toast('تعذّر ملء الشاشة في هذا المتصفح.', 'err'); }
  }
  function updateFullBtn() {
    const on = isFull(), b = $('#btnFull');
    b.textContent = on ? '🗗' : '⛶';
    b.setAttribute('data-tip', on ? 'تصغير الشاشة (العودة للحجم العادي)' : 'ملء الشاشة');
    b.setAttribute('aria-label', b.getAttribute('data-tip')); b.setAttribute('aria-pressed', on); b.classList.toggle('on', on);
  }

  // ------------------------------------------------------------------ المصدر وحقوق المحتوى
  function buildSources() {
    const box = $('#sourcesBody'); box.textContent = '';
    const add = (tag, html, cls) => box.appendChild(h(tag, cls ? { class: cls } : null, html));
    add('h4', 'تسلسل المستويات');
    add('p', 'ترتيب ظهور العلامات والأشكال الإيقاعية في المستويات يتبع تسلسل دروس الإيقاع في أدلة المعلم لمادة الفنون الموسيقية (الفصل الدراسي الأول) الصادرة عن وزارة التعليم في سلطنة عُمان، كما هي مسجلة في بنك دروس MusiTeacher:');
    const ul = h('ul');
    CT.LEVELS.forEach((L) => ul.appendChild(h('li', null, '<b>' + esc(L.grade) + '</b>: ' + esc(L.lesson))));
    box.appendChild(ul);
    add('p', 'أسماء الأشكال ونطقها بطريقة إيمي باري (تا، تفاتيفي، تاتيفي، تفاتي، تافي، تفا…) كما ترد في نصوص الأدلة، وتُكتب في عناوين بعض الدروس بالطاء (طفاتيفي، طفاتي، طفافي). <span class="muted">لم تتضمن المقتطفات المتاحة بيانات الطبعة وسنة النشر لأدلة الصفوف 1–7.</span>');
    add('h4', 'النماذج المنقولة من الدليل');
    if (CT.MODELS.length) add('p', '«📘 نماذج إيقاعية من دليل المعلم» (ضمن الإملاء الإيقاعي) منقولة من: ' + esc(CT.GUIDES[8].title) + ' — ' + esc(CT.GUIDES[8].publisher) + '، ' + esc(CT.GUIDES[8].edition) + '، ' + esc(CT.GUIDES[8].decree) + '. يظهر مع كل نموذج موضعه (الوحدة، الدرس، رقم النموذج، الصفحة)، ونص النشاط مقتبسًا بين «» منفصلًا عن التكييف التفاعلي.');
    else add('p', 'النماذج المنقولة من الأدلة مخفية في هذه النسخة.');
    add('h4', 'ما الذي طوّرته MusiTeacher؟');
    add('p', 'أسئلة الإملاء في المستويات يولّدها البرنامج عشوائيًا من العلامات المقررة لكل مستوى (من تصميم MusiTeacher، وليست منقولة من الأدلة)، وكذلك: واجهة اللعبة، والتدوين التفاعلي، والتشغيل الصوتي والنبر، والتصحيح الآلي المبني على الإيقاع المسموع، ونظام النقاط والمجموعات، وتحويل نماذج الدليل إلى نشاط إملاء تفاعلي.');
    add('h4', 'الأصوات');
    add('p', 'أصوات الآلات الإيقاعية والمترونوم والعدّ التمهيدي والاحتفال تسجيلات حقيقية من <b>Versilian Community Sample Library (VCSL)</b> — Versilian Studios، بترخيص <b>CC0 1.0</b> (ملك عام). التفاصيل وأسماء الملفات الأصلية في audio/CREDITS.md داخل اللعبة.');
    const legal = h('div', { class: 'legal' });
    legal.innerHTML = '<b>⚖️ تنبيه بشأن الحقوق</b><br>هذه اللعبة ليست منشورًا رسميًا لوزارة التعليم، وذِكر الأدلة مصدرًا لا يعني أن الوزارة اعتمدت اللعبة أو رعتها أو راجعتها. ' +
      'حقوق الأدلة الأصلية ومحتواها محفوظة لأصحابها، ولا تدّعي MusiTeacher ملكيتها. ذِكر المصدر هنا لأمانة الاقتباس وتوثيقه فقط، <b>ولا يمنح أي إذن</b> بإعادة نشر المحتوى أو نسخه أو طباعته لأغراض تجارية؛ ومن أراد ذلك فعليه الرجوع إلى صاحب الحق.' +
      '<div class="muted" style="margin-top:6px">نص الحقوق كما ورد في دليل المعلم للصف الثامن: «جميع حقوق التأليف والطبع والنشر محفوظة لوزارة التعليم، ولا يجوز طبع الكتاب أو تصويره أو إعادة نسخه كاملاً أو مجزأً أو ترجمته أو تخزينه في نطاق استعادة المعلومات بهدف تجاري بأي شكل من الأشكال إلا بإذن مسبق من الوزارة، ويجب ذكر المصدر في حالة الاقتباس القصير.»</div>';
    box.appendChild(legal);
  }

  // ------------------------------------------------------------------ التشغيل
  function init() {
    $$('.seg-btn').forEach((b) => b.addEventListener('click', () => {
      state.pmode = b.dataset.pmode;
      $$('.seg-btn').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
      renderPlayersSetup();
    }));
    $('#btnAddPlayer').addEventListener('click', () => {
      const n = $$('#playersBox .prow').length + 1;
      const row = h('div', { class: 'prow' });
      row.appendChild(h('input', { class: 'name-input', type: 'text', maxlength: 30, value: 'المجموعة ' + n, 'aria-label': 'اسم المتسابق ' + n }));
      row.appendChild(h('button', { type: 'button', class: 'x', 'aria-label': 'حذف', onclick: () => { row.remove(); updateAdd(); } }, '✕'));
      $('#playersBox').appendChild(row); updateAdd();
    });
    $('#btnStart').addEventListener('click', startGame);
    $('#playersBox').addEventListener('keydown', (e) => { if (e.key === 'Enter') startGame(); });
    renderPlayersSetup();

    $$('.tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
    $$('.src-btn').forEach((b) => b.addEventListener('click', () => setSrc(b.dataset.src)));
    $('#btnHelp').addEventListener('click', () => renderHelp($('#help').hidden));
    $('#btnHelpClose').addEventListener('click', () => { $('#help').hidden = true; });
    $('#coachX').addEventListener('click', () => { $('#coach').hidden = true; store.set('coachSeen', true); });
    $('#btnTheme').addEventListener('click', () => { const on = document.body.classList.toggle('light'); store.set('light', on); $('#btnTheme').textContent = on ? '☀️' : '🌙'; });
    if (store.get('light', false)) { document.body.classList.add('light'); $('#btnTheme').textContent = '☀️'; }
    const vol = $('#volume'); vol.value = store.get('volume', 0.8); AU.setVolume(+vol.value);
    vol.addEventListener('input', () => { AU.setVolume(+vol.value); store.set('volume', +vol.value); });
    $('#btnFull').addEventListener('click', toggleFull);
    const fc = fsContext();
    ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => { fc.doc.addEventListener(ev, updateFullBtn); if (fc.doc !== document) document.addEventListener(ev, updateFullBtn); });
    updateFullBtn();

    $('#btnUndo').addEventListener('click', undo);
    $('#btnClear').addEventListener('click', clearAll);
    $('#btnDelSel').addEventListener('click', deleteSelected);
    $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.hasAttribute('data-close')) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else if (state.sel) { state.sel = null; renderStaff(); } }
      if ($('#app').hidden || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel) { e.preventDefault(); deleteSelected(); return; }
      if (e.key === 'Backspace' || (e.ctrlKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); undo(); }
    });

    $('#settingsWrap').open = store.get('settingsOpen', false);   // مطوية افتراضيًا (ملخصها ظاهر) حتى يبقى التمرين في الشاشة
    bindTips(); bindSettings(); fillSettings(); buildSources(); renderHelp(false);
  }
  init();
})();
