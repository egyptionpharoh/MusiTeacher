// =====================================================================
//  وضع العرض للمعلم (السبورة الذكية / جهاز العرض): علامة كبيرة أو مقارنة حتى أربع علامات،
//  أدوات كبيرة في شريط سفلي بعيد عن المجسم، والاسم والقيمة في زاوية لا تغطي الرمز.
//  لوحة المفاتيح: → ← للتنقل · مسافة للتشغيل · F ملء الشاشة · R إعادة · S السكتة المقابلة · C المقارنة.
// =====================================================================
let idx = 0, compare = [], showName = true, cells = true, pair = false, onKey = null;

export function enter(app) {
  const ids = app.characters(); if (idx >= ids.length) idx = 0;
  app.world && (app.world.onPick = (i) => { const list = current(app); app.introduce(list[i].ids[0], i); });
  render(app);
  onKey = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(app, 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); step(app, -1); }
    else if (e.code === 'Space') { e.preventDefault(); app.isPlaying() ? app.stopAll() : play(app); }
    else if (e.key === 'f' || e.key === 'F') app.fullscreen(); else if (e.key === 'r' || e.key === 'R') restart(app);
    else if (e.key === 's' || e.key === 'S') { pair = !pair; render(app); } else if (e.key === 'c' || e.key === 'C') addCompare(app);
  };
  addEventListener('keydown', onKey);
}
export function leave() { removeEventListener('keydown', onKey); }

function current(app) {
  const { FIG, valueText } = app; const ids = app.characters(); const main = ids[idx];
  const list = compare.length ? compare.filter((id) => ids.includes(id)) : [main];
  if (pair && !compare.length && FIG[main].pair && ids.includes(FIG[main].pair)) list.push(FIG[main].pair);
  return list.map((id) => ({ ids: [id], label: `${FIG[id].name}<small>${valueText(FIG[id].ticks)}</small>` }));
}
const step = (app, d) => { const n = app.characters().length; idx = (idx + d + n) % n; compare = []; render(app); };
const addCompare = (app) => { const ids = app.characters(); if (!compare.length) compare = [ids[idx]]; const next = ids[(ids.indexOf(compare[compare.length - 1]) + 1) % ids.length]; if (compare.length < 4 && !compare.includes(next)) compare.push(next); render(app); };
const play = (app) => app.play(current(app), { countIn: 2, loop: false });
const restart = (app) => { app.stopAll(); app.world && app.world.resetView(); play(app); };

function render(app) {
  const { el, FIG, valueText } = app; const list = current(app);
  app.stopAll(); app.lineup(list, { gap: 0.8, showCells: cells });
  const big = app.$('#bigname'); big.hidden = !showName;
  big.innerHTML = list.map((it) => `<b>${FIG[it.ids[0]].name}</b><span>${valueText(FIG[it.ids[0]].ticks)}</span>`).join('<br>');
  const bar = app.$('#bar'); bar.innerHTML = '';
  const nav = el('div', 'group');
  const prev = el('button', 'big', '→ السابقة'), next = el('button', 'big', 'التالية ←'); prev.onclick = () => step(app, -1); next.onclick = () => step(app, 1);
  const pl = el('button', 'accent big', '▶ تشغيل'); pl.onclick = () => play(app);
  const st = el('button', 'big', '⏹'); st.onclick = () => app.stopAll();
  const sp = el('button', 'big', '🗣 تتحدث'); sp.onclick = () => app.introduce(list[0].ids[0], 0);
  const rs = el('button', 'big', '⟲ من البداية'); rs.onclick = () => restart(app);
  nav.append(prev, pl, st, sp, rs, next);
  const opts = el('div', 'group');
  const tg = (label, on, fn) => { const b = el('button', on ? 'on' : '', label); b.onclick = fn; return b; };
  opts.append(
    tg('الاسم والقيمة', showName, () => { showName = !showName; render(app); }),
    tg('التقسيمات الزمنية', cells, () => { cells = !cells; render(app); }),
    tg('السكتة المقابلة', pair, () => { pair = !pair; compare = []; render(app); }),
    tg(compare.length ? `مقارنة (${compare.length}) +` : 'مقارنة +', compare.length > 0, () => addCompare(app)));
  if (compare.length) { const c = el('button', null, 'إلغاء المقارنة'); c.onclick = () => { compare = []; render(app); }; opts.append(c); }
  bar.append(nav, el('span', 'sep'), opts, el('span', 'sep'), app.tempoSlider(40, 120), app.soundSelect());
}

export function printContext(app) { return { template: 'reference', ids: current(app).map((i) => i.ids[0]) }; }
