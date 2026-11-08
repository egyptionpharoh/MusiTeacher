'use client';
// عناصر واجهة صغيرة مشتركة بين خطوات مصنع الألحان
import { useState } from 'react';

export function Chip({ on, onClick, children, title, disabled }) {
  return (
    <button type="button" className={`mf-chip${on ? ' is-on' : ''}`} aria-pressed={!!on} onClick={onClick} title={title} disabled={disabled}>
      {children}
    </button>
  );
}

/** مجموعة اختيار واحد مع خيار «تلقائي» دائمًا في البداية */
export function ChoiceGroup({ label, hint, value, onChange, options, render, auto = true, autoLabel = 'تلقائي', grouped }) {
  const groups = grouped ? [...new Set(options.map((o) => o.group))] : [null];
  return (
    <div className="mf-field">
      <div className="mf-label">{label}{hint ? <span className="mf-hint"> — {hint}</span> : null}</div>
      {groups.map((g) => (
        <div key={g || 'all'} className="mf-chips">
          {g ? <span className="mf-chips-group">{g}</span> : null}
          {auto && (g === groups[0]) ? <Chip on={value === 'auto'} onClick={() => onChange('auto')} title="اترك الاختيار للمايسترو أو المحرك">✨ {autoLabel}</Chip> : null}
          {options.filter((o) => !grouped || o.group === g).map((o) => (
            <Chip key={o.id} on={value === o.id} onClick={() => onChange(o.id)} title={o.feel || o.desc}>
              {render ? render(o) : (o.icon ? `${o.icon} ${o.ar}` : o.ar)}
            </Chip>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CopyButton({ text, label = 'نسخ', small }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text || ''); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text || ''; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ } ta.remove();
    }
    setDone(true); setTimeout(() => setDone(false), 1500);
  }
  return <button type="button" className={`mf-btn mf-btn-ghost${small ? ' mf-btn-sm' : ''}`} onClick={copy} disabled={!text}>{done ? '✔ تم النسخ' : `📋 ${label}`}</button>;
}

export function Notice({ kind = 'info', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`mf-notice mf-notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <div className="mf-notice-body">{children}</div>
      {onClose ? <button type="button" className="mf-x" onClick={onClose} aria-label="إغلاق">×</button> : null}
    </div>
  );
}

export function Counter({ value, max }) {
  const n = (value || '').length;
  return <span className={`mf-counter${n > max ? ' is-over' : ''}`}>{n} / {max}</span>;
}

export const Spinner = () => <span className="mf-spin" aria-hidden="true" />;
