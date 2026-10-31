// ============================================================================
// app.js — واجهة اللعبة ومنطق الأنشطة
//   ✍️ التأليف والتدوين  |  🎧 الإملاء اللحني  |  📖 القراءة والتدريب
// وطريقة القراءة (صولفائية / إيقاعية) اختيار مستقل يُطبَّق على الأنشطة الثلاثة.
// ============================================================================
(function (MT) {
  'use strict';
  const T = MT.theory, SC = MT.score, EX = MT.exercises, ST = MT.storage;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // ------------------------------------------------------------------ الحالة
  const prefs = Object.assign({
    measureNumbers: false, hoverNames: true, countIn: true, firstNoteHint: true,
    volume: 0.8, read: 'solfege', labels: true, solfegeStyle: 'sung', rhythmLine: false, zoom: 1,
  }, ST.prefs());

  const state = {
    mode: 'compose',
    read: prefs.read === 'rhythm' ? 'rhythm' : 'solfege',
    labels: prefs.labels !== false,
    solfegeStyle: prefs.solfegeStyle === 'spoken' ? 'spoken' : 'sung',
    rhythmLine: !!prefs.rhythmLine,
    tool: { base: 1, kind: 'note' },
    dot: false,            // بوانتيه للعلامة التالية
    acc: null,             // تحويل للعلامة التالية
    selected: null,
    loop: false,
    metro: false,
    player: { name: 'زائر', xp: 0, ok: 0 },
    libId: null, libName: '', dirty: false, lastSavedAt: null,
    dict: { target: null, listens: 0, statuses: null, measureStatus: null, solution: false, label: '' },
    reading: { piece: null, source: '' },
    quiz: null,
    drag: null,
  };

  const docs = {
    compose: new SC.ScoreDoc(SC.emptyScore({ title: '', minMeasures: 4 })),
    dictation: new SC.ScoreDoc(SC.emptyScore({ minMeasures: 2 })),
    reading: new SC.ScoreDoc(SC.emptyScore()),
  };
  const cur = () => docs[state.mode];

  const audio = new MT.AudioEngine('audio/');
  audio.setVolume(prefs.volume);
  let renderer, solutionRenderer;

  // ------------------------------------------------------------------ أدوات عامة
  function toast(msg, kind, actions, ms) {
    const t = $('#toast');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = '';
    const span = document.createElement('span'); span.textContent = msg; t.appendChild(span);
    (actions || []).forEach(a => {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = a.label;
      b.onclick = () => { t.hidden = true; a.run(); }; t.appendChild(b);
    });
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, ms || (actions && actions.length ? 9000 : 3800));
  }
  function status(msg, kind) {
    const s = $('#status');
    s.className = 'status-line' + (kind ? ' ' + kind : '');
    s.textContent = msg || '';
  }
  function modal(title, bodyNode, actions) {
    const m = $('#modal');
    $('#modalTitle').textContent = title;
    const body = $('#modalBody'); body.textContent = '';
    if (typeof bodyNode === 'string') body.innerHTML = bodyNode; else if (bodyNode) body.appendChild(bodyNode);
    const act = $('#modalActions'); act.textContent = '';
    (actions || []).forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn' + (a.primary ? ' btn-primary' : '') + (a.danger ? ' danger' : '');
      b.textContent = a.label;
      b.onclick = () => { if (a.keepOpen) { a.run && a.run(); return; } closeModal(); a.run && a.run(); };
      act.appendChild(b);
    });
    m.hidden = false;
    const first = body.querySelector('input,select'); if (first) setTimeout(() => first.focus(), 30);
  }
  function closeModal() { $('#modal').hidden = true; }
  function confirmBox(title, text, yesLabel, onYes, extra) {
    const acts = [{ label: yesLabel, primary: true, run: onYes }];
    if (extra) acts.push(extra);
    acts.push({ label: 'إلغاء' });
    modal(title, '<p>' + text + '</p>', acts);
  }
  function h(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function savePrefs() {
    ST.prefs({
      measureNumbers: prefs.measureNumbers, hoverNames: prefs.hoverNames, countIn: prefs.countIn, firstNoteHint: prefs.firstNoteHint,
      volume: prefs.volume, zoom: prefs.zoom, read: state.read, labels: state.labels, solfegeStyle: state.solfegeStyle, rhythmLine: state.rhythmLine,
      player: state.player,
    });
  }

  // أيقونات القيم الزمنية مرسومة بنفس رموز المدرج
  function durIcon(base, kind) {
    const G = MT.GLYPHS, S = 9;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 40 40');
    const add = (tag, a) => { const e = document.createElementNS(NS, tag); Object.keys(a).forEach(k => e.setAttribute(k, a[k])); svg.appendChild(e); return e; };
    const ell = (cx, cy, rx, ry, rot) => { const r = rot * Math.PI / 180, dx = Math.cos(r) * rx, dy = Math.sin(r) * rx; return `M${cx + dx} ${cy + dy}A${rx} ${ry} ${rot} 1 0 ${cx - dx} ${cy - dy}A${rx} ${ry} ${rot} 1 0 ${cx + dx} ${cy + dy}Z`; };
    const gl = (name, x, y, k, ax, ay) => add('path', { d: G[name].d, transform: `translate(${x - ax * k} ${y + ay * k}) scale(${k} ${-k})`, fill: 'currentColor' });
    if (kind === 'rest') {
      if (base === 4) { add('line', { x1: 8, x2: 32, y1: 15, y2: 15, stroke: '#94a3b8', 'stroke-width': 1.3 }); add('rect', { x: 13, y: 15, width: 14, height: 5, fill: 'currentColor' }); }
      else if (base === 2) { add('line', { x1: 8, x2: 32, y1: 22, y2: 22, stroke: '#94a3b8', 'stroke-width': 1.3 }); add('rect', { x: 13, y: 17, width: 14, height: 5, fill: 'currentColor' }); }
      else if (base === 1) gl('restQuarter', 20, 20, 26 / 596, 160, 360);
      else if (base === 0.5) gl('rest8', 20, 20, 18 / 366, 126, 349);
      else gl('rest16', 20, 22, 26 / 554, 150, 254);
      return svg;
    }
    const cx = 15, cy = 30;
    if (base === 4) { add('path', { d: ell(20, 22, S * 0.78, S * 0.5, 0) + ell(20, 22, S * 0.36, S * 0.33, 62), 'fill-rule': 'evenodd', fill: 'currentColor' }); return svg; }
    if (base === 2) add('path', { d: ell(cx, cy, S * 0.62, S * 0.44, -22) + ell(cx, cy, S * 0.5, S * 0.2, -32), 'fill-rule': 'evenodd', fill: 'currentColor' });
    else add('path', { d: ell(cx, cy, S * 0.62, S * 0.44, -22), fill: 'currentColor' });
    const sx = cx + S * 0.56;
    add('line', { x1: sx, x2: sx, y1: cy - 1, y2: 4, stroke: 'currentColor', 'stroke-width': 1.8 });
    if (base <= 0.5) gl(base === 0.5 ? 'flag8' : 'flag16', sx - 0.4, 4, 26 / 590, 0, 767);
    return svg;
  }

  // ------------------------------------------------------------------ بناء الأدوات
  function buildTools() {
    const host = $('#durTools'); host.textContent = '';
    T.VALUES.forEach((v, i) => {
      const b = h('button', { class: 'tool dur', 'data-base': v.base, title: v.name + ' — ' + T.beatsText(v.base) + ' (' + (i + 1) + ')' });
      b.appendChild(durIcon(v.base, 'note'));
      b.appendChild(h('small', null, esc(v.name)));
      host.appendChild(b);
    });
    // أيقونات «نغمة/سكتة» و«بوانتيه» و«رباط» مرسومة (لا تعتمد على رموز قد لا يدعمها الخط)
    const setIcon = (sel, svg) => { const b = $(sel); const t = b.querySelector('small'); b.textContent = ''; b.appendChild(svg); b.appendChild(t); };
    setIcon('#tNote', durIcon(1, 'note'));
    setIcon('#tRest', durIcon(1, 'rest'));
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (inner) => { const v = document.createElementNS(NS, 'svg'); v.setAttribute('viewBox', '0 0 40 40'); v.innerHTML = inner; return v; };
    setIcon('#tDot', mk('<ellipse cx="15" cy="24" rx="6" ry="4.3" transform="rotate(-22 15 24)" fill="currentColor" opacity=".35"/><circle cx="27" cy="22" r="3.6" fill="currentColor"/>'));
    setIcon('#tTie', mk('<ellipse cx="10" cy="27" rx="5.4" ry="3.9" transform="rotate(-22 10 27)" fill="currentColor"/><line x1="14.8" y1="26" x2="14.8" y2="5" stroke="currentColor" stroke-width="1.8"/><ellipse cx="28" cy="27" rx="5.4" ry="3.9" transform="rotate(-22 28 27)" fill="currentColor"/><line x1="32.8" y1="26" x2="32.8" y2="5" stroke="currentColor" stroke-width="1.8"/><path d="M10 33 Q19 39.5 28 33 Q19 37 10 33Z" fill="currentColor" stroke="currentColor" stroke-width="1"/>'));
  }
  function refreshDurIcons() {
    $$('#durTools .tool').forEach(b => {
      const base = +b.dataset.base;
      const old = b.querySelector('svg'); if (old) old.remove();
      b.insertBefore(durIcon(base, state.tool.kind), b.firstChild);
      const v = T.VALUE_BY_BASE[base];
      b.querySelector('small').textContent = state.tool.kind === 'rest' ? v.rest.replace('سكتة ', 'س. ') : v.name;
    });
  }

  // ------------------------------------------------------------------ العرض
  function isEditable() {
    if (state.quiz) return false;
    if (state.mode === 'compose') return true;
    if (state.mode === 'dictation') return !!state.dict.target;
    return false;
  }
  function labelsMode() {
    if (state.quiz) return state.quiz.type === 'rhythm' ? 'rhythm' : 'solfege';
    if (!state.labels) return 'none';
    return state.read === 'rhythm' ? 'rhythm' : 'solfege';
  }
  function viewScore() {
    const sc = cur().score;
    if (state.mode !== 'compose') return sc;
    // مازورة فارغة إضافية دائمًا في التأليف ليظهر مكان الكتابة التالية
    const lay = SC.layout(sc);
    const last = lay.measures[lay.lastFilled];
    const need = lay.lastFilled < 0 ? 1 : (last && last.full ? lay.lastFilled + 2 : lay.lastFilled + 1);
    if (need <= sc.minMeasures) return sc;
    return Object.assign({}, sc, { minMeasures: need });
  }

  function render() {
    const sc = viewScore();
    const q = state.quiz;
    const opts = {
      labels: labelsMode(),
      rhythmLine: state.read === 'rhythm' && state.rhythmLine,
      selected: state.selected,
      editable: isEditable(),
      measureNumbers: prefs.measureNumbers,
      statuses: state.mode === 'dictation' ? state.dict.statuses : null,
      measureStatus: state.mode === 'dictation' ? state.dict.measureStatus : null,
      hideLabels: q ? q.hidden : false,
      quizIdx: q ? q.order[q.pos] : null,
      zoom: prefs.zoom || 1,
    };
    renderer.render(sc, opts);
    $('#staff').classList.toggle('readonly', !opts.editable);
    // بطاقة البداية للمدرج الفارغ
    $('#coach').hidden = !(state.mode === 'compose' && opts.editable && !cur().score.notes.length);
    // تنبيه النغمات التي لم يُحدَّد موضعها بعد
    const unp = opts.editable ? unpitchedIdxs().length : 0;
    const bar = $('#unpitchedBar');
    bar.hidden = !unp;
    if (unp) $('#unpitchedText').textContent = '🎯 في النوتة ' + (unp === 1 ? 'نغمة واحدة' : unp + ' نغمات') + ' بلا موضع (؟) — كُتبت إيقاعيًا على خط واحد. حدّد مواضعها على المدرج لتصبح قابلة للقراءة الصولفائية.';
    $('#zoomVal').textContent = Math.round((prefs.zoom || 1) * 100) + '٪';
    if (state.mode === 'dictation' && state.dict.solution && state.dict.target) {
      solutionRenderer.render(state.dict.target, { labels: state.read === 'rhythm' ? 'rhythm' : 'solfege', measureNumbers: prefs.measureNumbers, rhythmLine: state.read === 'rhythm' && state.rhythmLine, zoom: prefs.zoom || 1 });
    }
    updateHead();
    updateToolbar();
  }

  function setZoom(delta) {
    prefs.zoom = Math.max(0.8, Math.min(1.6, Math.round(((prefs.zoom || 1) + delta) * 10) / 10));
    savePrefs(); render();
  }

  function updateHead() {
    const sc = cur().score;
    const key = T.KEYS[sc.key] || T.KEYS.C;
    let title = '';
    if (state.mode === 'compose') title = sc.title || 'نوتة جديدة (بلا اسم)';
    else if (state.mode === 'dictation') title = state.dict.target ? 'إجابتك — ' + state.dict.label : 'الإملاء اللحني';
    else title = sc.title || 'القراءة والتدريب';
    $('#staffTitle').textContent = title;
    $('#staffMeta').textContent = 'سلم ' + key.name + ' · الميزان ' + sc.beats + '/4 · السرعة ♩ = ' + sc.tempo;
    $('#tempo').value = sc.tempo; $('#tempoVal').textContent = sc.tempo;
  }

  function updateToolbar() {
    const editable = isEditable();
    const rhythm = state.read === 'rhythm';
    $('#toolbar').hidden = !editable;
    $('#accGroup').hidden = rhythm;
    const doc = cur();
    const sel = state.selected !== null ? doc.score.notes[state.selected] : null;
    // الأداة الفعالة: إن كانت هناك علامة محددة نعرض قيمتها
    const base = sel ? sel.rhythm.base : state.tool.base;
    const kind = sel ? sel.kind : state.tool.kind;
    const dots = sel ? !!sel.rhythm.dots : state.dot;
    $$('#durTools .tool').forEach(b => b.classList.toggle('active', +b.dataset.base === base));
    $('#tNote').classList.toggle('active', kind === 'note');
    $('#tRest').classList.toggle('active', kind === 'rest');
    $('#tDot').classList.toggle('active', dots);
    $('#tDot').disabled = base === 0.25;
    $('#tTie').classList.toggle('active', !!(sel && sel.tie));
    $('#tTie').disabled = !sel || sel.kind !== 'note';
    const accNow = sel ? (sel.pitch ? sel.pitch.alter : null) : state.acc;
    $$('.tool.acc').forEach(b => { b.classList.toggle('active', accNow !== null && accNow !== undefined && +b.dataset.acc === accNow); b.disabled = !!(sel && (sel.kind !== 'note' || !sel.pitch)); });
    $('#tUndo').disabled = !doc.past.length;
    $('#tRedo').disabled = !doc.future.length;
    $('#tDel').disabled = !doc.score.notes.length;
    $('#tClear').disabled = !doc.score.notes.length;
    const badge = $('#selBadge');
    if (sel) {
      badge.hidden = false;
      const nm = sel.kind === 'rest' ? T.valueName('rest', sel.rhythm) : (sel.pitch ? T.solfegeName(sel.pitch.step, SC.effectiveAlters(doc.score)[state.selected]) + ' — ' + T.valueName('note', sel.rhythm) : 'نغمة بلا موضع — ' + T.valueName('note', sel.rhythm));
      badge.textContent = '✎ تعديل العلامة المحددة: ' + nm + '  (Esc للإلغاء)';
    } else badge.hidden = true;
  }

  // ------------------------------------------------------------------ طريقة القراءة
  function setRead(r) {
    stopPlayback();
    state.read = r;
    $$('.seg-read .seg-btn').forEach(b => { b.classList.toggle('active', b.dataset.read === r); b.setAttribute('aria-checked', b.dataset.read === r); });
    $('#solfegeStyle').hidden = r !== 'solfege';
    $('#swLineWrap').hidden = r !== 'rhythm';
    $('#swLabelsText').textContent = r === 'rhythm' ? 'إظهار مقاطع إيمي باري وأسماء الأشكال' : 'إظهار أسماء النغمات';
    savePrefs();
    if (state.quiz) endQuiz(true);
    render();
    hintForTool();
    if (state.mode === 'dictation' && state.dict.target) {
      $('#dictHint').textContent = r === 'rhythm'
        ? 'القراءة الإيقاعية: ستسمع الإيقاع فقط، ودوِّن القيم الزمنية. التحقق سيقارن الإيقاع فقط ولن يغيّر أي نغمة كتبتها.'
        : 'القراءة الصولفائية: استمع للحن ودوِّن النغمات بمواضعها وأزمنتها. التحقق يقارن النغمة والزمن لكل علامة.';
    }
  }

  function setSolfegeStyle(s) {
    state.solfegeStyle = s;
    $$('#solfegeStyle .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.style === s));
    savePrefs();
  }

  // ------------------------------------------------------------------ الأنشطة
  function setMode(m) {
    stopPlayback();
    if (state.quiz) endQuiz(true);
    state.mode = m;
    state.selected = null;
    $$('.tab').forEach(b => { b.classList.toggle('active', b.dataset.mode === m); b.setAttribute('aria-selected', b.dataset.mode === m); });
    $$('.panel').forEach(p => { p.hidden = p.dataset.panel !== m; });
    $('#feedback').hidden = !(m === 'dictation' && state.dict.statuses);
    $('#solutionWrap').hidden = !(m === 'dictation' && state.dict.solution);
    if (m === 'reading' && !state.reading.piece) loadReadingPiece($('#rPiece').value);
    render();
    hintForTool();
  }

  // ------------------------------------------------------------------ تلميحات الحالة
  function hintForTool() {
    if (!isEditable()) {
      if (state.mode === 'reading') status(state.read === 'rhythm'
        ? 'اقرأ النوتة إيقاعيًا بطريقة إيمي باري مع التصفيق، ثم اضغط «ابدأ القراءة» للمتابعة مع المؤشر.'
        : (state.solfegeStyle === 'spoken' ? 'الصولفيج القرائي: اقرأ أسماء النغمات بصوتك مع المترونوم والمؤشر.' : 'الصولفيج الغنائي: غنِّ أسماء النغمات مع اللحن والمؤشر.'));
      else if (state.mode === 'dictation') status('اضغط «إملاء جديد» للبدء.');
      return;
    }
    const v = T.VALUE_BY_BASE[state.tool.base];
    const nm = (state.tool.kind === 'rest' ? v.rest : v.name) + (state.dot ? ' بوانتيه' : '');
    const d = T.durationOf({ base: state.tool.base, dots: state.dot ? 1 : 0 });
    if (state.read === 'rhythm') status('الأداة: ' + nm + ' (' + T.beatsText(d) + ') — انقر على المدرج لإضافتها. لتغيير زمن علامة موجودة: انقرها ثم اختر القيمة الجديدة (نغمتها لا تتغير).');
    else status('الأداة: ' + nm + ' (' + T.beatsText(d) + ') — انقر على الخط أو المسافة لكتابة النغمة، وانقر نغمة لتحديدها ثم اسحبها لأعلى أو أسفل.');
  }

  // ------------------------------------------------------------------ التفاعل مع المدرج
  function pitchLabel(pitch, idxForAlter) {
    const pos = T.posOf(pitch);
    return T.SOLFEGE[pitch.step] + ' — ' + T.posDescription(pos);
  }

  // ------------------------------------------------------------------ النغمات بلا موضع («؟»)
  // تنشأ فقط من العرض الإيقاعي على خط واحد، وتُحدَّد مواضعها لاحقًا في القراءة الصولفائية
  function unpitchedIdxs(sc) {
    const out = [];
    (sc || cur().score).notes.forEach((n, i) => { if (n.kind === 'note' && !n.pitch) out.push(i); });
    return out;
  }
  function nextUnpitched(after) {
    const list = unpitchedIdxs();
    if (!list.length) return null;
    const nx = list.find(i => i > after);
    return nx !== undefined ? nx : list[0];
  }
  function startFillPitches() {
    const first = nextUnpitched(-1);
    if (first === null) return;
    if (state.read !== 'solfege') setRead('solfege');
    state.selected = first;
    render();
    status('🎯 النغمة المحددة باللون الأزرق بلا موضع: انقر على الخط أو المسافة المناسبة على المدرج (في أي مكان)، وسننتقل للنغمة التالية تلقائيًا.');
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (!isEditable()) {
      // في القراءة: النقر على علامة يسمعها ويبدأ التشغيل منها لاحقًا
      const info = renderer.hitTest(e.clientX, e.clientY);
      if (info && info.noteIdx !== null) {
        previewNote(info.noteIdx);
        if (!state.quiz) { state.selected = state.selected === info.noteIdx ? null : info.noteIdx; render(); }
      }
      return;
    }
    const info = renderer.hitTest(e.clientX, e.clientY);
    if (!info) return;
    const doc = cur();
    e.preventDefault();
    // نغمة محددة بلا موضع: أي نقرة على المدرج تحدد موضعها ثم ننتقل للتالية
    const selN = state.selected !== null ? doc.score.notes[state.selected] : null;
    if (selN && selN.kind === 'note' && !selN.pitch && state.read === 'solfege' && info.inStaff && (info.noteIdx === null || info.noteIdx === state.selected || !!doc.score.notes[info.noteIdx].pitch)) {
      const idx = state.selected;
      const r = doc.setPitch(idx, { step: info.pitch.step, octave: info.pitch.octave, alter: null });
      if (r.error) { status(r.error, 'err'); return; }
      previewNote(idx);
      const nx = nextUnpitched(idx);
      state.selected = nx;
      render();
      status('✔ ' + pitchLabel(doc.score.notes[idx].pitch) + (nx !== null ? ' — والآن حدّد موضع النغمة التالية المحددة.' : ' — اكتملت مواضع كل النغمات 🎉'), 'ok');
      return;
    }
    if (info.noteIdx !== null) {
      const n = doc.score.notes[info.noteIdx];
      const canPitch = state.read === 'solfege' && n.kind === 'note' && !(state.rhythmLine && state.read === 'rhythm');
      if (state.selected === info.noteIdx && canPitch && info.inStaff) {
        movePitch(info.noteIdx, info.pitch, true);
      } else {
        state.selected = info.noteIdx;
        render();
        previewNote(info.noteIdx);
        const sn = doc.score.notes[info.noteIdx];
        if (state.read === 'rhythm') status('✎ حددتَ «' + T.valueName(sn.kind, sn.rhythm) + '». اختر قيمة زمنية جديدة من الأدوات لتغييرها (لن تتغير النغمة). Esc لإلغاء التحديد.');
        else if (sn.kind === 'note' && sn.pitch) status('✎ حددتَ «' + T.SOLFEGE[sn.pitch.step] + '». اسحبها أو انقر موضعًا جديدًا فوقها لتحريكها، أو اختر قيمة/تحويلًا من الأدوات. Esc لإلغاء التحديد.');
      }
      if (canPitch) {
        state.drag = { idx: info.noteIdx, before: doc.snapshot(), lastPos: n.pitch ? T.posOf(n.pitch) : null, pointerId: e.pointerId, moved: false };
        try { $('#staff').setPointerCapture(e.pointerId); } catch (err) { /* لا شيء */ }
      }
      return;
    }
    if (state.selected !== null) { state.selected = null; render(); hintForTool(); if (!info.inStaff) return; }
    if (!info.inStaff) return;
    // الكتابة تتم عند رفع الإصبع/الزر: يرى الطالب المعاينة ويمكنه تعديل الموضع قبل التثبيت
    state.placing = { pointerId: e.pointerId, info };
    try { $('#staff').setPointerCapture(e.pointerId); } catch (err) { /* لا شيء */ }
    showPlacingGhost(info);
  }

  function ghostLabel(info) {
    if (!prefs.hoverNames) return null;
    const b = { base: state.tool.base, dots: state.dot };
    if (state.tool.kind === 'rest') return T.valueName('rest', b);
    if (state.read === 'rhythm' && state.rhythmLine) return T.valueName('note', b);
    if (state.read === 'rhythm') return T.valueName('note', b) + ' — ' + T.SOLFEGE[info.pitch.step];
    return pitchLabel(info.pitch);
  }
  function showPlacingGhost(info) {
    renderer.showGhost({ sys: info.sys, pos: info.pos, insertIndex: info.insertIndex }, { kind: state.tool.kind }, ghostLabel(info));
  }

  function onPointerMove(e) {
    if (!renderer) return;
    if (state.drag) {
      const info = renderer.hitTest(e.clientX, e.clientY);
      if (!info) return;
      const pos = info.pos;
      if (pos !== state.drag.lastPos) {
        state.drag.lastPos = pos; state.drag.moved = true;
        const n = cur().score.notes[state.drag.idx];
        n.pitch = { step: info.pitch.step, octave: info.pitch.octave, alter: n.pitch ? n.pitch.alter : null };
        render();
        previewNote(state.drag.idx, 0.25);
        status('🎵 ' + pitchLabel(n.pitch));
      }
      return;
    }
    if (state.placing) {
      const info = renderer.hitTest(e.clientX, e.clientY);
      if (!info) return;
      // نحافظ على مكان الإدراج الأصلي، ونسمح بتعديل الارتفاع فقط أثناء الضغط
      info.insertIndex = state.placing.info.insertIndex;
      info.sys = state.placing.info.sys;
      state.placing.info = info;
      showPlacingGhost(info);
      return;
    }
    if (!isEditable()) return;
    const info = renderer.hitTest(e.clientX, e.clientY);
    if (!info || !info.inStaff) { renderer.showGhost(null); return; }
    const sc = cur().score;
    if (info.noteIdx !== null) {
      const n = sc.notes[info.noteIdx];
      if (state.selected === info.noteIdx && state.read === 'solfege' && n.kind === 'note') {
        renderer.showGhost({ sys: renderer.noteGeo[info.noteIdx].sys, pos: info.pos, replaceIdx: info.noteIdx }, { kind: 'note' }, prefs.hoverNames ? 'انقل إلى: ' + pitchLabel(info.pitch) : null);
      } else renderer.showGhost(null);
      return;
    }
    const selN = state.selected !== null ? sc.notes[state.selected] : null;
    if (selN && selN.kind === 'note' && !selN.pitch && state.read === 'solfege') {
      renderer.showGhost({ sys: renderer.noteGeo[state.selected].sys, pos: info.pos, replaceIdx: state.selected }, { kind: 'note' }, prefs.hoverNames ? 'الموضع: ' + pitchLabel(info.pitch) : null);
      return;
    }
    if (state.selected !== null) { renderer.showGhost(null); return; }
    showPlacingGhost(info);
  }

  function onPointerUp(e) {
    if (state.placing) {
      const pl = state.placing; state.placing = null;
      try { $('#staff').releasePointerCapture(pl.pointerId); } catch (err) { /* لا شيء */ }
      if (e.type === 'pointercancel') { renderer.showGhost(null); return; }
      const info = renderer.hitTest(e.clientX, e.clientY) || pl.info;
      info.insertIndex = pl.info.insertIndex;
      if (!info.inStaff) { renderer.showGhost(null); status('أُلغيت الكتابة (رفعتَ خارج المدرج).'); return; }
      placeNote(info);
      return;
    }
    if (!state.drag) return;
    const d = state.drag; state.drag = null;
    try { $('#staff').releasePointerCapture(d.pointerId); } catch (err) { /* لا شيء */ }
    const doc = cur();
    if (d.moved && doc.snapshot() !== d.before) {
      // نسجّل السحب كخطوة تراجع واحدة
      doc.past.push(d.before); doc.future = [];
      doc.emit('pitch');
    }
  }

  function movePitch(idx, pitch, announce) {
    const doc = cur();
    const n = doc.score.notes[idx];
    if (n.pitch && n.pitch.step === pitch.step && n.pitch.octave === pitch.octave) return;
    const r = doc.setPitch(idx, { step: pitch.step, octave: pitch.octave });
    if (r.error) { status(r.error, 'err'); return; }
    previewNote(idx);
    if (announce) status('🎵 ' + pitchLabel(doc.score.notes[idx].pitch));
  }

  function placeNote(info) {
    const doc = cur();
    const kind = state.tool.kind;
    const rhythm = { base: state.tool.base, dots: state.dot && state.tool.base > 0.25 ? 1 : 0 };
    let pitch = null;
    if (kind === 'note') {
      // العرض الإيقاعي على خط واحد لا يحمل مواضع، فتبقى النغمة «؟» حتى تُحدَّد في القراءة الصولفائية.
      // أما على المدرج الكامل فتُكتب النغمة حيث نُقر حتى في القراءة الإيقاعية (لا تتغير أي نغمة موجودة).
      if (state.read === 'rhythm' && state.rhythmLine) pitch = null;
      else pitch = { step: info.pitch.step, octave: info.pitch.octave, alter: state.read === 'solfege' ? state.acc : null };
    }
    // في الإملاء: لا نتجاوز عدد موازير التمرين
    if (state.mode === 'dictation' && state.dict.target && info.insertIndex >= doc.score.notes.length) {
      const lay = SC.layout(doc.score);
      const last = lay.measures[lay.lastFilled];
      const capM = SC.layout(state.dict.target).measures.length;
      const d = T.durationOf(rhythm);
      const startsNew = !last || last.full || (last.used + d > lay.cap + 1e-6);
      if (startsNew && lay.lastFilled + 1 >= capM && lay.lastFilled >= 0) {
        status('اكتملت موازير الإملاء (' + capM + '). احذف علامة أو عدّلها إن أردت التغيير.', 'err'); return;
      }
    }
    const note = SC.makeNote(kind, pitch, rhythm);
    const r = doc.insert(info.insertIndex, note);
    if (r.error) { status('⚠️ ' + r.error, 'err'); flashStaff(); renderer.showGhost(null); return; }
    // الأدوات المؤقتة تُستهلك بعد الاستعمال
    if (state.dot) { state.dot = false; }
    if (state.acc !== null) { state.acc = null; }
    const placed = doc.score.notes[r.index];
    const dur = T.beatsText(T.durationOf(placed.rhythm));
    if (state.read === 'rhythm') {
      const lay = SC.layout(doc.score); let syl = '';
      lay.measures.forEach(m => m.items.forEach(it => { if (it.idx === r.index) syl = T.syllableFor(it.start, it.dur, kind === 'rest', false); }));
      status('✔ أضفتَ: ' + T.valueName(kind, placed.rhythm) + ' — ' + dur + ' — تُقرأ «' + syl + '»' + (kind === 'note' && !placed.pitch ? ' (موضعها «؟» يُحدَّد في القراءة الصولفائية)' : ''), 'ok');
    } else if (kind === 'note' && placed.pitch) {
      const al = SC.effectiveAlters(doc.score)[r.index];
      status('✔ كتبتَ: ' + T.solfegeName(placed.pitch.step, al) + ' (' + T.posDescription(T.posOf(placed.pitch)) + ') — ' + T.valueName('note', placed.rhythm) + '، ' + dur, 'ok');
    } else {
      status('✔ أضفتَ: ' + T.valueName(kind, placed.rhythm) + ' — ' + dur, 'ok');
    }
    previewNote(r.index);
  }

  function flashStaff() {
    const s = $('#staffCard'); s.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260 });
  }

  function previewNote(idx, durSec) {
    const sc = cur().score; const n = sc.notes[idx];
    if (!n) return;
    const spb = 60 / sc.tempo;
    const d = durSec || Math.min(1.2, T.durationOf(n.rhythm) * spb * 0.9);
    if (n.kind === 'rest') return;
    if (state.read === 'rhythm' || !n.pitch) { audio.previewHit(Math.min(0.5, d)); return; }
    const al = SC.effectiveAlters(sc)[idx];
    audio.preview(T.midiOf(n.pitch.step, n.pitch.octave, al), d);
  }

  // ------------------------------------------------------------------ أوامر الأدوات
  function selectDuration(base) {
    const doc = cur();
    if (state.selected !== null) {
      const n = doc.score.notes[state.selected];
      const r = doc.setRhythm(state.selected, { base, dots: base === 0.25 ? 0 : n.rhythm.dots });
      if (r.error) { status('⚠️ ' + r.error, 'err'); flashStaff(); return; }
      status('✔ أصبحت القيمة: ' + T.valueName(n.kind, doc.score.notes[state.selected].rhythm) + (n.kind === 'note' && n.pitch ? ' — والنغمة كما هي' : ''), 'ok');
      previewNote(state.selected);
      return;
    }
    state.tool.base = base;
    if (base === 0.25) state.dot = false;
    updateToolbar(); hintForTool();
  }
  function selectKind(kind) {
    const doc = cur();
    if (state.selected !== null) {
      const n = doc.score.notes[state.selected];
      if (n.kind !== kind) {
        const r = doc.setRhythm(state.selected, n.rhythm, kind);
        if (r.error) { status('⚠️ ' + r.error, 'err'); return; }
        status(kind === 'rest' ? '✔ تحولت إلى سكتة (احتُفظ بنغمتها لتعود إن غيّرت رأيك).' : '✔ عادت نغمة.', 'ok');
      }
      return;
    }
    state.tool.kind = kind;
    refreshDurIcons(); updateToolbar(); hintForTool();
  }
  function toggleDot() {
    const doc = cur();
    if (state.selected !== null) {
      const n = doc.score.notes[state.selected];
      const r = doc.setRhythm(state.selected, { base: n.rhythm.base, dots: n.rhythm.dots ? 0 : 1 });
      if (r.error) { status('⚠️ ' + r.error, 'err'); flashStaff(); return; }
      status('✔ ' + T.valueName(n.kind, doc.score.notes[state.selected].rhythm) + ' = ' + T.beatsText(T.durationOf(doc.score.notes[state.selected].rhythm)), 'ok');
      return;
    }
    state.dot = !state.dot; updateToolbar(); hintForTool();
  }
  function toggleAcc(a) {
    const doc = cur();
    if (state.selected !== null) {
      const r = doc.setAccidental(state.selected, a);
      if (r.error) { status('⚠️ ' + r.error, 'err'); return; }
      previewNote(state.selected);
      const n = doc.score.notes[state.selected];
      status(n.pitch.alter === null ? '✔ أُزيلت علامة التحويل.' : '✔ ' + T.solfegeName(n.pitch.step, n.pitch.alter) + ' (' + T.ACC_NAME[n.pitch.alter] + ')', 'ok');
      return;
    }
    state.acc = state.acc === a ? null : a;
    updateToolbar();
    status(state.acc === null ? 'أُلغيت علامة التحويل.' : 'ستُكتب النغمة التالية بعلامة ' + T.ACC_NAME[state.acc] + ' ' + T.ACC_SIGN[state.acc] + '.');
  }
  function toggleTie() {
    if (state.selected === null) return;
    const r = cur().toggleTie(state.selected);
    if (r.error) status('⚠️ ' + r.error, 'err'); else status('✔ تم تعديل الرباط الزمني.', 'ok');
  }
  function deleteNote() {
    const doc = cur();
    if (!doc.score.notes.length) return;
    const idx = state.selected !== null ? state.selected : doc.score.notes.length - 1;
    doc.remove(idx);
    state.selected = state.selected !== null && doc.score.notes.length ? Math.min(idx, doc.score.notes.length - 1) : null;
    if (state.selected !== null) render();
    status('🗑️ حُذفت العلامة.');
  }
  function clearAll() {
    const doc = cur();
    if (!doc.score.notes.length) return;
    confirmBox('تفريغ المدرج', 'سيُمسح كل ما على المدرج. يمكنك التراجع بعدها بزر «تراجع».', 'تفريغ', () => { doc.clear(); state.selected = null; render(); status('🧹 فُرِّغ المدرج.'); });
  }

  // ------------------------------------------------------------------ علامات المازورة
  function openMarks() {
    const doc = cur();
    const lay = SC.layout(doc.score);
    let mi;
    if (state.selected !== null) { lay.measures.forEach(m => m.items.forEach(it => { if (it.idx === state.selected) mi = m.index; })); }
    if (mi === undefined) mi = Math.max(0, lay.lastFilled);
    const mk = doc.score.marks[mi] || {};
    const body = h('div');
    body.appendChild(h('p', null, 'تُطبَّق على <b>المازورة ' + (mi + 1) + '</b> (حدّد نغمة داخل مازورة أخرى لتغييرها).'));
    const grid = h('div', { class: 'marks-grid' });
    const mkBtn = (label, on, fn) => { const b = h('button', { class: 'btn' + (on ? ' on' : '') }, label); b.onclick = () => { fn(); closeModal(); }; grid.appendChild(b); };
    mkBtn('‖: بداية إعادة', mk.repeatStart, () => doc.setMark(mi, { repeatStart: !mk.repeatStart }));
    mkBtn(':‖ نهاية إعادة', mk.repeatEnd, () => doc.setMark(mi, { repeatEnd: !mk.repeatEnd }));
    ['Fine', 'D.C.', 'D.C. al Fine', 'D.S.', 'D.S. al Fine', 'D.S. al Coda', 'To Coda', '𝄋', '𝄌'].forEach(t => {
      mkBtn(t, mk.text === t, () => doc.setMark(mi, { text: mk.text === t ? '' : t }));
    });
    body.appendChild(grid);
    body.appendChild(h('div', { class: 'note' }, 'علامتا الإعادة ‖: و :‖ تُعزفان فعليًا عند التشغيل. أما Fine وD.C. وD.S. والسينيو والكودا فتُكتب على المدرج للقراءة والشرح فقط.'));
    modal('علامات الإعادة والقفز', body, [{ label: 'إغلاق' }]);
  }

  // ------------------------------------------------------------------ التشغيل
  function buildPlayback(score, o) {
    o = o || {};
    const pe = SC.playbackEvents(score);
    const spb = 60 / score.tempo;
    let evs = pe.events;
    if (!evs.length) return null;
    let startT = 0, endT = pe.total;
    if (o.measures) {
      const set = new Set(o.measures);
      const sel = evs.filter(e => set.has(e.measure) && e.orderPos === evs.find(x => x.measure === e.measure).orderPos);
      if (!sel.length) return null;
      startT = Math.min(...sel.map(e => e.t)); endT = Math.max(...sel.map(e => e.t + e.dur));
      evs = sel;
    } else if (o.fromIdx !== null && o.fromIdx !== undefined) {
      const first = evs.find(e => e.idx >= o.fromIdx);
      if (first) { startT = first.t; evs = evs.filter(e => e.t >= startT - 1e-6); }
    }
    const read = o.read || state.read;
    const style = o.style || state.solfegeStyle;
    const spoken = read === 'solfege' && style === 'spoken';
    const metro = o.metro !== undefined ? o.metro : (state.metro || spoken);
    const countIn = o.countIn !== undefined ? o.countIn : (prefs.countIn && (metro || o.forceCountIn));
    const cap = pe.cap;
    const lead = countIn ? cap : 0;
    const items = [];
    if (countIn) for (let b = 0; b < cap; b++) items.push({ time: b * spb, type: 'click', accent: b === 0 });
    evs.forEach(e => {
      const time = (e.t - startT + lead) * spb;
      const dur = e.dur * spb;
      const it = { time, ref: e.idx };
      if (!e.silent && e.kind === 'note') {
        if (read === 'rhythm' || !e.pitched) Object.assign(it, { type: 'hit', dur: (e.idxs.length > 1 ? e.dur : e.dur) * spb });
        else if (!spoken) Object.assign(it, { type: 'note', midi: e.midi, dur: dur });
      }
      items.push(it);
    });
    if (metro) {
      // نقرات على الوحدات الزمنية مضبوطة على شبكة الموازير
      const first = Math.ceil(startT - 1e-6), last = endT;
      for (let b = first; b < last - 1e-6; b++) {
        const local = ((b % cap) + cap) % cap;
        items.push({ time: (b - startT + lead) * spb, type: 'click', accent: local === 0 });
      }
    }
    items.sort((a, b) => a.time - b.time);
    return { items, total: (endT - startT + lead) * spb };
  }

  function startPlayback(score, o) {
    o = o || {};
    stopPlayback();
    const pb = buildPlayback(score, o);
    if (!pb) { status('المدرج فارغ — لا يوجد ما يُشغَّل.', 'err'); return false; }
    const r = o.renderer || renderer;
    const btn = o.button || $('#btnPlay');
    const playLabel = btn.dataset.label || btn.innerHTML;
    btn.dataset.label = playLabel;
    btn.innerHTML = '⏹️ إيقاف'; btn.classList.add('stop');
    state.playBtn = btn;
    audio.play(pb.items, {
      total: pb.total,
      loop: o.loop !== undefined ? o.loop : state.loop,
      onEvent: (ref) => {
        if (o.silentVisual) return;
        const geo = r.setPlaying(ref);
        if (geo && geo.g) {
          const rc = geo.g.getBoundingClientRect();
          if (rc.top < 60 || rc.bottom > window.innerHeight - 40) geo.g.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      },
      onEnd: () => {
        r.setPlaying(null);
        if (btn.dataset.label) { btn.innerHTML = btn.dataset.label; }
        btn.classList.remove('stop');
        state.playBtn = null;
        o.onEnd && o.onEnd();
      },
    });
    return true;
  }
  function stopPlayback() { if (audio.isPlaying()) audio.stop(); }
  // أي تعديل أثناء التشغيل يوقفه، حتى لا يتابع المؤشر نوتة تغيّرت
  function stopIfEditing(mode) {
    if (audio.isPlaying() && state.mode === mode && state.playBtn !== $('#btnListen')) { stopPlayback(); toast('⏹️ أُوقف التشغيل لأنك عدّلت النوتة — اضغط «تشغيل» لسماعها بعد التعديل.'); }
  }

  function togglePlay() {
    if (audio.isPlaying()) { stopPlayback(); return; }
    audio.ensure();
    const sc = cur().score;
    const from = state.selected;
    startPlayback(sc, { fromIdx: from });
  }

  // ------------------------------------------------------------------ التأليف: الحفظ والاستيراد
  function markDirty() {
    if (state.mode !== 'compose') return;
    state.dirty = true; updateSaveState();
  }
  function updateSaveState() {
    const el = $('#saveState');
    if (!ST.available()) { el.className = 'save-state dirty'; el.textContent = '⚠️ الحفظ داخل المتصفح غير متاح هنا (ربما وضع التصفح الخاص). استخدم «تصدير ملف» للاحتفاظ بعملك.'; return; }
    if (!docs.compose.score.notes.length && !state.libId) { el.className = 'save-state'; el.textContent = 'تُحفظ مسودتك تلقائيًا في هذا المتصفح، واضغط «حفظ» لإضافتها إلى «نوتاتي» باسم واضح.'; return; }
    if (state.dirty || !state.libId) { el.className = 'save-state dirty'; el.textContent = state.libId ? '● تعديلات غير محفوظة على «' + state.libName + '» (المسودة محفوظة تلقائيًا).' : '● نوتة غير محفوظة في «نوتاتي» بعد (المسودة محفوظة تلقائيًا).'; return; }
    el.className = 'save-state saved';
    el.textContent = '✔ محفوظة في «نوتاتي» على هذا المتصفح باسم «' + state.libName + '»' + (state.lastSavedAt ? ' — ' + state.lastSavedAt : '') + '. للنقل إلى جهاز آخر استخدم «تصدير ملف».';
  }

  let draftTimer = null;
  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => ST.saveDraft(docs.compose.score, { libId: state.libId, libName: state.libName, dirty: state.dirty }), 350);
  }

  function doSave(name, overwriteId) {
    const sc = docs.compose.score;
    if (!sc.notes.length) { toast('المدرج فارغ — دوّن بعض النغمات قبل الحفظ.', 'err'); return; }
    const r = ST.save(name, sc, overwriteId);
    if (r.error) { toast(r.error, 'err'); return; }
    sc.title = r.name;
    $('#scoreTitle').value = r.name;
    state.libId = r.id; state.libName = r.name; state.dirty = false;
    state.lastSavedAt = new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    updateSaveState(); updateHead(); scheduleDraft();
    toast('✔ حُفظت «' + r.name + '» في نوتاتي.', 'ok');
  }

  function save() {
    const name = $('#scoreTitle').value.trim();
    if (!name) { askName('حفظ النوتة', '', n => save2(n)); return; }
    save2(name);
  }
  function save2(name) {
    // نفس النوتة المفتوحة وبنفس الاسم → تحديث
    if (state.libId && name === state.libName) return doSave(name, state.libId);
    const clash = ST.list().find(x => x.name.trim() === name.trim());
    if (clash) {
      modal('الاسم مستخدم', '<p>توجد نوتة محفوظة باسم «' + esc(name) + '». ماذا تريد؟</p>', [
        { label: 'استبدالها بهذه النوتة', primary: true, run: () => doSave(name, clash.id) },
        { label: 'الحفظ باسم آخر', run: () => askName('حفظ باسم آخر', name + ' (2)', n => save2(n)) },
        { label: 'إلغاء' },
      ]);
      return;
    }
    doSave(name, null);
  }
  function askName(title, def, cb) {
    const body = h('div');
    const inp = h('input', { type: 'text', maxlength: '60', class: 'name-field', placeholder: 'مثال: تمرين المازورتين الأولى والثانية' });
    inp.value = def || '';
    inp.style.cssText = 'width:100%;min-height:48px;font-size:1.1rem;padding:8px 12px;border:2px solid #dbe3ef;border-radius:12px';
    body.appendChild(h('label', { class: 'field' }, '<span>اسم النوتة</span>'));
    body.firstChild.appendChild(inp);
    const go = () => { const v = inp.value.trim(); if (!v) { inp.style.borderColor = '#dc2626'; return; } closeModal(); cb(v); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    modal(title, body, [{ label: 'حفظ', primary: true, keepOpen: true, run: go }, { label: 'إلغاء' }]);
  }

  function guardDirty(action, label) {
    if (!state.dirty || !docs.compose.score.notes.length) return action();
    modal('تعديلات غير محفوظة', '<p>في المدرج نوتة لم تُحفظ في «نوتاتي». ' + (label || '') + '</p>', [
      { label: '💾 احفظها أولًا', primary: true, run: () => { const n = $('#scoreTitle').value.trim(); if (n) { save2(n); if (!state.dirty) action(); } else askName('حفظ النوتة', '', nm => { save2(nm); if (!state.dirty) action(); }); } },
      { label: 'المتابعة دون حفظ', run: action },
      { label: 'إلغاء' },
    ]);
  }

  function loadIntoCompose(score, meta) {
    stopPlayback();
    docs.compose.load(score, 'load');
    state.libId = meta && meta.libId || null;
    state.libName = meta && meta.libName || '';
    state.dirty = !!(meta && meta.dirty);
    state.selected = null;
    $('#scoreTitle').value = score.title || '';
    if (state.mode !== 'compose') setMode('compose'); else render();
    updateSaveState();
  }

  function newScore() {
    guardDirty(() => {
      const s = SC.emptyScore({ title: '', key: docs.compose.score.key, beats: docs.compose.score.beats, tempo: docs.compose.score.tempo, minMeasures: 4 });
      loadIntoCompose(s, null);
      ST.clearDraft();
      status('📄 نوتة جديدة — اختر القيمة الزمنية وانقر على المدرج.');
    }, 'هل تريد بدء نوتة جديدة؟');
  }

  function openLibrary() {
    const items = ST.list();
    const body = h('div');
    if (!ST.available()) body.appendChild(h('div', { class: 'note' }, '⚠️ الحفظ داخل هذا المتصفح غير متاح. يمكنك استخدام «تصدير ملف» و«استيراد ملف».'));
    if (!items.length) body.appendChild(h('div', { class: 'lib-empty' }, 'لا توجد نوتات محفوظة بعد. دوّن نوتة ثم اضغط «💾 حفظ».'));
    const ul = h('ul', { class: 'lib-list' });
    items.forEach(it => {
      const li = h('li', { class: 'lib-item' });
      const when = it.updatedAt ? new Date(it.updatedAt).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }) : '';
      li.appendChild(h('div', { class: 'lib-name' }, esc(it.name) + '<span class="lib-meta">' + it.notes + ' علامة · ' + esc(when) + (it.id === state.libId ? ' · مفتوحة الآن' : '') + '</span>'));
      const bOpen = h('button', { class: 'btn btn-primary' }, 'فتح');
      bOpen.onclick = () => guardDirty(() => {
        const r = ST.load(it.id);
        if (r.error) { toast(r.error, 'err'); return; }
        closeModal();
        loadIntoCompose(r.score, { libId: r.id, libName: r.name });
        toast('📂 فُتحت «' + r.name + '». عدّلها ثم اضغط «حفظ» لحفظ التعديلات.', 'ok');
        if (r.warnings.length) setTimeout(() => toast(r.warnings.join(' '), 'err'), 1200);
      }, 'هل تريد فتح «' + esc(it.name) + '» مكانها؟');
      const bFile = h('button', { class: 'btn', title: 'تصدير كملف' }, '⬇️');
      bFile.onclick = () => { const r = ST.load(it.id); if (r.error) return toast(r.error, 'err'); ST.exportFile(r.score, r.name); };
      const bRen = h('button', { class: 'btn', title: 'إعادة تسمية' }, '✏️');
      bRen.onclick = () => askName('إعادة التسمية', it.name, n => {
        if (ST.nameExists(n, it.id)) { toast('يوجد اسم مطابق بالفعل.', 'err'); return; }
        const r = ST.rename(it.id, n); if (r.error) return toast(r.error, 'err');
        if (state.libId === it.id) { state.libName = n; docs.compose.score.title = n; $('#scoreTitle').value = n; updateSaveState(); updateHead(); }
        openLibrary();
      });
      const bDel = h('button', { class: 'btn', title: 'حذف' }, '🗑️');
      bDel.onclick = () => confirmBox('حذف نوتة', 'هل تريد حذف «' + esc(it.name) + '» من نوتاتي نهائيًا؟', 'حذف', () => {
        ST.remove(it.id);
        if (state.libId === it.id) { state.libId = null; state.dirty = true; updateSaveState(); }
        openLibrary(); fillReadingPieces();
      });
      [bOpen, bFile, bRen, bDel].forEach(b => li.appendChild(b));
      ul.appendChild(li);
    });
    body.appendChild(ul);
    body.appendChild(h('div', { class: 'note' }, '📌 «نوتاتي» محفوظة في هذا المتصفح على هذا الجهاز فقط، وليست في حسابك على المنصة. لنقل نوتة إلى جهاز آخر صدّرها كملف ثم استوردها هناك.'));
    modal('📂 نوتاتي', body, [{ label: 'إغلاق' }]);
  }

  async function importFile(file) {
    const r = await ST.readFile(file);
    $('#fileInput').value = '';
    if (r.error) { toast('⚠️ لم يُستورد الملف: ' + r.error + ' (عملك الحالي لم يتغير).', 'err', null, 7000); return; }
    guardDirty(() => {
      loadIntoCompose(r.score, { libId: null, libName: '', dirty: true });
      toast('⬆️ استُوردت «' + r.score.title + '» (' + r.score.notes.length + ' علامة). يمكنك تعديلها ثم حفظها.', 'ok');
      if (r.warnings.length) setTimeout(() => toast(r.warnings.join(' '), 'err'), 1500);
    }, 'هل تريد استبدالها بالملف المستورد؟');
  }

  function exportCurrent() {
    const sc = docs.compose.score;
    if (!sc.notes.length) { toast('المدرج فارغ — لا يوجد ما يُصدَّر.', 'err'); return; }
    const name = $('#scoreTitle').value.trim() || 'نوتة';
    const r = ST.exportFile(sc, name);
    toast('⬇️ نُزِّل الملف «' + r.fileName + '». يمكن استيراده لاحقًا على أي جهاز.', 'ok');
  }

  function scoreSettings() {
    const sc = docs.compose.score;
    const body = h('div');
    const grid = h('div', { class: 'form-grid' });
    const keySel = h('select'); Object.keys(T.KEYS).forEach(k => keySel.appendChild(h('option', { value: k }, T.KEYS[k].name))); keySel.value = sc.key;
    const beatSel = h('select'); [2, 3, 4].forEach(b => beatSel.appendChild(h('option', { value: b }, b + '/4'))); beatSel.value = sc.beats;
    const mSel = h('select'); [1, 2, 3, 4, 6, 8, 12, 16].forEach(b => mSel.appendChild(h('option', { value: b }, b))); mSel.value = [1, 2, 3, 4, 6, 8, 12, 16].includes(sc.minMeasures) ? sc.minMeasures : 4;
    const f = (lbl, el) => { const l = h('label', { class: 'field' }, '<span>' + lbl + '</span>'); l.appendChild(el); grid.appendChild(l); };
    f('السلم الموسيقي', keySel); f('الميزان', beatSel); f('عدد الموازير الظاهرة', mSel);
    body.appendChild(grid);
    body.appendChild(h('div', { class: 'note' }, 'تغيير الميزان لا يحذف أي علامة: تُعاد قسمة الموازير تلقائيًا، وما لا يكتمل زمنه يظهر بالبرتقالي لتصحيحه. ويمكن التراجع دائمًا.'));
    modal('🎚️ السلم والميزان', body, [{ label: 'تطبيق', primary: true, run: () => {
      docs.compose.setMeta({ key: keySel.value, beats: +beatSel.value, minMeasures: +mSel.value });
      render();
    } }, { label: 'إلغاء' }]);
  }

  // ------------------------------------------------------------------ الإملاء اللحني
  function fillDictationControls() {
    const lv = $('#dLevel'); lv.textContent = '';
    Object.keys(EX.LEVELS).forEach(k => lv.appendChild(h('option', { value: k }, EX.LEVELS[k].name)));
    const ky = $('#dKey'); ky.textContent = '';
    ['C', 'G', 'F'].forEach(k => ky.appendChild(h('option', { value: k }, T.KEYS[k].name)));
    const src = $('#dSource'); src.textContent = '';
    src.appendChild(h('option', { value: 'gen' }, '🎲 لحن جديد حسب المستوى'));
    const mine = h('optgroup', { label: 'من عمل المعلم' });
    mine.appendChild(h('option', { value: 'compose' }, '✍️ النوتة الحالية في التأليف (كاملة)'));
    ST.list().forEach(it => mine.appendChild(h('option', { value: 'lib:' + it.id }, '📂 ' + it.name)));
    src.appendChild(mine);
    EX.LESSONS.forEach(L => {
      const og = h('optgroup', { label: 'من الدروس — الصف ' + ['', '', '', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع'][L.grade] + ': ' + L.title });
      const total = SC.layout(EX.lessonScore(L.id)).measures.length;
      for (let a = 0; a < total; a += 2) og.appendChild(h('option', { value: L.id + ':' + a + ':2' }, 'المازورتان ' + (a + 1) + ' و' + (a + 2)));
      og.appendChild(h('option', { value: L.id + ':0:' + total }, 'المقطوعة كاملة (' + total + ' موازير)'));
      src.appendChild(og);
    });
    src.onchange = () => {
      const gen = src.value === 'gen';
      ['#dLevel', '#dKey', '#dBeats', '#dMeasures'].forEach(s => { $(s).disabled = !gen; });
    };
  }

  // تحديث قائمة «من عمل المعلم» عند فتحها (قد تكون حُفظت نوتات جديدة)
  function refreshDictSources() {
    const src = $('#dSource'); const v = src.value;
    const og = $$('optgroup', src).find(g => g.label === 'من عمل المعلم');
    if (!og) return;
    $$('option', og).forEach(o => { if (o.value.startsWith('lib:')) o.remove(); });
    ST.list().forEach(it => og.appendChild(h('option', { value: 'lib:' + it.id }, '📂 ' + it.name)));
    if ($$('option', src).some(o => o.value === v)) src.value = v;
  }

  function sliceScore(s, from, count) {
    const lay = SC.layout(s);
    const keep = [];
    lay.measures.forEach(m => { if (m.index >= from && m.index < from + count) m.items.forEach(it => keep.push(SC.makeNote(it.note.kind, it.note.pitch, it.note.rhythm, { tie: !!it.note.tie }))); });
    if (keep.length) keep[keep.length - 1].tie = false;
    const out = Object.assign({}, s, { notes: keep, marks: {}, minMeasures: count });
    return out;
  }

  function newDictation() {
    stopPlayback();
    const src = $('#dSource').value;
    let target, label;
    if (src === 'compose' || src.startsWith('lib:')) {
      let s0;
      if (src === 'compose') s0 = SC.clone(docs.compose.score);
      else { const r = ST.load(src.slice(4)); if (r.error) { toast(r.error, 'err'); return; } s0 = r.score; }
      s0.notes = s0.notes.filter(n => !(n.kind === 'note' && !n.pitch));
      if (!s0.notes.length) { toast('النوتة المختارة فارغة أو بلا نغمات محددة المواضع. اكتب لحنًا في «التأليف» أولًا.', 'err'); return; }
      target = s0; target.marks = {};
      label = s0.title || 'نوتة المعلم';
    } else if (src === 'gen') {
      target = EX.generate({ level: +$('#dLevel').value, key: $('#dKey').value, beats: +$('#dBeats').value, measures: +$('#dMeasures').value, tempo: docs.dictation.score.tempo || 70 });
      label = EX.LEVELS[$('#dLevel').value].name.split(' — ')[0];
    } else {
      const [id, a, c] = src.split(':');
      const full = EX.lessonScore(id);
      target = sliceScore(full, +a, +c);
      const L = EX.LESSONS.find(x => x.id === id);
      label = L.title + ' — ' + (+c === 2 ? 'المازورتان ' + (+a + 1) + ' و' + (+a + 2) : 'كاملة');
    }
    target.minMeasures = SC.layout(target).measures.length;
    state.dict = { target, listens: 0, statuses: null, measureStatus: null, solution: false, label, best: 0, perfectCounted: false };
    const student = SC.emptyScore({ key: target.key, beats: target.beats, tempo: target.tempo, minMeasures: target.minMeasures, title: 'إجابتي' });
    if (prefs.firstNoteHint) {
      const f = target.notes[0];
      student.notes.push(SC.makeNote(f.kind, f.pitch, f.rhythm));
    }
    docs.dictation.load(student, 'load');
    state.selected = null;
    $('#dictActions').hidden = false;
    $('#feedback').hidden = true;
    $('#solutionWrap').hidden = true;
    $('#listenCount').textContent = '0';
    // اختيار الجزء المسموع
    const part = $('#dPart'); part.textContent = '';
    part.appendChild(h('option', { value: 'all' }, 'الإملاء كاملًا'));
    for (let i = 0; i < target.minMeasures; i++) part.appendChild(h('option', { value: i }, 'المازورة ' + (i + 1) + ' فقط'));
    setRead(state.read);
    render();
    status(prefs.firstNoteHint ? '🎧 استمع للإملاء ثم دوّنه. كُتبت العلامة الأولى لمساعدتك.' : '🎧 استمع للإملاء ثم دوّنه على المدرج.');
    setTimeout(() => listenDictation(), 350);
  }

  function listenDictation() {
    const t = state.dict.target;
    if (!t) return;
    audio.ensure();
    if (audio.isPlaying()) { stopPlayback(); return; }
    t.tempo = docs.dictation.score.tempo;
    const part = $('#dPart').value;
    const ok = startPlayback(t, {
      measures: part === 'all' ? null : [+part], forceCountIn: true, countIn: true, metro: state.metro,
      silentVisual: true, button: $('#btnListen'), loop: false,
    });
    if (ok) { state.dict.listens++; $('#listenCount').textContent = state.dict.listens; }
  }

  function playTonic() {
    const t = state.dict.target || cur().score;
    const key = T.KEYS[t.key] || T.KEYS.C;
    const m = T.midiOf(key.tonic, 4, key.tonicAlter || 0);
    audio.ensure();
    const spb = 0.42;
    audio.play([{ time: 0, type: 'note', midi: m, dur: spb }, { time: spb, type: 'note', midi: m + 4, dur: spb }, { time: 2 * spb, type: 'note', midi: m + 7, dur: spb }, { time: 3 * spb, type: 'note', midi: m, dur: spb * 2 }], { total: 5 * spb });
    status('🎵 نغمة القرار: ' + T.solfegeName(key.tonic, key.tonicAlter || 0) + ' (مع أربيج السلم: ' + T.SOLFEGE[key.tonic] + ' – ' + T.SOLFEGE[T.STEPS[(T.STEPS.indexOf(key.tonic) + 2) % 7]] + ' – ' + T.SOLFEGE[T.STEPS[(T.STEPS.indexOf(key.tonic) + 4) % 7]] + ')');
  }

  function checkDictation() {
    const target = state.dict.target;
    if (!target) return;
    const student = docs.dictation.score;
    if (!student.notes.length) { status('المدرج فارغ — دوّن الإملاء أولًا.', 'err'); return; }
    const pitchMode = state.read === 'solfege';
    const ta = SC.effectiveAlters(target), sa = SC.effectiveAlters(student);
    const tl = SC.layout(target), sl = SC.layout(student);
    const mOf = (lay) => { const o = {}; lay.measures.forEach(m => m.items.forEach(it => { o[it.idx] = m.index; })); return o; };
    const sm = mOf(sl);
    const statuses = {};
    const msgs = [];
    let pitchOk = 0, rhythmOk = 0, pitchTotal = 0;
    const n = Math.max(target.notes.length, student.notes.length);
    for (let i = 0; i < n; i++) {
      const t = target.notes[i], s = student.notes[i];
      if (!s) continue;
      if (!t) { statuses[i] = 'extra'; continue; }
      const rOk = s.kind === t.kind && Math.abs(T.durationOf(s.rhythm) - T.durationOf(t.rhythm)) < 1e-6;
      let pOk = true;
      if (pitchMode && t.kind === 'note') {
        pitchTotal++;
        pOk = s.kind === 'note' && !!s.pitch && s.pitch.step === t.pitch.step && s.pitch.octave === t.pitch.octave && sa[i] === ta[i];
        if (pOk) pitchOk++;
      } else if (pitchMode && t.kind === 'rest') { pitchTotal++; pOk = s.kind === 'rest'; if (pOk) pitchOk++; }
      if (rOk) rhythmOk++;
      statuses[i] = pOk && rOk ? 'ok' : (!pOk && !rOk ? 'wrong' : (!pOk ? 'pitch' : 'rhythm'));
      if (msgs.length < 5 && !(pOk && rOk)) {
        const where = 'العلامة ' + (i + 1) + ' (المازورة ' + (sm[i] + 1) + '): ';
        if (!pOk && t.kind === 'note' && s.kind === 'note' && s.pitch) {
          const diff = T.diatonic(t.pitch.step, t.pitch.octave) - T.diatonic(s.pitch.step, s.pitch.octave);
          const dir = diff > 0 ? 'أعلى' : 'أخفض';
          const dist = Math.abs(diff);
          const words = ['', 'بدرجة واحدة', 'بدرجتين', 'بثلاث درجات', 'بأربع درجات', 'بخمس درجات', 'بست درجات', 'بأوكتاف'];
          if (diff === 0) msgs.push(where + 'الاسم صحيح لكن علامة التحويل مختلفة: الصحيح «' + T.solfegeName(t.pitch.step, ta[i]) + '».');
          else msgs.push(where + 'كتبتَ «' + T.solfegeName(s.pitch.step, sa[i]) + '»، والنغمة الصحيحة ' + dir + ' ' + (words[dist] || ('بـ' + dist + ' درجات')) + '.');
        } else if (!pOk && t.kind === 'note' && s.kind === 'note' && !s.pitch) {
          msgs.push(where + 'لم تحدّد موضع هذه النغمة على المدرج بعد.');
        } else if (!pOk) {
          msgs.push(where + (t.kind === 'rest' ? 'هنا سكتة وليست نغمة.' : 'هنا نغمة وليست سكتة.'));
        }
        if (!rOk && s.kind === t.kind) msgs.push(where + 'القيمة الصحيحة «' + T.valueName(t.kind, t.rhythm) + '» (' + T.beatsText(T.durationOf(t.rhythm)) + ') وليست «' + T.valueName(s.kind, s.rhythm) + '».');
      }
    }
    const missing = Math.max(0, target.notes.length - student.notes.length);
    const extra = Math.max(0, student.notes.length - target.notes.length);
    // حالة كل مازورة
    const measureStatus = {};
    sl.measures.forEach(m => {
      if (!m.items.length) return;
      measureStatus[m.index] = m.items.every(it => statuses[it.idx] === 'ok') && m.full ? 'ok' : 'bad';
    });
    state.dict.statuses = statuses;
    state.dict.measureStatus = measureStatus;
    const total = target.notes.length;
    const pPct = pitchMode ? Math.round(100 * pitchOk / Math.max(1, pitchTotal)) : null;
    const rPct = Math.round(100 * rhythmOk / Math.max(1, total));
    const perfect = missing === 0 && extra === 0 && Object.values(statuses).every(s => s === 'ok') && student.notes.length === total;
    // النقاط
    const raw = Math.round(((pitchMode ? pPct * 0.6 : 0) + rPct * (pitchMode ? 0.4 : 1)) / 2) + (perfect ? 25 : 0);
    // النقاط تُحتسب لتحسّن النتيجة فقط، فلا يزيد الرصيد بتكرار «تحقق» على الإجابة نفسها
    const best = state.dict.best || 0;
    const pts = Math.max(0, raw - best);
    state.dict.best = Math.max(best, raw);
    state.player.xp += pts;
    if (perfect && !state.dict.perfectCounted) { state.player.ok++; state.dict.perfectCounted = true; }
    updatePlayer(); savePrefs();
    // العرض
    const fb = $('#feedback'); fb.hidden = false; fb.textContent = '';
    const head = perfect ? '🌟 ممتاز! إملاء صحيح بالكامل' : (rPct >= 70 && (pPct === null || pPct >= 70) ? '👏 أحسنت — بقيت تفاصيل قليلة' : '💪 حاول مرة أخرى بعد الاستماع');
    fb.appendChild(h('h3', null, head + ' <small style="color:#64748b">' + (pts ? '(+' + pts + ' نقطة)' : '(لا نقاط إضافية: هذه ليست أفضل من محاولتك السابقة)') + '</small>'));
    const bars = h('div', { class: 'score-bars' });
    const bar = (label, okN, totN, pct) => {
      const cls = pct >= 85 ? '' : pct >= 60 ? 'mid' : 'low';
      const b = h('div', { class: 'bar' }, '<div class="bar-top"><span>' + label + '</span><span>' + okN + ' / ' + totN + '</span></div><div class="bar-track"><div class="bar-fill ' + cls + '" style="width:0"></div></div>');
      bars.appendChild(b); setTimeout(() => { b.querySelector('.bar-fill').style.width = pct + '%'; }, 30);
    };
    if (pitchMode) bar('🎼 النغمات الصحيحة', pitchOk, pitchTotal, pPct);
    bar('🥁 الأزمنة الصحيحة', rhythmOk, total, rPct);
    fb.appendChild(bars);
    const ul = h('ul');
    if (missing) msgs.push('ينقص ' + missing + ' ' + (missing === 1 ? 'علامة' : 'علامات') + ' في آخر الإملاء.');
    if (extra) msgs.push('كتبتَ ' + extra + ' ' + (extra === 1 ? 'علامة زائدة' : 'علامات زائدة') + ' (باللون البنفسجي).');
    if (sl.measures.some(m => m.incomplete)) msgs.push('توجد مازورة زمنها غير مكتمل (مظللة بالبرتقالي): راجع مجموع الأزمنة فيها.');
    if (!pitchMode) msgs.push('هذا تحقق إيقاعي فقط: لم تُقارَن النغمات، ولم يتغير أي منها.');
    msgs.forEach(m => ul.appendChild(h('li', null, esc(m))));
    if (msgs.length) fb.appendChild(ul);
    fb.appendChild(h('div', { class: 'legend' }, '<span><i style="background:#059669"></i>صحيحة</span>' + (pitchMode ? '<span><i style="background:#dc2626"></i>النغمة خطأ</span>' : '') + '<span><i style="background:#d97706"></i>الزمن خطأ</span><span><i style="background:#9333ea"></i>زائدة</span>'));
    render();
    if (perfect) celebrate();
    status(perfect ? '🌟 إجابة كاملة!' : 'راجع العلامات الملونة، ويمكنك تعديلها ثم التحقق مجددًا.', perfect ? 'ok' : '');
  }

  function showSolution() {
    const t = state.dict.target; if (!t) return;
    state.dict.solution = !state.dict.solution;
    $('#solutionWrap').hidden = !state.dict.solution;
    $('#btnSolution').textContent = state.dict.solution ? '🙈 إخفاء الحل' : '👁️ أظهر الحل';
    if (state.dict.solution) {
      solutionRenderer.render(t, { labels: state.read === 'rhythm' ? 'rhythm' : 'solfege', measureNumbers: prefs.measureNumbers, rhythmLine: state.read === 'rhythm' && state.rhythmLine });
      $('#solutionWrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function retryDictation() {
    const t = state.dict.target; if (!t) return;
    const student = SC.emptyScore({ key: t.key, beats: t.beats, tempo: t.tempo, minMeasures: t.minMeasures, title: 'إجابتي' });
    if (prefs.firstNoteHint) student.notes.push(SC.makeNote(t.notes[0].kind, t.notes[0].pitch, t.notes[0].rhythm));
    docs.dictation.load(student, 'load');
    state.dict.statuses = null; state.dict.measureStatus = null;
    $('#feedback').hidden = true;
    if (state.dict.solution) showSolution();
    state.selected = null; render();
    status('↺ مُسح المدرج. استمع مرة أخرى ثم دوّن.');
  }

  // ------------------------------------------------------------------ القراءة والتدريب
  function fillReadingPieces() {
    const sel = $('#rPiece'); const prev = sel.value; sel.textContent = '';
    const og1 = h('optgroup', { label: 'نماذج من أدلة المعلم' });
    EX.LESSONS.forEach(L => og1.appendChild(h('option', { value: 'lesson:' + L.id }, 'الصف ' + ['', '', '', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع'][L.grade] + ' — ' + L.title)));
    sel.appendChild(og1);
    const og2 = h('optgroup', { label: 'من عملي' });
    og2.appendChild(h('option', { value: 'compose' }, '✍️ النوتة الحالية في التأليف'));
    sel.appendChild(og2);
    const items = ST.list();
    if (items.length) {
      const og3 = h('optgroup', { label: 'نوتاتي المحفوظة' });
      items.forEach(it => og3.appendChild(h('option', { value: 'lib:' + it.id }, it.name)));
      sel.appendChild(og3);
    }
    if (prev && $$('option', sel).some(o => o.value === prev)) sel.value = prev;
  }

  function loadReadingPiece(v) {
    stopPlayback();
    if (state.quiz) endQuiz(true);
    let s = null, src = '';
    if (!v || v.startsWith('lesson:')) {
      const id = v ? v.slice(7) : EX.LESSONS[2].id;
      s = EX.lessonScore(id);
      const L = EX.LESSONS.find(x => x.id === id);
      src = '📘 المصدر: ' + L.source + '.';
    } else if (v === 'compose') {
      s = SC.clone(docs.compose.score);
      if (!s.notes.length) { src = 'المدرج في «التأليف» فارغ حاليًا.'; }
      else src = '✍️ نسخة للقراءة من النوتة الحالية في التأليف (التعديل يتم من تبويب التأليف).';
    } else if (v.startsWith('lib:')) {
      const r = ST.load(v.slice(4));
      if (r.error) { toast(r.error, 'err'); return; }
      s = r.score; src = '📂 من نوتاتي: «' + r.name + '».';
    }
    s.minMeasures = Math.max(1, SC.layout(s).measures.length);
    docs.reading.load(s, 'load');
    state.reading.piece = v; state.reading.source = src;
    $('#readSource').textContent = src;
    state.selected = null;
    if (state.mode === 'reading') { render(); hintForTool(); }
  }

  function readingToCompose() {
    const s = SC.clone(docs.reading.score);
    guardDirty(() => {
      loadIntoCompose(s, { libId: null, libName: '', dirty: true });
      toast('✍️ فُتحت نسخة في التأليف — النسخة الأصلية لم تتغير.', 'ok');
    }, 'هل تريد فتح هذه النوتة مكانها؟');
  }

  // اختبار: أسماء النغمات (صولفائي) أو القيم الزمنية (إيقاعي)
  function startQuiz() {
    stopPlayback();
    const sc = cur().score;
    const type = state.read === 'rhythm' ? 'rhythm' : 'solfege';
    const order = sc.notes.map((n, i) => i).filter(i => type === 'rhythm' ? true : (sc.notes[i].kind === 'note' && sc.notes[i].pitch));
    if (!order.length) { toast('لا توجد علامات للاختبار في هذه النوتة.', 'err'); return; }
    state.selected = null;
    state.quiz = { type, order, pos: 0, right: 0, wrong: 0, hidden: new Set(order), locked: false };
    $('#quizPanel').hidden = false;
    $('#btnQuiz').textContent = '⏹️ إنهاء الاختبار';
    buildQuizButtons();
    render();
    askQuiz();
  }
  function buildQuizButtons() {
    const q = state.quiz; const box = $('#quizAnswers'); box.textContent = '';
    let answers;
    if (q.type === 'solfege') answers = T.STEPS.map(s => ({ v: s, label: T.SOLFEGE[s] }));
    else {
      const sc = cur().score; const seen = new Map();
      T.VALUES.forEach(v => seen.set('note' + v.base + '0', { v: 'note|' + v.base + '|0', label: v.name }));
      sc.notes.forEach(n => { const k = n.kind + n.rhythm.base + (n.rhythm.dots ? 1 : 0); if (!seen.has(k)) seen.set(k, { v: n.kind + '|' + n.rhythm.base + '|' + (n.rhythm.dots ? 1 : 0), label: T.valueName(n.kind, n.rhythm) }); });
      answers = Array.from(seen.values());
    }
    answers.forEach(a => {
      const b = h('button', { class: 'btn', 'data-v': a.v }, esc(a.label));
      b.onclick = () => answerQuiz(a.v, b);
      box.appendChild(b);
    });
  }
  function askQuiz() {
    const q = state.quiz;
    const idx = q.order[q.pos];
    const n = cur().score.notes[idx];
    $('#quizQ').textContent = q.type === 'solfege' ? '🎯 ما اسم النغمة المحددة باللون الذهبي؟ (' + (q.pos + 1) + ' من ' + q.order.length + ')' : '🎯 ما اسم هذه العلامة الإيقاعية؟ (' + (q.pos + 1) + ' من ' + q.order.length + ')';
    $('#quizScore').textContent = '✔ ' + q.right + '   ✘ ' + q.wrong;
    $$('#quizAnswers .btn').forEach(b => b.classList.remove('good', 'bad'));
    render();
    const geo = renderer.noteGeo[idx];
    if (geo && geo.g) { const rc = geo.g.getBoundingClientRect(); if (rc.top < 0 || rc.bottom > window.innerHeight) geo.g.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    q.locked = false;
    void n;
  }
  function answerQuiz(v, btn) {
    const q = state.quiz; if (!q || q.locked) return;
    const idx = q.order[q.pos];
    const n = cur().score.notes[idx];
    const right = q.type === 'solfege' ? n.pitch.step : n.kind + '|' + n.rhythm.base + '|' + (n.rhythm.dots ? 1 : 0);
    q.locked = true;
    if (v === right) { q.right++; btn.classList.add('good'); previewNote(idx); }
    else {
      q.wrong++; btn.classList.add('bad');
      const good = $$('#quizAnswers .btn').find(b => b.dataset.v === right); if (good) good.classList.add('good');
    }
    q.hidden.delete(idx);
    render();
    setTimeout(() => {
      if (!state.quiz) return;
      q.pos++;
      if (q.pos >= q.order.length) finishQuiz(); else askQuiz();
    }, v === right ? 550 : 1300);
  }
  function finishQuiz() {
    const q = state.quiz;
    const pct = Math.round(100 * q.right / q.order.length);
    const pts = Math.round(pct / 4);
    state.player.xp += pts; if (pct === 100) state.player.ok++;
    updatePlayer(); savePrefs();
    $('#quizQ').textContent = (pct === 100 ? '🌟 ممتاز! ' : pct >= 70 ? '👏 أحسنت! ' : '💪 تدرّب أكثر: ') + 'النتيجة ' + q.right + ' من ' + q.order.length + ' (' + pct + '٪) — +' + pts + ' نقطة';
    $('#quizAnswers').textContent = '';
    if (pct === 100) celebrate();
    state.quiz = null;
    $('#btnQuiz').textContent = '🎯 اختبر نفسك';
    render();
  }
  function endQuiz(silent) {
    state.quiz = null;
    $('#quizPanel').hidden = true;
    $('#btnQuiz').textContent = '🎯 اختبر نفسك';
    if (!silent) render();
  }

  // ------------------------------------------------------------------ متفرقات
  function updatePlayer() {
    $('#pName').textContent = state.player.name;
    $('#pXp').textContent = state.player.xp;
    $('#pOk').textContent = state.player.ok;
  }
  function celebrate() {
    const box = $('#confetti'); box.textContent = '';
    const colors = ['#22d3ee', '#ffcc00', '#10b981', '#f43f5e', '#8b5cf6', '#3b82f6'];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = (Math.random() * 0.6) + 's';
      c.style.animationDuration = (1.8 + Math.random() * 1.4) + 's';
      box.appendChild(c);
    }
    setTimeout(() => { box.textContent = ''; }, 3600);
  }

  function openSettings() {
    const body = h('div');
    const sw = (label, key) => {
      const l = h('label', { class: 'switch' }, '<input type="checkbox"><span></span> <b>' + label + '</b>');
      const i = l.querySelector('input'); i.checked = !!prefs[key];
      i.onchange = () => { prefs[key] = i.checked; savePrefs(); render(); };
      const d = h('div'); d.style.margin = '8px 0'; d.appendChild(l); body.appendChild(d);
    };
    sw('إظهار أرقام كل الموازير', 'measureNumbers');
    sw('إظهار اسم الموضع عند التمرير فوق المدرج (مساعدة للمبتدئين)', 'hoverNames');
    sw('عدّ تمهيدي (مازورة نقرات) قبل التشغيل مع المترونوم', 'countIn');
    sw('كتابة العلامة الأولى في الإملاء كمساعدة', 'firstNoteHint');
    const snd = audio.status === 'samples' ? '🎹 صوت بيانو حقيقي (عينات Salamander Grand Piano V3 — Alexander Holm، ترخيص CC BY 3.0).'
      : audio.status === 'loading' ? '⏳ جارٍ تحميل أصوات البيانو…' : audio.status === 'synth' ? '🎛️ تعذّر تحميل عينات البيانو، فيُستخدم صوت مُركَّب بديل (النغمات صحيحة الطبقة).' : 'سيُحمَّل الصوت عند أول تشغيل.';
    body.appendChild(h('div', { class: 'note' }, '<b>الصوت:</b> ' + snd + '<br>أصوات المترونوم والقراءة الإيقاعية مولّدة برمجيًا.'));
    body.appendChild(h('div', { class: 'note' }, '<b>الحفظ:</b> «نوتاتي» والمسودة محفوظتان في هذا المتصفح على هذا الجهاز فقط. لنقل نوتة بين الأجهزة استخدم «تصدير ملف» ثم «استيراد ملف».'));
    modal('⚙️ الإعدادات', body, [{ label: 'تم', primary: true }]);
  }

  function openHelp() {
    const html = '<div class="help">' +
      '<h3>✍️ التأليف والتدوين</h3><ul>' +
      '<li>اختر <b>القيمة الزمنية</b> ثم انقر على <b>الخط أو المسافة</b> لكتابة النغمة. المؤشر الأزرق يبيّن أين ستُكتب، ويظهر <b>المتبقي من زمن المازورة</b>.</li>' +
      '<li>انقر نغمة لتحديدها: اسحبها لأعلى أو أسفل لتغيير موضعها، أو اختر قيمة زمنية جديدة لها، أو علامة تحويل. النقر في مكان فارغ يلغي التحديد.</li>' +
      '<li>لا تقبل المازورة أكثر من زمنها: ستظهر رسالة توضح المتبقي. والمازورة الناقصة تُظلَّل بالبرتقالي.</li>' +
      '<li>احفظ النوتة باسم في «نوتاتي» أو صدّرها كملف، وافتحها لاحقًا لمتابعة العمل.</li></ul>' +
      '<h3>🎼 القراءة الصولفائية و🥁 القراءة الإيقاعية</h3><ul>' +
      '<li><b>الصولفائية</b>: أسماء النغمات تحت المدرج، والتشغيل باللحن (الصولفيج الغنائي) أو بالمترونوم فقط ليقرأ الطالب بصوته (الصولفيج القرائي).</li>' +
      '<li><b>الإيقاعية</b>: مقاطع إيمي باري (طا، تي، فا، في…) وأسماء الأشكال (طاتي، طفاتيفي، طفافي…)، والتشغيل بنقرات إيقاعية. التدوين فيها يغيّر الأزمنة فقط ولا يلمس النغمات.</li>' +
      '<li>النغمة المكتوبة في القراءة الإيقاعية تظهر «؟» حتى تحدد موضعها في القراءة الصولفائية.</li></ul>' +
      '<h3>⌨️ اختصارات لوحة المفاتيح</h3><ul>' +
      '<li><kbd>1</kbd>–<kbd>5</kbd> روند…دوبل كروش · <kbd>.</kbd> بوانتيه · <kbd>R</kbd> سكتة/نغمة · <kbd>T</kbd> رباط</li>' +
      '<li><kbd>C</kbd> <kbd>D</kbd> <kbd>E</kbd> <kbd>F</kbd> <kbd>G</kbd> <kbd>A</kbd> <kbd>B</kbd> كتابة دو ري مي فا صول لا سي بالترتيب · <kbd>↑</kbd> <kbd>↓</kbd> تحريك النغمة المحددة</li>' +
      '<li><kbd>←</kbd> <kbd>→</kbd> التنقل بين العلامات · <kbd>Delete</kbd> حذف · <kbd>Ctrl</kbd>+<kbd>Z</kbd> تراجع · <kbd>Ctrl</kbd>+<kbd>Y</kbd> إعادة · <kbd>مسافة</kbd> تشغيل/إيقاف · <kbd>Esc</kbd> إلغاء التحديد</li></ul></div>';
    modal('❔ طريقة الاستخدام', html, [{ label: 'فهمت 👍', primary: true }]);
  }

  // كتابة نغمة بالحرف (C..B) في أقرب أوكتاف للنغمة السابقة
  function typeNote(step) {
    if (!isEditable()) return;
    const doc = cur();
    let ref = T.posOf({ step: 'F', octave: 4 }); // أول نغمة: حول منتصف سلم دو (دو أسفل المدرج إلى صول)
    for (let i = doc.score.notes.length - 1; i >= 0; i--) { const n = doc.score.notes[i]; if (n.pitch) { ref = T.posOf(n.pitch); break; } }
    let best = null;
    for (let oc = 3; oc <= 6; oc++) {
      const p = T.posOf({ step, octave: oc });
      if (p < T.MIN_POS || p > T.MAX_POS) continue;
      if (best === null || Math.abs(p - ref) < Math.abs(best - ref)) best = p;
    }
    if (state.selected !== null && doc.score.notes[state.selected].kind === 'note') {
      movePitch(state.selected, T.pitchAtPos(best), true); return;
    }
    placeNote({ insertIndex: doc.score.notes.length, pitch: T.pitchAtPos(best) });
  }

  function onKey(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (!$('#modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
    if ($('#app').hidden) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.code === 'Space') { e.preventDefault(); if (state.mode === 'reading') $('#btnReadPlay').click(); else togglePlay(); return; }
    if (e.key === 'Escape') { if (state.selected !== null) { state.selected = null; render(); hintForTool(); } return; }
    if (!isEditable()) {
      if (state.quiz && /^Digit[1-7]$/.test(e.code)) { const b = $$('#quizAnswers .btn')[+e.code.slice(5) - 1]; if (b) b.click(); }
      return;
    }
    const doc = cur();
    if (ctrl && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) doc.redo(); else doc.undo(); state.selected = null; render(); return; }
    if (ctrl && e.code === 'KeyY') { e.preventDefault(); doc.redo(); state.selected = null; render(); return; }
    if (ctrl) return;
    if (/^Digit[1-5]$/.test(e.code) || /^Numpad[1-5]$/.test(e.code)) { selectDuration(T.VALUES[+e.code.slice(-1) - 1].base); return; }
    if (e.code === 'Period' || e.code === 'NumpadDecimal') { toggleDot(); return; }
    if (e.code === 'KeyR') { selectKind((state.selected !== null ? doc.score.notes[state.selected].kind : state.tool.kind) === 'rest' ? 'note' : 'rest'); return; }
    if (e.code === 'KeyN') { selectKind('note'); return; }
    if (e.code === 'KeyT') { toggleTie(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteNote(); return; }
    const m = e.code.match(/^Key([A-G])$/);
    if (m) { typeNote(m[1]); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (state.selected === null || state.read !== 'solfege') return;
      e.preventDefault();
      const n = doc.score.notes[state.selected]; if (n.kind !== 'note') return;
      const p = (n.pitch ? T.posOf(n.pitch) : 4) + (e.key === 'ArrowUp' ? 1 : -1);
      if (p < T.MIN_POS || p > T.MAX_POS) return;
      movePitch(state.selected, T.pitchAtPos(p), true);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (!doc.score.notes.length) return;
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1; // الكتابة الموسيقية من اليسار لليمين
      if (state.selected === null) state.selected = dir > 0 ? 0 : doc.score.notes.length - 1;
      else state.selected = Math.max(0, Math.min(doc.score.notes.length - 1, state.selected + dir));
      render(); previewNote(state.selected);
    }
  }

  // ------------------------------------------------------------------ التهيئة
  function init() {
    renderer = new MT.Renderer($('#staff'));
    solutionRenderer = new MT.Renderer($('#solution'));
    buildTools();
    fillDictationControls();
    fillReadingPieces();

    // شاشة البداية
    const saved = prefs.player || null;
    if (saved && saved.name) { $('#playerName').value = saved.name === 'زائر' ? '' : saved.name; }
    const start = () => {
      const nm = $('#playerName').value.trim() || 'زائر';
      if (saved && saved.name === nm) state.player = { name: nm, xp: saved.xp || 0, ok: saved.ok || 0 };
      else state.player = { name: nm, xp: 0, ok: 0 };
      updatePlayer(); savePrefs();
      audio.ensure();
      $('#splash').classList.add('leave');
      setTimeout(() => { $('#splash').hidden = true; $('#app').hidden = false; render(); hintForTool(); afterStart(); }, 420);
    };
    $('#btnStart').onclick = start;
    $('#playerName').addEventListener('keydown', e => { if (e.key === 'Enter') start(); });

    // التبويبات وطريقة القراءة
    $$('.tab').forEach(b => b.onclick = () => setMode(b.dataset.mode));
    $$('.seg-read .seg-btn').forEach(b => b.onclick = () => setRead(b.dataset.read));
    $$('#solfegeStyle .seg-btn').forEach(b => b.onclick = () => { setSolfegeStyle(b.dataset.style); hintForTool(); });
    $('#swLabels').checked = state.labels;
    $('#swLabels').onchange = (e) => { state.labels = e.target.checked; savePrefs(); render(); };
    $('#swLine').checked = state.rhythmLine;
    $('#swLine').onchange = (e) => { state.rhythmLine = e.target.checked; savePrefs(); render(); };

    // الأدوات
    $('#durTools').addEventListener('click', e => { const b = e.target.closest('.tool'); if (b) selectDuration(+b.dataset.base); });
    $('#tNote').onclick = () => selectKind('note');
    $('#tRest').onclick = () => selectKind('rest');
    $('#tDot').onclick = toggleDot;
    $('#tTie').onclick = toggleTie;
    $$('.tool.acc').forEach(b => b.onclick = () => toggleAcc(+b.dataset.acc));
    $('#tUndo').onclick = () => { cur().undo(); state.selected = null; render(); };
    $('#tRedo').onclick = () => { cur().redo(); state.selected = null; render(); };
    $('#tDel').onclick = deleteNote;
    $('#tClear').onclick = clearAll;
    $('#tMarks').onclick = openMarks;

    // المدرج
    const host = $('#staff');
    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerup', onPointerUp);
    host.addEventListener('pointercancel', onPointerUp);
    host.addEventListener('pointerleave', () => { if (!state.drag && !state.placing && renderer) renderer.showGhost(null); });
    host.addEventListener('contextmenu', e => e.preventDefault()); // الضغط المطوّل على شاشات اللمس

    // التشغيل
    $('#btnPlay').onclick = togglePlay;
    $('#btnLoop').onclick = () => { state.loop = !state.loop; $('#btnLoop').classList.toggle('active', state.loop); if (audio.isPlaying()) { stopPlayback(); togglePlay(); } };
    $('#swMetro').onchange = (e) => { state.metro = e.target.checked; };
    $('#tempo').oninput = (e) => {
      const v = +e.target.value; $('#tempoVal').textContent = v;
      cur().score.tempo = v;
      if (state.mode === 'dictation' && state.dict.target) state.dict.target.tempo = v;
      if (state.mode === 'compose') { markDirty(); scheduleDraft(); }
      $('#staffMeta').textContent = $('#staffMeta').textContent.replace(/♩ = \d+/, '♩ = ' + v);
    };
    $('#volume').value = prefs.volume;
    $('#volume').oninput = (e) => { prefs.volume = +e.target.value; audio.setVolume(prefs.volume); savePrefs(); };

    // التأليف
    $('#btnSave').onclick = save;
    $('#btnLibrary').onclick = openLibrary;
    $('#btnExport').onclick = exportCurrent;
    $('#btnImport').onclick = () => $('#fileInput').click();
    $('#fileInput').onchange = (e) => { const f = e.target.files && e.target.files[0]; if (f) importFile(f); };
    $('#btnNew').onclick = newScore;
    $('#btnScoreSettings').onclick = scoreSettings;
    $('#btnPrint').onclick = () => { state.selected = null; render(); setTimeout(() => window.print(), 100); };
    $('#scoreTitle').addEventListener('input', (e) => { docs.compose.score.title = e.target.value; state.dirty = true; updateSaveState(); updateHead(); scheduleDraft(); });
    // سحب ملف وإفلاته على المدرج
    $('#staffCard').addEventListener('dragover', e => { if (state.mode === 'compose') { e.preventDefault(); } });
    $('#staffCard').addEventListener('drop', e => { if (state.mode !== 'compose') return; e.preventDefault(); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) importFile(f); });

    // الإملاء
    $('#btnNewDict').onclick = newDictation;
    $('#dSource').addEventListener('focus', refreshDictSources);
    $('#dSource').addEventListener('mousedown', refreshDictSources);
    $('#btnFillPitches').onclick = startFillPitches;
    $('#zoomIn').onclick = () => setZoom(0.1);
    $('#zoomOut').onclick = () => setZoom(-0.1);
    $('#btnListen').onclick = listenDictation;
    $('#btnTonic').onclick = playTonic;
    $('#btnCheck').onclick = checkDictation;
    $('#btnSolution').onclick = showSolution;
    $('#btnRetry').onclick = retryDictation;
    $('#btnDictToCompose').onclick = () => { const t = state.dict.target; if (!t) return; const s = SC.clone(t); s.title = 'من الإملاء: ' + state.dict.label; guardDirty(() => loadIntoCompose(s, { dirty: true }), 'هل تريد فتح لحن الإملاء مكانها؟'); };

    // القراءة
    $('#rPiece').onchange = (e) => loadReadingPiece(e.target.value);
    $('#rPiece').addEventListener('focus', () => fillReadingPieces());
    $('#btnReadPlay').onclick = () => { if (audio.isPlaying()) { stopPlayback(); return; } audio.ensure(); startPlayback(docs.reading.score, { fromIdx: state.selected, button: $('#btnReadPlay') }); };
    $('#btnQuiz').onclick = () => { if (state.quiz) { endQuiz(); } else startQuiz(); };
    $('#btnQuizStop').onclick = () => endQuiz();
    $('#btnReadEdit').onclick = readingToCompose;

    // عام
    $('#btnSettings').onclick = openSettings;
    $('#btnHelp').onclick = openHelp;
    $('#btnFull').onclick = () => {
      if (!document.fullscreenElement) { (document.documentElement.requestFullscreen || function () {}).call(document.documentElement); }
      else document.exitFullscreen();
    };
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.hasAttribute('data-close')) closeModal(); });
    document.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', () => ST.saveDraft(docs.compose.score, { libId: state.libId, libName: state.libName, dirty: state.dirty }));

    // تغيّر النوتة
    docs.compose.onChange((reason) => { if (reason !== 'load') { state.dirty = true; stopIfEditing('compose'); } updateSaveState(); scheduleDraft(); if (state.mode === 'compose') render(); });
    docs.dictation.onChange((reason) => {
      if (reason !== 'load') stopIfEditing('dictation');
      if (reason !== 'load' && state.dict.statuses) {
        state.dict.statuses = null; state.dict.measureStatus = null;
        const fb = $('#feedback');
        if (!fb.hidden && !fb.querySelector('.stale')) { fb.classList.add('is-stale'); fb.insertBefore(h('div', { class: 'stale' }, '✏️ عدّلتَ إجابتك بعد التحقق — اضغط «تحقق من إجابتي» لرؤية النتيجة الجديدة.'), fb.firstChild); }
      }
      if (state.mode === 'dictation') render();
    });
    docs.reading.onChange(() => { if (state.mode === 'reading') render(); });

    setRead(state.read);
    setSolfegeStyle(state.solfegeStyle);
    setMode('compose');
    updateSaveState();
    // استعادة المسودة
    const draft = ST.readDraft();
    if (draft) {
      docs.compose.load(draft.score, 'load');
      state.libId = draft.meta.libId || null; state.libName = draft.meta.libName || '';
      state.dirty = draft.meta.dirty !== false;
      if (state.libId && !ST.list().some(x => x.id === state.libId)) { state.libId = null; state.dirty = true; }
      $('#scoreTitle').value = draft.score.title || '';
      init.restored = draft;
    }
    updateSaveState();
    // تعريض واجهة صغيرة للاختبار الآلي
    window.MTApp = { state, docs, audio, render, get renderer() { return renderer; }, setMode, setRead, buildPlayback, checkDictation, newDictation };
  }

  function afterStart() {
    if (init.restored) {
      const d = init.restored; init.restored = null;
      const when = d.at ? new Date(d.at).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }) : '';
      toast('↩️ استُعيدت مسودتك الأخيرة (' + d.score.notes.length + ' علامة' + (when ? ' — ' + when : '') + ').', 'ok', [{ label: 'ابدأ نوتة جديدة', run: newScore }]);
    }
    updateSaveState();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.MT = window.MT || {});
