'use client';
// خطة التنبيه: عدة تنبيهات قبل الحصة (لكل منها نغمة) + تنبيه عند البداية + تنبيه قبل النهاية
import { useState } from 'react';
import { Icon, Toggle } from './parts';
import { BEFORE_PRESETS, defaultPlan } from '../core/model.js';

export function ToneSelect({ value, onChange, tones, onPreview, label = 'النغمة' }) {
  return (
    <span className="ca-tone-sel">
      <select className="ca-input" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <optgroup label="نغمات المنصة">{tones.builtin.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
        {tones.custom.length > 0 && <optgroup label="نغماتي">{tones.custom.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>}
      </select>
      <button type="button" className="ca-icon-btn" onClick={() => onPreview(value)} aria-label="تجربة النغمة" title="تجربة"><Icon n="play" size={16} /></button>
    </span>
  );
}

export default function PlanEditor({ plan, onChange, tones, onPreview, compact }) {
  const p = plan || defaultPlan();
  const [custom, setCustom] = useState('');
  const set = (patch) => onChange({ ...p, ...patch });
  const has = (m) => p.before.some((b) => b.min === m);
  const toggle = (m) => set({ before: has(m) ? p.before.filter((b) => b.min !== m) : [...p.before, { min: m, tone: p.before.length ? p.before[p.before.length - 1].tone : 'chime' }].sort((a, b) => b.min - a.min) });
  const addCustom = () => { const m = Math.round(+custom); if (m >= 1 && m <= 180 && !has(m)) { toggle(m); setCustom(''); } };
  return (
    <div className={`ca-plan${compact ? ' is-compact' : ''}`}>
      <div className="ca-label">التنبيه قبل بداية الحصة (يمكن اختيار أكثر من تنبيه)</div>
      <div className="ca-row ca-wrap">
        {BEFORE_PRESETS.map((m) => <button key={m} type="button" className={`ca-chip ca-chip-btn${has(m) ? ' is-on' : ''}`} aria-pressed={has(m)} onClick={() => toggle(m)}>{m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتان' : `${m} دقائق`.replace(/^(1[1-9]|[2-9]\d) دقائق/, '$1 دقيقة')}</button>)}
        <span className="ca-row"><input className="ca-input ca-num" type="number" min="1" max="180" placeholder="مخصص" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())} aria-label="مدة مخصصة بالدقائق" /><button type="button" className="ca-btn is-ghost is-sm" onClick={addCustom}><Icon n="plus" size={15} />إضافة</button></span>
      </div>
      {p.before.length > 0 && (
        <ul className="ca-plan-list">
          {p.before.map((b) => (
            <li key={b.min}>
              <span className="ca-plan-min">{b.min === 1 ? 'قبل دقيقة' : b.min === 2 ? 'قبل دقيقتين' : `قبل ${b.min} ${b.min <= 10 ? 'دقائق' : 'دقيقة'}`}</span>
              <ToneSelect value={b.tone} tones={tones} onPreview={onPreview} onChange={(tone) => set({ before: p.before.map((x) => (x.min === b.min ? { ...x, tone } : x)) })} />
              <button type="button" className="ca-icon-btn" onClick={() => toggle(b.min)} aria-label="حذف التنبيه"><Icon n="trash" size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      {!p.before.length && <p className="ca-muted ca-small">لا تنبيه قبل الحصة.</p>}
      <div className="ca-plan-extra">
        <div className="ca-plan-row">
          <Toggle checked={p.start.on} onChange={(on) => set({ start: { ...p.start, on } })} label="تنبيه عند بداية الحصة" />
          {p.start.on && <ToneSelect value={p.start.tone} tones={tones} onPreview={onPreview} onChange={(tone) => set({ start: { ...p.start, tone } })} />}
        </div>
        <div className="ca-plan-row">
          <Toggle checked={p.end.on} onChange={(on) => set({ end: { ...p.end, on } })} label="تنبيه قبل نهاية الحصة" hint="للانتباه لوقت إنهاء النشاط والانتقال" />
          {p.end.on && (
            <span className="ca-row">
              <select className="ca-input ca-num" value={p.end.min} onChange={(e) => set({ end: { ...p.end, min: +e.target.value } })} aria-label="الدقائق قبل النهاية">{[1, 2, 3, 5, 7, 10].map((m) => <option key={m} value={m}>قبل {m} د</option>)}</select>
              <ToneSelect value={p.end.tone} tones={tones} onPreview={onPreview} onChange={(tone) => set({ end: { ...p.end, tone } })} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
