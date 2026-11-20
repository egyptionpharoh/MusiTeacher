// =====================================================================
//  قسم «الشخصيات»: يختار الطالب علامة فتظهر شخصيةً ثلاثية الأبعاد تعرّف بنفسها، ويسمعها ويصفق معها.
// =====================================================================
import { newIn, gradeIntroduced, GRADE_NAMES } from '../data/figures.js';

let sel = null, pairOn = false;

export function charList(app, onPick, selected) {
  const { el, FIG, figureSVG, valueText } = app; const wrap = el('div');
  const ids = app.characters(); const fresh = new Set(newIn(app.state.grade));
  const groups = [['العلامات', (f) => f.kind === 'note'], ['الأشكال الإيقاعية', (f) => f.kind === 'group'], ['السكتات', (f) => f.kind === 'rest']];
  for (const [title, test] of groups) {
    const list = ids.filter((id) => test(FIG[id])); if (!list.length) continue;
    wrap.append(el('h3', null, title)); const g = el('div', 'chars');
    for (const id of list) {
      const f = FIG[id]; const b = el('button', 'char' + (id === selected ? ' on' : ''));
      b.innerHTML = figureSVG([id], { k: 13, minTop: 4.3, minBottom: -2.1, padTop: 0.3, padBottom: 0.3 }).svg + `<b>${f.name}</b><i>${valueText(f.ticks)}</i>` + (fresh.has(id) ? '<span class="new">جديد في صفك</span>' : '');
      b.dataset.id = id; b.addEventListener('click', () => { g.parentElement.querySelectorAll('.char').forEach((x) => x.classList.toggle('on', x === b)); onPick(id); }); g.append(b);
    }
    wrap.append(g);
  }
  return wrap;
}

export function enter(app) {
  const { el, FIG } = app; const ids = app.characters();
  if (!ids.includes(sel)) sel = ids.find((id) => newIn(app.state.grade).includes(id)) || ids[0];
  const side = app.$('#side');
  side.append(el('p', 'hint', `الصف ${GRADE_NAMES[app.state.grade - 1]}: ${ids.length} شخصية. اختر شخصية لتظهر في المسرح، ثم اضغط «الشخصية تعرّف بنفسها» أو «استمع». اسحب في المسرح للتدوير، والعجلة للتكبير.`));
  side.append(charList(app, (id) => { sel = id; show(app); }, sel));
  app.world && (app.world.onPick = () => app.introduce(sel, 0));
  show(app);
}

function show(app) {
  const { el, FIG, figureSVG, valueText } = app; const f = FIG[sel];
  const pair = f.pair && app.characters().includes(f.pair) ? f.pair : null;
  const items = [{ ids: [sel], label: `${f.name}<small>${valueText(f.ticks)}</small>` }];
  if (pairOn && pair) items.push({ ids: [pair], label: `${FIG[pair].name}<small>${valueText(FIG[pair].ticks)}</small>` });
  app.stopAll(); app.lineup(items, { gap: 0.9 });
  const bar = app.$('#bar'); bar.innerHTML = '';
  const card = el('div', 'infocard'); card.innerHTML = figureSVG([sel], { k: 10, padTop: 0.3, padBottom: 0.3 }).svg +
    `<div><b>${f.name}</b><span>${valueText(f.ticks)} · ${f.kind === 'rest' ? '<span class="chip rest">صمت</span>' : '<span class="chip sound">صوت</span>'}${f.syl ? ' · تُنطق: «' + f.syl + '»' : ''}${gradeIntroduced(sel) ? ' · الصف ' + GRADE_NAMES[gradeIntroduced(sel) - 1] : ''}</span></div>`;
  bar.append(card, el('span', 'sep'));
  const g = el('div', 'group');
  const talk = el('button', 'accent big', '🗣 الشخصية تعرّف بنفسها'); talk.addEventListener('click', () => app.introduce(sel, 0));
  const hush = el('button', null, '⏹ إيقاف'); hush.addEventListener('click', () => app.stopAll());
  const listen = el('button', 'big', '▶ استمع'); listen.addEventListener('click', () => app.play(items, { countIn: 0 }));
  const clap = el('button', null, '👏 صفّق معي'); clap.addEventListener('click', () => app.play(items, { loop: true, countIn: 2 }));
  g.append(talk, listen, clap, hush);
  if (pair) { const pb = el('button', pairOn ? 'on' : '', f.kind === 'rest' ? '🎵 العلامة المقابلة' : '🤫 السكتة المقابلة'); pb.addEventListener('click', () => { pairOn = !pairOn; show(app); }); g.append(pb); }
  const pr = el('button', null, '🖨 بطاقة للطباعة'); pr.addEventListener('click', () => app.openPrint({ template: 'cards', ids: pairOn && pair ? [sel, pair] : [sel] })); g.append(pr);
  bar.append(g, el('span', 'sep'), app.soundSelect(), app.tempoSlider());
}

export function printContext(app) { const f = app.FIG[sel]; return { template: 'cards', ids: f && f.pair && pairOn ? [sel, f.pair] : app.characters() }; }
export function leave() {}
