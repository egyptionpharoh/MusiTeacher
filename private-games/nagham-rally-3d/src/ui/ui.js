// =====================================================================
//  واجهات اللعب (عربية RTL): شاشة البداية للطلاب (كيف ألعب؟ + ابدأ السباق فقط)، لوحة السباق (HUD)،
//  بطاقة المتسابق الحالي، التغذية الراجعة، شاشة الانتقال بين المتسابقين، النتائج النهائية، والاستراحة.
//  إعدادات المعلم في settings.js. المنطق في game/race.js و main.js.
// =====================================================================
import { $, el, AR, fmtT, pctText, esc, sheet, toast } from './dom.js';
import { LANE_COLORS, LANE_LETTERS } from '../world/signs.js';
import { GRADE_NAME } from '../data/contest.js';
import { buildLessonPicker } from './lessonpick.js';

// دوّاسة البنزين (Accelerator Pedal): صفيحة مطاطية مضلّعة على ذراع معدني
const PEDAL_SVG = `<svg viewBox="0 0 100 132" aria-hidden="true"><rect x="44" y="96" width="12" height="34" rx="4" fill="#8a939e"/><rect x="46" y="96" width="4" height="34" rx="2" fill="#c3cad3"/><path d="M22 8H78Q85 8 86 15L91 90Q92 99 83 99H17Q8 99 9 90L14 15Q15 8 22 8Z" fill="#262a31" stroke="#b9c1cb" stroke-width="4"/><path d="M19.5 22H80.5" stroke="#0d1014" stroke-width="5" stroke-linecap="round"/><path d="M20.5 24.6H79.5" stroke="#4a515b" stroke-width="1.2" stroke-linecap="round"/><path d="M20.0 31H80.0" stroke="#0d1014" stroke-width="5" stroke-linecap="round"/><path d="M21.0 33.6H79.0" stroke="#4a515b" stroke-width="1.2" stroke-linecap="round"/><path d="M20.6 40H79.4" stroke="#0d1014" stroke-width="5" stroke-linecap="round"/><path d="M21.6 42.6H78.4" stroke="#4a515b" stroke-width="1.2" stroke-linecap="round"/><path d="M21.1 49H78.9" stroke="#0d1014" stroke-width="5" stroke-linecap="round"/><path d="M22.1 51.6H77.9" stroke="#4a515b" stroke-width="1.2" stroke-linecap="round"/><path d="M21.6 58H78.4" stroke="#0d1014" stroke-width="5" stroke-linecap="round"/><path d="M22.6 60.6H77.4" stroke="#4a515b" stroke-width="1.2" stroke-linecap="round"/><path d="M22.2 67H77.8" stroke="#0d1014" stroke-width="5" stroke-linecap="round"/><path d="M23.2 69.6H76.8" stroke="#4a515b" stroke-width="1.2" stroke-linecap="round"/><path d="M22.7 76H77.3" stroke="#0d1014" stroke-width="5" stroke-linecap="round"/><path d="M23.7 78.6H76.3" stroke="#4a515b" stroke-width="1.2" stroke-linecap="round"/><path d="M23.3 85H76.7" stroke="#0d1014" stroke-width="5" stroke-linecap="round"/><path d="M24.3 87.6H75.7" stroke="#4a515b" stroke-width="1.2" stroke-linecap="round"/></svg><span class="pl">بنزين</span>`;

export class UI {
  constructor(app) {
    this.app = app; this.root = $('#ui');
    this.qid = 0;
    this._buildStart(); this._buildHud();
  }

  // ================================================================== البداية (الطالب)
  _buildStart() {
    const w = this.start = el('div', { id: 'start' });
    const sb = el('div', { class: 'sb' });
    sb.append(el('div', { class: 'brand', html: `<img src="./assets/img/logo.png" alt="" onerror="this.remove()"><div><h1>رالي النغم</h1><small>NAGHAM RALLY 3D · MusiTeacher</small></div>` }));
    this.cTitle = el('div', { class: 'ctitle' });
    this.cSub = el('div', { class: 'csub' });
    this.lpHost = el('div', { class: 'lphost' });
    sb.append(this.cTitle, this.cSub, this.lpHost);
    this.goBtn = el('button', { class: 'btn pri go', onclick: () => this.app.startContest() }, '🚦 ابدأ السباق');
    sb.append(this.goBtn);
    sb.append(el('button', { class: 'btn help-btn', onclick: () => this.openHelp() }, '❔ كيف ألعب؟'));
    this.teacherBtn = el('button', { class: 'btn sm teacher-btn hidden', onclick: () => this.app.openSettings() }, '⚙️ إعدادات اللعبة للمعلم');
    sb.append(this.teacherBtn);
    w.append(sb, el('div', { class: 'stage-hint' }, 'اسحب لتدوير المركبة'));
    this.root.append(w);
  }
  /** يعرض عنوان المسابقة الحالية ومعلوماتها المختصرة على شاشة البداية */
  showContest(c, { teacher } = {}) {
    this.teacherBtn.classList.toggle('hidden', !teacher);
    // للمعلم: الصف ← الفصل ← الدرس مباشرة على شاشة البداية
    if (teacher && !this.picker && this.app.CT) { this.picker = buildLessonPicker(this.app); this.lpHost.append(this.picker.el); }
    if (this.picker) { this.picker.show(!!teacher); this.picker.sync(c); }
    if (!c) { this.cTitle.textContent = ''; this.cSub.textContent = ''; return; }
    this.cTitle.textContent = c.title || 'رالي النغم';
    const qs = this.app.playableCount ? this.app.playableCount(c) : c.questions.length;
    const parts = [];
    if (c.lessonTitle) parts.push(`${c.grade ? GRADE_NAME(c.grade) + ' · ' : ''}درس «${c.lessonTitle}»`);
    parts.push(`${AR(qs)} ${qs === 1 ? 'سؤال' : qs === 2 ? 'سؤالان' : qs <= 10 ? 'أسئلة' : 'سؤالًا'}`);
    if (c.names && c.names.length) parts.push(`${AR(c.names.length)} ${c.names.length <= 10 && c.names.length > 2 ? 'متسابقين' : 'متسابق'} بالدور`);
    this.cSub.textContent = parts.join(' · ');
  }
  showStart(on) { this.start.classList.toggle('hidden', !on); }
  setStartBusy(on) { this._busy = !!on; this._paintGo(); }
  setStartBlocked(on) { this._blocked = !!on; this._paintGo(); }
  _paintGo() { this.goBtn.disabled = !!(this._busy || this._blocked); this.goBtn.textContent = this._busy ? '⏳ تجهيز أسئلة الدرس…' : '🚦 ابدأ السباق'; }

  // ================================================================== لوحة السباق (مبسّطة)
  //  أعلى الوسط: لوحة سؤال واحدة بطابع تابلوه السيارة (السؤال + الصورة/النوتة إن وُجدت) وبجوارها مجموعة تحكم ثابتة:
  //  «أعد الاستماع» ثم الاستراحة والكاميرا والصوت وملء الشاشة. أعلى اليمين: بطاقة المتسابق. أسفل: الخيارات.
  //  أسفل اليسار: ◀ ▶ لتغيير المسار. أسفل اليمين: دوّاسة البنزين. لا عدّادات أثناء السباق (النتائج محفوظة داخليًا).
  _buildHud() {
    const h = this.hudEl = el('div', { id: 'hud', class: 'hidden' });
    this.who = el('div', { id: 'who' }); h.append(this.who);
    const dash = this.dash = el('div', { id: 'dash', class: 'idle' });
    const screen = el('div', { class: 'dscreen' });
    this.qd = el('span', { class: 'qd' }); this.qtext = el('div', { class: 'qtext' }, 'استعد للسؤال الأول…');
    screen.append(this.qd, this.qtext);
    this.cueEl = el('div', { class: 'cue' });
    const ctl = el('div', { class: 'dctl' });
    this.replayBtn = el('button', { class: 'replay', title: 'أعد الاستماع (R)', disabled: true, onclick: () => this.app.race.replay() }, el('span', { class: 'ic' }, '🔁'), el('span', { class: 'lb' }, 'أعد الاستماع'), el('i', { class: 'cnt' }));
    const small = el('div', { class: 'srow' });
    this.pauseBtn = el('button', { class: 'sbtn', title: 'استراحة (Enter)', 'aria-label': 'استراحة', onclick: () => this.app.pause(true), html: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><rect x="4" y="3" width="4.2" height="14" rx="1.2" fill="currentColor"/><rect x="11.8" y="3" width="4.2" height="14" rx="1.2" fill="currentColor"/></svg>' });
    this.camBtn = el('button', { class: 'sbtn', title: 'منظور السائق (C)', 'aria-label': 'منظور السائق', onclick: () => this.app.toggleCamera() }, '👁️');
    this.muteBtn = el('button', { class: 'sbtn', title: 'كتم الصوت (M)', 'aria-label': 'كتم الصوت', onclick: () => { this.app.toggleMute(); this.muteBtn.textContent = this.app.audio.muted ? '🔇' : '🔊'; } }, '🔊');
    small.append(this.pauseBtn, this.camBtn, this.muteBtn, el('button', { class: 'sbtn', title: 'ملء الشاشة', 'aria-label': 'ملء الشاشة', onclick: () => this.app.fullscreen(), html: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/></svg>' }));
    ctl.append(this.replayBtn, small);
    dash.append(this.cueEl, screen, ctl); h.append(dash);
    this.opts = el('div', { id: 'opts', class: 'off' }); h.append(this.opts);
    h.append(el('div', { id: 'distbar' }, el('i')), el('div', { id: 'tleft' }), el('div', { id: 'lockmsg' }, '⛔ داخل حاجز المسار — لا تبديل الآن'));
    // التوجيه: يمين/يسار
    const steer = el('div', { class: 'steer' },
      el('button', { title: 'يسار (←)', 'aria-label': 'يسار', onclick: () => this.app.race.steer(1) }, '◀'),
      el('button', { title: 'يمين (→)', 'aria-label': 'يمين', onclick: () => this.app.race.steer(-1) }, '▶'));
    // دوّاسة البنزين: الضغط المستمر يزيد السرعة تدريجيًا، والترك يعيدها إلى سرعة السير
    const pedal = this.pedal = el('button', { class: 'pedal', title: 'دوّاسة البنزين (↑)', 'aria-label': 'دوّاسة البنزين — اضغط مطولًا للتسريع', html: PEDAL_SVG });
    const on = (e) => { e.preventDefault(); try { pedal.setPointerCapture(e.pointerId); } catch (x) { /* */ } this.app.race.touch.gas = true; pedal.classList.add('on'); };
    const off = () => { this.app.race.touch.gas = false; pedal.classList.remove('on'); };
    pedal.addEventListener('pointerdown', on); pedal.addEventListener('pointerup', off); pedal.addEventListener('pointercancel', off); pedal.addEventListener('lostpointercapture', off);
    pedal.addEventListener('contextmenu', (e) => e.preventDefault());
    h.append(steer, pedal);
    this.lower = el('div', { id: 'lower3', class: 'off' });
    h.append(el('div', { id: 'cd' }), el('div', { id: 'fb', class: 'off' }), el('div', { id: 'banner', class: 'off' }), this.lower);
    this.root.append(h);
  }
  hud(on) {
    this.hudEl.classList.toggle('hidden', !on);
    if (on) { const S = this.app.race.S; this.camBtn.classList.toggle('hidden', S.allowCamera === false); this.muteBtn.textContent = this.app.audio.muted ? '🔇' : '🔊'; }
    else { this.app.race.touch.gas = false; this.pedal.classList.remove('on'); }
  }
  camState(mode) { const pov = mode === 'pov'; this.camBtn.textContent = pov ? '🎥' : '👁️'; this.camBtn.title = pov ? 'العودة إلى الكاميرا الخارجية (C)' : 'منظور السائق (C)'; this.camBtn.setAttribute('aria-label', this.camBtn.title); this.camBtn.classList.toggle('on', pov); }
  /** اسم المتسابق: بطاقة دائمة أعلى اليمين + شريط تلفزيوني كبير عند بداية الجولة */
  contestant(name) {
    const n = (name || '').trim();
    this.who.replaceChildren(...(n ? [el('small', {}, 'المتسابق:'), el('b', {}, n)] : [el('b', {}, '🏎️ أنت في السباق')]));
    this.lower.replaceChildren(...(n ? [el('small', {}, 'المتسابق'), el('b', {}, n)] : [el('b', {}, 'بالتوفيق!')]));
    this.lower.classList.remove('off'); clearTimeout(this._lt);
    this._lt = setTimeout(() => this.lower.classList.add('off'), 4200);
  }
  /** يعرض سؤالًا مجهّزًا بالكامل (imgs جاهزة) دفعة واحدة. ch = null: تعود اللوحة لحالة الانتظار (تبقى أدوات التحكم ثابتة) */
  question(ch, n, total, imgs, qid, keepOpts) {
    if (!ch) {
      this.dash.classList.add('idle'); this.qd.textContent = ''; this.qtext.textContent = this.app.race.finishZ != null ? '🏁 إلى خط النهاية!' : 'استعد للسؤال التالي…';
      this.cueEl.replaceChildren(); this.audioState(false);
      if (!keepOpts) { this.opts.classList.add('off'); document.body.classList.remove('has-opts'); }
      $('#distbar i').style.height = '0'; $('#tleft').textContent = '';
      return;
    }
    this.qid = qid; this.curCh = ch;
    clearTimeout(this._fbt); $('#fb').classList.add('off');
    this.qd.textContent = `${ch.domainIcon || '🎵'} ${ch.domainName || ''}`;
    this.qtext.textContent = ch.prompt;
    this.cueEl.replaceChildren(...(imgs.cue ? [el('img', { src: imgs.cue, alt: '' })] : []));
    this.dash.classList.toggle('has-cue', !!imgs.cue); this.dash.classList.remove('idle');
    const frag = document.createDocumentFragment();
    ch.options.forEach((o, i) => {
      frag.append(el('button', { class: 'opt', style: `--c:${LANE_COLORS[i]}`, title: 'اضغط لتوجيه المركبة إلى هذا المسار', 'aria-label': `المسار ${LANE_LETTERS[i]}: ${o.label}`, onclick: () => this.app.race.goLane(i) }, el('span', { class: 'lt' }, LANE_LETTERS[i]), el('img', { src: imgs.opts[i], alt: o.label })));
    });
    this.opts.replaceChildren(frag);
    this.opts.classList.remove('off'); document.body.classList.add('has-opts');
  }
  /** زر «أعد الاستماع»: ثابت في مكانه دائمًا؛ يعمل في الأسئلة الصوتية فقط ويظهر معطّلًا باهتًا في غيرها */
  audioState(has, left = 0, max = 0, playing = false) {
    const b = this.replayBtn, c = b.querySelector('.cnt');
    b.classList.toggle('na', !has); b.classList.toggle('playing', !!playing);
    b.disabled = !has || (max >= 0 && left <= 0);
    b.title = !has ? 'لا يوجد مقطع صوتي في هذا السؤال' : max >= 0 && left <= 0 ? 'انتهت مرات إعادة الاستماع' : 'أعد الاستماع (R)';
    c.textContent = has && max > 0 ? AR(Math.max(0, left)) : '';
  }
  distance(dz, tleft, locked, dist, lane) {
    const p = Math.max(0, Math.min(1, 1 - dz / dist));
    $('#distbar i').style.height = (p * 100).toFixed(1) + '%';
    $('#distbar').classList.toggle('lock', locked);
    $('#tleft').textContent = AR(Math.ceil(tleft));
    [...this.opts.children].forEach((o, i) => o.classList.toggle('here', i === lane));
  }
  flash(kind) {
    const m = $('#lockmsg');
    m.textContent = kind === 'locked' ? '⛔ داخل حاجز المسار — لا تبديل الآن' : '🔇 انتهت مرات إعادة الاستماع';
    m.classList.add('on'); clearTimeout(this._fl); this._fl = setTimeout(() => m.classList.remove('on'), 1200);
  }
  countdown(n) {
    const c = $('#cd'); if (n < 0) { c.textContent = ''; return; }
    c.textContent = n === 0 ? 'انطلق!' : AR(n); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
    if (n === 0) setTimeout(() => { if (c.textContent === 'انطلق!') c.textContent = ''; }, 900);
  }
  feedback(f) {
    const b = $('#fb'); clearTimeout(this._fbt);
    if (!f) { b.classList.add('off'); return; }
    b.className = f.ok ? 'ok' : 'bad';
    const ans = this.curCh ? this.curCh.answer : -1;
    [...this.opts.children].forEach((o, i) => { o.classList.remove('here'); o.classList.toggle('ok', i === ans); o.classList.toggle('bad', i !== ans); });
    if (f.ok) b.innerHTML = `<div class="h">✔ أحسنت! +${AR(f.points)} نقاط</div><div class="e">${esc(f.explain || '')}</div>`;
    else b.innerHTML = `<div class="h">${f.crash ? '💥 ارتطام!' : '✘ ليس هذا المسار'}</div><div class="e">الإجابة الصحيحة: <b>المسار ${LANE_LETTERS[f.letter]} — ${esc(f.correctLabel)}</b><br>${esc(f.explain || '')}</div>`;
    // لا يُخفي المؤقت إلا بطاقات سؤاله هو (سبب اختفاء خيارات السؤال التالي سابقًا)
    const qid = f.qid;
    this._fbt = setTimeout(() => {
      b.classList.add('off');
      if (this.qid === qid) { this.opts.classList.add('off'); document.body.classList.remove('has-opts'); }
    }, f.ok ? 2400 : 3900);
  }
  banner(t) { const b = $('#banner'); b.textContent = t; b.classList.remove('off'); clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.add('off'), 2600); }
  toast(t) { toast(t); }

  // ================================================================== الاستراحة (تعتيم خفيف)
  pauseMenu(on) {
    if (this.pm) { this.pm.close(true); this.pm = null; }
    if (!on) return;
    const s = this.pm = sheet({ title: '⏸ استراحة', width: 440, light: true, onClose: () => { this.pm = null; this.app.pause(false); return true; } });
    s.body.classList.add('col');
    s.body.append(el('button', { class: 'btn pri', onclick: () => this.app.pause(false) }, '▶ متابعة'),
      el('button', { class: 'btn', onclick: () => { this.pauseMenu(false); this.app.restartTurn(); } }, '↻ إعادة جولة هذا المتسابق'),
      el('button', { class: 'btn', onclick: () => { this.pauseMenu(false); this.app.skipTurn(); } }, '⏭ إنهاء الجولة والانتقال للتالي'),
      el('button', { class: 'btn', onclick: () => { this.pauseMenu(false); this.app.toMenu(); } }, '🏠 القائمة الرئيسية'));
    s.body.append(el('p', { class: 'hint', style: { textAlign: 'center', margin: '2px 0 0' } }, 'اضغط Enter للمتابعة'));
    s.foot.remove();
  }

  // ================================================================== الانتقال بين المتسابقين
  transition(done, next, { index, count }, onGo) {
    this.hud(false);
    const m = el('div', { class: 'modal light trans' });
    const box = el('div', { class: 'tbox' });
    const icon = done.reason === 'finish' ? '🏁' : done.reason === 'skip' ? '⏭' : '💥';
    box.append(el('div', { class: 'tdone' }, `${icon} انتهت جولة `, el('b', {}, done.name || 'المتسابق')));
    box.append(el('div', { class: 'tscore' }, el('span', { class: 'pts' }, `${AR(done.score)} نقطة`), el('span', { class: 'pct' }, pctText(done.ok, done.total))));
    box.append(el('div', { class: 'tnext' }, el('small', {}, `المتسابق التالي (${AR(index + 1)} من ${AR(count)})`), el('b', {}, next)));
    const go = el('button', { class: 'btn pri go' }, '▶ ابدأ');
    const ring = el('div', { class: 'auto' });
    const hold = el('button', { class: 'btn sm ghost' }, '⏸ انتظر');
    box.append(go, el('div', { class: 'trow' }, ring, hold));
    m.append(box); document.body.append(m);
    let left = 6, timer = null;
    const fire = () => { clearInterval(timer); document.removeEventListener('keydown', key, true); m.remove(); onGo(); };
    const tick = () => { ring.textContent = `يبدأ تلقائيًا بعد ${AR(left)} ث`; if (left-- <= 0) fire(); };
    const key = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); } };
    document.addEventListener('keydown', key, true);
    go.onclick = fire;
    hold.onclick = () => { clearInterval(timer); ring.textContent = 'بانتظار المعلم…'; hold.remove(); };
    tick(); timer = setInterval(tick, 1000);
    go.focus();
  }

  // ================================================================== النتائج النهائية
  final(contest, results, { onAgain, onMenu }) {
    this.hud(false);
    const board = results.map((r, i) => ({ ...r, order: i })).sort((a, b) => b.score - a.score || b.ok - a.ok || a.time - b.time || a.order - b.order);
    const single = results.length === 1;
    const s = sheet({ title: single ? '🏁 نتيجتك' : '🏆 النتائج النهائية', sub: contest.title, width: 720, cls: 'res', onClose: () => { onMenu(); return true; } });
    if (!single) {
      const pod = el('div', { class: 'podium' });
      board.slice(0, 3).forEach((r, i) => pod.append(el('div', { class: 'pd p' + (i + 1) }, el('span', { class: 'medal' }, ['🥇', '🥈', '🥉'][i]), el('b', {}, r.name), el('small', {}, `${AR(r.score)} نقطة`))));
      s.body.append(pod);
    }
    const tb = el('table', { class: 'board' });
    tb.append(el('tr', {}, el('th', {}, 'الترتيب'), el('th', {}, 'المتسابق'), el('th', {}, 'النقاط'), el('th', {}, 'الإجابات الصحيحة'), el('th', {}, 'الزمن')));
    let rank = 0, prev = null;
    board.forEach((r, i) => { if (!prev || r.score !== prev.score || r.ok !== prev.ok || Math.round(r.time) !== Math.round(prev.time)) rank = i + 1; prev = r; tb.append(el('tr', {}, el('td', {}, AR(rank)), el('td', {}, r.name), el('td', {}, AR(r.score)), el('td', {}, pctText(r.ok, r.total)), el('td', {}, fmtT(r.time)))); });
    s.body.append(tb);
    s.body.append(el('p', { class: 'note' }, `كل إجابة صحيحة = ١٠ نقاط. الترتيب حسب النقاط ثم الزمن الأقل؛ أما أدوار اللعب فكانت بترتيب قائمة الأسماء.`));
    // مراجعة الأخطاء (مختصرة)
    const mist = [];
    for (const r of results) for (const x of r.results) if (!x.ok) mist.push({ who: r.name, x });
    if (mist.length) {
      const d = el('details', { class: 'mist' }, el('summary', {}, `📝 مراجعة الإجابات الخاطئة (${AR(mist.length)})`));
      for (const { who, x } of mist.slice(0, 40)) d.append(el('div', {}, el('b', {}, `${single ? '' : who + ': '}${x.ch.prompt}`), el('br'), `الصحيح: ${x.ch.options[x.ch.answer].label} — ${x.ch.explain || ''}`));
      s.body.append(d);
    }
    s.foot.append(el('button', { class: 'btn pri', onclick: () => { s.close(true); onAgain(); } }, '🔁 إعادة المسابقة من البداية'), el('button', { class: 'btn', onclick: () => { s.close(true); onMenu(); } }, '🏠 القائمة الرئيسية'));
  }

  openHelp() {
    const s = sheet({ title: '❔ كيف ألعب؟', width: 700, cls: 'help' });
    s.body.innerHTML = `
      <p>١) في بداية كل جولة يظهر <b>اسم المتسابق</b> ثم العدّ التنازلي، وتسير المركبة وحدها بسرعة ثابتة.</p>
      <p>٢) قبل كل مفترق يظهر <b>السؤال في اللوحة أعلى الشاشة</b>، ومعه العلامة أو الصورة الموسيقية إن وُجدت. في الأسئلة الصوتية يُسمع المقطع تلقائيًا، ويمكنك سماعه مرة أخرى بزر <b>🔁 أعد الاستماع</b> بجوار السؤال.</p>
      <p>٣) فوق الطريق جسر عليه لافتة لكل مسار (أ، ب، ج، د)، والخيارات نفسها أسفل الشاشة. <b>انتقل إلى مسار الإجابة الصحيحة</b> قبل البوابة.</p>
      <p>٤) قبل البوابة بقليل تبدأ <b>حواجز فاصلة</b>: بعدها لا يمكن تغيير المسار، فقرّر مبكرًا!</p>
      <p>٥) كل إجابة صحيحة = <b>١٠ نقاط</b> (تظهر النتائج في النهاية). الإجابة الخاطئة في نمط الأدوار = ارتطام كرتوني بالحواجز الإسفنجية وتنتهي الجولة، ويبدأ المتسابق التالي.</p>
      <p><b>التحكم باللمس أو الفأرة:</b> <b>◀ ▶</b> أسفل اليسار لتغيير المسار، و<b>دوّاسة البنزين</b> أسفل اليمين: اضغط عليها مطولًا لتزيد السرعة تدريجيًا، وارفع إصبعك لتعود المركبة إلى سرعتها العادية. ويمكنك أيضًا الضغط على بطاقة الإجابة فتتجه المركبة إلى مسارها.</p>
      <p><b>لوحة المفاتيح:</b> <span class="kbd">←</span><span class="kbd">→</span> تغيير المسار · <span class="kbd">↑</span> البنزين (اضغط مطولًا) · <span class="kbd">Enter</span> استراحة / متابعة · <span class="kbd">R</span> أعد الاستماع · <span class="kbd">1</span>–<span class="kbd">4</span> اختيار المسار مباشرة · <span class="kbd">C</span> منظور السائق / الكاميرا الخارجية · <span class="kbd">M</span> كتم الصوت.</p>`;
    s.foot.append(el('button', { class: 'btn pri', onclick: () => s.close(true) }, 'فهمت'));
  }
}
