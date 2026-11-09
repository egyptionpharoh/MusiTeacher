'use client';
// «الكتاب التفاعلي الذكي 📖»: مكتبتي الرقمية + رفع PDF وتحويله إلى كتاب + القارئ.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './icons.js';
import BookReader from './BookReader.js';
import { makeLibrary, storageInfo, askPersist } from '../core/storage.js';
import { processPdf } from '../core/process.js';
import { LIMITS, loadPdfjs } from '../core/pdf.js';
import './interactive-book.css';

const fmtDate = (t) => { try { return new Intl.DateTimeFormat('ar-OM-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(t)); } catch { return new Date(t).toLocaleDateString(); } };
const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} م.ب` : `${Math.max(1, Math.round(b / 1024))} ك.ب`);

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const upd = () => setDark(el.classList.contains('dark'));
    upd();
    const mo = new MutationObserver(upd); mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

function Cover({ lib, book }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let u = null; let alive = true;
    lib.getThumb(book.id, 1).then((b) => { if (b && alive) { u = URL.createObjectURL(b); setUrl(u); } });
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [lib, book.id]);
  return <div className="ib-card__cover">{url ? <img src={url} alt="" draggable={false} /> : <Icon name="book" size={40} />}</div>;
}

export default function InteractiveBookApp({ getUserId, backHref = '/dashboard/tools', onBack }) {
  const dark = useDark();
  const [lib, setLib] = useState(null);
  const [books, setBooks] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [job, setJob] = useState(null); // { name, stage, done, total }
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [over, setOver] = useState(false);
  const [space, setSpace] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const uid = getUserId ? await getUserId() : null;
      if (!alive) return;
      const l = makeLibrary(uid || 'guest');
      setLib(l);
      try { setBooks(await l.list()); } catch { setBooks([]); setError('تعذّر فتح مكتبة الكتب على هذا المتصفح (قد يكون التصفح الخاص مفعّلًا).'); }
      setSpace(await storageInfo());
      loadPdfjs().catch(() => {}); // تجهيز محرك العرض مبكرًا
    })();
    return () => { alive = false; };
  }, [getUserId]);

  const refresh = useCallback(async () => { if (lib) { setBooks(await lib.list()); setSpace(await storageInfo()); } }, [lib]);

  const handleFile = async (file) => {
    if (!lib || job) return;
    setError(''); setNotice('');
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setJob({ name: file.name, stage: 'check', done: 0, total: 0 });
    try {
      const info = await storageInfo();
      if (info && info.quota && info.quota - info.usage < file.size * 1.3) {
        throw Object.assign(new Error('المساحة المتاحة للمتصفح على هذا الجهاز لا تكفي لهذا الكتاب. احذف كتبًا لا تحتاجها ثم أعد المحاولة.'), { code: 'space' });
      }
      const { book, texts, thumbs } = await processPdf(file, {
        signal: ctrl.signal,
        findDuplicate: (hash) => lib.findByHash(hash),
        onProgress: (p) => setJob((j) => ({ ...j, ...p })),
      });
      await lib.add(book, file, texts, thumbs);
      askPersist();
      await refresh();
      setJob(null);
      setOpenId(book.id); // يفتح الكتاب مباشرة بعد التجهيز
    } catch (e) {
      setJob(null);
      if (e.code === 'duplicate' && e.book) { setNotice(`${e.message} فتحناه لك.`); setOpenId(e.book.id); return; }
      if (e.code === 'aborted') { setNotice('أُلغيت إضافة الكتاب.'); return; }
      setError(e.name === 'QuotaExceededError' ? 'امتلأت مساحة التخزين في المتصفح. احذف كتبًا لا تحتاجها ثم أعد المحاولة.' : (e.message || 'تعذّر تجهيز الكتاب.'));
    } finally { abortRef.current = null; }
  };

  const onDrop = (e) => {
    e.preventDefault(); setOver(false);
    const f = [...(e.dataTransfer.files || [])][0];
    if (f) handleFile(f);
  };

  const remove = async (b) => {
    if (!window.confirm(`حذف «${b.name}» من مكتبتك؟\nستُحذف معه رسوماتك وملاحظاتك وعلاماته المرجعية على هذا الجهاز، ولا يمكن التراجع.`)) return;
    await lib.remove(b.id);
    setNotice(`حُذف «${b.name}».`);
    refresh();
  };

  const saveRename = async (e) => {
    e.preventDefault();
    const name = renaming.value.trim().slice(0, 120);
    if (name) await lib.rename(renaming.id, name);
    setRenaming(null); refresh();
  };

  if (openId && lib) {
    return (
      <div className={`ib-app ${dark ? 'ib-dark' : ''}`}>
        <BookReader key={openId} lib={lib} bookId={openId} onClose={() => { setOpenId(null); refresh(); }} />
      </div>
    );
  }

  const pct = job && job.total ? Math.round((job.done / job.total) * 100) : 0;
  const back = () => { if (onBack) onBack(); else window.location.href = backHref; };

  return (
    <div className={`ib-app ${dark ? 'ib-dark' : ''}`} dir="rtl">
      <div className="ib-home">
        <header className="ib-home__head">
          <button type="button" className="ib-backbtn" onClick={back}><Icon name="back" size={18} /> أدوات المعلم</button>
          <div className="ib-home__title">
            <span className="ib-home__logo"><Icon name="book" size={30} /></span>
            <div>
              <h1>الكتاب التفاعلي الذكي <span aria-hidden="true">📖</span></h1>
              <p>حوّل أي ملف PDF إلى كتاب تقلّب صفحاته وتشرح عليه أمام طلابك.</p>
            </div>
          </div>
        </header>

        <section
          className={`ib-drop ${over ? 'is-over' : ''} ${job ? 'is-busy' : ''}`}
          onDragOver={(e) => { e.preventDefault(); if (!job) setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          onClick={() => { if (!job && inputRef.current) inputRef.current.click(); }}
          role="button" tabIndex={0} aria-label="اختر ملف PDF أو اسحبه هنا"
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !job) { e.preventDefault(); inputRef.current.click(); } }}
        >
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) handleFile(f); }} />
          {!job ? (
            <>
              <span className="ib-drop__icon"><Icon name="upload" size={34} /></span>
              <b>اسحب ملف PDF وأفلته هنا</b>
              <span>أو اضغط لاختيار الملف من جهازك</span>
              <small>حتى {LIMITS.maxBytes / 1048576} ميغابايت و{LIMITS.maxPages} صفحة · يبقى الملف على جهازك وفي حسابك فقط</small>
            </>
          ) : (
            <div className="ib-job" onClick={(e) => e.stopPropagation()} role="status" aria-live="polite">
              <b className="ib-job__name">{job.name}</b>
              <span>{job.stage === 'pages' ? `جارٍ تجهيز الصفحات: ${job.done} من ${job.total}` : job.stage === 'save' ? 'جارٍ الحفظ في مكتبتك…' : 'جارٍ فحص الملف…'}</span>
              <div className="ib-job__bar"><i style={{ width: `${job.stage === 'save' ? 100 : pct}%` }} /></div>
              <span className="ib-job__pct">{job.stage === 'pages' ? `${pct}٪` : ''}</span>
              {job.stage === 'pages' ? <button type="button" className="ib-btn ib-btn--ghost" onClick={() => abortRef.current && abortRef.current.abort()}>إلغاء</button> : null}
            </div>
          )}
        </section>

        {error ? <div className="ib-alert" role="alert">{error}</div> : null}
        {notice ? <div className="ib-alert ib-alert--ok" role="status">{notice}</div> : null}

        <section className="ib-lib" aria-labelledby="ib-lib-h">
          <div className="ib-lib__head">
            <h2 id="ib-lib-h"><Icon name="library" size={20} /> مكتبتي الرقمية</h2>
            {space && space.quota ? <span className="ib-lib__space">المساحة المستخدمة: {fmtSize(space.usage)} من {fmtSize(space.quota)}</span> : null}
          </div>
          {books === null ? <p className="ib-muted">جارٍ تحميل مكتبتك…</p> : null}
          {books && !books.length ? <p className="ib-empty">مكتبتك فارغة. أضف أول كتاب من الأعلى، وسيبقى هنا لتفتحه في أي حصة.</p> : null}
          <div className="ib-grid">
            {(books || []).map((b) => (
              <article key={b.id} className="ib-card">
                <button type="button" className="ib-card__open" onClick={() => setOpenId(b.id)} aria-label={`فتح ${b.name}`}>
                  <Cover lib={lib} book={b} />
                </button>
                <div className="ib-card__body">
                  {renaming && renaming.id === b.id ? (
                    <form onSubmit={saveRename} className="ib-rename">
                      <input autoFocus value={renaming.value} maxLength={120} onChange={(e) => setRenaming({ ...renaming, value: e.target.value })} aria-label="الاسم الجديد" />
                      <button type="submit" className="ib-btn">حفظ</button>
                      <button type="button" className="ib-btn ib-btn--ghost" onClick={() => setRenaming(null)}>إلغاء</button>
                    </form>
                  ) : <h3 title={b.name}>{b.name}</h3>}
                  <p className="ib-card__meta">{b.pages} صفحة · {fmtSize(b.size)} · أُضيف {fmtDate(b.createdAt)}</p>
                  {b.lastPage > 1 ? (
                    <div className="ib-card__prog" title={`وصلت إلى صفحة ${b.lastPage}`}><i style={{ width: `${Math.round((b.lastPage / b.pages) * 100)}%` }} /></div>
                  ) : null}
                  {b.scanned ? <p className="ib-card__tag">صفحات ممسوحة ضوئيًا (البحث غير متاح)</p> : null}
                  <div className="ib-card__actions">
                    <button type="button" className="ib-btn" onClick={() => setOpenId(b.id)}>{b.lastPage > 1 ? `متابعة من صفحة ${b.lastPage}` : 'فتح الكتاب'}</button>
                    <button type="button" className="ib-tb" data-tip="إعادة التسمية" aria-label="إعادة التسمية" onClick={() => setRenaming({ id: b.id, value: b.name })}><Icon name="edit" size={18} /></button>
                    <button type="button" className="ib-tb ib-tb--danger" data-tip="حذف" aria-label="حذف" onClick={() => remove(b)}><Icon name="trash" size={18} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="ib-privacy"><Icon name="eye" size={14} /> الكتب محفوظة في هذا المتصفح على هذا الجهاز فقط، ومنفصلة لكل حساب. لا تُرفع إلى أي خادم ولا يراها غيرك.</p>
        </section>
      </div>
    </div>
  );
}
