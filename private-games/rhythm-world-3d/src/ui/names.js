// =====================================================================
//  أسماؤنا والإيقاع: الاسم بخط كبير ← مقاطعه ← تمثيله الإيقاعي ← نسمعه ونصفّقه.
//  «قائمة أسماء طلابي» تُحفظ في هذا المتصفح فقط (localStorage) ولا تُرسل إلى أي مكان.
//  الغاية تحفيز وتعلّم، لا تصنيف ولا مقارنة بين الطلاب: لا نقاط ولا ترتيب.
// =====================================================================
import { analyse, splitAt, mergeWithNext, rhythmFor } from '../data/names.js';
import { speak } from '../audio/speech.js';
import { FIG, TPB, timeline } from '../data/figures.js';

let cur = null, mode = 'length', listening = null;

export function enter(app) {
  const { el } = app; const side = app.$('#side');
  side.append(el('p', 'hint', 'اكتب اسمًا أو اختر من القائمة: يظهر الاسم كبيرًا مقسّمًا إلى مقاطع، وتحته تمثيله الإيقاعي، وتقف شخصياته على المسرح.'));
  const row = el('div', 'group'); row.style.display = 'flex'; row.style.gap = '6px';
  const inp = el('input'); inp.type = 'text'; inp.placeholder = 'مثال: محمد'; inp.style.flex = '1'; inp.maxLength = 30;
  const go = el('button', 'accent', 'اعرض'); go.onclick = () => { if (inp.value.trim()) load(app, inp.value.trim()); };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
  row.append(inp, go); side.append(row);
  side.append(el('h3', null, 'قائمة أسماء طلابي'));
  side.append(el('div', 'privacy', '🔒 الأسماء تُحفظ في هذا المتصفح على هذا الجهاز فقط، ولا تُرسل إلى أي خادم أو خدمة. يمكنك مسحها في أي وقت.'));
  const ta = el('textarea'); ta.rows = 3; ta.placeholder = 'أضف اسمًا في كل سطر'; ta.style.width = '100%';
  const addB = el('button', null, '➕ إضافة'); addB.onclick = () => { const L = ta.value.split(/[\n،,]+/).map((s) => s.trim()).filter(Boolean); saveList(app, [...list(app), ...L]); ta.value = ''; drawList(app); };
  const file = el('input'); file.type = 'file'; file.accept = '.csv,.txt,.xlsx'; file.hidden = true; file.onchange = () => importFile(app, file.files[0]);
  const imp = el('button', null, '📥 استيراد Excel أو CSV'); imp.onclick = () => file.click();
  const clr = el('button', null, '🗑 مسح القائمة'); clr.onclick = () => { if (confirm('مسح كل الأسماء من هذا الجهاز؟')) { saveList(app, []); drawList(app); } };
  const tools = el('div', 'group'); tools.style.display = 'flex'; tools.style.flexWrap = 'wrap'; tools.style.gap = '6px'; tools.append(addB, imp, clr, file);
  side.append(ta, tools, el('div', 'students')); app._imp = el('p', 'hint'); side.append(app._imp);
  drawList(app);
  load(app, cur ? cur.name : (list(app)[0] || 'محمد'), cur);
}
export function leave() { listening = null; }

const list = (app) => app.store.get('students', []);
function saveList(app, L) { const seen = new Set(); app.store.set('students', L.filter((n) => { const k = n.trim(); if (!k || seen.has(k) || k.length > 40) return false; seen.add(k); return true; }).slice(0, 300)); }
function drawList(app) {
  const { el } = app; const box = app.$('#side .students'); box.innerHTML = ''; const L = list(app);
  if (!L.length) box.append(el('p', 'hint', 'لا توجد أسماء بعد.'));
  L.forEach((n, i) => { const r = el('div', 'st'); const b = el('button', cur && cur.name === n ? 'on' : '', n); b.onclick = () => load(app, n); const x = el('button', null, '✕'); x.title = 'حذف'; x.onclick = () => { const M = list(app); M.splice(i, 1); saveList(app, M); drawList(app); }; r.append(b, x); box.append(r); });
}

async function importFile(app, f) {
  if (!f) return; let names = [];
  try {
    if (/\.xlsx$/i.test(f.name)) {
      const { unzipSync, strFromU8 } = await import('three/addons/libs/fflate.module.js');
      const z = unzipSync(new Uint8Array(await f.arrayBuffer())); const P = new DOMParser();
      const ss = z['xl/sharedStrings.xml'] ? [...P.parseFromString(strFromU8(z['xl/sharedStrings.xml']), 'application/xml').getElementsByTagName('si')].map((si) => si.textContent) : [];
      const sheetKey = Object.keys(z).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
      const doc = P.parseFromString(strFromU8(z[sheetKey]), 'application/xml');
      for (const row of doc.getElementsByTagName('row')) {
        const vals = [...row.getElementsByTagName('c')].map((c) => { const v = c.getElementsByTagName('v')[0]; const is = c.getElementsByTagName('is')[0]; if (c.getAttribute('t') === 's' && v) return ss[+v.textContent] || ''; return is ? is.textContent : v ? v.textContent : ''; });
        const t = vals.filter((x) => /[؀-ۿ]{2}/.test(x)).sort((a, b) => b.length - a.length)[0]; if (t) names.push(t);
      }
    } else {
      const txt = await f.text();
      for (const line of txt.split(/\r?\n/)) { const cells = line.split(/[,;\t]/).map((s) => s.replace(/^"|"$/g, '').trim()); const t = cells.filter((x) => /[؀-ۿ]{2}/.test(x)).sort((a, b) => b.length - a.length)[0]; if (t) names.push(t); }
    }
    names = names.map((n) => n.trim()).filter((n) => n.length >= 2 && !/^(الاسم|اسم الطالب|اسم الطالبة|الأسماء|اسم|الصف|الشعبة)$/.test(n));
    saveList(app, [...list(app), ...names]); drawList(app);
    app._imp.textContent = names.length ? `عدد الأسماء المستوردة: ${names.length} (أطول نص عربي في كل صف).` : 'لم أجد أسماء عربية في الملف.';
  } catch (e) { console.warn(e); app._imp.textContent = 'تعذّرت قراءة الملف. جرّب حفظه بصيغة CSV.'; }
}

function load(app, name, keep) {
  cur = keep && keep.name === name ? keep : analyse(name);
  app.$('#side .students') && drawList(app); draw(app);
}

function draw(app) {
  const { el, figureSVG } = app; const R = rhythmFor(cur.syllables, mode);
  // الشخصيات على المسرح: كل شكل في التمثيل الإيقاعي شخصية
  app.lineup(R.seq.map((id) => ({ ids: [id] })), { gap: 0.3, showCells: true });
  const bar = app.$('#bar'); bar.innerHTML = '';
  const col = el('div', 'namebar');
  col.append(el('div', 'namebig', cur.name));
  const sy = el('div', 'syls'); app._sylEls = [];
  cur.syllables.forEach((s, i) => {
    const c = el('div', 'syl ' + s.w); const t = el('div', 't', s.text); t.title = 'اضغط لتقسيم المقطع';
    t.onclick = () => { const n = [...s.text.replace(/[ً-ْٰ]/g, '')].length; if (n < 2) return; const cut = prompt(`قسّم «${s.text}» بعد كم حرف؟ (1 إلى ${n - 1})`, '1'); const k = +cut; if (k >= 1 && k < n) { const chars = [...s.text]; let seen = 0, pos = 0; for (; pos < chars.length && seen < k; pos++) if (!/[ً-ْٰ]/.test(chars[pos])) seen++; while (pos < chars.length && /[ً-ْٰ]/.test(chars[pos])) pos++; cur = { ...cur, source: 'edited', syllables: splitAt(cur.syllables, i, pos) }; draw(app); } };
    c.append(t, el('small', null, s.w === 'l' ? 'قصير' : 'طويل'));
    if (mode === 'custom') { const sel = el('select'); for (const id of ['s', 'e', 'q', 'qd', 'h']) sel.append(new Option(FIG[id].name, id)); sel.value = R.perSyl[i]; sel.onchange = () => { cur.syllables[i] = { ...s, fig: sel.value }; draw(app); }; c.append(sel); }
    else c.insertAdjacentHTML('beforeend', figureSVG([R.perSyl[i]], { k: 7, minTop: 4.3, minBottom: -1.4, padTop: 0.2, padBottom: 0.1, line: false }).svg);
    sy.append(c); app._sylEls.push(c);
    if (i < cur.syllables.length - 1) { const j = el('button', 'join', '⇄ دمج'); j.title = 'دمج المقطعين'; j.onclick = () => { cur = { ...cur, source: 'edited', syllables: mergeWithNext(cur.syllables, i) }; draw(app); }; sy.append(j); }
  });
  col.append(sy);
  const src = { dict: 'تقطيع من قاموس الأسماء المشكَّلة.', guess: 'تقطيع تقديري آلي — راجعه وعدّله إن خالف نطق الصف (اضغط مقطعًا لتقسيمه، أو «دمج»).', edited: 'تقطيع معدَّل يدويًا.' }[cur.source];
  col.append(el('p', 'hint', `${src} الاسم يُنطق موقوفًا عليه. ${R.filled ? 'أضيفت سكتة في الآخر لإكمال الزمن.' : ''}`));
  col.append(el('div', null, figureSVG(R.seq, { k: 9, color: '#f3f0fa' }).svg));
  const g = el('div', 'group');
  const ms = el('select'); [['beat', 'نبضة لكل مقطع'], ['length', 'المقطع القصير كروش والطويل نوار'], ['custom', 'يختار المعلم لكل مقطع']].forEach(([v, t]) => ms.append(new Option(t, v))); ms.value = mode; ms.onchange = () => { mode = ms.value; draw(app); };
  const say = el('button', null, '🗣 انطق الاسم'); say.onclick = () => { speak([cur.syllables.map((s) => s.text).join('')], { pitch: 1.1, rate: 0.85 }); };
  const pl = el('button', 'accent big', '▶ استمع للإيقاع'); pl.onclick = () => model(app, R, false);
  const me = el('button', 'pad', '👏 دوري'); me.onclick = () => model(app, R, true);
  const pr = el('button', null, '🖨 ورقة نشاط الأسماء'); pr.onclick = () => app.openPrint({ template: 'names', names: [cur.name, ...list(app).filter((n) => n !== cur.name)].slice(0, 12), mode });
  g.append(el('label', null, 'التمثيل '), ms, say, pl, me, pr);
  col.append(g); app._fb = el('div', 'feedback'); col.append(app._fb);
  bar.append(col);
}

/** يعزف الإيقاع مع تظليل المقاطع؛ وفي «دوري» يعزفه مرة ثم يستمع لتصفيق الطالب ويقارنه بلطف */
function model(app, R, thenListen) {
  app._fb.textContent = thenListen ? 'استمع أولًا…' : '';
  const syl = app._sylEls; let n = -1; const tl = timeline(R.seq);
  app.play(R.seq.map((id) => ({ ids: [id] })), {
    countIn: 2, onPart: (fi, pi, rest) => { if (rest) return; n++; syl.forEach((c, i) => c.classList.toggle('lit', i === n)); },
    onEnd: () => { syl.forEach((c) => c.classList.remove('lit')); if (thenListen) listen(app, tl); },
  });
}
function listen(app, tl) {
  const beat = 60 / app.state.bpm; const on = tl.filter((e) => !e.rest).map((e) => e.t / TPB * beat);
  app._fb.textContent = 'دورك الآن! صفّق على زر «دوري» أو بمفتاح المسافة.';
  listening = { taps: [], need: on.length, on };
  const handler = (e) => { if (e.type === 'keydown' && e.code !== 'Space') return; if (e.type === 'keydown') e.preventDefault(); if (!listening) return; listening.taps.push(performance.now() / 1000); if (listening.taps.length >= listening.need) finish(); };
  const pad = app.$('#bar .pad'); pad.onclick = null; pad.addEventListener('pointerdown', handler); addEventListener('keydown', handler);
  const timer = setTimeout(finish, (on[on.length - 1] || 1) * 1000 + 4000);
  function finish() {
    clearTimeout(timer); removeEventListener('keydown', handler); pad.removeEventListener('pointerdown', handler); if (!listening) return;
    const L = listening; listening = null; pad.onclick = () => app.$('#bar .accent') && model(app, rhythmFor(cur.syllables, mode), true);
    if (L.taps.length < L.need) { app._fb.textContent = `سمعتُ ${L.taps.length} من ${L.need} تصفيقات. استمع مرة أخرى ثم جرّب 👂`; return; }
    const t0 = L.taps[0]; const d = L.taps.map((t, i) => Math.abs((t - t0) - (L.on[i] - L.on[0]))); const worst = Math.max(...d);
    app._fb.textContent = worst < beat * 0.25 ? 'أحسنت في الأداء! تصفيقك مطابق لإيقاع الاسم 👏' : worst < beat * 0.5 ? 'قريب جدًا! استمع مرة أخرى وانتبه للمقاطع الطويلة.' : 'لنحاول مجددًا: صفّق مع كل مقطع من الاسم 🙂';
  }
}

export function printContext(app) { return { template: 'names', names: [cur ? cur.name : 'محمد', ...list(app)].slice(0, 12), mode }; }
