'use client';
// 📅 «التقويم المدرسي» داخل منبّه الحصص: الأعوام الدراسية + المواعيد الإدارية والتقويمية ومواعيد المادة والمناسبات + تذكيراتها.
// كل البيانات في store.calendar (على الجهاز لكل حساب، ومع المزامنة الاختيارية) وتُعدَّل من هنا دون أي تعديل برمجي.
import { useMemo, useState } from 'react';
import { Icon, Modal, Toggle } from './parts';
import {
  CATEGORIES, CAT, KINDS, SEMESTERS, HIJRI_MONTHS, BEFORE_CHOICES, STATUS_LABEL,
  listItems, upcomingGroups, itemsOnDay, monthGrid, addMonths, monthLabel, occurrence, statusOf, daysBetween, dayWord, rangeText, shortDate,
  remindPlan, saveEvent, deleteEvent, restoreEvent, purgeEvent, saveYear, setYearStatus, deleteYear, copyYearEvents, nextYearDraft, mergeSeed,
  buildCalendarICS, hijriEstimate, semesterOf,
} from '../core/calendar.js';
import { SEED_PACKS } from '../core/calendarSeed.js';
import { fmtDate, fmtTime, MONTHS, DAY_SHORT } from '../core/time.js';

const SRC_SHORT = { image: 'صورة المواعيد', plan: 'الخطة المبرمجة', guide: 'دليل المناسبات', manual: 'إدخال يدوي' };
const VIEWS = [{ id: 'upcoming', label: 'القادمة' }, { id: 'month', label: 'الشهر' }, { id: 'list', label: 'كل المواعيد' }, { id: 'review', label: 'تحتاج مراجعة' }];
const semLabel = (year, id) => ((year && year.semesters.find((s) => s.id === id)) || SEMESTERS.find((s) => s.id === id) || {}).name || (SEMESTERS.find((s) => s.id === id) || {}).label || '';

function whenText(it, today) {
  if (!it.occ) return it.est ? `مقترح: ${shortDate(it.est.start)}` : 'بلا تاريخ';
  const st = it.status;
  if (st === 'past') return 'انتهى';
  if (st === 'today') return 'اليوم';
  if (st === 'ongoing') { const left = daysBetween(today, it.occ.end); return left === 0 ? 'جارٍ – آخر يوم' : `جارٍ – ينتهي ${dayWord(left)}`; }
  return dayWord(daysBetween(today, it.occ.start));
}
function remindText(plan, isRange, h24) {
  if (!plan) return 'بلا تذكير';
  const parts = plan.before.map((n) => (n === 1 ? 'قبل يوم' : n === 2 ? 'قبل يومين' : n === 7 ? 'قبل أسبوع' : n === 14 ? 'قبل أسبوعين' : `قبل ${n} ${n <= 10 ? 'أيام' : 'يومًا'}`));
  if (plan.onStart) parts.push(isRange ? 'عند بدايته' : 'في يومه');
  if (isRange && plan.endBefore >= 0) parts.push(plan.endBefore === 0 ? 'في آخر يوم' : plan.endBefore === 1 ? 'قبل نهايته بيوم' : `قبل نهايته بـ ${plan.endBefore} أيام`);
  return parts.length ? `${parts.join('، ')} — الساعة ${fmtTime(plan.time, h24)}` : 'بلا تذكير';
}

function DateBlock({ occ, est }) {
  const k = occ ? occ.start : est ? est.start : '';
  if (!k) return <span className="ca-cal-date is-none"><Icon n="calendar" size={18} /><small>بلا تاريخ</small></span>;
  const [, m, d] = k.split('-').map(Number);
  return (
    <span className={`ca-cal-date${est && !occ ? ' is-est' : ''}`}>
      <b>{d}</b><small>{MONTHS[m - 1]}</small>
      {occ && occ.end !== occ.start && <em>← {shortDate(occ.end)}</em>}
    </span>
  );
}

function EventRow({ it, today, plan, onOpen }) {
  const { ev } = it;
  const c = CAT[ev.category];
  return (
    <li>
      <button type="button" className={`ca-cal-ev is-${it.status}${ev.enabled ? '' : ' is-off'}`} style={{ '--cc': c.color }} onClick={() => onOpen(ev.id)}>
        <DateBlock occ={it.occ} est={it.est} />
        <span className="ca-cal-ev-main">
          <span className="ca-cal-ev-title">{ev.title}</span>
          <span className="ca-cal-ev-tags">
            <span className="ca-cal-cat">{c.label}</span>
            {ev.grades && <span className="ca-badge">الصفوف {ev.grades}</span>}
            {ev.expected && <span className="ca-badge is-change">متوقع</span>}
            {ev.suspend && <span className="ca-badge is-cancel">يوقف الحصص</span>}
            {ev.review.need && <span className="ca-badge is-change"><Icon n="warn" size={12} /> مراجعة</span>}
            {!ev.enabled && <span className="ca-badge">معطّل</span>}
            <span className="ca-cal-src">{SRC_SHORT[ev.src.id] || ev.src.label}</span>
          </span>
        </span>
        <span className="ca-cal-ev-side">
          <span className={`ca-cal-when is-${it.status}`}>{whenText(it, today)}</span>
          <Icon n={plan ? 'bell' : 'bellOff'} size={15} className={plan ? 'ca-cal-bell' : 'ca-cal-bell is-off'} />
        </span>
      </button>
    </li>
  );
}

export default function CalendarView({ cal, onCalendar, now, tz, todayKey, h24, notify, alarmSettings }) {
  const [yearId, setYearId] = useState(cal.activeYearId);
  const year = cal.years.find((y) => y.id === yearId) || cal.years.find((y) => y.id === cal.activeYearId) || cal.years[0] || null;
  const [view, setView] = useState('upcoming');
  const [f, setF] = useState({ q: '', category: '', semester: '', source: '', status: '' });
  const [ym, setYm] = useState(todayKey.slice(0, 7));
  const [day, setDay] = useState(todayKey);
  const [modal, setModal] = useState(null); // { type: 'detail'|'edit'|'years'|'settings'|'trash', id?, draft? }
  const [showLater, setShowLater] = useState(false);

  const all = useMemo(() => (year ? listItems(cal, year.id, todayKey) : []), [cal, year, todayKey]);
  const filtered = useMemo(() => (year ? listItems(cal, year.id, todayKey, view === 'review' ? { ...f, status: 'review' } : f) : []), [cal, year, todayKey, f, view]);
  const groups = useMemo(() => upcomingGroups(all, todayKey), [all, todayKey]);
  const counts = useMemo(() => ({
    now: groups.now.length, week: groups.week.length, review: all.filter((i) => i.ev.review.need).length, none: all.filter((i) => !i.occ).length, total: all.length,
  }), [groups, all]);
  const planOf = (ev) => remindPlan(ev, cal.settings);
  const open = (id) => setModal({ type: 'detail', id });
  const ed = (draft) => setModal({ type: 'edit', draft });

  if (!year) {
    return (
      <section className="ca-card"><div className="ca-empty"><Icon n="calendar" size={34} /><strong>لا يوجد عام دراسي بعد</strong>
        <button type="button" className="ca-btn" onClick={() => setModal({ type: 'years' })}><Icon n="plus" />إنشاء عام دراسي</button></div>
        {modal && modal.type === 'years' && <YearsModal cal={cal} onCalendar={onCalendar} onClose={() => setModal(null)} notify={notify} onPick={setYearId} />}
      </section>
    );
  }

  const exportICS = () => {
    const ics = buildCalendarICS(cal, { yearId: year.id });
    if (!ics) { notify('لا توجد مواعيد بتواريخ لتصديرها.', 'err'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    a.download = `التقويم المدرسي ${year.name.replace('/', '-')}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    notify('نُزّل ملف التقويم. افتحه على هاتفك لإضافته إلى تقويم الجهاز بتذكيراته.');
  };

  const later = showLater ? groups.later : groups.later.slice(0, 8);
  const archived = year.status === 'archived';

  return (
    <div className="ca-stack ca-cal">
      <section className="ca-card ca-cal-head">
        <div className="ca-card-head">
          <div>
            <h3><Icon n="calendar" /> التقويم المدرسي</h3>
            <p className="ca-muted">المواعيد الإدارية والتقويمية ومواعيد المادة والمناسبات الوطنية والعالمية، مع تذكيرات تصدر من المنبّه نفسه.</p>
          </div>
          <div className="ca-row ca-wrap">
            <label className="ca-cal-year"><span className="ca-small ca-muted">العام الدراسي</span>
              <select className="ca-input" value={year.id} onChange={(e) => setYearId(e.target.value)} aria-label="العام الدراسي">
                {cal.years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.status === 'archived' ? ' (مؤرشف)' : ''}{y.id === cal.activeYearId ? ' • الحالي' : ''}</option>)}
              </select>
            </label>
            <button type="button" className="ca-btn" onClick={() => ed({ yearId: year.id, kind: 'day', category: 'other', start: day >= (year.start || '') && day <= (year.end || '9') ? day : '', remind: { mode: 'default' }, src: { id: 'manual', label: 'إدخال يدوي' } })}><Icon n="plus" />موعد جديد</button>
          </div>
        </div>
        {archived && <p className="ca-notice is-warn"><Icon n="info" /><span>هذا العام مؤرشف: تبقى مواعيده للاطلاع، ولا تصدر تذكيراته. فعّله من «الأعوام الدراسية» إن احتجت.</span></p>}
        <div className="ca-cal-stats">
          <button type="button" onClick={() => setView('upcoming')}><b>{counts.now}</b><span>اليوم والجارية</span></button>
          <button type="button" onClick={() => setView('upcoming')}><b>{counts.week}</b><span>خلال 7 أيام</span></button>
          <button type="button" className={counts.review ? 'is-warn' : ''} onClick={() => setView('review')}><b>{counts.review}</b><span>تحتاج مراجعة</span></button>
          <button type="button" onClick={() => { setView('list'); setF({ ...f, status: '' }); }}><b>{counts.total}</b><span>كل مواعيد العام</span></button>
        </div>
        <div className="ca-row ca-wrap ca-cal-tools">
          <button type="button" className="ca-btn is-ghost is-sm" onClick={() => setModal({ type: 'years' })}><Icon n="calendar" size={15} />الأعوام الدراسية</button>
          <button type="button" className="ca-btn is-ghost is-sm" onClick={() => setModal({ type: 'settings' })}><Icon n="bell" size={15} />إعدادات التذكير</button>
          <button type="button" className="ca-btn is-ghost is-sm" onClick={exportICS}><Icon n="download" size={15} />تصدير إلى تقويم الهاتف (.ics)</button>
          {cal.trash.length > 0 && <button type="button" className="ca-btn is-ghost is-sm" onClick={() => setModal({ type: 'trash' })}><Icon n="trash" size={15} />المحذوفات ({cal.trash.length})</button>}
        </div>
      </section>

      <section className="ca-card">
        <div className="ca-seg" role="tablist" aria-label="طريقة العرض">
          {VIEWS.map((v) => <button key={v.id} type="button" role="tab" aria-selected={view === v.id} className={view === v.id ? 'is-on' : ''} onClick={() => setView(v.id)}>{v.label}{v.id === 'review' && counts.review ? ` (${counts.review})` : ''}</button>)}
        </div>

        {(view === 'list' || view === 'review' || view === 'month') && (
          <div className="ca-cal-filters">
            <input className="ca-input" type="search" placeholder="ابحث باسم الموعد أو المناسبة…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="بحث" />
            <select className="ca-input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="التصنيف"><option value="">كل التصنيفات</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
            <select className="ca-input" value={f.semester} onChange={(e) => setF({ ...f, semester: e.target.value })} aria-label="الفصل الدراسي"><option value="">كل الفصول</option>{year.semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <select className="ca-input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} aria-label="المصدر"><option value="">كل المصادر</option>{Object.entries(SRC_SHORT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            {view === 'list' && <select className="ca-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="الحالة"><option value="">كل الحالات</option><option value="upcoming">القادمة والجارية</option><option value="past">المنتهية</option><option value="unscheduled">بلا تاريخ</option><option value="disabled">المعطّلة</option></select>}
          </div>
        )}

        {view === 'upcoming' && (
          <div className="ca-cal-groups">
            {[['now', 'اليوم والجارية الآن'], ['week', 'خلال الأيام السبعة القادمة'], ['month', 'خلال الشهر القادم']].map(([k, t]) => (groups[k].length > 0 && (
              <div key={k}><h4 className="ca-cal-gh">{t} <span className="ca-badge">{groups[k].length}</span></h4>
                <ul className="ca-cal-list">{groups[k].map((it) => <EventRow key={it.ev.id} it={it} today={todayKey} plan={planOf(it.ev)} onOpen={open} />)}</ul></div>
            )))}
            {groups.later.length > 0 && (
              <div><h4 className="ca-cal-gh">لاحقًا <span className="ca-badge">{groups.later.length}</span></h4>
                <ul className="ca-cal-list">{later.map((it) => <EventRow key={it.ev.id} it={it} today={todayKey} plan={planOf(it.ev)} onOpen={open} />)}</ul>
                {groups.later.length > later.length && <button type="button" className="ca-btn is-ghost is-sm ca-mt" onClick={() => setShowLater(true)}>عرض {groups.later.length - later.length} موعدًا آخر</button>}
              </div>
            )}
            {!groups.now.length && !groups.week.length && !groups.month.length && !groups.later.length && <div className="ca-empty"><Icon n="calendar" size={30} />لا مواعيد قادمة في هذا العام.</div>}
          </div>
        )}

        {view === 'month' && <MonthView cal={cal} year={year} ym={ym} setYm={setYm} day={day} setDay={setDay} today={todayKey} f={f} onOpen={open} planOf={planOf} />}

        {(view === 'list' || view === 'review') && (
          filtered.length ? (
            <ListByMonth items={filtered} today={todayKey} planOf={planOf} onOpen={open} review={view === 'review'} />
          ) : <div className="ca-empty"><Icon n="calendar" size={28} />{view === 'review' ? 'لا توجد عناصر تحتاج مراجعة.' : 'لا توجد نتائج مطابقة.'}</div>
        )}
      </section>

      {modal && modal.type === 'detail' && (() => {
        const ev = cal.events.find((e) => e.id === modal.id);
        if (!ev) return null;
        return <DetailModal ev={ev} year={cal.years.find((y) => y.id === ev.yearId) || year} cal={cal} today={todayKey} h24={h24} onClose={() => setModal(null)}
          onEdit={() => ed(ev)} onSave={(patch, msg) => { onCalendar((c) => saveEvent(c, { ...ev, ...patch })); if (msg) notify(msg); }}
          onDelete={() => { if (window.confirm(`حذف «${ev.title}»؟ يمكنك استرجاعه من «المحذوفات» خلال 60 يومًا.`)) { onCalendar((c) => deleteEvent(c, ev.id)); setModal(null); notify('نُقل الموعد إلى المحذوفات.'); } }}
          onDuplicate={() => ed({ ...ev, id: '', seedId: '', title: `${ev.title} (نسخة)`, history: [], src: { id: 'manual', label: 'إدخال يدوي', ref: `نسخة من: ${ev.title}` } })} />;
      })()}
      {modal && modal.type === 'edit' && <EditModal draft={modal.draft} cal={cal} year={year} alarmTime={cal.settings.time} onClose={() => setModal(modal.draft.id ? { type: 'detail', id: modal.draft.id } : null)}
        onSave={(ev) => { onCalendar((c) => saveEvent(c, ev)); setModal(null); notify(ev.id ? 'حُفظت التعديلات.' : 'أُضيف الموعد.'); }} />}
      {modal && modal.type === 'years' && <YearsModal cal={cal} onCalendar={onCalendar} onClose={() => setModal(null)} notify={notify} onPick={setYearId} current={year.id} />}
      {modal && modal.type === 'settings' && <SettingsModal cal={cal} onCalendar={onCalendar} onClose={() => setModal(null)} notify={notify} alarmSettings={alarmSettings} h24={h24} />}
      {modal && modal.type === 'trash' && <TrashModal cal={cal} onCalendar={onCalendar} onClose={() => setModal(null)} notify={notify} />}
    </div>
  );
}

function ListByMonth({ items, today, planOf, onOpen, review }) {
  const groups = [];
  for (const it of items) {
    const k = it.occ ? it.occ.start.slice(0, 7) : 'none';
    if (!groups.length || groups[groups.length - 1].k !== k) groups.push({ k, items: [] });
    groups[groups.length - 1].items.push(it);
  }
  return (
    <div className="ca-cal-groups">
      {groups.map((g) => (
        <div key={g.k}><h4 className="ca-cal-gh">{g.k === 'none' ? 'بلا تاريخ محدد' : monthLabel(g.k)} <span className="ca-badge">{g.items.length}</span></h4>
          <ul className="ca-cal-list">{g.items.map((it) => (
            <div key={it.ev.id}>
              <EventRow it={it} today={today} plan={planOf(it.ev)} onOpen={onOpen} />
              {review && it.ev.review.note && <p className="ca-cal-review-note"><Icon n="warn" size={14} /> {it.ev.review.note}</p>}
            </div>
          ))}</ul>
        </div>
      ))}
    </div>
  );
}

function MonthView({ cal, year, ym, setYm, day, setDay, today, f, onOpen, planOf }) {
  const weeks = monthGrid(ym);
  const match = (ev) => (!f.category || ev.category === f.category) && (!f.source || ev.src.id === f.source) && (!f.q || ev.title.includes(f.q.trim()))
    && (!f.semester || (ev.semester || semesterOf(year, (occurrence(ev, year) || {}).start || '')) === f.semester);
  const dayItems = (k) => itemsOnDay(cal, k, year.id).filter((x) => match(x.ev));
  const sel = dayItems(day).map((x) => ({ ev: x.ev, occ: x.occ, status: statusOf(x.occ, today), est: null }));
  return (
    <div className="ca-cal-month">
      <div className="ca-row ca-wrap ca-cal-mnav">
        <button type="button" className="ca-icon-btn" onClick={() => setYm(addMonths(ym, -1))} aria-label="الشهر السابق"><Icon n="back" /></button>
        <strong className="ca-cal-mtitle">{monthLabel(ym)}</strong>
        <button type="button" className="ca-icon-btn" onClick={() => setYm(addMonths(ym, 1))} aria-label="الشهر التالي"><Icon n="back" className="ca-flip" /></button>
        <button type="button" className="ca-btn is-ghost is-sm" onClick={() => { setYm(today.slice(0, 7)); setDay(today); }}>اليوم</button>
      </div>
      <div className="ca-cal-grid" role="grid" aria-label={monthLabel(ym)}>
        {DAY_SHORT.map((d, i) => <div key={d} className={`ca-cal-dow${i >= 5 ? ' is-we' : ''}`} role="columnheader">{d}</div>)}
        {weeks.flat().map((k, i) => {
          if (!k) return <div key={`x${i}`} className="ca-cal-cell is-empty" />;
          const its = dayItems(k);
          const marks = its.filter((x) => x.occ.start === k || x.occ.end === k || x.occ.start === x.occ.end);
          const running = its.length - marks.length;
          const wd = i % 7;
          return (
            <button key={k} type="button" role="gridcell" aria-selected={k === day} aria-label={`${fmtDate(k)}: ${its.length} موعد`}
              className={`ca-cal-cell${k === today ? ' is-today' : ''}${k === day ? ' is-sel' : ''}${wd >= 5 ? ' is-we' : ''}${its.some((x) => x.ev.suspend) ? ' is-hol' : ''}`} onClick={() => setDay(k)}>
              <span className="ca-cal-dn">{+k.slice(8)}</span>
              {marks.slice(0, 3).map((x) => <span key={x.ev.id} className="ca-cal-chip" style={{ '--cc': CAT[x.ev.category].color }}>{x.occ.start !== x.occ.end && x.occ.end === k && x.occ.start !== k ? 'نهاية: ' : ''}{x.ev.title}</span>)}
              {(marks.length > 3 || running > 0) && <span className="ca-cal-more">{marks.length > 3 ? `+${marks.length - 3}` : ''}{running > 0 ? ` ${running} جارية` : ''}</span>}
            </button>
          );
        })}
      </div>
      <h4 className="ca-cal-gh ca-mt">{fmtDate(day)} <span className="ca-badge">{sel.length}</span></h4>
      {sel.length ? <ul className="ca-cal-list">{sel.map((it) => <EventRow key={it.ev.id} it={it} today={today} plan={planOf(it.ev)} onOpen={onOpen} />)}</ul> : <p className="ca-muted ca-small">لا مواعيد في هذا اليوم.</p>}
    </div>
  );
}

function DetailModal({ ev, year, cal, today, h24, onClose, onEdit, onSave, onDelete, onDuplicate }) {
  const occ = occurrence(ev, year);
  const est = !occ && ev.hijri ? hijriEstimate(year, ev.hijri) : null;
  const st = statusOf(occ, today);
  const plan = remindPlan(ev, cal.settings);
  const [notes, setNotes] = useState(ev.notes);
  const [hist, setHist] = useState(false);
  const c = CAT[ev.category];
  const sem = ev.semester || (occ ? semesterOf(year, occ.start) : '');
  const why = !plan ? (!ev.enabled ? 'الموعد معطّل' : ev.remind.mode === 'off' ? 'أوقفت تذكير هذا الموعد' : !cal.settings.enabled ? 'تذكيرات التقويم متوقفة' : `تذكيرات تصنيف «${c.label}» متوقفة في إعدادات التذكير`) : '';
  return (
    <Modal title={ev.title} onClose={onClose} wide footer={<>
      <button type="button" className="ca-btn" onClick={onEdit}><Icon n="edit" />تعديل</button>
      <button type="button" className="ca-btn is-ghost" onClick={() => onSave({ enabled: !ev.enabled }, ev.enabled ? 'عُطّل الموعد (لا يظهر تذكيره).' : 'فُعّل الموعد.')}>{ev.enabled ? 'تعطيل' : 'تفعيل'}</button>
      <button type="button" className="ca-btn is-ghost" onClick={onDuplicate}><Icon n="copy" />نسخ</button>
      <span className="ca-grow" />
      <button type="button" className="ca-btn is-danger" onClick={onDelete}><Icon n="trash" />حذف</button>
    </>}>
      <div className="ca-cal-detail" style={{ '--cc': c.color }}>
        <div className="ca-row ca-wrap">
          <span className="ca-cal-cat is-big">{c.label}</span>
          <span className={`ca-cal-when is-${st}`}>{STATUS_LABEL[st]}{occ && st !== 'past' ? ` • ${whenText({ occ, status: st }, today)}` : ''}</span>
          {!ev.enabled && <span className="ca-badge">معطّل</span>}
        </div>
        {ev.review.need && (
          <div className="ca-notice is-warn"><Icon n="warn" /><span><b>يحتاج مراجعة: </b>{ev.review.note || 'راجع هذا الموعد.'}</span>
            <button type="button" className="ca-btn is-sm" onClick={() => onSave({ review: { need: false, note: ev.review.note } }, 'سُجّل أنك راجعت الموعد.')}>تمت المراجعة</button></div>
        )}
        <dl className="ca-cal-dl">
          <dt>التاريخ</dt><dd>{occ ? <>{rangeText(occ)}{occ.end !== occ.start && <small className="ca-muted"> ({daysBetween(occ.start, occ.end) + 1} يومًا)</small>}</> : <>لم يُحدَّد لهذا العام{ev.rule && <> — «{ev.rule}»</>}</>}</dd>
          {est && <><dt>التاريخ المقترح</dt><dd>{rangeText(est)} <small className="ca-muted">(تقريبي حسب تقويم أم القرى — يُعتمد بعد إعلان الرؤية)</small>
            <button type="button" className="ca-btn is-sm ca-cal-inline" onClick={() => onSave({ start: est.start, end: est.end, review: { need: false, note: `اعتُمد التاريخ المقترح ${est.start}` } }, 'اعتُمد التاريخ المقترح. عدّله إن اختلف إعلان الرؤية.')}>اعتماد هذا التاريخ</button></dd></>}
          {ev.kind === 'annual' && <><dt>التكرار</dt><dd>مناسبة سنوية بتاريخ ميلادي ثابت — يُحسب تاريخها تلقائيًا في كل عام دراسي</dd></>}
          {ev.hijri && <><dt>التاريخ الهجري</dt><dd>{ev.hijri.d}{ev.hijri.d2 ? `–${ev.hijri.d2}` : ''} {HIJRI_MONTHS[ev.hijri.m - 1]}</dd></>}
          {ev.grades && <><dt>الصفوف</dt><dd>{ev.grades}</dd></>}
          <dt>العام والفصل</dt><dd>{year.name}{sem ? ` — ${semLabel(year, sem)}` : ''}</dd>
          <dt>النوع</dt><dd>{(KINDS.find((k) => k.id === ev.kind) || {}).label}{ev.expected ? ' • موعد متوقع (لم يُعلن رسميًا)' : ''}{ev.suspend ? ' • يوقف تنبيهات الحصص في أيامه' : ''}</dd>
          <dt>التذكير</dt><dd>{plan ? remindText(plan, !!occ && occ.end !== occ.start, h24) : <span className="ca-muted">لا تذكير — {why}</span>}</dd>
          <dt>المصدر</dt><dd>{ev.src.label}{ev.src.ref && <small className="ca-cal-ref">{ev.src.ref}</small>}</dd>
          {ev.desc && <><dt>الوصف</dt><dd>{ev.desc}</dd></>}
        </dl>
        <label className="ca-field"><span className="ca-label">ملاحظاتي</span>
          <textarea className="ca-input" rows={2} maxLength={1500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظة شخصية تظهر مع التذكير…" /></label>
        {notes !== ev.notes && <button type="button" className="ca-btn is-sm" onClick={() => onSave({ notes }, 'حُفظت الملاحظة.')}><Icon n="check" />حفظ الملاحظة</button>}
        {ev.history.length > 0 && (
          <div className="ca-mt"><button type="button" className="ca-link" onClick={() => setHist(!hist)} aria-expanded={hist}>سجل التعديلات ({ev.history.length})</button>
            {hist && <ul className="ca-cal-hist">{[...ev.history].reverse().map((h, i) => <li key={i}><bdi>{new Date(h.at).toLocaleString('ar-OM')}</bdi> — {h.what}</li>)}</ul>}</div>
        )}
      </div>
    </Modal>
  );
}

const ENDS = [[-1, 'بلا تذكير بالنهاية'], [0, 'في آخر يوم'], [1, 'قبل النهاية بيوم'], [2, 'قبل النهاية بيومين'], [3, 'قبل النهاية بـ 3 أيام'], [7, 'قبل النهاية بأسبوع']];
function EditModal({ draft, cal, year, onClose, onSave, alarmTime }) {
  const [d, setD] = useState(() => ({
    title: '', desc: '', category: 'other', kind: 'day', start: '', end: '', annual: { m: 9, d: 1, m2: 0, d2: 0, month: false }, rule: '', hijri: null,
    semester: '', grades: '', review: { need: false, note: '' }, expected: false, suspend: false, enabled: true, notes: '',
    remind: { mode: 'default', before: [], onStart: true, endBefore: -1, time: '' }, ...draft,
    annual: draft.annual || { m: 9, d: 1, m2: 0, d2: 0, month: false }, remind: { mode: 'default', before: [], onStart: true, endBefore: -1, time: '', ...(draft.remind || {}) },
    review: draft.review || { need: false, note: '' },
  }));
  const [err, setErr] = useState('');
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const setA = (k, v) => setD((x) => ({ ...x, annual: { ...x.annual, [k]: v } }));
  const setR = (k, v) => setD((x) => ({ ...x, remind: { ...x.remind, [k]: v } }));
  const yr = cal.years.find((y) => y.id === (d.yearId || year.id)) || year;
  const est = d.kind === 'variable' && d.hijri ? hijriEstimate(yr, d.hijri) : null;
  const isRange = d.kind === 'range' || (d.kind === 'annual' && (d.annual.month || d.annual.m2)) || (d.kind === 'variable' && d.end && d.end !== d.start);
  const save = () => {
    if (!d.title.trim()) { setErr('اكتب اسم الموعد.'); return; }
    if ((d.kind === 'day' || d.kind === 'range') && !d.start) { setErr('حدّد تاريخ البداية.'); return; }
    if (d.kind === 'range' && (!d.end || d.end < d.start)) { setErr('تاريخ النهاية يجب أن يكون بعد البداية.'); return; }
    if (d.kind === 'annual' && !d.annual.month && !(d.annual.d >= 1 && d.annual.d <= 31)) { setErr('حدّد يوم المناسبة.'); return; }
    if (d.remind.mode === 'custom' && !d.remind.before.length && !d.remind.onStart && d.remind.endBefore < 0) { setErr('اختر وقتًا واحدًا على الأقل للتذكير، أو اختر «بلا تذكير».'); return; }
    onSave({ ...d, yearId: d.yearId || year.id, end: d.kind === 'day' ? d.start : d.end, annual: d.kind === 'annual' ? d.annual : null, src: d.src || { id: 'manual', label: 'إدخال يدوي' } });
  };
  return (
    <Modal title={d.id ? 'تعديل الموعد' : 'موعد جديد'} onClose={onClose} wide footer={<>
      <button type="button" className="ca-btn" onClick={save}><Icon n="check" />حفظ</button>
      <button type="button" className="ca-btn is-ghost" onClick={onClose}>إلغاء</button>
      {err && <span className="ca-warn-text" role="alert">{err}</span>}
    </>}>
      <div className="ca-form-grid">
        <label className="ca-field ca-span"><span className="ca-label">اسم الموعد أو المناسبة *</span><input className="ca-input" value={d.title} maxLength={160} onChange={(e) => set('title', e.target.value)} /></label>
        <label className="ca-field"><span className="ca-label">التصنيف</span><select className="ca-input" value={d.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label className="ca-field"><span className="ca-label">العام الدراسي</span><select className="ca-input" value={d.yearId || year.id} onChange={(e) => set('yearId', e.target.value)}>{cal.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></label>
      </div>
      <span className="ca-label">نوع الموعد</span>
      <div className="ca-seg">{KINDS.map((k) => <button key={k.id} type="button" className={d.kind === k.id ? 'is-on' : ''} aria-pressed={d.kind === k.id} onClick={() => set('kind', k.id)}>{k.label}</button>)}</div>
      <div className="ca-form-grid">
        {(d.kind === 'day' || d.kind === 'range' || d.kind === 'variable') && <label className="ca-field"><span className="ca-label">{d.kind === 'day' ? 'التاريخ' : d.kind === 'variable' ? 'تاريخ هذا العام (إن عُرف)' : 'تاريخ البداية'}</span><input className="ca-input" type="date" value={d.start} onChange={(e) => set('start', e.target.value)} /></label>}
        {(d.kind === 'range' || d.kind === 'variable') && <label className="ca-field"><span className="ca-label">تاريخ النهاية{d.kind === 'variable' ? ' (اختياري)' : ''}</span><input className="ca-input" type="date" value={d.end} min={d.start || undefined} onChange={(e) => set('end', e.target.value)} /></label>}
        {d.kind === 'annual' && <>
          <label className="ca-field"><span className="ca-label">الشهر</span><select className="ca-input" value={d.annual.m} onChange={(e) => setA('m', +e.target.value)}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
          {!d.annual.month && <label className="ca-field"><span className="ca-label">اليوم</span><input className="ca-input" type="number" min={1} max={31} value={d.annual.d} onChange={(e) => setA('d', +e.target.value)} /></label>}
          {!d.annual.month && <label className="ca-field"><span className="ca-label">ينتهي (اختياري): اليوم</span><input className="ca-input" type="number" min={0} max={31} value={d.annual.d2 || ''} placeholder="—" onChange={(e) => { setA('d2', +e.target.value || 0); setA('m2', +e.target.value ? (d.annual.m2 || d.annual.m) : 0); }} /></label>}
          <div className="ca-field"><Toggle checked={d.annual.month} onChange={(v) => setA('month', v)} label="الشهر كاملًا" hint="مثل «شهر ديسمبر من كل عام»" /></div>
        </>}
        {d.kind === 'variable' && <>
          <label className="ca-field"><span className="ca-label">التوقيت كما يرد سنويًا</span><input className="ca-input" value={d.rule} maxLength={200} placeholder="مثل: النصف الثاني من سبتمبر" onChange={(e) => set('rule', e.target.value)} /></label>
          <label className="ca-field"><span className="ca-label">تاريخ هجري (اختياري)</span>
            <span className="ca-row"><input className="ca-input" type="number" min={1} max={30} style={{ maxWidth: '5rem' }} value={d.hijri ? d.hijri.d : ''} placeholder="اليوم" onChange={(e) => set('hijri', +e.target.value ? { m: d.hijri ? d.hijri.m : 1, d: +e.target.value, d2: 0 } : null)} />
              <select className="ca-input" value={d.hijri ? d.hijri.m : ''} onChange={(e) => set('hijri', e.target.value ? { d: d.hijri ? d.hijri.d : 1, d2: 0, m: +e.target.value } : null)}><option value="">— الشهر —</option>{HIJRI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></span></label>
          {est && <div className="ca-field"><span className="ca-label">التاريخ المقترح (تقريبي)</span><button type="button" className="ca-btn is-ghost is-sm" onClick={() => setD((x) => ({ ...x, start: est.start, end: est.end }))}>{rangeText(est)} — استخدامه</button></div>}
        </>}
      </div>
      <div className="ca-form-grid">
        <label className="ca-field"><span className="ca-label">الفصل الدراسي</span><select className="ca-input" value={d.semester} onChange={(e) => set('semester', e.target.value)}><option value="">تلقائي حسب التاريخ</option>{yr.semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="ca-field"><span className="ca-label">الصفوف المستهدفة</span><input className="ca-input" value={d.grades} maxLength={40} placeholder="مثل: 5-11 أو 12" onChange={(e) => set('grades', e.target.value)} /></label>
      </div>
      <label className="ca-field"><span className="ca-label">الوصف (اختياري)</span><textarea className="ca-input" rows={2} maxLength={1200} value={d.desc} onChange={(e) => set('desc', e.target.value)} /></label>

      <fieldset className="ca-cal-fs"><legend>التذكير</legend>
        <div className="ca-seg">{[['default', 'حسب الإعدادات العامة'], ['custom', 'مخصص لهذا الموعد'], ['off', 'بلا تذكير']].map(([k, t]) => <button key={k} type="button" className={d.remind.mode === k ? 'is-on' : ''} aria-pressed={d.remind.mode === k} onClick={() => setR('mode', k)}>{t}</button>)}</div>
        {d.remind.mode === 'default' && <p className="ca-small ca-muted">يتبع إعدادات التذكير العامة وتصنيف «{CAT[d.category].label}» ({cal.settings.cats[d.category] ? 'مفعّل' : 'متوقف حاليًا'}).</p>}
        {d.remind.mode === 'custom' && <>
          <span className="ca-label">قبل الموعد</span>
          <div className="ca-row ca-wrap">{BEFORE_CHOICES.map((n) => { const on = d.remind.before.includes(n); return <button key={n} type="button" className={`ca-chip ca-chip-btn${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => setR('before', on ? d.remind.before.filter((x) => x !== n) : [...d.remind.before, n])}>{n === 1 ? 'بيوم' : n === 7 ? 'بأسبوع' : n === 14 ? 'بأسبوعين' : `بـ ${n} أيام`}</button>; })}
            <input className="ca-input" type="number" min={1} max={60} style={{ maxWidth: '7rem' }} placeholder="عدد آخر" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const n = +e.currentTarget.value; if (n >= 1 && n <= 60 && !d.remind.before.includes(n)) setR('before', [...d.remind.before, n]); e.currentTarget.value = ''; } }} aria-label="عدد أيام آخر ثم Enter" />
            {d.remind.before.filter((n) => !BEFORE_CHOICES.includes(n)).map((n) => <button key={n} type="button" className="ca-chip ca-chip-btn is-on" onClick={() => setR('before', d.remind.before.filter((x) => x !== n))}>بـ {n} يومًا ×</button>)}</div>
          <Toggle checked={d.remind.onStart} onChange={(v) => setR('onStart', v)} label={isRange ? 'تذكير عند بداية الفترة' : 'تذكير في يوم الموعد'} />
          {isRange && <label className="ca-field"><span className="ca-label">قبل نهاية الفترة</span><select className="ca-input" value={d.remind.endBefore} onChange={(e) => setR('endBefore', +e.target.value)}>{ENDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>}
          <label className="ca-field" style={{ maxWidth: '12rem' }}><span className="ca-label">ساعة التذكير</span><input className="ca-input" type="time" value={d.remind.time || alarmTime} onChange={(e) => setR('time', e.target.value)} /></label>
        </>}
      </fieldset>

      <div className="ca-cal-toggles">
        <Toggle checked={d.enabled} onChange={(v) => set('enabled', v)} label="الموعد مفعّل" hint="المعطّل يبقى في التقويم بلا تذكير" />
        <Toggle checked={d.suspend} onChange={(v) => set('suspend', v)} label="إجازة: يوقف تنبيهات الحصص في أيامه" />
        <Toggle checked={d.expected} onChange={(v) => set('expected', v)} label="موعد متوقع (لم يُعلن رسميًا)" />
        <Toggle checked={d.review.need} onChange={(v) => set('review', { ...d.review, need: v })} label="يحتاج مراجعة" />
      </div>
      {d.review.need && <label className="ca-field"><span className="ca-label">ملاحظة المراجعة</span><input className="ca-input" value={d.review.note} maxLength={600} onChange={(e) => set('review', { ...d.review, note: e.target.value })} /></label>}
      <label className="ca-field"><span className="ca-label">ملاحظاتي الشخصية</span><textarea className="ca-input" rows={2} maxLength={1500} value={d.notes} onChange={(e) => set('notes', e.target.value)} /></label>
      {d.src && d.src.id !== 'manual' && <p className="ca-small ca-muted">المصدر: {d.src.label}{d.src.ref ? ` — ${d.src.ref}` : ''}</p>}
    </Modal>
  );
}

function YearForm({ init, onSave, onCancel, copyFrom, cal }) {
  const [y, setY] = useState(init);
  const [copy, setCopy] = useState({ on: !!copyFrom, oneTime: false });
  const [err, setErr] = useState('');
  const setS = (i, k, v) => setY((x) => ({ ...x, semesters: x.semesters.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));
  const save = () => {
    if (!y.name.trim()) { setErr('اكتب اسم العام (مثل 2027/2028).'); return; }
    if (!y.start || !y.end || y.end <= y.start) { setErr('حدّد بداية العام ونهايته (النهاية بعد البداية).'); return; }
    if (!y.id && cal.years.some((x) => x.name === y.name.trim())) { setErr('يوجد عام بهذا الاسم.'); return; }
    for (const s of y.semesters) if (s.start && s.end && (s.end < s.start || s.start < y.start || s.end > y.end)) { setErr(`تواريخ «${s.name}» يجب أن تكون داخل العام ونهايتها بعد بدايتها.`); return; }
    onSave({ ...y, name: y.name.trim() }, copy);
  };
  return (
    <div className="ca-cal-yform">
      <div className="ca-form-grid">
        <label className="ca-field"><span className="ca-label">اسم العام الدراسي</span><input className="ca-input" value={y.name} placeholder="2027/2028" onChange={(e) => setY({ ...y, name: e.target.value })} /></label>
        <label className="ca-field"><span className="ca-label">بداية العام</span><input className="ca-input" type="date" value={y.start} onChange={(e) => setY({ ...y, start: e.target.value })} /></label>
        <label className="ca-field"><span className="ca-label">نهاية العام</span><input className="ca-input" type="date" value={y.end} onChange={(e) => setY({ ...y, end: e.target.value })} /></label>
      </div>
      <span className="ca-label">الفصول الدراسية</span>
      {y.semesters.map((s, i) => (
        <div key={i} className="ca-form-grid ca-cal-semrow">
          <input className="ca-input" value={s.name} onChange={(e) => setS(i, 'name', e.target.value)} aria-label="اسم الفصل" />
          <input className="ca-input" type="date" value={s.start} onChange={(e) => setS(i, 'start', e.target.value)} aria-label={`بداية ${s.name}`} />
          <input className="ca-input" type="date" value={s.end} onChange={(e) => setS(i, 'end', e.target.value)} aria-label={`نهاية ${s.name}`} />
          {y.semesters.length > 1 && <button type="button" className="ca-icon-btn" onClick={() => setY({ ...y, semesters: y.semesters.filter((_, j) => j !== i) })} aria-label="حذف الفصل"><Icon n="x" /></button>}
        </div>
      ))}
      {y.semesters.length < 4 && <button type="button" className="ca-btn is-ghost is-sm" onClick={() => setY({ ...y, semesters: [...y.semesters, { id: `s${y.semesters.length + 1}`, name: `الفصل الدراسي ${['الأول', 'الثاني', 'الثالث', 'الرابع'][y.semesters.length]}`, start: '', end: '' }] })}><Icon n="plus" size={14} />إضافة فصل</button>}
      {copyFrom && (
        <div className="ca-cal-copybox">
          <Toggle checked={copy.on} onChange={(v) => setCopy({ ...copy, on: v })} label={`نسخ المناسبات السنوية والمتغيرة من عام ${copyFrom.name}`} hint="السنوية تُحسب تواريخها تلقائيًا، والمتغيرة تُنسخ بلا تاريخ لتحدده. لا يحدث تكرار." />
          {copy.on && <Toggle checked={copy.oneTime} onChange={(v) => setCopy({ ...copy, oneTime: v })} label="نسخ المواعيد الإدارية والتقويمية أيضًا (بلا تواريخ)" hint="تظهر في «تحتاج مراجعة» حتى تدخل تواريخ العام الجديد" />}
        </div>
      )}
      <div className="ca-row ca-wrap ca-mt">
        <button type="button" className="ca-btn" onClick={save}><Icon n="check" />حفظ العام</button>
        <button type="button" className="ca-btn is-ghost" onClick={onCancel}>إلغاء</button>
        {err && <span className="ca-warn-text" role="alert">{err}</span>}
      </div>
    </div>
  );
}

function YearsModal({ cal, onCalendar, onClose, notify, onPick, current }) {
  const [form, setForm] = useState(null); // { init, copyFrom }
  const [copy, setCopy] = useState({ from: '', to: '', oneTime: false });
  const latest = [...cal.years].sort((a, b) => (b.start || '').localeCompare(a.start || ''))[0];
  const count = (id) => cal.events.filter((e) => e.yearId === id).length;
  const doCopy = (fromId, toId, oneTime) => {
    let res = null;
    onCalendar((c) => { res = copyYearEvents(c, fromId, toId, { oneTime }); return res.cal; });
    setTimeout(() => res && notify(`نُسخ ${res.added} عنصرًا${res.skipped ? `، وتُرك ${res.skipped} موجودًا مسبقًا دون تكرار` : ''}.`), 0);
  };
  return (
    <Modal title="الأعوام الدراسية" onClose={onClose} wide>
      {form ? (
        <YearForm init={form.init} copyFrom={form.copyFrom} cal={cal} onCancel={() => setForm(null)} onSave={(y, cp) => {
          const isNew = !y.id;
          const id = y.id || `y${Date.now().toString(36)}`;
          onCalendar((c) => saveYear(c, { ...y, id }));
          if (isNew && cp.on && form.copyFrom) setTimeout(() => doCopy(form.copyFrom.id, id, cp.oneTime), 0);
          notify(isNew ? `أُنشئ العام ${y.name}.` : 'حُفظت بيانات العام.');
          if (isNew) onPick(id);
          setForm(null);
        }} />
      ) : (
        <>
          <ul className="ca-cal-years">
            {cal.years.map((y) => (
              <li key={y.id} className={y.status === 'archived' ? 'is-arch' : ''}>
                <div><strong>{y.name}</strong> {y.id === cal.activeYearId && <span className="ca-badge is-done">العام الحالي</span>} {y.status === 'archived' && <span className="ca-badge">مؤرشف</span>}
                  <p className="ca-small ca-muted">{y.start ? `${fmtDate(y.start)} ← ${fmtDate(y.end)}` : 'بلا تواريخ'} • {count(y.id)} موعدًا • {y.semesters.map((s) => s.name).join('، ')}</p>
                  {y.note && <p className="ca-small ca-muted">{y.note}</p>}</div>
                <div className="ca-row ca-wrap">
                  <button type="button" className="ca-btn is-ghost is-sm" onClick={() => { onPick(y.id); onClose(); }}>عرض</button>
                  <button type="button" className="ca-btn is-ghost is-sm" onClick={() => setForm({ init: y })}><Icon n="edit" size={14} />تعديل</button>
                  {y.id !== cal.activeYearId && y.status !== 'archived' && <button type="button" className="ca-btn is-ghost is-sm" onClick={() => { onCalendar((c) => ({ ...c, activeYearId: y.id })); notify(`صار ${y.name} العام الحالي.`); }}>تعيينه عامًا حاليًا</button>}
                  <button type="button" className="ca-btn is-ghost is-sm" onClick={() => { onCalendar((c) => setYearStatus(c, y.id, y.status === 'archived' ? 'active' : 'archived')); notify(y.status === 'archived' ? 'أُعيد تفعيل العام.' : 'أُرشف العام (لا تصدر تذكيراته).'); }}>{y.status === 'archived' ? 'إلغاء الأرشفة' : 'أرشفة'}</button>
                  {cal.years.length > 1 && <button type="button" className="ca-btn is-danger is-sm" onClick={() => { if (window.confirm(`حذف العام ${y.name}؟ تنتقل مواعيده (${count(y.id)}) إلى المحذوفات ويمكن استرجاعها خلال 60 يومًا.`)) { onCalendar((c) => deleteYear(c, y.id)); notify('حُذف العام.'); } }}><Icon n="trash" size={14} /></button>}
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="ca-btn ca-mt" onClick={() => setForm({ init: latest ? nextYearDraft(latest) : { name: '', start: '', end: '', semesters: SEMESTERS.map((s) => ({ id: s.id, name: s.label, start: '', end: '' })) }, copyFrom: latest || null })}><Icon n="plus" />عام دراسي جديد</button>
          {cal.years.length > 1 && (
            <fieldset className="ca-cal-fs ca-mt"><legend>نسخ المناسبات بين عامين (دون تكرار)</legend>
              <div className="ca-form-grid">
                <label className="ca-field"><span className="ca-label">من</span><select className="ca-input" value={copy.from} onChange={(e) => setCopy({ ...copy, from: e.target.value })}><option value="">—</option>{cal.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></label>
                <label className="ca-field"><span className="ca-label">إلى</span><select className="ca-input" value={copy.to} onChange={(e) => setCopy({ ...copy, to: e.target.value })}><option value="">—</option>{cal.years.filter((y) => y.id !== copy.from).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></label>
              </div>
              <Toggle checked={copy.oneTime} onChange={(v) => setCopy({ ...copy, oneTime: v })} label="تضمين المواعيد الإدارية والتقويمية (تُنسخ بلا تواريخ)" />
              <button type="button" className="ca-btn is-sm ca-mt" disabled={!copy.from || !copy.to || copy.from === copy.to} onClick={() => doCopy(copy.from, copy.to, copy.oneTime)}><Icon n="copy" size={14} />نسخ</button>
            </fieldset>
          )}
          {current && <p className="ca-small ca-muted ca-mt">التذكيرات تصدر من كل الأعوام غير المؤرشفة. الأعوام والمواعيد محفوظة على هذا الجهاز ضمن بيانات المنبّه، وتنتقل إلى حسابك إن فعّلت المزامنة من تبويب «البيانات».</p>}
        </>
      )}
    </Modal>
  );
}

function SettingsModal({ cal, onCalendar, onClose, notify, alarmSettings, h24 }) {
  const s = cal.settings;
  const set = (patch) => onCalendar((c) => ({ ...c, settings: { ...c.settings, ...patch } }));
  const n = (id) => cal.events.filter((e) => e.category === id).length;
  return (
    <Modal title="إعدادات تذكيرات التقويم" onClose={onClose} wide>
      {!alarmSettings.enabled && <p className="ca-notice is-warn"><Icon n="warn" /><span>المنبّه متوقف من تبويب «التنبيهات»، فلن تصدر تذكيرات التقويم حتى تشغّله.</span></p>}
      <Toggle checked={s.enabled} onChange={(v) => set({ enabled: v })} label="تذكيرات التقويم المدرسي" hint="تصدر من المنبّه نفسه (صوت + نافذة + إشعار النظام حسب إعدادات التنبيه)" />
      <div className="ca-form-grid ca-mt">
        <label className="ca-field"><span className="ca-label">ساعة التذكير</span><input className="ca-input" type="time" value={s.time} onChange={(e) => set({ time: e.target.value || '07:00' })} /><small className="ca-muted">{fmtTime(s.time, h24)}</small></label>
        <label className="ca-field"><span className="ca-label">قبل نهاية الفترات</span><select className="ca-input" value={s.endBefore} onChange={(e) => set({ endBefore: +e.target.value })}>{ENDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      </div>
      <span className="ca-label">التذكير قبل الموعد</span>
      <div className="ca-row ca-wrap">{BEFORE_CHOICES.map((d) => { const on = s.before.includes(d); return <button key={d} type="button" className={`ca-chip ca-chip-btn${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => set({ before: (on ? s.before.filter((x) => x !== d) : [...s.before, d]).sort((a, b) => b - a) })}>{d === 1 ? 'قبل يوم' : d === 7 ? 'قبل أسبوع' : d === 14 ? 'قبل أسبوعين' : `قبل ${d} أيام`}</button>; })}</div>
      <Toggle checked={s.onStart} onChange={(v) => set({ onStart: v })} label="تذكير في يوم الموعد / عند بداية الفترة" />
      <Toggle checked={s.suspendClasses} onChange={(v) => set({ suspendClasses: v })} label="الإجازات المؤكدة في التقويم توقف تنبيهات الحصص" hint="مثل إجازة منتصف العام. الإجازات «المتوقعة» لا توقفها حتى تفعّل ذلك فيها بنفسك." />
      <fieldset className="ca-cal-fs ca-mt"><legend>التصنيفات التي يصدر لها تذكير (حسب الإعدادات العامة)</legend>
        <div className="ca-cal-cats">{CATEGORIES.map((c) => (
          <label key={c.id} className="ca-cal-catpick" style={{ '--cc': c.color }}>
            <input type="checkbox" checked={!!s.cats[c.id]} onChange={(e) => set({ cats: { ...s.cats, [c.id]: e.target.checked } })} />
            <span>{c.label}</span><small>{n(c.id)}</small>
          </label>
        ))}</div>
        <p className="ca-small ca-muted">المناسبات العالمية والصحية والبيئية وغيرها متوقفة افتراضيًا حتى لا تكثر التنبيهات؛ وتبقى ظاهرة في التقويم. ولأي موعد تذكيره الخاص من «تعديل».</p>
      </fieldset>
      <fieldset className="ca-cal-fs ca-mt"><legend>البيانات الأولية</legend>
        <p className="ca-small">مستوردة من: صورة مواعيد التقويم التربوي، والخطة المبرمجة للمهارات الموسيقية، ودليل المناسبات (82 مناسبة). لا يُعاد إنشاء ما حذفته إلا إن طلبت ذلك.</p>
        <button type="button" className="ca-btn is-ghost is-sm" onClick={() => {
          let added = 0;
          onCalendar((c) => { let x = c; for (const p of SEED_PACKS) { const r = mergeSeed(x, p, { restoreDeleted: true }); added += r.added; x = r.cal; } return x; });
          setTimeout(() => notify(added ? `أُعيد ${added} عنصرًا من البيانات الأولية.` : 'كل عناصر البيانات الأولية موجودة.'), 0);
        }}>استعادة عناصر البيانات الأولية المحذوفة</button>
      </fieldset>
      <p className="ca-notice is-info ca-mt"><Icon n="info" /><span><b>متى تصل التذكيرات؟</b> يصدرها المنبّه وهو مفتوح في المتصفح (أو مثبتًا كتطبيق) — وتصدر عند فتحه لاحقًا في اليوم نفسه إن فاتت ساعتها. ولتذكير مؤكد حتى والمتصفح مغلق، صدّر التقويم بملف <b>.ics</b> وأضفه إلى تقويم هاتفك: يحمل التذكيرات نفسها.</span></p>
    </Modal>
  );
}

function TrashModal({ cal, onCalendar, onClose, notify }) {
  return (
    <Modal title="المحذوفات" onClose={onClose}>
      <p className="ca-small ca-muted">تبقى المواعيد المحذوفة هنا 60 يومًا ثم تُحذف نهائيًا.</p>
      <ul className="ca-cal-years">{[...cal.trash].reverse().map((e) => (
        <li key={e.id}><div><strong>{e.title}</strong><p className="ca-small ca-muted">{(cal.years.find((y) => y.id === e.yearId) || {}).name || ''} • حُذف {new Date(e.deletedAt).toLocaleDateString('ar-OM')}</p></div>
          <div className="ca-row"><button type="button" className="ca-btn is-sm" onClick={() => { onCalendar((c) => restoreEvent(c, e.id)); notify('استُرجع الموعد.'); }}>استرجاع</button>
            <button type="button" className="ca-btn is-danger is-sm" onClick={() => { if (window.confirm('حذف نهائي لا يمكن التراجع عنه؟')) onCalendar((c) => purgeEvent(c, e.id)); }}>حذف نهائي</button></div></li>
      ))}</ul>
    </Modal>
  );
}

/** بطاقة صغيرة في «اليوم»: مواعيد التقويم الجارية والقريبة */
export function CalendarSoonCard({ cal, todayKey, onOpen }) {
  const items = useMemo(() => {
    if (!cal) return [];
    const out = [];
    for (const y of cal.years) {
      if (y.status === 'archived') continue;
      for (const it of listItems(cal, y.id, todayKey)) if (it.occ && it.ev.enabled && (it.status === 'today' || it.status === 'ongoing' || it.status === 'soon') && (CAT[it.ev.category].group === 'school' || cal.settings.cats[it.ev.category])) out.push(it);
    }
    return out.sort((a, b) => (a.status === 'soon' ? 1 : 0) - (b.status === 'soon' ? 1 : 0) || a.occ.start.localeCompare(b.occ.start));
  }, [cal, todayKey]);
  if (!items.length) return null;
  return (
    <section className="ca-card ca-cal-soon">
      <div className="ca-card-head"><div><h3><Icon n="calendar" /> من التقويم المدرسي</h3><p className="ca-muted">ما يجري الآن وما يقترب خلال أسبوع.</p></div>
        <button type="button" className="ca-btn is-ghost is-sm" onClick={onOpen}>فتح التقويم</button></div>
      <ul className="ca-cal-soon-list">{items.slice(0, 6).map((it) => (
        <li key={it.ev.id} style={{ '--cc': CAT[it.ev.category].color }}>
          <span className={`ca-cal-when is-${it.status}`}>{whenText(it, todayKey)}</span>
          <span className="ca-cal-soon-t">{it.ev.title}{it.ev.grades ? <small> • الصفوف {it.ev.grades}</small> : null}</span>
        </li>
      ))}</ul>
      {items.length > 6 && <button type="button" className="ca-link" onClick={onOpen}>و{items.length - 6} غيرها…</button>}
    </section>
  );
}
