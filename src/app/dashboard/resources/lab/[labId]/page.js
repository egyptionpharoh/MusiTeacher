'use client';
// مشغّل ألعاب استوديو الموسيقى الافتراضي: يطلب جلسة من الخادم (تحقق Firebase + الاشتراك) ثم يضع اللعبة في iframe من /play/<id>/.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import { getGame, publicGameInfo, GAME_CATEGORIES } from '@/data/virtualGames';
import '@/components/virtual-lab/virtual-lab.css';
// زر «مشاركة اللعبة مع الطلاب»: رابط النسخة الطلابية في MusiTeacher Games + رمز الدخول (لا يغيّر شيئًا في اللعبة الأصلية)
import ShareGameButton from '@/components/student-games/ShareGameButton';
import { fullscreenHint, deviceAdvice } from '@/components/virtual-lab/guides';
import '@/components/virtual-lab/guides.css';
import { GAME_DEVICES } from '@/data/gameDevices';

const REFRESH_MS = 20 * 60 * 1000;

// ---------- العلامة المائية (هوية المستخدم فوق اللعبة) ----------
// كانت 80 نسخة من البريد تغطي الشاشة كلها. الآن: ثلاث علامات صغيرة باهتة في هوامش المشهد (بعيدًا عن وسطه حيث الآلة والعازف)،
// تنتقل بهدوء بين مواضع آمنة كل دقيقة (يصعّب قصّها من لقطة الشاشة دون أن يزعج الطالب)، ولا تلتقط النقر أبدًا.
// المواضع بالنسبة المئوية من مساحة اللعبة: كلها في الهامش الأيسر بين 15% و66% من الارتفاع (العازف والآلة في الوسط،
// وأدوات التحكم أعلى ويمين، ولوحات النغمة الحالية أسفل اليسار)، وتتبدّل ارتفاعاتها فقط.
const WM_SLOTS = [
  [{ x: 2, y: 20 }, { x: 2.5, y: 42 }, { x: 2, y: 62 }],
  [{ x: 2.5, y: 26 }, { x: 2, y: 48 }, { x: 3, y: 66 }],
  [{ x: 2, y: 15 }, { x: 3, y: 36 }, { x: 2, y: 56 }],
];
const WM_MOVE_MS = 60 * 1000, WM_FADE_MS = 1200;
function Watermark({ who }) {
  const [step, setStep] = useState(0);
  const [fade, setFade] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    let t2;
    const t = setInterval(() => { setFade(true); t2 = setTimeout(() => { setStep((s) => s + 1); setFade(false); }, WM_FADE_MS); }, WM_MOVE_MS);
    return () => { clearInterval(t); clearTimeout(t2); };
  }, []);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 700);
    on(); window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const slots = WM_SLOTS[step % WM_SLOTS.length].slice(0, narrow ? 2 : 3);
  const text = `${who ? `${who} · ` : ''}MusiTeacher`;
  return (
    <div className="vlp-wm-lite" aria-hidden="true"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', userSelect: 'none', zIndex: 2 }}>
      {slots.map((p, i) => (
        <span key={i} style={{
          position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'rotate(-12deg)', transformOrigin: 'left center',
          whiteSpace: 'nowrap', direction: 'ltr', fontSize: 'clamp(10px, 0.8vw, 13px)', fontWeight: 500, letterSpacing: '0.02em',
          color: 'rgba(255,255,255,0.9)', textShadow: '0 0 2px rgba(0,0,0,0.9)', opacity: fade ? 0 : 0.16,
          transition: `opacity ${WM_FADE_MS}ms ease`,
        }}>{text}</span>
      ))}
    </div>
  );
}
const MSG = {
  unauthenticated: 'انتهت جلسة الدخول. سجّل الدخول من جديد ثم أعد المحاولة.',
  forbidden: 'هذه الألعاب متاحة للمشتركين فقط. جدّد اشتراكك أو تواصل مع الإدارة.',
  unavailable: 'هذه اللعبة قيد التطوير حاليًا وستتاح قريبًا.',
  'not-found': 'اللعبة غير موجودة.',
  'rate-limited': 'محاولات كثيرة، انتظر دقيقة ثم أعد المحاولة.',
  'server-not-configured': 'الخدمة غير مهيأة على الخادم بعد. أبلغ المسؤول.',
  origin: 'تعذّر التحقق من مصدر الطلب.',
  'server-error': 'حدث خطأ في الخادم أثناء تجهيز اللعبة. أعد المحاولة بعد قليل، وإن تكرر فأبلغ المسؤول.',
  'db-error': 'تعذّر الوصول إلى قاعدة بيانات الاشتراكات مؤقتًا. أعد المحاولة بعد قليل.',
  network: 'تعذّر الاتصال بالخادم. تحقّق من اتصال الإنترنت ثم أعد المحاولة.',
};

export default function LabPlayerPage() {
  const { labId } = useParams();
  const { user, isSubscribed, isAdmin, loading } = useAuth();
  const raw = getGame(labId);
  const game = raw ? publicGameInfo(raw) : null;
  const [state, setState] = useState('idle'); // idle | loading | ready | error
  const [err, setErr] = useState('');
  const [src, setSrc] = useState('');
  const [errCode, setErrCode] = useState('');
  const [isFull, setIsFull] = useState(false);
  const stageRef = useRef(null);
  const frameRef = useRef(null);

  const open = useCallback(async (silent) => {
    if (!game) return;
    if (!silent) { setState('loading'); setErr(''); }
    try {
      const cu = auth && auth.currentUser;
      if (!cu) throw Object.assign(new Error('x'), { code: 'unauthenticated' });
      const token = await cu.getIdToken();
      let res;
      try {
        res = await fetch('/api/virtual-games/session', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ gameId: game.id }),
        });
      } catch { throw Object.assign(new Error('x'), { code: 'network' }); }
      const data = await res.json().catch(() => ({}));
      // رد غير JSON (صفحة خطأ من الخادم) يُعرض برمزه بدل رسالة عامة مبهمة
      if (!res.ok || !data.ok) throw Object.assign(new Error('x'), { code: data.error || 'server-error', status: res.status });
      if (!silent) { setSrc(data.playUrl); setState('ready'); }
    } catch (e) {
      if (silent) return; // التجديد الصامت لا يقطع اللعب
      setErr(MSG[e.code] || 'تعذّر تشغيل اللعبة الآن. حاول مرة أخرى.');
      setErrCode(`${e.code || 'unknown'}${e.status ? ' · HTTP ' + e.status : ''}`);
      setState('error');
    }
  }, [game && game.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const uid = user ? user.uid : null;
  useEffect(() => {
    if (loading || !uid || !game) return;
    if (!isSubscribed && !isAdmin) { setErr(MSG.forbidden); setState('error'); return; }
    open(false);
  }, [loading, uid, isSubscribed, isAdmin, game && game.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state !== 'ready') return undefined;
    const t = setInterval(() => open(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [state, open]);

  // حالة ملء الشاشة تتبع الحدث الحقيقي (تشمل الخروج بزر Esc أو من داخل اللعبة)
  useEffect(() => {
    const on = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on); on();
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  // تنبيه الأجهزة الصغيرة (مرة عند فتح اللعبة، لا يمنع اللعب) ثم إرشاد ملء الشاشة بعد جاهزية اللعبة
  const fsRef = useRef(null);
  const [advising, setAdvising] = useState(true);
  useEffect(() => {
    if (!game) return;
    if (!deviceAdvice(GAME_DEVICES[game.id] || null, () => setAdvising(false))) setAdvising(false);
  }, [game && game.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state !== 'ready' || advising) return undefined;
    let h = null;
    const t = setTimeout(() => { h = fullscreenHint(fsRef.current, { within: '.vlp-top' }); }, 1500);
    return () => { clearTimeout(t); if (h) h.hide(false); };
  }, [state, advising]);
  const fullscreen = () => {
    const el = stageRef.current; if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  };
  const reload = () => { if (frameRef.current) frameRef.current.src = src; };

  if (!game) {
    return (
      <div className="vlp"><div className="vlp-top"><h1 className="vlp-title">اللعبة غير موجودة</h1>
        <Link className="vlp-btn" href="/dashboard/resources">العودة للموارد</Link></div></div>
    );
  }
  const cat = GAME_CATEGORIES[game.category];
  // الألعاب التي لا تظهر في شبكة الاستوديو تعود إلى قسم «عالم الألعاب الموسيقية»
  const back = game.listInLab ? { href: '/dashboard/resources#virtual-lab', label: '← استوديو الموسيقى', place: 'استوديو الموسيقى الافتراضي' }
    : { href: '/dashboard/resources', label: '← الألعاب الموسيقية', place: 'الألعاب الموسيقية' };
  const sandbox = 'allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-modals' + (game.allowDownloads ? ' allow-downloads' : '');
  const mark = '© MusiTeacher – All Rights Reserved – 2026';
  const who = user && (user.email || user.uid) ? `${user.email || user.uid}` : '';

  return (
    <div className="vlp">
      <div className="vlp-top">
        <div className="vlp-id">
          <img className="vlp-logo" src="/logo.png" alt="MusiTeacher" />
          <div style={{ minWidth: 0 }}>
            <h1 className="vlp-title">{game.title}</h1>
            <p className="vlp-meta">{back.place}{cat ? ` · ${cat.label}` : ''}{game.grade ? ` · ${game.grade}` : ''}</p>
          </div>
        </div>
        <div className="vlp-btns">
          {(isSubscribed || isAdmin) && game.status === 'available' && <ShareGameButton game={game} />}
          <button type="button" className="vlp-btn" onClick={reload} disabled={state !== 'ready'}>↻ إعادة تحميل</button>
          <button type="button" ref={fsRef} className={`vlp-btn${isFull ? ' on' : ''}`} onClick={fullscreen} disabled={state !== 'ready'}
            aria-pressed={isFull} title={isFull ? 'العودة إلى الحجم العادي (Esc)' : 'تكبير اللعبة إلى ملء الشاشة'}>
            {isFull ? '🗗 تصغير الشاشة' : '⛶ ملء الشاشة'}
          </button>
          <Link className="vlp-btn primary" href={back.href}>{back.label}</Link>
        </div>
      </div>

      <div className="vlp-stage" ref={stageRef} style={{ position: 'relative' }}>
        {state === 'ready' && (
          <>
            <iframe ref={frameRef} className="vlp-frame" src={src} title={game.title} sandbox={sandbox}
              allow="autoplay; fullscreen; pointer-lock; accelerometer; gyroscope; midi" referrerPolicy="same-origin" />
            <Watermark who={who} />
          </>
        )}
        {(state === 'loading' || state === 'idle') && (
          <div className="vlp-state"><div><div className="vlp-spin" /><h2>جارٍ تجهيز اللعبة…</h2><p>{game.threeD ? 'نتحقق من صلاحيتك ونحمّل العالم ثلاثي الأبعاد.' : 'نتحقق من صلاحيتك ونحمّل اللعبة.'}</p></div></div>
        )}
        {state === 'error' && (
          <div className="vlp-state"><div><h2>تعذّر فتح اللعبة</h2><p>{err}</p>
            {errCode && <p className="vlp-code">رمز الخطأ للمسؤول: <code dir="ltr">{errCode}</code></p>}
            <button type="button" className="vlp-btn primary" onClick={() => open(false)}>إعادة المحاولة</button></div></div>
        )}
      </div>
      <p className="vlp-hint">{game.description}</p>
      <p className="vlp-ip">{mark}</p>
    </div>
  );
}
