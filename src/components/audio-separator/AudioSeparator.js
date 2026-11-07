'use client';
// استوديو فصل الصوت بالذكاء الاصطناعي — واجهة المعلم.
// الرفع مباشر إلى التخزين (نسبة رفع حقيقية)، ثم حالة المعالجة الحقيقية من الخادم، ثم الاستماع والتنزيل.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import './audio-separator.css';

const ACCEPT = '.mp3,.wav,.flac,.m4a,audio/mpeg,audio/wav,audio/x-wav,audio/flac,audio/mp4,audio/x-m4a';
const EXTS = ['mp3', 'wav', 'flac', 'm4a'];
const LAST_KEY = 'mt-audio-separator:last-job';
const DEFAULT_LIMITS = { maxMB: 120, maxMinutes: 10, minSeconds: 3, dailyPerUser: 10, resultTtlHours: 24 };

const MSG = {
  unauthenticated: 'انتهت جلسة الدخول. سجّل الدخول من جديد ثم أعد المحاولة.',
  forbidden: 'هذه الأداة متاحة للمشتركين فقط. جدّد اشتراكك أو تواصل مع الإدارة.',
  origin: 'تعذّر التحقق من مصدر الطلب. افتح الأداة من داخل المنصة.',
  'service-not-configured': 'خدمة الفصل غير مفعّلة على الخادم بعد. أبلغ مسؤول المنصة.',
  'server-not-configured': 'الخادم غير مهيأ بعد. أبلغ مسؤول المنصة.',
  'rate-limited': 'طلبات كثيرة خلال وقت قصير. انتظر دقيقة ثم أعد المحاولة.',
  'daily-limit': 'وصلت إلى الحد اليومي لعمليات الفصل. يمكنك المتابعة غدًا.',
  busy: 'لديك عملية فصل جارية بالفعل. نعرض لك حالتها الآن.',
  capacity: 'الخدمة مشغولة بعمليات أخرى الآن. أعد المحاولة بعد دقائق.',
  'unsupported-format': 'هذا الملف ليس ملفًا صوتيًا مدعومًا. استخدم MP3 أو WAV أو FLAC أو M4A.',
  'format-mismatch': 'محتوى الملف لا يطابق امتداده. صدّر الملف من جديد بصيغة MP3 أو WAV.',
  unreadable: 'تعذّر قراءة مدة الملف. جرّب تحويله إلى MP3 أو WAV ثم أعد الرفع.',
  'too-large': 'حجم الملف أكبر من الحد المسموح.',
  'too-long': 'مدة التسجيل أطول من الحد المسموح.',
  'too-short': 'التسجيل قصير جدًا. الحد الأدنى 3 ثوانٍ.',
  'upload-missing': 'لم يكتمل رفع الملف. أعد المحاولة.',
  'upload-mismatch': 'وصل الملف ناقصًا أو مختلفًا. أعد المحاولة.',
  'upload-failed': 'رفض التخزين استلام الملف. أعد المحاولة، وإن تكرر فأبلغ المسؤول.',
  'upload-network': 'تعذّر رفع الملف. تحقّق من اتصال الإنترنت ثم أعد المحاولة. إن تكرر مع اتصال سليم فأبلغ المسؤول (إعداد CORS للتخزين).',
  'upload-timeout': 'انتهت مهلة رفع الملف. أعد المحاولة.',
  'separation-failed': 'تعذّر على النموذج فصل هذا الملف. جرّب ملفًا آخر أو أعد المحاولة لاحقًا.',
  'unexpected-output': 'أعادت خدمة المعالجة نتيجة غير متوقعة. أبلغ المسؤول.',
  'finalize-failed': 'انتهى الفصل لكن تعذّر حفظ النتيجة. أعد المحاولة.',
  'empty-output': 'خرجت النتيجة فارغة. أعد المحاولة بملف آخر.',
  timeout: 'استغرقت المعالجة وقتًا أطول من المعتاد فأُلغيت. أعد المحاولة.',
  'provider-busy': 'خدمة المعالجة مزدحمة الآن. أعد المحاولة بعد دقائق.',
  'provider-auth': 'مفتاح خدمة المعالجة غير صالح. أبلغ مسؤول المنصة.',
  'provider-billing': 'رصيد خدمة المعالجة غير كافٍ. أبلغ مسؤول المنصة.',
  'provider-not-found': 'إصدار نموذج الفصل غير متاح. أبلغ مسؤول المنصة.',
  'provider-unreachable': 'تعذّر الوصول إلى خدمة المعالجة. أعد المحاولة بعد قليل.',
  'provider-error': 'حدث خطأ لدى خدمة المعالجة. أعد المحاولة بعد قليل.',
  'db-error': 'تعذّر الوصول إلى قاعدة البيانات مؤقتًا. أعد المحاولة بعد قليل.',
  'consent-required': 'يلزم تأكيد الإقرارين قبل البدء.',
  expired: 'انتهت صلاحية هذه النتيجة وحُذفت تلقائيًا.',
  canceled: 'أُلغيت العملية وحُذفت ملفاتها.',
  deleted: 'حُذفت ملفات هذه النتيجة.',
  'not-found': 'لم نجد هذه العملية. ربما حُذفت.',
  network: 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم أعد المحاولة.',
  'server-error': 'حدث خطأ في الخادم. أعد المحاولة بعد قليل.',
};
const msgOf = (code) => MSG[code] || MSG['server-error'];

const MODES = [
  { id: 'vocals', title: 'الصوت البشري فقط', desc: 'يعزل صوت المغني أو المغنية ويزيل المصاحبة الموسيقية.', lane: 'voice' },
  { id: 'instrumental', title: 'الموسيقى فقط', desc: 'يزيل الغناء ويُبقي الآلات، مناسب للتدريب والكاريوكي.', lane: 'music' },
];
const QUALITIES = [
  { id: 'mp3-320', format: 'mp3', bitrate: 320, title: 'MP3 320 kbps', note: 'أعلى جودة لصيغة MP3' },
  { id: 'mp3-192', format: 'mp3', bitrate: 192, title: 'MP3 192 kbps', note: 'حجم أصغر' },
  { id: 'wav', format: 'wav', bitrate: null, title: 'WAV', note: 'بلا ضغط، حجم كبير' },
];

// ------------------------------------------------------------------ أدوات صغيرة
const err = (code, extra) => Object.assign(new Error(code), { code, ...extra });
const fmtSize = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtTime = (s) => {
  if (!Number.isFinite(s) || s < 0) return '--:--';
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};
const extOf = (n) => { const m = /\.([a-z0-9]{1,5})$/i.exec(n || ''); return m ? m[1].toLowerCase() : ''; };
const rid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
const store = {
  get() { try { return window.localStorage.getItem(LAST_KEY); } catch { return null; } },
  set(v) { try { if (v) window.localStorage.setItem(LAST_KEY, v); else window.localStorage.removeItem(LAST_KEY); } catch { /* */ } },
};

async function callApi(path, { method = 'GET', body } = {}) {
  const cu = auth && auth.currentUser;
  if (!cu) throw err('unauthenticated');
  const token = await cu.getIdToken();
  let res;
  try {
    res = await fetch(path, {
      method, cache: 'no-store', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw err('network'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw err(data.error || 'server-error', { status: res.status, data });
  return data;
}

function putFile(url, file, headers, onProgress, xhrRef) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('PUT', url);
    Object.entries(headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded, e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(err('upload-failed', { status: xhr.status })));
    xhr.onerror = () => reject(err('upload-network'));
    xhr.onabort = () => reject(err('aborted'));
    xhr.send(file);
  });
}

function readDuration(file) {
  return new Promise((resolve) => {
    const a = document.createElement('audio');
    const url = URL.createObjectURL(file);
    let done = false;
    const fin = (d) => { if (done) return; done = true; a.removeAttribute('src'); URL.revokeObjectURL(url); resolve(d); };
    a.preload = 'metadata';
    a.onloadedmetadata = () => fin(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : null);
    a.onerror = () => fin(null);
    setTimeout(() => fin(null), 8000);
    a.src = url;
  });
}

// ------------------------------------------------------------------ أيقونات (SVG داخلية)
const I = {
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v2',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5',
  play: 'M7 4.5v15l12-7.5-12-7.5Z',
  pause: 'M7 4h3.5v16H7zM13.5 4H17v16h-3.5z',
  restart: 'M4 4v6h6M4.5 15a8 8 0 1 0 1.9-8.3L4 10',
  volume: 'M4 9v6h4l5 4V5L8 9H4Zm12.5-.5a5 5 0 0 1 0 7',
  mute: 'M4 9v6h4l5 4V5L8 9H4Zm12 0 5 6m0-6-5 6',
  download: 'M12 4v12m0 0 5-5m-5 5-5-5M4 20h16',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13',
  check: 'M5 12.5 10 17l9-10',
  alert: 'M12 8v5m0 3.5v.5M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  x: 'M6 6l12 12M18 6 6 18',
  back: 'M9 6l6 6-6 6',
  shield: 'M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6l-7-3Z',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  swap: 'M7 7h11l-3-3m3 13H7l3 3',
};
const Icon = ({ d, size = 20, className = '' }) => (
  <svg className={`as-ico ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

// ------------------------------------------------------------------ موجة الفصل (العنصر المميِّز)
// موجة واحدة تنقسم إلى مسارين: الصوت البشري والموسيقى. المسار المختار يضيء.
function useBars(n, seed) {
  return useMemo(() => {
    let s = seed;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    return Array.from({ length: n }, (_, i) => {
      const env = 0.35 + 0.65 * Math.sin((i / n) * Math.PI) ** 0.6;
      return Math.max(0.12, Math.min(1, env * (0.45 + rnd() * 0.75)));
    });
  }, [n, seed]);
}

function SplitWave({ mode, progress = null, active = false }) {
  const mix = useBars(36, 7), voice = useBars(44, 31), music = useBars(44, 113);
  const lit = (lane) => !mode || (mode === 'vocals' ? lane === 'voice' : lane === 'music');
  const lane = (bars, key, y0) => {
    const filled = progress === null ? 1 : progress / 100;
    return (
      <g className={`as-lane as-lane-${key} ${lit(key) ? 'is-lit' : 'is-dim'}`}>
        {bars.map((h, i) => {
          const x = 300 + i * 6.8, hh = h * 30;
          const on = i / bars.length <= filled;
          return <rect key={i} x={x} y={y0 - hh / 2} width="3.6" height={hh} rx="1.8" className={on ? 'on' : 'off'} />;
        })}
      </g>
    );
  };
  return (
    <svg className={`as-wave ${active ? 'is-active' : ''}`} viewBox="0 0 610 150" role="img"
      aria-label={mode === 'vocals' ? 'فصل الصوت البشري عن الموسيقى' : mode === 'instrumental' ? 'فصل الموسيقى عن الصوت البشري' : 'موجة صوتية تنقسم إلى صوت بشري وموسيقى'}>
      <g className="as-mix">
        {mix.map((h, i) => { const hh = h * 64; return <rect key={i} x={8 + i * 6.8} y={75 - hh / 2} width="3.6" height={hh} rx="1.8" />; })}
      </g>
      <path className={`as-fork as-fork-voice ${lit('voice') ? 'is-lit' : 'is-dim'}`} d="M252 75 C 275 75, 275 40, 298 40" />
      <path className={`as-fork as-fork-music ${lit('music') ? 'is-lit' : 'is-dim'}`} d="M252 75 C 275 75, 275 110, 298 110" />
      {lane(voice, 'voice', 40)}
      {lane(music, 'music', 110)}
    </svg>
  );
}

// ------------------------------------------------------------------ المشغّل
function Player({ src, originalSrc, onSrcError, label }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(NaN);
  const [vol, setVol] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [which, setWhich] = useState('result'); // result | original
  const current = which === 'original' && originalSrc ? originalSrc : src;

  useEffect(() => { const a = ref.current; if (a) { a.volume = vol; a.muted = muted; } }, [vol, muted]);

  const toggle = () => { const a = ref.current; if (!a) return; if (a.paused) a.play().catch(() => {}); else a.pause(); };
  const seek = (v) => { const a = ref.current; if (a && Number.isFinite(a.duration)) { a.currentTime = v; setT(v); } };
  const restart = () => { const a = ref.current; if (!a) return; a.currentTime = 0; a.play().catch(() => {}); };
  const switchTo = (w) => {
    if (w === which) return;
    const a = ref.current; const pos = a ? a.currentTime : 0; const was = a && !a.paused;
    setWhich(w);
    // الفصل يحافظ على التوقيت، فنكمل من النقطة نفسها للمقارنة المباشرة
    requestAnimationFrame(() => { const b = ref.current; if (!b) return; const go = () => { b.currentTime = Math.min(pos, b.duration || pos); if (was) b.play().catch(() => {}); b.removeEventListener('loadedmetadata', go); }; b.addEventListener('loadedmetadata', go); });
  };
  const pct = Number.isFinite(dur) && dur > 0 ? (t / dur) * 100 : 0;

  return (
    <div className="as-player">
      <audio ref={ref} src={current} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onDurationChange={(e) => setDur(e.currentTarget.duration)} onError={() => { if (which === 'result' && onSrcError) onSrcError(); }} />
      {originalSrc && (
        <div className="as-ab" role="group" aria-label="اختيار ما تستمع إليه">
          <button type="button" className={which === 'result' ? 'is-on' : ''} aria-pressed={which === 'result'} onClick={() => switchTo('result')}>{label}</button>
          <button type="button" className={which === 'original' ? 'is-on' : ''} aria-pressed={which === 'original'} onClick={() => switchTo('original')}>التسجيل الأصلي</button>
        </div>
      )}
      <div className="as-transport" dir="ltr">
        <button type="button" className="as-playbtn" onClick={toggle} aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}>
          <Icon d={playing ? I.pause : I.play} size={22} />
        </button>
        <span className="as-time">{fmtTime(t)}</span>
        <input type="range" className="as-seek" min="0" max={Number.isFinite(dur) ? dur : 0} step="0.1" value={Math.min(t, Number.isFinite(dur) ? dur : 0)}
          onChange={(e) => seek(parseFloat(e.target.value))} aria-label="التنقل داخل التسجيل" style={{ '--p': `${pct}%` }} />
        <span className="as-time">{fmtTime(dur)}</span>
      </div>
      <div className="as-subcontrols">
        <button type="button" className="as-ghost" onClick={restart}><Icon d={I.restart} size={18} />إعادة الاستماع من البداية</button>
        <div className="as-vol" dir="ltr">
          <button type="button" className="as-iconbtn" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'إلغاء الكتم' : 'كتم الصوت'}>
            <Icon d={muted || vol === 0 ? I.mute : I.volume} size={18} />
          </button>
          <input type="range" min="0" max="1" step="0.01" value={muted ? 0 : vol} aria-label="مستوى الصوت"
            onChange={(e) => { setVol(parseFloat(e.target.value)); setMuted(false); }} style={{ '--p': `${(muted ? 0 : vol) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ مراحل المعالجة
const STAGES = [
  { key: 'upload', label: 'رفع الملف إلى التخزين الآمن' },
  { key: 'verify', label: 'التحقق من نوع الملف ومدته' },
  { key: 'starting', label: 'تجهيز خادم المعالجة' },
  { key: 'separating', label: 'فصل الصوت بالذكاء الاصطناعي' },
  { key: 'finalizing', label: 'تجهيز ملف النتيجة' },
];
const stageIndex = (local, job) => {
  if (local === 'uploading') return 0;
  if (local === 'verifying') return 1;
  return { starting: 2, separating: 3, finalizing: 4, ready: 5 }[job && job.stage] ?? 2;
};

// ======================================================================================
export default function AudioSeparator() {
  const { user } = useAuth();
  const [info, setInfo] = useState(null);          // حدود الخادم وحالة التهيئة
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState(null);          // { name, size, ext, duration, kbps }
  const [fileErr, setFileErr] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [mode, setMode] = useState(null);
  const [quality, setQuality] = useState('mp3-320');
  const [rights, setRights] = useState(false);
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState('setup');     // setup | uploading | verifying | processing | ready | error
  const [job, setJob] = useState(null);
  const [up, setUp] = useState({ loaded: 0, total: 0 });
  const [error, setError] = useState(null);       // { code, message }
  const [netWarn, setNetWarn] = useState(false);
  const [notice, setNotice] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [dragging, setDragging] = useState(false);
  const xhrRef = useRef(null);
  const reqRef = useRef(null);
  const inputRef = useRef(null);
  const busyRef = useRef(false);

  const limits = (info && info.limits) || DEFAULT_LIMITS;
  const q = QUALITIES.find((x) => x.id === quality) || QUALITIES[0];

  // ---------- حدود الخادم + استئناف عملية جارية بعد تحديث الصفحة
  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    (async () => {
      try {
        const d = await callApi('/api/audio-separator/limits');
        if (!alive) return;
        setInfo(d);
        const resumeId = d.activeJobId || store.get();
        if (resumeId) {
          try {
            const r = await callApi(`/api/audio-separator/jobs/${resumeId}`);
            if (!alive) return;
            adopt(r.job, true);
          } catch { store.set(null); }
        }
      } catch (e) {
        if (alive) setInfo({ configured: null, loadError: e.code });
      }
    })();
    return () => { alive = false; };
  }, [user && user.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // يستقبل مهمة من الخادم ويضبط الواجهة على حالتها
  const adopt = useCallback((j, resumed = false) => {
    setJob(j);
    if (['queued', 'processing', 'finalizing'].includes(j.status)) {
      setPhase('processing'); store.set(j.id);
      setStartedAt((s) => s || (j.startedAt ? new Date(j.startedAt).getTime() : Date.now()));
      if (resumed) setNotice('تابعنا عملية الفصل التي بدأتها سابقًا.');
    } else if (j.status === 'ready') {
      setPhase('ready'); store.set(j.id);
      if (resumed) setNotice('هذه آخر نتيجة لك، وما زالت متاحة للتنزيل.');
    } else if (j.status === 'awaiting-upload') {
      store.set(null); // رفع لم يكتمل في جلسة سابقة: لا يمكن استئنافه بلا الملف
    } else if (!resumed) {
      store.set(null);
      setError({ code: j.error || j.status, message: msgOf(j.error || j.status) }); setPhase('error');
    } else store.set(null);
  }, []);

  // ---------- متابعة الحالة الحقيقية
  useEffect(() => {
    if (phase !== 'processing' || !job || !job.id) return undefined;
    let alive = true, timer = null, delay = 2500;
    const tick = async () => {
      try {
        const r = await callApi(`/api/audio-separator/jobs/${job.id}`);
        if (!alive) return;
        setNetWarn(false); delay = 2500;
        const j = r.job;
        setJob(j);
        if (j.status === 'ready') { setPhase('ready'); return; }
        if (!['queued', 'processing', 'finalizing'].includes(j.status)) {
          store.set(null); setError({ code: j.error || j.status, message: msgOf(j.error || j.status) }); setPhase('error'); return;
        }
      } catch (e) {
        if (!alive) return;
        if (e.code === 'network' || e.code === 'server-error' || e.code === 'rate-limited' || e.code === 'db-error') {
          setNetWarn(true); delay = Math.min(15000, delay * 2);
        } else { setError({ code: e.code, message: msgOf(e.code) }); setPhase('error'); return; }
      }
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 1200);
    return () => { alive = false; clearTimeout(timer); };
  }, [phase, job && job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!['uploading', 'verifying', 'processing'].includes(phase)) return undefined;
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // تحذير قبل مغادرة الصفحة أثناء الرفع فقط (المعالجة تُستأنف تلقائيًا)
  useEffect(() => {
    if (phase !== 'uploading') return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [phase]);

  useEffect(() => () => { if (originalUrl) URL.revokeObjectURL(originalUrl); }, [originalUrl]);

  // ---------- اختيار الملف والتحقق منه قبل أي رفع
  const pick = async (f) => {
    setFileErr(''); setNotice('');
    if (!f) return;
    const ext = extOf(f.name);
    if (!EXTS.includes(ext)) { setFileErr(`الصيغة «${ext || 'غير معروفة'}» غير مدعومة. استخدم MP3 أو WAV أو FLAC أو M4A.`); return; }
    if (f.size <= 0) { setFileErr('الملف فارغ.'); return; }
    if (f.size > limits.maxMB * 1024 * 1024) { setFileErr(`حجم الملف ${fmtSize(f.size)}، والحد الأقصى ${limits.maxMB} MB.`); return; }
    const duration = await readDuration(f);
    if (duration && duration > limits.maxMinutes * 60 + 1) { setFileErr(`مدة التسجيل ${fmtTime(duration)}، والحد الأقصى ${limits.maxMinutes} دقائق.`); return; }
    if (duration && duration < limits.minSeconds) { setFileErr('التسجيل قصير جدًا. الحد الأدنى 3 ثوانٍ.'); return; }
    const kbps = ext === 'mp3' && duration ? Math.round((f.size * 8) / duration / 1000) : null;
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    setFile(f); setMeta({ name: f.name, size: f.size, ext, duration, kbps });
    setOriginalUrl(URL.createObjectURL(f));
    reqRef.current = null;
  };
  const clearFile = () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    setFile(null); setMeta(null); setOriginalUrl(''); setFileErr(''); reqRef.current = null;
    if (inputRef.current) inputRef.current.value = '';
  };

  const configured = info ? info.configured !== false : true;
  const missing = [];
  if (!file) missing.push('اختر ملفًا صوتيًا');
  if (!mode) missing.push('حدّد النتيجة المطلوبة');
  if (!rights || !consent) missing.push('أكّد الإقرارين');
  const canStart = configured && missing.length === 0 && phase === 'setup';

  // ---------- التنفيذ: إنشاء → رفع حقيقي → فحص وبدء → متابعة
  const start = async () => {
    if (!canStart || busyRef.current) return;
    busyRef.current = true;
    setError(null); setNotice(''); setNetWarn(false);
    setPhase('uploading'); setUp({ loaded: 0, total: file.size }); setStartedAt(Date.now());
    if (!reqRef.current) reqRef.current = rid();
    try {
      let created;
      try {
        created = await callApi('/api/audio-separator/jobs', {
          method: 'POST',
          body: { fileName: file.name, size: file.size, type: file.type || '', duration: meta.duration || null, mode, format: q.format, bitrate: q.bitrate || undefined, requestId: reqRef.current, consent: true },
        });
      } catch (e) {
        if (e.code === 'busy' && e.data && e.data.activeJobId) {
          const r = await callApi(`/api/audio-separator/jobs/${e.data.activeJobId}`);
          setNotice(MSG.busy); adopt(r.job); return;
        }
        throw e;
      }
      setJob(created.job);
      if (created.job.status === 'awaiting-upload') {
        await putFile(created.upload.url, file, created.upload.headers, (l, t) => setUp({ loaded: l, total: t }), xhrRef);
        setPhase('verifying');
        const s = await callApi(`/api/audio-separator/jobs/${created.job.id}`, { method: 'POST', body: { action: 'start' } });
        reqRef.current = null;
        adopt(s.job);
      } else { reqRef.current = null; adopt(created.job); }
    } catch (e) {
      if (e.code === 'aborted') { setPhase('setup'); return; }
      const extra = e.code === 'daily-limit' && e.data && e.data.limit ? ` (${e.data.limit} عمليات في اليوم)` : '';
      setError({ code: e.code, message: msgOf(e.code) + extra });
      setPhase('error');
      if (!['upload-network', 'upload-failed', 'network'].includes(e.code)) reqRef.current = null;
    } finally { busyRef.current = false; }
  };

  const cancel = async () => {
    if (phase === 'uploading' && xhrRef.current) { xhrRef.current.abort(); }
    const id = job && job.id;
    setPhase('setup'); setJob(null); store.set(null); reqRef.current = null;
    if (id) { try { await callApi(`/api/audio-separator/jobs/${id}`, { method: 'DELETE' }); } catch { /* الخادم ينظّف المهام العالقة تلقائيًا */ } }
    setNotice('أُلغيت العملية وحُذف الملف المرفوع.');
  };

  const removeResult = async () => {
    if (!job) return;
    try { await callApi(`/api/audio-separator/jobs/${job.id}`, { method: 'DELETE' }); setNotice('حُذفت ملفات النتيجة من الخادم.'); }
    catch (e) { setNotice(msgOf(e.code)); return; }
    store.set(null); setJob(null); setPhase('setup');
  };

  const another = () => { store.set(null); setJob(null); setError(null); setPhase('setup'); setNotice(''); clearFile(); };
  const retry = () => { setError(null); setPhase('setup'); };

  const refreshLinks = async () => {
    if (!job) return;
    try { const r = await callApi(`/api/audio-separator/jobs/${job.id}`); setJob(r.job); if (r.job.status !== 'ready') adopt(r.job); } catch { /* */ }
  };

  const shownMode = (job && job.mode) || mode;
  const modeInfo = MODES.find((m) => m.id === shownMode);
  const idx = stageIndex(phase, job);
  const elapsed = startedAt ? Math.max(0, Math.round((nowTs - startedAt) / 1000)) : 0;
  const upPct = up.total ? Math.round((up.loaded / up.total) * 100) : 0;
  const waveProgress = phase === 'uploading' ? upPct * 0.15
    : phase === 'processing' && job && job.stage === 'separating' && typeof job.progress === 'number' ? 15 + job.progress * 0.8
      : phase === 'processing' && job && job.stage === 'finalizing' ? 97 : phase === 'ready' ? 100 : null;
  const lowSource = meta && meta.kbps && q.format === 'mp3' && q.bitrate >= 256 && meta.kbps < q.bitrate - 40;

  return (
    <div className="as-root" dir="rtl">
      <div className="as-shell">
        <Link href="/dashboard/tools" className="as-back"><Icon d={I.back} size={18} />أدوات المعلم</Link>

        <header className="as-head">
          <h1>استوديو فصل الصوت بالذكاء الاصطناعي <span aria-hidden="true">🎧</span></h1>
          <p>افصل الغناء عن الموسيقى، أو استخرج الصوت البشري وحده، وحمّل النتيجة بجودة عالية.</p>
        </header>

        <div className="as-stage" aria-hidden={phase === 'setup' ? undefined : 'true'}>
          <SplitWave mode={shownMode} progress={phase === 'setup' || phase === 'error' ? null : waveProgress} active={['uploading', 'verifying', 'processing'].includes(phase)} />
          <div className="as-stage-legend">
            <span className={`as-key as-key-voice ${!shownMode || shownMode === 'vocals' ? 'is-lit' : ''}`}><Icon d={I.mic} size={16} />الصوت البشري</span>
            <span className={`as-key as-key-music ${!shownMode || shownMode === 'instrumental' ? 'is-lit' : ''}`}><Icon d={I.music} size={16} />الموسيقى</span>
          </div>
        </div>

        {info && info.configured === false && (
          <div className="as-banner as-banner-warn" role="status">
            <Icon d={I.alert} />
            <div><strong>الأداة غير مفعّلة بعد.</strong> لم يُربط الخادم بخدمة المعالجة السحابية حتى الآن، لذلك لن تبدأ أي عملية فصل. أبلغ مسؤول المنصة.</div>
          </div>
        )}
        {notice && <div className="as-banner" role="status"><Icon d={I.check} /><div>{notice}</div><button type="button" className="as-iconbtn" onClick={() => setNotice('')} aria-label="إغلاق"><Icon d={I.x} size={16} /></button></div>}

        <div className="as-grid">
          <main className="as-panel">
            {/* ====================== الإعداد ====================== */}
            {phase === 'setup' && (
              <>
                <section className="as-step">
                  <h2><span className="as-num">1</span>الملف الصوتي</h2>
                  {!file ? (
                    <label className={`as-drop ${dragging ? 'is-drag' : ''}`}
                      onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files && e.dataTransfer.files[0]); }}>
                      <input ref={inputRef} type="file" accept={ACCEPT} className="as-sr" onChange={(e) => pick(e.target.files && e.target.files[0])} />
                      <Icon d={I.upload} size={30} />
                      <span className="as-drop-title">اختر أغنية من جهازك أو اسحبها إلى هنا</span>
                      <span className="as-drop-hint">MP3 أو WAV أو FLAC أو M4A، حتى <bdi dir="ltr">{limits.maxMB} MB</bdi> و{limits.maxMinutes} دقائق</span>
                    </label>
                  ) : (
                    <div className="as-file">
                      <div className="as-file-ico"><Icon d={I.file} size={22} /></div>
                      <div className="as-file-main">
                        <div className="as-file-name" dir="auto">{meta.name}</div>
                        <div className="as-file-meta">
                          <span>{meta.ext.toUpperCase()}</span><span dir="ltr">{fmtSize(meta.size)}</span>
                          {meta.duration ? <span dir="ltr">{fmtTime(meta.duration)}</span> : <span>المدة تُحسب على الخادم</span>}
                          {meta.kbps ? <span dir="ltr">≈ {meta.kbps} kbps</span> : null}
                        </div>
                      </div>
                      <div className="as-file-actions">
                        <label className="as-ghost">
                          <input type="file" accept={ACCEPT} className="as-sr" onChange={(e) => pick(e.target.files && e.target.files[0])} />استبدال
                        </label>
                        <button type="button" className="as-iconbtn" onClick={clearFile} aria-label="إزالة الملف"><Icon d={I.trash} size={18} /></button>
                      </div>
                    </div>
                  )}
                  {fileErr && <p className="as-inline-err" role="alert"><Icon d={I.alert} size={16} />{fileErr}</p>}
                </section>

                <section className="as-step">
                  <h2 id="as-mode-h"><span className="as-num">2</span>ماذا تريد أن تستخرج؟</h2>
                  <div className="as-modes" role="radiogroup" aria-labelledby="as-mode-h">
                    {MODES.map((m) => (
                      <button key={m.id} type="button" role="radio" aria-checked={mode === m.id}
                        className={`as-mode as-mode-${m.lane} ${mode === m.id ? 'is-on' : ''}`} onClick={() => setMode(m.id)}>
                        <span className="as-mode-ico"><Icon d={m.lane === 'voice' ? I.mic : I.music} size={24} /></span>
                        <span className="as-mode-text"><strong>{m.title}</strong><span>{m.desc}</span></span>
                        <span className="as-radio" aria-hidden="true">{mode === m.id && <Icon d={I.check} size={14} />}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="as-step">
                  <h2 id="as-q-h"><span className="as-num">3</span>جودة الملف الناتج</h2>
                  <div className="as-quality" role="radiogroup" aria-labelledby="as-q-h">
                    {QUALITIES.map((x) => (
                      <button key={x.id} type="button" role="radio" aria-checked={quality === x.id} className={quality === x.id ? 'is-on' : ''} onClick={() => setQuality(x.id)}>
                        <strong dir="ltr">{x.title}</strong><span>{x.note}</span>
                      </button>
                    ))}
                  </div>
                  {lowSource ? (
                    <p className="as-note">ملفك الأصلي بمعدل <bdi dir="ltr">{meta.kbps} kbps</bdi> تقريبًا. التصدير بمعدل أعلى يحافظ على كل ما في النتيجة، لكنه لا يعيد تفاصيل غير موجودة في التسجيل الأصلي.</p>
                  ) : (
                    <p className="as-note">المعدل الأعلى يحافظ على جودة النتيجة قدر الإمكان، لكنه لا يضيف تفاصيل غير موجودة في التسجيل الأصلي.</p>
                  )}
                </section>

                <section className="as-step">
                  <h2><span className="as-num">4</span>قبل البدء</h2>
                  <label className="as-check">
                    <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />
                    <span>أقرّ بأنني أملك حق معالجة هذا التسجيل: تسجيلي الخاص، أو مرخّص لي، أو مسموح لي باستخدامه في التعليم.</span>
                  </label>
                  <label className="as-check">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span>أوافق على إرسال الملف إلى خدمة المعالجة السحابية Replicate لفصله. يُحذف الملف الأصلي من خوادمنا فور انتهاء المعالجة، وتُحذف النتيجة تلقائيًا بعد {limits.resultTtlHours} ساعة.</span>
                  </label>
                </section>

                <div className="as-cta">
                  <button type="button" className="as-primary" onClick={start} disabled={!canStart}>
                    {mode === 'vocals' ? <Icon d={I.mic} /> : <Icon d={I.music} />}
                    {mode === 'vocals' ? 'ابدأ استخراج الصوت البشري' : mode === 'instrumental' ? 'ابدأ استخراج الموسيقى' : 'ابدأ الفصل'}
                  </button>
                  {missing.length > 0 && configured && <span className="as-cta-hint">لإكمال الطلب: {missing.join('، ')}.</span>}
                </div>
              </>
            )}

            {/* ====================== المعالجة ====================== */}
            {['uploading', 'verifying', 'processing'].includes(phase) && (
              <section className="as-progress" aria-live="polite">
                <div className="as-progress-head">
                  <div>
                    <h2>{modeInfo ? `جارٍ استخراج ${modeInfo.title.replace(' فقط', '')}` : 'جارٍ الفصل'}</h2>
                    <p className="as-muted" dir="auto">{(job && job.fileName) || (meta && meta.name)}</p>
                  </div>
                  <div className="as-elapsed"><Icon d={I.clock} size={16} /><span dir="ltr">{fmtTime(elapsed)}</span></div>
                </div>
                <ol className="as-stages">
                  {STAGES.map((s, i) => {
                    const state = i < idx ? 'done' : i === idx ? 'now' : 'todo';
                    let detail = null;
                    if (state === 'now' && s.key === 'upload') detail = <span dir="ltr">{upPct}% · {fmtSize(up.loaded)} / {fmtSize(up.total)}</span>;
                    if (state === 'now' && s.key === 'starting') detail = 'قد يستغرق تشغيل الخادم دقيقة أو أكثر في أول استخدام.';
                    if (state === 'now' && s.key === 'separating') detail = typeof job?.progress === 'number' ? <span dir="ltr">{job.progress}%</span> : 'النموذج يعمل الآن على التسجيل.';
                    return (
                      <li key={s.key} className={`is-${state}`}>
                        <span className="as-dot" aria-hidden="true">{state === 'done' ? <Icon d={I.check} size={14} /> : state === 'now' ? <span className="as-spin" /> : null}</span>
                        <span className="as-stage-label">{s.label}</span>
                        {detail && <span className="as-stage-detail">{detail}</span>}
                        {state === 'now' && s.key === 'upload' && <span className="as-bar"><span style={{ width: `${upPct}%` }} /></span>}
                        {state === 'now' && s.key === 'separating' && typeof job?.progress === 'number' && <span className="as-bar"><span style={{ width: `${job.progress}%` }} /></span>}
                      </li>
                    );
                  })}
                </ol>
                {netWarn && <p className="as-inline-err"><Icon d={I.alert} size={16} />انقطع الاتصال بالخادم. نعيد المحاولة تلقائيًا، والمعالجة مستمرة على الخادم.</p>}
                <p className="as-muted">{phase === 'uploading' ? 'أبقِ الصفحة مفتوحة حتى يكتمل الرفع.' : 'يمكنك إغلاق الصفحة والعودة لاحقًا؛ ستجد العملية في مكانها.'}</p>
                <button type="button" className="as-ghost as-danger" onClick={cancel}><Icon d={I.x} size={18} />إلغاء العملية</button>
              </section>
            )}

            {/* ====================== النتيجة ====================== */}
            {phase === 'ready' && job && (
              <section className="as-result">
                <div className="as-result-head">
                  <span className={`as-badge as-badge-${job.mode === 'vocals' ? 'voice' : 'music'}`}><Icon d={job.mode === 'vocals' ? I.mic : I.music} size={22} /></span>
                  <div>
                    <h2>اكتمل الفصل</h2>
                    <p className="as-muted" dir="auto">{job.outputFileName}</p>
                  </div>
                </div>
                {job.playUrl ? (
                  <Player src={job.playUrl} originalSrc={originalUrl || null} onSrcError={refreshLinks}
                    label={job.mode === 'vocals' ? 'الصوت البشري' : 'الموسيقى'} />
                ) : <p className="as-inline-err">رابط الاستماع غير متاح الآن. <button type="button" className="as-link" onClick={refreshLinks}>تحديث</button></p>}
                <div className="as-downloads">
                  {job.downloadUrl && (
                    <a className="as-primary" href={job.downloadUrl} download={job.outputFileName} rel="noopener">
                      <Icon d={I.download} />تنزيل {job.format === 'wav' ? 'WAV' : `MP3 (${job.bitrate} kbps)`}
                    </a>
                  )}
                  <button type="button" className="as-ghost" onClick={another}><Icon d={I.swap} size={18} />فصل ملف آخر</button>
                  <button type="button" className="as-ghost as-danger" onClick={removeResult}><Icon d={I.trash} size={18} />حذف النتيجة الآن</button>
                </div>
                <dl className="as-facts">
                  {job.outputSize ? <div><dt>الحجم</dt><dd dir="ltr">{fmtSize(job.outputSize)}</dd></div> : null}
                  {job.duration ? <div><dt>المدة</dt><dd dir="ltr">{fmtTime(job.duration)}</dd></div> : null}
                  {job.expiresAt ? <div><dt>متاح حتى</dt><dd>{new Date(job.expiresAt).toLocaleString('ar-OM-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div> : null}
                  {job.model ? <div><dt>النموذج</dt><dd dir="ltr">{job.model}</dd></div> : null}
                </dl>
                <p className="as-note">تختلف دقة الفصل باختلاف التسجيل؛ قد تسمع بقايا خفيفة من الصوت الآخر في بعض المقاطع، خاصة في التسجيلات المزدحمة أو القديمة.</p>
              </section>
            )}

            {/* ====================== الخطأ ====================== */}
            {phase === 'error' && error && (
              <section className="as-error" role="alert">
                <span className="as-badge as-badge-err"><Icon d={I.alert} size={22} /></span>
                <h2>لم تكتمل العملية</h2>
                <p>{error.message}</p>
                <p className="as-code" dir="ltr">{error.code}</p>
                <div className="as-downloads">
                  {file && <button type="button" className="as-primary" onClick={retry}><Icon d={I.restart} />العودة إلى الإعداد</button>}
                  <button type="button" className="as-ghost" onClick={another}><Icon d={I.upload} size={18} />اختيار ملف آخر</button>
                </div>
              </section>
            )}
          </main>

          <aside className="as-aside">
            <h3>كيف تعمل الأداة؟</h3>
            <p>يحلل نموذج ذكاء اصطناعي متخصص في فصل المصادر الصوتية التسجيلَ، فيفصل الصوت البشري عن الآلات. هذا فصل حقيقي وليس مرشّحًا صوتيًا.</p>
            <h3>الحدود</h3>
            <ul>
              <li>حتى <bdi dir="ltr">{limits.maxMB} MB</bdi> و{limits.maxMinutes} دقائق للملف</li>
              <li>عملية واحدة في الوقت نفسه</li>
              <li>{info && info.usage && info.usage.dailyLimit ? `استخدمت ${info.usage.usedToday} من ${info.usage.dailyLimit} عمليات خلال آخر 24 ساعة` : `حتى ${limits.dailyPerUser} عمليات يوميًا`}</li>
            </ul>
            <h3><Icon d={I.shield} size={16} />خصوصية ملفاتك</h3>
            <p>النتيجة تخصك وحدك ولا تُفتح إلا بروابط مؤقتة. يُحذف الملف الأصلي من خوادمنا بعد المعالجة، وتُحذف النتيجة بعد {limits.resultTtlHours} ساعة أو فور ضغطك «حذف النتيجة الآن». ملفك على جهازك لا يتغير.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
