'use client';
// كارت «كوبون التميز»: نص حقيقي + زخارف متجهة (SVG) بمقاسات مليمترية، فيُطبع حادًّا بالألوان أو بالأبيض والأسود.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { templateById } from '../data/templates.js';
import { phraseText, toLabel, signLabel } from '../data/phrases.js';
import { shapeOf, unitOf, headlineScale } from '../core/layout.js';
import { fmtDate, todayISO } from '../core/tracker.js';

const starPts = (cx, cy, r, ri = r * 0.45, n = 5) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (Math.PI / n) * i - Math.PI / 2; const rr = i % 2 ? ri : r;
  return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
}).join(' ');
const Spark = ({ x, y, s = 5, c = 'var(--c2)' }) => <path d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s}Z`} fill={c} />;

/* ---------- الزخارف (viewBox 0 0 100 100) ---------- */
const MOTIFS = {
  music: () => (
    <>
      <g fill="none" stroke="var(--c2)" strokeWidth="1.1" opacity=".55">
        {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M0 ${58 + i * 5} C 26 ${46 + i * 5}, 52 ${76 + i * 5}, 100 ${54 + i * 5}`} />)}
      </g>
      <path d="M27 92c-7 2-11-5-6-9 4-3 9 0 7 6L21 20c-1-9 7-14 10-7 4 8-6 18-13 25-9 9-9 22 3 26 12 4 21-5 17-13-4-7-14-5-14 2 0 5 4 7 8 6" fill="none" stroke="var(--c1)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="var(--c1)">
        <ellipse cx="52" cy="66" rx="6.2" ry="4.6" transform="rotate(-22 52 66)" /><ellipse cx="72" cy="60" rx="6.2" ry="4.6" transform="rotate(-22 72 60)" />
        <rect x="56.6" y="30" width="2.4" height="35" /><rect x="76.6" y="24" width="2.4" height="35" />
        <path d="M56.6 30 L79 24 L79 31 L56.6 37Z" />
        <ellipse cx="90" cy="44" rx="5.4" ry="4" transform="rotate(-22 90 44)" /><rect x="93.6" y="14" width="2.2" height="30" />
        <path d="M95.8 14c4 3 6 7 2 12 2-5-1-8-2-8z" />
      </g>
    </>
  ),
  stars: () => (
    <>
      <polygon points={starPts(50, 54, 36)} fill="var(--tint)" stroke="var(--c1)" strokeWidth="3.5" strokeLinejoin="round" />
      <polygon points={starPts(50, 56, 17)} fill="var(--c1)" />
      <Spark x={14} y={18} s={7} /><Spark x={88} y={20} s={5} /><Spark x={86} y={86} s={6} /><Spark x={12} y={84} s={4} c="var(--c1)" />
    </>
  ),
  trophy: () => (
    <>
      <path d="M30 18H70V36C70 52 61 61 50 61S30 52 30 36Z" fill="var(--tint)" stroke="var(--c1)" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M30 24H19C17 38 24 46 32 46M70 24H81C83 38 76 46 68 46" fill="none" stroke="var(--c1)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M46 61V71H54V61" fill="var(--c1)" />
      <rect x="35" y="71" width="30" height="7" rx="2" fill="var(--c1)" /><rect x="30" y="80" width="40" height="8" rx="2" fill="var(--c1)" />
      <polygon points={starPts(50, 37, 10)} fill="var(--c2)" />
      <Spark x={14} y={14} s={6} /><Spark x={88} y={12} s={5} />
    </>
  ),
  medal: () => (
    <>
      <polygon points="30,4 44,4 57,36 43,36" fill="var(--c2)" /><polygon points="70,4 56,4 43,36 57,36" fill="var(--c1)" />
      <circle cx="50" cy="62" r="27" fill="var(--tint)" stroke="var(--c1)" strokeWidth="3.5" />
      <circle cx="50" cy="62" r="19" fill="none" stroke="var(--c2)" strokeWidth="1.6" strokeDasharray="3 2.4" />
      <polygon points={starPts(50, 63, 13)} fill="var(--c1)" />
    </>
  ),
  book: () => (
    <>
      <path d="M50 32C40 24 25 23 12 27V80C25 76 40 76 50 84Z" fill="var(--tint)" stroke="var(--c1)" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M50 32C60 24 75 23 88 27V80C75 76 60 76 50 84Z" fill="var(--tint)" stroke="var(--c1)" strokeWidth="3.2" strokeLinejoin="round" />
      <g stroke="var(--c2)" strokeWidth="1.8" strokeLinecap="round" opacity=".8"><path d="M20 40C28 38 36 38 43 42M20 50C28 48 36 48 43 52M20 60C28 58 36 58 43 62M57 42C64 38 72 38 80 40M57 52C64 48 72 48 80 50M57 62C64 58 72 58 80 60" /></g>
      <Spark x={50} y={12} s={7} /><Spark x={22} y={10} s={4} c="var(--c1)" /><Spark x={80} y={12} s={5} />
    </>
  ),
  rocket: () => (
    <>
      <path d="M50 8C65 20 69 42 64 66H36C31 42 35 20 50 8Z" fill="var(--tint)" stroke="var(--c1)" strokeWidth="3.4" strokeLinejoin="round" />
      <circle cx="50" cy="38" r="7.5" fill="var(--c1)" /><circle cx="50" cy="38" r="3.4" fill="var(--tint)" />
      <path d="M36 52L22 70L36 66ZM64 52L78 70L64 66Z" fill="var(--c1)" />
      <path d="M41 68Q50 96 59 68Z" fill="var(--c2)" />
      <Spark x={14} y={22} s={6} /><Spark x={86} y={30} s={5} /><Spark x={84} y={84} s={4} c="var(--c1)" />
    </>
  ),
  laurel: () => {
    const leaves = (mir) => [0, 1, 2, 3, 4, 5].map((i) => {
      const t = i / 5; const x = 50 + (mir ? 1 : -1) * (24 + Math.sin(t * Math.PI) * 14 - t * 6); const y = 86 - t * 62;
      return <ellipse key={`${mir}${i}`} cx={x.toFixed(1)} cy={y.toFixed(1)} rx="4" ry="8.5" transform={`rotate(${(mir ? 1 : -1) * (30 + t * 20)} ${x.toFixed(1)} ${y.toFixed(1)})`} fill={i % 2 ? 'var(--c1)' : 'var(--tint)'} stroke="var(--c1)" strokeWidth="1.6" />;
    });
    return (
      <>
        <path d="M48 90C28 82 18 58 26 22M52 90C72 82 82 58 74 22" fill="none" stroke="var(--c1)" strokeWidth="2.4" strokeLinecap="round" />
        {leaves(false)}{leaves(true)}
        <polygon points={starPts(50, 46, 15)} fill="var(--c2)" />
      </>
    );
  },
  palette: () => (
    <>
      <path d="M50 14C26 14 10 30 10 50S26 86 46 86C54 86 56 80 52 74S52 62 60 62H72C84 62 90 54 90 46 90 26 72 14 50 14Z" fill="var(--tint)" stroke="var(--c1)" strokeWidth="3.4" strokeLinejoin="round" />
      <circle cx="30" cy="40" r="6" fill="var(--c1)" /><circle cx="46" cy="28" r="6" fill="var(--c2)" /><circle cx="66" cy="30" r="6" fill="var(--ec-p3)" /><circle cx="26" cy="60" r="6" fill="var(--ec-p4)" />
      <path d="M96 6L66 50" stroke="var(--c1)" strokeWidth="4" strokeLinecap="round" /><path d="M66 50C60 52 58 58 60 62 66 60 70 56 66 50Z" fill="var(--c2)" />
    </>
  ),
};

export function Motif({ name, className }) {
  const M = MOTIFS[name] || MOTIFS.stars;
  return <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet"><M /></svg>;
}

function GiftSlot() {
  return (
    <div className="ec-gift">
      <svg className="ec-bow" viewBox="0 0 100 46" aria-hidden="true">
        <g stroke="var(--c1)" strokeWidth="3" strokeLinecap="round"><path d="M50 4V-2M30 8L24 2M70 8L76 2" opacity=".7" /></g>
        <path d="M50 30C38 14 16 12 18 26 20 36 40 34 50 30ZM50 30C62 14 84 12 82 26 80 36 60 34 50 30Z" fill="var(--tint)" stroke="var(--c1)" strokeWidth="3.2" strokeLinejoin="round" />
        <path d="M46 31L36 45M54 31L64 45" stroke="var(--c1)" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="50" cy="30" r="5.4" fill="var(--c1)" />
      </svg>
      <div className="ec-gift-box" />
    </div>
  );
}

/** بيانات الكارت النهائية من إعدادات المعلم + بيانات الكارت */
export function cardData(settings, card, now = new Date()) {
  const text = phraseText(card);
  const [l1, ...rest] = text.split('\n');
  const date = card.dateMode === 'blank' ? '' : card.dateMode === 'fixed' ? fmtDate(card.date) : fmtDate(todayISO(now));
  return { l1, l2: rest.join(' '), text, date, student: card.student, grade: card.grade, gender: card.gender, gift: card.gift, tpl: templateById(card.template), settings };
}

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** يصغّر النص تدريجيًا حتى يتسع داخل الكارت — يعمل مع أي عبارة أو اسم يكتبه المعلم، ويُعاد بعد تحميل الخطوط */
function fitCard(el) {
  if (!el) return;
  const step = (prop, over, min = 0.55, by = 0.04) => {
    let k = 1; el.style.setProperty(prop, '1');
    for (let i = 0; i < 16 && over() && k > min; i++) { k = Math.max(min, k - by); el.style.setProperty(prop, k.toFixed(2)); }
  };
  const msg = el.querySelector('.ec-msg');
  if (msg) step('--fit', () => msg.scrollHeight > msg.clientHeight + 1);
  const wide = (sel) => { const x = el.querySelector(sel); return () => !!x && x.scrollWidth > x.clientWidth + 0.5; };
  step('--fo', wide('.ec-org'), 0.6, 0.05);
  step('--fn', wide('.ec-student'), 0.6, 0.05);
  step('--fh', wide('.ec-name'), 0.65, 0.05);
}

/**
 * w/h بالمليمتر. bw: أبيض وأسود موفّر للحبر.
 */
export default function Card({ settings, card, w, h, bw = false, now }) {
  const d = cardData(settings, card, now);
  const ref = useRef(null);
  const sig = [d.text, d.student, d.grade, d.gift, w, h, settings.initiativeName, settings.school, settings.teacher, settings.subject, card.template, d.date].join('|');
  useIso(() => {
    fitCard(ref.current);
    let alive = true;
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive) fitCard(ref.current); });
    return () => { alive = false; };
  }, [sig]);
  const shape = shapeOf(w, h); const u = unitOf(w, h); const k = headlineScale(d.text);
  const t = d.tpl;
  const style = {
    width: `${w}mm`, height: `${h}mm`, '--u': `${u}mm`, '--k': k,
    '--c1': bw ? '#111' : t.c1, '--c2': bw ? '#555' : t.c2, '--tint': bw ? '#fff' : t.tint,
    '--ec-p3': bw ? '#888' : '#f59e0b', '--ec-p4': bw ? '#bbb' : '#10b981',
  };
  const org = [settings.school, settings.teacher].filter(Boolean).join(' · ');
  return (
    <div ref={ref} className={`ec-card is-${shape} fr-${t.frame} ${bw ? 'is-bw' : ''} ${d.gift ? 'has-gift' : 'no-gift'}`} style={style} data-template={t.id}>
      <div className="ec-in">
        <div className="ec-head">
          <span className="ec-name"><svg viewBox="0 0 24 24" aria-hidden="true"><polygon points={starPts(12, 12.6, 11)} fill="currentColor" /></svg>{settings.initiativeName}</span>
          {settings.subject ? <span className="ec-subj">{settings.subject}</span> : null}
        </div>
        <div className="ec-body">
          <div className="ec-side">{d.gift ? <GiftSlot /> : <Motif name={t.motif} className="ec-emblem" />}</div>
          <div className="ec-msg"><p className="ec-l1">{d.l1}</p>{d.l2 ? <p className="ec-l2">{d.l2}</p> : null}</div>
          {d.gift ? <div className="ec-deco"><Motif name={t.motif} /></div> : null}
        </div>
        <div className="ec-to">
          <span className="ec-to-l">{toLabel(d.gender)}</span>
          {d.student ? <b className="ec-student">{d.student}</b> : <span className="ec-line" />}
          {d.grade ? <span className="ec-grade">الصف: {d.grade}</span> : null}
        </div>
        <div className="ec-foot">
          <span className="ec-date">التاريخ: {d.date ? <bdi dir="ltr">{d.date}</bdi> : <span className="ec-line is-short" />}</span>
          <span className="ec-sign">{signLabel(settings.teacherGender)}: <span className="ec-line is-short" /></span>
        </div>
        {org ? <div className="ec-org">{org}</div> : null}
      </div>
    </div>
  );
}
