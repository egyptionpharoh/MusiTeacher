'use client';
// 🔎 «موعد الدرس»: يختار المعلم الفصل والصف والدرس، فيظهر أسبوع/أسابيع الدرس وتاريخ كل أسبوع بوضوح.
// المصدر: خطة المعلم لهذا الصف إن رفعها (الأولوية لها)، وإلا «الخطة المرجعية المدمجة في المنصة».
// التواريخ تُحسب من أرقام الأسابيع والتقويم المدرسي (لا نعرض نص التواريخ المنسوخ من PDF لأنه تالف الاتجاه).
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../class-alarm/ui/parts';
import { OFFICIAL_YEAR } from '../core/importPlan.js';
import { gradeNum, GRADE_NAMES, SEMESTERS, allLessons } from '../core/model.js';
import { lessonTiming, maxWeekOf, formatRangeAr } from '../core/calendar.js';
import { loadSelection, saveSelection } from './storage';

/** خطة المعلم المناسبة لصف وفصل: الأحدث تحديثًا (إن وُجد أكثر من عام نفضّل العام المرجعي الحالي) */
export function teacherPlanFor(ws, grade, semester) {
  const n = gradeNum(grade);
  const list = ws.plans.filter((p) => gradeNum(p.grade) === n && p.semester === semester && allLessons(p).length);
  if (!list.length) return null;
  return list.sort((a, b) => ((b.year === OFFICIAL_YEAR) - (a.year === OFFICIAL_YEAR)) || (b.year || '').localeCompare(a.year || '') || b.updatedAt - a.updatedAt)[0];
}

export default function LessonTimeView({ plansData, uid, ws, grades, onOpenSettings }) {
  const saved = useMemo(() => loadSelection(uid) || {}, [uid]);
  const gradeOptions = useMemo(() => GRADE_NAMES.filter((g, i) => !grades.length || grades.includes(i + 1)), [grades]);
  const [semester, setSemester] = useState(SEMESTERS.includes(saved.semester) ? saved.semester : '');
  const [grade, setGrade] = useState(gradeOptions.includes(saved.grade) ? saved.grade : gradeOptions.length === 1 ? gradeOptions[0] : '');
  const [lessonKey, setLessonKey] = useState(saved.lesson || '');
  const [srcPref, setSrcPref] = useState('mine');

  // إن غيّر المعلم صفوفه من ⚙️ نُسقط الاختيار غير المتاح
  useEffect(() => { if (grade && !gradeOptions.includes(grade)) { setGrade(gradeOptions.length === 1 ? gradeOptions[0] : ''); setLessonKey(''); } }, [gradeOptions, grade]);

  const mine = semester && grade ? teacherPlanFor(ws, grade, semester) : null;
  const ref = semester && grade && plansData[semester] ? plansData[semester][grade] : null;
  const source = mine && (srcPref === 'mine' || !ref) ? 'mine' : ref ? 'ref' : mine ? 'mine' : '';

  const lessons = useMemo(() => {
    if (source === 'mine') {
      const ls = allLessons(mine);
      const mx = maxWeekOf(ls.map((l) => l.weeks));
      return ls.map((l) => ({ key: `m:${l.id}`, title: l.title, unitTitle: l.unitTitle, timing: lessonTiming({ weeks: l.weeks, start: l.start, end: l.end, year: mine.year, semester: mine.semester, maxWeek: mx }), sessions: l.sessions }));
    }
    if (source === 'ref') {
      const mx = maxWeekOf(Object.values(ref).map((v) => v.weeks));
      return Object.entries(ref).map(([title, v]) => ({ key: `r:${title}`, title, timing: lessonTiming({ weeks: v.weeks, year: OFFICIAL_YEAR, semester, maxWeek: mx }), sessions: null }));
    }
    return [];
  }, [source, mine, ref, semester]);
  const lesson = lessons.find((l) => l.key === lessonKey) || null;

  useEffect(() => { saveSelection(uid, { semester, grade, lesson: lessonKey }); }, [uid, semester, grade, lessonKey]);

  const year = source === 'mine' ? mine.year || '—' : OFFICIAL_YEAR;
  return (
    <div className="ca-stack">
      <section className="ca-card lp-gen">
        <div className="ca-card-head">
          <div><h3>🔎 موعد الدرس</h3><p className="ca-muted">اختر الفصل والصف والدرس لتعرف أسبوع عرضه وتواريخه.</p></div>
        </div>
        <div className="lp-gen-pick">
          <label className="lp-gen-field"><span>الفصل الدراسي</span>
            <select className="ca-input" value={semester} onChange={(e) => { setSemester(e.target.value); setLessonKey(''); }} aria-label="الفصل الدراسي">
              <option value="">— اختر الفصل —</option>{SEMESTERS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="lp-gen-field"><span>الصف</span>
            <select className="ca-input" value={grade} onChange={(e) => { setGrade(e.target.value); setLessonKey(''); }} aria-label="الصف">
              <option value="">— اختر الصف —</option>{gradeOptions.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label className="lp-gen-field is-wide"><span>الدرس</span>
            <select className="ca-input" value={lesson ? lessonKey : ''} onChange={(e) => setLessonKey(e.target.value)} disabled={!lessons.length} aria-label="الدرس">
              <option value="">{semester && grade && !lessons.length ? 'لا توجد دروس لهذا الصف والفصل' : '— اختر الدرس —'}</option>
              {lessons.map((l) => <option key={l.key} value={l.key}>{l.unitTitle ? `${l.unitTitle} • ` : ''}{l.title}</option>)}
            </select>
          </label>
        </div>
        {!grades.length && <p className="ca-small ca-muted lp-gen-hint">تظهر كل الصفوف لأنك لم تحدد صفوفك بعد. <button type="button" className="ca-link" onClick={onOpenSettings}>⚙️ اختر صفوفك</button> لتظهر صفوفك فقط.</p>}
        {semester && grade && (
          <div className="lp-gen-src">
            <span className="ca-small ca-muted">المصدر:</span>
            {mine && ref ? (
              <div className="ca-seg" role="radiogroup" aria-label="مصدر المواعيد">
                <button type="button" role="radio" aria-checked={source === 'mine'} className={source === 'mine' ? 'is-on' : ''} onClick={() => { setSrcPref('mine'); setLessonKey(''); }}>خطتي لهذا الصف</button>
                <button type="button" role="radio" aria-checked={source === 'ref'} className={source === 'ref' ? 'is-on' : ''} onClick={() => { setSrcPref('ref'); setLessonKey(''); }}>الخطة المرجعية المدمجة</button>
              </div>
            ) : <b className="ca-small">{source === 'mine' ? 'خطتي لهذا الصف' : source === 'ref' ? 'الخطة المرجعية المدمجة في المنصة' : '—'}</b>}
            <span className="ca-small ca-muted">• العام الدراسي <bdi>{year}</bdi></span>
          </div>
        )}
      </section>

      <section className="ca-card lp-gen-result" aria-live="polite">
        {!lesson ? (
          <div className="ca-empty"><Icon n="calendar" size={34} /><strong>اختر الدرس لعرض موعده</strong><p>سيظهر هنا أسبوع عرض الدرس وتاريخ كل أسبوع مرتّبًا.</p></div>
        ) : (
          <div className="lp-gen-out" key={lesson.key}>
            <h3 className="lp-gen-title">📖 {lesson.title}</h3>
            {lesson.timing.state === 'ok' && (
              <>
                {lesson.timing.weeksText && <p className="lp-gen-line"><span>📌 الأسابيع المخصصة لعرض الدرس:</span> <b>{lesson.timing.weeksText}</b></p>}
                <p className="lp-gen-line"><span>📅 التواريخ المقررة ({lesson.timing.weeks.length > 1 ? 'مرتّبة حسب الأسبوع' : 'فترة الدرس'}):</span></p>
                <ol className="lp-gen-weeks">
                  {lesson.timing.weeks.map((w) => <li key={`${w.week}-${w.start}`}><span className="lp-gen-wk">{w.label}</span><bdi className="lp-gen-dt">{w.text}</bdi></li>)}
                </ol>
                {lesson.timing.weeks.length > 1 && <p className="lp-gen-line"><span>🗓️ من بداية الدرس إلى نهايته:</span> <bdi>{formatRangeAr(lesson.timing.start, lesson.timing.end)}</bdi></p>}
                {lesson.sessions ? <p className="lp-gen-line"><span>⏱️ عدد الحصص في خطتك:</span> <b>{lesson.sessions}</b></p> : null}
              </>
            )}
            {lesson.timing.state === 'by-plan' && <div className="ca-notice is-info"><Icon n="info" /><span>📌 موعد هذا الدرس «حسب الخطة»: لم يُحدَّد له أسبوع في هذه الخطة، فيُحدَّد حسب خطة مدرستك.</span></div>}
            {lesson.timing.state === 'unknown' && <div className="ca-notice is-warn"><Icon n="warn" /><span>لم تُحدَّد أسابيع هذا الدرس في الخطة بصورة يمكن قراءتها بدقة، لذلك لا نعرض تاريخًا تقديريًا. راجع خطة مدرستك{source === 'mine' ? ' أو عدّل الدرس من ⚙️ «خططي حسب الصف»' : ''}.</span></div>}
            <p className="ca-small ca-muted lp-gen-note">{source === 'ref'
              ? 'التواريخ محسوبة من أرقام الأسابيع في الخطة المرجعية المدمجة في المنصة (الأسبوع الدراسي من الأحد إلى الخميس)، وهي للاسترشاد؛ اعتمد دائمًا خطة مدرستك.'
              : 'من خطتك التي رفعتها لهذا الصف.'}</p>
          </div>
        )}
      </section>
    </div>
  );
}
