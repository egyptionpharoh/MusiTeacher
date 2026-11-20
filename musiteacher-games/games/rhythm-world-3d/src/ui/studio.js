// =====================================================================
//  استوديو الأداء الإيقاعي: يرتّب الطالب العلامات والسكتات في شريط بموازير، فتقف شخصياتها على المسرح
//  وتتحرك مع الصوت. التصفيق مع الإيقاع للاستكشاف (علامات خضراء قريبة من موضعها) — بلا نقاط ولا ترتيب.
// =====================================================================
import { FIG, TPB, allowedFor, seqTicks, timeline } from '../data/figures.js';

let seq = null, meter = 4, loop = true, selIdx = -1, taps = [], tapStart = 0, lastGrade = 0;

function suggest(grade, beats) {
  const al = allowedFor(grade).filter((id) => FIG[id].ticks % TPB === 0 && FIG[id].ticks <= beats * TPB);
  const out = [];
  for (let m = 0; m < 2; m++) {
    let left = beats * TPB, sounds = 0;
    while (left > 0) {
      let opts = al.filter((id) => FIG[id].ticks <= left); if (!sounds && left === TPB) opts = opts.filter((id) => FIG[id].kind !== 'rest');
      const notes = opts.filter((id) => FIG[id].kind !== 'rest'); const pool = Math.random() < 0.8 && notes.length ? notes : opts;
      const id = pool[Math.floor(Math.random() * pool.length)]; out.push(id); left -= FIG[id].ticks; if (FIG[id].kind !== 'rest') sounds++;
    }
  }
  return out;
}
/** يقسم التسلسل إلى موازير (بحسب الميزان) ويعيد [{ids, idx[], ticks}] */
function measures(ids, beats) {
  const cap = beats * TPB, out = []; let cur = { ids: [], idx: [], ticks: 0 };
  ids.forEach((id, i) => { if (cur.ticks >= cap) { out.push(cur); cur = { ids: [], idx: [], ticks: 0 }; } cur.ids.push(id); cur.idx.push(i); cur.ticks += FIG[id].ticks; });
  if (cur.ids.length || !out.length) out.push(cur); return out;
}

export function enter(app) {
  const { el, figureSVG } = app;
  if (!seq || lastGrade !== app.state.grade) { seq = app.store.get('studio.' + app.state.grade, null) || suggest(app.state.grade, meter); lastGrade = app.state.grade; }
  const side = app.$('#side');
  side.append(el('p', 'hint', 'اضغط علامة أو سكتة لإضافتها إلى الشريط. اضغط علامة في الشريط لتحديدها ثم «حذف». الشخصيات على المسرح تؤدي ما كتبته.'));
  side.append(el('h3', null, 'العلامات والسكتات المتاحة لصفك'));
  const pal = el('div', 'palette');
  for (const id of allowedFor(app.state.grade)) { const b = el('button', null, figureSVG([id], { k: 9, minTop: 4.3, minBottom: -2.1, padTop: 0.2, padBottom: 0.2 }).svg + `<small>${FIG[id].name}</small>`); b.title = FIG[id].name; b.onclick = () => add(app, id); pal.append(b); }
  side.append(pal);
  const tools = el('div', 'group'); tools.style.display = 'flex'; tools.style.flexWrap = 'wrap'; tools.style.gap = '6px';
  const tb = (t, f) => { const b = el('button', null, t); b.onclick = f; return b; };
  tools.append(tb('↶ تراجع', () => { seq.pop(); selIdx = -1; refresh(app); }), tb('🗑 حذف المحدد', () => { if (selIdx >= 0) { seq.splice(selIdx, 1); selIdx = -1; refresh(app); } }), tb('🧹 مسح', () => { seq = []; refresh(app); }), tb('✨ اقتراح نمط', () => { seq = suggest(app.state.grade, meter); refresh(app); }));
  side.append(tools);
  const m = el('label', 'grade', 'الميزان '); const ms = el('select'); [2, 3, 4].forEach((b) => ms.append(new Option(b + '/4', b))); ms.value = meter; ms.onchange = () => { meter = +ms.value; refresh(app); }; m.append(ms); side.append(m);
  side.append(el('p', 'hint', 'المازورة الناقصة أو الزائدة تُلوَّن، ويظهر تحتها مجموع أزمنتها.'));
  app.world && (app.world.onPick = (i) => { selIdx = i; refresh(app, true); });
  addEventListener('keydown', onKey); app._studioKey = onKey;
  function onKey(e) { if (e.code === 'Space' && e.target.tagName !== 'INPUT' && app.state.mode === 'studio') { e.preventDefault(); tap(app); } }
  refresh(app);
}
export function leave(app) { removeEventListener('keydown', app._studioKey); }
const add = (app, id) => { if (seq.length >= 32) return; seq.push(id); selIdx = -1; refresh(app); };

function refresh(app, keepView) {
  const { el, figureSVG } = app; app.store.set('studio.' + app.state.grade, seq);
  app.stopAll();
  const items = seq.map((id) => ({ ids: [id], label: '' }));
  app.lineup(items, { gap: 0.25, keepView, showCells: true });
  const bar = app.$('#bar'); bar.innerHTML = '';
  const strip = el('div', 'strip'); strip.append(el('div', 'ts', `<span>${meter}</span><span>4</span>`));
  const M = measures(seq, meter); app._figEls = [];
  M.forEach((mm) => {
    const box = el('div', 'ms' + (mm.ticks !== meter * TPB && mm.ids.length ? ' bad' : ''));
    mm.ids.forEach((id, j) => { const i = mm.idx[j]; const f = el('span', 'fg' + (i === selIdx ? ' sel' : '')); f.innerHTML = figureSVG([id], { k: 9, minTop: 4.3, minBottom: -2.1, padTop: 0.2, padBottom: 0.2, line: true }).svg; f.onclick = () => { selIdx = i; refresh(app, true); }; box.append(f); app._figEls[i] = f; });
    if (mm.ids.length && mm.ticks !== meter * TPB) box.append(el('span', 'tot', `${(mm.ticks / TPB).toString().replace('.', '٫')} من ${meter}`));
    strip.append(box);
  });
  const col = el('div', 'namebar'); col.append(strip);
  const tp = el('div', 'taps'); tp.style.width = '100%'; app._taps = tp; col.append(tp);
  bar.append(col);
  const g = el('div', 'group');
  const pl = el('button', 'accent big', '▶ تشغيل'); pl.onclick = () => start(app);
  const st = el('button', 'big', '⏹'); st.onclick = () => app.stopAll();
  const lp = el('button', loop ? 'on' : '', '🔁 تكرار'); lp.onclick = () => { loop = !loop; lp.classList.toggle('on', loop); };
  const pad = el('button', 'pad', '👏 صفّق هنا'); pad.title = 'أو اضغط مفتاح المسافة'; pad.onpointerdown = (e) => { e.preventDefault(); tap(app); }; app._pad = pad;
  const pr = el('button', null, '🖨 ورقة لهذا الإيقاع'); pr.onclick = () => app.openPrint({ template: 'strips', seq: [...seq], meter });
  g.append(pl, st, lp, pad, pr);
  bar.append(g, app.tempoSlider(40, 140), app.soundSelect());
}

function start(app) {
  if (!seq.length) return; taps = []; drawTaps(app);
  const items = seq.map((id) => ({ ids: [id] }));
  app.play(items, { loop, countIn: meter, beatsPerBar: meter,
    onPart: (fi) => { (app._figEls || []).forEach((e, i) => e && e.classList.toggle('lit', i === fi)); },
    onEnd: () => (app._figEls || []).forEach((e) => e && e.classList.remove('lit')) });
  app.onStop = () => (app._figEls || []).forEach((e) => e && e.classList.remove('lit'));
}

/** التصفيق مع الإيقاع: تُرسم كل تصفيقة على خط زمني تحت الشريط مقابل مواضع الضربات الصحيحة */
function tap(app) {
  if (app._pad) { app._pad.classList.add('flash'); setTimeout(() => app._pad && app._pad.classList.remove('flash'), 90); }
  const run = app.run; if (!run) return; const now = app.audio.now; if (now < run.start - 0.2) return;
  const total = seqTicks(seq) / TPB * run.beatDur; const pos = ((now - run.start) % total + total) % total;
  taps.push(pos / total); if (taps.length > 40) taps.shift(); drawTaps(app, total, run.beatDur);
}
function drawTaps(app, total, beat) {
  const tp = app._taps; if (!tp) return; tp.innerHTML = ''; if (!total) return;
  const on = timeline(seq).filter((e) => !e.rest).map((e) => (e.t / TPB * beat) / total);
  on.forEach((x) => { const b = document.createElement('b'); b.style.left = `${x * 100}%`; tp.append(b); });
  const tol = 0.09 / total;
  taps.forEach((x) => { const i = document.createElement('i'); const near = on.some((o) => Math.abs(o - x) < tol || Math.abs(o + 1 - x) < tol); i.className = near ? '' : 'off'; i.style.left = `calc(${x * 100}% - 3px)`; tp.append(i); });
}

export function printContext() { return { template: 'strips', seq: [...(seq || [])], meter }; }
