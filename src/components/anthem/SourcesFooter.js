'use client';
// تذييل «المصادر والتوثيق الفني»: سطر مختصر وقائمة قابلة للفتح لكل عمل (الشاشة)، ونسخة مطبوعة مختصرة ثابتة (الطباعة).
import { useEffect, useState } from 'react';
import { SONGS, RIGHTS, REVIEW, getSong, keyText } from '@/lib/anthem/songs';
import { CREDITS, CREDIT_STATUS, GENERAL_NOTE, RIGHTS_NOTE, sourceOf } from '@/lib/anthem/credits';

function SourceLinks({ keys }) {
  if (!keys || !keys.length) return null;
  return (
    <span className="an-srcs">
      {keys.map((k) => { const s = sourceOf(k); return s.url
        ? <a key={k} href={s.url} target="_blank" rel="noopener noreferrer" title={`${s.title} — ${s.publisher}${s.date ? '، ' + s.date : ''}`}>{s.publisher}{s.date ? ` (${s.date.slice(0, 4)})` : ''}</a>
        : <span key={k}>{s.publisher}</span>; })}
    </span>
  );
}

/** تفاصيل عمل واحد: البيانات التعريفية، ثم بيانات النوتة والمراجعة */
export function WorkDetails({ id }) {
  const song = getSong(id); const c = CREDITS[id]; const m = song.music;
  return (
    <div className="an-work">
      {c && c.alsoKnown && <p className="an-fine">{c.alsoKnown}</p>}
      {c && (
        <dl className="an-credits">
          {c.rows.map((r) => (
            <div key={r.role} className="an-credit">
              <dt>{r.role} <span className={`an-dot is-${CREDIT_STATUS[r.status].tone}`} title={CREDIT_STATUS[r.status].label}>{CREDIT_STATUS[r.status].label}</span></dt>
              <dd>{r.value} <SourceLinks keys={r.src} /></dd>
            </div>
          ))}
        </dl>
      )}
      {c && c.notes.length > 0 && <ul className="an-notes">{c.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      <details className="an-sub">
        <summary>مصدر النوتة والمراجعة</summary>
        <dl className="an-credits">
          <div className="an-credit"><dt>مصدر النوتة</dt><dd>{song.source.file} — {song.source.pages}{song.source.also ? `؛ ونسخة أخرى: ${song.source.also}` : ''}</dd></div>
          <div className="an-credit"><dt>المطبوع في المصدر</dt><dd>{song.source.printed}</dd></div>
          {song.source.partial && <div className="an-credit"><dt>ما نُقل</dt><dd>{song.source.partial}</dd></div>}
          <div className="an-credit"><dt>السلم أو المقام</dt><dd>{keyText(song)} · <span dir="ltr">{m.time}</span> · {m.measures.length} مازورة</dd></div>
          <div className="an-credit"><dt>التسجيل</dt><dd>{song.recording}{song.recordingLink && <> <a href={song.recordingLink.url} target="_blank" rel="noopener noreferrer">رابط تسجيل خارجي</a> <span className="an-fine">{song.recordingLink.note}</span></>}</dd></div>
          <div className="an-credit"><dt>الحقوق</dt><dd>{RIGHTS[song.rights].label}</dd></div>
          <div className="an-credit"><dt>المراجعة</dt><dd>{REVIEW[song.review.status].label}<ul className="an-notes">{song.review.notes.map((n) => <li key={n}>{n}</li>)}</ul></dd></div>
        </dl>
      </details>
    </div>
  );
}

/**
 * @param {{current?:string}} props  current = النشيد المفتوح (يُفتح تفصيله تلقائيًا ويُذكر أولًا في الطباعة)
 */
export default function SourcesFooter({ current }) {
  const [open, setOpen] = useState(current || null);
  const [all, setAll] = useState(false);
  useEffect(() => { setOpen(current || null); }, [current]);
  const list = current ? [...SONGS.filter((s) => s.id === current), ...SONGS.filter((s) => s.id !== current)] : SONGS;
  const cur = current ? CREDITS[current] : null;
  return (
    <footer className="an-foot">
      {/* الشاشة */}
      <details className="an-foot-box" open={all} onToggle={(e) => setAll(e.currentTarget.open)}>
        <summary>
          <span className="an-foot-title">المصادر والتوثيق الفني</span>
          <span className="an-fine">{current && cur ? `${getSong(current).title}: ${cur.summary}` : 'بيانات الكلمات واللحن والأداء لكل عمل، ومصادرها وحقوقها'}</span>
        </summary>
        <p className="an-foot-note">{GENERAL_NOTE}</p>
        <ul className="an-foot-list">
          {list.map((s) => {
            const c = CREDITS[s.id]; const isOpen = open === s.id;
            return (
              <li key={s.id} className={isOpen ? 'is-open' : ''}>
                <button type="button" className="an-foot-item" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)}>
                  <b>{s.title}</b><span>{c ? c.summary : ''}</span>
                </button>
                {isOpen && <WorkDetails id={s.id} />}
              </li>
            );
          })}
        </ul>
        <p className="an-foot-rights">{RIGHTS_NOTE}</p>
        <p className="an-fine">حالات التوثيق: <span className="an-dot is-ok">موثّق</span> ورد في مصدر صحفي أو مؤسسي موثوق · <span className="an-dot is-info">وارد في مصدر واحد</span> يحتاج تأكيدًا · <span className="an-dot is-info">وفق معلومات معدّ المنصة</span> لم يُعثر على مصدر منشور يؤكده · <span className="an-dot is-warn">محل اختلاف / لم يتسنَّ التحقق</span> لا يُعتمد. آخر مراجعة: 2026-11-08.</p>
      </details>

      {/* الطباعة: نص ثابت مختصر لا يعتمد على عناصر قابلة للطي */}
      <div className="an-foot-print" aria-hidden="true">
        <p><b>المصادر والتوثيق الفني.</b> {GENERAL_NOTE}</p>
        <ul>
          {list.filter((s) => !current || s.id === current).map((s) => {
            const c = CREDITS[s.id]; const song = getSong(s.id);
            return (
              <li key={s.id}>
                <b>{s.title}</b>: {c ? c.rows.filter((r) => r.status !== 'unverified' && r.status !== 'disputed').map((r) => `${r.role}: ${r.value}`).join('؛ ') || 'لم يتسنَّ التحقق من بيانات التأليف والتلحين.' : ''}
                {c && c.rows.some((r) => r.status === 'disputed' || r.status === 'unverified') ? ' (وبعض البيانات الأخرى محل اختلاف أو لم يتسنَّ التحقق منها).' : ''}
                {' '}مصدر النوتة: {song.source.file}، {song.source.pages}.
                {c && <> المصادر: {[...new Set(c.rows.flatMap((r) => r.src))].map((k) => sourceOf(k)).filter((x) => x.url).map((x) => `${x.publisher}${x.date ? ' ' + x.date : ''}`).join('، ') || '—'}.</>}
              </li>
            );
          })}
        </ul>
        <p>{RIGHTS_NOTE}</p>
      </div>
    </footer>
  );
}
