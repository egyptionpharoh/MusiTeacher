'use client';
// اللوحة الجانبية: الصفحات المصغّرة، البحث، العلامات المرجعية، والملاحظات.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './icons.js';
import { searchTexts } from '../core/search.js';

function Thumb({ n, getThumb, current, marked, onGo }) {
  const ref = useRef(null);
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    let alive = true;
    const io = new IntersectionObserver((ents) => {
      if (ents.some((x) => x.isIntersecting)) { io.disconnect(); getThumb(n).then((u) => { if (alive) setUrl(u); }); }
    }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => { alive = false; io.disconnect(); };
  }, [n, getThumb]);
  return (
    <button ref={ref} type="button" className={`ib-thumb ${current ? 'is-current' : ''}`} onClick={() => onGo(n)} aria-label={`الانتقال إلى صفحة ${n}`} aria-current={current ? 'page' : undefined}>
      <span className="ib-thumb__img">{url ? <img src={url} alt="" loading="lazy" draggable={false} /> : null}</span>
      <span className="ib-thumb__n">{n}{marked ? <Icon name="bookmark" size={12} className="ib-thumb__mark" /> : null}</span>
    </button>
  );
}

export function ThumbsPanel({ total, visible, bookmarks, getThumb, onGo }) {
  const list = useRef(null);
  useEffect(() => {
    const el = list.current && list.current.querySelector('.is-current');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [visible[0]]);
  const pages = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);
  return (
    <div className="ib-thumbs" ref={list}>
      {pages.map((n) => <Thumb key={n} n={n} getThumb={getThumb} current={visible.includes(n)} marked={bookmarks.includes(n)} onGo={onGo} />)}
    </div>
  );
}

export function SearchPanel({ texts, searchable, onGo }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 220); return () => clearTimeout(t); }, [q]);
  const results = useMemo(() => (searchable ? searchTexts(texts, debounced) : []), [texts, debounced, searchable]);
  if (!searchable) {
    return <p className="ib-panel__empty">صفحات هذا الكتاب صور ممسوحة ضوئيًا ولا تحتوي على نص يمكن البحث فيه. استخدم الصفحات المصغّرة أو العلامات المرجعية للتنقل.</p>;
  }
  return (
    <div className="ib-search">
      <label className="ib-search__box">
        <Icon name="search" size={18} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن كلمة أو عبارة…" autoFocus aria-label="البحث داخل الكتاب" />
      </label>
      {debounced.trim().length >= 2 ? (
        <p className="ib-search__sum">{results.length ? `عدد الصفحات التي تحتوي العبارة: ${results.length}` : 'لا توجد نتائج. جرّب كلمة أقصر أو بإملاء مختلف.'}</p>
      ) : <p className="ib-search__sum muted">اكتب حرفين على الأقل. البحث يتجاهل التشكيل والهمزات.</p>}
      <ol className="ib-results">
        {results.map((r) => (
          <li key={r.page}>
            <button type="button" onClick={() => onGo(r.page)}>
              <span className="ib-results__p">صفحة {r.page}{r.count > 1 ? <small> (تكررت {r.count})</small> : null}</span>
              <span className="ib-results__s">…{r.snippet.before}<mark>{r.snippet.match}</mark>{r.snippet.after}…</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function BookmarksPanel({ bookmarks, visible, onGo, onToggle }) {
  const cur = visible[0];
  const sorted = [...bookmarks].sort((a, b) => a - b);
  const prev = [...sorted].reverse().find((p) => p < cur);
  const next = sorted.find((p) => p > Math.max(...visible));
  return (
    <div className="ib-marks">
      <button type="button" className="ib-btn ib-btn--wide" onClick={() => onToggle(cur)}>
        <Icon name="bookmark" size={18} /> {bookmarks.includes(cur) ? `إزالة علامة صفحة ${cur}` : `وضع علامة على صفحة ${cur}`}
      </button>
      {sorted.length ? (
        <>
          <div className="ib-marks__nav">
            <button type="button" className="ib-btn" disabled={!prev} onClick={() => onGo(prev)}>العلامة السابقة</button>
            <button type="button" className="ib-btn" disabled={!next} onClick={() => onGo(next)}>العلامة التالية</button>
          </div>
          <ul className="ib-marks__list">
            {sorted.map((p) => (
              <li key={p}>
                <button type="button" className={visible.includes(p) ? 'is-current' : ''} onClick={() => onGo(p)}><Icon name="bookmark" size={16} /> صفحة {p}</button>
                <button type="button" className="ib-x" onClick={() => onToggle(p)} aria-label={`إزالة علامة صفحة ${p}`}><Icon name="close" size={14} /></button>
              </li>
            ))}
          </ul>
        </>
      ) : <p className="ib-panel__empty">لا توجد علامات بعد. ضع علامة على الصفحات المهمة لتعود إليها بنقرة.</p>}
    </div>
  );
}

export function NotesPanel({ notes, visible, onSave, onGo }) {
  const all = Object.entries(notes || {}).filter(([, v]) => v && v.trim()).map(([k, v]) => [Number(k), v]).sort((a, b) => a[0] - b[0]);
  return (
    <div className="ib-notes">
      {visible.map((p) => <NoteBox key={p} page={p} value={(notes || {})[p] || ''} onSave={onSave} />)}
      {all.length ? (
        <>
          <h4 className="ib-notes__h">كل ملاحظاتي في هذا الكتاب</h4>
          <ul className="ib-notes__list">
            {all.map(([p, v]) => (
              <li key={p}><button type="button" onClick={() => onGo(p)}><b>صفحة {p}</b><span>{v.length > 90 ? `${v.slice(0, 90)}…` : v}</span></button></li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function NoteBox({ page, value, onSave }) {
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(true);
  useEffect(() => { setV(value); setSaved(true); }, [page]);
  useEffect(() => {
    if (saved) return undefined;
    const t = setTimeout(() => { onSave(page, v); setSaved(true); }, 500);
    return () => clearTimeout(t);
  }, [v, saved]);
  return (
    <label className="ib-note">
      <span>ملاحظاتي على صفحة {page} <small className="muted">{saved ? 'محفوظة ✓' : 'جارٍ الحفظ…'}</small></span>
      <textarea rows={4} value={v} onChange={(e) => { setV(e.target.value); setSaved(false); }} placeholder="اكتب ما تريد تذكّره عند شرح هذه الصفحة (لا يظهر على الكتاب)" />
    </label>
  );
}
