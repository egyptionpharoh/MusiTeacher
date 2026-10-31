// =====================================================================
//  الواجهة: ثلاثة أوضاع (تعرّف / عزف حر / تمارين)، كاميرا (إدارة/زوايا/تكبير)، لوحات قابلة للإخفاء، تفاعل ماوس ولمس.
//  القاعدة: الآلة والعازفة هما البطل؛ المعلومات التعليمية لا تظهر إلا عند الطلب وخارج منطقة الأيدي.
// =====================================================================
import * as THREE from 'three';
import { PARTS, TREBLE, BASS, noteName, bassById } from '../instrument/accordion-data.js';
import { EXERCISES, LEVEL_AR, Lesson } from '../teaching/exercises.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) e.append(c && c.nodeType ? c : document.createTextNode(c ?? '')); return e; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const VIEWS = {
  default: { ar: 'الزاوية الافتراضية', th: 0.55, ph: 1.28, d: 1.9, t: [0, 0.88, 0.2] },
  front: { ar: 'من الأمام', th: 0.0, ph: 1.32, d: 1.7, t: [0, 0.86, 0.22] },
  keys: { ar: 'لوحة المفاتيح (اليمنى)', th: -1.2, ph: 1.15, d: 0.95, t: [-0.17, 0.78, 0.3] },
  bass: { ar: 'أزرار الباص (اليسرى)', th: 1.25, ph: 1.15, d: 0.95, t: [0.22, 0.78, 0.28] },
  bellows: { ar: 'المنفاخ', th: 0.25, ph: 1.3, d: 1.15, t: [0.06, 0.8, 0.36] },
  top: { ar: 'من أعلى', th: 0.3, ph: 0.45, d: 1.5, t: [0, 0.8, 0.28] },
  back: { ar: 'من الخلف (الأشرطة)', th: 3.0, ph: 1.3, d: 1.9, t: [0, 0.9, 0.1] },
};
const LIT = { hint: 0x35c5ff, demo: 0x6bff8a, sel: 0xffc83a };

export function buildUI(ctx) {
  const { scene, camera, renderer, canvas, acc, perf, audio, cam, applyCam } = ctx;
  const root = $('#ui'); root.innerHTML = '';
  const S = { mode: 'free', panelOpen: innerWidth > 760, hidden: false, names: false, sel: null };

  // ---------------- شريط علوي ----------------
  const modeBtns = {};
  const mkMode = (id, label) => (modeBtns[id] = el('button', { class: 'tab', onclick: () => setMode(id) }, label));
  const viewMenu = el('div', { class: 'menu hidden', id: 'view-menu' }, Object.entries(VIEWS).map(([k, v]) => el('button', { onclick: () => { setView(k); closeMenus(); } }, v.ar)));
  const btnView = el('button', { class: 'ibtn', title: 'زوايا الكاميرا', onclick: (e) => { e.stopPropagation(); toggleMenu(viewMenu); } }, '🎥 الكاميرا ▾');
  const top = el('div', { id: 'topbar' },
    el('div', { class: 'brand' }, '🪗 الأكورديون الافتراضي'),
    el('div', { class: 'tabs' }, mkMode('identify', 'تعرّف على الآلة'), mkMode('free', 'عزف حر'), mkMode('lesson', 'تمارين')),
    el('div', { class: 'tools' },
      el('div', { class: 'menuwrap' }, btnView, viewMenu),
      el('button', { class: 'ibtn', title: 'تكبير', onclick: () => zoom(-0.18) }, '＋'),
      el('button', { class: 'ibtn', title: 'تصغير', onclick: () => zoom(0.18) }, '－'),
      el('button', { class: 'ibtn', title: 'إعادة ضبط الكاميرا', onclick: () => setView('default') }, '⟲'),
      el('button', { class: 'ibtn', title: 'إخفاء/إظهار اللوحات (H)', id: 'btn-hide', onclick: () => toggleHidden() }, '👁'),
      el('button', { class: 'ibtn', title: 'حقوق الصوت والنماذج', onclick: () => $('#credits').classList.toggle('hidden') }, 'ⓘ')));
  const sidebar = el('aside', { id: 'side' });
  const handle = el('button', { id: 'side-toggle', title: 'إظهار/إخفاء اللوحة', onclick: () => { S.panelOpen = !S.panelOpen; layout(); } }, '☰');
  const chip = el('div', { id: 'chip', class: 'hidden' });                    // اسم النغمة الحالية (أعلى الوسط)
  const status = el('div', { id: 'status' }, 'جارٍ تحميل أصوات الأكورديون…');
  // ---------------- ودجت المنفاخ ----------------
  const airBar = el('div', { class: 'airbar' }, el('i'));
  const dirTxt = el('span', { class: 'dirtxt' }, 'المنفاخ');
  const slider = el('input', { type: 'range', min: -100, max: 100, value: 0, id: 'bel-slider', disabled: true });
  const manual = el('input', { type: 'checkbox', id: 'bel-manual' });
  manual.addEventListener('change', () => { slider.disabled = !manual.checked; perf.setManualBellows(manual.checked ? slider.value / 100 : null); });
  slider.addEventListener('input', () => perf.setManualBellows(slider.value / 100));
  const bellowsBox = el('div', { id: 'bellows-box', class: 'floaty' },
    el('div', { class: 'row' }, dirTxt, el('button', { class: 'ibtn sm', onclick: () => perf.flipBellows(), title: 'تبديل اتجاه المنفاخ (Space)' }, '⇄ تبديل')),
    airBar, el('label', { class: 'row small' }, manual, ' تحكم يدوي'), slider);
  const credits = el('div', { id: 'credits', class: 'modal hidden' }, el('div', { class: 'card' },
    el('h3', {}, 'الحقوق والمصادر'),
    el('p', {}, 'صوت الأكورديون: عينات حقيقية من FluidR3_GM (Frank Wen) — ترخيص CC BY 3.0 US — عبر مشروع midi-js-soundfonts. التعديلات: قصّ وتحويل إلى mp3 وتكرار متقاطع للنغمات الطويلة.'),
    el('p', {}, 'عينات الأكورديون: github.com/gleitz/midi-js-soundfonts (FluidR3_GM).'),
    el('p', {}, 'العازفة: النموذج نفسه المستخدم في لعبة عازفة الكمان (مُصدَّر من MakeHuman). الأكورديون والكرسي والسجادة: مجسّمات إجرائية أُنشئت برمجيًا لهذه اللعبة. العرض: three.js (MIT).'),
    el('p', {}, 'التفاصيل الكاملة والروابط في ملف AUDIO_CREDITS.md داخل المشروع.'),
    el('button', { class: 'ibtn', onclick: () => $('#credits').classList.add('hidden') }, 'إغلاق')));
  root.append(top, sidebar, handle, chip, status, bellowsBox, credits);

  // ---------------- القوائم ----------------
  function toggleMenu(m) { const was = m.classList.contains('hidden'); closeMenus(); if (was) m.classList.remove('hidden'); }
  function closeMenus() { root.querySelectorAll('.menu').forEach((m) => m.classList.add('hidden')); }
  addEventListener('pointerdown', (e) => { if (!e.target.closest('.menuwrap')) closeMenus(); });

  // ---------------- التخطيط وإزاحة الكاميرا ----------------
  let shiftNow = 0;
  function layout() {
    sidebar.classList.toggle('open', S.panelOpen && !S.hidden); handle.classList.toggle('hidden', S.hidden);
    root.classList.toggle('hide-all', S.hidden);
    document.body.classList.toggle('panel-open', S.panelOpen && !S.hidden);
  }
  function toggleHidden() { S.hidden = !S.hidden; layout(); }
  function updateViewOffset(dt) {
    const w = innerWidth, h = innerHeight, narrow = w < 760;
    const goal = (S.panelOpen && !S.hidden && !narrow) ? Math.min(330, w * 0.34) : 0;
    shiftNow += (goal - shiftNow) * (1 - Math.pow(0.001, dt));
    if (Math.abs(shiftNow) < 0.5) { if (camera.view && camera.view.enabled) camera.clearViewOffset(); }
    else camera.setViewOffset(w, h, shiftNow / 2, 0, w, h);
  }
  function setView(k) { const v = VIEWS[k]; Object.assign(cam.goal, { th: v.th, ph: v.ph, d: v.d }); cam.goal.t.set(...v.t); }
  function zoom(f) { cam.goal.d = clamp(cam.goal.d * (1 + f), 0.45, 4.5); }

  // ---------------- الأوضاع ----------------
  function setMode(m) {
    S.mode = m; Object.entries(modeBtns).forEach(([k, b]) => b.classList.toggle('on', k === m));
    lesson.stop(); acc.clearLit(); clearHighlight(); perf.releaseAll();
    sidebar.replaceChildren(); S.panelOpen = innerWidth > 760 || !S.booted; if (innerWidth <= 760 && !S.booted) S.panelOpen = false; S.booted = true; layout();
    if (m === 'identify') buildIdentify(); else if (m === 'free') buildFree(); else buildLesson();
    chip.classList.add('hidden');
  }
  const section = (title, ...kids) => el('details', { class: 'sec', open: true }, el('summary', {}, title), el('div', { class: 'secbody' }, kids));

  // ---------- وضع التعرّف ----------
  const infoCard = el('div', { id: 'info-card' }, el('p', { class: 'hint' }, 'اضغط على أي جزء من الآلة لمعرفة اسمه ووظيفته، أو اختر من القائمة.'));
  function buildIdentify() {
    const list = el('div', { class: 'plist' }, ['keyboard', 'bass', 'bellows', 'rightbox', 'leftbox', 'grille', 'strap', 'baseplate'].map((k) => el('button', { onclick: () => selectPart(k, null, true) }, PARTS[k].ar)));
    sidebar.append(el('h2', {}, 'تعرّف على الآلة'), infoCard, section('الأجزاء', list));
  }
  function showInfo(part, userData) {
    const p = PARTS[part]; if (!p) return;
    let extra = '';
    if (userData && userData.midi) extra = `النغمة: ${noteName(userData.midi)} (${noteName(userData.midi, 'en')})`;
    if (userData && userData.bassId) { const b = bassById[userData.bassId]; extra = `${b.title} — النغمات: ${b.notes.map((n) => noteName(n)).join(' + ')}`; }
    infoCard.replaceChildren(el('h3', {}, p.ar), el('p', {}, p.text), extra && el('p', { class: 'extra' }, extra));
    S.panelOpen = true; layout();
  }
  // إطار تمييز ذهبي حول الجزء المختار
  let hl = null;
  function clearHighlight() { if (hl) { scene.remove(hl.line); hl.line.geometry.dispose(); hl = null; } }
  function highlightMesh(mesh) {
    clearHighlight(); if (!mesh) return;
    const eg = new THREE.EdgesGeometry(mesh.geometry, 25), line = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0xffd25a, depthTest: false, transparent: true }));
    line.renderOrder = 10; line.matrixAutoUpdate = false; scene.add(line); hl = { line, mesh };
  }
  function selectPart(part, mesh, fromList) {
    if (fromList) { const m = acc.pickables.find((o) => o.userData.part === part); highlightMesh(m); const wp = (m || acc.root).getWorldPosition(new THREE.Vector3()); if (part === 'keyboard') setView('keys'); else if (part === 'bass') setView('bass'); else if (part === 'bellows') setView('bellows'); else if (part === 'strap') setView('back'); else if (part === 'grille' || part === 'baseplate' || part === 'rightbox' || part === 'leftbox') setView('front'); showInfo(part); return; }
    highlightMesh(mesh); showInfo(part, mesh && mesh.userData);
  }

  // ---------- العزف الحر ----------
  function buildFree() {
    const names = el('input', { type: 'checkbox', onchange: (e) => setNames(e.target.checked) });
    sidebar.append(el('h2', {}, 'عزف حر'),
      el('p', { class: 'hint' }, 'اضغط المفاتيح (يمين) والأزرار (يسار) بالماوس أو بإصبعك. اسحب على المفاتيح لعزف متدرّج. الصوت يتبع حركة المنفاخ.'),
      section('لوحة الحاسوب', el('p', { class: 'small' }, 'اليمنى: A S D F G H J K L ; = دو…مي (٤–٥)، وW E T Y U O للمفاتيح السوداء. اليسرى: Z X C V B N M. المسافة: تبديل المنفاخ.')),
      section('عرض', el('label', { class: 'row' }, names, ' أسماء المفاتيح والأزرار على الآلة')));
  }

  // ---------- التمارين ----------
  const lessonBox = el('div', { id: 'lesson-box' });
  const lessonMsg = el('div', { id: 'lesson-msg', class: 'hint' });
  const lessonUI = {
    setLit(items) { acc.clearLit(); for (const it of items) acc.setLit(it.id, true, LIT[it.color] || LIT.hint); },
    onLesson(e) {
      if (e.type === 'load') lessonMsg.textContent = e.ex.desc;
      else if (e.type === 'question') { lessonMsg.textContent = `السؤال ${e.i}/${e.n} — ${e.text}`; lessonMsg.className = 'q'; }
      else if (e.type === 'step') { lessonMsg.textContent = `الخطوة ${e.i}/${e.n}: ` + e.items.map((x) => (x.side === 'R' ? noteName(x.midi) : bassById[x.id].title)).join(' + '); lessonMsg.className = 'q'; }
      else if (e.type === 'feedback') { lessonMsg.dataset.fb = e.ok ? 'ok' : 'bad'; lessonMsg.textContent = e.text; setTimeout(() => { lessonMsg.dataset.fb = ''; }, 600); }
      else if (e.type === 'done') { lessonMsg.className = 'q done'; lessonMsg.textContent = `انتهى التمرين — صحيح ${e.ok} · خطأ ${e.bad} · الدقة ${e.pct}%`; }
      else if (e.type === 'demo-start') lessonMsg.textContent = 'النموذج يعزف… شاهد اليدين والمنفاخ';
      else if (e.type === 'demo-end') lessonMsg.textContent = 'انتهى العرض — جرّب أنت الآن';
    },
  };
  const lesson = new Lesson(perf, lessonUI);
  function buildLesson() {
    const levelSel = el('select', { id: 'lvl' }, el('option', { value: 0 }, 'كل المستويات'), ...[1, 2, 3].map((l) => el('option', { value: l }, LEVEL_AR[l])));
    const exSel = el('select', { id: 'exsel' });
    const fill = () => { exSel.replaceChildren(...EXERCISES.filter((e) => +levelSel.value === 0 || e.level === +levelSel.value).map((e) => el('option', { value: e.id }, `${LEVEL_AR[e.level]} · ${e.title}`))); pick(); };
    const pick = () => { const ex = EXERCISES.find((e) => e.id === exSel.value); if (ex) { lesson.load(ex); tempo.value = lesson.opts.bpm; tempoV.textContent = lesson.opts.bpm; const rec = ex.kind === 'recognize'; $('#t-sec') && ($('#t-sec').style.display = rec ? 'none' : ''); demoBtn.disabled = rec; if (!rec) setView(ex.hand === 'L' ? 'bass' : ex.hand === 'B' ? 'default' : 'keys'); } };
    levelSel.addEventListener('change', fill); exSel.addEventListener('change', pick);
    const tempoV = el('b', {}, '72'); const tempo = el('input', { type: 'range', min: 40, max: 160, value: 72, oninput: (e) => { lesson.opts.bpm = +e.target.value; tempoV.textContent = e.target.value; } });
    const wait = el('input', { type: 'checkbox', checked: true, onchange: (e) => { lesson.opts.wait = e.target.checked; } });
    const hints = el('input', { type: 'checkbox', checked: true, onchange: (e) => { lesson.opts.hints = e.target.checked; } });
    const names = el('input', { type: 'checkbox', onchange: (e) => setNames(e.target.checked) });
    const demoBtn = el('button', { class: 'btn', onclick: () => { audio.init(); audio.resume(); lesson.demo(); } }, '▶ عرض النموذج');
    sidebar.append(el('h2', {}, 'تمارين'),
      section('اختيار التمرين', el('label', {}, 'المستوى'), levelSel, el('label', {}, 'التمرين'), exSel, lessonMsg),
      el('div', { class: 'btnrow' }, demoBtn, el('button', { class: 'btn pri', onclick: () => { audio.resume(); lesson.practice(); } }, '🎹 ابدأ التدريب'), el('button', { class: 'btn', onclick: () => lesson.stop() }, '■ إيقاف')),
      el('details', { class: 'sec', id: 't-sec' }, el('summary', {}, 'إعدادات المعلّم'), el('div', { class: 'secbody' },
        el('label', {}, 'السرعة: ', tempoV, ' نبضة/د'), tempo,
        el('label', { class: 'row' }, wait, ' انتظار الطالب (بدون إيقاع)'),
        el('label', { class: 'row' }, hints, ' إضاءة المفاتيح المطلوبة'),
        el('label', { class: 'row' }, names, ' أسماء المفاتيح والأزرار على الآلة'))));
    fill();
  }

  // ---------------- أسماء المفاتيح على الآلة ----------------
  let labels = null;
  function makeLabel(text, size = 0.011) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = 'rgba(20,16,12,.78)'; g.beginPath(); g.roundRect(4, 8, 120, 48, 14); g.fill(); g.fillStyle = '#ffe9b0'; g.font = '700 34px Tajawal,Tahoma,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 33);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); sp.scale.set(size * 2, size, 1); sp.renderOrder = 8; return sp;
  }
  function setNames(on) {
    S.names = on;
    if (on && !labels) {
      labels = new THREE.Group();
      for (const k of Object.values(acc.keys)) { const s = makeLabel(noteName(k.midi), k.black ? 0.008 : 0.0105); s.position.set(-k.thick / 2 - 0.012, 0, k.black ? 0.0 : 0.034); k.pivot.add(s); labels.add(s); k.label = s; }
      for (const b of Object.values(acc.buttons)) { const s = makeLabel(b.data.label, 0.0085); s.position.set(0.016, 0, 0); b.pivot.add(s); labels.add(s); b.label = s; }
    }
    for (const o of [...Object.values(acc.keys), ...Object.values(acc.buttons)]) if (o.label) o.label.visible = on;
    document.querySelectorAll('#ui input[type=checkbox][data-names]').forEach((c) => { c.checked = on; });
  }

  // ---------------- التفاعل: التقاط، ضغط، سحب الكاميرا ----------------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(cx, cy) {
    const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(acc.pickables, false)[0]; return hit ? hit.object : null;
  }
  const down = new Map();                       // pointerId -> { kind:'play'|'cam', id, side, x, y }
  let pinch = null;
  const playId = (mesh) => (mesh && mesh.userData.keyId ? { side: 'R', id: mesh.userData.keyId } : mesh && mesh.userData.bassId ? { side: 'L', id: mesh.userData.bassId } : null);
  const playable = () => S.mode === 'free' || S.mode === 'lesson';
  function userPress(side, id) { audio.init(); audio.resume(); perf.press(side, id, 0.6 + Math.random() * 0.25); lesson.onUserPress(side, id); }
  canvas.addEventListener('pointerdown', (e) => {
    audio.init(); audio.resume(); canvas.setPointerCapture(e.pointerId);
    const mesh = pickAt(e.clientX, e.clientY), pl = playId(mesh);
    if (S.mode === 'identify' && mesh) { selectPart(mesh.userData.part, mesh); down.set(e.pointerId, { kind: 'tap', x: e.clientX, y: e.clientY }); return; }
    if (playable() && pl) { down.set(e.pointerId, { kind: 'play', ...pl }); userPress(pl.side, pl.id); return; }
    down.set(e.pointerId, { kind: 'cam', x: e.clientX, y: e.clientY });
    if (down.size === 2) { const p = [...down.values()].filter((d) => d.kind === 'cam'); if (p.length === 2) pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), cd: cam.goal.d }; }
  });
  canvas.addEventListener('pointermove', (e) => {
    const st = down.get(e.pointerId);
    if (!st) { const m = pickAt(e.clientX, e.clientY); canvas.style.cursor = m && (S.mode === 'identify' || playId(m)) ? 'pointer' : 'grab'; return; }
    if (st.kind === 'play') {                       // سحب متدرّج بين المفاتيح
      const pl = playId(pickAt(e.clientX, e.clientY));
      if (pl && pl.side === st.side && pl.id !== st.id) { perf.release(st.id); st.id = pl.id; userPress(pl.side, pl.id); }
    } else if (st.kind === 'cam') {
      if (pinch && down.size >= 2) { const p = [...down.entries()].map(([k, v]) => (k === e.pointerId ? { ...v, x: e.clientX, y: e.clientY } : v)); const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); cam.goal.d = clamp(pinch.cd * pinch.d / Math.max(20, d), 0.45, 4.5); st.x = e.clientX; st.y = e.clientY; return; }
      cam.goal.th -= (e.clientX - st.x) * 0.0065; cam.goal.ph = clamp(cam.goal.ph - (e.clientY - st.y) * 0.0055, 0.2, 2.2); st.x = e.clientX; st.y = e.clientY;
    }
  });
  const up = (e) => { const st = down.get(e.pointerId); if (st && st.kind === 'play') perf.release(st.id); down.delete(e.pointerId); if (down.size < 2) pinch = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(Math.sign(e.deltaY) * 0.08); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // لوحة الحاسوب
  const KR = { KeyA: 60, KeyS: 62, KeyD: 64, KeyF: 65, KeyG: 67, KeyH: 69, KeyJ: 71, KeyK: 72, KeyL: 74, Semicolon: 76, KeyW: 61, KeyE: 63, KeyT: 66, KeyY: 68, KeyU: 70, KeyO: 73 };
  const KL = { KeyZ: [0, 'bass'], KeyX: [7, 'bass'], KeyC: [0, 'major'], KeyV: [7, 'seventh'], KeyB: [5, 'major'], KeyN: [9, 'minor'], KeyM: [2, 'minor'] };
  const kheld = new Map();
  addEventListener('keydown', (e) => {
    if (e.repeat || e.target.matches('input,select,textarea')) return;
    if (e.code === 'KeyH' && !e.ctrlKey) { toggleHidden(); return; }
    if (e.code === 'Space') { e.preventDefault(); perf.flipBellows(); return; }
    if (!playable()) return;
    let side, id;
    if (KR[e.code]) { side = 'R'; id = 'k' + KR[e.code]; } else if (KL[e.code]) { const [pc, kind] = KL[e.code]; const b = BASS.find((x) => x.pc === pc && x.kind === kind); side = 'L'; id = b.id; } else return;
    if (!acc.keys[id] && !acc.buttons[id]) return;
    kheld.set(e.code, id); userPress(side, id);
  });
  addEventListener('keyup', (e) => { const id = kheld.get(e.code); if (id) { perf.release(id); kheld.delete(e.code); } });

  // ---------------- التحديث كل إطار ----------------
  perf.onEvent = (ev) => {
    if (ev.type === 'on' && ev.side === 'R') { chip.textContent = `${noteName(ev.notes[0])}  (${noteName(ev.notes[0], 'en')})`; chip.classList.remove('hidden'); clearTimeout(chip._t); chip._t = setTimeout(() => chip.classList.add('hidden'), 1200); }
    else if (ev.type === 'on' && ev.side === 'L') { chip.textContent = bassById[ev.id].title; chip.classList.remove('hidden'); clearTimeout(chip._t); chip._t = setTimeout(() => chip.classList.add('hidden'), 1200); }
  };
  audio.onstate = (st, n, t) => { if (st === 'ready') { status.textContent = 'الصوت جاهز'; setTimeout(() => status.classList.add('hidden'), 1800); } else if (st === 'loading') status.textContent = `جارٍ تحميل أصوات الأكورديون ${n}/${t}`; else if (st === 'failed') status.textContent = 'تعذّر تحميل الصوت'; };
  function frame(dt) {
    updateViewOffset(dt);
    if (hl) { hl.mesh.updateWorldMatrix(true, false); hl.line.matrixWorld.copy(hl.mesh.matrixWorld); }
    const b = perf.bel, a = perf.air || 0;
    airBar.firstChild.style.width = Math.round(a * 100) + '%';
    dirTxt.textContent = Math.abs(b.v) < 0.003 ? 'المنفاخ ساكن' : b.v > 0 ? '⟵ المنفاخ يُفتح' : '⟶ المنفاخ يُغلق';
    if (!slider.disabled) { /* يدوي */ } else slider.value = clamp(b.v / 0.05 * 100, -100, 100);
  }
  layout(); S.booted = false; setMode('free');
  return { setMode, setView, zoom, frame, lesson, S, setNames, toggleHidden, selectPart, pickAt };
}
