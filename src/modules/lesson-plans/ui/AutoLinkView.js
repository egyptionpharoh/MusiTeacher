'use client';
// ⚙️ «الربط بجدولي»: حالة الربط التلقائي لكل صف/شعبة + الحصص القادمة ودرس كل حصة + تصحيح ما يحتاج مراجعة.
// الجدول يُقرأ من «منبّه الحصص» (قراءة فقط)، والربط يُحسب لحظيًا (core/auto.js) فلا نسخ ولا تكرار.
import { useMemo, useState } from 'react';
import { Icon, Toggle } from '../../class-alarm/ui/parts';
import { resolveDay } from '../../class-alarm/core/schedule.js';
import { addDays, fmtTime } from '../../class-alarm/core/time.js';
import { gradeNum, classKeyOf } from '../core/model.js';
import { classesFromProfile } from '../core/track.js';
import { linksForDay } from '../core/links.js';
import { withOverride, plansOfGrade } from '../core/auto.js';
import { formatDateAr } from '../core/calendar.js';
import CorrectModal from './CorrectModal';
import LinkView from './LinkView';

const DAYS = 14;

export default function AutoLinkView(props) {
  const { ws, update, profile, today, hasSchedule, alarmHref, grades, notify } = props;
  const [onlyReview, setOnlyReview] = useState(false);
  const [fix, setFix] = useState(null);
  const on = ws.settings.autoLink !== false;
  const classes = useMemo(() => classesFromProfile(profile).filter((c) => !grades.length || grades.includes(gradeNum(c.grade))), [profile, grades]);

  const rows = useMemo(() => {
    if (!hasSchedule || !on) return [];
    const out = [];
    for (let i = 0, k = today; i < DAYS; i++, k = addDays(k, 1)) {
      const day = resolveDay(profile, k);
      const links = linksForDay(ws, profile, k, today);
      for (const e of day.events) {
        if (e.cancelled || !(e.type === 'lesson' || (e.type === 'extra' && e.kind === 'lesson'))) continue;
        const g = gradeNum((e.lesson || {}).grade);
        if (grades.length && !grades.includes(g)) continue;
        out.push({ dateKey: k, e, link: links.get(e.key) || null, g });
      }
    }
    return out;
  }, [ws, profile, today, hasSchedule, on, grades]);

  const review = rows.filter((r) => r.link && r.link.review).length;
  const sure = rows.filter((r) => r.link && r.link.lessonTitle).length;
  const shown = onlyReview ? rows.filter((r) => r.link && r.link.review) : rows;
  const byDay = shown.reduce((m, r) => { (m[r.dateKey] = m[r.dateKey] || []).push(r); return m; }, {});
  const h24 = false;

  const saveFix = (r, choice) => {
    update((w) => withOverride(w, { profileId: profile.id, dateKey: r.dateKey, slotKey: r.e.key, classKey: '', ...choice }));
    notify(choice.lessonId === null ? 'أُعيدت الحصة للربط التلقائي.' : 'حُفظ التصحيح لهذه الحصة.');
    setFix(null);
  };

  return (
    <div className="ca-stack">
      <section className="ca-card">
        <div className="ca-card-head"><div><h3>الربط التلقائي بجدول حصصي</h3><p className="ca-muted">خطة كل صف تحدد الدرس وأسابيعه، و«منبّه الحصص الذكي» يحدد حصصك الفعلية.</p></div></div>
        <Toggle checked={on} onChange={(v) => update((w) => ({ ...w, settings: { ...w.settings, autoLink: v } }))} label="ربط دروس خطتي تلقائيًا بحصصي" hint="عند الإيقاف تظهر في المنبّه الروابط اليدوية فقط" />
        {!hasSchedule && (
          <div className="ca-notice is-info"><Icon n="bell" /><span>لا يوجد جدول حصص في «منبّه الحصص الذكي» بعد. تعمل الخطط بدونه، ويبدأ الربط بمجرد إدخال جدولك هناك.</span><a className="ca-btn is-sm" href={alarmHref}>فتح المنبّه</a></div>
        )}
        {hasSchedule && on && (
          <>
            <div className="lp-cls-grid">
              {classes.map((c) => {
                const n = gradeNum(c.grade);
                const has = plansOfGrade(ws, n).length > 0;
                const mine = rows.filter((r) => r.e.lesson && classKeyOf(r.e.lesson.grade, r.e.lesson.section) === c.classKey);
                const rv = mine.filter((r) => r.link && r.link.review).length;
                return (
                  <div key={c.classKey} className="lp-cls">
                    <b>{c.label}</b>
                    <span className="ca-small ca-muted">{c.weekly.length} حصة أسبوعيًا</span>
                    {!has ? <span className="lp-st is-warn">لا توجد خطة لهذا الصف</span> : rv ? <span className="lp-st is-warn">{rv} تحتاج مراجعة</span> : <span className="lp-st is-ok">مرتبط تلقائيًا</span>}
                  </div>
                );
              })}
              {!classes.length && <p className="ca-muted ca-small">لا توجد في جدولك حصص للصفوف المختارة.</p>}
            </div>
            <p className="ca-small ca-muted">خلال {DAYS} يومًا القادمة: {sure} حصة بدرس محدد • {review} تحتاج مراجعة.</p>
          </>
        )}
      </section>

      {hasSchedule && on && (
        <section className="ca-card">
          <div className="ca-card-head">
            <div><h3>الحصص القادمة ودروسها</h3><p className="ca-muted">صحّح أي حصة بضغطة؛ التصحيح يخص تلك الحصة فقط.</p></div>
            <Toggle checked={onlyReview} onChange={setOnlyReview} label="ما يحتاج مراجعة فقط" />
          </div>
          {!shown.length && <p className="ca-muted">{onlyReview ? 'لا توجد حصص تحتاج مراجعة. 👍' : 'لا توجد حصص في هذه الفترة.'}</p>}
          {Object.entries(byDay).map(([k, list]) => (
            <div key={k} className="lp-al-day">
              <div className="lp-al-dayhead">{formatDateAr(k, { day: true })}{k === today ? ' (اليوم)' : ''}</div>
              <ul className="lp-al-list">
                {list.map((r) => (
                  <li key={r.e.key} className={`lp-al-slot${r.link && r.link.review ? ' is-review' : ''}`}>
                    <span className="lp-al-time"><bdi>{fmtTime(r.e.start, h24)}</bdi></span>
                    <span className="lp-al-cls">{r.e.cls || '—'}</span>
                    <span className="lp-al-lesson">
                      {!r.link ? <i className="ca-muted">لا توجد خطة لهذا الصف</i>
                        : r.link.lessonTitle ? <><b>{r.link.lessonTitle}</b>{r.link.part ? <small> • الحصة {r.link.part}{r.link.sessions ? ` من ${r.link.sessions}` : ''}</small> : null}{r.link.source === 'manual' && <i className="lp-st">ربط يدوي</i>}{r.link.overridden && <i className="lp-st is-info">مصحّح</i>}</>
                          : r.link.review ? <><span className="lp-st is-warn">يحتاج مراجعة</span> <small className="ca-muted">{r.link.reason}</small></>
                            : <i className="ca-muted">{r.link.reason || 'لا يوجد درس مخطط'}</i>}
                    </span>
                    {r.link && r.link.source !== 'manual' && <button type="button" className="ca-btn is-ghost is-sm" onClick={() => setFix(r)}>{r.link.review ? 'تحديد الدرس' : 'تصحيح'}</button>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <details className="ca-card lp-advanced">
        <summary><b>ربط يدوي متقدم (اختياري)</b> <span className="ca-muted ca-small">لتوزيع أجزاء درس على حصص محددة وتسجيل تنفيذها؛ له الأولوية على الربط التلقائي.</span></summary>
        <div className="ca-mt"><LinkView {...props} ws={{ ...ws, plans: ws.plans.filter((p) => !grades.length || grades.includes(gradeNum(p.grade))) }} /></div>
      </details>

      {fix && <CorrectModal ws={ws} dateKey={fix.dateKey} event={fix.e} link={fix.link} onClose={() => setFix(null)} onSave={(c) => saveFix(fix, c)} />}
    </div>
  );
}
