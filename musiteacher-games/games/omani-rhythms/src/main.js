// =====================================================================
//  إيقاعات الفنون العُمانية — واجهة اللعبة: المكتبة، استوديو التفكيك، وضع المعلم، وضع الطالب، المصادر.
//  البيانات في data.js · المحرك في audio.js · المدوّنة في notation.js · المسرح ثلاثي الأبعاد في scene.js (يُحمَّل عند الحاجة فقط).
// =====================================================================
import { ARTS, INSTRUMENTS, EXTRAS, SOURCES, buildArt, beatsPerBar } from './data.js';
import { Engine } from './audio.js';
import { renderScore } from './notation.js';
import { hasWebGL } from './models.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const main = $('#main'), nav = $('#nav');

const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/></svg>',
  loop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  solo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  screen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
};
const GUIDE_SHORT = { g5: 'دليل الصف الخامس', g6: 'دليل الصف السادس', g7: 'دليل الصف السابع', g8: 'دليل الصف الثامن' };
const VIEWS = [['lib', 'مكتبة الفنون'], ['studio', 'استوديو التفكيك'], ['teacher', 'وضع المعلم'], ['student', 'وضع الطالب'], ['sources', 'المصادر والمراجع']];

// ---------------------------------------------------------------------
//  الحالة العامة
// ---------------------------------------------------------------------
const engine = new Engine();
const S = { view: 'lib', art: null, score: null, scoreView: 'all', stage: null, stageState: 'idle', libArt: null, build: -1, present: false, onFrame: null, stopAfter: 0 };
const img = (inst, cls = '') => { const i = INSTRUMENTS[inst]; return `<img class="${cls}" src="./assets/img/${i.model}.png" alt="${esc(i.name)}" data-fb="${esc(i.name)}" data-color="${i.color}" draggable="false">`; };
// صورة لم تُحمَّل: دائرة باسم الآلة (لا رموز تعبيرية)
document.addEventListener('error', (e) => {
  const t = e.target; if (!(t instanceof HTMLImageElement) || !t.dataset.fb) return;
  const s = document.createElement('span'); s.className = 'fallback-pic'; s.style.background = t.dataset.color; s.textContent = t.dataset.fb.replace(/^ال/, '').slice(0, 2); t.replaceWith(s);
}, true);

function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms); }
const artMeta = (a) => ARTS.find((x) => x.id === a);
const instsOf = (a) => [...new Set(a.tracks.map((t) => t.inst))];

// ---------------------------------------------------------------------
//  الصوت: تحميل العينات مرة واحدة، وتشغيل فن ما
// ---------------------------------------------------------------------
let loadP = null;
function ready() { if (!loadP) loadP = engine.load().then((ok) => { if (!ok) { loadP = null; toast('تعذّر تحميل الأصوات. تحقّق من الاتصال ثم أعد المحاولة.', 5000); } return ok; }); return loadP; }
async function playArt(art, opt = {}) {
  engine.ensure();
  if (engine.art !== art) engine.setArt(art);
  const ok = await ready(); if (!ok) return false;
  engine.loop = opt.loop ?? true;
  S.stopAfter = opt.loops || 0;
  if (opt.bpm) engine.setBpm(opt.bpm);
  engine.play(opt.fromStart ?? true);
  return true;
}
engine.onStop = () => { refreshTransport(); if (S.score) S.score.update(null); $$('.beats i, .beatdots i').forEach((i) => i.classList.remove('on')); if (S.libArt) { S.libArt = null; refreshLibButtons(); } };

// ---------------------------------------------------------------------
//  حلقة الرسم: كل ما يُرى (المؤشر، الإضاءة، حركة الآلات) يتبع الزمن المسموع فعليًا
// ---------------------------------------------------------------------
function frame() {
  requestAnimationFrame(frame);
  const pos = engine.position();
  if (pos) {
    const art = engine.art;
    for (const p of pos.passed) {
      for (const t of engine.tracks) {
        const h = t.byUnit.get(p.u); if (!h || !engine.audible(t) || !engine.enters(t, p.u)) continue;
        flash(t.id, h.k);
      }
      if (p.u % art.upb === 0) beatOn(Math.floor((p.u % art.upbar) / art.upb));
      if (S.stopAfter && p.loop >= S.stopAfter) { S.stopAfter = 0; engine.stop(); return; }
    }
    if (S.score && S.view !== 'lib') S.score.update(pos.pre ? null : pos.u + pos.frac);
  }
  if (S.stage && S.stageState === 'on') { S.stage.frame(); placeLabels(); }
  if (S.onFrame) S.onFrame(pos);
}
function flash(inst, k) {
  if (S.stage && S.stageState === 'on') S.stage.hit(inst, k);
  for (const el of $$(`[data-inst="${inst}"].inst, .stage-fallback [data-inst="${inst}"], .lbl[data-inst="${inst}"]`)) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('hit'), 120); }
}
function beatOn(i) {
  $$('.beats i').forEach((b, k) => b.classList.toggle('on', k === i));
  if (S.libArt) $$(`.art[data-art="${S.libArt}"] .beatdots i`).forEach((b, k) => b.classList.toggle('on', k === i));
}

// ---------------------------------------------------------------------
//  التنقل
// ---------------------------------------------------------------------
function go(view, id) { const h = `#${view}${id ? '/' + id : ''}`; if (location.hash === h) route(); else location.hash = h; }
function route() {
  const [v, id] = (location.hash.slice(1) || 'lib').split('/');
  const view = VIEWS.some((x) => x[0] === v) ? v : 'lib';
  engine.stop(); S.onFrame = null; S.stopAfter = 0; S.build = -1; S.libArt = null; S.score = null;
  setPresent(false);
  S.view = view;
  nav.innerHTML = VIEWS.map(([k, n]) => `<button data-go="${k}" ${k === view ? 'aria-current="true"' : ''}>${n}</button>`).join('');
  parkStage();
  if (view === 'lib') viewLib();
  else if (view === 'studio' || view === 'teacher') viewStudio(id || S.art?.id || ARTS[0].id, view === 'teacher');
  else if (view === 'student') viewStudent();
  else viewSources(id);
  window.scrollTo(0, 0);
}
nav.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go, (b.dataset.go === 'studio' || b.dataset.go === 'teacher') && S.art ? S.art.id : ''); });
window.addEventListener('hashchange', route);

// ---------------------------------------------------------------------
//  المكتبة
// ---------------------------------------------------------------------
function viewLib() {
  main.innerHTML = `
  <section class="lib-intro">
    <div><h2>مكتبة الفنون العُمانية</h2>
      <p class="muted small" style="margin:0">${ARTS.length} فنون من نماذج أدلة المعلم (الصفوف 5–8). لكل فن مدوّنته كما وردت، وآلاته مستقلةً في «استوديو التفكيك».</p></div>
    <button class="btn ghost sm" data-go-sources>المصادر والمراجع</button>
  </section>
  <div class="lib">${ARTS.map(artCard).join('')}</div>`;
}
function artCard(a) {
  const ins = instsOf(a), n = beatsPerBar(a.meter);
  return `<article class="art card" data-art="${a.id}">
    <div class="art-pic${ins.length > 3 ? " many" : ""}">${ins.slice(0, 4).map((i) => img(i)).join('')}
      <span class="meter">${a.meter[0]}/${a.meter[1]}</span><span class="beatdots">${'<i></i>'.repeat(n)}</span></div>
    <div class="art-body">
      <h3>${esc(a.title)}</h3>
      <div class="art-insts"><span class="chip m">${esc(a.kind)}</span>${a.region ? `<span class="chip">${esc(a.region)}</span>` : ''}<span class="chip g">${GUIDE_SHORT[a.src]}</span></div>
      <p>${esc(a.blurb)}</p>
      <div class="art-insts">${ins.map((i) => `<span class="chip">${esc(INSTRUMENTS[i].name)}</span>`).join('')}</div>
      <div class="art-actions">
        <button class="btn gold" data-act="listen">${ICON.play}<span>استمع للإيقاع كاملًا</span></button>
        <button class="btn" data-act="studio">ادخل استوديو التفكيك</button>
      </div>
    </div></article>`;
}
function refreshLibButtons() {
  $$('.art').forEach((c) => {
    const on = S.libArt === c.dataset.art, b = c.querySelector('[data-act="listen"]'); if (!b) return;
    b.innerHTML = on ? `${ICON.stop}<span>إيقاف</span>` : `${ICON.play}<span>استمع للإيقاع كاملًا</span>`;
    if (!on) c.querySelectorAll('.beatdots i').forEach((i) => i.classList.remove('on'));
  });
}
main.addEventListener('click', async (e) => {
  if (e.target.closest('[data-go-sources]')) return go('sources');
  const card = e.target.closest('.art'); if (!card || S.view !== 'lib') return;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'studio') { S.art = buildArt(artMeta(card.dataset.art)); go('studio', card.dataset.art); }
  if (act === 'listen') {
    const id = card.dataset.art;
    if (S.libArt === id) { engine.stop(); return; }
    engine.stop(); const art = buildArt(artMeta(id)); S.libArt = id; refreshLibButtons();
    engine.setArt(art); if (!(await playArt(art))) { S.libArt = null; refreshLibButtons(); }
  }
});

// ---------------------------------------------------------------------
//  استوديو التفكيك (ووضع المعلم)
// ---------------------------------------------------------------------
function viewStudio(id, teacher) {
  const meta = artMeta(id) || ARTS[0], art = buildArt(meta); S.art = art; S.scoreView = 'all';
  engine.setArt(art); engine.loop = true; engine.perf = false;
  const g = SOURCES.guides[art.src], hasEntry = art.tracks.some((t) => t.entry);
  const n = beatsPerBar(art.meter);
  main.innerHTML = `
  <div class="st-head">
    <button class="btn ghost sm" data-act="back">${ICON.back}<span>المكتبة</span></button>
    <h2>${esc(art.title)}</h2>
    <span class="chip m" dir="ltr">${art.meter[0]}/${art.meter[1]}</span><span class="chip">${art.barsN} ${art.barsN > 2 ? 'موازير' : 'مازورة'}</span><span class="chip">${art.tracks.length} آلات</span>
    <span class="chip g">${GUIDE_SHORT[art.src]} · ${esc(art.model)}</span>
    ${teacher ? `<label class="artsel">الفن: <select id="artSel">${ARTS.map((a) => `<option value="${a.id}" ${a.id === art.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      <button class="btn gold sm keep" data-act="present">${ICON.screen}<span>عرض على السبورة</span></button>` : `<button class="btn ghost sm" data-act="toTeacher">وضع المعلم</button>`}
  </div>
  ${teacher ? `<section class="teach card">
    <div class="teach-row"><b>أدوات المعلم</b>
      <button class="btn sm" data-act="build">${ICON.play}<span>البناء التدريجي: آلة بعد آلة</span></button>
      <button class="btn ghost sm" data-act="allOn">الفرقة كاملة</button>
      <button class="btn ghost sm" data-act="allOff">كتم الكل</button>
      <span class="muted small">اختصارات: المسافة = تشغيل/إيقاف مؤقت · 1–${art.tracks.length} = كتم آلة · S = منفرد للآلة المحددة</span></div>
    <div id="explain" class="explain"></div>
  </section>` : ''}
  <div class="st-layout">
    <div class="st-main">
      <div class="stage" id="stage"><div class="stage-fallback">${art.tracks.map((t) => `<span data-inst="${t.inst}">${img(t.inst)}<b>${esc(t.info.name)}</b></span>`).join('')}</div></div>
      <div class="transport card">
        <button class="ic big" data-act="play" aria-label="تشغيل" title="تشغيل / إيقاف مؤقت">${ICON.play}</button>
        <button class="ic" data-act="restart" aria-label="من البداية" title="من البداية">${ICON.restart}</button>
        <button class="ic" data-act="stop" aria-label="إيقاف" title="إيقاف">${ICON.stop}</button>
        <button class="ic on" data-act="loop" aria-pressed="true" title="تكرار الدورة">${ICON.loop}</button>
        <div class="beats" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i class="${i ? '' : 'first'}"></i>`).join('')}</div>
        <div class="sl"><label for="bpm">السرعة (نبضة/دقيقة) <b id="bpmV">${art.bpm.v}</b></label><input type="range" id="bpm" min="40" max="260" value="${art.bpm.v}"></div>
        <button class="btn ghost sm" data-act="bpmReset" title="${art.bpm.source ? 'السرعة الواردة في المدوّنة' : 'السرعة الافتراضية للعبة'}">${art.bpm.source ? `السرعة كما في المدوّنة (${art.bpm.v})` : `السرعة الافتراضية (${art.bpm.v})`}</button>
        <div class="sl"><label for="vol">المستوى العام <b id="volV">90%</b></label><input type="range" id="vol" min="0" max="100" value="90"></div>
        ${hasEntry ? `<label class="perf"><input type="checkbox" id="perf"> أداء كما في وصف الدليل: يبدأ الرحماني ثم يدخل الكاسر من الأناكروز</label>` : ''}
        <button class="btn ghost sm" data-act="resetMix">إعادة ضبط الآلات</button>
      </div>
      <div class="score-card card">
        <div class="score-bar"><b>المدوّنة الإيقاعية <span class="muted small">— ${GUIDE_SHORT[art.src]}، ${esc(art.model)}</span></b>
          <div class="seg" id="seg"><button data-sv="all" class="on">العرض المجمّع</button>${art.tracks.map((t) => `<button data-sv="${t.inst}">${esc(t.info.name)}</button>`).join('')}</div></div>
        <div class="score-scroll" id="score"></div>
        <div class="legend"><span><b>دُم</b>: الرأس السفلي (ساق إلى أعلى)</span><span><b class="t">تك</b>: الرأس العلوي (ساق إلى أسفل)</span><span>الخط الذهبي يتحرك مع الصوت المسموع، وتضيء العلامة الحالية في كل سطر.</span></div>
      </div>
      <div class="cards" id="cards">${art.tracks.map((t, i) => instCard(t, i)).join('')}</div>
    </div>
    <aside class="side">
      <div class="card"><h3>عن ${esc(art.title)}</h3><p>${esc(art.blurb)}</p>${art.more ? `<p class="muted">${esc(art.more)}</p>` : ''}
        <p class="small"><span class="chip m">${esc(art.kind)}</span> ${art.region ? `<span class="chip">${esc(art.region)}</span>` : ''}</p></div>
      ${art.tip ? `<div class="card tipbox"><h3>ملاحظة للاستماع</h3><p>${esc(art.tip)}</p></div>` : ''}
      ${extrasCard(art)}
      <div class="card"><h3>المصدر</h3><p class="small">${esc(g.cite)}<br>${esc(g.pages)} — ${esc(art.model)}.</p>
        <p class="small muted">${art.bpm.source ? 'السرعة ⁦♩ = ' + art.bpm.v + '⁩ واردة في المدوّنة.' : 'لم ترد السرعة في المصدر؛ السرعة المعروضة افتراضية من اللعبة.'} الأصوات تسجيلات حقيقية بديلة (ليست للآلات العُمانية نفسها).</p>
        <button class="btn ghost sm" data-go-sources>كل المصادر والتراخيص</button></div>
    </aside>
  </div>`;
  S.score = renderScore($('#score'), art);
  mountStage(art);
  refreshCards(); refreshTransport();
  if (teacher) explain(null);
}
/** آلات ترد في وصف الفن دون مدوّنة: صورة + وصف من الدليل، بلا صوت (لا نخترع لها إيقاعًا) */
function extrasCard(art) {
  const ex = Object.values(EXTRAS).filter((e) => e.arts.includes(art.id));
  if (!ex.length && !art.others) return '';
  return `<div class="card"><h3>${ex.length ? 'آلات ترد في الوصف دون مدوّنة' : 'آلات أخرى'}</h3>
    ${ex.map((e) => `<div class="extra"><img src="./assets/img/${e.model}.png" alt="${esc(e.name)}" data-fb="${esc(e.name)}" data-color="#b08a5a" draggable="false"><div><b>${esc(e.name)}</b><p>${esc(e.about)}</p></div></div>`).join('')}
    ${ex.length ? '<p class="small muted">لا مدوّنة لها في النموذج؛ لذلك تظهر صورةً ووصفًا فقط دون صوت.</p>' : ''}
    ${art.others ? `<p>${esc(art.others)}</p>` : ''}</div>`;
}
function instCard(t, i) {
  const info = t.info, nD = t.hits.filter((h) => h.k === 'D').length, nT = t.hits.filter((h) => h.k === 'T').length;
  return `<article class="inst card" data-inst="${t.inst}">
    <div class="inst-top">
      <button class="inst-pic" data-act="tapD" aria-label="اسمع ضربة ${esc(info.name)}" title="انقر لسماع ضربة">${img(t.inst)}</button>
      <div><h3><span class="num">${i + 1}</span>${esc(info.name)} <span class="state">تعزف</span></h3><p class="role">${esc(info.role)}</p></div>
    </div>
    <div class="inst-btns three">
      <button class="btn ghost sm" data-act="alone" title="تشغيل هذه الآلة وحدها / إيقافها">${ICON.play}<span>وحدها</span></button>
      <button class="btn ghost sm" data-act="mute" aria-pressed="false">${ICON.mute}<span>كتم</span></button>
      <button class="btn ghost sm" data-act="solo" aria-pressed="false">${ICON.solo}<span>منفرد</span></button>
    </div>
    <div class="sl"><label>مستوى صوت الآلة <b>85%</b></label><input type="range" data-act="tvol" min="0" max="100" value="85" aria-label="مستوى صوت ${esc(info.name)}"></div>
    <div class="inst-taps">اسمع: <button class="tap d" data-act="tapD">دُم</button>${nT ? '<button class="tap t" data-act="tapT">تك</button>' : ''}
      <span>في الدورة: ${nD} دُم${nT ? ` · ${nT} تك` : ''}</span></div>
    ${info.doc === 'name-only' ? '<p class="note">الاسم من المدوّنة؛ الشكل والصوت تقريبيان.</p>' : ''}
  </article>`;
}
function refreshCards() {
  const anySolo = engine.tracks.some((t) => t.solo);
  for (const t of engine.tracks) {
    const c = $(`.inst[data-inst="${t.id}"]`); if (!c) continue;
    const aud = engine.audible(t), st = c.querySelector('.state');
    c.classList.toggle('silent', !aud); c.classList.toggle('solo', t.solo);
    st.textContent = aud ? (t.solo ? 'منفردة' : 'تعزف') : (t.mute ? 'مكتومة' : 'صامتة (منفرد لغيرها)');
    const m = c.querySelector('[data-act="mute"]'); m.innerHTML = t.mute ? `${ICON.sound}<span>إلغاء الكتم</span>` : `${ICON.mute}<span>كتم</span>`; m.classList.toggle('on', t.mute); m.setAttribute('aria-pressed', t.mute);
    const s = c.querySelector('[data-act="solo"]'); s.classList.toggle('on', t.solo); s.setAttribute('aria-pressed', t.solo);
    const a = c.querySelector('[data-act="alone"]'), alone = engine.playing && t.solo && engine.tracks.filter((x) => x.solo).length === 1;
    a.innerHTML = alone ? `${ICON.stop}<span>إيقاف</span>` : `${ICON.play}<span>وحدها</span>`;
    if (S.score) S.score.setDim(t.id, !aud);
    const l = $(`.lbl[data-inst="${t.id}"]`); if (l) l.classList.toggle('off', !aud);
    const f = $(`.stage-fallback [data-inst="${t.id}"]`); if (f) f.classList.toggle('off', !aud);
  }
  void anySolo;
}
function refreshTransport() {
  const b = $('[data-act="play"]'); if (!b) return;
  b.innerHTML = engine.playing ? ICON.pause : ICON.play; b.setAttribute('aria-label', engine.playing ? 'إيقاف مؤقت' : (engine.paused ? 'استئناف' : 'تشغيل'));
  refreshCards();
}
async function togglePlay() {
  if (engine.playing) { engine.pause(); refreshTransport(); return; }
  await playArt(S.art, { fromStart: !engine.paused, loop: engine.loop }); refreshTransport();
}
function setScoreView(v) {
  S.scoreView = v; $$('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.sv === v));
  S.score = renderScore($('#score'), S.art, v === 'all' ? {} : { only: v }); refreshCards();
}

// المسرح ثلاثي الأبعاد: سياق WebGL واحد يُنقل بين الصفحات
async function mountStage(art) {
  const host = $('#stage'); if (!host) return;
  if (S.stageState === 'failed' || !hasWebGL()) { host.classList.add('flat'); return; }
  try {
    if (!S.stage) {
      S.stageState = 'loading'; const { Stage } = await import('./scene.js'); S.stage = new Stage($('#gl'));
      // جهاز بطيء الرسم: نعود إلى الصور الثابتة المتحركة حتى يبقى الصوت دقيقًا
      S.stage.onSlow = () => { S.stageState = 'failed'; S.stage.canvas.style.display = 'none'; const h = $('#stage'); if (h) { h.classList.remove('gl'); h.classList.add('flat'); h.querySelectorAll('.lbl').forEach((l) => l.remove()); } toast('عُرضت الآلات بصور ثابتة لتخفيف الحمل على هذا الجهاز.', 3500); };
    }
    if (S.art !== art || !$('#stage')) return;
    S.stage.setArt(art); host.appendChild(S.stage.canvas); host.classList.add('gl');
    host.querySelectorAll('.lbl').forEach((l) => l.remove());
    for (const t of art.tracks) host.insertAdjacentHTML('beforeend', `<span class="lbl" data-inst="${t.inst}">${esc(t.info.name)}</span>`);
    S.stageState = 'on'; S.stage.fit(); refreshCards();
  } catch (err) { console.warn('تعذّر تشغيل المسرح ثلاثي الأبعاد', err); S.stageState = 'failed'; host.classList.add('flat'); }
}
function parkStage() { if (S.stage) { document.body.appendChild(S.stage.canvas); S.stageState = S.stageState === 'failed' ? 'failed' : 'idle'; } }
function placeLabels() {
  const host = $('#stage'); if (!host || !S.stage) return;
  for (const p of S.stage.labels()) { const l = host.querySelector(`.lbl[data-inst="${p.inst}"]`); if (l) { l.style.left = `${p.x}%`; l.style.top = `${Math.min(88, p.y)}%`; } }
}
window.addEventListener('resize', () => { if (S.stage && S.stageState === 'on') S.stage.fit(); });

// وضع المعلم: شرح دور الآلة + البناء التدريجي
function explain(t) {
  const box = $('#explain'); if (!box) return;
  if (!t) { box.innerHTML = `<p class="muted small" style="margin:0">«البناء التدريجي» يكتم الآلات كلها ثم يضيفها واحدة واحدة بترتيب المدوّنة، مع شرح دور كل آلة. يمكنك أيضًا النقر على صورة أي آلة لسماع ضربتها.</p>`; return; }
  const n = S.build, total = S.art.tracks.length;
  box.innerHTML = `<div class="explain-in">${img(t.inst)}<div><b>${n + 1} / ${total} — ${esc(t.info.name)}</b><p>${esc(t.info.about)}</p><p><b>دورها في ${esc(S.art.title)}:</b> ${esc(t.info.role)}</p></div>
    <button class="btn gold sm" data-act="build">${n + 1 < total ? `أضف الآلة التالية: ${esc(S.art.tracks[n + 1].info.name)}` : 'أعد البناء من البداية'}</button></div>`;
}
async function buildStep() {
  const tr = S.art.tracks;
  if (S.build < 0 || S.build >= tr.length - 1) { S.build = -1; engine.resetMix(); for (const t of engine.tracks) t.mute = true; engine.applyGates(); }
  S.build++; const t = tr[S.build]; engine.setMute(t.inst, false);
  refreshCards(); explain(t);
  if (!engine.playing) await playArt(S.art, { fromStart: true }); refreshTransport();
}
function setPresent(on) {
  S.present = on; document.body.classList.toggle('present', on);
  const b = $('[data-act="present"]'); if (b) b.innerHTML = on ? `${ICON.screen}<span>إنهاء العرض</span>` : `${ICON.screen}<span>عرض على السبورة</span>`;
  try { if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); } catch (e) { /* */ }
  setTimeout(() => S.stage && S.stageState === 'on' && S.stage.fit(), 60);
}

main.addEventListener('click', async (e) => {
  if (S.view !== 'studio' && S.view !== 'teacher') return;
  const b = e.target.closest('[data-act], [data-sv]'); if (!b) return;
  if (b.dataset.sv) return setScoreView(b.dataset.sv);
  const act = b.dataset.act, card = b.closest('.inst'), id = card?.dataset.inst;
  engine.ensure();
  switch (act) {
    case 'back': return go('lib');
    case 'toTeacher': return go('teacher', S.art.id);
    case 'present': return setPresent(!S.present);
    case 'play': return togglePlay();
    case 'restart': engine.stop(); await playArt(S.art, { fromStart: true, loop: engine.loop }); return refreshTransport();
    case 'stop': engine.stop(); return refreshTransport();
    case 'loop': engine.loop = !engine.loop; b.classList.toggle('on', engine.loop); b.setAttribute('aria-pressed', engine.loop); return toast(engine.loop ? 'التكرار مفعّل' : 'تُعزف الدورة مرة واحدة');
    case 'bpmReset': engine.setBpm(S.art.bpm.v); $('#bpm').value = S.art.bpm.v; $('#bpmV').textContent = S.art.bpm.v; return;
    case 'resetMix': engine.resetMix(); $$('.inst input[data-act="tvol"]').forEach((r) => { r.value = 85; r.previousElementSibling.querySelector('b').textContent = '85%'; }); engine.tracks.forEach((t) => engine.setVol(t.id, 0.85)); S.build = -1; explain(null); return refreshCards();
    case 'allOn': engine.resetMix(); S.build = -1; explain(null); return refreshCards();
    case 'allOff': for (const t of engine.tracks) { t.solo = false; t.mute = true; } engine.applyGates(); S.build = -1; explain(null); return refreshCards();
    case 'build': return buildStep();
    case 'mute': { const t = engine.track(id); engine.setMute(id, !t.mute); return refreshCards(); }
    case 'solo': { const t = engine.track(id); engine.setSolo(id, !t.solo); if (S.view === 'teacher') { const tr = S.art.tracks.find((x) => x.inst === id); S.build = S.art.tracks.indexOf(tr) - 0; explainSolo(tr); } return refreshCards(); }
    case 'alone': {
      const t = engine.track(id), isAlone = engine.playing && t.solo && engine.tracks.filter((x) => x.solo).length === 1;
      if (isAlone) { engine.stop(); engine.clearSolo(); return refreshTransport(); }
      engine.clearSolo(); engine.setMute(id, false); engine.setSolo(id, true);
      if (!engine.playing) await playArt(S.art, { fromStart: true, loop: engine.loop });
      return refreshTransport();
    }
    case 'tapD': case 'tapT': { const k = act === 'tapD' ? 'D' : 'T'; if (!(await ready())) return; engine.tap(id, k); flash(id, k); if (S.view === 'teacher') explainSolo(S.art.tracks.find((x) => x.inst === id)); return; }
    default:
  }
});
function explainSolo(t) {
  const box = $('#explain'); if (!box || !t) return;
  box.innerHTML = `<div class="explain-in">${img(t.inst)}<div><b>${esc(t.info.name)}</b><p>${esc(t.info.about)}</p><p><b>دورها في ${esc(S.art.title)}:</b> ${esc(t.info.role)}</p></div></div>`;
}
main.addEventListener('input', (e) => {
  if (S.view !== 'studio' && S.view !== 'teacher') return;
  const r = e.target;
  if (r.id === 'bpm') { engine.setBpm(+r.value); $('#bpmV').textContent = r.value; }
  else if (r.id === 'vol') { engine.setVolume(r.value / 100); $('#volV').textContent = `${r.value}%`; }
  else if (r.dataset.act === 'tvol') { const id = r.closest('.inst').dataset.inst; engine.setVol(id, r.value / 100); r.previousElementSibling.querySelector('b').textContent = `${r.value}%`; }
});
main.addEventListener('change', (e) => {
  if (e.target.id === 'artSel') go('teacher', e.target.value);
  if (e.target.id === 'perf') { engine.perf = e.target.checked; const was = engine.playing; engine.stop(); if (was || e.target.checked) playArt(S.art, { fromStart: true }).then(refreshTransport); toast(e.target.checked ? 'يبدأ الرحماني وحده، ثم يدخل الكاسر بعد دورتين من الأناكروز على «تك».' : 'تعزف الآلتان معًا من البداية.', 4200); }
});
let selInst = null;
main.addEventListener('pointerdown', (e) => { const c = e.target.closest('.inst'); if (c) selInst = c.dataset.inst; });
document.addEventListener('keydown', (e) => {
  if (S.view !== 'studio' && S.view !== 'teacher') return;
  if (e.target.closest('input, select, textarea') && e.target.type !== 'range') return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (/^Digit[1-9]$/.test(e.code)) { const t = engine.tracks[+e.code.slice(5) - 1]; if (t) { engine.setMute(t.id, !t.mute); refreshCards(); toast(`${t.info.name}: ${t.mute ? 'مكتومة' : 'تعزف'}`, 1200); } }
  else if (e.code === 'KeyS' && selInst) { const t = engine.track(selInst); if (t) { engine.setSolo(t.id, !t.solo); refreshCards(); } }
  else if (e.code === 'Escape' && S.present) setPresent(false);
});
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && S.present) setPresent(false); });

// ---------------------------------------------------------------------
//  وضع الطالب: تحديات الاستماع والمعرفة
// ---------------------------------------------------------------------
const CH = [
  ['id', 'تعرّف على الآلة', 'استمع إلى آلة واحدة من الفرقة، ثم اختر صورتها.'],
  ['missing', 'أيّ آلة صامتة؟', 'تعزف الفرقة وإحدى آلاتها مكتومة. اكتشف الآلة الغائبة.'],
  ['rebuild', 'أعِد بناء الفرقة', 'استمع إلى المقطع الهدف، ثم اختر الآلات التي تعزف فيه وتحقّق.'],
  ['which', 'أيّ فنٍّ هذا؟', 'استمع إلى الإيقاع كاملًا، ثم اختر اسم الفن.'],
  ['quiz', 'اختبار المعرفة', 'أسئلة من نصوص أدلة المعلم عن الفنون وآلاتها.'],
];
const ST = { ch: 'id', art: 'any', score: 0, total: 0, q: null, answered: false };
function viewStudent() {
  main.innerHTML = `
  <div class="stu-top">
    <div class="pills" id="chs">${CH.map(([k, n]) => `<button data-ch="${k}" class="${k === ST.ch ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="pills"><label class="artsel">الفن: <select id="stuArt"><option value="any">كل الفنون (عشوائي)</option>${ARTS.map((a) => `<option value="${a.id}" ${ST.art === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      <span class="scorebox" id="scorebox">النقاط: ${ST.score} / ${ST.total}</span><button class="btn ghost sm" data-act="reset">تصفير</button></div>
  </div>
  <section class="card stu-card" id="stu"></section>`;
  newQ();
}
function stuArts(minTracks = 1) { const all = ARTS.filter((a) => a.tracks.length >= minTracks); if (ST.art !== 'any') { const a = all.find((x) => x.id === ST.art); return a ? [a] : all; } return all; }
function newQ() {
  engine.stop(); ST.answered = false; S.onFrame = null;
  const ch = ST.ch, box = $('#stu'), intro = CH.find((c) => c[0] === ch)[2];
  let q;
  if (ch === 'id') {
    const a = pickOne(stuArts()), art = buildArt(a), target = pickOne(art.tracks).inst;
    let opts = instsOf(a);
    if (opts.length < 3) opts = [...opts, ...shuffle(Object.keys(INSTRUMENTS).filter((k) => !opts.includes(k))).slice(0, 3 - opts.length)];
    q = { ch, art, target, opts: shuffle(opts), text: `من فن «${a.name}»: أيّ آلة تسمع؟` };
  } else if (ch === 'missing') {
    const a = pickOne(stuArts(2)), art = buildArt(a), target = pickOne(art.tracks).inst;
    q = { ch, art, target, opts: shuffle(instsOf(a)), text: `فن «${a.name}»: أيّ آلة صامتة؟` };
  } else if (ch === 'rebuild') {
    const a = pickOne(stuArts(2)), art = buildArt(a), ins = instsOf(a);
    const size = ins.length === 2 ? pickOne([1, 2]) : 2 + Math.floor(Math.random() * (ins.length - 2));
    q = { ch, art, set: shuffle(ins).slice(0, size), opts: ins, sel: new Set(), text: `فن «${a.name}»: أيّ الآلات تعزف في المقطع الهدف؟` };
  } else if (ch === 'which') {
    const a = pickOne(ARTS), others = shuffle(ARTS.filter((x) => x.id !== a.id)).slice(0, 3);
    q = { ch, art: buildArt(a), target: a.id, opts: shuffle([a, ...others]).map((x) => x.id), text: 'أيّ فنٍّ تسمع إيقاعه؟' };
  } else q = quizQ();
  ST.q = q;
  box.innerHTML = `<p class="muted small" style="margin:0">${intro}</p><p class="stu-q">${esc(q.text)}</p>
    ${q.art && ch !== 'quiz' ? `<div class="stu-play">
      ${ch === 'rebuild' ? `<button class="btn gold" data-act="hearTarget">${ICON.play}<span>اسمع المقطع الهدف</span></button><button class="btn" data-act="hearMine">${ICON.play}<span>اسمع اختياري</span></button>`
        : `<button class="btn gold" data-act="hear">${ICON.play}<span>استمع</span></button>`}
      ${ch === 'missing' ? `<button class="btn ghost" data-act="hearFull">${ICON.sound}<span>اسمع الفرقة كاملة للمقارنة</span></button>` : ''}
      <button class="btn ghost" data-act="hush">${ICON.stop}<span>إيقاف</span></button></div>` : ''}
    <div class="picks">${q.opts.map((o) => optHTML(q, o)).join('')}</div>
    ${ch === 'rebuild' ? `<button class="btn" data-act="check">تحقّق</button>` : ''}
    <div id="fb"></div>`;
}
function optHTML(q, o) {
  if (q.ch === 'which') return `<button class="pick wide" data-o="${o}">${esc(artMeta(o).title)}</button>`;
  if (q.ch === 'quiz') return `<button class="pick wide" data-o="${esc(o)}">${esc(o)}</button>`;
  return `<button class="pick" data-o="${o}">${img(o)}<span>${esc(INSTRUMENTS[o].name)}</span></button>`;
}
async function stuHear(mode) {
  const q = ST.q; engine.stop(); engine.setArt(q.art); engine.resetMix();
  if (q.ch === 'id') engine.setSolo(q.target, true);
  if (q.ch === 'missing' && mode !== 'full') engine.setMute(q.target, true);
  if (q.ch === 'rebuild') { const set = mode === 'mine' ? q.sel : new Set(q.set); for (const t of engine.tracks) engine.setMute(t.id, !set.has(t.id)); if (mode === 'mine' && !q.sel.size) return toast('اختر آلة واحدة على الأقل'); }
  await playArt(q.art, { loop: true, loops: q.ch === 'which' ? 3 : 2 });
}
function mark(ok, extra = '') {
  ST.total++; if (ok) ST.score++; ST.answered = true; $('#scorebox').textContent = `النقاط: ${ST.score} / ${ST.total}`;
  $('#fb').innerHTML = `<p class="fb ${ok ? 'ok' : 'no'}">${ok ? 'أحسنت! إجابة صحيحة.' : 'ليست هذه الإجابة.'} ${extra}</p><button class="btn gold" data-act="next">السؤال التالي</button>`;
}
function answer(o, el) {
  const q = ST.q; if (ST.answered) return;
  if (q.ch === 'rebuild') { q.sel.has(o) ? q.sel.delete(o) : q.sel.add(o); el.classList.toggle('sel', q.sel.has(o)); return; }
  const right = q.ch === 'quiz' ? q.answer : q.target, ok = o === right;
  $$('.pick').forEach((p) => { if (p.dataset.o === right) p.classList.add('right'); else if (p === el) p.classList.add('wrong'); });
  let extra = '';
  if (q.ch === 'id' || q.ch === 'missing') { const i = INSTRUMENTS[q.target]; extra = `${q.ch === 'missing' ? 'الآلة الصامتة' : 'الآلة'}: ${i.name} — ${i.role}`; }
  if (q.ch === 'which') { const a = artMeta(q.target); extra = `${a.title}: الميزان ${a.meter[0]}/${a.meter[1]}، وآلاته: ${instsOf(a).map((x) => INSTRUMENTS[x].name).join('، ')}.`; }
  if (q.ch === 'quiz') extra = q.why || '';
  mark(ok, esc(extra));
}
/** أسئلة المعرفة: كل سؤال مبني من نصوص البيانات الموثّقة نفسها (لا معلومات من خارجها) */
function quizQ() {
  const pool = [];
  const arts = stuArts();
  for (const a of arts) {
    const m = `${a.meter[0]}/${a.meter[1]}`, ms = shuffle([...new Set(ARTS.map((x) => `${x.meter[0]}/${x.meter[1]}`))].filter((x) => x !== m)).slice(0, 3);
    pool.push({ text: `ما ميزان إيقاع ${a.title} كما في مدوّنة الدليل؟`, answer: m, opts: shuffle([m, ...ms]), why: `${a.title} في ${GUIDE_SHORT[a.src]} (${a.model}) بميزان ${m}.` });
    const n = String(a.tracks.length);
    pool.push({ text: `كم آلة إيقاعية في مدوّنة ${a.title}؟`, answer: n, opts: shuffle([...new Set([n, '2', '3', '4', '6'])]).slice(0, 4).concat([]).filter((v, i, s) => s.indexOf(v) === i), why: `الآلات: ${instsOf(a).map((x) => INSTRUMENTS[x].name).join('، ')}.` });
    if (/رجالي|نسائي/.test(a.kind)) { const r = a.kind.includes('نسائي') ? 'فن نسائي' : 'فن رجالي'; pool.push({ text: `${a.title}:`, answer: r, opts: ['فن رجالي', 'فن نسائي'], why: `${a.title} ${a.kind}${a.region ? ' — ' + a.region : ''}.` }); }
    if (a.region) { const others = shuffle(ARTS.filter((x) => x.region && x.region !== a.region && x.id !== a.id)).slice(0, 3); pool.push({ text: `أيّ هذه الفنون ${a.region.startsWith('محافظ') || a.region.startsWith('الولايات') ? 'من فنون ' + a.region : 'يُؤدّى في ' + a.region}؟`, answer: a.title, opts: shuffle([a.title, ...others.map((x) => x.title)]), why: `${a.title}: ${a.region}.` }); }
  }
  const D = [['msindo', 'آلة إيقاعية ذات رَقمة جلد واحدة تُثبَّت على جسم طويل مخروطي الشكل، ويُضرب عليها باليدين.'], ['tanak', 'علبة معدنية فارغة يُضرب عليها بعصوين خشبيتين.'], ['tar', 'إطار خشبي دائري مغطى بالجلد، ويُعرف بالطار الكبير أو الدف الكبير.'], ['rahmani', 'الطبل الأكبر حجمًا والأعمق صوتًا من الكاسر.'], ['ranna', 'آلة إيقاعية تشبه الكاسر والرحماني، لكنها متوسطة الحجم والصوت بالمقارنة بهما.'], ['kasir_flat', 'من فصيلة الكاسر، أقصر منه ومفلطح، وجلده بشعره فيصدر صوتًا مكتومًا نسبيًّا.'], ['bargham', 'آلة نفخية تُصنع من قرون الوعل أو المها العربي، وتصدر نغمة واحدة.'], ['jem', 'صدفة بحرية من آلات النفخ، تصدر صوتًا واحدًا.']];
  const nm = (k) => (INSTRUMENTS[k] || EXTRAS[k]).name, ALL = ['rahmani', 'kasir', 'msindo', 'tanak', 'sajat', 'tar', 'ranna', 'kasir_flat', 'bargham', 'jem'];
  for (const [k, d] of D) pool.push({ text: `أيّ آلة هذه: «${d}»`, answer: nm(k), opts: shuffle([nm(k), ...shuffle(ALL.filter((x) => x !== k)).slice(0, 3).map(nm)]), why: (INSTRUMENTS[k] || EXTRAS[k]).about });
  if (ST.art === 'any' || ST.art === 'baraa') pool.push({ text: 'في أيّ عام أُدرج فن البرعة في القائمة التمثيلية للتراث الثقافي غير المادي للإنسانية (اليونسكو)؟', answer: '2010', opts: ['2008', '2010', '2012', '2014'], why: 'أُدرج فن البرعة عام 2010 (دليل الصف الثامن؛ وموقع اليونسكو).' });
  if (ST.art === 'any' || ST.art === 'hambura') pool.push({ text: 'أيّ فن وردت سرعته في المدوّنة (⁦♩ = 220⁩)؟', answer: 'فن الحمبورة', opts: shuffle(['فن الحمبورة', 'فن الرزحة', 'فن البرعة', 'فن المديمة']), why: 'مدوّنة الحمبورة في دليل الصف السادس تحمل السرعة ⁦♩ = 220⁩.' });
  const q = pickOne(pool); return { ch: 'quiz', ...q };
}
main.addEventListener('click', async (e) => {
  if (S.view !== 'student') return;
  const c = e.target.closest('[data-ch]'); if (c) { ST.ch = c.dataset.ch; $$('#chs button').forEach((b) => b.classList.toggle('on', b === c)); return newQ(); }
  const p = e.target.closest('.pick'); if (p) return answer(p.dataset.o, p);
  const act = e.target.closest('[data-act]')?.dataset.act; engine.ensure();
  if (act === 'hear') stuHear();
  if (act === 'hearFull') stuHear('full');
  if (act === 'hearTarget') stuHear('target');
  if (act === 'hearMine') stuHear('mine');
  if (act === 'hush') engine.stop();
  if (act === 'next') newQ();
  if (act === 'reset') { ST.score = 0; ST.total = 0; $('#scorebox').textContent = 'النقاط: 0 / 0'; }
  if (act === 'check' && !ST.answered) {
    const q = ST.q, ok = q.sel.size === q.set.length && q.set.every((x) => q.sel.has(x));
    $$('.pick').forEach((pk) => { const inSet = q.set.includes(pk.dataset.o); if (inSet) pk.classList.add('right'); else if (q.sel.has(pk.dataset.o)) pk.classList.add('wrong'); });
    mark(ok, esc(`الآلات في المقطع الهدف: ${q.set.map((x) => INSTRUMENTS[x].name).join('، ')}.`));
  }
});
main.addEventListener('change', (e) => { if (e.target.id === 'stuArt') { ST.art = e.target.value; newQ(); } });

// ---------------------------------------------------------------------
//  المصادر والمراجع
// ---------------------------------------------------------------------
function viewSources(focus) {
  const A = SOURCES.audio;
  main.innerHTML = `<div class="src">
    <section class="card"><h2>المصادر والمراجع</h2>
      <p class="muted">يفصل هذا القسم بين ما هو <span class="tag doc">موثّق</span> (من أدلة المعلم أو المراجع المذكورة) وما هو <span class="tag game">من معالجة اللعبة</span>. لا توجد في اللعبة مراجع أو روابط غير مذكورة هنا.</p></section>
    <section class="card"><h3>المراجع التعليمية (أدلة المعلم — وزارة التربية والتعليم، سلطنة عُمان)</h3>
      <table><thead><tr><th>المرجع</th><th>الصفحات</th><th>الفنون والنماذج</th></tr></thead><tbody>
      ${Object.entries(SOURCES.guides).map(([k, g]) => `<tr><td>${esc(g.cite)}</td><td>${esc(g.pages)}</td><td>${g.arts.map((id) => { const a = artMeta(id); return `${esc(a.title)} — ${esc(a.model)}`; }).join('<br>')}</td></tr>`).join('')}
      </tbody></table>
      <p class="small muted">النسخ المعتمدة هي الصفحات التي زوّد بها المعلم من الأدلة. تاريخ الاطلاع: 18 نوفمبر 2026.</p></section>
    <section class="card"><h3>مراجع إلكترونية مساندة</h3>
      <table><thead><tr><th>الجهة / الكاتب</th><th>العنوان</th><th>السنة</th><th>الرابط وتاريخ الاطلاع</th><th>ما أُخذ منه</th></tr></thead><tbody>
      ${SOURCES.web.map((w) => `<tr><td>${esc(w.who)}</td><td dir="auto">${esc(w.title)}</td><td>${esc(w.year)}</td><td><a href="${esc(w.url)}" target="_blank" rel="noopener" dir="ltr">${esc(w.url)}</a><br><span class="small muted">اطُّلع عليه: ${esc(w.accessed)}</span></td><td>${esc(w.used)}</td></tr>`).join('')}
      </tbody></table></section>
    <section class="card"><h3>مقاطع مرئية أرسلها المعلم (للمشاهدة)</h3><p class="small">${esc(SOURCES.videos.note)}</p>
      <ul class="vids">${SOURCES.videos.urls.map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener" dir="ltr">${esc(u)}</a></li>`).join('')}</ul></section>
    <section class="card"><h3>الفنون: الموثّق والمعالَج</h3>
      ${ARTS.map((a) => `<details id="src-${a.id}" ${focus === a.id ? 'open' : ''}><summary>${esc(a.title)} <span class="chip g">${GUIDE_SHORT[a.src]} · ${esc(a.model)}</span></summary>
        <ul>
          <li><span class="tag doc">موثّق</span> المدوّنة: الميزان ${a.meter[0]}/${a.meter[1]}، ${a.tracks.length} آلات (${a.tracks.map((t) => INSTRUMENTS[t.inst].name).join('، ')})، منقولة دون تغيير في القيم أو الترتيب.</li>
          <li><span class="tag doc">موثّق</span> الوصف والنبذة: ${esc(SOURCES.guides[a.src].cite)} ${esc(SOURCES.guides[a.src].pages)}.${SOURCES.web.filter((w) => w.arts.includes(a.id)).map((w) => ` وكذلك: ${esc(w.who)}، «${esc(w.title)}».`).join('')}</li>
          <li>${a.bpm.source ? `<span class="tag doc">موثّق</span> السرعة ⁦♩ = ${a.bpm.v}⁩ واردة في المدوّنة.` : `<span class="tag game">معالجة اللعبة</span> السرعة الافتراضية (${a.bpm.v}) من اختيار اللعبة؛ لم ترد في المصدر.`}</li>
          ${a.tracks.some((t) => t.entry) ? '<li><span class="tag doc">موثّق</span> ترتيب الدخول (الرحماني أولًا ثم الكاسر من الأناكروز). <span class="tag game">معالجة اللعبة</span> عدد الدورات قبل الدخول.</li>' : ''}
          <li><span class="tag game">معالجة اللعبة</span> الأصوات بديلة حقيقية (انظر الجدول أدناه)، والمجسّمات مبنية برمجيًا.</li>
        </ul></details>`).join('')}</section>
    <section class="card"><h3>قراءة المدوّنة</h3><ul>${SOURCES.notation.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>
    <section class="card"><h3>الأصوات وتراخيصها</h3><p>${esc(A.intro)}</p><p class="small">${esc(A.lib)}<br>${esc(A.note)}</p>
      <table><thead><tr><th>الآلة في اللعبة</th><th>التسجيل المستخدم</th><th>طبيعته</th></tr></thead><tbody>${A.rows.map((r) => `<tr><td>${esc(r[0])}</td><td dir="auto">${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table>
      <p class="small muted">المعالجة: تحويل إلى MP3 أحادي، وقصّ الصمت في البداية، وضبط المستوى؛ وفي المسيندو والرنة والكاسر المفلطح تغيير خفيف للطبقة. لم يُولَّد أي صوت إلكترونيًا. ${esc(A.replace)}</p></section>
    <section class="card"><h3>الصور والمجسّمات</h3><p>${esc(SOURCES.visuals)}</p></section>
    <section class="card"><h3>ما هو من تصميم اللعبة (ليس تراثًا موثّقًا)</h3><ul>${SOURCES.game.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>
  </div>`;
  if (focus) setTimeout(() => $(`#src-${focus}`)?.scrollIntoView({ block: 'start' }), 50);
}

// ---------------------------------------------------------------------
//  البدء
// ---------------------------------------------------------------------
route();
ready();
requestAnimationFrame(frame);
// لإتاحة الاختبار الآلي فقط (لا تأثير على الاستخدام)
window.__omr = { engine, S, ARTS, buildArt };
