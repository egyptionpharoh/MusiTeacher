'use client';
// 📈 لوحة تقدم الخطة — من سجلات التنفيذ الحقيقية فقط (لا من مرور التاريخ)، لكل صف/شعبة.
import { useMemo, useState } from 'react';
import { Icon } from '../../class-alarm/ui/parts';
import { planLabel, gradeNum, classLabelOf } from '../core/model.js';
import { planProgress, classesFromProfile } from '../core/track.js';
import { StatusBadge, fmtD } from './lpParts';

export default function ProgressView({ ws, profile, today, onGoto, onRecord }) {
  const [planId, setPlanId] = useState(() => (ws.plans[0] || {}).id || '');
  const plan = ws.plans.find((p) => p.id === planId) || ws.plans[0];
  // الصفوف: من جدول المنبّه، ومعها أي صف وُزعت له حصص سابقًا (حتى لو تغيّر الجدول)
  const classes = useMemo(() => {
    if (!plan) return [];
    const m = new Map();
    for (const c of classesFromProfile(profile)) if (gradeNum(c.grade) === gradeNum(plan.grade)) m.set(c.classKey, c.label);
    for (const a of ws.assignments) if (a.planId === plan.id && !m.has(a.classKey)) m.set(a.classKey, classLabelOf(a.grade, a.section));
    return [...m.entries()].map(([classKey, label]) => ({ classKey, label }));
  }, [plan, profile, ws.assignments]);
  const [classKey, setClassKey] = useState('');
  const cls = classes.find((c) => c.classKey === classKey) || classes[0];
  const [copied, setCopied] = useState(false);
  if (!plan) return <section className="ca-card"><div className="ca-empty"><Icon n="sparkle" size={34} /><strong>لا توجد خطة بعد</strong><button type="button" className="ca-btn" onClick={() => onGoto('plans')}>رفع خطة</button></div></section>;
  const pr = cls ? planProgress(ws, plan, cls.classKey, today) : null;

  const report = pr ? [
    `تقرير تنفيذ الخطة الفصلية — ${planLabel(plan)} — ${cls.label}`,
    `حتى ${fmtD(today)}: نُفذت ${pr.doneSessions} من ${pr.totalSessions} حصة (${pr.pct}%)، واكتمل ${pr.completed} من ${pr.total} درسًا، وبدأ تنفيذ ${pr.started}.`,
    pr.overdue.length ? `دروس متأخرة عن فترتها: ${pr.overdue.map((s) => s.lesson.title).join('، ')}.` : 'لا توجد دروس متأخرة عن فترتها.',
    pr.needsCompletion.length ? `تحتاج استكمالًا أو موعدًا بديلًا: ${pr.needsCompletion.map((s) => s.lesson.title).join('، ')}.` : '',
    pr.missingSessions ? `${pr.missingSessions} درس بلا عدد حصص محدد في الخطة (غير محسوب في النسبة).` : '',
  ].filter(Boolean).join('\n') : '';

  return (
    <div className="ca-stack">
      <section className="ca-card">
        <div className="ca-row ca-wrap">
          <select className="ca-input lp-w14" value={plan.id} onChange={(e) => { setPlanId(e.target.value); setClassKey(''); }} aria-label="الخطة">{ws.plans.map((p) => <option key={p.id} value={p.id}>{planLabel(p)}</option>)}</select>
          <select className="ca-input lp-w14" value={cls ? cls.classKey : ''} onChange={(e) => setClassKey(e.target.value)} aria-label="الصف والشعبة">{classes.length ? classes.map((c) => <option key={c.classKey} value={c.classKey}>{c.label}</option>) : <option>لا توجد شعب لهذا الصف</option>}</select>
        </div>
      </section>
      {pr && (
        <>
          <section className="ca-card lp-progress">
            <div className="lp-bigpct" role="progressbar" aria-valuenow={pr.pct} aria-valuemin={0} aria-valuemax={100}><strong>{pr.pct}%</strong><span>من حصص الخطة نُفذت فعليًا</span><div className="ca-progress"><i style={{ width: `${pr.pct}%` }} /></div></div>
            <div className="lp-tiles">
              <div><b>{pr.total}</b><span>درس في الخطة</span></div>
              <div><b>{pr.started}</b><span>بدأ تنفيذها</span></div>
              <div><b>{pr.completed}</b><span>مكتملة</span></div>
              <div><b>{pr.doneSessions}</b><span>حصة منفذة</span></div>
              <div><b>{pr.remainingSessions}</b><span>حصة متبقية</span></div>
              <div className={pr.overdue.length ? 'is-bad' : ''}><b>{pr.overdue.length}</b><span>متأخرة عن فترتها</span></div>
              <div className={pr.needsCompletion.length ? 'is-warn' : ''}><b>{pr.needsCompletion.length}</b><span>تحتاج استكمالًا/موعدًا</span></div>
              <div className={pr.awaiting.length ? 'is-warn' : ''}><b>{pr.awaiting.length}</b><span>بانتظار تسجيلك</span></div>
            </div>
            {pr.missingSessions > 0 && <p className="ca-muted ca-small">{pr.missingSessions} درس بلا عدد حصص محدد في الخطة؛ لا يدخل في النسبة حتى تحدده.</p>}
          </section>
          <section className="ca-card">
            <div className="ca-card-head"><div><h3>الدروس</h3></div><button type="button" className="ca-btn is-ghost is-sm" onClick={async () => { try { await navigator.clipboard.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* */ } }}><Icon n="copy" size={15} />{copied ? 'نُسخ' : 'نسخ تقرير مختصر'}</button></div>
            <table className="lp-table">
              <thead><tr><th>الدرس</th><th>الفترة في الخطة</th><th>الحصص</th><th>الحالة</th></tr></thead>
              <tbody>
                {pr.lessons.map((s) => (
                  <tr key={s.lesson.id} className={s.lesson.end && s.lesson.end < today && !s.complete ? 'is-bad' : ''}>
                    <td><b>{s.lesson.title}</b>{s.unitTitle ? <div className="ca-muted ca-small">{s.unitTitle}</div> : null}</td>
                    <td className="ca-small">{s.lesson.start ? `${fmtD(s.lesson.start)} ← ${fmtD(s.lesson.end)}` : '—'}</td>
                    <td>{s.sessions ? `${Math.min(s.sessions, s.doneParts)}/${s.sessions}` : '؟'}</td>
                    <td>{s.complete ? <StatusBadge status="done" label="مكتمل" /> : s.lesson.end && s.lesson.end < today ? <StatusBadge status="overdue" /> : s.pendingCompletion ? <StatusBadge status="needs-completion" /> : s.postponed.length ? <StatusBadge status="postponed" label="مؤجلة بلا موعد" /> : s.started ? <StatusBadge status="partial" label="قيد التنفيذ" /> : s.scheduled.length ? <StatusBadge status="scheduled" /> : <StatusBadge status="unassigned" label="لم يبدأ" />}
                      {s.awaiting.length > 0 && <button type="button" className="ca-link" onClick={() => onRecord(s.awaiting[0].a.id)}>تسجيل</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details className="ca-details"><summary>نص التقرير</summary><pre className="lp-report-text">{report}</pre></details>
          </section>
        </>
      )}
    </div>
  );
}
