'use client';
// «الرسائل والاقتراحات السرية» — لوحة المدير. كل الطلبات تمر بتحقق الخادم (توكن + بريد المدير + role=admin).
// الرسائل لا تحتوي أي بيانات عن المرسل؛ تظهر هنا: النص، الموضوع، الحالة، ويوم الاستلام فقط.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CATEGORIES, STATUSES, categoryLabel, statusLabel } from '@/lib/suggestions/categories';
import './suggestions.css';

const API = '/api/admin/suggestions';
const fmtDay = (d) => { try { const [y, m, dd] = d.split('-').map(Number); return new Intl.DateTimeFormat('ar-OM-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, dd))); } catch { return d; } };

export default function SuggestionsAdmin({ getToken }) {
  const [view, setView] = useState('inbox');     // inbox | archived
  const [filter, setFilter] = useState('all');   // all | new | read | review | done
  const [cat, setCat] = useState('all');
  const [data, setData] = useState(null);        // { items, counts }
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const call = useCallback(async (method, body, query = '') => {
    const token = await getToken();
    const r = await fetch(API + query, {
      method, cache: 'no-store',
      headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || 'تعذّر تنفيذ الطلب.');
    return j;
  }, [getToken]);

  const load = useCallback(async () => {
    setError('');
    try { const j = await call('GET', null, view === 'archived' ? '?view=archived' : ''); setData({ items: j.items, counts: j.counts }); }
    catch (e) { setError(e.message); setData((d) => d || { items: [], counts: null }); }
  }, [call, view]);
  useEffect(() => { setData(null); setOpenId(null); load(); }, [load]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const items = useMemo(() => (data ? data.items.filter((x) => (filter === 'all' || x.status === filter) && (cat === 'all' || x.category === cat)) : []), [data, filter, cat]);
  const open = items.find((x) => x.id === openId) || (data && data.items.find((x) => x.id === openId)) || null;

  const patch = async (item, p, msg) => {
    setBusy(true);
    try {
      await call('PATCH', { id: item.id, ...p });
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === item.id ? { ...x, ...p } : x)).filter((x) => (view === 'archived' ? x.archived : !x.archived)) }));
      if ('archived' in p) setOpenId(null);
      if (msg) flash(msg);
      load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = async (item) => {
    if (!window.confirm('حذف هذه الرسالة نهائيًا؟ لا يمكن التراجع عن الحذف.')) return;
    setBusy(true);
    try { await call('DELETE', { id: item.id }); setOpenId(null); flash('حُذفت الرسالة.'); load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const openItem = (x) => { setOpenId(x.id); if (x.status === 'new') patch(x, { status: 'read' }); };

  const c = (data && data.counts) || {};
  return (
    <div className="sg-admin" dir="rtl">
      <header className="sg-admin__head">
        <div>
          <h1>الرسائل والاقتراحات السرية</h1>
          <p>رسائل المعلمين إلى إدارة MusiTeacher — بلا أسماء ولا بريد ولا معرّفات حسابات.</p>
        </div>
        <button type="button" className="sg-btn sg-btn--ghost" onClick={load} disabled={busy}>↻ تحديث</button>
      </header>

      <nav className="sg-tabs" role="tablist" aria-label="عرض الرسائل">
        <button type="button" role="tab" aria-selected={view === 'inbox'} className={view === 'inbox' ? 'is-on' : ''} onClick={() => setView('inbox')}>الوارد <b>{c.inbox ?? '…'}</b></button>
        <button type="button" role="tab" aria-selected={view === 'archived'} className={view === 'archived' ? 'is-on' : ''} onClick={() => setView('archived')}>الأرشيف <b>{c.archived ?? '…'}</b></button>
      </nav>

      <div className="sg-filters">
        <div className="sg-filters__row" role="group" aria-label="تصفية حسب الحالة">
          <button type="button" className={`sg-chip ${filter === 'all' ? 'is-on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>الكل</button>
          {STATUSES.map((s) => (
            <button key={s.id} type="button" className={`sg-chip sg-st-${s.id} ${filter === s.id ? 'is-on' : ''}`} aria-pressed={filter === s.id} onClick={() => setFilter(s.id)}>
              {s.label}{view === 'inbox' && c[s.id] !== undefined ? <b>{c[s.id]}</b> : null}
            </button>
          ))}
        </div>
        <label className="sg-filters__cat">الموضوع
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">كل المواضيع</option>
            {CATEGORIES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
      </div>

      {error ? <p className="sg-error" role="alert">{error}</p> : null}
      {toast ? <p className="sg-toast" role="status">{toast}</p> : null}
      {!data ? <p className="sg-muted">جارٍ تحميل الرسائل…</p> : null}
      {data && !items.length ? <p className="sg-empty">{view === 'archived' ? 'لا توجد رسائل مؤرشفة.' : 'لا توجد رسائل هنا بعد.'}</p> : null}

      <div className="sg-layout">
        <ul className="sg-list" aria-label="قائمة الرسائل">
          {items.map((x) => (
            <li key={x.id}>
              <button type="button" className={`sg-item ${openId === x.id ? 'is-open' : ''} ${x.status === 'new' ? 'is-new' : ''}`} onClick={() => openItem(x)} aria-expanded={openId === x.id}>
                <span className="sg-item__top">
                  <span className={`sg-badge sg-st-${x.status}`}>{statusLabel(x.status)}</span>
                  <span className="sg-item__cat">{categoryLabel(x.category)}</span>
                  <span className="sg-item__day">{fmtDay(x.day)}</span>
                </span>
                <span className="sg-item__body">{x.body}</span>
              </button>
            </li>
          ))}
        </ul>

        {open ? (
          <article className="sg-detail" aria-label="نص الرسالة">
            <div className="sg-detail__meta">
              <span className={`sg-badge sg-st-${open.status}`}>{statusLabel(open.status)}</span>
              <span>{categoryLabel(open.category)}</span>
              <span>· استُلمت في {fmtDay(open.day)}</span>
              <button type="button" className="sg-x" aria-label="إغلاق" onClick={() => setOpenId(null)}>✕</button>
            </div>
            <div className="sg-detail__body">{open.body}</div>
            <div className="sg-detail__acts" role="group" aria-label="حالة الرسالة">
              {STATUSES.filter((s) => s.id !== 'new').map((s) => (
                <button key={s.id} type="button" className={`sg-btn sg-btn--sm ${open.status === s.id ? 'is-current' : 'sg-btn--ghost'}`} disabled={busy || open.status === s.id}
                  onClick={() => patch(open, { status: s.id }, `أصبحت الحالة: ${s.label}`)}>{s.label}</button>
              ))}
            </div>
            <div className="sg-detail__acts">
              <button type="button" className="sg-btn sg-btn--sm sg-btn--ghost" disabled={busy} onClick={() => patch(open, { archived: !open.archived }, open.archived ? 'أُعيدت الرسالة إلى الوارد.' : 'أُرشفت الرسالة.')}>
                {open.archived ? 'إعادة إلى الوارد' : 'أرشفة'}
              </button>
              <button type="button" className="sg-btn sg-btn--sm sg-btn--danger" disabled={busy} onClick={() => remove(open)}>حذف نهائي</button>
            </div>
          </article>
        ) : null}
      </div>
      <p className="sg-admin__privacy">🔒 لا تُحفظ مع الرسائل أي بيانات عن المرسل (لا حساب ولا بريد ولا عنوان IP ولا وقت دقيق). هذه الصفحة وبياناتها محمية على الخادم لمدير المنصة فقط.</p>
    </div>
  );
}
