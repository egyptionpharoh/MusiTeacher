'use client';
// 🌅 لوحة اليوم الدراسي: الساعة، بطاقة الحصة القادمة مع العدّاد، الخط الزمني لليوم، وتعديلات «هذا اليوم فقط».
import { useMemo, useState } from 'react';
import { Icon, Modal, Field, Seg } from './parts';
import { dayStatus, resolveDay, weekStats, alertsForDay } from '../core/schedule.js';
import { fmtTime, fmtDate, clock, durationWords, zonedParts, addDays, DAY_NAMES, normHHMM, parseHHMM, toHHMM, MIN } from '../core/time.js';
import { EXTRA_KINDS, uid } from '../core/model.js';

const MOTIVATION = [
  'كل حصة فرصة لبداية لحن جديد.', 'الاستعداد الجيد نصف نجاح الحصة.', 'دقيقة تنظيم توفر عشر دقائق ارتباك.',
  'الموسيقى نظام… وكذلك يومك الدراسي.', 'إيقاع منتظم ويوم هادئ بإذن الله.', 'خطوة صغيرة اليوم، أثر كبير غدًا.',
  'ابتسامة في بداية الحصة تصنع جوها كله.', 'يومك مرتب، فاستمتع بالتدريس.', 'المعلم المنظم يصنع صفًا هادئًا.',
  'أجمل الألحان تبدأ بنَفَس هادئ.', 'التخطيط الجيد يجعل الوقت صديقك.', 'كل جهد اليوم يصنع فرقًا في طالب.',
];

function greeting(hh) { return hh < 12 ? 'صباح الخير' : hh < 18 ? 'مساء الخير' : 'مساء النور'; }

function Ring({ pct, children, size = 220 }) {
  const r = (size - 18) / 2, c = 2 * Math.PI * r;
  return (
    <div className="ca-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ca-ring-bg" />
        <circle cx={size / 2} cy={size / 2} r={r} className="ca-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, pct)))} />
      </svg>
      <div className="ca-ring-in">{children}</div>
    </div>
  );
}

export default function TodayView({ profile, settings, now, planCtx = {}, plansHref = '/dashboard/tools/plans', onOverride, onGoto, onOpenImport, profilesCount, onCopyFrom, missed, rt, onDisplay, onTest }) {
  const [dateKey, setDateKey] = useState(null);
  const [act, setAct] = useState(null);        // حدث مختار لتعديل اليوم
  const [adding, setAdding] = useState(false);
  const zp = zonedParts(now, profile.tz);
  const today = zp.dateKey;
  const viewKey = dateKey || today;
  const isToday = viewKey === today;
  const st = useMemo(() => dayStatus(profile, now), [profile, now]);
  const day = useMemo(() => (isToday ? st.day : resolveDay(profile, viewKey)), [isToday, st, profile, viewKey]);
  const week = useMemo(() => weekStats(profile), [profile]);
  const h24 = settings.h24;
  const hasLessons = week.lessons > 0;
  const alertsToday = useMemo(() => alertsForDay(profile, settings, viewKey, day), [profile, settings, viewKey, day]);
  const missedToday = (missed || []).filter((m) => m.dateKey === today);
  const links = planCtx.linksFor ? planCtx.linksFor(viewKey) : null;

  if (!hasLessons && !Object.keys(profile.overrides).length) {
    return (
      <section className="ca-card ca-welcome">
        <div className="ca-welcome-art"><Icon n="bell" size={44} /></div>
        <h2>{greeting(zp.hh)}! لنجهز جدولك أولًا</h2>
        <p>بعد إدخال الجدول سيتابع المنبه مواعيد حصصك وينبهك قبل كل حصة بالوقت الذي تختاره، مع اسم الصف والشعبة.</p>
        <div className="ca-welcome-grid">
          <button type="button" className="ca-choice" onClick={() => onGoto('schedule')}><Icon n="edit" size={26} /><strong>إدخال يدوي</strong><span>حدد أوقات الحصص ثم املأ الجدول بالنقر</span></button>
          <button type="button" className="ca-choice" onClick={onOpenImport}><Icon n="upload" size={26} /><strong>استيراد جدول جاهز</strong><span>Excel أو Word أو PDF أو صورة للجدول</span></button>
          {profilesCount > 1 && <button type="button" className="ca-choice" onClick={onCopyFrom}><Icon n="copy" size={26} /><strong>النسخ من جدول سابق</strong><span>انسخ جدول فصل سابق وعدّل أوقاته</span></button>}
        </div>
      </section>
    );
  }

  const nextEv = st.next;
  const up = st.upcoming;
  let card = null;
  if (st.phase === 'lesson' && st.current) {
    const e = st.current, pct = (now - e.startMs) / (e.endMs - e.startMs);
    card = { kind: 'now', e, pct, big: clock(e.endMs - now), sub: 'متبقٍ على نهاية الحصة' };
  }
  const nextCard = nextEv ? { e: nextEv, ms: nextEv.startMs - now } : null;

  return (
    <div className="ca-today">
      <section className="ca-hero">
        <div className="ca-hero-text">
          <p className="ca-greet">{greeting(zp.hh)}{profile.teacher ? `، ${profile.teacher}` : ''}!</p>
          <h2 className="ca-clock" aria-live="off">{fmtTime(zp.minutes, h24).replace(/ [صم]$/, '')}<small>:{String(zp.ss).padStart(2, '0')}</small>{!h24 && <em>{zp.hh < 12 ? 'ص' : 'م'}</em>}</h2>
          <p className="ca-date">{fmtDate(today)}</p>
          {settings.motivation && <p className="ca-quote">{MOTIVATION[(zp.y * 400 + zp.m * 31 + zp.d) % MOTIVATION.length]}</p>}
          <div className="ca-hero-chips">
            {st.lessons.length > 0 && <span className="ca-chip">حصص اليوم: <b>{st.lessons.length}</b></span>}
            {st.lessons.length > 0 && <span className="ca-chip">المتبقية: <b>{st.remaining.length}</b></span>}
            {st.first && <span className="ca-chip">من {fmtTime(st.first.start, h24)} إلى {fmtTime(st.last.end, h24)}</span>}
            <button type="button" className="ca-chip ca-chip-btn" onClick={onDisplay}><Icon n="expand" size={14} /> وضع العرض</button>
          </div>
        </div>

        <div className="ca-next">
          {nextCard ? (
            <>
              <Ring pct={1 - Math.min(1, nextCard.ms / (60 * MIN))}>
                <span className="ca-ring-label">{st.phase === 'break' ? 'الحصة التالية بعد الاستراحة' : 'تبدأ الحصة القادمة بعد'}</span>
                <strong className="ca-countdown" aria-live="off">{clock(nextCard.ms)}</strong>
                <span className="ca-ring-sub">{durationWords(nextCard.ms)}</span>
              </Ring>
              <NextInfo e={nextCard.e} profile={profile} h24={h24} link={planCtx.linksFor ? planCtx.linksFor(today).get(nextCard.e.key) : null} onOpen={() => setAct(nextCard.e)} alerts={alertsToday.filter((a) => a.eventKey === nextCard.e.key && a.due > now)} />
            </>
          ) : card ? null : (
            <div className="ca-next-empty">
              <Icon n={st.phase === 'after' ? 'moon' : 'sun'} size={34} />
              <strong>{st.phase === 'after' ? 'انتهت حصص اليوم، عملًا موفقًا 🌿' : st.phase === 'off' ? (day.holiday ? `إجازة: ${day.holiday.name}` : 'لا دوام اليوم') : st.phase === 'empty' ? 'لا توجد حصص لك اليوم' : ''}</strong>
              {up && <span>الحصة القادمة: {up.dayName || DAY_NAMES[zonedParts(up.event.startMs, profile.tz).wd]} {fmtTime(up.event.start, h24)} — {up.event.title}{up.event.cls ? ` – ${up.event.cls}` : ''}</span>}
            </div>
          )}
          {card && (
            <div className="ca-now">
              <span className="ca-badge is-now">الحصة الحالية</span>
              <strong>{card.e.title}{card.e.cls ? ` – ${card.e.cls}` : ''}</strong>
              <div className="ca-progress" role="progressbar" aria-valuenow={Math.round(card.pct * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${card.pct * 100}%` }} /></div>
              <span>{card.sub}: <b>{card.big}</b></span>
            </div>
          )}
        </div>
      </section>

      {missedToday.length > 0 && isToday && (
        <div className="ca-notice is-warn" role="status"><Icon n="warn" /><span>فات {missedToday.length === 1 ? 'تنبيه واحد' : `${missedToday.length} تنبيهات`} اليوم لأن الأداة كانت مغلقة أو الجهاز في وضع السكون (آخرها: {missedToday[missedToday.length - 1].what}). لم نُطلقها متأخرة حتى لا تربكك.</span></div>
      )}
      {!rt.leader && rt.locks && <div className="ca-notice"><Icon n="info" /><span>المنبه يعمل في تبويب آخر مفتوح لهذه الأداة؛ لن يرن هذا التبويب حتى لا تتكرر التنبيهات.</span></div>}

      <section className="ca-card">
        <div className="ca-card-head">
          <div>
            <h3>{isToday ? 'جدول اليوم' : `جدول ${fmtDate(viewKey)}`}</h3>
            <p className="ca-muted">{day.holiday ? `إجازة: ${day.holiday.name}` : !day.isWorkday ? 'ليس يوم دوام في جدولك' : day.muted ? 'تنبيهات هذا اليوم موقوفة' : `${alertsToday.length} تنبيه مجدول لهذا اليوم`}</p>
          </div>
          <div className="ca-row">
            <button type="button" className="ca-icon-btn" onClick={() => setDateKey(addDays(viewKey, -1))} aria-label="اليوم السابق"><Icon n="back" /></button>
            <input type="date" className="ca-input ca-date-in" value={viewKey} onChange={(e) => e.target.value && setDateKey(e.target.value)} aria-label="اختيار يوم" />
            <button type="button" className="ca-icon-btn" style={{ transform: 'scaleX(-1)' }} onClick={() => setDateKey(addDays(viewKey, 1))} aria-label="اليوم التالي"><Icon n="back" /></button>
            {!isToday && <button type="button" className="ca-btn is-ghost" onClick={() => setDateKey(null)}>اليوم</button>}
          </div>
        </div>
        <div className="ca-day-tools">
          <button type="button" className={`ca-btn ${day.muted ? 'is-warn' : 'is-ghost'}`} onClick={() => onOverride(viewKey, (o) => ({ ...o, muted: !o.muted }))}><Icon n={day.muted ? 'bell' : 'bellOff'} />{day.muted ? 'إعادة تفعيل تنبيهات هذا اليوم' : 'إيقاف تنبيهات هذا اليوم'}</button>
          <button type="button" className="ca-btn is-ghost" onClick={() => setAdding(true)}><Icon n="plus" />إضافة حصة استثنائية أو اجتماع</button>
          {day.override && <button type="button" className="ca-btn is-ghost" onClick={() => { if (window.confirm('إلغاء كل تعديلات هذا اليوم والعودة للجدول الأساسي؟')) onOverride(viewKey, () => ({})); }}><Icon n="x" />إلغاء تعديلات اليوم</button>}
        </div>
        {day.events.length === 0 ? <p className="ca-muted ca-pad">لا توجد حصص في هذا اليوم.</p> : (
          <ol className="ca-timeline">
            {groupFree(day.events).map((e) => {
              if (e.type === 'freeGroup') return (
                <li key={e.key} className="ca-ev is-free st-later">
                  <div className="ca-ev-time"><b>{fmtTime(e.start, h24)}</b><span>{fmtTime(e.end, h24)}</span></div>
                  <div className="ca-ev-dot" aria-hidden="true" />
                  <div className="ca-ev-body is-static"><span className="ca-ev-title"><span className="ca-ev-no">الحصص {e.from} – {e.to}</span><strong>{e.count} حصص فراغ</strong></span></div>
                </li>
              );
              const status = e.cancelled ? 'cancelled' : !isToday ? (viewKey < today ? 'done' : 'later') : e.endMs <= now ? 'done' : e.startMs <= now ? 'now' : nextEv && e.key === nextEv.key ? 'next' : 'later';
              return (
                <li key={e.key} className={`ca-ev is-${e.type} st-${status}`}>
                  <div className="ca-ev-time"><b>{fmtTime(e.start, h24)}</b><span>{fmtTime(e.end, h24)}</span></div>
                  <div className="ca-ev-dot" aria-hidden="true" />
                  <button type="button" className="ca-ev-body" onClick={() => e.type !== 'break' && setAct(e)} disabled={e.type === 'break'}>
                    <span className="ca-ev-title">
                      {e.type === 'lesson' || e.type === 'free' ? <span className="ca-ev-no">الحصة {e.label}</span> : e.type === 'extra' ? <span className="ca-ev-no is-extra">{e.label}</span> : null}
                      <strong>{e.title}</strong>{e.cls && <span>{e.cls}</span>}{e.room && <span className="ca-muted">{e.room}</span>}
                    </span>
                    <span className="ca-ev-tags">
                      {status === 'now' && <span className="ca-badge is-now">الآن</span>}
                      {status === 'next' && <span className="ca-badge is-next">القادمة</span>}
                      {status === 'done' && e.type !== 'break' && e.type !== 'free' && <span className="ca-badge is-done">انتهت</span>}
                      {e.cancelled && <span className="ca-badge is-cancel">ملغاة اليوم</span>}
                      {e.changedToday && <span className="ca-badge is-change">وقت معدّل لليوم فقط (الأصل {fmtTime(e.baseStart, h24)})</span>}
                      {e.muted && <span className="ca-badge">بدون تنبيه</span>}
                      {e.note && <span className="ca-ev-note"><Icon n="note" size={13} /> {e.note}</span>}
                    </span>
                    {links && (e.type === 'lesson' || (e.type === 'extra' && e.kind === 'lesson')) && !e.cancelled && <LessonLine link={links.get(e.key)} hasPlans={planCtx.hasPlans} />}
                  </button>
                  {links && links.get(e.key) && viewKey <= today && !e.cancelled && <a className="ca-ev-record" href={`${plansHref}?tab=today&record=${encodeURIComponent(links.get(e.key).assignmentId)}`}>تسجيل تنفيذ الحصة</a>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <WeekCard profile={profile} week={week} h24={h24} />

      {act && <EventModal e={act} dateKey={viewKey} profile={profile} h24={h24} onClose={() => setAct(null)} onOverride={onOverride} />}
      {adding && <ExtraModal dateKey={viewKey} profile={profile} onClose={() => setAdding(false)} onSave={(x) => { onOverride(viewKey, (o) => ({ ...o, extra: [...(o.extra || []), x] })); setAdding(false); }} />}
    </div>
  );
}

/** دمج حصص الفراغ المتتالية في سطر واحد حتى يبقى الخط الزمني واضحًا */
function groupFree(events) {
  const out = [];
  for (const e of events) {
    const last = out[out.length - 1];
    if (e.type === 'free' && last && (last.type === 'free' || last.type === 'freeGroup')) {
      if (last.type === 'free') out[out.length - 1] = { type: 'freeGroup', key: `fg-${last.key}`, start: last.start, end: e.end, from: last.label, to: e.label, count: 2 };
      else Object.assign(last, { end: e.end, to: e.label, count: last.count + 1 });
    } else out.push(e);
  }
  return out;
}

/** سطر الدرس المرتبط من «الخطط الفصلية» — أو رسالة واضحة إن لم يُربط درس بعد (لا نخترع درسًا) */
function LessonLine({ link, hasPlans }) {
  if (link) return <span className="ca-ev-lesson"><Icon n="note" size={13} /> الدرس: <b>{link.lessonTitle}</b>{link.sessions ? ` • الحصة ${link.part} من ${link.sessions}` : ''}{link.remaining != null ? ` • المتبقي ${link.remaining}` : ''}{link.status !== 'scheduled' && <i className="ca-ev-st">{link.statusLabel}</i>}</span>;
  if (!hasPlans) return null;
  return <span className="ca-ev-lesson is-none">لم يتم تحديد درس لهذه الحصة بعد</span>;
}

function NextInfo({ e, profile, h24, onOpen, alerts, link }) {
  return (
    <div className="ca-next-info">
      <span className="ca-badge is-next">{e.type === 'extra' ? e.label : `الحصة ${e.label}`}</span>
      <h3>{e.title}</h3>
      {e.cls && <p className="ca-next-cls">{e.cls}</p>}
      {link && <p className="ca-next-lesson">الدرس: <b>{link.lessonTitle}</b>{link.sessions ? ` (الحصة ${link.part} من ${link.sessions})` : ''}</p>}
      <dl>
        <div><dt>البداية</dt><dd>{fmtTime(e.start, h24)}</dd></div>
        <div><dt>النهاية</dt><dd>{fmtTime(e.end, h24)}</dd></div>
        {e.room && <div><dt>المكان</dt><dd>{e.room}</dd></div>}
      </dl>
      {e.note && <p className="ca-prep"><Icon n="note" size={15} /> {e.note}</p>}
      <p className="ca-muted ca-small">{alerts.length ? `التنبيه التالي: ${alerts.map((a) => (a.type === 'start' ? 'عند البداية' : a.type === 'end' ? `قبل النهاية بـ${a.min} د` : `قبلها بـ${a.min} د`)).join('، ')}` : 'لا تنبيهات متبقية لهذه الحصة'}</p>
      <button type="button" className="ca-btn is-ghost" onClick={onOpen}><Icon n="edit" />تفاصيل وتعديل لليوم</button>
    </div>
  );
}

function WeekCard({ profile, week, h24 }) {
  const [open, setOpen] = useState(false);
  const max = Math.max(1, ...Object.values(week.perDay));
  const h = Math.floor(week.minutes / 60), m = week.minutes % 60;
  return (
    <section className="ca-card">
      <button type="button" className="ca-card-head ca-collapse" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div><h3>أسبوعك في لمحة</h3><p className="ca-muted">{week.lessons} حصة أسبوعيًا • {h ? `${h} ساعة` : ''}{h && m ? ' و' : ''}{m ? `${m} دقيقة` : ''} تدريس</p></div>
        <Icon n="back" className={open ? 'ca-rot-up' : 'ca-rot-down'} />
      </button>
      {open && (
        <div className="ca-week">
          <div className="ca-bars">
            {profile.days.map((d) => (
              <div key={d} className={`ca-bar${week.busiestDay === d && week.perDay[d] ? ' is-top' : ''}`}>
                <span className="ca-bar-v">{week.perDay[d] || 0}</span>
                <i style={{ height: `${((week.perDay[d] || 0) / max) * 100}%` }} />
                <span>{DAY_NAMES[d]}</span>
              </div>
            ))}
          </div>
          <div className="ca-classes">
            <h4>الحصص حسب الصف</h4>
            <ul>{Object.entries(week.perClass).sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b></li>)}</ul>
          </div>
        </div>
      )}
    </section>
  );
}

function EventModal({ e, dateKey, profile, h24, onClose, onOverride }) {
  const [start, setStart] = useState(e.start), [end, setEnd] = useState(e.end);
  const [note, setNote] = useState(e.type === 'extra' ? e.note : e.todayNote);
  const isExtra = e.type === 'extra';
  const shift = (min) => { setStart(toHHMM(parseHHMM(start) + min)); setEnd(toHHMM(parseHHMM(end) + min)); };
  const valid = normHHMM(start) && normHHMM(end) && parseHHMM(end) > parseHHMM(start);
  const save = () => {
    onOverride(dateKey, (o) => {
      if (isExtra) return { ...o, extra: (o.extra || []).map((x) => (x.id === e.key ? { ...x, start, end, note } : x)) };
      const changed = { ...(o.changed || {}) };
      if (start !== e.baseStart || end !== e.baseEnd) changed[e.key] = { start, end }; else delete changed[e.key];
      const notes = { ...(o.notes || {}) }; if (note.trim()) notes[e.key] = note.trim(); else delete notes[e.key];
      return { ...o, changed, notes };
    });
    onClose();
  };
  const cancelToggle = () => { onOverride(dateKey, (o) => { const c = { ...(o.cancelled || {}) }; if (c[e.key]) delete c[e.key]; else c[e.key] = true; return { ...o, cancelled: c }; }); onClose(); };
  const removeExtra = () => { onOverride(dateKey, (o) => ({ ...o, extra: (o.extra || []).filter((x) => x.id !== e.key) })); onClose(); };
  return (
    <Modal title={`${e.title}${e.cls ? ` – ${e.cls}` : ''}`} onClose={onClose}
      footer={<><button type="button" className="ca-btn" disabled={!valid} onClick={save}><Icon n="check" />حفظ لهذا اليوم</button><button type="button" className="ca-btn is-ghost" onClick={onClose}>إغلاق</button></>}>
      <div className="ca-notice is-info"><Icon n="info" /><span>هذه التعديلات تخص يوم <b>{fmtDate(dateKey)}</b> فقط، ولا تغيّر جدولك الأسبوعي. لتغيير الجدول الدائم استخدم تبويب «الجدول».</span></div>
      <div className="ca-grid2">
        <Field label="بداية الحصة"><input className="ca-input" type="time" value={start} onChange={(ev) => setStart(ev.target.value)} /></Field>
        <Field label="نهاية الحصة"><input className="ca-input" type="time" value={end} onChange={(ev) => setEnd(ev.target.value)} /></Field>
      </div>
      <div className="ca-row ca-wrap"><span className="ca-muted">تأجيل سريع:</span>{[5, 10, 15, 40].map((m) => <button type="button" key={m} className="ca-chip ca-chip-btn" onClick={() => shift(m)}>+{m} د</button>)}<button type="button" className="ca-chip ca-chip-btn" onClick={() => { setStart(e.baseStart); setEnd(e.baseEnd); }}>الوقت الأصلي</button></div>
      {!valid && <p className="ca-error">وقت النهاية يجب أن يكون بعد وقت البداية.</p>}
      <Field label={isExtra ? 'ملاحظة' : 'ملاحظة لهذا اليوم (تظهر في تنبيه الحصة)'}><textarea className="ca-input" rows={2} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="مثال: إحضار جهاز العرض، مراجعة الاختبار..." /></Field>
      {e.lesson && e.lesson.note && !isExtra && <p className="ca-muted ca-small">ملاحظة دائمة للحصة: {e.lesson.note}</p>}
      <div className="ca-row ca-wrap">
        {isExtra ? <button type="button" className="ca-btn is-danger" onClick={removeExtra}><Icon n="trash" />حذف هذا الحدث</button>
          : <button type="button" className={`ca-btn ${e.cancelled ? '' : 'is-danger'}`} onClick={cancelToggle}><Icon n={e.cancelled ? 'check' : 'x'} />{e.cancelled ? 'استعادة الحصة لهذا اليوم' : 'إلغاء الحصة لهذا اليوم فقط'}</button>}
      </div>
    </Modal>
  );
}

function ExtraModal({ dateKey, profile, onClose, onSave }) {
  const [x, setX] = useState({ id: uid('e'), kind: 'lesson', title: '', start: '', end: '', grade: '', section: '', room: '', note: '' });
  const set = (k) => (ev) => setX({ ...x, [k]: ev.target.value });
  const valid = normHHMM(x.start) && normHHMM(x.end) && parseHHMM(x.end) > parseHHMM(x.start);
  return (
    <Modal title={`إضافة ليوم ${fmtDate(dateKey)}`} onClose={onClose}
      footer={<><button type="button" className="ca-btn" disabled={!valid} onClick={() => onSave(x)}><Icon n="plus" />إضافة مع تنبيه</button><button type="button" className="ca-btn is-ghost" onClick={onClose}>إلغاء</button></>}>
      <Seg label="النوع" value={x.kind} onChange={(k) => setX({ ...x, kind: k })} options={EXTRA_KINDS} />
      <Field label={x.kind === 'lesson' ? 'المادة' : 'العنوان'}><input className="ca-input" value={x.title} onChange={set('title')} placeholder={x.kind === 'lesson' ? profile.subject || 'المادة' : x.kind === 'meeting' ? 'اجتماع قسم الفنون' : 'بروفة الطابور الصباحي'} /></Field>
      <div className="ca-grid2">
        <Field label="من"><input className="ca-input" type="time" value={x.start} onChange={set('start')} /></Field>
        <Field label="إلى"><input className="ca-input" type="time" value={x.end} onChange={set('end')} /></Field>
      </div>
      {x.kind === 'lesson' && <div className="ca-grid2"><Field label="الصف"><input className="ca-input" value={x.grade} onChange={set('grade')} placeholder="الصف الخامس" /></Field><Field label="الشعبة"><input className="ca-input" value={x.section} onChange={set('section')} placeholder="2" /></Field></div>}
      <Field label="المكان"><input className="ca-input" value={x.room} onChange={set('room')} placeholder="قاعة الموسيقى / غرفة الاجتماعات" /></Field>
      <Field label="ملاحظة"><textarea className="ca-input" rows={2} value={x.note} onChange={set('note')} /></Field>
      <p className="ca-muted ca-small">ستُطبق خطة التنبيه الافتراضية لجدولك على هذا الحدث.</p>
    </Modal>
  );
}
