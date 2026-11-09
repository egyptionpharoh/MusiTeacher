'use client';
// ☀️ «ماذا سأدرّس اليوم وغدًا؟» — من جدول المنبّه + الدروس المرتبطة + حالة التنفيذ. لا نخترع درسًا لحصة غير مرتبطة.
import { Icon } from '../../class-alarm/ui/parts';
import { dayStatus, resolveDay } from '../../class-alarm/core/schedule.js';
import { fmtTime, clock, durationWords, addDays, fmtDate } from '../../class-alarm/core/time.js';
import { findLesson, classLabelOf, planLabel, allLessons, gradeNum } from '../core/model.js';
import { linksForDay } from '../core/links.js';
import { lessonState, classesFromProfile, assignmentStatus } from '../core/track.js';
import { StatusBadge, fmtD } from './lpParts';

export default function TodayPlanView({ ws, profile, today, now, onRecord, onGoto, alarmHref, hasSchedule }) {
  if (!hasSchedule) return <section className="ca-card"><div className="ca-empty"><Icon n="bell" size={34} /><strong>أضف جدولك في «منبّه الحصص» أولًا</strong><p>هذه اللوحة تعرض حصصك الفعلية من المنبّه والدروس التي ربطتها بها.</p><a className="ca-btn" href={alarmHref}>فتح الجدول الذكي</a></div></section>;
  const st = dayStatus(profile, now);
  const tomorrow = addDays(today, 1);
  const linksToday = linksForDay(ws, profile, today, today);
  const next = st.next;
  const nextLink = next ? linksToday.get(next.key) : null;
  const classes = classesFromProfile(profile);

  // الحصص المؤجلة التي تحتاج موعدًا + الحصص الماضية بلا تسجيل + دروس لم تُوزع
  const postponed = [], incomplete = [], unassigned = [];
  for (const plan of ws.plans) for (const l of allLessons(plan)) for (const c of classes) {
    if (!ws.assignments.some((a) => a.planId === plan.id && a.lessonId === l.id && a.classKey === c.classKey)) continue;
    const s = lessonState(ws, plan.id, l, c.classKey, today);
    for (const p of s.postponed) postponed.push({ plan, lesson: l, cls: c, part: p.part, last: p.items[p.items.length - 1] });
    if (s.pendingCompletion) incomplete.push({ plan, lesson: l, cls: c });
  }
  // «دروس لم توزع» فقط للخطط الجارية الآن أو التي تبدأ خلال أسبوعين (لا خطط الفصل القادم ولا الأعوام السابقة)
  const active = ws.plans.filter((plan) => { const ls = allLessons(plan).filter((l) => l.start && l.end); if (!ls.length) return true; const a = ls.reduce((m, l) => (l.start < m ? l.start : m), '9999'), z = ls.reduce((m, l) => (l.end > m ? l.end : m), '0000'); return a <= addDays(today, 14) && z >= today; });
  for (const plan of active) {
    const grade = classes.filter((c) => gradeNum(c.grade) && gradeNum(c.grade) === gradeNum(plan.grade));
    for (const c of grade) {
      const n = allLessons(plan).filter((l) => l.sessions && lessonState(ws, plan.id, l, c.classKey, today).needsSlot.length).length;
      if (n) unassigned.push({ plan, cls: c, n });
    }
  }
  const awaiting = ws.assignments.filter((a) => a.profileId === profile.id && assignmentStatus(ws, a, today) === 'awaiting').sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));

  return (
    <div className="ca-stack">
      <section className="lp-now">
        <div className="lp-now-card">
          {st.current && <div className="lp-now-cur"><span className="ca-badge is-now">الحصة الحالية</span> <b>{st.current.title}{st.current.cls ? ` – ${st.current.cls}` : ''}</b>{linksToday.get(st.current.key) && <span> • الدرس: {linksToday.get(st.current.key).lessonTitle}</span>} <span className="ca-muted">حتى {fmtTime(st.current.end)}</span></div>}
          {next ? (
            <div className="lp-now-next">
              <div><span className="ca-badge is-next">الحصة القادمة</span><h3>{next.title}{next.cls ? ` – ${next.cls}` : ''}</h3>
                <p>{next.type === 'lesson' ? `الحصة ${next.label} • ` : ''}{fmtTime(next.start)}</p>
                <p className="lp-now-lesson">{nextLink ? <>الدرس: <b>{nextLink.lessonTitle}</b>{nextLink.sessions ? ` (الحصة ${nextLink.part} من ${nextLink.sessions})` : ''}</> : <span className="ca-muted">لم يتم تحديد درس لهذه الحصة بعد</span>}</p>
              </div>
              <div className="lp-now-count"><strong>{clock(next.startMs - now)}</strong><span>{durationWords(next.startMs - now)}</span></div>
            </div>
          ) : <p className="ca-muted">{st.phase === 'after' ? 'انتهت حصص اليوم.' : 'لا حصص متبقية اليوم.'}{st.upcoming ? ` القادمة: ${fmtD(st.upcoming.dateKey)} ${fmtTime(st.upcoming.event.start)} — ${st.upcoming.event.title}` : ''}</p>}
        </div>
      </section>

      <div className="lp-two">
        <DayList title={`اليوم — ${fmtDate(today)}`} dateKey={today} ws={ws} profile={profile} today={today} now={now} onRecord={onRecord} onGoto={onGoto} />
        <DayList title={`غدًا — ${fmtDate(tomorrow)}`} dateKey={tomorrow} ws={ws} profile={profile} today={today} now={now} onRecord={onRecord} onGoto={onGoto} />
      </div>

      {(awaiting.length > 0 || postponed.length > 0 || incomplete.length > 0 || unassigned.length > 0) && (
        <section className="ca-card">
          <div className="ca-card-head"><div><h3>يحتاج انتباهك</h3></div></div>
          {awaiting.length > 0 && <><div className="ca-label">حصص مضى موعدها ولم يُسجل تنفيذها ({awaiting.length})</div>
            <ul className="lp-list">{awaiting.slice(0, 8).map((a) => <li key={a.id}><span>{fmtD(a.dateKey)} — {classLabelOf(a.grade, a.section)}: {(findLesson(ws, a.planId, a.lessonId) || { lesson: { title: a.snapshot.lessonTitle } }).lesson.title}</span><button type="button" className="ca-btn is-sm" onClick={() => onRecord(a.id)}>تسجيل التنفيذ</button></li>)}</ul></>}
          {postponed.length > 0 && <><div className="ca-label ca-mt">حصص مؤجلة تحتاج موعدًا جديدًا ({postponed.length})</div>
            <ul className="lp-list">{postponed.map((p, i) => <li key={i}><span>{p.lesson.title} — {p.cls.label} • الحصة {p.part}</span><button type="button" className="ca-btn is-sm" onClick={() => onRecord(p.last.a.id)}>اختيار موعد بديل</button></li>)}</ul></>}
          {incomplete.length > 0 && <><div className="ca-label ca-mt">دروس تحتاج إلى استكمال ({incomplete.length})</div>
            <ul className="lp-list">{incomplete.map((p, i) => <li key={i}><span>{p.lesson.title} — {p.cls.label}</span><button type="button" className="ca-btn is-ghost is-sm" onClick={() => onGoto('link')}>تحديد حصة استكمال</button></li>)}</ul></>}
          {unassigned.length > 0 && <><div className="ca-label ca-mt">دروس لم توزع بعد على حصصك</div>
            <ul className="lp-list">{unassigned.map((u, i) => <li key={i}><span>{planLabel(u.plan)} — {u.cls.label} • دروس غير موزعة: {u.n}</span><button type="button" className="ca-btn is-ghost is-sm" onClick={() => onGoto('link')}>ربط بالجدول</button></li>)}</ul></>}
        </section>
      )}
    </div>
  );
}

function DayList({ title, dateKey, ws, profile, today, now, onRecord, onGoto }) {
  const day = resolveDay(profile, dateKey);
  const links = linksForDay(ws, profile, dateKey, today);
  const ev = day.events.filter((e) => e.type === 'lesson' || (e.type === 'extra' && e.kind === 'lesson'));
  return (
    <section className="ca-card">
      <div className="ca-card-head"><div><h3>{title}</h3><p className="ca-muted">{day.holiday ? `إجازة: ${day.holiday.name}` : !day.isWorkday ? 'ليس يوم دوام' : `${ev.filter((e) => !e.cancelled).length} حصة`}</p></div></div>
      {ev.length === 0 ? <p className="ca-muted">لا حصص.</p> : (
        <ol className="lp-day">
          {ev.map((e) => {
            const l = links.get(e.key);
            const f = l ? findLesson(ws, l.planId, l.lessonId) : null;
            const live = dateKey === today && e.startMs <= now && now < e.endMs;
            return (
              <li key={e.key} className={`${e.cancelled ? 'is-cancel' : ''}${live ? ' is-live' : ''}`}>
                <div className="lp-day-time"><b>{fmtTime(e.start)}</b><span>{e.type === 'lesson' ? `الحصة ${e.label}` : 'استثنائية'}</span></div>
                <div className="lp-day-body">
                  <div className="lp-day-cls"><b>{e.cls || 'بدون صف'}</b> <span className="ca-muted">{e.title}</span>{e.cancelled && <StatusBadge status="cancelled" label="ملغاة في الجدول" />}</div>
                  {l ? (
                    <div className="lp-day-lesson">
                      <span>{f && f.unit.title ? `${f.unit.title} • ` : ''}<b>{l.lessonTitle}</b></span>
                      <span className="ca-small">{l.kind === 'completion' ? 'حصة استكمال' : `الحصة ${l.part}${l.sessions ? ` من ${l.sessions}` : ''}`}{l.remaining != null ? ` • المتبقي للدرس: ${l.remaining}` : ''} <StatusBadge status={l.status} /></span>
                      {dateKey <= today && !e.cancelled && <button type="button" className="ca-link" onClick={() => onRecord(l.assignmentId)}>تسجيل تنفيذ الحصة</button>}
                    </div>
                  ) : !e.cancelled && <div className="lp-day-none">لم يتم تحديد درس لهذه الحصة بعد • <button type="button" className="ca-link" onClick={() => onGoto('link')}>ربط درس</button></div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
