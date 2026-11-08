'use client';
// «نوتات النشيد والمارشات»: المكتبة التفاعلية + صفحة النشيد + ملفات المصدر + قائمة المراجعة الداخلية.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ScoreView from './ScoreView';
import SongView from './SongView';
import SourcesFooter from './SourcesFooter';
import { Icon } from './icons';
import { SONGS, PENDING, RIGHTS, REVIEW, getSong, reviewRow, defaultTempo, keyText } from '@/lib/anthem/songs';
import { playOrder, buildTimeline, keySigLabel, keyLabel, TPQ } from '@/lib/anthem/notation';
import { AnthemPlayer } from '@/lib/anthem/audio';
import { ls } from '@/lib/pd-workshops/browser';
import './anthem.css';

const FAV_KEY = 'mt-anthem:favs';
const RELATED = [
  { href: '/dashboard/resources/lab/rhythm-dictation', label: 'مسابقة التدوين والإملاء الإيقاعي', note: 'تمييز الأنماط الإيقاعية وتدوينها' },
  { href: '/dashboard/resources/lab/time-signatures', label: 'طريقة أداء الموازين الإيقاعية', note: 'إشارات الميزان الثنائي والرباعي' },
];
const norm = (t) => String(t || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ً-ْ]/g, '').toLowerCase();
const thumbMeasures = (music) => { const want = music.time === '4/4' ? 1 : 2; const out = []; music.measures.forEach((m, i) => { if (out.length < want && m.events.some((e) => e.kind === 'note')) out.push(i); }); return out; };

export default function AnthemStudio({ files = [] }) {
  const [view, setView] = useState({ song: null, mode: 'listen' });
  const [q, setQ] = useState(''); const [meter, setMeter] = useState('all'); const [status, setStatus] = useState('all'); const [onlyFav, setOnlyFav] = useState(false);
  const [favs, setFavs] = useState([]); const [showReview, setShowReview] = useState(false);
  const [quick, setQuick] = useState(null); const quickPlayer = useRef(null);
  useEffect(() => { setFavs(ls.get(FAV_KEY, [])); }, []);
  // الرابط يحفظ النشيد المفتوح (?song=...&mode=...)
  useEffect(() => {
    const read = () => { const p = new URLSearchParams(window.location.search); const s = p.get('song'); setView({ song: s && SONGS.some((x) => x.id === s) ? s : null, mode: p.get('mode') || 'listen' }); };
    read(); window.addEventListener('popstate', read); return () => window.removeEventListener('popstate', read);
  }, []);
  const open = (song, mode = 'listen') => {
    stopQuick(); setView({ song, mode }); const p = new URLSearchParams(window.location.search);
    if (song) { p.set('song', song); p.set('mode', mode); } else { p.delete('song'); p.delete('mode'); }
    window.history.pushState(null, '', `${window.location.pathname}${p.toString() ? `?${p}` : ''}`); window.scrollTo({ top: 0 });
  };
  const toggleFav = (id) => setFavs((f) => { const n = f.includes(id) ? f.filter((x) => x !== id) : [...f, id]; ls.set(FAV_KEY, n); return n; });
  useEffect(() => () => quickPlayer.current?.close(), []);
  function stopQuick() { quickPlayer.current?.stop(); setQuick(null); }
  const playQuick = (id) => {
    if (quick === id) { stopQuick(); return; }
    try {
      if (!quickPlayer.current) quickPlayer.current = new AnthemPlayer({ onEnd: () => setQuick(null) });
      const s = getSong(id); const order = playOrder(s.music).slice(0, 8); const p = quickPlayer.current;
      p.load(buildTimeline(s.music, order), { barBeats: s.music.capacity / TPQ, beatUnit: s.music.beat / TPQ }); p.bpm = defaultTempo(s).bpm; p.play(0); setQuick(id);
    } catch { setQuick(null); }
  };

  const list = useMemo(() => SONGS.filter((s) => {
    const m = getSong(s.id).music;
    if (q && !norm(s.title + ' ' + s.source.file).includes(norm(q))) return false;
    if (meter !== 'all' && m.time !== meter) return false;
    if (status === 'ok' && s.review.status === 'needs-decision') return false;
    if (status === 'decide' && s.review.status !== 'needs-decision') return false;
    if (onlyFav && !favs.includes(s.id)) return false;
    return true;
  }), [q, meter, status, onlyFav, favs]);
  const meters = useMemo(() => [...new Set(SONGS.map((s) => getSong(s.id).music.time))], []);

  if (view.song) {
    return (
      <div className="an-root">
        <div className="an-shell">
          <SongView key={view.song} id={view.song} initialMode={view.mode} onBack={() => open(null)} fav={favs.includes(view.song)} onFav={() => toggleFav(view.song)} />
        </div>
      </div>
    );
  }
  return (
    <div className="an-root">
      <div className="an-shell">
        <header className="an-hero">
          <div>
            <span className="an-kicker"><Icon d="music" size={16} /> مكتبة تعليمية تفاعلية</span>
            <h1>نوتات النشيد والمارشات</h1>
            <p>نوتة واضحة تُقرأ وتُسمع وتتابعها عين الطالب مع المؤشر، وتمارين مستخرجة من لحن كل نشيد.</p>
          </div>
          <div className="an-stats" aria-label="محتوى المكتبة">
            <div><b>{SONGS.length}</b><small>نوتات تفاعلية</small></div>
            <div><b>{SONGS.reduce((a, s) => a + getSong(s.id).music.measures.length, 0)}</b><small>مازورة مدونة</small></div>
            <div><b>{files.length}</b><small>ملفات مصدر</small></div>
          </div>
        </header>

        <div className="an-filters">
          <label className="an-search"><Icon d="search" size={18} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم النشيد…" aria-label="بحث" /></label>
          <div className="an-chipset" role="group" aria-label="الميزان">
            <button type="button" className={`an-pill ${meter === 'all' ? 'is-on' : ''}`} onClick={() => setMeter('all')}>كل الموازين</button>
            {meters.map((m) => <button key={m} type="button" dir="ltr" className={`an-pill ${meter === m ? 'is-on' : ''}`} onClick={() => setMeter(m)}>{m}</button>)}
          </div>
          <div className="an-chipset" role="group" aria-label="حالة المراجعة">
            <button type="button" className={`an-pill ${status === 'all' ? 'is-on' : ''}`} onClick={() => setStatus('all')}>الكل</button>
            <button type="button" className={`an-pill ${status === 'ok' ? 'is-on' : ''}`} onClick={() => setStatus('ok')}>مراجعة مكتملة</button>
            <button type="button" className={`an-pill ${status === 'decide' ? 'is-on' : ''}`} onClick={() => setStatus('decide')}>فيها مواضع للحسم</button>
          </div>
          <button type="button" className={`an-pill ${onlyFav ? 'is-on' : ''}`} aria-pressed={onlyFav} onClick={() => setOnlyFav((x) => !x)}><Icon d="star" size={14} fill={onlyFav ? 'currentColor' : undefined} /> المفضلة ({favs.length})</button>
        </div>

        <div className="an-grid">
          {list.map((s) => {
            const m = getSong(s.id).music; const rights = RIGHTS[s.rights]; const isFav = favs.includes(s.id);
            return (
              <article key={s.id} className="an-songcard">
                <button type="button" className="an-thumb" onClick={() => open(s.id)} aria-label={`افتح ${s.title}`}>
                  <ScoreView song={m} measures={thumbMeasures(m)} sp={6.2} compact fixedWidth={300} autoScroll={false} label={`بداية نوتة ${s.title}`} />
                </button>
                <div className="an-cardbody">
                  <div className="an-cardtop">
                    <h3>{s.title}</h3>
                    <button type="button" className={`an-fav is-small ${isFav ? 'is-on' : ''}`} aria-pressed={isFav} onClick={() => toggleFav(s.id)} aria-label={isFav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}><Icon d="star" size={17} fill={isFav ? 'currentColor' : undefined} /></button>
                  </div>
                  <div className="an-chips">
                    <span className="an-chip">{keyText(s, m)}</span>
                    <span className="an-chip" dir="ltr">{m.time}</span>
                    <span className="an-chip">{m.measures.length} مازورة</span>
                  </div>
                  <div className="an-chips">
                    <span className={`an-chip is-${rights.tone}`}><Icon d="shield" size={13} /> {rights.label}</span>
                    <span className={`an-chip is-${REVIEW[s.review.status].tone}`}>{REVIEW[s.review.status].label}</span>
                  </div>
                  <div className="an-cardactions">
                    <button type="button" className="an-primary" onClick={() => open(s.id)}>افتح النوتة</button>
                    <button type="button" className={`an-btn ${quick === s.id ? 'is-on' : ''}`} onClick={() => playQuick(s.id)} aria-label={quick === s.id ? `إيقاف ${s.title}` : `تشغيل سريع: ${s.title}`}><Icon d={quick === s.id ? 'stop' : 'play'} size={14} fill="currentColor" stroke={0} /> {quick === s.id ? 'إيقاف' : 'تشغيل سريع'}</button>
                    <button type="button" className="an-btn" onClick={() => open(s.id, 'practice')}><Icon d="target" size={15} /> تدرّب</button>
                  </div>
                </div>
              </article>
            );
          })}
          {!list.length && <p className="an-empty">لا نتائج مطابقة.</p>}
        </div>
        <p className="an-fine an-disclaimer">التشغيل السريع يعزف أول ثماني مازورات. كل الأصوات توليد تعليمي من النوتة، وليست تسجيلًا أصليًا.</p>

        {PENDING.length > 0 && (
          <section className="an-card an-pending">
            <h3><Icon d="info" size={18} /> لم تُدرج نوتته بعد</h3>
            {PENDING.map((p) => (
              <div key={p.id} className="an-pend">
                <b>{p.title}</b> <span className="an-chip is-warn">{REVIEW[p.review.status].label}</span>
                <p className="an-fine">{p.source.file} — {p.source.pages}. {p.source.printed}</p>
                <ul className="an-notes">{p.review.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
            ))}
          </section>
        )}

        <section className="an-card">
          <div className="an-sechead">
            <h3><Icon d="list" size={18} /> قائمة المراجعة الداخلية</h3>
            <button type="button" className="an-btn" aria-expanded={showReview} onClick={() => setShowReview((x) => !x)}>{showReview ? 'إخفاء' : 'عرض القائمة'}</button>
          </div>
          {showReview && <ReviewTable />}
        </section>

        {files.length > 0 && (
          <section className="an-card">
            <h3><Icon d="file" size={18} /> ملفات المصدر</h3>
            <p className="an-fine">الملفات المتاحة سابقًا في المكتبة، كما هي. لم يُتحقق من حقوقها.</p>
            <ul className="an-files">
              {files.map((f) => (
                <li key={f.id}>
                  <div><b>{f.title}</b><span className="an-fine">{f.description}</span></div>
                  <div className="an-row">
                    <span className="an-chip">{f.category}</span><span className="an-chip" dir="ltr">{String(f.type).toUpperCase()}</span>
                    <a className="an-btn" href={encodeURI(f.fileUrl)} target="_blank" rel="noopener noreferrer"><Icon d="book" size={15} /> عرض</a>
                    <a className="an-btn" href={encodeURI(f.fileUrl)} download><Icon d="download" size={15} /> تنزيل</a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="an-card">
          <h3><Icon d="target" size={18} /> ألعاب ذات صلة في المنصة</h3>
          <div className="an-row">{RELATED.map((r) => <Link key={r.href} className="an-btn" href={r.href}>{r.label} <span className="an-fine">({r.note})</span></Link>)}</div>
        </section>

        <SourcesFooter />
      </div>
    </div>
  );
}

function ReviewTable() {
  const rows = SONGS.map((s) => reviewRow(s.id));
  return (
    <div className="an-tablewrap">
      <table className="an-table">
        <thead><tr><th>النشيد</th><th>المازورات</th><th>المفتاح</th><th>السلم/الدليل</th><th>الميزان</th><th>الأصوات</th><th>المصدر</th><th>الحقوق</th><th>المراجعة</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row">{r.title}</th><td>{r.measures}</td><td>{r.clef}</td><td>{r.keyText}</td><td dir="ltr">{r.time}</td><td>{r.voices === 1 ? 'خط واحد' : r.voices}</td>
              <td className="an-fine">{r.source}</td><td>{r.rights}</td>
              <td><span>{r.review}</span><ul className="an-notes">{r.notes.map((n) => <li key={n}>{n}</li>)}</ul></td>
            </tr>
          ))}
          {PENDING.map((p) => (
            <tr key={p.id}><th scope="row">{p.title}</th><td>—</td><td>صول</td><td>—</td><td dir="ltr">2/4</td><td>صوتان في بعض المازورات</td><td className="an-fine">{p.source.file} — {p.source.pages}</td><td>{RIGHTS[p.rights].label}</td><td><span>{REVIEW[p.review.status].label}</span><ul className="an-notes">{p.review.notes.map((n) => <li key={n}>{n}</li>)}</ul></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
