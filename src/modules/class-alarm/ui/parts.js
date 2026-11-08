'use client';
// 🧩 مكونات صغيرة مشتركة لواجهة المنبه
import { useEffect, useRef } from 'react';

const P = {
  bell: 'M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2ZM10 20a2 2 0 0 0 4 0',
  bellOff: 'M8.7 4.1A6 6 0 0 1 18 9v4M6 8.5V16l-2 2h12M10 20a2 2 0 0 0 4 0M3 3l18 18',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  grid: 'M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16',
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  download: 'M12 4v12m0 0-5-5m5 5 5-5M4 20h16',
  print: 'M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z',
  plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6 6 18', check: 'M5 12.5 10 17l9-10',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13', edit: 'M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4',
  copy: 'M8 8h11v12H8zM5 16V4h11', back: 'M9 6l6 6-6 6', play: 'M8 5v14l11-7z', stop: 'M7 7h10v10H7z',
  monitor: 'M3 5h18v11H3zM8 20h8M12 16v4', sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  shield: 'M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z', info: 'M12 8v.5M12 11v5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  pause: 'M8 5v14M16 5v14', music: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  warn: 'M12 9v4m0 3v.5M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z', note: 'M5 4h14v12l-4 4H5zM15 20v-4h4',
  cloud: 'M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9Z', expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z', phone: 'M8 3h8v18H8zM11 18h2', move: 'M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3',
};
export function Icon({ n, size = 18, className, fill }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={fill || 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n] || P.info} /></svg>;
}

export function Modal({ title, onClose, children, footer, wide, labelledBy }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    const first = el && el.querySelector('input,select,textarea,button:not(.ca-modal-x)');
    if (first) first.focus();
    const key = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); if (prev && prev.focus) prev.focus(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="ca-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div ref={ref} className={`ca-modal${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title}>
        <div className="ca-modal-head"><h2>{title}</h2>{onClose && <button type="button" className="ca-icon-btn ca-modal-x" onClick={onClose} aria-label="إغلاق"><Icon n="x" /></button>}</div>
        <div className="ca-modal-body">{children}</div>
        {footer && <div className="ca-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={`ca-toggle${disabled ? ' is-disabled' : ''}`}>
      <span className="ca-toggle-text"><span>{label}</span>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" role="switch" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="ca-switch" aria-hidden="true" />
    </label>
  );
}

export function Field({ label, children, hint, className = '' }) {
  return <label className={`ca-field ${className}`}><span className="ca-label">{label}</span>{children}{hint && <small className="ca-hint">{hint}</small>}</label>;
}

export function Seg({ value, onChange, options, label }) {
  return (
    <div className="ca-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => <button type="button" key={o.id} role="radio" aria-checked={value === o.id} className={value === o.id ? 'is-on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  );
}

export function Empty({ icon = 'calendar', title, children }) {
  return <div className="ca-empty"><Icon n={icon} size={34} /><strong>{title}</strong>{children}</div>;
}
