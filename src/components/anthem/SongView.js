'use client';
// صفحة النشيد: النوتة + المشغّل المتزامن + الأوضاع (استماع، قراءة، تدريب، اختبار، المعلم) + بطاقة المصدر والحقوق.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ScoreView from './ScoreView';
import Practice from './Practice';
import SourcesFooter from './SourcesFooter';
import { engrave } from '@/lib/anthem/engrave';
import { Icon } from './icons';
import { getSong, RIGHTS, REVIEW, defaultTempo, tempoUnitLabel, keyText } from '@/lib/anthem/songs';
import { playOrder, buildTimeline, eventAt, noteName, valueName, keyLabel, keySigLabel, beatsOf, TPQ } from '@/lib/anthem/notation';
import { explainNote } from '@/lib/anthem/games';
import { AnthemPlayer, INSTRUMENTS } from '@/lib/anthem/audio';
import { ls, downloadBlob, safeFileName } from '@/lib/pd-workshops/browser';
import { CREDITS, RIGHTS_NOTE } from '@/lib/anthem/credits';
import { scorePdf } from '@/lib/anthem/pdf';

export const MODES = [
  { id: 'listen', label: 'الاستماع', icon: 'ear', hint: 'شغّل وتابع المؤشر على النوتة.' },
  { id: 'read', label: 'القراءة', icon: 'book', hint: 'أسماء النغمات تحتها، واضغط أي نغمة لتسمعها.' },
  { id: 'practice', label: 'التدريب', icon: 'target', hint: 'سبعة تمارين مستخرجة من نوتة هذا النشيد.' },
  { id: 'test', label: 'الاختبار', icon: 'trophy', hint: 'عشرة أسئلة متنوعة دون تلميحات، ونتيجة في النهاية.' },
  { id: 'teacher', label: 'وضع المعلم', icon: 'screen', hint: 'عرض كبير للسبورة، واختصارات لوحة المفاتيح، وبطاقة المراجعة.' },
];
const PRESETS = [{ p: 50, l: 'بطيء جدًا' }, { p: 75, l: 'بطيء' }, { p: 100, l: 'السرعة الأساسية' }, { p: 120, l: 'سريع' }];
const fmt = (sec) => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export default function SongView({ id, onBack, fav, onFav, initialMode = 'listen' }) {
  const [altKey, setAltKey] = useState('');
  const song = useMemo(() => getSong(id, altKey || undefined), [id, altKey]);
  const music = song.music;
  const [mode, setMode] = useState(initialMode);
  const [repeats, setRepeats] = useState(true);
  const order = useMemo(() => playOrder(music, { repeats, jumps: true }), [music, repeats]);
  const timeline = useMemo(() => buildTimeline(music, order), [music, order]);
  const def = useMemo(() => defaultTempo(song), [song]);
  const [bpm, setBpm] = useState(def.bpm);
  const [vol, setVol] = useState(() => ls.get('mt-anthem:vol', 0.8));
  const [inst, setInst] = useState(() => ls.get('mt-anthem:inst', 'piano'));
  const [metro, setMetro] = useState(false);
  const [zoom, setZoom] = useState(() => ls.get('mt-anthem:zoom', typeof window !== 'undefined' && window.innerWidth < 600 ? 8 : 10));
  const [names, setNames] = useState(false);
  const [sel, setSel] = useState(null); // {from,to} بفهارس المازورات
  const [extend, setExtend] = useState(false);
  const [loopOn, setLoopOn] = useState(false);
  const [state, setState] = useState({ playing: false, position: 0 });
  const [info, setInfo] = useState(null); // {mi,ei}
  const [audioErr, setAudioErr] = useState('');
  const [setOpen, setSetOpen] = useState(false);
  const player = useRef(null); const score = useRef(null); const prog = useRef(null); const timeRef = useRef(null); const barRef = useRef(null); const rootRef = useRef(null);

  useEffect(() => { setBpm(def.bpm); }, [def.bpm]);
  useEffect(() => { ls.set('mt-anthem:vol', vol); player.current?.setVolume(vol); }, [vol]);
  useEffect(() => { ls.set('mt-anthem:inst', inst); player.current?.setInstrument(inst); }, [inst]);
  useEffect(() => { ls.set('mt-anthem:zoom', zoom); }, [zoom]);
  useEffect(() => { setNames(mode === 'read'); if (mode === 'teacher') setZoom((z) => Math.max(z, 14)); if (mode === 'practice' || mode === 'test') { player.current?.stop(); } }, [mode]);

  // المشغّل
  useEffect(() => {
    const p = new AnthemPlayer({ onState: (s) => setState(s) }); player.current = p;
    return () => { p.close(); player.current = null; };
  }, []);
  useEffect(() => {
    const p = player.current; if (!p) return;
    p.load(timeline, { barBeats: music.capacity / TPQ, beatUnit: music.beat / TPQ }); p.bpm = bpm; p.setInstrument(inst); p.setVolume(vol); p.setMetronome(metro);
    setState({ playing: false, position: 0 }); score.current?.setCursor(null);
  }, [timeline]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { player.current?.setTempo(bpm); }, [bpm]);
  useEffect(() => { player.current?.setMetronome(metro); }, [metro]);

  // تحويل التحديد إلى مقطع على الخط الزمني (أول ظهور للمازورة في ترتيب العزف)
  const range = useMemo(() => {
    if (!sel) return null; const ms = timeline.measureStarts; const k = ms.findIndex((x) => x.mi === sel.from); if (k < 0) return null;
    let k2 = k; for (let j = k; j < ms.length; j++) { if (ms[j].mi === sel.to) { k2 = j; break; } if (j > k && ms[j].mi < sel.from) break; }
    return { from: ms[k].at, to: ms[k2].at + music.capacity / TPQ };
  }, [sel, timeline, music.capacity]);
  useEffect(() => { player.current?.setLoop(loopOn && range ? range : null); }, [loopOn, range]);

  // حلقة المؤشر: الموضع من ساعة الصوت
  useEffect(() => {
    let raf; const total = timeline.total;
    const step = () => {
      const p = player.current; if (p) {
        const pos = p.position(); const i = eventAt(timeline, pos);
        if (p.playing && i >= 0) { const e = timeline.events[i]; const frac = Math.min(1, (pos - e.at) / e.dur); score.current?.setCursor(e.mi, e.ei, frac, score.current.nextEventX(e.mi, e.ei)); if (barRef.current) barRef.current.textContent = String(music.measures[e.mi].number); }
        if (prog.current) prog.current.value = String(Math.min(total, pos));
        if (timeRef.current) timeRef.current.textContent = `${fmt((pos * 60) / p.bpm)} / ${fmt((total * 60) / p.bpm)}`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [timeline, music]);

  const guard = (fn) => { try { setAudioErr(''); fn(); } catch { setAudioErr('المتصفح لا يدعم تشغيل الصوت (Web Audio). جرّب متصفحًا حديثًا.'); } };
  const toggle = () => guard(() => { const p = player.current; if (p.playing) p.pause(); else { if (range && !loopOn && p.pausedAt === 0) p.play(range.from); else p.play(); } });
  const stop = () => { player.current?.stop(); score.current?.setCursor(null); };
  const restart = () => guard(() => { const p = player.current; p.stop(); p.play(loopOn && range ? range.from : 0); });
  const jump = (dir) => {
    const p = player.current; const pos = p.position(); const ms = timeline.measureStarts; let k = ms.findIndex((x) => x.at > pos + 1e-6) - 1; if (k < -1) k = ms.length - 1; if (k < 0) k = 0;
    const cur = ms[k]; const target = dir < 0 ? (pos - cur.at > 0.4 ? cur : ms[Math.max(0, k - 1)]) : ms[Math.min(ms.length - 1, k + 1)];
    p.seek(target.at); if (!p.playing) { const i = eventAt(timeline, target.at); if (i >= 0) score.current?.setCursor(timeline.events[i].mi, timeline.events[i].ei, 0); }
  };
  const onMeasure = useCallback((mi) => {
    setSel((s) => (extend && s && mi >= s.from ? { from: s.from, to: mi } : { from: mi, to: mi })); setExtend(false);
    const p = player.current; const k = timeline.measureStarts.find((x) => x.mi === mi);
    if (p && k && !p.playing) { p.seek(k.at); const i = eventAt(timeline, k.at); if (i >= 0) score.current?.setCursor(mi, timeline.events[i].ei, 0); }
  }, [extend, timeline]);
  const onNote = useCallback((mi, ei) => {
    setInfo({ mi, ei }); const e = music.measures[mi].events[ei];
    guard(() => player.current.preview(e.midi, Math.min(2, e.dur / TPQ)));
  }, [music]); // eslint-disable-line react-hooks/exhaustive-deps

  // اختصارات لوحة المفاتيح (خارج حقول الإدخال)
  useEffect(() => {
    const h = (e) => {
      if (/input|select|textarea/i.test(e.target.tagName) || mode === 'practice' || mode === 'test') return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); jump(-1); } else if (e.key === 'ArrowRight') { e.preventDefault(); jump(1); }
      else if (e.key === '+' || e.key === '=') setBpm((b) => Math.min(240, b + 4)); else if (e.key === '-') setBpm((b) => Math.max(30, b - 4));
      else if (e.key === 'Home') restart();
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });

  const total = timeline.total; const pct = Math.round((bpm / def.bpm) * 100);
  const nameOf = useCallback((e) => noteName(e), []);
  const ev = info ? music.measures[info.mi].events[info.ei] : null;
  const rights = RIGHTS[song.rights]; const review = REVIEW[song.review.status];
  const showPlayer = mode !== 'practice' && mode !== 'test';
  const [pdfBusy, setPdfBusy] = useState(false);
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const c = CREDITS[song.id];
      const credits = c ? [`بيانات العمل${c.alsoKnown ? ' — ' + c.alsoKnown : ''}`, ...c.rows.filter((r) => r.status !== 'unverified').map((r) => `${r.role}: ${r.value}`)] : [];
      const bytes = await scorePdf({
        title: song.title, music, names,
        meta: `${altKey ? keyLabel(music.key) : keyText(song, music)} · ${music.time} · ${music.measures.length} مازورة${music.tempo ? ` · السرعة ${music.tempo}` : ''}${names ? ' · مع أسماء النغمات' : ''}`,
        credits,
        footer: [`مصدر النوتة: ${song.source.file}، ${song.source.pages}. ${song.source.partial || ''}`.trim(), RIGHTS_NOTE, 'نسخة تعليمية مولّدة من أداة «نوتات النشيد والمارشات».'],
      });
      downloadBlob(bytes, `${safeFileName(song.title)}${names ? ' - أسماء النغمات' : ''}.pdf`, 'application/pdf');
    } catch (e) { setAudioErr('تعذّر تجهيز ملف PDF في هذا المتصفح.'); }
    setPdfBusy(false);
  };
  const fullscreen = () => { const el = rootRef.current; if (!document.fullscreenElement) el?.requestFullscreen?.(); else document.exitFullscreen?.(); };

  return (
    <div ref={rootRef} className={`an-song is-${mode}`}>
      <div className="an-songhead">
        <button type="button" className="an-back" onClick={onBack}><Icon d="back" size={16} /> المكتبة</button>
        <div className="an-songtitle">
          <h2>{song.title}</h2>
          <div className="an-chips">
            <span className="an-chip">{altKey ? keyLabel(music.key) : keyText(song, music)}</span>
            <span className="an-chip" dir="ltr">{music.time}</span>
            <span className="an-chip">{music.measures.length} مازورة</span>
            <span className={`an-chip is-${rights.tone}`}><Icon d="shield" size={14} /> {rights.label}</span>
            <span className={`an-chip is-${review.tone}`}>{review.label}</span>
          </div>
        </div>
        <button type="button" className={`an-fav ${fav ? 'is-on' : ''}`} aria-pressed={fav} onClick={onFav} title={fav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}><Icon d="star" size={20} fill={fav ? 'currentColor' : undefined} /></button>
      </div>

      <div className="an-modes" role="tablist" aria-label="أوضاع العرض">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={`an-mode ${mode === m.id ? 'is-on' : ''}`} onClick={() => { setMode(m.id); }}>
            <Icon d={m.icon} size={17} /> {m.label}
          </button>
        ))}
      </div>
      <p className="an-modehint">{MODES.find((m) => m.id === mode).hint}</p>

      {(mode === 'practice' || mode === 'test') ? (
        <Practice music={music} title={song.title} player={player} test={mode === 'test'} songId={song.id} />
      ) : (
        <>
          <div className="an-toolbar">
            <div className="an-tgroup">
              <button type="button" className="an-ibtn" onClick={() => setZoom((z) => Math.max(7, z - 1))} aria-label="تصغير"><Icon d="zoomOut" /></button>
              <span className="an-zoom" aria-live="polite">{Math.round((zoom / 10) * 100)}%</span>
              <button type="button" className="an-ibtn" onClick={() => setZoom((z) => Math.min(22, z + 1))} aria-label="تكبير"><Icon d="zoomIn" /></button>
            </div>
            <label className="an-switch"><input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} /> أسماء النغمات</label>
            {song.alt && song.alt.length > 0 && (
              <label className="an-select">السلم
                <select value={altKey} onChange={(e) => { stop(); setAltKey(e.target.value); }}>
                  <option value="">{keyLabel(getSong(id).music.key)} (الأصل)</option>
                  {song.alt.map((a) => <option key={a.key} value={a.key}>{keyLabel(a.key)} (نسخة المصدر)</option>)}
                </select>
              </label>
            )}
            {mode === 'teacher' && <button type="button" className="an-btn" onClick={fullscreen}><Icon d="full" size={16} /> ملء الشاشة</button>}
            <button type="button" className="an-btn" onClick={() => window.print()} title="طباعة النوتة مع التوثيق المختصر"><Icon d="print" size={16} /> طباعة</button>
            <button type="button" className="an-btn an-pdfbtn" disabled={pdfBusy} onClick={downloadPdf} title="تنزيل النوتة كما تظهر الآن (بالسلم المختار، ومع أسماء النغمات إن كانت مفعّلة)">
              <Icon d="download" size={16} /> {pdfBusy ? 'جارٍ التجهيز…' : `تحميل PDF${names ? ' (مع أسماء النغمات)' : ''}`}
            </button>
          </div>

          <div className="an-scorebox" data-an-scroll>
            <ScoreView ref={score} song={music} sp={zoom} showNames={names} nameOf={nameOf} onNote={onNote} onMeasure={onMeasure} selection={sel} label={`نوتة ${song.title}`} />
          </div>

          {ev && (
            <div className="an-noteinfo" role="status">
              <button type="button" className="an-x" onClick={() => setInfo(null)} aria-label="إغلاق"><Icon d="x" size={16} /></button>
              <strong>{ev.kind === 'note' ? noteName(ev) : 'سكتة'}</strong>
              {ev.kind === 'note' && <span className="an-latin" dir="ltr">{noteName(ev, { latin: true })}</span>}
              <span>{valueName(ev)} — {beatsOf(ev.dur)} من السوداء</span>
              <span>المازورة {music.measures[info.mi].number}</span>
              {ev.kind === 'note' && <span className="an-fine">{explainNote(music, info.mi, info.ei)}</span>}
            </div>
          )}

          <div className="an-selbar">
            {sel ? (
              <>
                <span>التحديد: المازورة {music.measures[sel.from].number}{sel.to !== sel.from ? ` إلى ${music.measures[sel.to].number}` : ''}</span>
                <button type="button" className={`an-btn ${extend ? 'is-on' : ''}`} onClick={() => setExtend((x) => !x)}>{extend ? 'اضغط مازورة النهاية…' : 'مدّ التحديد'}</button>
                <button type="button" className={`an-btn ${loopOn ? 'is-on' : ''}`} aria-pressed={loopOn} onClick={() => setLoopOn((x) => !x)}><Icon d="loop" size={16} /> {loopOn ? 'التكرار يعمل' : 'كرّر التحديد'}</button>
                <button type="button" className="an-btn" onClick={() => guard(() => player.current.play(range.from))}><Icon d="play" size={14} fill="currentColor" /> ابدأ من هنا</button>
                <button type="button" className="an-link" onClick={() => { setSel(null); setLoopOn(false); }}>إلغاء</button>
              </>
            ) : <span className="an-fine">اضغط أي مازورة لتبدأ منها أو لتكرارها، واضغط أي نغمة لتسمعها وتعرف اسمها وقيمتها.</span>}
          </div>

          {mode === 'teacher' && <ReviewCard song={song} music={music} />}
        </>
      )}

      <PrintScore song={song} music={music} />
      <SourcesFooter current={song.id} />

      {showPlayer && (
        <div className="an-player" role="region" aria-label="المشغّل">
          <div className="an-prow">
            <button type="button" className="an-ibtn" onClick={restart} title="من البداية (Home)" aria-label="من البداية"><Icon d="restart" /></button>
            <button type="button" className="an-ibtn" onClick={() => jump(-1)} title="المازورة السابقة" aria-label="المازورة السابقة"><Icon d="prevBar" /></button>
            <button type="button" className="an-play" onClick={toggle} aria-label={state.playing ? 'إيقاف مؤقت' : 'تشغيل'} title="تشغيل/إيقاف (المسافة)"><Icon d={state.playing ? 'pause' : 'play'} size={24} fill="currentColor" stroke={0} /></button>
            <button type="button" className="an-ibtn" onClick={() => jump(1)} title="المازورة التالية" aria-label="المازورة التالية"><Icon d="nextBar" /></button>
            <button type="button" className="an-ibtn" onClick={stop} aria-label="إيقاف"><Icon d="stop" fill="currentColor" stroke={0} /></button>
            <div className="an-progress">
              <input ref={prog} type="range" min="0" max={total} step="0.01" defaultValue="0" aria-label="موضع التشغيل" dir="ltr" onChange={(e) => player.current?.seek(Number(e.target.value))} />
              <div className="an-ptimes"><span ref={timeRef} dir="ltr">0:00</span><span>المازورة <b ref={barRef}>1</b></span></div>
            </div>
            <button type="button" className={`an-ibtn an-setbtn ${setOpen ? 'is-on' : ''}`} aria-expanded={setOpen} onClick={() => setSetOpen((x) => !x)} aria-label="إعدادات التشغيل" title="السرعة والصوت"><Icon d="tools" /></button>
          </div>
          <div className={`an-prow is-settings ${setOpen ? 'is-open' : ''}`}>
            <div className="an-tempo">
              <label>السرعة
                <input type="number" min="30" max="240" value={bpm} onChange={(e) => setBpm(Math.max(30, Math.min(240, Number(e.target.value) || def.bpm)))} aria-label="السرعة بعدد النبضات في الدقيقة" />
                <small>ن/د ({pct}%)</small>
              </label>
              <div className="an-presets" role="group" aria-label="سرعات جاهزة">
                {PRESETS.map((x) => <button type="button" key={x.p} className={`an-pill ${pct === x.p ? 'is-on' : ''}`} onClick={() => setBpm(Math.round((def.bpm * x.p) / 100))}>{x.l}</button>)}
              </div>
            </div>
            <label className="an-select">الصوت
              <select value={inst} onChange={(e) => setInst(e.target.value)}>{INSTRUMENTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
            </label>
            <label className="an-vol"><Icon d="volume" size={18} /><input type="range" min="0" max="1" step="0.05" value={vol} onChange={(e) => setVol(Number(e.target.value))} aria-label="مستوى الصوت" dir="ltr" /></label>
            <label className="an-switch"><input type="checkbox" checked={metro} onChange={(e) => setMetro(e.target.checked)} /> <Icon d="metro" size={16} /> مترونوم</label>
            <label className="an-switch"><input type="checkbox" checked={repeats} onChange={(e) => { stop(); setRepeats(e.target.checked); }} /> الإعادات</label>
          </div>
          {audioErr && <p className="an-err">{audioErr}</p>}
          <p className={`an-fine an-disclaimer ${setOpen ? 'is-open' : ''}`}>الصوت توليد تعليمي من النوتة بأصوات مركّبة تقريبية، وليس تسجيلًا ولا أداءً أصليًا. {def.fromSource ? `السرعة الأساسية مطبوعة في المصدر (♩=${def.bpm}).` : `السرعة غير مدونة في المصدر؛ ${def.bpm} نبضة/دقيقة اقتراح للتدريس (${tempoUnitLabel(music.time)}).`}</p>
        </div>
      )}
    </div>
  );
}

/** نسخة الطباعة: كل سطر نوتة في SVG مستقل حتى لا يُقطع مدرج بين صفحتين */
function PrintScore({ song, music }) {
  const W = 700; const sp = 8;
  const systems = useMemo(() => engrave(music, { width: W, sp }).systems, [music]);
  return (
    <div className="an-print" aria-hidden="true">
      <h1>{song.title}</h1>
      <p className="an-print-meta">{keyText(song, music)} · <span dir="ltr">{music.time}</span> · {music.measures.length} مازورة{music.tempo ? ` · ♩=${music.tempo}` : ''}</p>
      {systems.map((sy, i) => (
        <div key={i} className="an-print-sys"><ScoreView song={music} measures={sy.measures} sp={sp} fixedWidth={W} header={i === 0} autoScroll={false} label={`${song.title} — السطر ${i + 1}`} /></div>
      ))}
    </div>
  );
}

export function SourceCard({ song, def }) {
  const rights = RIGHTS[song.rights];
  return (
    <section className="an-card an-source" aria-labelledby={`src-${song.id}`}>
      <h3 id={`src-${song.id}`}><Icon d="shield" size={18} /> المصدر والحقوق</h3>
      <dl className="an-dl">
        <dt>العنوان</dt><dd>{song.title}</dd>
        <dt>الملحن</dt><dd>{song.composer}</dd>
        <dt>مصدر النوتة</dt><dd>{song.source.file} — {song.source.pages}{song.source.also ? <><br /><span className="an-fine">نسخة أخرى: {song.source.also}</span></> : null}</dd>
        <dt>ما هو مطبوع في المصدر</dt><dd>{song.source.printed}</dd>
        {song.source.partial && <><dt>ما نُقل</dt><dd>{song.source.partial}</dd></>}
        {song.source.related && <><dt>ملف ذو صلة</dt><dd>{song.source.related}</dd></>}
        <dt>مصدر التسجيل</dt><dd>{song.recording}{song.recordingLink && <><br /><a className="an-link" href={song.recordingLink.url} target="_blank" rel="noopener noreferrer">رابط تسجيل خارجي</a> <span className="an-fine">{song.recordingLink.note}</span></>}</dd>
        <dt>حالة الحقوق</dt><dd><span className={`an-chip is-${rights.tone}`}>{rights.label}</span></dd>
        <dt>الاستخدام المسموح</dt><dd>{song.allowedUse}</dd>
        <dt>ملاحظات قانونية</dt><dd><ul>{song.legal.map((l) => <li key={l}>{l}</li>)}</ul></dd>
        {def && <><dt>السرعة</dt><dd>{def.fromSource ? `مطبوعة في المصدر: ♩=${def.bpm}` : 'غير مدونة في المصدر'}</dd></>}
      </dl>
    </section>
  );
}
export function ReviewCard({ song, music }) {
  const review = REVIEW[song.review.status];
  return (
    <section className="an-card an-review">
      <h3><Icon d="list" size={18} /> بطاقة المراجعة الداخلية</h3>
      <div className="an-revgrid">
        <div><small>عدد المازورات</small><b>{music.measures.length}</b></div>
        <div><small>المفتاح</small><b>{song.clef}</b></div>
        <div><small>الدليل</small><b>{keySigLabel(music.key)}</b></div>
        <div><small>الميزان</small><b dir="ltr">{music.time}</b></div>
        <div><small>الأصوات</small><b>{song.voices === 1 ? 'خط لحني واحد' : song.voices}</b></div>
        <div><small>المراجعة</small><b className={`is-${review.tone}`}>{review.label}</b></div>
      </div>
      <ul className="an-notes">{song.review.notes.map((n) => <li key={n}>{n}</li>)}</ul>
    </section>
  );
}
