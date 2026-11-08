'use client';
// «تدرّب على المارش»: سبعة تمارين تُولَّد من نوتة النشيد نفسها، والإجابات مستخرجة من البيانات الأصلية.
import { useEffect, useMemo, useRef, useState } from 'react';
import ScoreView from './ScoreView';
import { Icon } from './icons';
import { rng, noteQuestion, rhythmQuestion, completeQuestion, orderQuestion, checkOrder, listenQuestion, challenge, onsets, scoreTaps, explainNote, rhythmWords } from '@/lib/anthem/games';
import { TPQ, noteName, valueName, beatsOf } from '@/lib/anthem/notation';
import { defaultTempo, getSong } from '@/lib/anthem/songs';
import { click } from '@/lib/anthem/audio';
import { ls } from '@/lib/pd-workshops/browser';

export const GAMES = [
  { id: 'note', label: 'تعرّف على النغمة', icon: 'music' },
  { id: 'rhythm', label: 'تعرّف على الإيقاع', icon: 'ear' },
  { id: 'complete', label: 'أكمل المازورة', icon: 'edit' },
  { id: 'order', label: 'رتّب النغمات', icon: 'shuffle' },
  { id: 'listen', label: 'استمع وحدّد المازورة', icon: 'volume' },
  { id: 'challenge', label: 'تحدي المارش', icon: 'trophy' },
  { id: 'measure', label: 'تدرّب على مازورة', icon: 'tap' },
];
const MAKERS = { note: noteQuestion, rhythm: rhythmQuestion, complete: completeQuestion, order: orderQuestion, listen: listenQuestion };

/** نسخة من المازورة بلا ارتفاعات (كل النغمات على خط واحد) لعرض الإيقاع وحده */
function rhythmSong(music, mi, events) {
  const evs = (events || music.measures[mi].events).map((e) => (e.kind === 'note' ? { ...e, step: 'B', octave: 4, alter: 0, printed: null, pos: 34, midi: 71 } : { ...e }));
  return { ...music, key: 'C', measures: [{ ...music.measures[mi], index: 0, number: music.measures[mi].number, events: evs, chords: [], labels: [], volta: 0, startRepeat: false, endRepeat: false, segno: false, coda: false, toCoda: false, fine: false, ds: false, dsSign: false, bar: 'single' }] };
}
/** مازورة واحدة بأحداث بديلة (لخيارات «أكمل المازورة») */
function measureWith(music, mi, events) {
  let t = 0; const evs = events.map((e, j) => { const x = { ...e, start: t, index: j }; t += e.dur; return x; });
  return { ...music, measures: [{ ...music.measures[mi], index: 0, events: evs, chords: [], labels: [], volta: 0, startRepeat: false, endRepeat: false, segno: false, coda: false, toCoda: false, fine: false, ds: false, dsSign: false, bar: 'single' }] };
}
const seqOf = (events) => { let t = 0; return events.map((e) => { const x = { at: t / TPQ, dur: e.dur / TPQ, kind: e.kind, midi: e.midi, tiePrev: false }; t += e.dur; return x; }); };

export default function Practice({ music, title, player, test = false, songId }) {
  const [game, setGame] = useState(test ? 'challenge' : 'note');
  const seed = useRef(Date.now() % 100000);
  const [n, setN] = useState(0);
  const r = useMemo(() => rng(seed.current + n * 7919), [n]);
  const [score, setScore] = useState({ ok: 0, all: 0 });
  const bpm = useMemo(() => defaultTempo(getSong(songId)).bpm, [songId]);
  const audio = (fn) => { try { fn(player.current); } catch { /* المتصفح بلا صوت */ } };
  const playEvents = (events, inst) => audio((p) => p.previewSeq(seqOf(events), { inst, bpm: bpm * 0.85 }));
  const next = () => setN((x) => x + 1);
  const tally = (ok) => setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), all: s.all + 1 }));
  useEffect(() => { if (test) setGame('challenge'); }, [test]);

  return (
    <div className="an-practice">
      {!test && (
        <div className="an-games" role="tablist" aria-label="التمارين">
          {GAMES.map((g) => <button key={g.id} type="button" role="tab" aria-selected={game === g.id} className={`an-game ${game === g.id ? 'is-on' : ''}`} onClick={() => { setGame(g.id); next(); }}><Icon d={g.icon} size={17} /> {g.label}</button>)}
        </div>
      )}
      {!test && game !== 'challenge' && game !== 'measure' && <p className="an-score-line">الإجابات الصحيحة: <b>{score.ok}</b> من <b>{score.all}</b></p>}
      {game === 'challenge'
        ? <Challenge key={`c${n}`} music={music} r={r} test={test} songId={songId} title={title} playEvents={playEvents} audio={audio} onRestart={next} />
        : game === 'measure'
          ? <MeasureTap music={music} player={player} bpm={bpm} />
          : <Question key={`${game}${n}`} kind={game} music={music} r={r} playEvents={playEvents} audio={audio} onDone={tally} onNext={next} />}
    </div>
  );
}

/** سؤال واحد من الأنواع الخمسة الأساسية */
function Question({ kind, music, r, playEvents, audio, onDone, onNext, q: given, quiet = false, onAnswer }) {
  const q = useMemo(() => given || MAKERS[kind](music, r), [given, kind, music, r]);
  const [ans, setAns] = useState(null); const [order, setOrder] = useState([]);
  if (!q) return <p className="an-empty">لا يتيح هذا النشيد سؤالًا من هذا النوع (مثلًا لا توجد مازورات كافية مختلفة الإيقاع).</p>;
  const answer = (v, ok) => { if (ans !== null) return; setAns(v); if (onDone) onDone(ok); if (onAnswer) onAnswer(ok); };
  const feedback = (ok, text) => (quiet ? null : <div className={`an-feedback ${ok ? 'is-ok' : 'is-no'}`} role="status"><b>{ok ? 'إجابة صحيحة' : 'ليست الإجابة الصحيحة'}</b> {text}</div>);
  const nextBtn = onNext && ans !== null && <button type="button" className="an-primary" onClick={onNext}>سؤال آخر</button>;
  const ms = q.mi !== undefined ? music.measures[q.mi] : null;

  if (q.type === 'note') {
    const ok = ans === q.answer; const e = ms.events[q.ei];
    return (
      <div className="an-q">
        <h4>ما اسم النغمة المضاءة في المازورة {ms.number}؟</h4>
        <div className="an-qscore"><ScoreView song={music} measures={[q.mi]} sp={13} compact marks={{ [`${q.mi}:${q.ei}`]: 'target' }} autoScroll={false} /></div>
        <div className="an-options">{q.options.map((o) => <button key={o} type="button" className={`an-opt ${ans !== null && o === q.answer ? 'is-right' : ''} ${ans === o && !ok ? 'is-wrong' : ''}`} disabled={ans !== null} onClick={() => { answer(o, o === q.answer); audio((p) => p.preview(e.midi, 1)); }}>{o}</button>)}</div>
        {ans !== null && feedback(ok, `${q.explain} قيمتها: ${q.value}.`)}
        {nextBtn}
      </div>
    );
  }
  if (q.type === 'rhythm') {
    const ok = ans === q.answer;
    return (
      <div className="an-q">
        <h4>استمع إلى الإيقاع، ثم اختر كتابته الصحيحة.</h4>
        <button type="button" className="an-btn is-big" onClick={() => playEvents(music.measures[q.answer].events, 'drum')}><Icon d="play" size={16} fill="currentColor" stroke={0} /> استمع إلى الإيقاع</button>
        <div className="an-rgrid">{q.options.map((mi, k) => (
          <button key={mi} type="button" className={`an-ropt ${ans !== null && mi === q.answer ? 'is-right' : ''} ${ans === mi && !ok ? 'is-wrong' : ''}`} disabled={ans !== null} onClick={() => answer(mi, mi === q.answer)} aria-label={`الخيار ${k + 1}: ${rhythmWords(music.measures[mi])}`}>
            <ScoreView song={rhythmSong(music, mi)} sp={10} compact header={false} autoScroll={false} />
          </button>))}
        </div>
        {ans !== null && feedback(ok, `${q.explain} (المازورة ${music.measures[q.answer].number} في النشيد)`)}
        {nextBtn}
      </div>
    );
  }
  if (q.type === 'complete') {
    const chosen = q.options.find((o) => o.id === ans); const marks = {}; ms.events.forEach((_, j) => { if (j >= q.k) marks[`${q.mi}:${j}`] = 'hidden'; });
    const need = q.need; const unit = music.time === '6/8' ? 'سوداء منقوطة واحدة (= 1.5 سوداء)' : 'سوداء واحدة';
    return (
      <div className="an-q">
        <h4>أكمل المازورة {ms.number}: الجزء المخفي طوله {unit}. اختر التكملة التي تحترم الميزان وتطابق لحن النشيد.</h4>
        <div className="an-qscore"><ScoreView song={music} measures={[q.mi]} sp={13} compact marks={marks} autoScroll={false} /></div>
        <div className="an-rgrid">{q.options.map((o, k) => (
          <div key={o.id} className={`an-ropt ${ans !== null && o.original ? 'is-right' : ''} ${ans === o.id && !o.original ? 'is-wrong' : ''}`}>
            <button type="button" className="an-ropt-main" disabled={ans !== null} onClick={() => answer(o.id, o.original)} aria-label={`الخيار ${k + 1}`}>
              <ScoreView song={measureWith(music, q.mi, o.events)} sp={10} compact header={false} autoScroll={false} />
              <span className="an-fine">{o.events.map((e) => (e.kind === 'note' ? noteName(e) : 'سكتة')).join('، ')}</span>
            </button>
            <button type="button" className="an-link" onClick={() => playEvents([...ms.events.slice(0, q.k), ...o.events])}><Icon d="play" size={12} fill="currentColor" stroke={0} /> استمع للمازورة بهذه التكملة</button>
          </div>))}
        </div>
        {chosen && feedback(chosen.original, chosen.original
          ? `هذه نغمات النشيد الأصلية، ومجموع قيمها ${chosen.beats} سوداء = الطول المطلوب (${need}).`
          : chosen.fits ? `مجموع القيم ${chosen.beats} سوداء يكمل الميزان، لكن النغمات لا تطابق لحن النشيد. الصحيح: ${q.options.find((o) => o.original).events.map((e) => (e.kind === 'note' ? noteName(e) : 'سكتة')).join('، ')}.`
            : `مجموع القيم ${chosen.beats} سوداء، والمطلوب ${need}، فالمازورة لا تكتمل وفق الميزان ${music.time}.`)}
        {nextBtn}
      </div>
    );
  }
  if (q.type === 'order') {
    const done = ans !== null; const res = done ? checkOrder(music, q, order) : null; const byId = Object.fromEntries(q.tiles.map((t) => [t.id, t]));
    const left = q.tiles.filter((t) => !order.includes(t.id));
    return (
      <div className="an-q">
        <h4>رتّب نغمات المازورة {ms.number} كما في النشيد (من اليسار إلى اليمين كما تُقرأ النوتة).</h4>
        <button type="button" className="an-btn" onClick={() => playEvents(ms.events)}><Icon d="play" size={14} fill="currentColor" stroke={0} /> استمع إلى المازورة</button>
        <div className="an-tiles" aria-label="البطاقات المتاحة">{left.map((t) => <button key={t.id} type="button" className="an-tile" disabled={done} onClick={() => { setOrder((o) => [...o, t.id]); if (t.e.kind === 'note') audio((p) => p.preview(t.e.midi, 0.6)); }}>{t.label}</button>)}</div>
        <div className="an-answer" dir="ltr" aria-label="ترتيبك">
          {order.length ? order.map((id, i) => <button key={id} type="button" dir="rtl" className={`an-tile is-placed ${done && res.firstWrong !== -1 && i >= res.firstWrong ? 'is-wrong' : ''}`} disabled={done} onClick={() => setOrder((o) => o.filter((x) => x !== id))} title="اضغط لإرجاعها">{i + 1}. {byId[id].label}</button>) : <span className="an-fine" dir="rtl">اضغط البطاقات بالترتيب لتظهر هنا.</span>}
        </div>
        {!done && <button type="button" className="an-primary" disabled={order.length !== q.tiles.length} onClick={() => answer('x', checkOrder(music, q, order).ok)}>تحقق</button>}
        {done && feedback(res.ok, res.ok ? 'الترتيب مطابق للنوتة.' : `أول موضع مختلف: البطاقة رقم ${res.firstWrong + 1}. الترتيب الصحيح: ${ms.events.map((e) => (e.kind === 'note' ? `${noteName(e)} (${valueName(e)})` : valueName(e))).join(' ← ')}.`)}
        {done && <div className="an-qscore"><ScoreView song={music} measures={[q.mi]} sp={12} compact autoScroll={false} /></div>}
        {nextBtn}
      </div>
    );
  }
  if (q.type === 'listen') {
    const ok = ans === q.answer; const marks = {}; if (ans !== null) { marks[q.answer] = 'right'; if (!ok) marks[ans] = 'wrong'; }
    return (
      <div className="an-q">
        <h4>استمع، ثم اضغط المازورة التي سمعتها من بين المازورات {music.measures[q.mis[0]].number}–{music.measures[q.mis[q.mis.length - 1]].number}.</h4>
        <button type="button" className="an-btn is-big" onClick={() => playEvents(music.measures[q.answer].events)}><Icon d="play" size={16} fill="currentColor" stroke={0} /> استمع</button>
        <div className="an-qscore"><ScoreView song={music} measures={q.mis} sp={12} compact marks={marks} onMeasure={ans === null ? (mi) => answer(mi, mi === q.answer) : undefined} autoScroll={false} /></div>
        {ans !== null && feedback(ok, `المازورة المسموعة هي ${music.measures[q.answer].number}.`)}
        {nextBtn}
      </div>
    );
  }
  return null;
}

/** تحدي المارش: عشرة أسئلة متنوعة؛ في وضع الاختبار تظهر النتائج والتفسيرات في النهاية فقط */
function Challenge({ music, r, test, songId, title, playEvents, audio, onRestart }) {
  const qs = useMemo(() => challenge(music, r, 10), [music, r]);
  const [i, setI] = useState(0); const [results, setResults] = useState([]); const [t0] = useState(() => Date.now()); const [now, setNow] = useState(Date.now());
  const key = `mt-anthem:best:${songId}`; const [best, setBest] = useState(() => ls.get(key, null));
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const finished = i >= qs.length; const ok = results.filter(Boolean).length;
  useEffect(() => { if (finished && qs.length) { const sec = Math.round((Date.now() - t0) / 1000); if (!best || ok > best.ok || (ok === best.ok && sec < best.sec)) { const b = { ok, of: qs.length, sec }; ls.set(key, b); setBest(b); } } }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!qs.length) return <p className="an-empty">لا تكفي بيانات هذا النشيد لتحدٍّ كامل.</p>;
  const elapsed = Math.round(((finished ? now : Date.now()) - t0) / 1000);
  if (finished) {
    return (
      <div className="an-q an-final">
        <h4><Icon d="trophy" size={20} /> النتيجة: {ok} من {qs.length}</h4>
        <p>الزمن: {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} — {title}</p>
        {best && <p className="an-fine">أفضل نتيجة محفوظة على هذا الجهاز: {best.ok} من {best.of} في {best.sec} ثانية.</p>}
        <ol className="an-review-list">{qs.map((q, k) => <li key={k} className={results[k] ? 'is-ok' : 'is-no'}>{results[k] ? '✓' : '✗'} {summary(music, q)}</li>)}</ol>
        <button type="button" className="an-primary" onClick={onRestart}>تحدٍّ جديد</button>
      </div>
    );
  }
  return (
    <div className="an-challenge">
      <div className="an-chhead"><span>السؤال {i + 1} من {qs.length}</span><span dir="ltr">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span><span>الصحيح: {ok}</span></div>
      <progress max={qs.length} value={i} />
      <Question key={i} kind={qs[i].type} q={qs[i]} music={music} r={r} playEvents={playEvents} audio={audio} quiet={test}
        onAnswer={(good) => { setResults((x) => [...x, good]); setTimeout(() => setI((k) => k + 1), test ? 350 : 1600); }} />
    </div>
  );
}
function summary(music, q) {
  if (q.type === 'note') return `النغمة في المازورة ${music.measures[q.mi].number}: ${q.answer}. ${explainNote(music, q.mi, q.ei)}`;
  if (q.type === 'rhythm') return `إيقاع المازورة ${music.measures[q.answer].number}: ${rhythmWords(music.measures[q.answer])}.`;
  if (q.type === 'listen') return `المازورة المسموعة: ${music.measures[q.answer].number}.`;
  if (q.type === 'complete') return `تكملة المازورة ${music.measures[q.mi].number}: ${q.options.find((o) => o.original).events.map((e) => (e.kind === 'note' ? noteName(e) : 'سكتة')).join('، ')}.`;
  return '';
}

/** تدرّب على مازورة: استماع بسرعة مختارة، ثم النقر مع الإيقاع وتقييم دقة كل نغمة */
function MeasureTap({ music, player, bpm: base }) {
  const [mi, setMi] = useState(0); const [pct, setPct] = useState(70); const [withMelody, setWithMelody] = useState(true);
  const [phase, setPhase] = useState('idle'); const [result, setResult] = useState(null); const taps = useRef([]); const ctxRef = useRef(null); const timers = useRef([]);
  const bpm = Math.round((base * pct) / 100); const ms = music.measures[mi]; const beats = music.capacity / TPQ; const unit = music.beat / TPQ;
  const targets = useMemo(() => onsets(music, mi), [music, mi]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const listen = () => { try { player.current.previewSeq(seqOf(ms.events), { bpm }); } catch { /* */ } };
  const start = () => {
    let p; try { p = player.current; p.ensure(); } catch { return; }
    const ctx = p.ctx; const spb = 60 / bpm; const lead = 0.15; const t0 = ctx.currentTime + lead + beats * spb; // عدّ تمهيدي بطول مازورة
    for (let b = 0; b < beats - 1e-6; b += unit) click(ctx, p.master, ctx.currentTime + lead + b * spb, b === 0);
    if (withMelody) { const off = (t0 - ctx.currentTime - 0.05) / spb; p.previewSeq(seqOf(ms.events).map((e) => ({ ...e, at: e.at + off })), { bpm }); }
    ctxRef.current = { t0, spb }; taps.current = []; setResult(null); setPhase('count');
    timers.current.push(setTimeout(() => setPhase('tap'), Math.max(0, (t0 - ctx.currentTime) * 1000 - 120)));
    timers.current.push(setTimeout(() => { setResult(scoreTaps(targets, taps.current, 0.22)); setPhase('done'); }, (t0 - ctx.currentTime + beats * spb + 0.5) * 1000));
  };
  const tap = () => { const c = ctxRef.current; const p = player.current; if (!c || !p || !p.ctx || (phase !== 'tap' && phase !== 'count')) return; taps.current.push((p.ctx.currentTime - c.t0) / c.spb); };
  useEffect(() => { const h = (e) => { if (e.code === 'Space' && (phase === 'tap' || phase === 'count')) { e.preventDefault(); tap(); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); });
  return (
    <div className="an-q">
      <h4>اختر مازورة، استمع إليها، ثم انقر مع بداية كل نغمة بعد العدّ التمهيدي.</h4>
      <div className="an-measure-pick">
        <label className="an-select">المازورة
          <select value={mi} onChange={(e) => { setMi(Number(e.target.value)); setResult(null); setPhase('idle'); }}>
            {music.measures.map((m, i) => <option key={i} value={i}>{m.number}</option>)}
          </select>
        </label>
        <label className="an-select">السرعة
          <select value={pct} onChange={(e) => setPct(Number(e.target.value))}>{[50, 60, 70, 85, 100].map((x) => <option key={x} value={x}>{x}% ({Math.round((base * x) / 100)} ن/د)</option>)}</select>
        </label>
        <label className="an-switch"><input type="checkbox" checked={withMelody} onChange={(e) => setWithMelody(e.target.checked)} /> اللحن مع النقر</label>
      </div>
      <div className="an-qscore"><ScoreView song={music} measures={[mi]} sp={14} compact autoScroll={false} marks={result ? Object.fromEntries(ms.events.map((e, j) => [j, e]).filter(([, e]) => e.kind === 'note' && !e.tiePrev).map(([j], k) => [`${mi}:${j}`, result.results[k].hit ? 'right' : 'wrong'])) : undefined} /></div>
      <div className="an-row">
        <button type="button" className="an-btn" onClick={listen}><Icon d="play" size={14} fill="currentColor" stroke={0} /> استمع</button>
        <button type="button" className="an-primary" onClick={start} disabled={phase === 'count' || phase === 'tap'}>{phase === 'done' ? 'حاول مرة أخرى' : 'ابدأ التمرين'}</button>
      </div>
      {(phase === 'count' || phase === 'tap') && (
        <button type="button" className={`an-tap ${phase === 'tap' ? 'is-live' : ''}`} onPointerDown={(e) => { e.preventDefault(); tap(); }}>{phase === 'count' ? 'استعد… (عدّ تمهيدي)' : 'انقر هنا أو اضغط المسافة'}</button>
      )}
      {result && (
        <div className={`an-feedback ${result.hits === result.total && !result.extra ? 'is-ok' : 'is-no'}`} role="status">
          <b>الدقة: {result.score}%</b> أصبت {result.hits} من {result.total} بدايات{result.extra ? `، ونقرات زائدة: ${result.extra}` : ''}.
          <ul className="an-taps">{result.results.map((x, k) => <li key={k}>{k + 1}. {x.hit ? (Math.abs(x.delta) < 0.06 ? 'في الوقت' : x.delta < 0 ? `مبكرة ${Math.round(-x.delta * 60000 / bpm)} مللي ثانية` : `متأخرة ${Math.round(x.delta * 60000 / bpm)} مللي ثانية`) : 'لم تُنقر'}</li>)}</ul>
          <span className="an-fine">بدايات النغمات في هذه المازورة (بالسوداء): {targets.map((t) => beatsOf(t * TPQ)).join('، ')}. السكتات وامتدادات الأربطة لا تُنقر.</span>
        </div>
      )}
    </div>
  );
}
