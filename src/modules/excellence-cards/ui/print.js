'use client';
// أدوات مشتركة: تحجيم المعاينة لتناسب الشاشة، وطباعة طبقة خاصة فقط دون التأثير على طباعة أي صفحة أخرى في المنصة.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MM = 96 / 25.4; // بكسل لكل مليمتر في CSS
const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** يعرض عنصرًا مقاسه بالمليمتر مصغّرًا ليناسب عرض الحاوية (مع حد أقصى للتكبير) */
export function Fit({ w, h, max = 1.4, children, className = '' }) {
  const ref = useRef(null);
  const [cw, setCw] = useState(0);
  useIso(() => {
    const el = ref.current; if (!el) return undefined;
    const upd = () => setCw(el.clientWidth);
    upd();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(upd); ro.observe(el); return () => ro.disconnect();
  }, []);
  const px = w * MM; const s = cw ? Math.min(max, cw / px) : 0;
  return (
    <div ref={ref} className={`ec-fit ${className}`} style={{ height: s ? h * MM * s : 0 }}>
      {s ? <div className="ec-fit-in" style={{ width: `${w}mm`, height: `${h}mm`, marginLeft: -(px * s) / 2, transform: `scale(${s})` }}>{children}</div> : null}
    </div>
  );
}

/**
 * طبقة الطباعة: تُركّب في body، ثم تُفتح نافذة الطباعة، ثم تُزال.
 * كل قواعد الطباعة مقيّدة بالصنف ec-printing ولا تُضاف @page إلا أثناء الطباعة.
 */
export function PrintLayer({ job, onDone }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  useEffect(() => {
    if (!ready || !job) return undefined;
    const style = document.createElement('style');
    style.setAttribute('data-ec-print', '');
    style.textContent = job.kind === 'cards' ? '@page { size: A4 portrait; margin: 0; }' : '@page { size: A4 portrait; margin: 12mm; }';
    document.head.appendChild(style);
    document.body.classList.add('ec-printing');
    let finished = false;
    const done = () => {
      if (finished) return; finished = true;
      style.remove(); document.body.classList.remove('ec-printing');
      window.removeEventListener('afterprint', done);
      onDone && onDone();
    };
    window.addEventListener('afterprint', done);
    // ننتظر تحميل الخطوط قبل فتح نافذة الطباعة حتى لا يُطبع النص العربي بخط بديل
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    const t = setTimeout(() => { fonts.then(() => { try { window.print(); } finally { setTimeout(done, 400); } }); }, 120);
    return () => { clearTimeout(t); if (!finished) { style.remove(); document.body.classList.remove('ec-printing'); window.removeEventListener('afterprint', done); } };
  }, [ready, job]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ready || !job) return null;
  return createPortal(<div className={`ec-print-root is-${job.kind}`} dir="rtl">{job.node}</div>, document.body);
}

export function downloadText(name, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
