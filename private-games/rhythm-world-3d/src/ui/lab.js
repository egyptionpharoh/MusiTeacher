// =====================================================================
//  معمل الأزمنة: صفوف متساوية الطول، كل خلية بعرض قيمتها الزمنية تمامًا، وخطوط النبض المتقطعة
//  تمر عبر كل الصفوف، ومؤشر واحد يتحرك مع الصوت — فيرى الطالب أن التراكيب متساوية في الزمن.
// =====================================================================
import { FIG, TPB, allowedFor } from '../data/figures.js';

let set = 'tree', active = -1, rows = [], seqMode = false, seqIdx = 0;

function buildSets(grade) {
  const al = new Set(allowedFor(grade)); const has = (id) => al.has(id);
  const top = has('w') ? 4 : has('h') ? 2 : 1;
  const rep = (id, n) => Array(n).fill(id);
  const S = {};
  const tree = [];
  if (has('w')) tree.push({ label: 'روند', sub: '1 × 4 أزمنة', ids: ['w'] });
  if (has('h') && top >= 2) tree.push({ label: 'بلانش', sub: `${top / 2} × زمنان`, ids: rep('h', top / 2) });
  tree.push({ label: 'نوار', sub: `${top} × زمن`, ids: rep('q', top) });
  if (has('ee') || has('e')) tree.push({ label: 'كروش', sub: `${top * 2} × نصف زمن`, ids: rep('ee', top) });
  if (has('ssss') || has('s')) tree.push({ label: 'دوبل كروش', sub: `${top * 4} × ربع زمن`, ids: rep('ssss', top) });
  S.tree = { title: 'شجرة الأزمنة', note: 'كل صف يملأ الزمن نفسه: انظر كيف تنقسم العلامة الطويلة إلى علامات أقصر.', rows: tree };
  const oneBeat = ['q', 'ee', 'ssss', 'ess', 'sse', 'ses', 'eds', 'sed', 'trip'].filter(has).map((id) => ({ label: FIG[id].name, sub: FIG[id].syl ? '«' + FIG[id].syl + '»' : 'زمن واحد', ids: [id] }));
  if (oneBeat.length > 1) S.beat = { title: 'كلها في زمن واحد', note: 'أشكال مختلفة، والزمن نفسه: نوار واحد.', rows: oneBeat };
  const rt = [];
  if (has('rw')) rt.push({ label: 'سكتة الروند', sub: '4 أزمنة صمت', ids: ['rw'] });
  if (has('rh') && top >= 2) rt.push({ label: 'سكتة البلانش', sub: 'زمنان صمت', ids: rep('rh', top / 2) });
  if (has('rq')) rt.push({ label: 'سكتة النوار', sub: 'زمن صمت', ids: rep('rq', top) });
  if (has('re')) rt.push({ label: 'سكتة الكروش', sub: 'نصف زمن صمت', ids: rep('re', top * 2) });
  if (has('rs')) rt.push({ label: 'سكتة الدوبل كروش', sub: 'ربع زمن صمت', ids: rep('rs', top * 4) });
  if (rt.length) S.rests = { title: 'شجرة السكتات', note: 'السكتات تنقسم كما تنقسم العلامات، والنبض لا يتوقف أثناء الصمت.', rows: rt };
  // الصوت والصمت: صف علامات وصف سكتات مقابلة
  const sv = [{ label: 'صوت', sub: 'تصفيقة في كل زمن', ids: rep('q', Math.max(2, top)) }];
  if (has('rq')) sv.push({ label: 'صوت وصمت', sub: 'تصفيقة ثم سكتة', ids: Array.from({ length: Math.max(2, top) }, (_, i) => (i % 2 ? 'rq' : 'q')) });
  if (has('h')) sv.push({ label: 'صوت طويل', sub: 'بلانش', ids: rep('h', Math.max(1, top / 2)) });
  if (has('rh')) sv.push({ label: 'صمت طويل', sub: 'سكتة بلانش', ids: rep('rh', Math.max(1, top / 2)) });
  S.sound = { title: 'الصوت والصمت', note: 'في الخلية المخططة لا نصفق، لكن المؤشر والنبض يستمران.', rows: sv };
  if (has('hd') || has('qd')) {
    const d = [];
    if (has('hd')) d.push({ label: 'بلانش بوانتيه', sub: '3 أزمنة', ids: ['hd'] }, { label: 'بلانش + نوار', sub: '2 + 1', ids: ['h', 'q'] }, { label: '3 نوار', sub: '1 + 1 + 1', ids: ['q', 'q', 'q'] });
    if (has('qd')) d.push({ label: 'نوار بوانتيه + كروش', sub: '1½ + ½', ids: ['qd', 'e'] }, { label: 'نوار + تاتي', sub: '1 + 1', ids: ['q', 'ee'] });
    S.dot = { title: 'النقطة الزمنية', note: 'النقطة تزيد العلامة نصف قيمتها.', rows: d };
  }
  return S;
}

export function enter(app) { app.lineup([]); render(app); }
export function leave() { active = -1; seqMode = false; }

function render(app) {
  const { el, figureSVG } = app; const sets = buildSets(app.state.grade); if (!sets[set]) set = 'tree';
  const S = sets[set]; const P = app.$('#panel2d'); P.innerHTML = '';
  const head = el('div', 'lab-head'); head.append(el('h2', null, '⚖ معمل الأزمنة'));
  for (const k in sets) { const b = el('button', k === set ? 'on' : '', sets[k].title); b.onclick = () => { app.stopAll(); set = k; render(app); }; head.append(b); }
  P.append(head, el('p', 'hint', S.note + ' اضغط اسم أي صف لسماعه مع النبض، أو «شغّل الصفوف بالتتابع».'));
  const ctl = el('div', 'lab-head'); ctl.style.marginBottom = '10px';
  const all = el('button', 'accent big', '▶ شغّل الصفوف بالتتابع'); all.onclick = () => { seqMode = true; seqIdx = 0; playRow(app, 0, false); };
  const st = el('button', 'big', '⏹ إيقاف'); st.onclick = () => { seqMode = false; app.stopAll(); };
  const pr = el('button', null, '🖨 اطبع هذه المقارنة'); pr.onclick = () => app.openPrint({ template: 'relations', set, rows: S.rows, title: S.title });
  ctl.append(all, st, app.tempoSlider(40, 120), app.soundSelect(), pr); P.append(ctl);
  const total = Math.max(...S.rows.map((r) => r.ids.reduce((a, id) => a + FIG[id].ticks, 0)));
  const tree = el('div', 'tree'); rows = [];
  S.rows.forEach((r, ri) => {
    const row = el('div', 'trow'); const lb = el('button', null, `${r.label}<small>${r.sub}</small>`); lb.onclick = () => playRow(app, ri, true);
    const bar = el('div', 'tbar'); const cells = [];
    r.ids.forEach((id) => { const c = el('div', 'tcell' + (FIG[id].kind === 'rest' ? ' rest' : '')); c.style.flex = `0 0 ${(FIG[id].ticks / total) * 100}%`; c.innerHTML = figureSVG([id], { k: 11, line: true, lineOpacity: 0.25, padTop: 0.2, padBottom: 0.2, minTop: 4.2, minBottom: -2 }).svg; bar.append(c); cells.push(c); });
    const beats = el('div', 'tbeats'); for (let b = 1; b < total / TPB; b++) { const i = el('i'); i.style.left = `${(b * TPB / total) * 100}%`; beats.append(i); }
    const ph = el('div', 'thead'); bar.append(beats, ph);
    row.append(lb, bar); tree.append(row); rows.push({ r, cells, ph, bar, total: r.ids.reduce((a, id) => a + FIG[id].ticks, 0) });
  });
  const lbl = el('div', 'trow'); const nums = el('div', 'tlabel'); for (let b = 0; b <= total / TPB; b++) nums.append(el('span', null, String(b))); lbl.append(el('span', 'hint', 'الأزمنة'), nums); tree.append(lbl);
  P.append(tree);
  const eq = el('div', 'eq'); if (set === 'tree' || set === 'beat') { eq.innerHTML = S.rows.map((r) => figureSVG(r.ids.length > 4 ? r.ids.slice(0, 1) : r.ids, { k: 7, line: false, padTop: 0.1, padBottom: 0.1 }).svg + (r.ids.length > 4 ? ` ×${r.ids.length}` : '')).join(' <b>=</b> '); P.append(eq); }
}

function playRow(app, ri, loop) {
  const R = rows[ri]; if (!R) return; active = ri;
  rows.forEach((x) => { x.cells.forEach((c) => c.classList.remove('lit')); x.ph.style.display = 'none'; });
  app.play([{ ids: R.r.ids }], {
    loop, countIn: seqMode && ri > 0 ? 0 : 2, beatsPerBar: 4,
    onPart: (fi) => { R.cells.forEach((c, i) => c.classList.toggle('lit', i === fi)); },
    onEnd: () => { R.cells.forEach((c) => c.classList.remove('lit')); R.ph.style.display = 'none'; if (seqMode && ri + 1 < rows.length) setTimeout(() => playRow(app, ri + 1, false), 250); else { seqMode = false; active = -1; } },
  });
  app.onStop = () => { R.cells.forEach((c) => c.classList.remove('lit')); R.ph.style.display = 'none'; };
}

export function frame(app) {
  const run = app.run; if (!run || active < 0 || !rows[active]) return; const R = rows[active];
  const now = app.audio.now; if (now < run.start) return;
  const dur = (R.total / TPB) * run.beatDur; const x = ((now - run.start) % dur) / dur;
  R.ph.style.display = 'block'; R.ph.style.left = `calc(${(x * R.total / Math.max(...rows.map((q) => q.total))) * 100}% - 1px)`;
}

export function printContext(app) { const sets = buildSets(app.state.grade); const S = sets[set] || sets.tree; return { template: 'relations', set, rows: S.rows, title: S.title }; }
