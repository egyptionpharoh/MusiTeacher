'use client';
// مشغّل ألعاب المختبر: يطلب جلسة من الخادم (تحقق Firebase + الاشتراك) ثم يضع اللعبة في iframe من /play/<id>/.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import { getGame, publicGameInfo, GAME_CATEGORIES } from '@/data/virtualGames';
import '@/components/virtual-lab/virtual-lab.css';

const REFRESH_MS = 20 * 60 * 1000;
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
  // الألعاب التي لا تظهر في شبكة المختبر تعود إلى قسم «عالم الألعاب الموسيقية»
  const back = game.listInLab ? { href: '/dashboard/resources#virtual-lab', label: '← المختبر', place: 'مختبر الألعاب الافتراضية' }
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
          <button type="button" className="vlp-btn" onClick={reload} disabled={state !== 'ready'}>↻ إعادة تحميل</button>
          <button type="button" className={`vlp-btn${isFull ? ' on' : ''}`} onClick={fullscreen} disabled={state !== 'ready'}
            aria-pressed={isFull} title={isFull ? 'العودة إلى الحجم العادي (Esc)' : 'تكبير اللعبة إلى ملء الشاشة'}>
            {isFull ? '🗗 تصغير الشاشة' : '⛶ ملء الشاشة'}
          </button>
          <Link className="vlp-btn primary" href={back.href}>{back.label}</Link>
        </div>
      </div>

      <div className="vlp-stage" ref={stageRef}>
        {state === 'ready' && (
          <>
            <iframe ref={frameRef} className="vlp-frame" src={src} title={game.title} sandbox={sandbox}
              allow="autoplay; fullscreen; pointer-lock; accelerometer; gyroscope" referrerPolicy="same-origin" />
            <div className="vlp-wm" aria-hidden="true"><div>
              {Array.from({ length: 80 }).map((_, i) => <span key={i}>{who ? `${who} · ` : ''}MusiTeacher</span>)}
            </div></div>
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
