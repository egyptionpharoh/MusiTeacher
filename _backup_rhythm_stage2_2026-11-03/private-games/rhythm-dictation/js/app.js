// ============================================================================
// app.js — واجهة مسابقة التدوين والإملاء الإيقاعي (MusiTeacher)
// الأوضاع: 🎧 الإملاء الإيقاعي (مسابقة بنقاط ودور) · ✍️ التدوين والقراءة (حر بلا نقاط) · 📘 نماذج الدليل
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
  const defaults = { level: 'g3', beats: 2, measures: 2, bpm: 70, timer: 0, plays: 0, questions: 5, metro: false, clap: false, names: true, equiv: true, custom: ['q', 'rq', 'ee', 'h'] };
  const state = {
    mode: 'dictation',
    s: Object.assign({}, defaults, store.get('settings', {})),
    players: [], pmode: 'solo', turn: 0, asked: 0,
    answer: [[]], target: 0, lastAdd: [],
    q: null,          // سؤال الإملاء الحالي: { pattern, beats, phase, plays, result, timerLeft, timerStarted }
    guide: null,      // { id, result }
    playing: false,
  };
  if (!ALL_IDS.includes(state.s.custom[0])) state.s.custom = defaults.custom.slice();
  const saveSettings = () => store.set('settings', state.s);

  const LEVEL_ALL = { id: 'all', label: 'كل العلامات والأشكال', allowed: CT.LEVELS[CT.LEVELS.length - 1].allowed, focus: [], meters: [2, 3, 4] };
  const LEVEL_CUSTOM = { id: 'custom', label: '🛠️ مستوى مخصص (يختاره المعلم)', meters: [2, 3, 4] };
  function level() {
    const id = state.s.level;
    if (id === 'custom') return Object.assign({}, LEVEL_CUSTOM, { allowed: state.s.custom, focus: [] });
    if (id === 'all') return LEVEL_ALL;
    return CT.LEVELS.find((l) => l.id === id) || CT.LEVELS[2];
  }
  const guideModel = () => CT.MODELS.find((m) => m.id === (state.guide && state.guide.id)) || CT.MODELS[0];
  // ما يُعرض في لوحة العلامات
  function paletteIds() {
    if (state.mode === 'guide') return LEVEL_ALL.allowed;
    const L = level();
    return ALL_IDS.filter((id) => L.allowed.includes(id));
  }
  const curBeats = () => (state.mode === 'guide' ? guideModel().beats : state.q && state.mode === 'dictation' ? state.q.beats : state.s.beats);
  const curMeasures = () => (state.mode === 'guide' ? guideModel().measures.length : state.q && state.mode === 'dictation' ? state.q.pattern.length : state.s.measures);
  const curBpm = () => state.s.bpm;
  const editable = () => {
    if (state.mode === 'dictation') return !!state.q && (state.q.phase === 'listening' || state.q.phase === 'answering');
    if (state.mode === 'guide') return !(state.guide && state.guide.result);
    return true;
  };

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

  // ------------------------------------------------------------------ البداية والمتسابقون
  function renderPlayersSetup() {
    const box = $('#playersBox'); box.textContent = '';
    const saved = store.get('players', null);
    let names = state.pmode === 'solo' ? [(saved && saved.solo) || ''] : ((saved && saved.teams) || ['المجموعة الأولى', 'المجموعة الثانية']);
    names.forEach((n, i) => {
      const row = h('div', { class: 'prow' });
      row.appendChild(h('input', { class: 'name-input', type: 'text', maxlength: 30, value: n, placeholder: state.pmode === 'solo' ? 'اسم المتسابق (اختياري)' : 'اسم المجموعة ' + (i + 1), 'aria-label': 'اسم المتسابق ' + (i + 1) }));
      if (state.pmode === 'teams' && names.length > 2) row.appendChild(h('button', { type: 'button', class: 'x', 'aria-label': 'حذف', onclick: () => { row.remove(); updateAdd(); } }, '✕'));
      box.appendChild(row);
    });
    updateAdd();
  }
  function updateAdd() {
    const n = $$('#playersBox .prow').length;
    $('#btnAddPlayer').hidden = state.pmode !== 'teams' || n >= 6;
  }
  function startGame() {
    const names = $$('#playersBox .name-input').map((i, k) => i.value.trim() || (state.pmode === 'solo' ? 'المتسابق' : 'المجموعة ' + (k + 1)));
    const saved = store.get('players', {}) || {};
    if (state.pmode === 'solo') saved.solo = $$('#playersBox .name-input')[0].value.trim(); else saved.teams = names;
    store.set('players', saved);
    state.players = names.map((name) => ({ name, points: 0, ok: 0, answered: 0 }));
    state.turn = 0; state.asked = 0;
    AU.resume();                     // تفعيل الصوت بأول لمسة (سياسة المتصفحات)
    $('#splash').hidden = true; $('#app').hidden = false;
    setMode('dictation');
  }

  // ------------------------------------------------------------------ الإعدادات
  function fillSettings() {
    const sel = $('#sLevel'); sel.textContent = '';
    CT.LEVELS.forEach((L) => sel.appendChild(h('option', { value: L.id }, esc(L.label + ' · ' + L.grade))));
    sel.appendChild(h('option', { value: 'all' }, esc(LEVEL_ALL.label)));
    sel.appendChild(h('option', { value: 'custom' }, esc(LEVEL_CUSTOM.label)));
    sel.value = state.s.level;
    $('#sBeats').value = state.s.beats; $('#sMeasures').value = state.s.measures; $('#sBpm').value = state.s.bpm;
    $('#sTimer').value = state.s.timer; $('#sPlays').value = state.s.plays; $('#sQuestions').value = state.s.questions;
    $('#sMetro').checked = state.s.metro; $('#sClap').checked = state.s.clap; $('#sNames').checked = state.s.names; $('#sEquiv').checked = state.s.equiv;
    $('#btnCustom').hidden = state.s.level !== 'custom'; $('#customCount').textContent = state.s.custom.length;
    document.body.classList.toggle('hide-names', !state.s.names);
  }
  function bindSettings() {
    $('#sLevel').addEventListener('change', (e) => {
      state.s.level = e.target.value;
      const L = level();
      if (L.meters && !L.meters.includes(+state.s.beats)) { state.s.beats = L.meters[0]; }
      if (L.bpm) state.s.bpm = L.bpm;
      saveSettings(); fillSettings();
      if (state.s.level === 'custom' && state.s.custom.length < 1) openCustom();
      afterLayoutChange(true);
    });
    $('#btnCustom').addEventListener('click', openCustom);
    $('#sBeats').addEventListener('change', (e) => { state.s.beats = +e.target.value; saveSettings(); afterLayoutChange(true); });
    $('#sMeasures').addEventListener('change', (e) => { state.s.measures = +e.target.value; saveSettings(); afterLayoutChange(false); });
    $('#sBpm').addEventListener('change', (e) => { const v = Math.max(40, Math.min(160, parseInt(e.target.value, 10) || 70)); state.s.bpm = v; e.target.value = v; saveSettings(); });
    $('#sTimer').addEventListener('change', (e) => { state.s.timer = +e.target.value; saveSettings(); });
    $('#sPlays').addEventListener('change', (e) => { state.s.plays = +e.target.value; saveSettings(); renderActions(); });
    $('#sQuestions').addEventListener('change', (e) => { state.s.questions = +e.target.value; saveSettings(); renderScore(); });
    $('#sMetro').addEventListener('change', (e) => { state.s.metro = e.target.checked; saveSettings(); });
    $('#sClap').addEventListener('change', (e) => { state.s.clap = e.target.checked; saveSettings(); });
    $('#sNames').addEventListener('change', (e) => { state.s.names = e.target.checked; saveSettings(); document.body.classList.toggle('hide-names', !state.s.names); });
    $('#sEquiv').addEventListener('change', (e) => { state.s.equiv = e.target.checked; saveSettings(); });
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
        state.s.custom = ids; saveSettings(); fillSettings(); afterLayoutChange(true); return true;
      } },
    ]);
  }
  /** تغيير الميزان/الموازير/المستوى خارج السؤال: نعيد بناء الموازير مع الإبقاء على ما يمكن */
  function afterLayoutChange(clear) {
    if (state.mode === 'dictation' && state.q && state.q.phase !== 'graded') return;
    if (state.mode === 'dictation' && state.q && state.q.phase === 'graded') { state.q = null; hideResult(); }
    const n = curMeasures();
    if (clear) state.answer = Array.from({ length: n }, () => []);
    else state.answer = Array.from({ length: n }, (_, i) => state.answer[i] || []);
    state.target = 0; state.lastAdd = [];
    renderAll();
  }

  // ------------------------------------------------------------------ الأوضاع
  function setMode(mode) {
    if (state.mode === 'dictation' && state.q && state.q.phase !== 'graded' && mode !== 'dictation') {
      toast('أنهِ السؤال الحالي (سلّم الإجابة) قبل تغيير الوضع.', 'err'); return;
    }
    stopPlayback();
    state.mode = mode;
    document.body.classList.remove('mode-dictation', 'mode-free', 'mode-guide');
    document.body.classList.add('mode-' + mode);
    $$('.tab').forEach((t) => { const on = t.dataset.mode === mode; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
    $('#guidePanel').hidden = mode !== 'guide';
    if (mode === 'guide') { state.guide = { id: (state.guide && state.guide.id) || (CT.MODELS[0] && CT.MODELS[0].id), result: null }; renderGuide(); }
    if (mode === 'dictation' && state.q && state.q.phase === 'graded') { /* يبقى عرض نتيجة السؤال الأخير */ } else hideResult();
    state.answer = mode === 'dictation' && state.q ? state.answer : Array.from({ length: curMeasures() }, () => []);
    state.target = 0; state.lastAdd = [];
    renderHelp(false);
    renderAll();
  }

  // ------------------------------------------------------------------ الرسم
  function renderAll() {
    const locked = !!(state.mode === 'dictation' && state.q && state.q.phase !== 'graded');
    $('#settings').classList.toggle('locked', locked);
    $$('#settings select, #settings input, #settings button').forEach((el) => { el.disabled = locked; });
    $$('.tab').forEach((t) => { t.disabled = locked && t.dataset.mode !== 'dictation'; });
    renderScore(); renderActions(); renderPalette(); renderStaff();
  }

  function renderScore() {
    const box = $('#players'); box.textContent = '';
    const showTurn = state.mode === 'dictation';
    state.players.forEach((p, i) => {
      box.appendChild(h('div', { class: 'pchip' + (showTurn && i === state.turn ? ' turn' : '') },
        esc(p.name) + ' <b>' + p.points + '</b> <small>نقطة · ✅ ' + p.ok + '</small>'));
    });
    let info = '';
    if (state.mode === 'dictation') {
      const n = state.s.questions, q = state.q;
      const turn = state.players.length > 1 && state.asked < n ? ' · الدور: ' + esc(state.players[state.turn].name) : '';
      if (q && q.phase !== 'graded') info = 'السؤال ' + (state.asked + 1) + ' من ' + n + turn;
      else if (state.asked >= n) info = 'انتهت الجولة (' + n + ' أسئلة)';
      else if (state.asked) info = 'أُجيب ' + state.asked + ' من ' + n + turn;
      else info = 'الجولة: ' + n + ' أسئلة' + turn;
    } else if (state.mode === 'free') info = 'تدوين حر — لا تُحتسب نقاط';
    else info = 'نماذج دليل المعلم — تدريب بلا نقاط';
    $('#qinfo').innerHTML = info;
  }

  function renderActions() {
    const box = $('#actions'); box.textContent = '';
    const add = (label, cls, fn, opts) => { const b = h('button', Object.assign({ type: 'button', class: 'btn ' + (cls || ''), onclick: fn }, opts || {}), label); box.appendChild(b); return b; };
    if (state.mode === 'dictation') {
      const q = state.q;
      if (!q || q.phase === 'graded') {
        if (state.asked >= state.s.questions) {
          add('🏆 النتائج النهائية', 'primary', showFinal);
          add('🔄 جولة جديدة', 'ghost', newRound);
        } else {
          add(q ? '⏭ السؤال التالي' : '▶ ابدأ السؤال', 'primary', startQuestion, { id: 'btnStartQ' });
          box.appendChild(h('span', { class: 'hint' }, q ? '' : 'يبدأ العدّ التمهيدي (مازورة) ثم يُسمَع النمط. يبدأ الوقت بعد انتهاء الاستماع الأول.'));
        }
      } else {
        const limit = state.s.plays, left = limit ? limit - q.plays : Infinity;
        add('🔁 أعد الاستماع' + (limit ? ' (' + Math.max(0, left) + ')' : ''), 'teal', replay, { id: 'btnReplay', disabled: q.phase === 'listening' || left <= 0 });
        add('⏹ إيقاف', 'ghost', () => { AU.stopAll(); onPlayEnd(); }, { disabled: !state.playing });
        box.appendChild(h('span', { class: 'spacer' }));
        add('✔ سلّم الإجابة', 'green', () => submit(false), { id: 'btnSubmit' });
      }
    } else if (state.mode === 'free') {
      add('🔊 استمع لما دوّنته', 'teal', () => playPattern(state.answer, curBeats(), { highlight: true }));
      add('✅ تحقق من التدوين', 'green', checkFree);
      add('🎲 تمرين قراءة', 'violet', readingExercise, { title: 'يملأ الموازير بنمط من المستوى: اقرأه بطريقة إيمي باري وصفقه، ثم استمع للتحقق' });
      add('⏹ إيقاف', 'ghost', () => { AU.stopAll(); onPlayEnd(); });
    } else {
      const M = guideModel(); if (!M) return;
      add('▶ استمع للنموذج كاملًا', 'primary', () => playPattern(M.measures, M.beats, { bpm: curBpm() }));
      if (M.byMeasure) M.measures.forEach((m, i) => add('المازورة ' + (i + 1), 'ghost small', () => playPattern([m], M.beats, { offset: i })));
      add('⏹ إيقاف', 'ghost', () => { AU.stopAll(); onPlayEnd(); });
      box.appendChild(h('span', { class: 'spacer' }));
      if (state.guide.result) add('↺ حاول مرة أخرى', 'ghost', () => { state.guide.result = null; state.answer = M.measures.map(() => []); hideResult(); renderAll(); });
      else add('✔ تحقق من إجابتك', 'green', submitGuide);
    }
  }

  function renderPalette() {
    const box = $('#palette'); box.textContent = '';
    const L = level();
    const focus = state.mode === 'guide' ? [] : (L.focus || []);
    paletteIds().forEach((id) => {
      const f = RD.FIG[id], g = GL.glyph(id);
      const b = h('button', { type: 'button', class: 'pcard' + (f.kind === 'rest' ? ' rest' : '') + (focus.includes(id) ? ' focus' : ''), draggable: 'true', 'data-id': id,
        'aria-label': f.name + '، قيمته ' + RD.beatsText(f.ticks) + ' زمن', title: f.name + ' = ' + RD.beatsText(f.ticks) + ' زمن' + (f.aka ? ' (يُكتب أيضًا: ' + f.aka.join('، ') + ')' : '') });
      b.innerHTML = g.svg + '<span class="pname">' + esc(f.name) + '</span>' + (f.syl && f.syl !== f.name ? '<span class="psyl">' + esc(f.syl) + '</span>' : '') +
        '<span class="pval">' + RD.beatsText(f.ticks) + ' زمن</span>';
      b.addEventListener('click', () => addFigure(id));
      // stopPropagation: طبقة الحماية تمنع السحب على مستوى النافذة (ردعًا لنسخ الصور)، وسحب العلامات هنا وظيفة تعليمية
      b.addEventListener('dragstart', (e) => { e.stopPropagation(); e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'copy'; });
      box.appendChild(b);
    });
  }

  function itemHTML(id, extra) {
    const f = RD.FIG[id];
    return '<div class="item' + (extra || '') + '" data-id="' + id + '">' + GL.glyph(id).svg +
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
      if (!m.length) items.innerHTML = '<span class="empty-hint">' + (opts.edit ? 'اضغط علامة لإضافتها هنا' : '—') + '</span>';
      else items.innerHTML = m.map((id, k) => itemHTML(id, '')).join('');
      el.appendChild(items);
      const used = RD.seqTicks(m);
      const leftCls = used === cap ? 'full' : used > cap ? 'over' : '';
      const leftTxt = used === cap ? 'مكتملة ✓' : used > cap ? 'زائدة ' + RD.beatsText(used - cap) : 'متبقٍ ' + RD.beatsText(cap - used);
      el.appendChild(h('div', { class: 'mfoot' }, '<span class="num">م' + (i + 1) + '</span>' + (opts.edit || opts.showLeft ? '<span class="left ' + leftCls + '">' + leftTxt + '</span>' : '')));
      if (r) el.appendChild(h('span', { class: 'badge ' + (r.ok ? (r.status === 'equivalent' ? 'eq' : 'ok') : 'bad') }, r.ok ? (r.status === 'equivalent' ? '✓ مكافئ' : '✓ صحيح') : '✗'));
      if (opts.edit) {
        el.addEventListener('click', (e) => {
          const it = e.target.closest('.item');
          if (it && editable()) { removeAt(i, $$('.item', items).indexOf(it)); return; }
          state.target = i; renderStaff();
        });
        el.addEventListener('dragover', (e) => { if (!editable()) return; e.preventDefault(); el.classList.add('over'); });
        el.addEventListener('dragleave', () => el.classList.remove('over'));
        el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); if (RD.FIG[id]) addFigure(id, i); });
      }
      wrap.appendChild(el);
    });
    container.appendChild(wrap);
  }

  function renderStaff() {
    const n = curMeasures();
    while (state.answer.length < n) state.answer.push([]);
    if (state.answer.length > n) state.answer.length = n;
    const marks = state.mode === 'dictation' ? state.q && state.q.result && state.q.result.measures
      : state.mode === 'guide' ? state.guide && state.guide.result && state.guide.result.measures : state.freeMarks;
    measuresInto($('#staff'), state.answer, curBeats(), { edit: editable() || state.mode === 'free', marks });
    $('#staffTitle').textContent = state.mode === 'free' ? 'تدوينك' : 'إجابتك';
    const ed = editable();
    $('#btnUndo').disabled = !ed || !state.lastAdd.length;
    $('#btnClear').disabled = !ed || state.answer.every((m) => !m.length);
  }

  // ------------------------------------------------------------------ التدوين
  function addFigure(id, mIndex) {
    if (!editable()) {
      toast(state.mode === 'dictation' ? (state.q ? 'انتهى هذا السؤال. اضغط «السؤال التالي».' : 'اضغط «ابدأ السؤال» أولًا.') : 'اضغط «حاول مرة أخرى» لإعادة التدوين.', 'err');
      return;
    }
    const cap = curBeats() * RD.TPB, f = RD.FIG[id];
    let i = mIndex != null ? mIndex : state.target;
    const room = (k) => cap - RD.seqTicks(state.answer[k]);
    if (room(i) < f.ticks) {
      if (mIndex != null) { toast('لا تتسع المازورة (' + (i + 1) + ') لـ«' + f.name + '». المتبقي: ' + RD.beatsText(Math.max(0, room(i))) + ' زمن.', 'err'); return; }
      // الإضافة بالضغط: ننتقل إلى أول مازورة تالية تتسع
      let k = i + 1; while (k < state.answer.length && room(k) < f.ticks) k++;
      if (k >= state.answer.length) { toast('لا تتسع المازورة (' + (i + 1) + ') لـ«' + f.name + '». المتبقي: ' + RD.beatsText(Math.max(0, room(i))) + ' زمن. احذف علامة أو اختر مازورة أخرى.', 'err'); return; }
      i = k;
    }
    state.answer[i].push(id); state.lastAdd.push(i);
    state.freeMarks = null;
    if (room(i) === 0) { let k = i + 1; while (k < state.answer.length && room(k) === 0) k++; if (k < state.answer.length) state.target = k; else state.target = i; }
    else state.target = i;
    renderStaff();
  }
  function removeAt(m, k) {
    if (!editable() || k < 0) return;
    state.answer[m].splice(k, 1); state.target = m; state.freeMarks = null;
    const j = state.lastAdd.lastIndexOf(m); if (j >= 0) state.lastAdd.splice(j, 1);
    renderStaff();
  }
  function undo() {
    if (!editable() || !state.lastAdd.length) return;
    const m = state.lastAdd.pop(); state.answer[m].pop(); state.target = m; state.freeMarks = null; renderStaff();
  }
  function clearAll() {
    if (!editable()) return;
    state.answer = state.answer.map(() => []); state.target = 0; state.lastAdd = []; state.freeMarks = null;
    hideFeedbackIfFree(); renderStaff();
  }
  function hideFeedbackIfFree() { if (state.mode === 'free') $('#feedback').hidden = true; }

  // ------------------------------------------------------------------ الصوت
  let progT = null;
  function stopPlayback() {
    AU.stopAll(); state.playing = false; clearInterval(progT); $('#progress').style.width = '0%';
    $$('.item.now').forEach((x) => x.classList.remove('now'));
  }
  function onPlayEnd() {
    state.playing = false;
    clearInterval(progT); $('#progress').style.width = '0%';
    $$('.item.now').forEach((x) => x.classList.remove('now'));
    $('#clapDot').classList.remove('on');
    if (state.mode === 'dictation' && state.q && state.q.phase === 'listening') {
      state.q.phase = 'answering';
      startTimer();
    }
    renderActions();
  }
  /**
   * opts: { highlight: تمييز العلامة المسموعة في الإجابة (التدوين الحر) · offset: رقم المازورة عند تشغيل مازورة واحدة · solution }
   */
  async function playPattern(measures, beats, opts) {
    opts = opts || {};
    const valid = measures.some((m) => m.length);
    if (!valid) { toast('لا يوجد ما يُسمَع بعد. أضف علامات إلى الموازير.', 'err'); return; }
    const metro = state.mode === 'guide' ? true : state.s.metro;
    const sch = RD.buildSchedule(measures, beats, opts.bpm || curBpm(), { countIn: 1, metronome: metro });
    state.playing = true; renderActions();
    const bar = $('#progress');
    const res = AU.play(sch, {
      start: () => {
        const t0 = performance.now() + 120;
        clearInterval(progT);
        progT = setInterval(() => { const x = (performance.now() - t0) / 1000; bar.style.width = Math.max(0, Math.min(100, (x / sch.total) * 100)) + '%'; }, 50);
      },
      event: (ev) => {
        if (ev.type !== 'note') return;
        if (state.s.clap) { const c = $('#clapDot'); c.classList.add('on'); setTimeout(() => c.classList.remove('on'), Math.min(160, ev.d * 700)); }
        if (opts.highlight) {
          $$('.item.now').forEach((x) => x.classList.remove('now'));
          const mEl = $$('#staff .measure')[ev.m + (opts.offset || 0)];
          const it = mEl && $$('.item', mEl)[ev.i];
          if (it) it.classList.add('now');
        }
      },
    });
    const r = await res;
    if (r && r.noAudio) { toast('المتصفح لا يدعم تشغيل الصوت هنا.', 'err'); onPlayEnd(); }
    else if (r && !r.stopped) onPlayEnd();
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
    if (state.q && state.q.phase !== 'graded') return;
    const L = level();
    if (!L.allowed || !L.allowed.length) { openCustom(); return; }
    const beats = +state.s.beats, nM = +state.s.measures;
    const pattern = RD.generate({ allowed: L.allowed, focus: L.focus, beats, measures: nM });
    state.q = { pattern, beats, phase: 'listening', plays: 1, result: null, timerLeft: state.s.timer, timerStarted: false };
    state.answer = pattern.map(() => []); state.target = 0; state.lastAdd = [];
    $('#timer').hidden = !state.s.timer; showTimer();
    hideResult(); renderAll();
    playPattern(pattern, beats);
  }
  function replay() {
    const q = state.q; if (!q || q.phase !== 'answering') return;
    if (state.s.plays && q.plays >= state.s.plays) { toast('انتهت مرات الاستماع المسموح بها لهذا السؤال.', 'err'); return; }
    q.plays++;
    playPattern(q.pattern, q.beats);         // نفس النمط تمامًا: الإعادة لا تغيّر السؤال
    renderActions();
  }
  function submit(byTimeout) {
    const q = state.q;
    if (!q || q.phase === 'graded') return;            // تسليم واحد فقط لكل سؤال
    stopPlayback(); stopTimer();
    q.phase = 'graded';
    q.result = RD.gradeAnswer(state.answer, q.pattern, q.beats, { acceptEquivalent: state.s.equiv });
    const P = state.players[state.turn];
    P.points += q.result.points; P.answered++; if (q.result.all) P.ok++;
    state.asked++;
    state.turn = (state.turn + 1) % state.players.length;    // الدور ينتقل فور التسليم إلى المتسابق التالي
    showResult(q.result, { byTimeout, who: state.players.length > 1 ? P.name : '', pattern: q.pattern, beats: q.beats });
    if (q.result.all) celebrate();
    renderAll();
    if (state.asked >= state.s.questions) setTimeout(showFinal, 900);
  }
  function showFinal() {
    const ranked = state.players.map((p, i) => Object.assign({ i }, p)).sort((a, b) => b.points - a.points);
    const top = ranked[0].points;
    const t = h('table', { class: 'rank' });
    t.innerHTML = '<tr><th>الترتيب</th><th>المتسابق</th><th>النقاط</th><th>إجابات كاملة</th><th>أسئلة</th></tr>' +
      ranked.map((p, k) => '<tr class="' + (p.points === top && top > 0 ? 'first' : '') + '"><td>' + (k + 1) + (p.points === top && top > 0 ? ' 🏆' : '') + '</td><td>' + esc(p.name) + '</td><td>' + p.points + '</td><td>' + p.ok + '</td><td>' + p.answered + '</td></tr>').join('');
    const wrap = h('div'); wrap.appendChild(t);
    wrap.appendChild(h('p', { class: 'muted' }, 'النقاط: 10 لكل مازورة صحيحة، و10 مكافأة عند صحة النمط كاملًا.'));
    modal('🏆 نتيجة الجولة', wrap, [{ label: 'متابعة' }, { label: '🔄 جولة جديدة', cls: 'primary', run: newRound }, { label: '👥 تغيير المتسابقين', run: backToSplash }]);
    if (top > 0) celebrate();
  }
  function newRound() {
    state.players.forEach((p) => { p.points = 0; p.ok = 0; p.answered = 0; });
    state.turn = 0; state.asked = 0; state.q = null; stopTimer(); $('#timer').hidden = true;
    state.answer = Array.from({ length: state.s.measures }, () => []);
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
    const stars = '★'.repeat(Math.round((r.okCount / r.total) * 3)) + '☆'.repeat(3 - Math.round((r.okCount / r.total) * 3));
    let head;
    if (r.all) head = r.measures.some((m) => m.status === 'equivalent') ? 'إجابة صحيحة إيقاعيًا 🌟' : 'إجابة صحيحة تمامًا! 🌟';
    else if (r.okCount) head = 'إجابة صحيحة جزئيًا';
    else head = 'الإجابة غير صحيحة';
    let html = '<h3>' + (o.byTimeout ? '⏰ انتهى الوقت — ' : '') + head + '</h3>' +
      '<div class="stars" aria-label="' + r.okCount + ' من ' + r.total + '">' + stars + '</div>' +
      (o.points === false ? '' : '<div class="pts">' + (o.who ? esc(o.who) + ': ' : '') + '+' + r.points + ' نقطة (من ' + r.maxPoints + ') · موازير صحيحة: ' + r.okCount + ' من ' + r.total + '</div>');
    const notes = [];
    r.measures.forEach((m, i) => m.issues.forEach((x) => notes.push('المازورة (' + (i + 1) + '): ' + x.text)));
    if (notes.length) html += '<ul>' + notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>';
    fb.innerHTML = html; fb.className = 'feedback ' + (r.all ? 'good' : r.okCount ? 'mid' : 'bad'); fb.hidden = false;
    $('#solutionWrap').hidden = false;
    $('#solutionTitle').textContent = o.solutionTitle || 'النمط الذي سُمِع (الحل)';
    measuresInto($('#solution'), o.pattern, o.beats, { showLeft: false, changed: o.changed });
    $('#btnPlaySolution').onclick = () => playPattern(o.pattern, o.beats, {});
  }

  // ------------------------------------------------------------------ التدوين الحر
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
    const L = level();
    state.answer = RD.generate({ allowed: L.allowed, focus: L.focus, beats: curBeats(), measures: curMeasures() });
    state.lastAdd = []; state.freeMarks = null; state.target = 0;
    const fb = $('#feedback'); fb.className = 'feedback mid';
    fb.innerHTML = '<h3>تمرين قراءة إيقاعية</h3>حلّل التمرين (الميزان، عدد الموازير، العلامات والأشكال)، ثم اقرأه بطريقة إيمي باري مازورة مازورة مع التصفيق، ثم كاملًا. اضغط «استمع لما دوّنته» للتحقق.';
    fb.hidden = false;
    renderStaff();
  }

  // ------------------------------------------------------------------ نماذج الدليل
  function renderGuide() {
    const sel = $('#gModel'); sel.textContent = '';
    CT.MODELS.forEach((M) => sel.appendChild(h('option', { value: M.id }, esc(M.title))));
    const M = guideModel(); if (!M) return;
    sel.value = M.id;
    $('#guideCard').innerHTML = '<h3>📘 ' + esc(M.title) + '</h3>' +
      '<div class="quote"><b>نص النشاط في الدليل:</b> «' + esc(M.task) + '»</div>' +
      '<div class="adapt">تكييف MusiTeacher التفاعلي: ' + esc(M.adapt) + '</div>' +
      '<div class="cite">المصدر: ' + esc(CT.citation(M)) + ' الميزان ' + M.beats + '/4 · السرعة المقترحة ' + M.bpm + '.</div>';
  }
  function submitGuide() {
    const M = guideModel();
    if (state.answer.every((m) => !m.length)) { toast('دوّن ما سمعته أولًا.', 'err'); return; }
    stopPlayback();
    const r = RD.gradeAnswer(state.answer, M.measures, M.beats, { acceptEquivalent: state.s.equiv });
    state.guide.result = r;
    let changed = null;
    if (M.compareWith) {
      const B = CT.MODELS.find((x) => x.id === M.compareWith);
      changed = M.measures.map((m, i) => !RD.sameRhythm(m, B.measures[i]));
    }
    showResult(r, { pattern: M.measures, beats: M.beats, points: false, solutionTitle: 'النموذج كما في الدليل' + (changed ? ' — الموازير المميزة بالبنفسجي تغيّرت عن النموذج (3)' : ''), changed });
    if (M.compareWith) {
      const B = CT.MODELS.find((x) => x.id === M.compareWith);
      $('#compareWrap').hidden = false; $('#compareTitle').textContent = 'للمقارنة: ' + B.model;
      measuresInto($('#compare'), B.measures, B.beats, { changed });
    }
    if (r.all) celebrate();
    renderAll();
  }

  // ------------------------------------------------------------------ التعليمات
  function renderHelp(open) {
    const box = $('#helpBody');
    const sec = (t, body) => '<section><h4>' + t + '</h4>' + body + '</section>';
    let html = '';
    if (state.mode === 'dictation') {
      html = sec('🎧 الإملاء الإيقاعي', '<ul><li>اختر المستوى والميزان وعدد الموازير والسرعة، ثم اضغط «ابدأ السؤال».</li><li>تُسمع مازورة عدّ تمهيدي (نقرات خشبية)، ثم النمط بصوت ممتد بطول كل علامة؛ والصمت سكتة.</li><li>دوّن ما سمعته: اضغط العلامة لتُضاف إلى المازورة المحددة (الإطار البرتقالي)، أو اسحبها بالفأرة. اضغط العلامة داخل المازورة لحذفها.</li><li>«أعد الاستماع» يعيد النمط نفسه دون تغيير السؤال.</li><li>«سلّم الإجابة» مرة واحدة لكل سؤال؛ وعند انتهاء الوقت تُسلَّم الإجابة كما هي تلقائيًا.</li></ul>') +
        sec('🏅 التصحيح والنقاط', '<ul><li>10 نقاط لكل مازورة صحيحة، و10 مكافأة عند صحة النمط كاملًا. لا تُحتسب النقاط إلا مرة واحدة.</li><li>تُقارن الإجابة بالإيقاع المسموع: مواضع النقرات وامتداد العلامات ومواضع السكتات — لا بمجموع الأزمنة وحده.</li><li>الكتابة المكافئة (مثل كروش + كروش بدل تاتي) تُقبل مع تنبيه، ويمكن للمعلم إلغاء قبولها.</li><li>في المجموعات ينتقل الدور تلقائيًا مع كل سؤال.</li></ul>');
    } else if (state.mode === 'free') {
      html = sec('✍️ التدوين الحر', '<ul><li>كوّن تمرينًا إيقاعيًا وفق الميزان، ثم اضغط «تحقق من التدوين» لمعرفة صحة مجموع كل مازورة.</li><li>اقرأ التمرين بطريقة إيمي باري مع التصفيق، ثم «استمع لما دوّنته» للتحقق؛ تُضاء كل علامة لحظة سماعها.</li><li>«تمرين قراءة» يملأ الموازير بنمط من المستوى المختار لتدريب القراءة الإيقاعية.</li></ul>');
    } else {
      html = sec('📘 نماذج دليل المعلم', '<ul><li>نماذج الإملاء الإيقاعي من دليل المعلم للصف الثامن (الوحدة الرابعة، الدرس الثاني) كما وردت فيه.</li><li>استمع للنموذج كاملًا أو مازورة مازورة (مع نبض النوار)، ودوّنه، ثم «تحقق من إجابتك».</li><li>هذا وضع تدريب: لا تُحتسب فيه نقاط المسابقة.</li></ul>');
    }
    box.innerHTML = html;
    if (open != null) $('#help').hidden = !open;
  }

  // ------------------------------------------------------------------ ملء الشاشة
  // داخل المنصة تُكبَّر «منصة اللعبة» في الصفحة الأم (مع العلامة المائية وزر التصغير) فلا يُعاد تحميل
  // اللعبة ولا يتوقف الصوت ولا تضيع الإجابة. خارج المنصة تُكبَّر صفحة اللعبة نفسها.
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
    b.textContent = on ? '🗗' : '⛶'; b.title = on ? 'تصغير الشاشة (العودة للحجم العادي)' : 'ملء الشاشة';
    b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', on); b.classList.toggle('on', on);
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
    if (CT.MODELS.length) {
      add('p', 'نماذج «📘 نماذج الدليل» منقولة من: ' + esc(CT.GUIDES[8].title) + ' — ' + esc(CT.GUIDES[8].publisher) + '، ' + esc(CT.GUIDES[8].edition) + '، ' + esc(CT.GUIDES[8].decree) + '. يظهر مع كل نموذج موضعه (الوحدة، الدرس، رقم النموذج، الصفحة)، ونص النشاط مقتبسًا بين «» منفصلًا عن التكييف التفاعلي.');
    } else add('p', 'النماذج المنقولة من الأدلة مخفية في هذه النسخة.');
    add('h4', 'ما الذي طوّرته MusiTeacher؟');
    add('p', 'أسئلة الإملاء في المستويات يولّدها البرنامج عشوائيًا من العلامات المقررة لكل مستوى (من تصميم MusiTeacher، وليست منقولة من الأدلة)، وكذلك: واجهة اللعبة، والتدوين التفاعلي، والتشغيل الصوتي، والتصحيح الآلي المبني على الإيقاع المسموع، ونظام النقاط والمجموعات، وتحويل نماذج الدليل إلى نشاط إملاء تفاعلي.');
    add('h4', 'الصوت');
    add('p', 'كل الأصوات (صوت الإيقاع والمترونوم والعدّ التمهيدي) مولّدة برمجيًا داخل اللعبة، دون ملفات صوتية أو مصادر خارجية.');
    const legal = h('div', { class: 'legal' });
    legal.innerHTML = '<b>⚖️ تنبيه بشأن الحقوق</b><br>هذه اللعبة ليست منشورًا رسميًا لوزارة التعليم، وذِكر الأدلة مصدرًا لا يعني أن الوزارة اعتمدت اللعبة أو رعتها أو راجعتها. ' +
      'حقوق الأدلة الأصلية ومحتواها محفوظة لأصحابها، ولا تدّعي MusiTeacher ملكيتها. ذِكر المصدر هنا لأمانة الاقتباس وتوثيقه فقط، <b>ولا يمنح أي إذن</b> بإعادة نشر المحتوى أو نسخه أو طباعته لأغراض تجارية؛ ومن أراد ذلك فعليه الرجوع إلى صاحب الحق.' +
      '<div class="muted" style="margin-top:6px">نص الحقوق كما ورد في دليل المعلم للصف الثامن: «جميع حقوق التأليف والطبع والنشر محفوظة لوزارة التعليم، ولا يجوز طبع الكتاب أو تصويره أو إعادة نسخه كاملاً أو مجزأً أو ترجمته أو تخزينه في نطاق استعادة المعلومات بهدف تجاري بأي شكل من الأشكال إلا بإذن مسبق من الوزارة، ويجب ذكر المصدر في حالة الاقتباس القصير.»</div>';
    box.appendChild(legal);
  }

  // ------------------------------------------------------------------ التشغيل
  function init() {
    // البداية
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

    // الشريط العلوي
    $$('.tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
    if (!CT.MODELS.length) $('#tabGuide').hidden = true;
    $('#btnHelp').addEventListener('click', () => renderHelp($('#help').hidden));
    $('#btnHelpClose').addEventListener('click', () => { $('#help').hidden = true; });
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
    $('#gModel').addEventListener('change', (e) => {
      stopPlayback(); state.guide = { id: e.target.value, result: null };
      const M = guideModel(); state.s.bpm = M.bpm; $('#sBpm').value = M.bpm;
      state.answer = M.measures.map(() => []); state.target = 0; state.lastAdd = [];
      hideResult(); renderGuide(); renderAll();
    });
    $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.hasAttribute('data-close')) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
      if ((e.key === 'Backspace' || (e.ctrlKey && e.key.toLowerCase() === 'z')) && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !$('#app').hidden) { e.preventDefault(); undo(); }
    });

    fillSettings(); bindSettings(); buildSources(); renderHelp(false);
  }
  init();
})();
