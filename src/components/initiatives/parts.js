'use client';
// عناصر واجهة صغيرة مشتركة بين شاشات «مبادرات تعليمية».
import { Icon } from '@/components/pd-workshops/icons';
import { DOMAIN, LEADS, COSTS, STATUSES, label, weeksLabel } from '@/lib/initiatives/taxonomy';

export { Icon };
export const EXTRA = {
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
  checkSquare: 'M4 4h16v16H4zM8 12l3 3 5-6',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  rocket: 'M12 15l-3-3c1-4 4-8 10-9-1 6-5 9-9 10Zm-3-3-4 1 2-4 3-1m4 7-1 4 4-2 1-3M7 17l-3 3',
  copyPlus: 'M9 9h10v11H9zM5 15H4V4h11v1M14 12v5M11.5 14.5h5',
  sync: 'M20 11a8 8 0 0 0-14.6-4.5L4 8m0-4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16m0 4v-4h-4',
  poster: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',
  survey: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h3',
  gantt: 'M4 5h16M4 19h16M6 9h6M9 13h7M12 17h6',
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z',
};

export const DomainIcon = ({ id, size = 18 }) => {
  const d = DOMAIN[id] || {};
  return <span className="in-dicon" style={{ '--c': d.color }}><Icon d={EXTRA[d.icon] || d.icon} size={size} /></span>;
};
export const CostTag = ({ cost }) => <span className={`in-cost is-${cost}`}>{(COSTS.find((c) => c.id === cost) || {}).short}</span>;
export const StatusPill = ({ status }) => {
  const s = STATUSES.find((x) => x.id === status) || STATUSES[0];
  return <span className="in-status" style={{ '--s': s.color }}>{s.label}</span>;
};
export const Progress = ({ pct }) => <span className="in-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></span>;

export function InitiativeCard({ item, onOpen, fav, onFav, big }) {
  const d = DOMAIN[item.domain] || {};
  return (
    <article className={`in-card ${big ? 'is-big' : ''}`} style={{ '--c': d.color }}>
      <button type="button" className="in-card-main" onClick={() => onOpen(item.id)}>
        <span className="in-card-top"><DomainIcon id={item.domain} /><span className="in-card-domain">{d.label}{item.topic ? ` · ${item.topic}` : ''}</span></span>
        <span className="in-card-title">{item.title}</span>
        {item.slogan && <span className="in-card-slogan">{item.slogan}</span>}
        <span className="in-card-sum">{item.problem || item.summary}</span>
        <span className="in-meta">
          <span><Icon d="clock" size={13} /> {weeksLabel(item.weeks)}</span>
          <span>{label(LEADS, item.lead)}</span>
          <CostTag cost={item.cost} />
          {item.source === 'ai' && <span className="in-ai"><Icon d="spark" size={13} /> ذكاء اصطناعي</span>}
        </span>
      </button>
      {onFav && (
        <button type="button" className={`in-fav ${fav ? 'is-on' : ''}`} onClick={() => onFav(item.id)} aria-pressed={!!fav} aria-label={fav ? 'إزالة من المحفوظة' : 'حفظ في المحفوظة'}>
          <Icon d="heart" fill={fav ? 'currentColor' : 'none'} />
        </button>
      )}
    </article>
  );
}

export const Field = ({ label: lab, children, hint, group }) => (group
  ? <div className="in-field" role="group" aria-label={lab}><span>{lab}</span>{children}{hint && <small>{hint}</small>}</div>
  : <label className="in-field"><span>{lab}</span>{children}{hint && <small>{hint}</small>}</label>);

export function Select({ label: lab, value, onChange, options, all = 'الكل' }) {
  return (
    <label className="in-select"><span>{lab}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {all !== null && <option value="">{all}</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

export const Section = ({ title, icon, children, actions, accent, id }) => (
  <section className={`in-sec ${accent ? 'is-accent' : ''}`} id={id}>
    <div className="in-sec-head"><h3>{icon && <Icon d={EXTRA[icon] || icon} size={17} />}{title}</h3>{actions}</div>
    {children}
  </section>
);
export const List = ({ items, ordered }) => (items && items.length ? (ordered ? <ol>{items.map((x, i) => <li key={i}>{x}</li>)}</ol> : <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>) : <p className="in-muted">—</p>);
