'use client';
// زر «مشاركة اللعبة مع الطلاب» + نافذته: رابط النسخة الطلابية ورمز الدخول (نسخ، واتساب، معاينة، تجديد، إلغاء).
// الإعدادات الافتراضية جاهزة: فتح النافذة لأول مرة ينشئ الرمز تلقائيًا (صالح حتى نهاية اشتراك المعلم).
import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import './share.css';

const ERR = {
  forbidden: 'المشاركة مع الطلاب متاحة للمشتركين فقط.',
  unauthenticated: 'انتهت جلسة الدخول. حدّث الصفحة ثم حاول مرة أخرى.',
  'server-not-configured': 'خدمة المشاركة غير مهيأة على الخادم بعد. أبلغ المسؤول.',
  'not-found': 'هذه اللعبة غير متاحة للمشاركة حاليًا.',
  'rate-limited': 'طلبات كثيرة متتالية. انتظر دقيقة ثم حاول مرة أخرى.',
  network: 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم أعد المحاولة.',
};
const DAYS = [[0, 'حتى نهاية اشتراكك (مستحسن)'], [1, 'يوم واحد'], [7, 'أسبوع'], [30, 'شهر']];
const fmt = (d) => { try { return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return ''; } };

export async function shareApi(method, body) {
  const cu = auth && auth.currentUser;
  if (!cu) throw Object.assign(new Error('x'), { code: 'unauthenticated' });
  const token = await cu.getIdToken();
  let res;
  try {
    res = await fetch('/api/student-games/share', {
      method, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw Object.assign(new Error('x'), { code: 'network' }); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw Object.assign(new Error('x'), { code: data.error || 'server-error' });
  return data;
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* متصفحات قديمة */ }
  const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
  document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; } t.remove(); return ok;
}
export function whatsappText(title, link, code) {
  return `🎵 لعبة «${title}» — MusiTeacher Games\n1) افتح الرابط: ${link}\n2) اكتب رمز اللعبة: ${code}\nثم اضغط «ابدأ اللعب».`;
}

export default function ShareGameButton({ game, className = 'vlp-btn', linkSuffix = '' }) {
  const [open, setOpen] = useState(false);
  if (!game) return null;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} title="رابط ورمز للطلاب — بلا حسابات">
        🔗 مشاركة اللعبة مع الطلاب
      </button>
      {open && <ShareDialog game={game} linkSuffix={linkSuffix} onClose={() => setOpen(false)} />}
    </>
  );
}

// linkSuffix (اختياري): إعدادات تضيفها اللعبة إلى رابط الطلاب بعد # (مثل مسابقة المعلم في «رالي النغم»). فارغ لبقية الألعاب.
export function ShareDialog({ game, onClose, linkSuffix = '' }) {
  const [st, setSt] = useState('loading');            // loading | ready | error
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [flash, setFlash] = useState('');
  const [days, setDays] = useState(0);

  const run = useCallback(async (action, extra = {}) => {
    setBusy(action); setErr('');
    try { const d = await shareApi('POST', { gameId: game.id, action, ...extra }); setData(d); setSt('ready'); }
    catch (e) { setErr(ERR[e.code] || 'تعذّر تنفيذ الطلب الآن. حاول مرة أخرى.'); if (action === 'get') setSt('error'); }
    finally { setBusy(''); }
  }, [game.id]);

  useEffect(() => { run('get'); }, [run]);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const note = (m) => { setFlash(m); setTimeout(() => setFlash(''), 1800); };
  const share = data && data.share;
  const baseLink = (share && share.link) || (data && data.link);
  const link = baseLink && linkSuffix ? `${baseLink.split('#')[0]}#${linkSuffix}` : baseLink;
  const atEnd = share && data && data.subscriptionEnd && Math.abs(new Date(share.expiresAt) - new Date(data.subscriptionEnd)) < 864e5;

  return (
    <div className="sgx-back" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sgx" role="dialog" aria-modal="true" aria-labelledby="sgx-title" dir="rtl">
        <div className="sgx-head">
          <div><h2 id="sgx-title">مشاركة اللعبة مع الطلاب</h2><p>{game.title}</p></div>
          <button type="button" className="sgx-x" onClick={onClose} aria-label="إغلاق">✕</button>
        </div>

        {st === 'loading' && <div className="sgx-body sgx-center"><div className="sgx-spin" /><p>نجهّز الرابط والرمز…</p></div>}
        {st === 'error' && <div className="sgx-body sgx-center"><p className="sgx-err">{err}</p><button type="button" className="sgx-btn primary" onClick={() => { setSt('loading'); run('get'); }}>إعادة المحاولة</button></div>}

        {st === 'ready' && data && (
          <div className="sgx-body">
            {!data.release && <p className="sgx-warn">لم يُضبط عنوان مشروع MusiTeacher Games بعد. على المدير ضبطه من صفحة «مشاركة الألعاب مع الطلاب».</p>}
            {data.release && share && share.studentReady === false && <p className="sgx-warn">النسخة الطلابية من هذه اللعبة لم تُنشر بعد في الإصدار الحالي، لذا قد لا يفتح الرابط الآن.</p>}

            {share ? (
              <>
                <label className="sgx-lbl">رابط اللعبة للطلاب</label>
                <div className="sgx-row">
                  <input className="sgx-link" dir="ltr" readOnly value={link || ''} onFocus={(e) => e.target.select()} aria-label="رابط اللعبة" />
                  <button type="button" className="sgx-btn" disabled={!link} onClick={async () => note((await copyText(link)) ? 'نُسخ الرابط ✓' : 'تعذّر النسخ')}>نسخ الرابط</button>
                </div>
                <label className="sgx-lbl">رمز الدخول</label>
                <div className="sgx-row">
                  <output className="sgx-code" dir="ltr" aria-label="رمز الدخول">{share.code}</output>
                  <button type="button" className="sgx-btn" onClick={async () => note((await copyText(share.code)) ? 'نُسخ الرمز ✓' : 'تعذّر النسخ')}>نسخ الرمز</button>
                </div>
                <p className="sgx-meta">صالح حتى <b>{fmt(share.expiresAt)}</b>{atEnd ? ' (نهاية اشتراكك)' : ''} · لعدد غير محدود من الطلاب{share.uses ? ` · استُخدم ${share.uses} مرة` : ''}</p>
                <div className="sgx-actions">
                  <a className={`sgx-btn wa${link ? '' : ' off'}`} href={link ? `https://wa.me/?text=${encodeURIComponent(whatsappText(game.title, link, share.code))}` : undefined} target="_blank" rel="noopener noreferrer">مشاركة عبر واتساب</a>
                  <a className={`sgx-btn${link ? '' : ' off'}`} href={link || undefined} target="_blank" rel="noopener noreferrer">معاينة اللعبة</a>
                </div>
                <details className="sgx-more">
                  <summary>تجديد الرمز أو إلغاؤه</summary>
                  <div className="sgx-row wrap">
                    <label className="sgx-lbl in">مدة الرمز الجديد
                      <select value={days} onChange={(e) => setDays(Number(e.target.value))}>{DAYS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    </label>
                    <button type="button" className="sgx-btn" disabled={!!busy} onClick={() => { if (window.confirm('سيتوقف الرمز الحالي فورًا للطلاب الجدد، ويُنشأ رمز جديد. متابعة؟')) run('renew', { days }); }}>{busy === 'renew' ? '…' : 'رمز جديد'}</button>
                    <button type="button" className="sgx-btn danger" disabled={!!busy} onClick={() => { if (window.confirm('إلغاء الرمز يمنع أي طالب من الدخول به بعد الآن. متابعة؟')) run('revoke'); }}>{busy === 'revoke' ? '…' : 'إلغاء الرمز'}</button>
                  </div>
                  <p className="sgx-hint">من بدأ اللعب قبل الإلغاء يُكمل جلسته الحالية دون انقطاع مفاجئ، ثم يُطلب منه رمز جديد.</p>
                </details>
              </>
            ) : (
              <div className="sgx-center">
                <p>لا يوجد رمز نشط لهذه اللعبة.</p>
                <button type="button" className="sgx-btn primary" disabled={!!busy} onClick={() => run('create', { days })}>{busy ? '…' : 'إنشاء رابط ورمز'}</button>
              </div>
            )}
            {err && <p className="sgx-err">{err}</p>}
            <p className="sgx-foot"><a href="/dashboard/student-games">كل رموز المشاركة</a><span className="sgx-flash" role="status">{flash}</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
