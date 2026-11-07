'use client';
// 📚 بنك أغلفة السجلات — استوديو لاختيار الغلاف وتخصيصه وتصديره Word حقيقيًا قابلًا للتعديل.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import CoverPage from './CoverPage';
import { DESIGNS, STYLES, FONTS, getDesign, variantCount } from '@/lib/cover-studio/designs';
import { RECORDS, RECORD_GROUPS, SUBJECTS, SEMESTERS, ROLES, GOVERNORATES, getRecord, defaultData } from '@/lib/cover-studio/records';
import { buildCover } from '@/lib/cover-studio/layout';
import { measure, clearMeasureCache, normalizeImage, loadImage, exportDocx, downloadBlob, safeFileName } from '@/lib/cover-studio/browser';
import './cover-studio.css';

const PROFILE_KEY = 'mt-covers:profile';
const FAV_KEY = 'mt-covers:favorites';
const OFFICIAL_EMBLEM = '/brand/oman-emblem.png';
const BRAND_LOGO = '/logo.png';
const PERSIST = ['subject', 'governorate', 'school', 'year', 'semester', 'role', 'teacher', 'grade', 'logoPos', 'schoolLogo', 'emblem', 'recordId'];

const ls = {
  get(k, d) { try { const v = window.localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

const I = {
  back: 'M9 6l6 6-6 6',
  word: 'M4 4h11l5 5v11H4zM14 4v6h6M7.5 13l1.5 5 1.5-4 1.5 4 1.5-5',
  print: 'M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
  layers: 'M12 3 3 8l9 5 9-5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  prev: 'M15 6l-6 6 6 6', next: 'M9 6l6 6-6 6',
  check: 'M5 12.5 10 17l9-10', x: 'M6 6l12 12M18 6 6 18', info: 'M12 8v.5M12 11v5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};
const Icon = ({ d, size = 18, fill }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

function useFontsReady() {
  const [v, setV] = useState(0);
  useEffect(() => {
    let alive = true;
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (alive) { clearMeasureCache(); setV((x) => x + 1); } });
    }
    return () => { alive = false; };
  }, []);
  return v;
}

/** عرض عنصر يُراقَب عند ظهوره (callback ref) */
function useWidth() {
  const [w, setW] = useState(0);
  const [node, setNode] = useState(null);
  useEffect(() => {
    if (!node) return undefined;
    setW(node.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [w, setNode];
}

// ======================================================================================
export default function CoverStudio() {
  const fontsV = useFontsReady();
  const [data, setData] = useState(() => defaultData(new Date()));
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState('library'); // library | studio
  const [designId, setDesignId] = useState(DESIGNS[0].id);
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [cardPalettes, setCardPalettes] = useState({});
  const [style, setStyle] = useState('all');
  const [favs, setFavs] = useState([]);
  const [official, setOfficial] = useState(null);   // شعار السلطنة من المنصة
  const [brand, setBrand] = useState(null);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState(null);
  const [setOpen, setSetOpen] = useState(false);
  const [setRecords, setSetRecords] = useState(['grades', 'attendance', 'formative', 'activities']);
  const [zoom, setZoom] = useState('fit');
  const [printModels, setPrintModels] = useState([]);
  const [previewW, previewRef] = useWidth();
  const [gridW, gridRef] = useWidth();

  // ---------- استرجاع البيانات المحفوظة
  useEffect(() => {
    const saved = ls.get(PROFILE_KEY, null);
    if (saved && typeof saved === 'object') setData((d) => { const o = { ...d }; for (const k of PERSIST) if (saved[k] !== undefined) o[k] = saved[k]; return o; });
    setFavs(ls.get(FAV_KEY, []));
    setLoaded(true);
    (async () => {
      try { const r = await fetch(OFFICIAL_EMBLEM, { method: 'HEAD', cache: 'no-store' }); if (r.ok && /image/.test(r.headers.get('content-type') || '')) { const im = await loadImage(OFFICIAL_EMBLEM); setOfficial({ src: OFFICIAL_EMBLEM, w: im.naturalWidth, h: im.naturalHeight }); } } catch { /* غير متوفر */ }
      try { const im = await loadImage(BRAND_LOGO); setBrand({ src: BRAND_LOGO, w: im.naturalWidth, h: im.naturalHeight }); } catch { /* */ }
    })();
  }, []);
  useEffect(() => {
    if (!loaded) return undefined;
    const t = setTimeout(() => {
      const o = {}; for (const k of PERSIST) o[k] = data[k];
      if (!ls.set(PROFILE_KEY, o)) { delete o.schoolLogo; delete o.emblem; ls.set(PROFILE_KEY, o); }
    }, 400);
    return () => clearTimeout(t);
  }, [data, loaded]);

  const set = (k) => (e) => { const v = e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e; setData((d) => ({ ...d, [k]: v })); };
  const notify = (text, kind = 'ok') => { setToast({ text, kind }); setTimeout(() => setToast(null), 4200); };

  const emblem = official || data.emblem || null;
  const images = useMemo(() => ({ emblem, school: data.schoolLogo || null, brand }), [emblem, data.schoolLogo, brand]);
  const rec = getRecord(data.recordId);
  const effData = useMemo(() => ({ ...data, showSubject: data.customTitle ? data.showSubject !== false : (data.showSubjectFor === data.recordId ? data.showSubject : rec.subject) }), [data, rec]);
  const modelFor = useCallback((id, pi, d = effData) => buildCover({ designId: id, paletteIdx: pi, data: d, images, measure }), [effData, images, fontsV]); // eslint-disable-line react-hooks/exhaustive-deps

  const design = getDesign(designId);
  const model = useMemo(() => modelFor(designId, paletteIdx), [modelFor, designId, paletteIdx]);

  const favKey = (id, pi) => `${id}:${pi}`;
  const isFav = (id, pi) => favs.includes(favKey(id, pi));
  const toggleFav = (id, pi) => {
    const k = favKey(id, pi);
    const next = favs.includes(k) ? favs.filter((x) => x !== k) : [...favs, k];
    setFavs(next); ls.set(FAV_KEY, next);
  };

  const shown = useMemo(() => {
    if (style === 'favorites') return favs.map((k) => { const [id, pi] = k.split(':'); return { d: getDesign(id), pi: +pi || 0 }; }).filter((x) => x.d && x.d.id === x.d.id);
    return DESIGNS.filter((d) => style === 'all' || d.style === style).map((d) => ({ d, pi: cardPalettes[d.id] || 0 }));
  }, [style, favs, cardPalettes]);

  const openDesign = (id, pi) => { setDesignId(id); setPaletteIdx(pi); setView('studio'); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const step = (dir) => {
    const list = DESIGNS; const i = list.findIndex((d) => d.id === designId);
    const n = list[(i + dir + list.length) % list.length]; setDesignId(n.id); setPaletteIdx(0);
  };

  // ---------- الصور
  const uploadTo = (key) => async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { notify('اختر ملف صورة (PNG أو JPG أو SVG).', 'err'); return; }
    if (f.size > 8 * 1024 * 1024) { notify('حجم الصورة كبير جدًا (الحد 8MB).', 'err'); return; }
    try { const img = await normalizeImage(f, key === 'emblem' ? 900 : 700); setData((d) => ({ ...d, [key]: img })); notify(key === 'emblem' ? 'أُضيف شعار السلطنة.' : 'أُضيف شعار المدرسة.'); }
    catch { notify('تعذّرت قراءة الصورة. جرّب ملف PNG أو JPG.', 'err'); }
  };

  // ---------- التصدير
  const recordTitle = (d = effData) => (d.customTitle ? d.customTitle.replace(/[|/]/g, ' ') : getRecord(d.recordId).title.join(' '));
  const doWord = async () => {
    if (busy) return;
    setBusy('word');
    try {
      const blob = await exportDocx([model], images, recordTitle());
      downloadBlob(blob, safeFileName(`غلاف ${recordTitle()} - ${design.name}`) + '.docx');
      notify(images.emblem ? 'نُزّل ملف Word. افتحه وعدّل أي نص بالنقر عليه.' : 'نُزّل ملف Word بدون شعار السلطنة (غير مرفوع بعد).');
    } catch (err) { console.error(err); notify('تعذّر إنشاء ملف Word. أعد المحاولة.', 'err'); }
    finally { setBusy(''); }
  };
  const setModels = () => setRecords.map((rid) => {
    const r = getRecord(rid);
    return modelFor(designId, paletteIdx, { ...effData, recordId: rid, customTitle: '', showSubject: r.subject });
  });
  const doSetWord = async () => {
    if (busy || !setRecords.length) return;
    setBusy('set');
    try {
      const blob = await exportDocx(setModels(), images, 'مجموعة أغلفة السجلات');
      downloadBlob(blob, safeFileName(`مجموعة أغلفة (${setRecords.length}) - ${design.name}`) + '.docx');
      notify(`نُزّل ملف Word فيه ${setRecords.length} أغلفة متناسقة، كل غلاف في صفحة.`);
      setSetOpen(false);
    } catch (err) { console.error(err); notify('تعذّر إنشاء المجموعة. أعد المحاولة.', 'err'); }
    finally { setBusy(''); }
  };
  // الطباعة في إطار مستقل يحوي الأغلفة فقط (A4 بلا هوامش) — ومنه «حفظ بصيغة PDF»
  const printRef = useRef(null);
  const doPrint = (models) => { setPrintModels(models); };
  useEffect(() => {
    if (!printModels.length || !printRef.current) return undefined;
    const t = setTimeout(() => {
      const html = printRef.current.innerHTML;
      const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join('');
      const fr = document.createElement('iframe');
      fr.setAttribute('aria-hidden', 'true');
      fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
      document.body.appendChild(fr);
      const doc = fr.contentDocument;
      doc.open();
      doc.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${safeFileName('غلاف ' + recordTitle())}</title><base href="${location.origin}/">${styles}<style>@page{size:A4;margin:0}html,body{margin:0!important;padding:0!important;background:#fff!important}body *{visibility:visible!important}.cs-page-wrap{width:210mm!important;height:297mm!important;break-after:page;page-break-after:always;overflow:hidden}.cs-page-wrap:last-child{break-after:auto;page-break-after:auto}</style></head><body>${html}</body></html>`);
      doc.close();
      const go = async () => {
        try { await Promise.all([...doc.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })))); if (doc.fonts) await doc.fonts.ready; } catch { /* */ }
        fr.contentWindow.focus(); fr.contentWindow.print();
        setTimeout(() => { fr.remove(); setPrintModels([]); }, 1500);
      };
      if (doc.readyState === 'complete') go(); else fr.onload = go;
    }, 120);
    return () => clearTimeout(t);
  }, [printModels]); // eslint-disable-line react-hooks/exhaustive-deps

  // عرض المصغّرات يتبع عرض الشبكة (عمودان على الهاتف)
  const thumbW = gridW && gridW < 600 ? Math.max(110, Math.floor((gridW - 12) / 2) - 18) : 168;
  const fitW = Math.max(240, Math.min(previewW - 32, 620));
  const pageW = zoom === 'real' ? (210 / 25.4) * 96 : fitW;
  const missingEmblem = !emblem;

  return (
    <div className="cs-root" dir="rtl">
      <div className="cs-shell">
        <div className="cs-topbar">
          <Link href="/dashboard/tools" className="cs-back"><Icon d={I.back} />أدوات المعلم</Link>
          {view === 'studio' && <button type="button" className="cs-back" onClick={() => setView('library')}><Icon d={I.grid} />كل التصميمات</button>}
        </div>

        <header className="cs-head">
          <h1><span aria-hidden="true">📚</span> بنك أغلفة السجلات</h1>
          <p>اختر غلافًا من {DESIGNS.length} تصميمًا بـ{variantCount} لونًا، واكتب بيانات مدرستك مرة واحدة، ثم نزّله ملف Word قابلًا للتعديل والطباعة فورًا.</p>
        </header>

        {/* ===================== المكتبة ===================== */}
        {view === 'library' && (
          <section className="cs-library">
            <div className="cs-records" role="tablist" aria-label="نوع السجل">
              {RECORD_GROUPS.map((g) => (
                <div key={g.id} className="cs-rgroup">
                  <span className="cs-rgroup-label">{g.label}</span>
                  <div className="cs-chips">
                    {RECORDS.filter((r) => r.group === g.id).map((r) => (
                      <button key={r.id} type="button" role="tab" aria-selected={data.recordId === r.id && !data.customTitle}
                        className={`cs-chip ${data.recordId === r.id && !data.customTitle ? 'is-on' : ''}`}
                        onClick={() => setData((d) => ({ ...d, recordId: r.id, customTitle: '' }))}>{r.title.join(' ')}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="cs-styles" role="group" aria-label="الاتجاه الفني">
              <button type="button" className={`cs-pill ${style === 'all' ? 'is-on' : ''}`} onClick={() => setStyle('all')}>كل الاتجاهات</button>
              {STYLES.map((s) => <button key={s.id} type="button" className={`cs-pill ${style === s.id ? 'is-on' : ''}`} onClick={() => setStyle(s.id)}>{s.label}</button>)}
              <button type="button" className={`cs-pill cs-pill-fav ${style === 'favorites' ? 'is-on' : ''}`} onClick={() => setStyle('favorites')}><Icon d={I.heart} size={15} />المفضلة ({favs.length})</button>
            </div>
            {!data.school && <p className="cs-hint"><Icon d={I.info} size={16} />تظهر الأغلفة ببيانات تجريبية فارغة. افتح أي تصميم واكتب اسم مدرستك ومعلمها لتظهر في كل التصميمات.</p>}
            {style === 'favorites' && !favs.length && <p className="cs-empty">لم تُضف تصميمات إلى المفضلة بعد. اضغط ♡ على أي غلاف لحفظه هنا.</p>}
            <div className="cs-grid" ref={gridRef}>
              {shown.map(({ d, pi }) => {
                const m = modelFor(d.id, pi);
                return (
                  <article key={d.id + pi} className="cs-card">
                    <button type="button" className="cs-card-open" onClick={() => openDesign(d.id, pi)} aria-label={`فتح تصميم ${d.name}`}>
                      <CoverPage model={m} images={images} width={thumbW} />
                    </button>
                    <div className="cs-card-body">
                      <div className="cs-card-title">
                        <h3>{d.name}</h3>
                        <button type="button" className={`cs-fav ${isFav(d.id, pi) ? 'is-on' : ''}`} onClick={() => toggleFav(d.id, pi)} aria-pressed={isFav(d.id, pi)} aria-label="إضافة إلى المفضلة">
                          <Icon d={I.heart} size={17} fill={isFav(d.id, pi) ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                      <p>{d.desc}</p>
                      <div className="cs-swatches" role="radiogroup" aria-label="الألوان">
                        {d.palettes.map((p, i) => (
                          <button key={i} type="button" role="radio" aria-checked={pi === i} title={p.name} aria-label={p.name}
                            className={`cs-swatch ${pi === i ? 'is-on' : ''}`} style={{ background: `linear-gradient(135deg, ${p.paper} 0 45%, ${p.accent} 45% 75%, ${p.gold} 75%)` }}
                            onClick={() => (style === 'favorites' ? openDesign(d.id, i) : setCardPalettes((c) => ({ ...c, [d.id]: i })))} />
                        ))}
                        <span className="cs-style-tag">{(STYLES.find((s) => s.id === d.style) || {}).label}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* ===================== الاستوديو ===================== */}
        {view === 'studio' && (
          <section className="cs-studio">
            <div className="cs-stage" ref={previewRef}>
              <div className="cs-stage-bar">
                <div className="cs-stage-name">
                  <button type="button" className="cs-icon" onClick={() => step(-1)} aria-label="التصميم السابق"><Icon d={I.next} /></button>
                  <div><strong>{design.name}</strong><span>{design.desc}</span></div>
                  <button type="button" className="cs-icon" onClick={() => step(1)} aria-label="التصميم التالي"><Icon d={I.prev} /></button>
                </div>
                <div className="cs-stage-tools">
                  <div className="cs-swatches" role="radiogroup" aria-label="ألوان التصميم">
                    {design.palettes.map((p, i) => (
                      <button key={i} type="button" role="radio" aria-checked={paletteIdx === i} title={p.name} aria-label={p.name}
                        className={`cs-swatch cs-swatch-lg ${paletteIdx === i ? 'is-on' : ''}`} style={{ background: `linear-gradient(135deg, ${p.paper} 0 45%, ${p.accent} 45% 75%, ${p.gold} 75%)` }} onClick={() => setPaletteIdx(i)} />
                    ))}
                  </div>
                  <button type="button" className={`cs-toggle ${zoom === 'real' ? 'is-on' : ''}`} onClick={() => setZoom((z) => (z === 'fit' ? 'real' : 'fit'))} aria-pressed={zoom === 'real'}>
                    {zoom === 'real' ? 'ملاءمة الشاشة' : 'الحجم الحقيقي'}
                  </button>
                  <button type="button" className={`cs-icon cs-fav ${isFav(designId, paletteIdx) ? 'is-on' : ''}`} onClick={() => toggleFav(designId, paletteIdx)} aria-pressed={isFav(designId, paletteIdx)} aria-label="إضافة إلى المفضلة">
                    <Icon d={I.heart} fill={isFav(designId, paletteIdx) ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
              <div className={`cs-desk ${zoom === 'real' ? 'is-real' : ''}`}>
                {previewW > 0 && <CoverPage model={model} images={images} width={pageW} className="cs-sheet" />}
              </div>
              <p className="cs-desk-note">معاينة بمقاس A4. خطوط ملف Word: {[...new Set([model.fonts.title, model.fonts.body])].map((f, i) => <span key={f}>{i ? '، ' : ''}<bdi dir="ltr">{f}</bdi></span>)} — مثبتة مع Windows وOffice.</p>
            </div>

            <aside className="cs-panel" aria-label="بيانات الغلاف">
              <div className="cs-actions">
                <button type="button" className="cs-primary" onClick={doWord} disabled={!!busy}><Icon d={I.word} />{busy === 'word' ? 'جارٍ إنشاء الملف…' : 'تنزيل ملف Word'}</button>
                <div className="cs-actions-row">
                  <button type="button" className="cs-ghost" onClick={() => doPrint([model])}><Icon d={I.print} />طباعة / حفظ PDF</button>
                  <button type="button" className="cs-ghost" onClick={() => setSetOpen(true)}><Icon d={I.layers} />مجموعة سجلات متناسقة</button>
                </div>
              </div>
              {missingEmblem && (
                <div className="cs-alert">
                  <Icon d={I.info} />
                  <div><strong>شعار السلطنة الرسمي غير متوفر في المنصة بعد.</strong> ارفع ملف الشعار الرسمي من جهازك ليظهر في الغلاف، أو نزّل الغلاف بدونه.
                    <label className="cs-link-btn"><input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="cs-sr" onChange={uploadTo('emblem')} />رفع الشعار الرسمي</label>
                  </div>
                </div>
              )}

              <fieldset className="cs-fs">
                <legend>السجل</legend>
                <label className="cs-field"><span>نوع السجل</span>
                  <select value={data.recordId} onChange={(e) => setData((d) => ({ ...d, recordId: e.target.value, customTitle: '', showSubjectFor: null }))}>
                    {RECORD_GROUPS.map((g) => <optgroup key={g.id} label={g.label}>{RECORDS.filter((r) => r.group === g.id).map((r) => <option key={r.id} value={r.id}>{r.title.join(' ')}</option>)}</optgroup>)}
                  </select>
                </label>
                <label className="cs-field"><span>عنوان مخصص <em>(اختياري — افصل السطرين بـ |)</em></span>
                  <input type="text" value={data.customTitle} onChange={set('customTitle')} placeholder="مثال: سجل متابعة | الإنشاد المدرسي" maxLength={70} />
                </label>
                <label className="cs-field"><span>المادة</span>
                  <select value={data.subject} onChange={set('subject')}>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
                </label>
                <label className="cs-check"><input type="checkbox" checked={!!effData.showSubject} onChange={(e) => setData((d) => ({ ...d, showSubject: e.target.checked, showSubjectFor: d.recordId }))} />إظهار اسم المادة في الغلاف</label>
                <div className="cs-row2">
                  <label className="cs-field"><span>العام الدراسي</span><input type="text" dir="ltr" value={data.year} onChange={set('year')} placeholder="2026-2027" maxLength={20} /></label>
                  <label className="cs-field"><span>الفصل الدراسي</span><select value={data.semester} onChange={set('semester')}>{SEMESTERS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
                </div>
                <label className="cs-field"><span>الصف / الشعبة <em>(اختياري)</em></span><input type="text" value={data.grade} onChange={set('grade')} placeholder="مثال: الخامس الأساسي (1، 2، 3)" maxLength={50} /></label>
              </fieldset>

              <fieldset className="cs-fs">
                <legend>المدرسة</legend>
                <label className="cs-field"><span>المحافظة</span>
                  <input type="text" list="cs-govs" value={data.governorate} onChange={set('governorate')} placeholder="مسقط" maxLength={40} />
                  <datalist id="cs-govs">{GOVERNORATES.map((g) => <option key={g} value={g} />)}</datalist>
                </label>
                <label className="cs-field"><span>اسم المدرسة</span><input type="text" value={data.school} onChange={set('school')} placeholder="طلحة بن عبيدالله للتعليم الأساسي" maxLength={70} /></label>
                <div className="cs-logo">
                  {data.schoolLogo ? (
                    <>
                      <img src={data.schoolLogo.src} alt="شعار المدرسة" />
                      <div className="cs-seg" role="radiogroup" aria-label="موضع شعار المدرسة">
                        {[['right', 'يمين الترويسة'], ['left', 'يسار الترويسة']].map(([v, l]) => (
                          <button key={v} type="button" role="radio" aria-checked={(data.logoPos || design.layout.logoDefault) === v} className={(data.logoPos || design.layout.logoDefault) === v ? 'is-on' : ''} onClick={() => setData((d) => ({ ...d, logoPos: v }))}>{l}</button>
                        ))}
                      </div>
                      <button type="button" className="cs-icon" onClick={() => setData((d) => ({ ...d, schoolLogo: null }))} aria-label="حذف شعار المدرسة"><Icon d={I.trash} /></button>
                    </>
                  ) : (
                    <label className="cs-upload"><input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="cs-sr" onChange={uploadTo('schoolLogo')} /><Icon d={I.upload} />إرفاق شعار المدرسة</label>
                  )}
                </div>
                {data.emblem && !official && (
                  <div className="cs-logo cs-logo-sm"><img src={data.emblem.src} alt="شعار السلطنة" /><span>شعار السلطنة (مرفوع منك)</span>
                    <button type="button" className="cs-icon" onClick={() => setData((d) => ({ ...d, emblem: null }))} aria-label="حذف شعار السلطنة"><Icon d={I.trash} /></button></div>
                )}
              </fieldset>

              <fieldset className="cs-fs">
                <legend>إعداد السجل</legend>
                <div className="cs-seg cs-seg-full" role="radiogroup" aria-label="المعلم أو المعلمة">
                  {ROLES.map((r) => <button key={r.id} type="button" role="radio" aria-checked={data.role === r.id} className={data.role === r.id ? 'is-on' : ''} onClick={() => setData((d) => ({ ...d, role: r.id }))}>{r.label}</button>)}
                </div>
                <label className="cs-field"><span>الاسم</span><input type="text" value={data.teacher} onChange={set('teacher')} placeholder="أ. الاسم الكامل" maxLength={60} /></label>
              </fieldset>

              <fieldset className="cs-fs">
                <legend>الخط</legend>
                <label className="cs-field"><span>خط العنوان</span>
                  <select value={data.titleFont} onChange={set('titleFont')}>
                    <option value="">خط التصميم ({FONTS[design.fonts.title] ? FONTS[design.fonts.title].label : design.fonts.title})</option>
                    {Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
                  </select>
                </label>
              </fieldset>
              <p className="cs-note">تُحفظ بيانات المدرسة والمعلم والشعارات على هذا الجهاز فقط، لتعود جاهزة في كل غلاف.</p>
            </aside>
          </section>
        )}
      </div>

      {setOpen && (
        <div className="cs-modal" role="dialog" aria-modal="true" aria-labelledby="cs-set-title" onClick={(e) => { if (e.target === e.currentTarget) setSetOpen(false); }}>
          <div className="cs-modal-box">
            <div className="cs-modal-head"><h2 id="cs-set-title">مجموعة سجلات متناسقة</h2><button type="button" className="cs-icon" onClick={() => setSetOpen(false)} aria-label="إغلاق"><Icon d={I.x} /></button></div>
            <p>اختر السجلات، وستحصل على أغلفتها جميعًا بتصميم «{design.name}» وألوانه وبياناتك نفسها، كل غلاف في صفحة مستقلة من ملف Word واحد.</p>
            <div className="cs-set-list">
              {RECORD_GROUPS.map((g) => (
                <div key={g.id}><h3>{g.label}</h3>
                  {RECORDS.filter((r) => r.group === g.id).map((r) => (
                    <label key={r.id} className="cs-check"><input type="checkbox" checked={setRecords.includes(r.id)} onChange={(e) => setSetRecords((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))} />{r.title.join(' ')}</label>
                  ))}
                </div>
              ))}
            </div>
            <div className="cs-actions-row">
              <button type="button" className="cs-primary" onClick={doSetWord} disabled={!setRecords.length || !!busy}><Icon d={I.word} />{busy === 'set' ? 'جارٍ الإنشاء…' : `تنزيل ${setRecords.length} أغلفة في ملف Word`}</button>
              <button type="button" className="cs-ghost" onClick={() => doPrint(setModels())} disabled={!setRecords.length}><Icon d={I.print} />طباعة المجموعة</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`cs-toast ${toast.kind === 'err' ? 'is-err' : ''}`} role="status"><Icon d={toast.kind === 'err' ? I.info : I.check} />{toast.text}</div>}

      <div className="cs-print" aria-hidden="true" ref={printRef}>
        {printModels.map((m, i) => <CoverPage key={i} model={m} images={images} showMissing={false} />)}
      </div>
    </div>
  );
}
