'use client';
// «صندوق الاقتراحات السرية» — واجهة الإرسال للمعلمين.
// لا تطلب أي بيانات شخصية، ولا ترسل توكن الدخول ولا الكوكيز مع الرسالة (credentials: 'omit')،
// ولا تحفظ نص الرسالة على الجهاز.
import { useCallback, useEffect, useRef, useState } from 'react';
import HomeLogoLink from '@/components/HomeLogoLink';
import { CATEGORIES } from '@/lib/suggestions/categories';
import './suggestions.css';

const MAX = 4000;
const API = '/api/suggestions';

function Ico({ d, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={d} /></svg>;
}
const I = {
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  send: 'M4 12l16-8-6 16-2-7zM12 13l8-9',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  back: 'M5 12h14M13 6l6 6-6 6',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
  heart: 'M12 20s-7-4.4-9.2-8.6C1.2 8.3 3.1 5 6.4 5c2 0 3.4 1.2 4.1 2.4h3C14.2 6.2 15.6 5 17.6 5c3.3 0 5.2 3.3 3.6 6.4C19 15.6 12 20 12 20z',
};

async function getToken() {
  const r = await fetch(API, { method: 'GET', credentials: 'omit', cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw new Error(j.error || 'تعذّر تجهيز النموذج. تحقّق من الاتصال ثم حدّث الصفحة.');
  return j.token;
}

export default function SuggestionBox() {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [hp, setHp] = useState('');           // حقل فخ للبرامج الآلية — مخفي عن البشر
  const [state, setState] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState('');
  const tokenRef = useRef(null);
  const areaRef = useRef(null);
  const doneRef = useRef(null);
  const sendingRef = useRef(false);  // قفل فوري ضد النقر المتكرر (قبل أن تتحدّث الواجهة)

  const prepare = useCallback(async () => {
    try { tokenRef.current = await getToken(); } catch (e) { tokenRef.current = null; setError(e.message); }
  }, []);
  useEffect(() => { prepare(); }, [prepare]);
  useEffect(() => { if (state === 'sent' && doneRef.current) doneRef.current.focus(); }, [state]);

  const count = [...text].length;
  const tooLong = count > MAX;
  const canSend = state !== 'sending' && text.trim().length >= 5 && !tooLong;

  const submit = async (e) => {
    e.preventDefault();
    if (sendingRef.current) return;
    if (!canSend) { if (text.trim().length < 5) setError('اكتب رسالتك أولًا (بضع كلمات على الأقل).'); return; }
    sendingRef.current = true;
    setState('sending'); setError('');
    try {
      if (!tokenRef.current) await prepare();
      const r = await fetch(API, {
        method: 'POST', credentials: 'omit', cache: 'no-store',
        headers: { 'content-type': 'application/json' },                 // لا توكن دخول ولا أي هوية
        body: JSON.stringify({ body: text, category: category || 'other', token: tokenRef.current, website: hp }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setState('sent'); setText(''); setCategory(''); tokenRef.current = null; return; }
      setState('idle');
      if (j.code === 'expired-form' || j.code === 'resubmit') { await prepare(); setError('انتهت صلاحية النموذج فجدّدناه لك. اضغط «أرسل رسالتي» مرة أخرى — رسالتك ما زالت مكتوبة.'); return; }
      setError(j.error || 'تعذّر إرسال الرسالة الآن. حاول بعد قليل.');
      if (j.code !== 'too-fast') prepare();  // الخادم ربما استهلك رمز النموذج (مثل رسالة مكررة) — نجهّز رمزًا جديدًا للمحاولة التالية
    } catch {
      setState('idle');
      setError('تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم أعد المحاولة — رسالتك ما زالت مكتوبة.');
    } finally { sendingRef.current = false; }
  };

  const again = async () => { setState('idle'); setError(''); await prepare(); setTimeout(() => areaRef.current && areaRef.current.focus(), 50); };

  return (
    <div className="sg-app" dir="rtl">
      <div className="sg-glow sg-glow--a" aria-hidden="true" /><div className="sg-glow sg-glow--b" aria-hidden="true" />
      <header className="sg-top">
        <HomeLogoLink className="sg-brand"><img src="/logo.png" alt="" width={44} height={44} /><span>MusiTeacher</span></HomeLogoLink>
        <HomeLogoLink className="sg-backlink" label="العودة إلى الصفحة الرئيسية"><Ico d={I.back} size={17} /> الرئيسية</HomeLogoLink>
      </header>

      <main className="sg-main">
        <section className="sg-hero">
          <span className="sg-hero__badge"><Ico d={I.lock} size={16} /> صندوق الاقتراحات السرية</span>
          <h1>مساحتك للتعبير بحرية</h1>
          <p>رأيك يهمنا، وملاحظاتك تساعدنا على تطوير MusiTeacher.</p>
          <p>اكتب ما تريد قوله بصراحة، سواء كان اقتراحًا أو ملاحظة أو مشكلة أو حتى انتقادًا. نحن هنا لنستمع إليك.</p>
          <p className="sg-hero__strong">لا تحتاج إلى كتابة اسمك أو بريدك الإلكتروني لإرسال رسالتك.</p>
        </section>

        {state === 'sent' ? (
          <section className="sg-card sg-done" role="status" aria-live="polite">
            <span className="sg-done__icon"><Ico d={I.check} size={40} /></span>
            <h2 tabIndex={-1} ref={doneRef}>وصلتنا رسالتك بنجاح</h2>
            <p>شكرًا لمشاركتك رأيك معنا. نقدّر صراحتك، ونسعى دائمًا إلى تطوير MusiTeacher بملاحظاتكم.</p>
            <div className="sg-done__acts">
              <button type="button" className="sg-btn" onClick={again}><Ico d={I.send} size={18} /> إرسال رسالة أخرى</button>
              <HomeLogoLink className="sg-btn sg-btn--ghost" label="العودة إلى الصفحة الرئيسية">العودة إلى الرئيسية</HomeLogoLink>
            </div>
          </section>
        ) : (
          <form className="sg-card" onSubmit={submit} noValidate>
            <fieldset className="sg-cats">
              <legend>موضوع رسالتك <small>(اختياري)</small></legend>
              <div className="sg-cats__list">
                {CATEGORIES.map((c) => (
                  <label key={c.id} className={`sg-chip ${category === c.id ? 'is-on' : ''}`}>
                    <input type="radio" name="sg-cat" value={c.id} checked={category === c.id} onChange={() => setCategory(c.id)}
                      onClick={() => { if (category === c.id) setCategory(''); }} />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="sg-field" htmlFor="sg-text">
              <span>رسالتك</span>
              <textarea id="sg-text" ref={areaRef} value={text} onChange={(e) => { setText(e.target.value); if (error) setError(''); }}
                placeholder="اكتب هنا بحرية… اقتراحك، مشكلة واجهتك، فكرة لأداة جديدة، أو أي شيء تحب أن تقوله لنا."
                rows={9} maxLength={MAX + 200} aria-describedby="sg-count sg-privacy" aria-invalid={tooLong || undefined} />
            </label>
            <div className="sg-meta">
              <span id="sg-count" className={`sg-count ${tooLong ? 'is-over' : ''}`}>{count.toLocaleString('ar-EG')} / {MAX.toLocaleString('ar-EG')}</span>
            </div>

            {/* حقل فخ: لا يراه الإنسان ولا تصل إليه لوحة المفاتيح؛ إن مُلئ فالمرسل برنامج آلي */}
            <div className="sg-hp" aria-hidden="true">
              <label>اترك هذا الحقل فارغًا<input type="text" name="website" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></label>
            </div>

            {error ? <p className="sg-error" role="alert">{error}</p> : null}

            <button type="submit" className="sg-btn sg-btn--send" disabled={!canSend} aria-busy={state === 'sending'}>
              {state === 'sending' ? <><span className="sg-spin" aria-hidden="true" /> جارٍ الإرسال…</> : <><Ico d={I.send} size={19} /> أرسل رسالتي</>}
            </button>

            <p id="sg-privacy" className="sg-privacy"><Ico d={I.shield} size={18} />
              <span>لا نطلب منك اسمك أو بريدك الإلكتروني، ولا نربط رسالتك بحسابك داخل MusiTeacher. يقتصر الاطلاع على محتوى الرسائل على إدارة المنصة المخولة، مع الحرص على عدم جمع بيانات شخصية غير ضرورية.</span>
            </p>
          </form>
        )}
        <p className="sg-foot"><Ico d={I.heart} size={15} /> كل رسالة تُقرأ باهتمام وتساعدنا على تحسين المنصة.</p>
      </main>
    </div>
  );
}
