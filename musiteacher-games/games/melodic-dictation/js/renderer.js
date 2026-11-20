// ============================================================================
// renderer.js — رسم المدرج والنوتة بـ SVG مع تحديد دقيق لمواضع النقر
// الكتابة الموسيقية من اليسار إلى اليمين دائمًا حتى داخل صفحة عربية.
// ============================================================================
(function (MT) {
  'use strict';
  const T = MT.theory, SC = MT.score, G = MT.GLYPHS;
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function ellipsePath(cx, cy, rx, ry, rot) {
    const a = rot * Math.PI / 180, dx = Math.cos(a) * rx, dy = Math.sin(a) * rx;
    return `M${cx + dx} ${cy + dy}A${rx} ${ry} ${rot} 1 0 ${cx - dx} ${cy - dy}A${rx} ${ry} ${rot} 1 0 ${cx + dx} ${cy + dy}Z`;
  }
  // يرسم رمزًا من الخط: ax/ay = نقطة الارتكاز في وحدات الخط، تُوضع عند (x,y)، بمقياس k
  function glyph(parent, name, x, y, k, ax, ay, cls, flipY) {
    const g = G[name];
    const sy = flipY ? k : -k;
    return el('path', { d: g.d, transform: `translate(${x - ax * k} ${y - ay * sy}) scale(${k} ${sy})`, class: cls || 'gl' }, parent);
  }

  class Renderer {
    constructor(host) {
      this.host = host;
      this.svg = el('svg', { class: 'score-svg', role: 'img', 'aria-label': 'المدرج الموسيقي', dir: 'ltr' });
      host.appendChild(this.svg);
      this.opts = {};
      this.score = null;
      this._lastW = 0;
      if (window.ResizeObserver) {
        new ResizeObserver(() => {
          const w = Math.round(this.host.clientWidth);
          if (this.score && Math.abs(w - this._lastW) > 4) this.render(this.score, this.opts);
        }).observe(host);
      }
    }

    // ---------------------------------------------------------------- القياسات
    metrics() {
      const W = Math.max(320, Math.round(this.host.clientWidth || 900));
      const S = Math.max(13, Math.min(24, W / 62)) * (this.opts.zoom || 1);
      return { W, S };
    }

    render(score, opts) {
      this.score = score; this.opts = opts || {};
      const o = this.opts;
      const { W, S } = this.metrics();
      this._lastW = W;
      this.S = S;
      const svg = this.svg;
      svg.textContent = '';
      const lay = SC.layout(score);
      this.lay = lay;
      const alters = SC.effectiveAlters(score, lay);
      const key = T.KEYS[score.key] || T.KEYS.C;
      const rhythmLine = !!o.rhythmLine;
      const labels = o.labels || 'none'; // 'solfege' | 'rhythm' | 'none'

      // ---- عرض كل علامة (مسافات تتناسب مع الزمن مع حد أدنى) ----
      const unit = S * 2.6;                 // عرض الزمن الواحد
      const minW = S * 2.1;
      const accW = S * 1.1;
      const measW = lay.measures.map((m, mi) => {
        let w = S * 1.4; // حشوة البداية
        m.items.forEach(it => {
          const hasAcc = !rhythmLine && it.note.kind === 'note' && it.note.pitch && it.note.pitch.alter !== null && it.note.pitch.alter !== undefined;
          // العلامات القصيرة جدًا (تريوليه/دوبل كروش) تأخذ عرضًا أصغر حتى لا تتمدد المازورة بلا داعٍ
          const mw = it.dur < 0.25 + 1e-6 ? S * 1.65 : minW;
          it._w = Math.max(mw, it.dur * unit) + (hasAcc ? accW : 0);
          it._acc = hasAcc;
          if (labels !== 'none') it._w = Math.max(it._w, S * (labels === 'rhythm' ? (it.dur < 0.5 - 1e-6 ? 1.9 : 2.4) : 2.4));
          w += it._w;
        });
        const free = Math.max(0, lay.cap - m.used);
        m._freeW = free > 1e-6 ? Math.max(S * 2.2, free * unit * 0.9) : 0;
        w += m._freeW + S * 0.8;
        return w;
      });

      // ---- توزيع الموازير على الأسطر ----
      const marginL = S * 0.6, marginR = S * 0.8;
      const clefW = rhythmLine ? S * 2.2 : S * 3.1;
      const keyW = rhythmLine ? 0 : key.sig.length * S * 1.05 + (key.sig.length ? S * 0.4 : 0);
      const timeW = S * 2.3;
      const maxPerLine = o.maxPerLine || (W > 1100 ? 4 : W > 760 ? 3 : 2);
      const lines = [];
      let cur = [], curW = 0;
      measW.forEach((w, i) => {
        const header = clefW + keyW + (lines.length === 0 && cur.length === 0 ? timeW : (cur.length === 0 ? 0 : 0));
        const avail = W - marginL - marginR - (cur.length === 0 ? header : (lines.length === 0 ? clefW + keyW + timeW : clefW + keyW));
        if (cur.length && (curW + w > avail || cur.length >= maxPerLine)) { lines.push(cur); cur = []; curW = 0; }
        cur.push(i); curW += w;
      });
      if (cur.length) lines.push(cur);

      // ---- الارتفاعات ----
      const hasLabels = labels !== 'none';
      const topPad = rhythmLine ? S * 5.6 : S * 5.2;
      const staffH = rhythmLine ? 0 : S * 4;
      const botPad = rhythmLine ? S * (hasLabels ? (labels === 'rhythm' ? 6.4 : 5.2) : 2.5) : S * (hasLabels ? (labels === 'rhythm' ? 9.4 : 6.8) : 4.6);
      const sysH = topPad + staffH + botPad;
      const H = Math.ceil(lines.length * sysH + S * 0.6);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      svg.style.height = H + 'px';

      const layers = {
        bg: el('g', { class: 'ly-bg' }, svg),
        staff: el('g', { class: 'ly-staff' }, svg),
        notes: el('g', { class: 'ly-notes' }, svg),
        labels: el('g', { class: 'ly-labels' }, svg),
        over: el('g', { class: 'ly-over' }, svg),
      };
      this.layers = layers;
      this.systems = [];
      this.noteGeo = {};

      lines.forEach((mIdxs, li) => {
        const sysTop = li * sysH;
        const topLineY = sysTop + topPad;
        const y = (pos) => rhythmLine ? topLineY : topLineY + (8 - pos) * S / 2;
        const bottomY = rhythmLine ? topLineY : y(0);
        const sys = { li, top: sysTop, bottom: sysTop + sysH, topLineY, y, measures: [], x0: marginL, x1: W - marginR };
        this.systems.push(sys);
        // خطوط المدرج (تُمدّ لاحقًا حتى آخر مازورة في السطر)
        const staffLines = [];
        if (rhythmLine) staffLines.push(el('line', { x1: marginL, x2: W - marginR, y1: topLineY, y2: topLineY, class: 'st-line' }, layers.staff));
        else for (let l = 0; l < 5; l++) staffLines.push(el('line', { x1: marginL, x2: W - marginR, y1: y(l * 2), y2: y(l * 2), class: 'st-line' }, layers.staff));
        // المفتاح
        let x = marginL + S * 0.4;
        if (rhythmLine) {
          el('rect', { x: x + S * 0.3, y: topLineY - S, width: S * 0.3, height: S * 2, class: 'gl' }, layers.staff);
          el('rect', { x: x + S * 0.9, y: topLineY - S, width: S * 0.3, height: S * 2, class: 'gl' }, layers.staff);
          x += clefW;
        } else {
          const kc = S / 165;
          el('path', { d: G.gclef.d, transform: `translate(${x - 100 * kc} ${y(2) + 160 * kc}) scale(${kc} ${-kc})`, class: 'gl clef' }, layers.staff);
          x += clefW;
          key.sig.forEach(a => {
            const p = T.posOf(a);
            this._acc(layers.staff, a.alter, x + S * 0.45, y(p), S);
            x += S * 1.05;
          });
          if (key.sig.length) x += S * 0.4;
        }
        if (li === 0) {
          const tx = x + S * 1.0;
          const ty1 = rhythmLine ? topLineY - S * 0.15 : y(6) + S * 0.72;
          const ty2 = rhythmLine ? topLineY + S * 1.75 : y(2) + S * 0.72;
          el('text', { x: tx, y: ty1, class: 'st-time', 'font-size': S * 2.15, 'text-anchor': 'middle' }, layers.staff).textContent = String(score.beats);
          el('text', { x: tx, y: ty2, class: 'st-time', 'font-size': S * 2.15, 'text-anchor': 'middle' }, layers.staff).textContent = String(score.beatType);
          x += timeW;
        }
        // تمديد الموازير لملء السطر (ما عدا السطر الأخير إن كان قصيرًا جدًا)
        const natural = mIdxs.reduce((a, i) => a + measW[i], 0);
        const avail = W - marginR - x;
        const isLastLine = li === lines.length - 1;
        let stretch = avail / natural;
        if (isLastLine && stretch > 1.6 && lines.length > 1) stretch = 1.25;
        if (stretch < 0.5) stretch = 0.5;

        mIdxs.forEach((mi, k) => {
          const m = lay.measures[mi];
          const mw = measW[mi] * stretch;
          const mx0 = x, mx1 = x + mw;
          const meas = { index: mi, x0: mx0, x1: mx1, notes: [] };
          sys.measures.push(meas);
          // خلفية المازورة (ناقصة / زائدة / المحددة)
          const bgTop = rhythmLine ? topLineY - S * 1.6 : y(8) - S * 0.6;
          const bgH = rhythmLine ? S * 3.2 : S * 5.2;
          if (m.incomplete || m.over) {
            el('rect', { x: mx0 + 2, y: bgTop, width: mw - 4, height: bgH, rx: S * 0.4, class: 'm-warn' }, layers.bg);
            el('text', { x: (mx0 + mx1) / 2, y: (rhythmLine ? topLineY - S * 4.6 : y(8) - S * 2.5), class: 'm-warn-text', 'font-size': S * 0.78, 'text-anchor': 'middle' }, layers.bg)
              .textContent = m.over ? 'زمن المازورة زائد' : 'ناقصة ' + T.beatsText(T.q(lay.cap - m.used));
          }
          if (o.measureStatus && o.measureStatus[mi]) {
            el('rect', { x: mx0 + 2, y: bgTop, width: mw - 4, height: bgH, rx: S * 0.4, class: 'm-' + o.measureStatus[mi] }, layers.bg);
          }
          // رقم المازورة
          if (o.measureNumbers || k === 0) {
            el('text', { x: mx0 + S * 0.2, y: (rhythmLine ? topLineY - S * 3.9 : y(8) - S * 1.35), class: 'm-num', 'font-size': S * 0.85 }, layers.staff).textContent = String(mi + 1);
          }
          const mk = score.marks && score.marks[mi];
          if (mk && mk.text) {
            const atStart = mk.text === '𝄋' || mk.text === '𝄌';
            el('text', { x: atStart ? mx0 + S * 1.6 : mx1 - S * 0.5, y: (rhythmLine ? topLineY - S * 3.9 : y(8) - S * 2.7), class: 'm-text', 'font-size': S * (atStart ? 1.7 : 1.0), 'text-anchor': atStart ? 'start' : 'end' }, layers.staff).textContent = mk.text;
          }

          // العلامات
          let nx = mx0 + S * 1.4 * stretch;
          m.items.forEach(it => {
            const w = it._w * stretch;
            const cx = nx + (it._acc ? accW : 0) + S * 0.7;
            const pos = rhythmLine ? 4 : (it.note.kind === 'note' && it.note.pitch ? T.posOf(it.note.pitch) : 4);
            meas.notes.push({ idx: it.idx, x: cx });
            this.noteGeo[it.idx] = { x: cx, y: y(pos), pos, sys, measure: mi, start: it.start, dur: it.dur };
            nx += w;
          });
          // السكتة التي تملأ المازورة كلها توضع في منتصفها
          if (m.items.length === 1 && m.items[0].note.kind === 'rest' && m.full) {
            const cxm = (mx0 + mx1) / 2;
            meas.notes[0].x = cxm; this.noteGeo[m.items[0].idx].x = cxm;
          }
          meas.freeX = nx + S * 0.7; // موضع العلامة التالية إن أُضيفت
          meas.contentEnd = nx;
          // خطوط الموازير
          const barTop = rhythmLine ? topLineY - S : y(8);
          const barBot = rhythmLine ? topLineY + S : y(0);
          const isFinal = mi === lay.measures.length - 1;
          if (mk && mk.repeatStart) this._repeatBar(layers.staff, mx0 + (k === 0 ? 0 : 0), barTop, barBot, S, 'start', y, rhythmLine);
          if (mk && mk.repeatEnd) this._repeatBar(layers.staff, mx1, barTop, barBot, S, 'end', y, rhythmLine);
          else if (isFinal) {
            el('line', { x1: mx1 - S * 0.55, x2: mx1 - S * 0.55, y1: barTop, y2: barBot, class: 'st-bar' }, layers.staff);
            el('rect', { x: mx1 - S * 0.3, y: barTop, width: S * 0.32, height: barBot - barTop, class: 'gl' }, layers.staff);
          } else el('line', { x1: mx1, x2: mx1, y1: barTop, y2: barBot, class: 'st-bar' }, layers.staff);
          x = mx1;
        });
        // ينتهي خط المدرج عند آخر مازورة في السطر
        sys.x1 = x;
        staffLines.forEach(l => l.setAttribute('x2', x));
      });

      // ---- مجموعات التريوليه (كل 3 علامات متتالية مُعلَّمة tuplet، تملأ زمن علامتين من نوعها) ----
      this.tupletIndex = {}; this.tupletGroups = [];
      lay.measures.forEach(m => {
        let run = [];
        const flush = () => { run = []; };
        m.items.forEach(it => {
          const r = it.note.rhythm;
          if (r.tuplet !== 3) { flush(); return; }
          if (run.length && run[0].note.rhythm.base !== r.base) flush();
          run.push(it);
          this.tupletIndex[it.idx] = run.length - 1;
          if (run.length === 3) { this.tupletGroups.push(run.slice()); flush(); }
        });
      });

      // ---- رسم العلامات ----
      lay.measures.forEach(m => {
        const groups = this._beamGroups(m);
        const inGroup = {};
        groups.forEach((g, gi) => g.forEach(it => { inGroup[it.idx] = gi; }));
        // اتجاه الساق
        const dirOf = {};
        groups.forEach(g => {
          const avg = g.reduce((a, it) => a + this.noteGeo[it.idx].pos, 0) / g.length;
          g.forEach(it => { dirOf[it.idx] = (avg < 4 || rhythmLine) ? 'up' : 'down'; });
        });
        m.items.forEach(it => {
          const geo = this.noteGeo[it.idx];
          if (!geo) return;
          if (dirOf[it.idx] === undefined) dirOf[it.idx] = geo.pos < 4 || rhythmLine ? 'up' : 'down';
          this._drawItem(it, geo, alters[it.idx], dirOf[it.idx], inGroup[it.idx] !== undefined, rhythmLine);
        });
        groups.forEach(g => this._drawBeam(g, dirOf[g[0].idx]));
      });
      // الأربطة الزمنية
      score.notes.forEach((n, i) => { if (n.tie && score.notes[i + 1]) this._drawTie(i, i + 1, rhythmLine); });
      // رقم التريوليه «3» فوق كل مجموعة (مع قوس إن لم تكن موصولة بعارضة واحدة)
      this.tupletGroups.forEach(g => this._drawTuplet(g));
      // رموز الأبعاد بين الدرجات المتجاورة: ⌒ بُعد كامل (أعلى) و ∨ نصف بُعد (أسفل) — كما في دليل الصف الثامن
      if (o.steps && !rhythmLine) this._drawSteps(lay, alters);

      // ---- التسميات تحت العلامات ----
      if (hasLabels) this._drawLabels(lay, alters, labels, rhythmLine);

      // ---- الحالة ----
      this._applyClasses();
      this._drawOverlay();
      return this;
    }

    _acc(parent, alter, x, y, S, cls) {
      if (alter === 1) { const k = 2.9 * S / 954; return glyph(parent, 'sharp', x, y, k, 207, 198, cls); }
      if (alter === -1) { const k = 2.5 * S / 836; return glyph(parent, 'flat', x, y, k, 190, 180, cls); }
      if (alter === 0) { const k = 2.85 * S / 965; return glyph(parent, 'natural', x, y, k, 190, 192, cls); }
    }

    _repeatBar(p, x, top, bot, S, kind, y, rl) {
      const thick = S * 0.32;
      const d1 = rl ? [top + S * 0.55, bot - S * 0.55] : [y(5), y(3)];
      if (kind === 'start') {
        el('rect', { x: x, y: top, width: thick, height: bot - top, class: 'gl' }, p);
        el('line', { x1: x + S * 0.6, x2: x + S * 0.6, y1: top, y2: bot, class: 'st-bar' }, p);
        d1.forEach(dy => el('circle', { cx: x + S * 1.05, cy: dy, r: S * 0.2, class: 'gl' }, p));
      } else {
        el('rect', { x: x - thick, y: top, width: thick, height: bot - top, class: 'gl' }, p);
        el('line', { x1: x - S * 0.6, x2: x - S * 0.6, y1: top, y2: bot, class: 'st-bar' }, p);
        d1.forEach(dy => el('circle', { cx: x - S * 1.05, cy: dy, r: S * 0.2, class: 'gl' }, p));
      }
    }

    // تجميع الكروش والدوبل كروش داخل الوحدة الزمنية الواحدة
    _beamGroups(m) {
      const groups = []; let cur = []; let beat = -1;
      const flush = () => { if (cur.length > 1) groups.push(cur); cur = []; };
      m.items.forEach(it => {
        const n = it.note;
        const b = Math.floor(it.start + 1e-6);
        const beamable = n.kind === 'note' && n.rhythm.base <= 0.5 && (it.start + it.dur) <= b + 1 + 1e-6;
        if (!beamable) { flush(); beat = -1; return; }
        if (cur.length && b === beat) cur.push(it);
        else { flush(); cur = [it]; beat = b; }
      });
      flush();
      return groups;
    }

    _drawItem(it, geo, alter, dir, beamed, rl) {
      const S = this.S, n = it.note, L = this.layers.notes;
      const g = el('g', { class: 'nt', 'data-idx': it.idx }, L);
      geo.g = g; geo.dir = dir;
      const cx = geo.x, cy = geo.y, sys = geo.sys;
      if (n.kind === 'rest') {
        const ry = rl ? sys.topLineY : sys.y(4);
        const yy = (p) => rl ? sys.topLineY + (4 - p) * S / 2 : sys.y(p);
        const b = n.rhythm.base;
        if (b === 4) { const k = 0.5 * S / 107; glyph(g, 'restWhole', cx, yy(6), k, 191, 572); }
        else if (b === 2) { const k = 0.5 * S / 107; glyph(g, 'restHalf', cx, yy(4), k, 191, 358); }
        else if (b === 1) { const k = 3 * S / 596; glyph(g, 'restQuarter', cx, ry, k, 160, 360); }
        else if (b === 0.5) { const k = 2 * S / 366; glyph(g, 'rest8', cx, ry, k, 126, 349); }
        else { const k = 3 * S / 554; glyph(g, 'rest16', cx, yy(3), k, 150, 254); }
        if (n.rhythm.dots) el('circle', { cx: cx + S * 1.0, cy: yy(5), r: S * 0.18, class: 'gl' }, g);
        geo.top = yy(8); geo.bot = yy(0);
        el('rect', { x: cx - S, y: yy(8) - S * 0.4, width: S * 2, height: S * 4.8, class: 'hit' }, g);
        return;
      }
      const pos = geo.pos;
      const unpitched = !n.pitch && !rl;
      // الخطوط الإضافية
      if (!rl && n.pitch) {
        for (let p = -2; p >= pos; p -= 2) el('line', { x1: cx - S * 1.0, x2: cx + S * 1.0, y1: sys.y(p), y2: sys.y(p), class: 'st-ledger' }, g);
        for (let p = 10; p <= pos; p += 2) el('line', { x1: cx - S * 1.0, x2: cx + S * 1.0, y1: sys.y(p), y2: sys.y(p), class: 'st-ledger' }, g);
      }
      // علامة التحويل
      if (it._acc && !rl) this._acc(g, n.pitch.alter, cx - S * 1.55, cy, S);
      // الرأس
      const b = n.rhythm.base;
      if (b === 4) el('path', { d: ellipsePath(cx, cy, S * 0.78, S * 0.5, 0) + ellipsePath(cx, cy, S * 0.36, S * 0.33, 62), 'fill-rule': 'evenodd', class: 'head' + (unpitched ? ' unp' : '') }, g);
      else if (b === 2) el('path', { d: ellipsePath(cx, cy, S * 0.62, S * 0.44, -22) + ellipsePath(cx, cy, S * 0.5, S * 0.2, -32), 'fill-rule': 'evenodd', class: 'head' + (unpitched ? ' unp' : '') }, g);
      else el('path', { d: ellipsePath(cx, cy, S * 0.62, S * 0.44, -22), class: 'head' + (unpitched ? ' unp' : '') }, g);
      if (unpitched) el('text', { x: cx, y: cy - S * 1.0, 'font-size': S * 1.1, 'text-anchor': 'middle', class: 'unp-q' }, g).textContent = '؟';
      // النقطة
      if (n.rhythm.dots) {
        const dy = (!rl && pos % 2 === 0) ? cy - S / 2 : cy;
        el('circle', { cx: cx + S * 1.05, cy: dy, r: S * 0.18, class: 'gl' }, g);
      }
      // الساق والراية
      if (b < 4) {
        const up = dir === 'up';
        const sx = up ? cx + S * 0.56 : cx - S * 0.56;
        let len = S * 3.4;
        if (!rl) {
          const mid = sys.y(4);
          if (up && cy - len > mid && pos <= -3) len = cy - mid;
          if (!up && cy + len < mid && pos >= 11) len = mid - cy;
        }
        const ey = up ? cy - len : cy + len;
        geo.stem = { x: sx, y0: cy + (up ? -S * 0.15 : S * 0.15), y1: ey, up };
        geo.stemEl = el('line', { x1: sx, x2: sx, y1: geo.stem.y0, y2: ey, class: 'stem' }, g);
        if (!beamed && b <= 0.5) {
          const k = 2.9 * S / 590;
          const nm = b === 0.5 ? 'flag8' : 'flag16';
          if (up) glyph(g, nm, sx - S * 0.06, ey, k, 0, 767, 'gl');
          else glyph(g, nm, sx - S * 0.06, ey, k, 0, 767, 'gl', true);
        }
      }
      geo.top = Math.min(cy - S, geo.stem ? Math.min(geo.stem.y1, cy) : cy);
      geo.bot = Math.max(cy + S, geo.stem ? Math.max(geo.stem.y1, cy) : cy);
      el('rect', { x: cx - S * 1.05, y: geo.top - S * 0.3, width: S * 2.1, height: geo.bot - geo.top + S * 0.6, class: 'hit' }, g);
    }

    _drawBeam(group, dir) {
      const S = this.S, L = this.layers.notes;
      const up = dir === 'up';
      const pts = group.map(it => this.noteGeo[it.idx]);
      // إعادة توجيه السيقان داخل المجموعة
      pts.forEach(p => {
        p.dir = dir;
        const sx = up ? p.x + S * 0.56 : p.x - S * 0.56;
        p.stem = { x: sx, y0: p.y + (up ? -S * 0.15 : S * 0.15), up };
      });
      const x0 = pts[0].stem.x, x1 = pts[pts.length - 1].stem.x;
      let slope = (pts.length > 1 && x1 !== x0) ? (pts[pts.length - 1].y - pts[0].y) / (x1 - x0) : 0;
      slope = Math.max(-0.22, Math.min(0.22, slope)) * 0.6;
      const minLen = S * 3.0;
      let c;
      if (up) c = Math.min(...pts.map(p => p.y - minLen - slope * (p.stem.x - x0)));
      else c = Math.max(...pts.map(p => p.y + minLen - slope * (p.stem.x - x0)));
      const by = (x) => c + slope * (x - x0);
      const th = S * 0.5;
      pts.forEach(p => {
        const ey = by(p.stem.x);
        p.stem.y1 = ey;
        if (p.stemEl) p.stemEl.remove();
        p.stemEl = el('line', { x1: p.stem.x, x2: p.stem.x, y1: p.stem.y0, y2: ey, class: 'stem' }, p.g);
        p.top = Math.min(p.top, ey, p.y - S); p.bot = Math.max(p.bot, ey, p.y + S);
        const hit = p.g.querySelector('rect.hit');
        if (hit) { hit.setAttribute('y', p.top - S * 0.3); hit.setAttribute('height', p.bot - p.top + S * 0.6); }
      });
      const bg = el('g', { class: 'beam', 'data-idxs': group.map(it => it.idx).join(',') }, L);
      const poly = (xa, xb, off) => {
        const ya = by(xa) + off, yb = by(xb) + off;
        const t = up ? th : -th;
        return `M${xa} ${ya} L${xb} ${yb} L${xb} ${yb + t} L${xa} ${ya + t} Z`;
      };
      el('path', { d: poly(x0 - S * 0.04, x1 + S * 0.04, 0), class: 'gl' }, bg);
      // العارضة الثانية للدوبل كروش
      const off = up ? S * 0.78 : -S * 0.78;
      const is16 = (it) => it.note.rhythm.base <= 0.25;
      for (let i = 0; i < group.length; i++) {
        if (!is16(group[i])) continue;
        const xa = pts[i].stem.x;
        if (i + 1 < group.length && is16(group[i + 1])) {
          el('path', { d: poly(xa - S * 0.04, pts[i + 1].stem.x + S * 0.04, off), class: 'gl' }, bg);
        } else if (!(i > 0 && is16(group[i - 1]))) {
          // عارضة قصيرة: نحو العلامة السابقة إن وُجدت، وإلا نحو التالية
          const toLeft = i > 0;
          const xb = toLeft ? xa - S * 1.1 : xa + S * 1.1;
          el('path', { d: poly(Math.min(xa, xb), Math.max(xa, xb), off), class: 'gl' }, bg);
        }
      }
      group.forEach(it => { this.noteGeo[it.idx].beamEl = bg; });
    }

    _drawTie(i, j, rl) {
      const a = this.noteGeo[i], b = this.noteGeo[j], S = this.S;
      if (!a || !b) return;
      const below = (a.dir || 'up') === 'up';
      const sgn = below ? 1 : -1;
      const yA = a.y + sgn * S * 0.6;
      const mk = (x1, x2, yy) => {
        const mid = (x1 + x2) / 2, h = Math.min(S * 1.2, Math.max(S * 0.5, (x2 - x1) * 0.18));
        return `M${x1} ${yy} Q${mid} ${yy + sgn * h} ${x2} ${yy} Q${mid} ${yy + sgn * (h - S * 0.22)} ${x1} ${yy} Z`;
      };
      if (a.sys === b.sys) {
        el('path', { d: mk(a.x + S * 0.5, b.x - S * 0.5, yA), class: 'gl tie', 'data-idx': i }, this.layers.notes);
      } else {
        el('path', { d: mk(a.x + S * 0.5, a.sys.x1 - S * 0.2, yA), class: 'gl tie' }, this.layers.notes);
        el('path', { d: mk(b.x - S * 2.2, b.x - S * 0.5, b.y + sgn * S * 0.6), class: 'gl tie' }, this.layers.notes);
      }
    }

    _drawTuplet(g) {
      const S = this.S, L = this.layers.notes;
      const a = this.noteGeo[g[0].idx], c = this.noteGeo[g[2].idx];
      if (!a || !c || !a.g) return;
      const up = (a.dir || 'up') === 'up';
      const xs = [a.x, c.x];
      // نضع الرقم في جهة الساق (فوق العارضة) حتى لا يتداخل مع الرؤوس
      const tops = g.map(it => this.noteGeo[it.idx]).map(p => up ? Math.min(p.top, p.stem ? p.stem.y1 : p.top) : Math.max(p.bot, p.stem ? p.stem.y1 : p.bot));
      const y = up ? Math.min(...tops) - S * 0.55 : Math.max(...tops) + S * 1.25;
      const cx = (xs[0] + xs[1]) / 2;
      const beamed = g.every(it => this.noteGeo[it.idx].beamEl && this.noteGeo[it.idx].beamEl === a.beamEl);
      const grp = el('g', { class: 'tuplet' }, L);
      // القوس دائمًا (كما في مدوّنة الدليل)، لكنه قصير الجناحين إن كانت العلامات موصولة بعارضة
      const x0 = xs[0] - S * 0.5, x1 = xs[1] + S * 0.9, hook = up ? S * 0.35 : -S * 0.35;
      const by = up ? y - S * 0.35 : y - S * 0.7;
      el('path', { d: `M${x0} ${by + hook} V${by} H${cx - S * 0.55} M${cx + S * 0.55} ${by} H${x1} V${by + hook}`, class: 'tup-br' + (beamed ? ' thin' : '') }, grp);
      el('text', { x: cx, y: by + S * 0.38, 'text-anchor': 'middle', 'font-size': S * 1.0, class: 'tup-num' }, grp).textContent = '3';
    }

    _drawSteps(lay, alters) {
      const S = this.S, L = this.layers.labels; // (طبقة over تُفرَّغ عند رسم المؤشر)
      const seq = [];
      lay.measures.forEach(m => m.items.forEach(it => { if (it.note.kind === 'note' && it.note.pitch) seq.push(it); }));
      for (let i = 0; i + 1 < seq.length; i++) {
        const A = seq[i].note.pitch, B = seq[i + 1].note.pitch;
        const ga = this.noteGeo[seq[i].idx], gb = this.noteGeo[seq[i + 1].idx];
        if (!ga || !gb || ga.sys !== gb.sys) continue;
        if (this.opts.steps === 'measure' && ga.measure !== gb.measure) continue; // أمثلة منفصلة داخل كل مازورة
        const dia = Math.abs(T.diatonic(B.step, B.octave) - T.diatonic(A.step, A.octave));
        if (dia > 1) continue;  // الأبعاد هنا بين الدرجات المتجاورة فقط
        const semis = Math.abs(T.midiOf(B.step, B.octave, alters[seq[i + 1].idx]) - T.midiOf(A.step, A.octave, alters[seq[i].idx]));
        const x0 = ga.x + S * 0.75, x1 = gb.x - S * 0.75, mx = (x0 + x1) / 2;
        if (semis === 2) {
          const yTop = Math.min(ga.y, gb.y) - S * 1.0;
          el('path', { d: `M${x0} ${ga.y - S * 0.6} Q${mx} ${yTop - S * 1.6} ${x1} ${gb.y - S * 0.6}`, class: 'step-whole' }, L);
        } else if (semis === 1) {
          const yb = Math.max(ga.y, gb.y) + S * 1.1;
          el('path', { d: `M${mx - S * 0.75} ${yb} L${mx} ${yb + S * 1.1} L${mx + S * 0.75} ${yb}`, class: 'step-half' }, L);
        }
      }
    }

    _drawLabels(lay, alters, mode, rl) {
      const S = this.S, L = this.layers.labels, o = this.opts;
      const lastRight = new Map(); // آخر طرف أيمن لاسم شكل في كل سطر (لمنع التداخل)
      lay.measures.forEach(m => {
        m.items.forEach(it => {
          const geo = this.noteGeo[it.idx];
          if (!geo) return;
          const baseY = rl ? geo.sys.topLineY + S * 3.6 : geo.sys.y(0) + S * 4.6;
          const n = it.note;
          let txt = '', cls = 'lbl';
          if (mode === 'solfege') {
            if (n.kind === 'rest') { txt = 'سكتة'; cls += ' lbl-rest'; }
            else if (!n.pitch) { txt = '؟'; cls += ' lbl-unp'; }
            else txt = T.shortName(n.pitch.step, alters[it.idx]);
          } else {
            const prev = it.idx > 0 ? this.score.notes[it.idx - 1] : null;
            txt = T.syllableFor(it.start, it.dur, n.kind === 'rest', !!(prev && prev.tie && n.kind === 'note'), this.tupletIndex[it.idx]);
            if (n.kind === 'rest') cls += ' lbl-rest';
          }
          const hidden = o.hideLabels && (o.hideLabels === true || o.hideLabels.has(it.idx));
          const t = el('text', { x: geo.x, y: baseY, 'font-size': S * (mode === 'rhythm' ? 0.95 : 1.05), 'text-anchor': 'middle', class: cls + (hidden ? ' lbl-hidden' : ''), 'data-idx': it.idx }, L);
          t.textContent = hidden ? '؟' : txt;
          geo.label = t;
        });
        // أسماء الأشكال الإيقاعية
        if (mode === 'rhythm') {
          const byBeat = {};
          m.items.forEach(it => {
            const b = Math.floor(it.start + 1e-6);
            (byBeat[b] = byBeat[b] || []).push(it);
          });
          Object.keys(byBeat).forEach(bk => {
            const items = byBeat[bk];
            const b = +bk;
            const first = items[0], last = items[items.length - 1];
            const span = T.q(last.start + last.dur - first.start);
            let name = null;
            const hasTup = items.some(it => it.note.rhythm.tuplet === 3);
            if (hasTup && Math.abs(first.start - b) < 1e-6 && Math.abs(span - 1) < 1e-6) {
              // وصف الوحدة: علامات عادية بأسمائها + «تريوليه» لكل مجموعة ثلاثية
              const segs = []; let inTup = 0;
              items.forEach(it => {
                if (it.note.rhythm.tuplet === 3) { if (this.tupletIndex[it.idx] === 0) { segs.push('تريوليه'); } }
                else segs.push(T.valueName(it.note.kind, it.note.rhythm));
              });
              name = segs.join(' + ');
              void inTup;
            } else if (items.length > 1 && items.every(it => it.note.kind === 'note') && Math.abs(first.start - b) < 1e-6 && Math.abs(span - 1) < 1e-6) {
              name = T.shapeNameForBeat(items.map(it => T.q(it.start - b)));
            } else if (items.length === 1 && Math.abs(first.start - b) < 1e-6) {
              name = T.valueName(first.note.kind, first.note.rhythm);
            }
            if (!name) return;
            const ga = this.noteGeo[first.idx], gb = this.noteGeo[last.idx];
            const fs = S * 0.78;
            const cx = (ga.x + gb.x) / 2;
            const halfW = name.length * fs * 0.27 + S * 0.2;
            const prev = lastRight.get(ga.sys) || { x: -1e9, row: 1 };
            const row = (cx - halfW < prev.x && prev.row === 0) ? 1 : 0;
            lastRight.set(ga.sys, { x: cx + halfW, row });
            const yy = (rl ? ga.sys.topLineY + S * 5.2 : ga.sys.y(0) + S * 6.3) + row * S * 1.05;
            if (items.length > 1) {
              el('path', { d: `M${ga.x - S * 0.5} ${yy - S * 1.15} v${S * 0.35} H${gb.x + S * 0.5} v${-S * 0.35}`, class: 'shape-br' }, L);
            }
            if (row && items.length === 1) el('line', { x1: cx, x2: cx, y1: yy - S * 1.9, y2: yy - S * 0.85, class: 'shape-br' }, L);
            el('text', { x: cx, y: yy, 'font-size': fs, 'text-anchor': 'middle', class: 'lbl-shape' }, L).textContent = name;
          });
        }
      });
    }

    // ---------------------------------------------------------- الحالات المرئية
    _applyClasses() {
      const o = this.opts;
      Object.keys(this.noteGeo).forEach(k => {
        const geo = this.noteGeo[k]; const idx = +k;
        if (!geo.g) return;
        const c = geo.g.classList;
        c.toggle('sel', o.selected === idx);
        if (o.statuses && o.statuses[idx]) c.add('st-' + o.statuses[idx]);
        if (o.quizIdx === idx) c.add('quiz');
        if (o.dim && o.dim.has && o.dim.has(idx)) c.add('dim');
      });
    }

    _drawOverlay() {
      const L = this.layers.over;
      L.textContent = '';
      this.caretEl = el('g', { class: 'caret' }, L);
      this.ghostEl = el('g', { class: 'ghost' }, L);
      this.playEl = el('rect', { class: 'playhead', x: 0, y: 0, width: 0, height: 0, rx: 6, style: 'display:none' }, this.layers.bg);
      this.remainEl = el('text', { class: 'remain', 'text-anchor': 'middle' }, L);
      this.updateCaret();
    }

    // المؤشر الأزرق يبيّن أين ستُكتب العلامة التالية
    caretInfo(insertIndex) {
      const S = this.S, lay = this.lay, sc = this.score;
      if (!lay || !this.systems.length) return null;
      if (insertIndex === undefined || insertIndex >= sc.notes.length) {
        // بعد آخر علامة
        let mi = lay.lastFilled;
        let m = lay.measures[mi];
        if (!m || m.full) mi = mi + 1;
        const sysm = this._findMeasure(mi);
        if (!sysm) {
          const s = this.systems[this.systems.length - 1];
          const lm = s.measures[s.measures.length - 1];
          return { x: lm.x1 - S * 0.4, sys: s, measure: lm.index, append: true, overflow: true };
        }
        return { x: sysm.meas.freeX !== undefined && lay.measures[mi].items.length ? sysm.meas.freeX : sysm.meas.x0 + S * 2.1, sys: sysm.sys, measure: mi, append: true };
      }
      const geo = this.noteGeo[insertIndex];
      return geo ? { x: geo.x - S * 1.25, sys: geo.sys, measure: geo.measure, append: false } : null;
    }

    _findMeasure(mi) {
      for (const s of this.systems) for (const m of s.measures) if (m.index === mi) return { sys: s, meas: m };
      return null;
    }

    updateCaret() {
      const o = this.opts, S = this.S;
      if (!this.caretEl) return;
      this.caretEl.textContent = '';
      this.remainEl.textContent = '';
      if (!o.editable || o.selected !== undefined && o.selected !== null) return;
      const ci = this.caretInfo(this.score.notes.length);
      if (!ci || ci.overflow) return;
      const s = ci.sys;
      const top = o.rhythmLine ? s.topLineY - S * 1.3 : s.y(8) - S * 0.5;
      const bot = o.rhythmLine ? s.topLineY + S * 1.3 : s.y(0) + S * 0.5;
      el('line', { x1: ci.x, x2: ci.x, y1: top, y2: bot, class: 'caret-line' }, this.caretEl);
      el('path', { d: `M${ci.x - S * 0.45} ${top - S * 0.55} L${ci.x + S * 0.45} ${top - S * 0.55} L${ci.x} ${top} Z`, class: 'caret-tri' }, this.caretEl);
      const m = this.lay.measures[ci.measure];
      if (m) {
        const remain = T.q(this.lay.cap - m.used);
        this.remainEl.setAttribute('x', ci.x);
        this.remainEl.setAttribute('y', top - S * 0.85);
        this.remainEl.setAttribute('font-size', S * 0.72);
        this.remainEl.textContent = 'المتبقي: ' + T.beatsText(remain);
      }
    }

    // ---------------------------------------------------------- تحديد موضع النقر
    toSvg(clientX, clientY) {
      const pt = this.svg.createSVGPoint();
      pt.x = clientX; pt.y = clientY;
      const m = this.svg.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const r = pt.matrixTransform(m.inverse());
      return { x: r.x, y: r.y };
    }

    hitTest(clientX, clientY) {
      if (!this.systems || !this.systems.length) return null;
      const p = this.toSvg(clientX, clientY);
      const S = this.S, o = this.opts;
      let sys = this.systems.find(s => p.y >= s.top && p.y < s.bottom);
      if (!sys) sys = p.y < this.systems[0].top ? this.systems[0] : this.systems[this.systems.length - 1];
      let pos = o.rhythmLine ? 4 : Math.round(8 - (p.y - sys.topLineY) / (S / 2));
      pos = Math.max(T.MIN_POS, Math.min(T.MAX_POS, pos));
      // علامة تحت المؤشر؟
      let noteIdx = null, best = S * 1.0;
      sys.measures.forEach(m => m.notes.forEach(n => {
        const d = Math.abs(n.x - p.x);
        if (d <= best) { best = d; noteIdx = n.idx; }
      }));
      // المازورة
      let meas = sys.measures.find(m => p.x >= m.x0 && p.x < m.x1);
      if (!meas) meas = p.x < sys.measures[0].x0 ? sys.measures[0] : sys.measures[sys.measures.length - 1];
      // موضع الإدراج
      const lay = this.lay, sc = this.score;
      let insertIndex = sc.notes.length;
      const mi = meas.index;
      if (mi <= lay.lastFilled && lay.measures[mi].items.length) {
        const after = meas.notes.find(n => n.x > p.x);
        if (after) insertIndex = after.idx;
        else {
          const lastIdx = meas.notes[meas.notes.length - 1].idx;
          insertIndex = lastIdx + 1;
        }
      }
      const inStaff = o.rhythmLine ? Math.abs(p.y - sys.topLineY) < S * 3 : (p.y > sys.y(T.MAX_POS) - S && p.y < sys.y(T.MIN_POS) + S);
      return { x: p.x, y: p.y, sys, pos, pitch: T.pitchAtPos(pos), noteIdx, measure: mi, insertIndex, inStaff };
    }

    // الشبح: معاينة النغمة قبل كتابتها
    showGhost(info, tool, label) {
      const S = this.S, G0 = this.ghostEl, o = this.opts;
      if (!G0) return;
      G0.textContent = '';
      if (!info) return;
      const sys = info.sys;
      let x;
      if (info.replaceIdx !== undefined && info.replaceIdx !== null) x = this.noteGeo[info.replaceIdx].x;
      else {
        const ci = this.caretInfo(info.insertIndex);
        if (!ci || ci.overflow) return;
        x = ci.x + (ci.append ? 0 : 0);
        if (ci.sys !== sys) return;
      }
      const rl = o.rhythmLine;
      const y = rl ? sys.topLineY : sys.y(info.pos);
      if (tool.kind === 'rest' || rl) {
        if (tool.kind === 'rest') {
          el('rect', { x: x - S * 0.5, y: (rl ? sys.topLineY : sys.y(4)) - S * 1.5, width: S, height: S * 3, rx: 3, class: 'ghost-head' }, G0);
        } else el('path', { d: ellipsePath(x, y, S * 0.62, S * 0.44, -22), class: 'ghost-head' }, G0);
      } else {
        for (let p = -2; p >= info.pos; p -= 2) el('line', { x1: x - S, x2: x + S, y1: sys.y(p), y2: sys.y(p), class: 'ghost-ledger' }, G0);
        for (let p = 10; p <= info.pos; p += 2) el('line', { x1: x - S, x2: x + S, y1: sys.y(p), y2: sys.y(p), class: 'ghost-ledger' }, G0);
        el('path', { d: ellipsePath(x, y, S * 0.62, S * 0.44, -22), class: 'ghost-head' }, G0);
        // خط أفقي خفيف يوضح الخط/المسافة
        el('line', { x1: x - S * 2.2, x2: x + S * 2.2, y1: y, y2: y, class: 'ghost-guide' }, G0);
      }
      if (label) {
        const ty = rl ? sys.topLineY - S * 2.2 : Math.min(y - S * 1.6, sys.y(8) - S * 2.0);
        const tw = Math.max(S * 3, label.length * S * 0.55);
        el('rect', { x: x - tw / 2, y: ty - S * 1.0, width: tw, height: S * 1.4, rx: S * 0.5, class: 'ghost-tip-bg' }, G0);
        el('text', { x: x, y: ty, 'text-anchor': 'middle', 'font-size': S * 0.85, class: 'ghost-tip' }, G0).textContent = label;
      }
    }

    // تمييز العلامة الجاري تشغيلها
    setPlaying(idx) {
      const S = this.S;
      this.svg.querySelectorAll('.nt.playing').forEach(g => g.classList.remove('playing'));
      this.svg.querySelectorAll('.lbl.playing').forEach(g => g.classList.remove('playing'));
      if (idx === null || idx === undefined || !this.noteGeo[idx]) { if (this.playEl) this.playEl.style.display = 'none'; return null; }
      const geo = this.noteGeo[idx];
      this.playEl.style.display = '';
      geo.g && geo.g.classList.add('playing');
      geo.label && geo.label.classList.add('playing');
      const s = geo.sys;
      const top = this.opts.rhythmLine ? s.topLineY - S * 2.2 : s.y(8) - S * 2.2;
      const bot = s.bottom - S * 0.4;
      this.playEl.setAttribute('x', geo.x - S * 1.3);
      this.playEl.setAttribute('width', S * 2.6);
      this.playEl.setAttribute('y', top);
      this.playEl.setAttribute('height', bot - top);
      return geo;
    }

    noteRect(idx) {
      const geo = this.noteGeo[idx];
      if (!geo || !geo.g) return null;
      return geo.g.getBoundingClientRect();
    }
  }

  MT.Renderer = Renderer;
})(window.MT = window.MT || {});
