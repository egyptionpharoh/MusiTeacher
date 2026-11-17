// =====================================================================
//  واجهة «عازف العود»: أربعة أوضاع (تعرّف على العود / عزف حر / تعلّم موجّه / تمرين لحني)، كاميرا (زوايا/تكبير/إعادة)،
//  لوحة جانبية قابلة للطي، خريطة الزند للنقر، النقر على الزند نفسه في المشهد، أسماء الأوتار والنغمات (اختيارية)،
//  وزر «استبدال العازف». القاعدة: العازف والعود هما البطل؛ المعلومات عند الطلب.
// =====================================================================
import * as THREE from 'three';
import { COURSES, PARTS, FINGER_AR, FINGER_SHORT, MAP_SEMIS, MAP_QUARTERS, noteName, placeNote, fingerFor, midiOf, arNum, intervalAr } from '../instrument/oud-data.js';
import { OUD } from '../instrument/oud-model.js';
import { EXERCISES, exById, stepText } from '../teaching/exercises.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) e.append(c && c.nodeType ? c : document.createTextNode(c ?? '')); return e; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const VIEWS = {
  default: { ar: 'الزاوية الافتراضية', th: 0.42, ph: 1.22, d: 1.65, t: [0.05, 0.86, 0.28] },
  front: { ar: 'العازف من الأمام (مقابل الطلاب)', th: 0.0, ph: 1.35, d: 1.9, t: [0.04, 0.9, 0.25] },
  left: { ar: 'اليد اليسرى على الزند', th: 0.55, ph: 1.3, d: 0.55, t: 'L' },
  leftNut: { ar: 'اليد اليسرى من جهة الأنف (تقوّس الأصابع ونزولها)', th: 1.05, ph: 1.2, d: 0.5, t: 'L' },
  right: { ar: 'اليد اليمنى والريشة', th: -0.25, ph: 1.15, d: 0.5, t: 'R' },
  player: { ar: 'من فوق كتف العازف (كما يرى عوده)', th: 2.75, ph: 0.75, d: 0.85, t: 'O' },
  side: { ar: 'من الجانب (وضعية الجلوس والحمل)', th: -1.5, ph: 1.4, d: 1.9, t: [0.0, 0.78, 0.25] },
  top: { ar: 'من أعلى', th: 0.15, ph: 0.35, d: 1.5, t: [0.05, 0.8, 0.32] },
  oud: { ar: 'العود عن قرب', th: 0.15, ph: 1.3, d: 1.05, t: 'O' },
  back: { ar: 'من الخلف', th: 2.9, ph: 1.25, d: 1.9, t: [0.0, 0.85, 0.2] },
};
const NAME_MODES = { solfege: 'دو ري مي (صولفيج)', arabic: 'الأسماء العربية (راست، دوكاه…)', latin: 'غربية (C D E)', none: 'بلا أسماء' };

export function buildUI(ctx) {
  const { scene, camera, canvas, oud, perf, audio, cam } = ctx;
  const root = $('#ui'); root.innerHTML = '';
  const qs = new URLSearchParams(location.search);
  const S = { mode: 'free', panelOpen: innerWidth > 760, hidden: false, names: 'solfege', labels3d: true, quarters: false, risha: 'alt', clean: qs.has('clean') };

  // ---------------- شريط علوي ----------------
  const modeBtns = {};
  const mkMode = (id, label) => (modeBtns[id] = el('button', { class: 'tab', onclick: () => setMode(id) }, label));
  const viewMenu = el('div', { class: 'menu hidden', id: 'view-menu' }, Object.entries(VIEWS).map(([k, v]) => el('button', { onclick: () => { setView(k); closeMenus(); } }, v.ar)));
  const btnView = el('button', { class: 'ibtn', title: 'زوايا الكاميرا', onclick: (e) => { e.stopPropagation(); toggleMenu(viewMenu); } }, '🎥 الكاميرا ▾');
  // ---------- استبدال العازف: عازف ⇄ عازفة (يُحفظ في هذا المتصفح، مشترك مع ألعاب الكمان والأكورديون والأورج) ----------
  const perfLbl = () => '🔄 استبدال العازف';
  const btnPerf = el('button', { class: 'ibtn perf-btn', id: 'btn-performer', title: 'استبدال العازف: عازف ⇄ عازفة (العود والتمرين والصوت والكاميرا لا تتغير)', 'aria-label': 'تبديل شخصية العازف', onclick: () => switchPerformer() }, perfLbl());
  async function switchPerformer() {
    if (!ctx.performer || btnPerf.disabled) return;
    const next = ctx.performer.get() === 'male' ? 'female' : 'male';
    btnPerf.disabled = true; btnPerf.classList.add('busy');
    const done = await ctx.performer.set(next, (st) => { if (st === 'loading') btnPerf.textContent = '⏳ جارٍ الاستبدال…'; });
    btnPerf.textContent = perfLbl(); btnPerf.disabled = false; btnPerf.classList.remove('busy');
    chipShow(done === 'male' ? 'العازف' : 'العازفة');
    return done;
  }
  const top = el('div', { id: 'topbar' },
    el('div', { class: 'brand' }, '🎶 عازف العود'),
    el('div', { class: 'tabs' }, mkMode('identify', 'تعرّف على العود'), mkMode('free', 'عزف حر'), mkMode('guided', 'تعلّم موجّه'), mkMode('lesson', 'تمرين لحني')),
    el('div', { class: 'tools' },
      el('div', { class: 'menuwrap' }, btnView, viewMenu),
      el('button', { class: 'ibtn', title: 'تكبير', onclick: () => zoom(-0.15) }, '＋'),
      el('button', { class: 'ibtn', title: 'تصغير', onclick: () => zoom(0.15) }, '－'),
      el('button', { class: 'ibtn', title: 'إعادة الكاميرا إلى وضعها الافتراضي', onclick: () => setView('default') }, '⟲'),
      el('button', { class: 'ibtn', title: 'إخفاء/إظهار اللوحات', id: 'btn-hide', onclick: () => toggleHidden() }, '👁'),
      btnPerf,
      el('button', { class: 'ibtn', title: 'الحقوق والمصادر', onclick: () => $('#credits').classList.toggle('hidden') }, 'ⓘ')));
  const sidebar = el('aside', { id: 'side' });
  const handle = el('button', { id: 'side-toggle', title: 'إظهار/إخفاء اللوحة', onclick: () => { S.panelOpen = !S.panelOpen; layout(); } }, '☰');
  const chip = el('div', { id: 'chip', class: 'hidden' });
  const status = el('div', { id: 'status', class: 'hidden' }, '');
  const credits = el('div', { id: 'credits', class: 'modal hidden' }, el('div', { class: 'card' },
    el('h3', {}, 'الحقوق والمصادر'),
    el('p', {}, 'صوت العود: مولَّد برمجيًا داخل اللعبة بنمذجة فيزيائية لوتر منقور بالريشة (Karplus–Strong) مع رنين جسم العود — وهو محرك الصوت نفسه في لعبة «العود الافتراضي» بالمنصة. لا تُستعمل أي تسجيلات أو عينات خارجية؛ لم نجد مكتبة عينات عود مسجّلة بترخيص واضح يسمح بهذا الاستعمال.'),
    el('p', {}, 'العود والريشة والكرسي ومسند القدم: مجسّمات إجرائية أُنشئت برمجيًا لهذه اللعبة، بمقاسات العود العربي الشائع. العرض: three.js (MIT).'),
    el('p', {}, 'العازفة: النموذج نفسه المستخدم في ألعاب الكمان والأكورديون والأورج (مُصدَّر من MakeHuman). العازف: النموذج نفسه بأهداف التشكيل الذكرية من MakeHuman/MPFB2 (ترخيص CC0)، والمصر والدشداشة واللحية مولّدة برمجيًا.'),
    el('p', {}, 'الدوزان وأسماء الأوتار وقاعدة الأصابع مطابقة للعبة «مقامات العود» في المنصة. اللحنان القصيران من تأليف MusiTeacher لهذا التمرين، والمقامات (العجم، الراست، الكرد) صيغ تعليمية عامة.'),
    el('button', { class: 'ibtn', onclick: () => $('#credits').classList.add('hidden') }, 'إغلاق')));
  // شريط النغمات (للتمرين والتعلّم الموجّه): كل نغمة باسمها ووترها وإصبعها واتجاه الريشة
  const strip = el('div', { id: 'note-strip', class: 'hidden', dir: 'rtl' });
  const labels = el('div', { id: 'labels3d' });
  root.append(top, sidebar, handle, chip, status, credits, strip, labels);

  function toggleMenu(m) { const was = m.classList.contains('hidden'); closeMenus(); if (was) m.classList.remove('hidden'); }
  function closeMenus() { root.querySelectorAll('.menu').forEach((m) => m.classList.add('hidden')); }
  addEventListener('pointerdown', (e) => { if (!e.target.closest('.menuwrap')) closeMenus(); });

  // ---------------- التخطيط ----------------
  let shiftNow = 0;
  function layout() {
    sidebar.classList.toggle('open', S.panelOpen && !S.hidden); handle.classList.toggle('hidden', S.hidden);
    root.classList.toggle('hide-all', S.hidden); document.body.classList.toggle('panel-open', S.panelOpen && !S.hidden);
    strip.classList.toggle('hidden', !(S.mode === 'lesson' || S.mode === 'guided') || S.hidden);
  }
  function toggleHidden() { S.hidden = !S.hidden; layout(); }
  function updateViewOffset(dt) {
    const w = innerWidth, h = innerHeight, narrow = w < 760;
    if (!narrow) { const ct = top.offsetHeight + 14; if (chip._tb !== ct) { chip.style.top = ct + 'px'; chip._tb = ct; } }
    if (!narrow) { const st = top.offsetHeight + 16; if (sidebar._tb !== st) { sidebar.style.top = st + 'px'; handle.style.top = (st + 8) + 'px'; sidebar._tb = st; } } else if (sidebar._tb) { sidebar.style.top = ''; handle.style.top = ''; sidebar._tb = 0; }
    if (narrow) { const tb = top.offsetHeight + 14; if (strip._tb !== tb) { strip.style.top = tb + 'px'; strip._tb = tb; } } else if (strip._tb) { strip.style.top = ''; strip._tb = 0; }
    const goal = (S.panelOpen && !S.hidden && !narrow && !S.clean) ? Math.min(330, w * 0.34) : 0;
    const dh = strip.classList.contains('hidden') || S.clean ? 0 : strip.offsetHeight + 8, goalY = narrow ? -dh / 2 : dh / 2;
    shiftNow += (goal - shiftNow) * (1 - Math.pow(0.001, dt)); S.shiftY = (S.shiftY || 0) + (goalY - (S.shiftY || 0)) * (1 - Math.pow(0.001, dt));
    if (Math.abs(shiftNow) < 0.5 && Math.abs(S.shiftY) < 0.5) { if (camera.view && camera.view.enabled) camera.clearViewOffset(); }
    else camera.setViewOffset(w, h, shiftNow / 2, S.shiftY, w, h);
  }
  function viewTarget(t) {
    const pl = ctx.player && ctx.player();
    if (t === 'L' && pl && pl.handLFrame) return oud.toWorld(new THREE.Vector3(OUD.courseX(3, OUD.stopY(3)), OUD.stopY(3), 0.01)).toArray();
    if (t === 'R' && pl && pl.rishaTip) return pl.rishaTip.slice();
    if (t === 'O') return oud.toWorld(new THREE.Vector3(0, 0.02, 0)).toArray();
    return t;
  }
  function setView(k) { const v = VIEWS[k]; Object.assign(cam.goal, { th: v.th, ph: v.ph, d: v.d }); cam.goal.t.set(...viewTarget(v.t)); }
  function zoom(f) { cam.goal.d = clamp(cam.goal.d * (1 + f), 0.3, 4.5); }

  // ---------------- الأوضاع ----------------
  function setMode(m) {
    S.mode = m; Object.entries(modeBtns).forEach(([k, b]) => b.classList.toggle('on', k === m));
    perf.stop(); clearHighlight(); guide.ex = null; lesson.playing = false;
    sidebar.replaceChildren(); layout();
    if (m === 'identify') buildIdentify(); else if (m === 'free') buildFree(); else if (m === 'guided') buildGuided(); else buildLesson();
    chip.classList.add('hidden'); renderStrip();
  }
  const sec = (title, open, ...kids) => { const d = el('details', { class: 'sec' }, el('summary', {}, title), el('div', { class: 'secbody' }, ...kids)); if (open) d.open = true; return d; };
  const namesSel = () => { const s = el('select', { 'data-names': '1', onchange: (e) => setNames(e.target.value) }, Object.entries(NAME_MODES).map(([k, v]) => el('option', { value: k }, v))); s.value = S.names; return s; };
  const labelsChk = () => { const c = el('input', { type: 'checkbox', 'data-l3d': '1', onchange: (e) => { S.labels3d = e.target.checked; syncChecks(); } }); c.checked = S.labels3d; return el('label', { class: 'row' }, c, 'أسماء الأوتار والنغمة على العود'); };
  function syncChecks() { root.querySelectorAll('[data-names]').forEach((c) => { c.value = S.names; }); root.querySelectorAll('[data-l3d]').forEach((c) => { c.checked = S.labels3d; }); }
  function setNames(m) { S.names = m; syncChecks(); renderMap(); renderStrip(); }
  const short = (t) => (t || '').replace(' نصف بيمول', '½♭').replace(' نصف دييز', '½♯').replace(' بيمول', '♭').replace(' دييز', '♯');
  const nm = (midi, oct = true) => (S.names === 'none' ? '' : noteName(midi, S.names === 'latin' ? 'latin' : S.names === 'arabic' ? 'arabic' : 'solfege', oct && S.names !== 'arabic'));

  // ---------- تعرّف على العود ----------
  let hl = null;
  function buildIdentify() {
    const card = el('div', { id: 'info-card' }, el('h3', {}, 'أجزاء العود'), el('p', {}, 'اضغط على أي جزء في المشهد أو من القائمة لتعرف اسمه ووظيفته.'));
    const list = el('div', { class: 'plist' }, Object.entries(PARTS).map(([k, v]) => el('button', { onclick: () => selectPart(k, true) }, v.ar)));
    sidebar.append(el('h2', {}, 'تعرّف على العود'), card, list);
  }
  function clearHighlight() { if (hl) { for (const m of hl) { if (m.material && m.userData._em != null) { m.material.emissive && m.material.emissive.setHex(m.userData._em); m.material.emissiveIntensity = m.userData._ei; } } hl = null; } }
  function selectPart(part, fromList) {
    clearHighlight();
    const info = PARTS[part]; if (!info) return;
    let meshes = part === 'risha' ? [ctx.risha || scene.getObjectByName('risha')] : (oud.parts[part] || []);
    meshes = meshes.filter((m) => m && m.material && !m.userData.pickOnly);
    // تمييز بالإضاءة الذاتية على نسخ من المواد (لا تتأثر الأجزاء الأخرى التي تشترك في المادة)
    for (const m of meshes) { if (!m.userData._ownMat) { m.material = m.material.clone(); m.userData._ownMat = true; } m.userData._em = m.material.emissive ? m.material.emissive.getHex() : 0; m.userData._ei = m.material.emissiveIntensity ?? 1; if (m.material.emissive) { m.material.emissive.setHex(0xffb347); m.material.emissiveIntensity = 0.35; } }
    hl = meshes;
    const card = $('#info-card'); if (card) card.replaceChildren(el('h3', {}, info.ar), el('p', {}, info.info));
    if (part === 'strings' && card) card.append(el('p', { class: 'extra' }, 'اضغط اسم وتر لتسمعه مطلقًا:'), el('div', { class: 'btnrow' }, COURSES.slice().reverse().map((c) => el('button', { class: 'btn', onclick: () => playCell(c.index, 0) }, c.ar))));
    if (!fromList) chipShow(info.ar);
  }

  // ---------- العزف الحر: خريطة الزند ----------
  const mapBox = el('div', { id: 'fmap' });
  function buildFree() {
    sidebar.append(el('h2', {}, 'عزف حر'),
      el('p', { class: 'hint' }, 'اضغط خانة في «خريطة الزند» (أو على الزند نفسه في المشهد) ليعزفها العازف: يضغط الإصبع المناسب على الوتر وتضربه الريشة في لحظة الصوت نفسها.'),
      sec('خريطة الزند (الوضع الأول)', true, mapBox,
        el('label', { class: 'row' }, el('input', { type: 'checkbox', onchange: (e) => { S.quarters = e.target.checked; renderMap(); } }), 'إظهار مواضع أرباع التون (سيكاه، أوج…)'),
        el('p', { class: 'small' }, 'الأعمدة: المسافة من الأنف بالدرجات (مطلق، ½ نصف درجة، ١ درجة، ١½ …). الرقم الذهبي الصغير = الإصبع: ١ سبابة، ٢ وسطى، ٣ بنصر، ٤ خنصر.')),
      sec('الريشة', true, (() => { const s = el('select', { onchange: (e) => { S.risha = e.target.value; } }, el('option', { value: 'alt' }, 'متناوبة ↓↑ (نازلة ثم صاعدة)'), el('option', { value: 'down' }, 'نازلة ↓ دائمًا'), el('option', { value: 'up' }, 'صاعدة ↑ دائمًا')); s.value = S.risha; return s; })()),
      sec('الأسماء', true, namesSel(), labelsChk()),
      sec('الصوت', false, el('label', {}, 'مستوى الصوت'), (() => { const r = el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: audio.volume, oninput: (e) => audio.setVolume(+e.target.value) }); return r; })(),
        el('p', { class: 'small' }, 'الصوت مولَّد يحاكي العود (وتر منقور بالريشة + رنين القصعة) وليس تسجيلًا حقيقيًا.')));
    renderMap();
  }
  function renderMap(hiCell) {
    if (!mapBox.isConnected && !hiCell) return;
    const cols = S.quarters ? [...MAP_SEMIS, ...MAP_QUARTERS].sort((a, b) => a - b) : MAP_SEMIS;
    const t = el('div', { class: 'fgrid', style: `grid-template-columns: 54px repeat(${cols.length}, minmax(0, 1fr))` });
    const deg = (s) => (s === 0 ? 'مطلق' : (Math.floor(s / 2) ? arNum(Math.floor(s / 2)) : '') + ({ 0: '', 0.5: '¼', 1: '½', 1.5: '¾' }[s % 2] || ''));
    t.append(el('div', { class: 'fh' }, 'الوتر'), ...cols.map((s) => el('div', { class: 'fh', title: s ? intervalAr(s) + ' من الأنف' : 'الوتر المطلق' }, deg(s))));
    for (const c of COURSES.slice().reverse()) {
      t.append(el('div', { class: 'fs' }, el('b', {}, c.ar), el('small', {}, nm(c.midi))));
      for (const s of cols) {
        const midi = midiOf(c.index, s), f = fingerFor(s), q = s % 1 !== 0;
        const b = el('button', { class: 'fc' + (q ? ' q' : '') + (s === 0 ? ' open' : ''), title: `${noteName(midi, 'both', true)} — وتر ${c.ar}، ${FINGER_AR[f]}`, onclick: () => playCell(c.index, s) }, el('span', {}, short(nm(midi, false)) || '•'), f ? el('i', {}, arNum(f)) : null);
        b.dataset.k = c.index + ':' + s; t.append(b);
      }
    }
    mapBox.replaceChildren(t);
  }
  function flashCell(course, semis) { const b = mapBox.querySelector(`[data-k="${course}:${semis}"]`); if (b) { b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 380); } }
  function nextRisha() { if (S.risha === 'down') return 'down'; if (S.risha === 'up') return 'up'; S.rDir = S.rDir === 'down' ? 'up' : 'down'; return S.rDir; }
  function playCell(course, semis, opt = {}) {
    audio.init(); audio.resume();
    const n = perf.playNow({ course, semis, finger: fingerFor(semis), risha: opt.risha || nextRisha() });
    flashCell(course, semis);
    return n;
  }

  // ---------- التعلّم الموجّه ----------
  const guide = { ex: null, i: 0 };
  const gMsg = el('div', { id: 'lesson-msg' });
  function buildGuided() {
    const exSel = el('select', { onchange: () => startGuide(exSel.value) }, EXERCISES.map((e) => el('option', { value: e.id }, `${e.title} — ${e.level}`)));
    sidebar.append(el('h2', {}, 'تعلّم موجّه'),
      el('p', { class: 'hint' }, 'خطوة بخطوة: تظهر النغمة التالية ووترها وإصبعها واتجاه الريشة. اضغط «اعرضها» ليؤديها العازف ببطء، ثم جرّبها بنفسك من خريطة الزند.'),
      exSel, gMsg,
      el('div', { class: 'btnrow' },
        el('button', { class: 'btn', onclick: () => stepGuide(-1) }, '→ السابق'),
        el('button', { class: 'btn pri', onclick: () => demoStep() }, '▶ اعرضها'),
        el('button', { class: 'btn', onclick: () => stepGuide(1) }, 'التالي ←')),
      el('button', { class: 'btn', onclick: () => startGuide(exSel.value) }, '⟲ من البداية'),
      sec('جرّبها بنفسك', true, mapBox, el('p', { class: 'small' }, 'الخانة المضيئة هي النغمة المطلوبة. اضغطها لتعزفها.')),
      sec('الأسماء', false, namesSel(), labelsChk()));
    renderMap(); startGuide(exSel.value);
  }
  function startGuide(id) { guide.ex = exById(id); guide.i = 0; showGuide(); }
  function stepGuide(d) { if (!guide.ex) return; guide.i = clamp(guide.i + d, 0, guide.ex.events.length - 1); showGuide(); }
  function showGuide(fb) {
    const ex = guide.ex; if (!ex) return;
    const ev = ex.events[guide.i], prev = ex.events[guide.i - 1];
    gMsg.replaceChildren(el('b', {}, `الخطوة ${arNum(guide.i + 1)} من ${arNum(ex.events.length)}`), ...stepText(ev, prev, S.names).map((l) => el('div', {}, l)));
    gMsg.dataset.fb = fb || '';
    mapBox.querySelectorAll('.fc.want').forEach((b) => b.classList.remove('want'));
    const b = mapBox.querySelector(`[data-k="${ev.course}:${ev.semis}"]`); if (b) b.classList.add('want');
    else if (ev.semis % 1 && !S.quarters) { S.quarters = true; renderMap(); const b2 = mapBox.querySelector(`[data-k="${ev.course}:${ev.semis}"]`); if (b2) b2.classList.add('want'); }
    S.stripHi = guide.i; renderStrip();
  }
  function demoStep() {
    const ev = guide.ex && guide.ex.events[guide.i]; if (!ev) return;
    audio.init(); audio.resume();
    perf.speedK = 1.6;                                      // حركة أبطأ قليلًا للعرض
    perf.schedule({ course: ev.course, semis: ev.semis, finger: ev.finger, risha: ev.risha, midi: ev.midi, dur: 1.3 }, perf.t + 0.45);
    setTimeout(() => { perf.speedK = 1; }, 2200);
  }

  // ---------- التمرين اللحني ----------
  const lesson = { ex: null, bpm: 70, loop: false, playing: false };
  const playBtn = el('button', { class: 'btn pri', onclick: () => (lesson.playing ? stopLesson() : playLesson()) }, '▶ تشغيل');
  const bpmLbl = el('span', {}, '');
  function buildLesson() {
    const exSel = el('select', { onchange: () => pickLesson(exSel.value) }, EXERCISES.map((e) => el('option', { value: e.id }, `${e.title} — ${e.level}`)));
    const about = el('p', { class: 'hint', id: 'ex-about' });
    const bpm = el('input', { type: 'range', min: 40, max: 110, step: 2, oninput: (e) => { lesson.bpm = +e.target.value; bpmLbl.textContent = `السرعة: ${arNum(lesson.bpm)} نبضة/دقيقة`; } });
    const loop = el('input', { type: 'checkbox', onchange: (e) => { lesson.loop = e.target.checked; } });
    sidebar.append(el('h2', {}, 'تمرين لحني'), exSel, about,
      el('div', { class: 'btnrow' }, playBtn, el('button', { class: 'btn', onclick: () => stopLesson() }, '■ إيقاف')),
      bpmLbl, bpm, el('label', { class: 'row' }, loop, 'تكرار التمرين'),
      sec('الأسماء', true, namesSel(), labelsChk()));
    lesson.bpmInput = bpm;
    pickLesson(exSel.value);
  }
  function pickLesson(id) { stopLesson(); lesson.ex = exById(id); lesson.bpm = lesson.ex.bpm; if (lesson.bpmInput) lesson.bpmInput.value = lesson.bpm; bpmLbl.textContent = `السرعة: ${arNum(lesson.bpm)} نبضة/دقيقة`; const a = $('#ex-about'); if (a) a.textContent = lesson.ex.about; S.stripHi = -1; renderStrip(); }
  function playLesson() {
    if (!lesson.ex) return; audio.init(); audio.resume();
    lesson.list = perf.playSequence(lesson.ex.events, lesson.bpm, 0.7); lesson.playing = true; playBtn.textContent = '❚❚ إيقاف مؤقت';
  }
  function stopLesson() { perf.stop(); lesson.playing = false; playBtn.textContent = '▶ تشغيل'; S.stripHi = -1; renderStrip(); }

  // ---------- شريط النغمات ----------
  function renderStrip() {
    const ex = S.mode === 'lesson' ? lesson.ex : S.mode === 'guided' ? guide.ex : null;
    if (!ex) { strip.replaceChildren(); return; }
    strip.replaceChildren(el('div', { class: 'ns-title' }, '🎼 ', ex.title), el('div', { class: 'ns-row' }, ex.events.map((e, i) => el('div', { class: 'nt' + (i === S.stripHi ? ' on' : '') + (e.beats >= 2 ? ' long' : ''), 'data-i': i },
      el('b', {}, short(nm(e.midi, false)) || '•'), el('small', {}, COURSES[e.course].ar), el('small', {}, e.finger ? FINGER_SHORT[e.finger] : 'مطلق'), el('span', { class: 'ar' }, e.risha === 'down' ? '↓' : '↑')))));
    const on = strip.querySelector('.nt.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  // ---------------- أسماء على العود (تُسقط من المشهد إلى الشاشة) ----------------
  const courseTags = COURSES.map((c) => { const d = el('div', { class: 'tag3d course' }, c.ar); labels.append(d); return d; });
  const noteTag = el('div', { class: 'tag3d note hidden' }); labels.append(noteTag);
  const v = new THREE.Vector3();
  const project = (p, elx) => { v.copy(p).project(camera); const ok = v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1; elx.style.display = ok ? '' : 'none'; if (ok) elx.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%)`; };
  let lastNote = null;
  function updateLabels() {
    const on = S.labels3d && !S.hidden && !S.clean && S.mode !== 'identify';
    labels.style.display = on ? '' : 'none'; if (!on) return;
    const camD = camera.position.distanceTo(oud.toWorld(new THREE.Vector3(0, 0.35, 0)));
    const showCourses = camD < 1.25;
    COURSES.forEach((c, i) => { const tg = courseTags[i]; if (!showCourses) { tg.style.display = 'none'; return; } const y = OUD.yNut - 0.012, p = oud.toWorld(new THREE.Vector3(OUD.courseX(c.index, y), y, OUD.zN + 0.004)); project(p, tg); tg.textContent = S.names === 'none' ? c.ar : `${c.ar} · ${nm(c.midi)}`; });
    if (lastNote && perf.t - lastNote.t < 1.4) {
      const n = lastNote, y = n.semis > 0 ? OUD.stopY(n.semis) : OUD.yPluck + 0.03, p = oud.toWorld(new THREE.Vector3(OUD.courseX(n.course, y) - 0.03, y, OUD.zStr(y) + 0.03));
      noteTag.classList.remove('hidden'); project(p, noteTag);
      noteTag.textContent = `${nm(n.midi) || COURSES[n.course].ar} · ${n.finger ? FINGER_SHORT[n.finger] : 'مطلق'} ${n.risha === 'down' ? '↓' : '↑'}`;
    } else noteTag.classList.add('hidden');
  }

  // ---------------- النقر في المشهد ----------------
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  function pickAt(cx, cy) {
    const r = canvas.getBoundingClientRect(); mouse.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const objs = []; oud.root.traverse((o) => { if (o.isMesh) objs.push(o); }); if (ctx.risha) objs.push(ctx.risha);
    const hit = ray.intersectObjects(objs, false)[0];
    return hit || null;
  }
  // نقطة على الزند ← (وتر، مسافة) بأقرب نصف تون (أو ربع تون إن كانت أرباع التون ظاهرة)
  function cellFromHit(hit) {
    const q = oud.root.worldToLocal(hit.point.clone());
    if (q.y < OUD.yFbEnd - 0.005 || q.y > OUD.yNut + 0.01 || Math.abs(q.x) > OUD.fbHalfW(Math.max(q.y, OUD.yFbEnd)) + 0.004) {
      if (q.y < OUD.yFbEnd && q.y > OUD.yBridge && Math.abs(q.x) < 0.045) { let best = 0, bd = 9; for (const c of COURSES) { const d = Math.abs(OUD.courseX(c.index, q.y) - q.x); if (d < bd) { bd = d; best = c.index; } } return { course: best, semis: 0 }; }
      return null;
    }
    let best = 0, bd = 9; for (const c of COURSES) { const d = Math.abs(OUD.courseX(c.index, q.y) - q.x); if (d < bd) { bd = d; best = c.index; } }
    const fromNut = OUD.yNut - q.y, semisF = -12 * Math.log2(Math.max(0.01, 1 - fromNut / OUD.L));
    const stepQ = S.quarters ? 0.5 : 1, s = clamp(Math.round(semisF / stepQ) * stepQ, 0, 5);
    return { course: best, semis: s };
  }
  const down = new Map(); let pinch = null;
  canvas.addEventListener('pointerdown', (e) => {
    audio.init(); audio.resume(); try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* */ }
    const hit = pickAt(e.clientX, e.clientY);
    if (S.mode === 'identify' && hit) { const part = hit.object.userData.part; if (part) selectPart(part); down.set(e.pointerId, { kind: 'tap' }); return; }
    if (hit && (S.mode === 'free' || S.mode === 'guided')) { const c = cellFromHit(hit); if (c) { playCell(c.course, c.semis); down.set(e.pointerId, { kind: 'tap' }); return; } }
    down.set(e.pointerId, { kind: 'cam', x: e.clientX, y: e.clientY });
    const camPts = [...down.values()].filter((d) => d.kind === 'cam');
    if (camPts.length === 2) pinch = { d: Math.hypot(camPts[0].x - camPts[1].x, camPts[0].y - camPts[1].y), cd: cam.goal.d };
  });
  canvas.addEventListener('pointermove', (e) => {
    const st = down.get(e.pointerId);
    if (!st) { const h = pickAt(e.clientX, e.clientY); canvas.style.cursor = h && (S.mode === 'identify' || ((S.mode === 'free' || S.mode === 'guided') && cellFromHit(h))) ? 'pointer' : 'grab'; return; }
    if (st.kind === 'cam') {
      if (pinch) { const pts = [...down.entries()].filter(([, v2]) => v2.kind === 'cam').map(([k, v2]) => (k === e.pointerId ? { x: e.clientX, y: e.clientY } : v2)); if (pts.length >= 2) { const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); cam.goal.d = clamp(pinch.cd * pinch.d / Math.max(20, d), 0.3, 4.5); } st.x = e.clientX; st.y = e.clientY; return; }
      cam.goal.th -= (e.clientX - st.x) * 0.0065; cam.goal.ph = clamp(cam.goal.ph - (e.clientY - st.y) * 0.0055, 0.15, 2.2); st.x = e.clientX; st.y = e.clientY;
    }
  });
  const up = (e) => { down.delete(e.pointerId); if ([...down.values()].filter((d) => d.kind === 'cam').length < 2) pinch = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(Math.sign(e.deltaY) * 0.08); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // لوحة الحاسوب: 1–6 الأوتار مطلقة (من الكردان إلى القرار)
  addEventListener('keydown', (e) => {
    const tg = e.target; if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || (tg && tg.matches && tg.matches('input,select,textarea'))) return;
    const k = { Digit1: 5, Digit2: 4, Digit3: 3, Digit4: 2, Digit5: 1, Digit6: 0 }[e.code];
    if (k != null && (S.mode === 'free' || S.mode === 'guided')) playCell(k, 0);
    if (e.code === 'KeyH') toggleHidden();
  });

  // ---------------- أحداث المؤدّي ----------------
  function chipShow(text) { chip.textContent = text; chip.classList.remove('hidden'); clearTimeout(chip._t); chip._t = setTimeout(() => chip.classList.add('hidden'), 1400); }
  perf.onEvent = (ev) => {
    if (ev.type !== 'on') return;
    lastNote = { ...ev, t: perf.t };
    const c = COURSES[ev.course], n = nm(ev.midi);
    if (S.mode !== 'lesson') chipShow(`${n ? n + ' — ' : ''}وتر ${c.ar}، ${ev.finger ? FINGER_AR[ev.finger] : 'مطلق'}، ريشة ${ev.risha === 'down' ? 'نازلة ↓' : 'صاعدة ↑'}`);
    if (S.mode === 'lesson' && ev.idx != null) { S.stripHi = ev.idx; strip.querySelectorAll('.nt').forEach((d) => d.classList.toggle('on', +d.dataset.i === ev.idx)); const on = strip.querySelector('.nt.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' }); }
    if (S.mode === 'guided' && guide.ex) { const want = guide.ex.events[guide.i]; if (want && ev.course === want.course && ev.semis === want.semis) { showGuide('ok'); setTimeout(() => { if (guide.i < guide.ex.events.length - 1) stepGuide(1); }, 650); } else if (!ev.demo) { gMsg.dataset.fb = 'bad'; } }
  };
  audio.onstate = (st) => { if (st === 'failed') { status.textContent = 'المتصفح لا يدعم الصوت'; status.classList.remove('hidden'); } };

  function frame(dt) {
    updateViewOffset(dt); updateLabels();
    if (S.mode === 'lesson' && lesson.playing && !perf.playing && perf.seqEnd == null) { if (lesson.loop) playLesson(); else stopLesson(); }
    if (S.mode === 'lesson' && lesson.playing && perf.seqEnd != null && perf.t > perf.seqEnd + 0.6) { perf.seqEnd = null; if (lesson.loop) playLesson(); else stopLesson(); }
  }
  layout(); setMode(qs.get('mode') || 'free');
  if (qs.get('view') && VIEWS[qs.get('view')]) setTimeout(() => setView(qs.get('view')), 0);
  return { setMode, setView, zoom, frame, S, setNames, selectPart, playCell, switchPerformer, guide, lesson, playLesson, stopLesson, cellFromHit, pickAt };
}
