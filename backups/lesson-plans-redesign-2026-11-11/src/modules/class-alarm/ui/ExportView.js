'use client';
// 🖨️ الجدول المنسق باسم المعلم ومدرسته: قوالب + معاينة + PDF/صورة/Word/Excel/طباعة + تقويم الهاتف (.ics)
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Toggle, Field } from './parts';
import { buildSheet, TEMPLATES, SHEET_W, SHEET_H } from '../core/sheet.js';
import { buildICS } from '../core/ics.js';
import { zonedParts, fmtDate } from '../core/time.js';
import { exportPNG, exportPDF, exportDocx, exportXlsx, printSheet, sharePNG, downloadBlob, safeName } from './files';

export default function ExportView({ profile, settings, notify }) {
  const [tpl, setTpl] = useState('official');
  const [opt, setOpt] = useState({ showRoom: true, showSubject: true, showNotes: false, showStats: true });
  const [busy, setBusy] = useState('');
  const [w, setW] = useState(0);
  const ref = useRef(null);
  const sheetOpts = useMemo(() => ({ template: tpl, h24: settings.h24, ...opt }), [tpl, settings.h24, opt]);
  const sheet = useMemo(() => buildSheet(profile, sheetOpts), [profile, sheetOpts]);
  const thumbs = useMemo(() => TEMPLATES.map((t) => ({ ...t, sheet: buildSheet(profile, { template: t.id, h24: settings.h24, ...opt }) })), [profile, settings.h24, opt]);
  const name = safeName(`الجدول الدراسي - ${profile.teacher || profile.name}`);
  const empty = !Object.values(profile.lessons).some((r) => Object.keys(r).length);
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare;

  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const scale = w ? Math.min(1, w / SHEET_W) : 0.5;

  const run = (label, fn) => async () => {
    setBusy(label);
    try { await fn(); } catch (e) { console.error(e); notify(`تعذر ${label}. جرّب «طباعة» ثم «حفظ كـ PDF».`, 'err'); } finally { setBusy(''); }
  };

  const today = zonedParts(Date.now(), profile.tz).dateKey;
  const [icsFrom, setIcsFrom] = useState(today);
  const [icsWeeks, setIcsWeeks] = useState(18);

  return (
    <div className="ca-stack">
      <section className="ca-card">
        <div className="ca-card-head"><div><h3>الجدول المنسق</h3><p className="ca-muted">جدول أسبوعي أنيق باسمك واسم مدرستك، للطباعة أو المشاركة مع الزملاء</p></div></div>
        {(!profile.teacher || !profile.school) && <div className="ca-notice is-info"><Icon n="info" /><span>أضف اسمك واسم المدرسة (وشعارها إن أردت) من تبويب «الجدول» ليظهرا في الترويسة.</span></div>}
        <div className="ca-tpls" role="radiogroup" aria-label="القالب">
          {thumbs.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={tpl === t.id} className={`ca-tpl${tpl === t.id ? ' is-on' : ''}`} onClick={() => setTpl(t.id)}>
              <span className="ca-tpl-prev" aria-hidden="true"><span style={{ transform: `scale(${168 / SHEET_W})` }} dangerouslySetInnerHTML={{ __html: t.sheet.html }} /></span>
              <strong>{t.name}</strong><span className="ca-muted">{t.desc}</span>
            </button>
          ))}
        </div>
        <div className="ca-row ca-wrap ca-mt">
          <Toggle checked={opt.showRoom} onChange={(v) => setOpt({ ...opt, showRoom: v })} label="القاعة" />
          <Toggle checked={opt.showSubject} onChange={(v) => setOpt({ ...opt, showSubject: v })} label="المواد الأخرى" />
          <Toggle checked={opt.showNotes} onChange={(v) => setOpt({ ...opt, showNotes: v })} label="الملاحظات" />
          <Toggle checked={opt.showStats} onChange={(v) => setOpt({ ...opt, showStats: v })} label="ملخص الأسبوع" />
        </div>
      </section>

      <section className="ca-card">
        <div className="ca-export-bar">
          <button type="button" className="ca-btn" disabled={!!busy || empty} onClick={run('تصدير PDF', () => exportPDF(profile, sheetOpts, name))}><Icon n="download" />{busy === 'تصدير PDF' ? 'جارٍ التجهيز...' : 'PDF'}</button>
          <button type="button" className="ca-btn" disabled={!!busy || empty} onClick={run('تصدير الصورة', () => exportPNG(profile, sheetOpts, name))}><Icon n="download" />{busy === 'تصدير الصورة' ? 'جارٍ التجهيز...' : 'صورة عالية الدقة'}</button>
          <button type="button" className="ca-btn is-ghost" disabled={!!busy || empty} onClick={run('تصدير Word', () => exportDocx(profile, tpl, name, settings.h24))}><Icon n="download" />Word</button>
          <button type="button" className="ca-btn is-ghost" disabled={!!busy || empty} onClick={run('تصدير Excel', () => exportXlsx(profile, name, settings.h24))}><Icon n="download" />Excel</button>
          <button type="button" className="ca-btn is-ghost" disabled={!!busy || empty} onClick={() => printSheet(sheet)}><Icon n="print" />طباعة</button>
          {canShare && <button type="button" className="ca-btn is-ghost" disabled={!!busy || empty} onClick={run('المشاركة', async () => { if (!(await sharePNG(profile, sheetOpts, name))) notify('المشاركة المباشرة غير مدعومة هنا؛ حمّل الصورة ثم أرسلها.', 'err'); })}><Icon n="phone" />مشاركة الصورة</button>}
        </div>
        <p className="ca-muted ca-small">لحماية خصوصيتك لا ننشئ رابطًا عامًا لجدولك؛ شارك الملف أو الصورة مع من تريد مباشرة.</p>
        <div className="ca-sheet-wrap" ref={ref} style={{ height: SHEET_H * scale }}>
          <style>{sheet.css}</style>
          <div className="ca-sheet-scale" style={{ transform: `scale(${scale})` }} dangerouslySetInnerHTML={{ __html: sheet.html }} />
        </div>
      </section>

      <section className="ca-card ca-ics">
        <div className="ca-card-head"><div><h3>تنبيهات تعمل والمتصفح مغلق: أضف الجدول إلى تقويمك</h3><p className="ca-muted">ملف تقويم بتنبيهات مدمجة حسب خطة التنبيه (قبل الحصة بـ{profile.plan.before.map((b) => b.min).join(' و')} دقيقة). يرن به تقويم الهاتف أو Outlook حتى لو لم تفتح المنصة.</p></div></div>
        <div className="ca-row ca-wrap">
          <Field label="من تاريخ"><input className="ca-input" type="date" value={icsFrom} onChange={(e) => setIcsFrom(e.target.value || today)} /></Field>
          <Field label="لمدة"><select className="ca-input" value={icsWeeks} onChange={(e) => setIcsWeeks(+e.target.value)}>{[4, 8, 12, 18, 20].map((n) => <option key={n} value={n}>{n} أسبوعًا</option>)}</select></Field>
          <button type="button" className="ca-btn" disabled={empty} onClick={() => { const r = buildICS(profile, { from: icsFrom, weeks: icsWeeks }); downloadBlob(new Blob([r.text], { type: 'text/calendar;charset=utf-8' }), `${safeName(profile.name)}.ics`); notify(`تم إنشاء ملف التقويم (${r.count} حدث متكرر حتى ${fmtDate(r.until)}).`); }}><Icon n="calendar" />تحميل ملف التقويم</button>
        </div>
        <details className="ca-details">
          <summary>كيف أضيفه لهاتفي؟</summary>
          <ul className="ca-limits">
            <li><b>iPhone:</b> افتح الملف من البريد أو «الملفات» ← «إضافة الكل» إلى التقويم.</li>
            <li><b>Android (تقويم Google):</b> من الكمبيوتر افتح calendar.google.com ← الإعدادات ← استيراد وتصدير ← استيراد الملف، فيتزامن مع الهاتف.</li>
            <li><b>Outlook:</b> افتح الملف بالنقر المزدوج ← «حفظ وإغلاق».</li>
            <li>الإجازات والحصص الملغاة أو المعدلة المسجلة قبل التصدير تُستثنى تلقائيًا. إذا عدّلت الجدول لاحقًا: احذف التقويم القديم وأضف الملف الجديد.</li>
          </ul>
        </details>
      </section>
    </div>
  );
}
