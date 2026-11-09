'use client';
// قارئ «الكتاب التفاعلي الذكي»: كتاب مفتوح بتقليب ثلاثي الأبعاد، تكبير، أدوات شرح، مؤشر ليزر، ووضع عرض للطلاب.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './icons.js';
import PageCanvas from './PageCanvas.js';
import AnnotLayer from './AnnotLayer.js';
import LaserLayer from './LaserLayer.js';
import { ThumbsPanel, SearchPanel, BookmarksPanel, NotesPanel } from './Panels.js';
import { openPdf, closePdf } from '../core/pdf.js';
import { PageRenderer } from '../core/renderer.js';
import { viewPages, viewOf, firstView, lastView, slotsOf, sideOf, flipPlan } from '../core/layout.js';
import { COLORS, WIDTHS, History } from '../core/annotations.js';

const FLIP_MS = 560;
const ease = (t) => 1 - Math.pow(1 - t, 3);
const ZOOMS = [1, 1.25, 1.5, 2, 2.5, 3, 4];
const DRAW_TOOLS = [
  ['pen', 'pen', 'قلم'], ['highlight', 'highlight', 'قلم تحديد'], ['arrow', 'arrow', 'سهم'],
  ['rect', 'rect', 'مستطيل'], ['ellipse', 'ellipse', 'دائرة'], ['eraser', 'eraser', 'ممحاة'],
];

function Btn({ icon, tip, onClick, active, disabled, className = '', children, size = 20, ...rest }) {
  return (
    <button type="button" className={`ib-tb ${active ? 'is-on' : ''} ${className}`} data-tip={tip} aria-label={tip}
      aria-pressed={active === undefined ? undefined : !!active} onClick={onClick} disabled={disabled} {...rest}>
      {icon ? <Icon name={icon} size={size} /> : null}{children}
    </button>
  );
}

export default function BookReader({ lib, bookId, onClose }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const bookRef = useRef(null);

  const [book, setBook] = useState(null);
  const [doc, setDoc] = useState(null);
  const [renderer, setRenderer] = useState(null);
  const [error, setError] = useState('');
  const [texts, setTexts] = useState([]);
  const [st, setSt] = useState({ lastPage: 1, bookmarks: [], notes: {}, dir: null });
  const [anns, setAnns] = useState({ pages: {} });
  const history = useRef(new History());
  const [, bump] = useState(0);

  const [box, setBox] = useState({ W: 800, H: 600 });
  const [userMode, setUserMode] = useState('auto'); // auto | single | double
  const [fit, setFit] = useState('page'); // page | width
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState(null);
  const [flip, setFlip] = useState(null); // { to, plan, p }
  const [panel, setPanel] = useState(null); // thumbs | search | marks | notes
  const [tool, setTool] = useState('none'); // none | laser | pen | ...
  const [annotOpen, setAnnotOpen] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [showAnns, setShowAnns] = useState(true);
  const [presenting, setPresenting] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [idle, setIdle] = useState(false);
  const [pageInput, setPageInput] = useState('');

  // ===== تحميل الكتاب =====
  useEffect(() => {
    let alive = true; let d = null; let r = null;
    (async () => {
      try {
        const b = await lib.getBook(bookId);
        if (!b) throw new Error('الكتاب غير موجود في مكتبتك.');
        const file = await lib.getFile(bookId);
        if (!file) throw new Error('ملف الكتاب غير موجود على هذا الجهاز.');
        const [s, a] = await Promise.all([lib.getState(bookId), lib.getAnns(bookId)]);
        d = await openPdf(new Uint8Array(await file.arrayBuffer()));
        if (!alive) { closePdf(d); return; }
        r = new PageRenderer(d, { capacity: 14 });
        setBook(b); setDoc(d); setRenderer(r); setSt({ bookmarks: [], notes: {}, ...s }); setAnns(a);
        lib.getTexts(bookId).then((t) => { if (alive) setTexts(t); });
        lib.saveState(bookId, { ...s, openedAt: Date.now() }).catch(() => {});
      } catch (e) {
        if (alive) setError(e.message || 'تعذّر فتح الكتاب.');
      }
    })();
    return () => { alive = false; if (r) r.destroy(); if (d) closePdf(d); };
  }, [lib, bookId]);

  // صور مصغّرة (روابط مؤقتة تُحرَّر عند الإغلاق)
  const thumbUrls = useRef(new Map());
  const getThumb = useCallback(async (n) => {
    if (thumbUrls.current.has(n)) return thumbUrls.current.get(n);
    const blob = await lib.getThumb(bookId, n);
    const url = blob ? URL.createObjectURL(blob) : null;
    thumbUrls.current.set(n, url);
    return url;
  }, [lib, bookId]);
  useEffect(() => () => { for (const u of thumbUrls.current.values()) if (u) URL.revokeObjectURL(u); thumbUrls.current.clear(); }, []);

  // ===== القياس =====
  useEffect(() => {
    const el = stageRef.current; if (!el) return undefined;
    const ro = new ResizeObserver(() => setBox({ W: el.clientWidth, H: el.clientHeight }));
    ro.observe(el);
    setBox({ W: el.clientWidth, H: el.clientHeight });
    return () => ro.disconnect();
  }, [book]);

  const total = book ? book.pages : 0;
  const dir = st.dir || (book && book.direction) || 'rtl';
  const mode = userMode === 'auto' ? (box.W >= 760 && total > 1 ? 'double' : 'single') : (total > 1 ? userMode : 'single');

  // المنظر الأول: آخر صفحة وصل إليها المعلم
  useEffect(() => { if (book && view === null) setView(viewOf(Math.min(Math.max(1, st.lastPage || 1), total), mode)); }, [book]);
  // عند تغيير وضع العرض نحافظ على الصفحة نفسها
  const lastModeRef = useRef(mode);
  useEffect(() => {
    if (view === null) { lastModeRef.current = mode; return; }
    if (lastModeRef.current === mode) return;
    const p = viewPages(view, total, lastModeRef.current)[0] || 1;
    lastModeRef.current = mode;
    setFlip(null);
    setView(viewOf(p, mode));
  }, [mode]);

  const visible = view === null ? [] : viewPages(view, total, mode);
  const current = visible[0] || 1;

  // ===== الأبعاد =====
  const geo = useMemo(() => {
    if (!book) return null;
    const a = book.width / book.height;
    const cols = mode === 'double' ? 2 : 1;
    const padX = presenting ? 24 : 48, padY = presenting ? 24 : 40;
    const W = Math.max(200, box.W - padX), H = Math.max(200, box.H - padY);
    const h0 = fit === 'width' ? W / (cols * a) : Math.min(H, W / (cols * a));
    const ph = Math.floor(h0 * zoom), pw = Math.floor(h0 * a * zoom);
    return { pw, ph, bw: pw * cols, bh: ph, cols };
  }, [book, mode, box, fit, zoom, presenting]);

  // تجهيز الصفحات المجاورة
  useEffect(() => {
    if (!renderer || !geo || view === null) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const near = [...viewPages(view + 1, total, mode), ...viewPages(view - 1, total, mode)];
    const t = setTimeout(() => renderer.prefetch(near, geo.pw * dpr), 250);
    return () => clearTimeout(t);
  }, [renderer, geo, view, mode, total]);

  // حفظ آخر صفحة
  useEffect(() => {
    if (!book || view === null) return undefined;
    const t = setTimeout(() => { lib.saveState(bookId, { ...st, lastPage: current, openedAt: Date.now() }).catch(() => {}); }, 600);
    return () => clearTimeout(t);
  }, [current, book]);

  const saveSt = (next) => { setSt(next); lib.saveState(bookId, { ...next, lastPage: current, openedAt: Date.now() }).catch(() => {}); };

  // ===== التقليب =====
  const flipRef = useRef(null); flipRef.current = flip;
  const viewRef = useRef(view); viewRef.current = view;
  const raf = useRef(0);

  const animate = (from, to, target, plan, onEnd) => {
    cancelAnimationFrame(raf.current);
    const dur = FLIP_MS * Math.max(0.25, Math.abs(to - from));
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const p = from + (to - from) * ease(k);
      setFlip({ to: target, plan, p });
      if (k < 1) raf.current = requestAnimationFrame(step);
      else onEnd();
    };
    raf.current = requestAnimationFrame(step);
  };

  const finishNow = () => {
    const f = flipRef.current;
    if (!f) return viewRef.current;
    cancelAnimationFrame(raf.current);
    setFlip(null); setView(f.to); viewRef.current = f.to;
    return f.to;
  };

  const goView = useCallback((target, { animateIt = true } = {}) => {
    const cur = finishNow();
    if (cur === null || target === cur) return;
    const lo = firstView(mode), hi = lastView(total, mode);
    target = Math.max(lo, Math.min(hi, target));
    if (target === cur) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animateIt || Math.abs(target - cur) > 1 || reduce) {
      setView(target); return; // القفز البعيد: انتقال مباشر
    }
    const plan = flipPlan(cur, target, total, mode);
    animate(0, 1, target, plan, () => { setFlip(null); setView(target); });
  }, [mode, total]);

  const next = () => goView((flipRef.current ? flipRef.current.to : view) + 1);
  const prev = () => goView((flipRef.current ? flipRef.current.to : view) - 1);
  const goPage = useCallback((p) => { if (!total) return; p = Math.max(1, Math.min(total, Number(p) || 1)); goView(viewOf(p, mode), { animateIt: true }); }, [goView, total, mode]);

  // ===== السحب والنقر على حواف الصفحة =====
  const drag = useRef(null);
  const forwardSide = mode === 'double' ? sideOf('second', dir) : (dir === 'rtl' ? 'left' : 'right');

  const onStageDown = (e) => {
    if (!geo || tool !== 'none' || e.button > 0) return;
    const stage = stageRef.current;
    if (zoom > 1) { // تحريك الصفحة المكبّرة
      drag.current = { pan: true, x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop, moved: false };
      stage.setPointerCapture(e.pointerId);
      return;
    }
    const r = bookRef.current.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    const x = e.clientX - r.left;
    const half = x < r.width / 2 ? 'left' : 'right';
    const pageW = r.width / geo.cols;
    const edge = half === 'left' ? x < pageW * 0.3 : x > r.width - pageW * 0.3;
    const fwd = half === forwardSide;
    drag.current = { x: e.clientX, half, edge, fwd, started: false, width: r.width };
    stage.setPointerCapture(e.pointerId);
  };

  const onStageMove = (e) => {
    const d = drag.current; if (!d) return;
    if (d.pan) {
      const stage = stageRef.current;
      stage.scrollLeft = d.sl - (e.clientX - d.x); stage.scrollTop = d.st - (e.clientY - d.y);
      d.moved = true; return;
    }
    const dx = e.clientX - d.x;
    // التقليب يتبع اتجاه حركة الورقة: من جهتها نحو الجهة الأخرى
    const toward = d.half === 'left' ? dx : -dx;
    if (!d.started) {
      if (toward < 10) return;
      const cur = finishNow();
      const target = cur + (d.fwd ? 1 : -1);
      if (target < firstView(mode) || target > lastView(total, mode)) { drag.current = null; return; }
      d.started = true; d.target = target; d.plan = flipPlan(cur, target, total, mode);
    }
    const p = Math.max(0, Math.min(1, toward / (d.width * (mode === 'double' ? 0.85 : 0.9))));
    cancelAnimationFrame(raf.current);
    setFlip({ to: d.target, plan: d.plan, p });
  };

  const onStageUp = () => {
    const d = drag.current; drag.current = null;
    if (!d || d.pan) return;
    if (d.started) {
      const f = flipRef.current; const p = f ? f.p : 0;
      if (p > 0.28) animate(p, 1, d.target, d.plan, () => { setFlip(null); setView(d.target); });
      else animate(p, 0, d.target, d.plan, () => setFlip(null));
      return;
    }
    if (d.edge) (d.fwd ? next : prev)();
  };

  const onWheel = (e) => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); stepZoom(e.deltaY < 0 ? 1 : -1); }
  };

  // ===== التكبير =====
  const stepZoom = (k) => setZoom((z) => {
    const i = ZOOMS.findIndex((v) => v >= z - 0.001);
    return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 0 : i) + k))];
  });

  // ===== ملء الشاشة ووضع العرض =====
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const enterFull = async () => {
    const el = rootRef.current;
    try { if (el.requestFullscreen) await el.requestFullscreen(); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); } catch { /* بعض المتصفحات تمنعه */ }
  };
  const exitFull = async () => { try { if (isFull()) await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen()); } catch { /* */ } };
  const startPresent = async () => { setPresenting(true); setPanel(null); setAnnotOpen(false); setZoom(1); setFit('page'); await enterFull(); };
  const stopPresent = async () => { setPresenting(false); setQuiet(false); await exitFull(); };
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => { const f = isFull(); setFull(f); if (!f) { setPresenting(false); setQuiet(false); } };
    document.addEventListener('fullscreenchange', on); document.addEventListener('webkitfullscreenchange', on);
    return () => { document.removeEventListener('fullscreenchange', on); document.removeEventListener('webkitfullscreenchange', on); };
  }, []);

  // إخفاء الشريط المصغّر في وضع العرض عند عدم الحركة
  useEffect(() => {
    if (!presenting) { setIdle(false); return undefined; }
    let t = setTimeout(() => setIdle(true), 2500);
    const wake = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), 2500); };
    window.addEventListener('pointermove', wake); window.addEventListener('keydown', wake);
    return () => { clearTimeout(t); window.removeEventListener('pointermove', wake); window.removeEventListener('keydown', wake); };
  }, [presenting]);

  // ===== لوحة المفاتيح =====
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      const k = e.key;
      const nextKey = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const prevKey = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      if (k === nextKey || k === 'PageDown' || k === ' ') { e.preventDefault(); next(); }
      else if (k === prevKey || k === 'PageUp') { e.preventDefault(); prev(); }
      else if (k === 'Home') { e.preventDefault(); goView(firstView(mode)); }
      else if (k === 'End') { e.preventDefault(); goView(lastView(total, mode)); }
      else if (k === '+' || k === '=') stepZoom(1);
      else if (k === '-') stepZoom(-1);
      else if (k === '0') setZoom(1);
      else if (k === 'Escape') {
        if (tool !== 'none') setTool('none');
        else if (presenting) stopPresent();
        else if (panel) setPanel(null);
      } else if (k === 'l' || k === 'L' || k === 'ل') setTool((t) => (t === 'laser' ? 'none' : 'laser'));
      else if ((k === 'h' || k === 'H' || k === 'ا') && presenting) setQuiet((q) => !q);
      else if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.ctrlKey || e.metaKey) && (k === 'y' || k === 'Y')) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // ===== التعليقات =====
  const saveAnnsSoon = useRef(0);
  const persistAnns = (next) => {
    clearTimeout(saveAnnsSoon.current);
    saveAnnsSoon.current = setTimeout(() => lib.saveAnns(bookId, next).catch(() => {}), 400);
  };
  const setPageShapes = (page, shapes) => {
    setAnns((a) => {
      const pages = { ...a.pages };
      if (shapes.length) pages[page] = shapes; else delete pages[page];
      const next = { ...a, pages };
      persistAnns(next);
      return next;
    });
  };
  const onAnnChange = (page, after, before) => { history.current.push({ page, before, after }); setPageShapes(page, after); bump((x) => x + 1); };
  const undo = () => { const op = history.current.popUndo(); if (!op) return; setPageShapes(op.page, op.before); if (!visible.includes(op.page)) goPage(op.page); bump((x) => x + 1); };
  const redo = () => { const op = history.current.popRedo(); if (!op) return; setPageShapes(op.page, op.after); if (!visible.includes(op.page)) goPage(op.page); bump((x) => x + 1); };
  const clearVisible = () => {
    const withShapes = visible.filter((p) => (anns.pages[p] || []).length);
    if (!withShapes.length) return;
    if (!window.confirm(`مسح كل الرسومات من ${withShapes.length > 1 ? 'الصفحتين الظاهرتين' : `صفحة ${withShapes[0]}`}؟ (يمكنك التراجع)`)) return;
    for (const p of withShapes) onAnnChange(p, [], anns.pages[p]);
  };

  // ===== علامات وملاحظات =====
  const toggleMark = (p) => {
    const has = st.bookmarks.includes(p);
    saveSt({ ...st, bookmarks: has ? st.bookmarks.filter((x) => x !== p) : [...st.bookmarks, p] });
  };
  const saveNote = (p, text) => setSt((s) => { const notes = { ...s.notes, [p]: text }; if (!text.trim()) delete notes[p]; const n = { ...s, notes }; lib.saveState(bookId, { ...n, lastPage: current, openedAt: Date.now() }).catch(() => {}); return n; });

  // نطلب الصور المصغّرة للصفحات الظاهرة (بديل فوري أثناء الرسم الحاد)
  useEffect(() => { for (const n of [...visible, ...(flip ? [flip.plan.front, flip.plan.back, flip.plan.under] : [])]) if (n && !thumbUrls.current.has(n)) getThumb(n).then(() => bump((x) => x + 1)); });

  // ===== الرسم =====
  if (error) {
    return (
      <div className="ib-reader ib-reader--err" ref={rootRef}>
        <div className="ib-alert" role="alert"><p>{error}</p><button type="button" className="ib-btn" onClick={onClose}>العودة إلى المكتبة</button></div>
      </div>
    );
  }

  const ready = book && geo && renderer && view !== null;
  const firstSide = sideOf('first', dir), secondSide = sideOf('second', dir);

  const thumbOf = (n) => (n && thumbUrls.current.get(n)) || null;

  const page = (n, key) => (
    <div className="ib-slot__inner" key={key}>
      <PageCanvas n={n} renderer={renderer} w={geo.pw} h={geo.ph} thumbUrl={thumbOf(n)} />
      {n ? <AnnotLayer page={n} shapes={anns.pages[n]} w={geo.pw} h={geo.ph} tool={tool} color={color} width={width} visible={showAnns} onChange={onAnnChange} /> : null}
    </div>
  );

  let slots = null; let leaf = null;
  if (ready) {
    const s = slotsOf(view, total, mode);
    if (mode === 'single') {
      if (flip) {
        const f = flip.plan;
        const fwd = f.forward;
        const staticPage = fwd ? f.under : f.front; // تحت الورقة
        const leafPage = fwd ? f.front : f.under;
        const p = fwd ? flip.p : 1 - flip.p;
        slots = <div className="ib-slot" style={{ width: geo.pw, height: geo.ph }}>{page(staticPage, 's')}<div className="ib-under-shade" style={{ opacity: Math.sin(p * Math.PI) * 0.5 }} /></div>;
        const sign = dir === 'rtl' ? 1 : -1;
        leaf = (
          <div className="ib-leaf ib-leaf--single" style={{ width: geo.pw, height: geo.ph, left: 0, transformOrigin: dir === 'rtl' ? 'right center' : 'left center', transform: `rotateY(${sign * p * 180}deg)`, opacity: p > 0.5 ? Math.max(0, 1 - (p - 0.5) * 2.4) : 1 }}>
            <div className="ib-face ib-face--front"><PageCanvas n={leafPage} renderer={renderer} w={geo.pw} h={geo.ph} thumbUrl={thumbOf(leafPage)} /><div className="ib-face__shade" style={{ opacity: Math.sin(p * Math.PI) * 0.45, background: `linear-gradient(to ${dir === 'rtl' ? 'left' : 'right'}, rgba(0,0,0,.35), transparent 60%)` }} /></div>
            <div className="ib-face ib-face--back"><div className="ib-paperback" /></div>
          </div>
        );
      } else {
        slots = <div className="ib-slot" style={{ width: geo.pw, height: geo.ph }}>{page(s.center, 'c')}</div>;
      }
    } else {
      // وضع الصفحتين
      let firstN = s.first || null, secondN = s.second || null;
      if (flip) {
        const f = flip.plan;
        if (f.forward) { secondN = f.under; firstN = f.stay; } else { firstN = f.under; secondN = f.stay; }
        const leafSide = f.forward ? secondSide : firstSide;
        const sign = leafSide === 'left' ? 1 : -1;
        const p = flip.p;
        const shadeDir = leafSide === 'left' ? 'left' : 'right';
        leaf = (
          <div className="ib-leaf" style={{ width: geo.pw, height: geo.ph, left: leafSide === 'left' ? 0 : geo.pw, transformOrigin: leafSide === 'left' ? 'right center' : 'left center', transform: `rotateY(${sign * p * 180}deg)` }}>
            <div className="ib-face ib-face--front">
              {f.front ? <PageCanvas n={f.front} renderer={renderer} w={geo.pw} h={geo.ph} thumbUrl={thumbOf(f.front)} /> : <div className="ib-paperback" />}
              <div className="ib-face__shade" style={{ opacity: Math.sin(p * Math.PI) * 0.5, background: `linear-gradient(to ${shadeDir}, rgba(0,0,0,.4), transparent 55%)` }} />
            </div>
            <div className="ib-face ib-face--back">
              {f.back ? <PageCanvas n={f.back} renderer={renderer} w={geo.pw} h={geo.ph} thumbUrl={thumbOf(f.back)} /> : <div className="ib-paperback" />}
              <div className="ib-face__shade" style={{ opacity: Math.sin(p * Math.PI) * 0.5, background: `linear-gradient(to ${shadeDir === 'left' ? 'right' : 'left'}, rgba(0,0,0,.4), transparent 55%)` }} />
            </div>
          </div>
        );
      }
      const leftN = firstSide === 'left' ? firstN : secondN;
      const rightN = firstSide === 'left' ? secondN : firstN;
      const shade = flip ? Math.sin(flip.p * Math.PI) * 0.45 : 0;
      slots = (
        <>
          <div className={`ib-slot ib-slot--left ${leftN ? '' : 'is-empty'}`} style={{ width: geo.pw, height: geo.ph }}>{leftN ? page(leftN, 'l') : null}{leftN && flip ? <div className="ib-under-shade" style={{ opacity: shade }} /> : null}</div>
          <div className={`ib-slot ib-slot--right ${rightN ? '' : 'is-empty'}`} style={{ width: geo.pw, height: geo.ph }}>{rightN ? page(rightN, 'r') : null}{rightN && flip ? <div className="ib-under-shade ib-under-shade--r" style={{ opacity: shade }} /> : null}</div>
          {leftN && rightN ? <div className="ib-spine" aria-hidden="true" /> : null}
        </>
      );
    }
  }

  const canPrev = ready && (flip ? flip.to : view) > firstView(mode);
  const canNext = ready && (flip ? flip.to : view) < lastView(total, mode);
  const marked = st.bookmarks.includes(current);
  // الأرقام داخل عزل اتجاه (LRI…PDI) حتى تظهر «6–7» لا «7–6» داخل النص العربي
  const pageLabel = visible.length > 1 ? `\u2066${visible[0]}–${visible[1]}\u2069` : `${current}`;
  const prevIcon = dir === 'rtl' ? 'prev' : 'next';
  const nextIcon = dir === 'rtl' ? 'next' : 'prev';
  const hideChrome = presenting;

  return (
    <div ref={rootRef} className={`ib-reader ${presenting ? 'is-presenting' : ''} ${quiet ? 'is-quiet' : ''} ${idle ? 'is-idle' : ''} ${tool === 'laser' ? 'is-laser' : ''}`} dir="rtl">
      {!hideChrome ? (
        <header className="ib-bar" role="toolbar" aria-label="أدوات الكتاب">
          <div className="ib-bar__group">
            <Btn icon="back" tip="العودة إلى مكتبتي" onClick={onClose} />
            <span className="ib-bar__title" title={book ? book.name : ''}>{book ? book.name : 'جارٍ فتح الكتاب…'}</span>
          </div>
          <div className="ib-bar__group">
            <Btn icon="first" tip="أول صفحة" onClick={() => goView(firstView(mode))} disabled={!canPrev} className="ib-hide-sm" />
            <Btn icon={prevIcon} tip="الصفحة السابقة" onClick={prev} disabled={!canPrev} />
            <form className="ib-pageform" onSubmit={(e) => { e.preventDefault(); goPage(pageInput); setPageInput(''); const i = e.currentTarget.querySelector('input'); if (i) i.blur(); }}>
              <input aria-label="رقم الصفحة" inputMode="numeric" value={pageInput} placeholder={pageLabel} onChange={(e) => setPageInput(e.target.value.replace(/[^\d٠-٩]/g, '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)))} />
              <span>/ {total || '…'}</span>
            </form>
            <Btn icon={nextIcon} tip="الصفحة التالية" onClick={next} disabled={!canNext} />
            <Btn icon="last" tip="آخر صفحة" onClick={() => goView(lastView(total, mode))} disabled={!canNext} className="ib-hide-sm" />
          </div>
          <div className="ib-bar__group">
            <Btn icon="zoomOut" tip="تصغير" onClick={() => stepZoom(-1)} disabled={zoom <= 1} />
            <button type="button" className="ib-tb ib-zoomval" data-tip="ملاءمة الشاشة" aria-label="ملاءمة الشاشة" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}٪</button>
            <Btn icon="zoomIn" tip="تكبير" onClick={() => stepZoom(1)} disabled={zoom >= 4} />
            <Btn icon={fit === 'page' ? 'fitWidth' : 'fitPage'} tip={fit === 'page' ? 'ملاءمة العرض' : 'ملاءمة الصفحة كاملة'} onClick={() => { setFit(fit === 'page' ? 'width' : 'page'); setZoom(1); }} className="ib-hide-sm" />
            <Btn icon={mode === 'double' ? 'single' : 'spread'} tip={mode === 'double' ? 'صفحة واحدة' : 'صفحتان متقابلتان'} onClick={() => setUserMode(mode === 'double' ? 'single' : 'double')} disabled={total < 2} />
          </div>
          <div className="ib-bar__group">
            <Btn icon="thumbs" tip="الصفحات المصغّرة" active={panel === 'thumbs'} onClick={() => setPanel(panel === 'thumbs' ? null : 'thumbs')} />
            <Btn icon="search" tip="البحث في الكتاب" active={panel === 'search'} onClick={() => setPanel(panel === 'search' ? null : 'search')} />
            <Btn icon="bookmark" tip={marked ? 'إزالة العلامة من هذه الصفحة' : 'علامة مرجعية لهذه الصفحة'} active={marked} onClick={() => toggleMark(current)} />
            <Btn icon="library" tip="العلامات المرجعية" active={panel === 'marks'} onClick={() => setPanel(panel === 'marks' ? null : 'marks')} />
            <Btn icon="notes" tip="ملاحظاتي على الصفحة" active={panel === 'notes'} onClick={() => setPanel(panel === 'notes' ? null : 'notes')} />
          </div>
          <div className="ib-bar__group">
            <Btn icon="annotate" tip="أدوات الشرح والرسم" active={annotOpen} onClick={() => { setAnnotOpen(!annotOpen); if (annotOpen) setTool('none'); else setTool('pen'); }} />
            <Btn icon="laser" tip="مؤشر الليزر (L)" active={tool === 'laser'} onClick={() => setTool(tool === 'laser' ? 'none' : 'laser')} />
            <Btn icon={full ? 'exitFull' : 'fullscreen'} tip={full ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'} onClick={() => (full ? exitFull() : enterFull())} className="ib-hide-sm" />
            <button type="button" className="ib-present-btn" onClick={startPresent} data-tip="وضع العرض أمام الطلاب"><Icon name="present" size={18} /> <span>وضع العرض التفاعلي</span></button>
          </div>
        </header>
      ) : null}

      {annotOpen && !quiet ? (
        <div className={`ib-tray ${presenting ? 'ib-tray--float' : ''}`} role="toolbar" aria-label="أدوات الشرح">
          {DRAW_TOOLS.map(([id, ic, tip]) => <Btn key={id} icon={ic} tip={tip} active={tool === id} onClick={() => setTool(id)} />)}
          <span className="ib-tray__sep" />
          {COLORS.map((c) => (
            <button key={c} type="button" className={`ib-color ${color === c ? 'is-on' : ''}`} style={{ '--c': c }} onClick={() => { setColor(c); if (tool === 'eraser' || tool === 'none' || tool === 'laser') setTool('pen'); }} aria-label={`اللون ${c}`} data-tip="اللون" />
          ))}
          <span className="ib-tray__sep" />
          {WIDTHS.map((w) => (
            <button key={w} type="button" className={`ib-width ${width === w ? 'is-on' : ''}`} onClick={() => setWidth(w)} aria-label={`سُمك ${w}`} data-tip="سُمك الخط"><i style={{ width: w + 2, height: w + 2 }} /></button>
          ))}
          <span className="ib-tray__sep" />
          <Btn icon="undo" tip="تراجع (Ctrl+Z)" onClick={undo} disabled={!history.current.canUndo()} />
          <Btn icon="redo" tip="إعادة (Ctrl+Y)" onClick={redo} disabled={!history.current.canRedo()} />
          <Btn icon="trash" tip="مسح رسومات الصفحة الظاهرة" onClick={clearVisible} />
          <Btn icon={showAnns ? 'eye' : 'eyeOff'} tip={showAnns ? 'إخفاء الرسومات' : 'إظهار الرسومات'} active={!showAnns} onClick={() => setShowAnns(!showAnns)} />
          <Btn icon="close" tip="إغلاق أدوات الشرح (Esc)" onClick={() => { setAnnotOpen(false); setTool('none'); }} />
        </div>
      ) : null}

      <div className="ib-body">
        <div ref={stageRef} className={`ib-stage ${zoom > 1 ? 'is-zoomed' : ''} ${fit === 'width' ? 'is-fitwidth' : ''}`}
          onPointerDown={onStageDown} onPointerMove={onStageMove} onPointerUp={onStageUp} onPointerCancel={onStageUp} onWheel={onWheel}>
          {!ready ? <div className="ib-loading"><span className="ib-page__spin" /> جارٍ فتح الكتاب…</div> : (
            <div className="ib-stage__pad" style={{ minWidth: geo.bw + 24, minHeight: geo.bh + 20 }}>
              <div ref={bookRef} className={`ib-book ib-book--${mode} ${flip ? 'is-flipping' : ''}`} style={{ width: geo.bw, height: geo.bh }}>
                {slots}
                {leaf}
              </div>
            </div>
          )}
        </div>
        {tool === 'laser' && ready ? <LaserLayer /> : null}

        {panel && !presenting ? (
          <aside className="ib-panel" aria-label="لوحة جانبية">
            <div className="ib-panel__head">
              <b>{{ thumbs: 'صفحات الكتاب', search: 'البحث في الكتاب', marks: 'العلامات المرجعية', notes: 'ملاحظاتي' }[panel]}</b>
              <Btn icon="close" tip="إغلاق" onClick={() => setPanel(null)} size={18} />
            </div>
            <div className="ib-panel__body">
              {panel === 'thumbs' ? <ThumbsPanel total={total} visible={visible} bookmarks={st.bookmarks} getThumb={getThumb} onGo={goPage} /> : null}
              {panel === 'search' ? <SearchPanel texts={texts} searchable={!!(book && book.searchable)} onGo={goPage} /> : null}
              {panel === 'marks' ? <BookmarksPanel bookmarks={st.bookmarks} visible={visible} onGo={goPage} onToggle={toggleMark} /> : null}
              {panel === 'notes' ? <NotesPanel notes={st.notes} visible={visible} onSave={saveNote} onGo={goPage} /> : null}
            </div>
          </aside>
        ) : null}
      </div>

      {!presenting && ready ? (
        <footer className="ib-foot">
          <input type="range" className="ib-progress" min={1} max={total} value={current} dir={dir}
            onChange={(e) => goView(viewOf(Number(e.target.value), mode), { animateIt: false })} aria-label="موضعك في الكتاب" />
          <span className="ib-foot__txt">صفحة {pageLabel} من {total} · {Math.round((current / total) * 100)}٪</span>
          <button type="button" className="ib-tb ib-dir" data-tip="اتجاه التقليب" onClick={() => saveSt({ ...st, dir: dir === 'rtl' ? 'ltr' : 'rtl' })}>
            <Icon name="swap" size={16} /> {dir === 'rtl' ? 'كتاب عربي' : 'كتاب لاتيني'}
          </button>
        </footer>
      ) : null}

      {presenting ? (
        <div className={`ib-mini ${quiet ? 'is-hidden' : ''}`} role="toolbar" aria-label="تحكم العرض">
          <Btn icon={prevIcon} tip="السابقة" onClick={prev} disabled={!canPrev} size={22} />
          <span className="ib-mini__p">{pageLabel} من {total}</span>
          <Btn icon={nextIcon} tip="التالية" onClick={next} disabled={!canNext} size={22} />
          <span className="ib-tray__sep" />
          <Btn icon="laser" tip="مؤشر الليزر (L)" active={tool === 'laser'} onClick={() => setTool(tool === 'laser' ? 'none' : 'laser')} size={22} />
          <Btn icon="annotate" tip="أدوات الشرح" active={annotOpen} onClick={() => { setAnnotOpen(!annotOpen); setTool(annotOpen ? 'none' : 'pen'); }} size={22} />
          <Btn icon="zoomIn" tip="تكبير" onClick={() => stepZoom(1)} size={22} />
          <Btn icon="zoomOut" tip="تصغير" onClick={() => stepZoom(-1)} disabled={zoom <= 1} size={22} />
          <Btn icon="quiet" tip="إخفاء كل الأدوات (H)" onClick={() => setQuiet(true)} size={22} />
          <Btn icon="close" tip="الخروج من وضع العرض (Esc)" onClick={stopPresent} size={22} className="ib-mini__exit" />
        </div>
      ) : null}
      {presenting && quiet ? <button type="button" className="ib-unquiet" onClick={() => setQuiet(false)} aria-label="إظهار الأدوات">•••</button> : null}
    </div>
  );
}
