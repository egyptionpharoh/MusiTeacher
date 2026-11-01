// =====================================================================
//  الواجهة: ثلاثة أوضاع (تعرّف على الآلة / عزف حر / تمارين ووضع المعلم)، كاميرا (إدارة/زوايا/تكبير/إعادة)،
//  لوحة جانبية قابلة للطي، تفاعل بالماوس واللمس (عدة أصابع معًا) ولوحة الحاسوب، وزر «استبدال العازف».
//  القاعدة: الأورج والعازف هما البطل؛ لا نصوص فوق مواضع العزف، والمعلومات عند الطلب فقط.
// =====================================================================
import * as THREE from 'three';
import { PARTS, KEYS, VOICES, voiceById, noteName, keyById, pc, arNum } from '../instrument/organ-data.js';
import { EXERCISES, LEVEL_AR, Lesson } from '../teaching/exercises.js';
import { drawScore } from '../teaching/score.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) e.append(c && c.nodeType ? c : document.createTextNode(c ?? '')); return e; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const VIEWS = {
  default: { ar: 'الزاوية الافتراضية', th: -0.95, ph: 1.08, d: 1.75, t: [0.0, 0.82, 0.30] },
  front: { ar: 'العازف من الأمام (مقابل الطلاب)', th: 0.3, ph: 0.85, d: 2.0, t: [0.0, 0.88, 0.30] },
  keys: { ar: 'لوحة المفاتيح (من فوق كتف العازف)', th: 2.05, ph: 0.62, d: 0.95, t: [-0.03, 0.75, 0.50] },
  right: { ar: 'اليد اليمنى', th: -1.25, ph: 0.92, d: 0.78, t: [-0.04, 0.76, 0.42] },
  left: { ar: 'اليد اليسرى', th: 1.3, ph: 0.92, d: 0.78, t: [0.12, 0.76, 0.42] },
  panel: { ar: 'لوحة التحكم والشاشة', th: 3.14, ph: 0.35, d: 0.78, t: [0.0, 0.78, 0.62] },
  side: { ar: 'من الجانب (وضعية الجلوس)', th: -1.57, ph: 1.32, d: 2.2, t: [0.0, 0.72, 0.25] },
  top: { ar: 'من أعلى', th: 0.25, ph: 0.32, d: 1.8, t: [0.0, 0.74, 0.35] },
  sheet: { ar: 'النوتة على الحامل (كما يراها العازف)', th: Math.PI, ph: 1.15, d: 0.42, t: [-0.03, 0.87, 0.69] },
  thumbR: { ar: 'عبور الإبهام — اليد اليمنى (من جهة الإبهام)', th: 0.95, ph: 0.85, d: 0.46, t: [-0.03, 0.765, 0.40] },
  thumbL: { ar: 'عبور الإبهام — اليد اليسرى (من جهة الإبهام)', th: -0.95, ph: 0.85, d: 0.46, t: [0.11, 0.765, 0.40] },
};
const LIT = { hint: 0x35c5ff, demo: 0x6bff8a, sel: 0xffc83a, c: 0xff9d3a };
const NAME_MODES = { off: 'بلا أسماء', ar: 'عربية (دو ري مي)', aroct: 'عربية مع الطبقة (دو٤)', en: 'غربية (C D E)', enoct: 'غربية مع الطبقة (C4)' };

export function buildUI(ctx) {
  const { scene, camera, canvas, organ, perf, audio, cam } = ctx;
  const root = $('#ui'); root.innerHTML = '';
  const S = { mode: 'free', panelOpen: innerWidth > 760, hidden: false, names: 'off', showC: false, clean: new URLSearchParams(location.search).has('clean'), score: innerWidth > 760, scoreBig: false, hi: new Set(), scoreDirty: true };

  // ---------------- شريط علوي ----------------
  const modeBtns = {};
  const mkMode = (id, label) => (modeBtns[id] = el('button', { class: 'tab', onclick: () => setMode(id) }, label));
  const viewMenu = el('div', { class: 'menu hidden', id: 'view-menu' }, Object.entries(VIEWS).map(([k, v]) => el('button', { onclick: () => { setView(k); closeMenus(); } }, v.ar)));
  const btnView = el('button', { class: 'ibtn', title: 'زوايا الكاميرا', onclick: (e) => { e.stopPropagation(); toggleMenu(viewMenu); } }, '🎥 الكاميرا ▾');
  // ---------- استبدال العازف: عازفة ⇄ عازف (يُحفظ في هذا المتصفح، مشترك مع لعبتي الكمان والأكورديون) ----------
  const perfLbl = () => '🔄 استبدال العازف';
  const btnPerf = el('button', { class: 'ibtn perf-btn', id: 'btn-performer', title: 'استبدال العازف: عازفة ⇄ عازف (الأورج والتمرين والصوت والكاميرا لا تتغير)', 'aria-label': 'تبديل شخصية العازف', onclick: () => switchPerformer() }, perfLbl());
  async function switchPerformer() {
    if (!ctx.performer || btnPerf.disabled) return;
    const next = ctx.performer.get() === 'male' ? 'female' : 'male';
    btnPerf.disabled = true; btnPerf.classList.add('busy');
    const wasDemo = lesson.mode;
    const done = await ctx.performer.set(next, (st) => { if (st === 'loading') btnPerf.textContent = '⏳ جارٍ الاستبدال…'; });
    btnPerf.textContent = perfLbl(); btnPerf.disabled = false; btnPerf.classList.remove('busy');
    if (wasDemo === 'practice' && lesson.ex && lesson.ex.kind === 'sequence' && lesson.opts.wait) lesson.showStep();   // يستأنف الطالب من خطوته نفسها
    return done;
  }
  const top = el('div', { id: 'topbar' },
    el('div', { class: 'brand' }, '🎹 الأورج الافتراضي'),
    el('div', { class: 'tabs' }, mkMode('identify', 'تعرّف على الآلة'), mkMode('free', 'عزف حر'), mkMode('lesson', 'تمارين')),
    el('div', { class: 'tools' },
      el('div', { class: 'menuwrap' }, btnView, viewMenu),
      el('button', { class: 'ibtn', title: 'تكبير', onclick: () => zoom(-0.15) }, '＋'),
      el('button', { class: 'ibtn', title: 'تصغير', onclick: () => zoom(0.15) }, '－'),
      el('button', { class: 'ibtn', title: 'إعادة الكاميرا إلى وضعها الافتراضي', onclick: () => setView('default') }, '⟲'),
      el('button', { class: 'ibtn', title: 'إخفاء/إظهار اللوحات (H)', id: 'btn-hide', onclick: () => toggleHidden() }, '👁'),
      btnPerf,
      el('button', { class: 'ibtn', title: 'الحقوق والمصادر', onclick: () => $('#credits').classList.toggle('hidden') }, 'ⓘ')));
  const sidebar = el('aside', { id: 'side' });
  const handle = el('button', { id: 'side-toggle', title: 'إظهار/إخفاء اللوحة', onclick: () => { S.panelOpen = !S.panelOpen; layout(); } }, '☰');
  const chip = el('div', { id: 'chip', class: 'hidden' });
  const status = el('div', { id: 'status', class: 'hidden' }, '');
  const credits = el('div', { id: 'credits', class: 'modal hidden' }, el('div', { class: 'card' },
    el('h3', {}, 'الحقوق والمصادر'),
    el('p', {}, 'أصوات الأورج (كلاسيكي، كنيسة، جاز، ناعم): مولَّدة برمجيًا داخل اللعبة بتركيب التوافقيات على طريقة قضبان الأورج — لا تستعمل أي تسجيلات خارجية.'),
    el('p', {}, 'صوت البيانو: عينات Salamander Grand Piano V3 — Alexander Holm — ترخيص CC BY 3.0.'),
    el('p', {}, 'الأورج والحامل والمقعد والدواسة والسجادة: مجسّمات إجرائية أُنشئت برمجيًا لهذه اللعبة. العرض: three.js (MIT).'),
    el('p', {}, 'العازفة: النموذج نفسه المستخدم في لعبتي عازفة الكمان والأكورديون (مُصدَّر من MakeHuman). العازف: النموذج نفسه بأهداف التشكيل الذكرية من MakeHuman/MPFB2 (ترخيص CC0)، والمصر والدشداشة واللحية مولّدة برمجيًا.'),
    el('p', {}, 'الألحان: «نشيد الفرح» (بيتهوفن) و«تلألئي يا نجمة» (لحن شعبي فرنسي قديم) — ملكية عامة.'),
    el('button', { class: 'ibtn', onclick: () => $('#credits').classList.add('hidden') }, 'إغلاق')));
  // ---------- لوحة النوتة (للطلاب على السبورة): نوتة التمرين الحالي بترقيم الأصابع، والنغمة الجارية مضاءة ----------
  const scoreCv = el('canvas', { id: 'score-cv' });
  const scoreTitle = el('span', { class: 'st' }, '');
  const dock = el('div', { id: 'score-dock', class: 'hidden', dir: 'rtl' },
    el('div', { class: 'sd-head' }, el('b', {}, '🎼 النوتة'), scoreTitle,
      el('button', { class: 'sd-btn', title: 'تكبير/تصغير لوحة النوتة', onclick: () => { S.scoreBig = !S.scoreBig; layout(); } }, '⤢'),
      el('button', { class: 'sd-btn', title: 'إخفاء النوتة', onclick: () => setScoreVisible(false) }, '✕')),
    scoreCv);
  root.append(top, sidebar, handle, chip, status, credits, dock);

  function toggleMenu(m) { const was = m.classList.contains('hidden'); closeMenus(); if (was) m.classList.remove('hidden'); }
  function closeMenus() { root.querySelectorAll('.menu').forEach((m) => m.classList.add('hidden')); }
  addEventListener('pointerdown', (e) => { if (!e.target.closest('.menuwrap')) closeMenus(); });

  // ---------------- التخطيط وإزاحة الكاميرا عند فتح اللوحة ----------------
  let shiftNow = 0;
  function layout() {
    sidebar.classList.toggle('open', S.panelOpen && !S.hidden); handle.classList.toggle('hidden', S.hidden);
    root.classList.toggle('hide-all', S.hidden); document.body.classList.toggle('panel-open', S.panelOpen && !S.hidden);
    dock.classList.toggle('hidden', !(S.score && S.mode === 'lesson') || S.hidden); dock.classList.toggle('big', S.scoreBig);
    S.scoreDirty = true;
  }
  function setScoreVisible(on) { S.score = on; root.querySelectorAll('[data-score]').forEach((c) => { c.checked = on; }); layout(); }
  function toggleHidden() { S.hidden = !S.hidden; layout(); }
  function updateViewOffset(dt) {
    const w = innerWidth, h = innerHeight, narrow = w < 760;
    const goal = (S.panelOpen && !S.hidden && !narrow && !S.clean) ? Math.min(330, w * 0.34) : 0;
    // لوحة النوتة أسفل الشاشة (أو أعلاها في الهاتف): نزيح المشهد بنصف ارتفاعها فلا تغطي اليدين والمفاتيح
    const dh = dock.classList.contains('hidden') || S.clean ? 0 : dock.offsetHeight + 8, goalY = narrow ? -dh / 2 : dh / 2;
    shiftNow += (goal - shiftNow) * (1 - Math.pow(0.001, dt)); S.shiftY = (S.shiftY || 0) + (goalY - (S.shiftY || 0)) * (1 - Math.pow(0.001, dt));
    if (Math.abs(shiftNow) < 0.5 && Math.abs(S.shiftY) < 0.5) { if (camera.view && camera.view.enabled) camera.clearViewOffset(); }
    else camera.setViewOffset(w, h, shiftNow / 2, S.shiftY, w, h);
  }
  function setView(k) { const v = VIEWS[k]; Object.assign(cam.goal, { th: v.th, ph: v.ph, d: v.d }); cam.goal.t.set(...v.t); }
  function zoom(f) { cam.goal.d = clamp(cam.goal.d * (1 + f), 0.4, 4.5); }

  // ---------------- الأوضاع ----------------
  function setMode(m) {
    S.mode = m; Object.entries(modeBtns).forEach(([k, b]) => b.classList.toggle('on', k === m));
    lesson.stop(); clearHighlight(); perf.releaseAll(); setLit([]);
    sidebar.replaceChildren(); if (!S.booted) { S.panelOpen = innerWidth > 760; S.booted = true; } layout();
    if (m === 'identify') buildIdentify(); else if (m === 'free') buildFree(); else buildLesson();
    chip.classList.add('hidden'); applyCLit();
  }
  const section = (title, open, ...kids) => el('details', { class: 'sec', open: open || false }, el('summary', {}, title), el('div', { class: 'secbody' }, kids));
  const namesSelect = () => { const s = el('select', { 'data-names': 1, onchange: (e) => setNames(e.target.value) }, Object.entries(NAME_MODES).map(([k, v]) => el('option', { value: k }, v))); s.value = S.names; return s; };
  const voiceSelect = () => { const s = el('select', { 'data-voice': 1, onchange: (e) => setVoice(e.target.value) }, VOICES.map((v) => el('option', { value: v.id }, `${v.no} · ${v.ar}`))); s.value = audio.voice.id; return s; };
  const showCBox = () => { const c = el('input', { type: 'checkbox', 'data-showc': 1, onchange: (e) => { S.showC = e.target.checked; applyCLit(); syncChecks(); } }); c.checked = S.showC; return el('label', { class: 'row' }, c, ' إظهار كل نغمات «دو» على اللوحة'); };
  function syncChecks() { root.querySelectorAll('[data-showc]').forEach((c) => { c.checked = S.showC; }); root.querySelectorAll('[data-names]').forEach((c) => { c.value = S.names; }); root.querySelectorAll('[data-voice]').forEach((c) => { c.value = audio.voice.id; }); }

  // ---------- وضع التعرّف ----------
  const infoCard = el('div', { id: 'info-card' }, el('p', { class: 'hint' }, 'اضغط على أي جزء من الأورج لمعرفة اسمه ووظيفته، أو اختر من القائمة.'));
  const PART_ORDER = ['keyboard', 'whitekey', 'blackkey', 'middlec', 'power', 'volume', 'screen', 'voices', 'rhythms', 'tempo', 'speaker', 'wheel', 'musicrest', 'stand', 'bench', 'pedal'];
  function buildIdentify() {
    const list = el('div', { class: 'plist' }, PART_ORDER.map((k) => el('button', { onclick: () => selectPart(k, null, true) }, PARTS[k].ar)));
    sidebar.append(el('h2', {}, 'تعرّف على الآلة'), infoCard, section('مكوّنات الأورج', true, list), section('مكان نغمة دو', true, el('p', { class: 'small' }, 'نغمة دو هي المفتاح الأبيض يسار كل مفتاحين أسودين. في هذا الأورج خمس نغمات دو كاملة الطبقات وسادسة في الأعلى.'), showCBox()));
  }
  function showInfo(part, ud) {
    const p = PARTS[part]; if (!p) return;
    let extra = '';
    if (ud && ud.midi) extra = `النغمة: ${noteName(ud.midi, 'ar', true)} (${noteName(ud.midi, 'en', true)})`;
    if (ud && ud.voiceIndex != null && VOICES[ud.voiceIndex]) extra = `هذا الزر يختار صوت: ${VOICES[ud.voiceIndex].ar}`;
    infoCard.replaceChildren(el('h3', {}, p.ar), el('p', {}, p.text), extra && el('p', { class: 'extra' }, extra));
    S.panelOpen = true; layout();
  }
  let hl = null;
  function clearHighlight() { if (hl) { for (const l of hl.lines) { scene.remove(l.line); l.line.geometry.dispose(); } hl = null; } }
  function highlightMeshes(meshes) {
    clearHighlight(); if (!meshes.length) return;
    hl = { lines: meshes.slice(0, 80).map((mesh) => { const line = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), new THREE.LineBasicMaterial({ color: 0xffd25a, depthTest: false, transparent: true })); line.renderOrder = 10; line.matrixAutoUpdate = false; scene.add(line); return { line, mesh }; }) };
  }
  const PART_VIEW = { keyboard: 'keys', whitekey: 'right', blackkey: 'right', middlec: 'keys', power: 'panel', volume: 'panel', screen: 'panel', voices: 'panel', rhythms: 'panel', tempo: 'panel', speaker: 'panel', wheel: 'panel', musicrest: 'front', stand: 'side', bench: 'side', pedal: 'side' };
  function selectPart(part, mesh, fromList) {
    if (fromList) {
      let ms;
      if (part === 'keyboard') ms = organ.pickables.filter((o) => o.userData.keyId);
      else if (part === 'middlec') ms = [organ.keys.k60.mesh];
      else ms = organ.pickables.filter((o) => o.userData.part === part);
      highlightMeshes(ms); if (PART_VIEW[part]) setView(PART_VIEW[part]);
      if (part === 'middlec') { setLit([{ id: 'k60', color: 'sel' }]); }
      showInfo(part); return;
    }
    if (mesh.userData.keyId === 'k60') { highlightMeshes([mesh]); showInfo('middlec', mesh.userData); return; }
    highlightMeshes([mesh]); showInfo(part, mesh.userData);
  }

  // ---------- العزف الحر ----------
  function buildFree() {
    const vol = el('input', { type: 'range', style: 'direction:ltr', min: 0, max: 100, value: Math.round(audio.vol * 100), oninput: (e) => { audio.setVolume(e.target.value / 100); organ.setKnob(e.target.value / 100); } });
    const sus = el('input', { type: 'checkbox', onchange: (e) => setSustain(e.target.checked) });
    sidebar.append(el('h2', {}, 'عزف حر'),
      el('p', { class: 'hint' }, 'اضغط المفاتيح بالماوس أو بأصابعك (يمكن الضغط على عدة مفاتيح معًا)، واسحب على المفاتيح لعزف متدرّج. ما دون دو الوسطى تعزفه اليد اليسرى، وما فوقها اليمنى.'),
      section('الصوت', true, el('label', {}, 'الصوت'), voiceSelect(), el('label', {}, 'مستوى الصوت'), vol, el('label', { class: 'row' }, sus, ' دواسة الاستمرار (المسافة)')),
      section('أسماء النغمات', true, namesSelect(), showCBox()),
      section('لوحة الحاسوب', false, el('p', { class: 'small' }, 'الطبقة الوسطى: Q W E R T Y U I O P = دو٤ … مي٥، والأسود: 2 3 5 6 7 9 0. الطبقة الأخفض: Z X C V B N M = دو٣ … سي٣، والأسود: S D G H J. المسافة: دواسة الاستمرار.')));
  }
  function setVoice(id) { const v = audio.setVoice(id); const i = VOICES.indexOf(v); organ.setVoiceLed(i); organ.setScreen({ no: v.no, en: v.en, ar: v.ar }); syncChecks(); }
  function setSustain(on) { audio.setSustain(on); S.sustain = on; }

  // ---------- التمارين ووضع المعلم ----------
  const lessonMsg = el('div', { id: 'lesson-msg', class: 'hint' });
  const lessonUI = {
    setLit(items) { setLit(items); },
    lit(e, color, on) { litOne(e.id, on ? color : null, on ? e.f : null); if (on) S.hi.add(e); else S.hi.delete(e); S.scoreDirty = true; },
    onLesson(e) {
      if (e.type === 'step') { S.hi = new Set(e.items); S.scoreDirty = true; }
      else if (['stop', 'load', 'done', 'demo-end', 'demo-start', 'practice-start'].includes(e.type)) { S.hi.clear(); S.scoreDirty = true; }
      if (e.type === 'load') { lessonMsg.className = 'hint'; lessonMsg.textContent = e.ex.desc; }
      else if (e.type === 'question') { lessonMsg.className = 'q'; lessonMsg.textContent = `السؤال ${arNum(e.i)}/${arNum(e.n)} — ${e.text}`; }
      else if (e.type === 'step') { lessonMsg.className = 'q'; lessonMsg.textContent = `الخطوة ${arNum(e.i)}/${arNum(e.n)}: ` + e.items.map((x) => `${noteName(x.midi, 'ar', true)} (${x.hand === 'L' ? 'يسرى' : 'يمنى'}${x.f ? '، إصبع ' + arNum(x.f) : ''})`).join(' + '); }
      else if (e.type === 'feedback') { lessonMsg.dataset.fb = e.ok ? 'ok' : 'bad'; if (e.text.length > 2) chipShow(e.text); setTimeout(() => { lessonMsg.dataset.fb = ''; }, 500); }
      else if (e.type === 'done') { lessonMsg.className = 'q done'; lessonMsg.textContent = `انتهى التمرين — صحيح ${arNum(e.ok)} · خطأ ${arNum(e.bad)} · الدقة ${arNum(e.pct)}٪`; }
      else if (e.type === 'demo-start') { lessonMsg.className = 'hint'; lessonMsg.textContent = 'النموذج يعزف… شاهد اليدين وأرقام الأصابع'; }
      else if (e.type === 'demo-note') { organ.setScreen({ note: noteName(e.e.midi, 'ar', true) }); }
      else if (e.type === 'demo-end') lessonMsg.textContent = e.again ? 'يُعاد النموذج…' : 'انتهى العرض — جرّب أنت الآن (ابدأ التدريب)';
    },
  };
  const lesson = new Lesson(perf, lessonUI);
  function buildLesson() {
    const levelSel = el('select', { id: 'lvl' }, el('option', { value: 0 }, 'كل المستويات'), ...[1, 2, 3].map((l) => el('option', { value: l }, LEVEL_AR[l])));
    const exSel = el('select', { id: 'exsel' });
    const tempoV = el('b', {}, '72');
    const tempo = el('input', { type: 'range', style: 'direction:ltr', min: 30, max: 160, value: 72, oninput: (e) => { lesson.opts.bpm = +e.target.value; tempoV.textContent = e.target.value; organ.setScreen({ tempo: +e.target.value }); S.scoreDirty = true; } });
    const demoBtn = el('button', { class: 'btn', id: 'demo-btn', onclick: () => { audio.init(); audio.resume(); lesson.demo(); } }, '▶ تشغيل نموذج الأداء');
    const fill = () => { exSel.replaceChildren(...EXERCISES.filter((e) => +levelSel.value === 0 || e.level === +levelSel.value).map((e) => el('option', { value: e.id }, `${LEVEL_AR[e.level]} · ${e.title}`))); pick(); };
    const pick = () => {
      const ex = EXERCISES.find((e) => e.id === exSel.value); if (!ex) return;
      lesson.load(ex); tempo.value = lesson.opts.bpm; tempoV.textContent = lesson.opts.bpm; organ.setScreen({ tempo: lesson.opts.bpm });
      if (ex.events) { S.sheetEx = ex; S.scoreDirty = true; }
      const rec = ex.kind === 'recognize'; demoBtn.disabled = rec; $('#t-tempo') && ($('#t-tempo').style.display = rec ? 'none' : '');
      // تمارين السلالم: زاوية تُظهر عبور الإبهام تحت الكف بوضوح
      const scale = /^scale-/.test(ex.id);
      setView(rec ? 'keys' : scale && ex.hands !== 'B' ? (ex.hands === 'L' ? 'thumbL' : 'thumbR') : ex.hands === 'L' ? 'left' : ex.hands === 'R' ? 'right' : 'default');
    };
    levelSel.addEventListener('change', fill); exSel.addEventListener('change', pick);
    const chk = (label, key, extra) => { const c = el('input', { type: 'checkbox', onchange: (e) => { lesson.opts[key] = e.target.checked; extra && extra(e.target.checked); } }); c.checked = !!lesson.opts[key]; return el('label', { class: 'row' }, c, ' ' + label); };
    sidebar.append(el('h2', {}, 'تمارين'),
      section('اختيار التمرين', true, el('label', {}, 'مستوى الصعوبة'), levelSel, el('label', {}, 'التمرين'), exSel, lessonMsg),
      el('div', { class: 'btnrow' }, demoBtn, el('button', { class: 'btn pri', onclick: () => { audio.init(); audio.resume(); lesson.practice(); } }, '🎹 ابدأ التدريب'), el('button', { class: 'btn', onclick: () => lesson.stop() }, '■ إيقاف')),
      section('إعدادات المعلّم', true,
        el('div', { id: 't-tempo' }, el('label', {}, 'السرعة: ', tempoV, ' نبضة/دقيقة'), tempo),
        chk('انتظار الطالب حتى يضغط الصحيح (بدون إيقاع)', 'wait'),
        chk('إضاءة المفاتيح المطلوبة', 'hints'),
        chk('أرقام الأصابع على المفاتيح', 'fingers'),
        chk('المترونوم (نقرة كل نبضة)', 'metronome'),
        chk('تكرار نموذج الأداء دون توقف (لمشاهدة الحركة عدة مرات)', 'loop'),
        (() => { const c = el('input', { type: 'checkbox', 'data-score': 1, onchange: (e) => setScoreVisible(e.target.checked) }); c.checked = S.score; return el('label', { class: 'row' }, c, ' لوحة النوتة للطلاب (مع ترقيم الأصابع)'); })(),
        el('div', { class: 'btnrow' }, el('button', { class: 'btn', title: 'تبطيء العرض لمشاهدة عبور الإبهام', onclick: () => { lesson.opts.bpm = 40; tempo.value = 40; tempoV.textContent = '40'; organ.setScreen({ tempo: 40 }); S.scoreDirty = true; } }, '🐢 سرعة بطيئة (٤٠)'), el('button', { class: 'btn', onclick: () => { setView('sheet'); } }, '📖 النوتة على الحامل')),
        el('label', {}, 'أسماء النغمات'), namesSelect(),
        el('label', {}, 'الصوت'), voiceSelect()));
    fill();
  }

  // ---------------- الإضاءة وأرقام الأصابع وأسماء النغمات على المفاتيح ----------------
  const badges = new Map();      // id -> sprite (رقم الإصبع)
  function makeLabel(text, size, bg = 'rgba(20,16,12,.80)', fg = '#ffe9b0') {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = bg; g.beginPath(); g.roundRect(4, 6, 120, 52, 16); g.fill(); g.fillStyle = fg; g.font = `700 ${text.length > 3 ? 30 : 38}px Tajawal,Tahoma,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, depthWrite: false, transparent: true })); sp.scale.set(size * 2, size, 1); sp.renderOrder = 8; return sp;   // تختفي خلف اليدين والرأس
  }
  function litOne(id, color, finger) {
    const k = organ.keys[id]; if (!k) return;
    if (color) organ.setLit(id, true, LIT[color] || color); else { organ.setLit(id, false); if (S.showC && pc(k.midi) === 0) organ.setLit(id, true, LIT.c); }
    const old = badges.get(id); if (old) { old.parent && old.parent.remove(old); badges.delete(id); }
    if (color && finger && lesson.opts.fingers) {
      const b = makeLabel(arNum(finger), 0.016, color === 'demo' ? 'rgba(20,90,40,.92)' : 'rgba(10,70,110,.92)', '#ffffff');
      b.position.set(-k.thick / 2 - 0.028, 0, k.black ? 0 : -k.len / 2 + 0.03); k.mesh.add(b); badges.set(id, b);
    }
  }
  function setLit(items) {
    for (const id of [...badges.keys()]) litOne(id, null);
    organ.clearLit(); applyCLit();
    for (const it of items) litOne(it.id, it.color || 'hint', it.f);
  }
  function applyCLit() { for (const k of Object.values(organ.keys)) if (pc(k.midi) === 0 && !badges.has(k.id)) organ.setLit(k.id, S.showC, LIT.c); }
  let labels = null;
  function setNames(mode) {
    S.names = mode; S.scoreDirty = true;
    if (labels) { for (const k of Object.values(organ.keys)) if (k.label) { k.label.parent.remove(k.label); k.label = null; } }
    labels = null;
    if (mode !== 'off') {
      labels = true;
      const lang = mode.startsWith('ar') ? 'ar' : 'en', oct = mode.endsWith('oct');
      for (const k of Object.values(organ.keys)) {
        const s = makeLabel(noteName(k.midi, lang, oct), k.black ? 0.0085 : 0.0105);
        s.position.set(-k.thick / 2 - 0.004, 0, k.black ? -k.len / 2 + 0.03 : -k.len / 2 + 0.012); k.mesh.add(s); k.label = s;
      }
    }
    syncChecks();
  }

  // ---------------- التفاعل: التقاط، ضغط (عدة مؤشرات)، سحب الكاميرا ----------------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(cx, cy) {
    const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(organ.pickables, false)[0]; return hit ? hit.object : null;
  }
  const down = new Map();
  let pinch = null;
  const playable = () => S.mode === 'free' || S.mode === 'lesson';
  function userPress(id, vel) {
    audio.init(); audio.resume();
    const r = perf.press(id, vel ?? (0.62 + Math.random() * 0.2));
    lesson.onUserPress(id);
    return r;
  }
  canvas.addEventListener('pointerdown', (e) => {
    audio.init(); audio.resume(); try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* */ }
    const mesh = pickAt(e.clientX, e.clientY), id = mesh && mesh.userData.keyId;
    if (S.mode === 'identify' && mesh) { selectPart(mesh.userData.part, mesh); if (id) { perf.press(id, 0.7); down.set(e.pointerId, { kind: 'play', id }); } else down.set(e.pointerId, { kind: 'tap' }); return; }
    if (playable() && id) { down.set(e.pointerId, { kind: 'play', id }); userPress(id); return; }
    if (mesh && mesh.userData.voiceIndex != null && VOICES[mesh.userData.voiceIndex]) { setVoice(VOICES[mesh.userData.voiceIndex].id); chipShow('الصوت: ' + VOICES[mesh.userData.voiceIndex].ar); }
    down.set(e.pointerId, { kind: 'cam', x: e.clientX, y: e.clientY });
    const camPts = [...down.values()].filter((d) => d.kind === 'cam');
    if (camPts.length === 2) pinch = { d: Math.hypot(camPts[0].x - camPts[1].x, camPts[0].y - camPts[1].y), cd: cam.goal.d };
  });
  canvas.addEventListener('pointermove', (e) => {
    const st = down.get(e.pointerId);
    if (!st) { const m = pickAt(e.clientX, e.clientY); canvas.style.cursor = m && (S.mode === 'identify' || m.userData.keyId) ? 'pointer' : 'grab'; return; }
    if (st.kind === 'play') {
      const m = pickAt(e.clientX, e.clientY), id = m && m.userData.keyId;
      if (id && id !== st.id && playable()) { perf.release(st.id); st.id = id; userPress(id); }
    } else if (st.kind === 'cam') {
      if (pinch) { const pts = [...down.entries()].filter(([, v]) => v.kind === 'cam').map(([k, v]) => (k === e.pointerId ? { x: e.clientX, y: e.clientY } : v)); if (pts.length >= 2) { const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); cam.goal.d = clamp(pinch.cd * pinch.d / Math.max(20, d), 0.4, 4.5); } st.x = e.clientX; st.y = e.clientY; return; }
      cam.goal.th -= (e.clientX - st.x) * 0.0065; cam.goal.ph = clamp(cam.goal.ph - (e.clientY - st.y) * 0.0055, 0.15, 2.2); st.x = e.clientX; st.y = e.clientY;
    }
  });
  const up = (e) => { const st = down.get(e.pointerId); if (st && st.kind === 'play') perf.release(st.id); down.delete(e.pointerId); if ([...down.values()].filter((d) => d.kind === 'cam').length < 2) pinch = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(Math.sign(e.deltaY) * 0.08); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // لوحة الحاسوب (تخطيط «المتتبع» الشائع): صفّان لطبقتين
  const KM = { KeyQ: 60, Digit2: 61, KeyW: 62, Digit3: 63, KeyE: 64, KeyR: 65, Digit5: 66, KeyT: 67, Digit6: 68, KeyY: 69, Digit7: 70, KeyU: 71, KeyI: 72, Digit9: 73, KeyO: 74, Digit0: 75, KeyP: 76,
    KeyZ: 48, KeyS: 49, KeyX: 50, KeyD: 51, KeyC: 52, KeyV: 53, KeyG: 54, KeyB: 55, KeyH: 56, KeyN: 57, KeyJ: 58, KeyM: 59 };
  const kheld = new Map();
  addEventListener('keydown', (e) => {
    const tg = e.target; if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || (tg && tg.matches && tg.matches('input,select,textarea'))) return;
    if (e.code === 'Space') { e.preventDefault(); setSustain(true); return; }
    if (e.code === 'KeyH' && S.mode !== 'free' && S.mode !== 'lesson') { toggleHidden(); return; }
    const m = KM[e.code]; if (m == null || !playable()) return;
    const id = 'k' + m; kheld.set(e.code, id); userPress(id, 0.75);
  });
  addEventListener('keyup', (e) => {
    if (e.code === 'Space') { setSustain(false); return; }
    const id = kheld.get(e.code); if (id) { perf.release(id); kheld.delete(e.code); }
  });

  // ---------------- كل إطار ----------------
  function chipShow(text) { chip.textContent = text; chip.classList.remove('hidden'); clearTimeout(chip._t); chip._t = setTimeout(() => chip.classList.add('hidden'), 1300); }
  perf.onEvent = (ev) => {
    if (ev.type !== 'on') return;
    const nm = noteName(ev.midi, S.names.startsWith('en') ? 'en' : 'ar', true);     // لغة واحدة كما اختارها المعلم (لا خلط)
    chipShow(`${nm} — ${ev.hand === 'L' ? 'اليد اليسرى' : 'اليد اليمنى'}، الإصبع ${arNum(ev.finger)}`);
    organ.setScreen({ note: noteName(ev.midi, 'ar', true) });
  };
  audio.onstate = (st) => {
    const msg = { 'loading-piano': 'جارٍ تحميل عينات البيانو…', 'piano-ready': 'البيانو جاهز', 'piano-failed': 'تعذّر تحميل البيانو — يُستعمل صوت الأورج الناعم', failed: 'المتصفح لا يدعم الصوت' }[st];
    if (!msg) return; status.textContent = msg; status.classList.remove('hidden'); clearTimeout(status._t); if (st !== 'loading-piano') status._t = setTimeout(() => status.classList.add('hidden'), 2200);
  };
  // ---------- رسم النوتة (على الحامل وفي اللوحة) عند أي تغيير ----------
  const DEF_SHEET = EXERCISES.find((e) => e.id === 'scale-r');
  function renderScore() {
    S.scoreDirty = false;
    const ex = S.sheetEx || DEF_SHEET;
    const o = { events: ex.events, hands: ex.hands, title: ex.title, bpm: (S.sheetEx && S.mode === 'lesson') ? lesson.opts.bpm : ex.bpm, names: S.names, hi: S.hi, fingers: true };
    organ.drawSheet((x, w, h) => drawScore(x, { x: w * 0.025, y: h * 0.03, w: w * 0.95, h: h * 0.93 }, o));
    if (!dock.classList.contains('hidden')) {
      const r = scoreCv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), W = Math.max(10, Math.round(r.width * dpr)), H = Math.max(10, Math.round(r.height * dpr));
      if (scoreCv.width !== W || scoreCv.height !== H) { scoreCv.width = W; scoreCv.height = H; }
      const x = scoreCv.getContext('2d'); x.fillStyle = '#f7f3e8'; x.fillRect(0, 0, W, H);
      scoreTitle.textContent = ex.title;
      drawScore(x, { x: 8 * dpr, y: 2 * dpr, w: W - 16 * dpr, h: H - 4 * dpr }, { ...o, title: null, barsPerRow: W / H > 5 ? 8 : 4 });
    }
  }
  addEventListener('resize', () => { S.scoreDirty = true; });
  function frame(dt) {
    if (S.scoreDirty) renderScore();
    updateViewOffset(dt);
    if (hl) for (const l of hl.lines) { l.mesh.updateWorldMatrix(true, false); l.line.matrixWorld.copy(l.mesh.matrixWorld); }
  }
  layout(); setVoice(audio.voice.id); setMode('free');          // الشاشة ولمبة الزر تطابقان الصوت الافتراضي (البيانو)
  return { setMode, setView, zoom, frame, lesson, S, setNames, setVoice, setSustain, toggleHidden, selectPart, pickAt, setLit, switchPerformer, userPress };
}
