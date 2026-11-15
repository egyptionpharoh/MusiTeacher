'use client';
// 🔔 نافذة التنبيه + 🖥️ وضع العرض الواضح (للشاشة على مكتب المعلم)
import { useEffect, useState } from 'react';
import { Icon } from './parts';
import { dayStatus } from '../core/schedule.js';
import { zonedParts, fmtTime, fmtDate, clock, durationWords } from '../core/time.js';
import { keepAwake } from './runtime';

const SRC_LABEL = { auto: 'تلقائي من خطتك', edited: 'عدّلته يدويًا', manual: 'ربط يدوي' };

/** بطاقة «الدرس المقرر» — أهم ما في التنبيه: اسم الدرس بخط كبير، وموقع الحصة منه، والأسبوع الدراسي */
export function LessonBlock({ lesson, href, compact = false }) {
  if (!lesson) return null;
  if (lesson.review) return <div className={`ca-lesson-block is-review${compact ? ' is-compact' : ''}`}><span className="ca-lesson-k">الدرس المقرر</span><strong>غير محدد</strong><small>توزيع الدروس على حصص هذا الأسبوع يحتاج مراجعتك من «اليوم».</small></div>;
  return (
    <div className={`ca-lesson-block${compact ? ' is-compact' : ''}`}>
      <span className="ca-lesson-k">الدرس المقرر{lesson.source && <i className={`ca-src is-${lesson.source}`}>{SRC_LABEL[lesson.source]}</i>}</span>
      <strong>{lesson.title}</strong>
      <small>{[lesson.part, lesson.week ? `${lesson.week}${lesson.semester ? ` – ${lesson.semester}` : ''}` : ''].filter(Boolean).join(' • ')}</small>
      {href && <a className="ca-btn is-ghost is-sm ca-lesson-open" href={href} target="_blank" rel="noopener noreferrer"><Icon n="note" size={14} />فتح الدرس في خطتي</a>}
    </div>
  );
}

export function AlarmOverlay({ ringing, now, onAck, onSnooze, onMute, muted, hrefFor }) {
  if (!ringing.length) return null;
  const a = ringing[ringing.length - 1];
  const lines = (a.body || '').split('\n').slice(a.what ? 1 : 0).filter((l) => !(a.lesson && (/^الدرس المقرر:/.test(l) || /^الأسبوع الدراسي:/.test(l))));
  const href = a.lesson && !a.lesson.review && hrefFor ? hrefFor(a.lesson) : '';
  const toStart = a.startMs ? a.startMs - now : 0;
  const canSnooze = a.type !== 'end' && a.type !== 'test' && a.type !== 'digest' && toStart > 70000;
  return (
    <div className="ca-alarm-back" role="alertdialog" aria-modal="true" aria-labelledby="ca-alarm-title" aria-describedby="ca-alarm-body">
      <div className={`ca-alarm is-${a.type}`}>
        <div className="ca-alarm-bell" aria-hidden="true"><Icon n="bell" size={40} /></div>
        <h2 id="ca-alarm-title">{a.title}</h2>
        <p className="ca-alarm-what">{a.what || ''}</p>
        <LessonBlock lesson={a.lesson} href={href} />
        <div id="ca-alarm-body" className="ca-alarm-body">{lines.map((l, i) => <p key={i}>{l}</p>)}</div>
        {a.type !== 'end' && a.startMs && a.startMs > now && <div className="ca-alarm-count"><span>تبدأ بعد</span><strong>{clock(toStart)}</strong></div>}
        {ringing.length > 1 && <p className="ca-muted ca-small">+ {ringing.length - 1} تنبيه آخر</p>}
        <div className="ca-alarm-actions">
          <button type="button" className="ca-btn is-lg" onClick={() => onAck(null)} autoFocus><Icon n="check" />تم، شكرًا</button>
          {canSnooze && <button type="button" className="ca-btn is-ghost is-lg" onClick={() => onSnooze(a, toStart > 6 * 60000 ? 5 : toStart > 3 * 60000 ? 2 : 1)}><Icon n="clock" />ذكّرني بعد {toStart > 6 * 60000 ? '5 دقائق' : toStart > 3 * 60000 ? 'دقيقتين' : 'دقيقة'}</button>}
          {!muted && <button type="button" className="ca-btn is-ghost is-lg" onClick={onMute}><Icon n="bellOff" />إيقاف الصوت</button>}
        </div>
      </div>
    </div>
  );
}

export function DisplayMode({ profile, settings, now, onClose, linksFor }) {
  const [lock, setLock] = useState(null);
  useEffect(() => {
    let wl = null, alive = true;
    keepAwake().then((l) => { if (alive) { wl = l; setLock(l); } else if (l) l.release(); });
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
    const re = () => { if (document.visibilityState === 'visible' && alive) keepAwake().then((l) => { wl = l; setLock(l); }); };
    document.addEventListener('visibilitychange', re);
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => { alive = false; document.removeEventListener('visibilitychange', re); window.removeEventListener('keydown', key); if (wl) wl.release().catch(() => {}); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const z = zonedParts(now, profile.tz);
  const st = dayStatus(profile, now);
  const n = st.next, c = st.current;
  const h24 = settings.h24;
  return (
    <div className="ca-display" role="dialog" aria-modal="true" aria-label="وضع العرض">
      <button type="button" className="ca-display-x" onClick={onClose} aria-label="خروج من وضع العرض"><Icon n="x" size={22} /> خروج</button>
      <div className="ca-display-date">{fmtDate(z.dateKey)}</div>
      <div className="ca-display-clock">{fmtTime(z.minutes, h24).replace(/ [صم]$/, '')}<small>:{String(z.ss).padStart(2, '0')}</small></div>
      {c && <div className="ca-display-now"><span>الآن</span> {c.title}{c.cls ? ` – ${c.cls}` : ''} <em>حتى {fmtTime(c.end, h24)}</em><div className="ca-progress"><i style={{ width: `${((now - c.startMs) / (c.endMs - c.startMs)) * 100}%` }} /></div></div>}
      {n ? (
        <div className="ca-display-next">
          <span className="ca-display-label">الحصة القادمة</span>
          <strong>{n.title}{n.cls ? ` – ${n.cls}` : ''}</strong>
          <span>{n.type === 'lesson' ? `الحصة ${n.label} • ` : ''}{fmtTime(n.start, h24)}{n.room ? ` • ${n.room}` : ''}</span>
          {(() => { const k = linksFor ? linksFor(st.today).get(n.key) : null; return k && (k.lessonTitle || k.review) ? <span className="ca-display-lesson">{k.lessonTitle ? <>الدرس المقرر: <b>{k.lessonTitle}</b></> : 'الدرس المقرر: يحتاج مراجعة'}</span> : null; })()}
          <div className="ca-display-count">{clock(n.startMs - now)}</div>
          <span className="ca-muted">{durationWords(n.startMs - now)}</span>
          {n.note && <p className="ca-prep"><Icon n="note" size={18} /> {n.note}</p>}
        </div>
      ) : <div className="ca-display-next"><strong>{st.phase === 'after' ? 'انتهت حصص اليوم' : 'لا حصص متبقية اليوم'}</strong>{st.upcoming && <span>القادمة: {st.upcoming.dayName || ''} {fmtTime(st.upcoming.event.start, h24)} — {st.upcoming.event.title}</span>}</div>}
      <div className="ca-display-foot">{st.remaining.length ? `متبقٍ اليوم: ${st.remaining.length} حصة` : ''}{lock ? ' • الشاشة ستبقى مضاءة' : ''}</div>
    </div>
  );
}
