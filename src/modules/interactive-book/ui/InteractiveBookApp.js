'use client';
// «الكتاب التفاعلي الذكي 📖»: مكتبتي الرقمية + رفع PDF وتحويله إلى كتاب + القارئ.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './icons.js';
import BookReader from './BookReader.js';
import TeacherGuides from './TeacherGuides.js';
import { gradeLabel } from '../data/teacherGuides.js';
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
  const [tab, setTab] = useState('library');        // 'library' مكتبتي التفاعلية | 'guides' أدلة المعلم الرقمية
  const [libFilter, setLibFilter] = useState('all'); // all | guides | others
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

  // رابط مباشر إلى قسم الأدلة: ‎?tab=guides
  useEffect(() => { try { if (new URLSearchParams(window.location.search).get('tab') === 'guides') setTab('guides'); } catch { /* */ } }, []);

  const refresh = useCallback(async () => { if (lib) { setBooks(await lib.list()); setSpace(await storageInfo()); } }, [lib]);

  /**
   * يحوّل ملف PDF إلى كتاب في المكتبة. meta (اختياري) لأدلة المعلم: { kind: 'guide', grade, replace: كتاب قديم يُستبدل }
   * يعيد true عند النجاح.
   */
  const handleFile = async (file, meta = null) => {
    if (!lib || job) return false;
    setError(''); setNotice('');
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setJob({ name: file.name, stage: 'check', done: 0, total: 0, meta });
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
      if (meta && meta.replace) {                    // الاستبدال: يبقى الاسم والصف، ويتغيّر الملف
        book.name = meta.replace.name; book.kind = meta.replace.kind || null; book.grade = meta.replace.grade || null;
      } else if (meta && meta.kind === 'guide') { book.kind = 'guide'; book.grade = meta.grade || null; }
      await lib.add(book, file, texts, thumbs);
      if (meta && meta.replace) await lib.remove(meta.replace.id); // لا يُحذف القديم إلا بعد حفظ الجديد بنجاح
      askPersist();
      await refresh();
      setJob(null);
      if (meta && meta.replace) setNotice(`استُبدل ملف «${book.name}» بنجاح.`);
      else if (meta && meta.kind === 'guide') setNotice(`أُضيف «${book.name}» إلى مكتبتك كدليل ${gradeLabel(book.grade)}. يمكنك فتحه الآن من «أدلتي في المكتبة» أو من «مكتبتي التفاعلية».`);
      else setOpenId(book.id); // يفتح الكتاب مباشرة بعد التجهيز
      return true;
    } catch (e) {
      setJob(null);
      if (e.code === 'duplicate' && e.book) {
        if (meta && meta.replace) { setError(e.book.id === meta.replace.id ? 'هذا هو الملف نفسه الموجود حاليًا؛ لم يتغير شيء.' : `${e.message} لم يُستبدل الملف.`); return false; }
        if (meta && meta.kind === 'guide') {
          await lib.setMeta(e.book.id, { kind: 'guide', grade: meta.grade });
          await refresh();
          setNotice(`${e.message} صنّفناه دليلًا لـ${gradeLabel(meta.grade)}.`);
          return true;
        }
        setNotice(`${e.message} فتحناه لك.`); setOpenId(e.book.id); return true;
      }
      if (e.code === 'aborted') { setNotice('أُلغيت إضافة الكتاب.'); return false; }
      setError(e.name === 'QuotaExceededError' ? 'امتلأت مساحة التخزين في المتصفح. احذف كتبًا لا تحتاجها ثم أعد المحاولة.' : (e.message || 'تعذّر تجهيز الكتاب.'));
      return false;
    } finally { abortRef.current = null; }
  };

  const regrade = async (b, value) => {
    await lib.setMeta(b.id, { kind: 'guide', grade: value ? Number(value) : null });
    setNotice(value ? `صُنّف «${b.name}» دليلًا لـ${gradeLabel(value)}.` : `أُزيل تصنيف الصف عن «${b.name}».`);
    refresh();
  };
  const replaceFile = (b, file) => {
    if (!window.confirm(`استبدال ملف «${b.name}» بالملف الجديد «${file.name}»؟\nستُحذف رسوماتك وملاحظاتك وعلاماتك على النسخة القديمة لأن صفحات الملف قد تختلف.`)) return;
    handleFile(file, { replace: b });
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

  return (
    <div className={`ib-app ib-page ${dark ? 'ib-dark' : ''}`} dir="rtl">
      <div className="ib-home">
        <header className="ib-home__head">
          {/* الرجوع إلى «الأدوات» والشعار في شريط التنقل الموحد أعلى الصفحة (src/components/tools-nav) */}
          <div className="ib-home__title">
            <span className="ib-home__logo"><Icon name="book" size={30} /></span>
            <div>
              <h1>الكتاب التفاعلي الذكي <span aria-hidden="true">📖</span></h1>
              <p>حوّل أي ملف PDF إلى كتاب تقلّب صفحاته وتشرح عليه أمام طلابك.</p>
            </div>
          </div>
        </header>

        <nav className="ib-tabs" role="tablist" aria-label="أقسام الكتاب التفاعلي"
          onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setTab((t) => (t === 'library' ? 'guides' : 'library')); } }}>
          <button type="button" role="tab" id="ib-tab-library" aria-controls="ib-panel-library" aria-selected={tab === 'library'} tabIndex={tab === 'library' ? 0 : -1}
            className={`ib-tab ${tab === 'library' ? 'is-on' : ''}`} onClick={() => setTab('library')}>
            <Icon name="library" size={19} /> مكتبتي التفاعلية
          </button>
          <button type="button" role="tab" id="ib-tab-guides" aria-controls="ib-panel-guides" aria-selected={tab === 'guides'} tabIndex={tab === 'guides' ? 0 : -1}
            className={`ib-tab ${tab === 'guides' ? 'is-on' : ''}`} onClick={() => setTab('guides')}>
            <Icon name="book" size={19} /> أدلة المعلم الرقمية
          </button>
        </nav>

        {error ? <div className="ib-alert" role="alert">{error}</div> : null}
        {notice ? <div className="ib-alert ib-alert--ok" role="status">{notice}</div> : null}

        {tab === 'guides' ? (
          <div role="tabpanel" id="ib-panel-guides" aria-labelledby="ib-tab-guides">
            <TeacherGuides job={job} guides={(books || []).filter((b) => b.kind === 'guide')}
              onAdd={(file, m) => handleFile(file, { kind: 'guide', grade: m.grade })}
              onOpen={(id) => setOpenId(id)} onRemove={remove} onRegrade={regrade} onReplace={replaceFile} />
          </div>
        ) : (
        <div role="tabpanel" id="ib-panel-library" aria-labelledby="ib-tab-library">
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

        <section className="ib-lib" aria-labelledby="ib-lib-h">
          <div className="ib-lib__head">
            <h2 id="ib-lib-h"><Icon name="library" size={20} /> مكتبتي الرقمية</h2>
            {space && space.quota ? <span className="ib-lib__space">المساحة المستخدمة: {fmtSize(space.usage)} من {fmtSize(space.quota)}</span> : null}
          </div>
          {books === null ? <p className="ib-muted">جارٍ تحميل مكتبتك…</p> : null}
          {books && !books.length ? <p className="ib-empty">مكتبتك فارغة. أضف أول كتاب من الأعلى، وسيبقى هنا لتفتحه في أي حصة.</p> : null}
          {books && books.some((b) => b.kind === 'guide') ? (
            <div className="ib-chips" role="group" aria-label="تصفية المكتبة">
              {[['all', 'الكل'], ['guides', 'أدلة المعلم'], ['others', 'كتب أخرى']].map(([k, l]) => (
                <button key={k} type="button" className={`ib-chip ${libFilter === k ? 'is-on' : ''}`} aria-pressed={libFilter === k} onClick={() => setLibFilter(k)}>{l}</button>
              ))}
            </div>
          ) : null}
          <div className="ib-grid">
            {(books || []).filter((b) => libFilter === 'all' || (libFilter === 'guides' ? b.kind === 'guide' : b.kind !== 'guide')).map((b) => (
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
                  {b.kind === 'guide' ? <p className="ib-card__guide"><Icon name="book" size={13} /> دليل المعلم{b.grade ? ` · ${gradeLabel(b.grade)}` : ''}</p> : null}
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
        )}
      </div>
    </div>
  );
}
