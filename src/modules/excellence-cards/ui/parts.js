'use client';
// أيقونات وعناصر صغيرة مشتركة لواجهة «كوبون التميز»
const P = {
  back: 'M9 6l6 6-6 6', star: 'M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.3 6.4 20.2l1.1-6.3L2.9 9.5l6.3-.9z',
  idea: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  brush: 'M14.5 3.5l6 6-9 9H5.5v-6zM12 6l6 6', print: 'M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01', chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  report: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6M9 9h2',
  plus: 'M12 5v14M5 12h14', check: 'M5 12.5l4.5 4.5L19 7', x: 'M6 6l12 12M18 6L6 18', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7C10 3 6 3 6.5 5.5 7 7.5 12 7 12 7zM12 7c2-4 6-4 5.5-1.5C17 7.5 12 7 12 7z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14', upload: 'M12 20V9M7 14l5-5 5 5M5 4h14', copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', cal: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4', info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7.5h.01',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-5-6.7',
  archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4', rotate: 'M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0 0 12.6 2M18.5 9A7 7 0 0 0 5.9 7',
};
export function Ico({ n, size = 18, className = '', fill = false }) {
  return (
    <svg className={`ec-ico ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={P[n] || P.star} />
    </svg>
  );
}

export const Seg = ({ value, onChange, options, label, name }) => (
  <div className="ec-seg" role="radiogroup" aria-label={label}>
    {options.map((o) => (
      <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? 'is-on' : ''} onClick={() => onChange(o.id)} name={name}>
        {o.icon ? <Ico n={o.icon} size={16} /> : null}{o.label}
      </button>
    ))}
  </div>
);

export function Field({ label, hint, children, wide, group }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className={`ec-field ${wide ? 'is-wide' : ''}`} {...(group ? { role: 'group', 'aria-label': label } : {})}>
      <span className="ec-label">{label}</span>
      {children}
      {hint ? <small className="ec-hint">{hint}</small> : null}
    </Tag>
  );
}
