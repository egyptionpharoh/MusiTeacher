'use client';
// «مستشار المعلم في اللجان والامتحانات» — واجهة المحادثة.
// يجيب أولًا من قاعدة المعرفة المحلية. عند الحاجة فقط (سؤال من المجال بلا إجابة محلية) يطلب إجابة استرشادية
// من خادم المنصة (Gemini على الخادم — ui/aiClient.js)، وتُوسم بتنبيه واضح. لا يحفظ المحادثة خارج الصفحة.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Trash2, Users, BadgeCheck, DoorOpen, AlertTriangle, FileSignature, Compass, ShieldCheck, BookOpen, Info, MessagesSquare, Library, ChevronDown, UserRound, Sparkles, FastForward } from 'lucide-react';
import { createAdvisor, EXAMS, ROLES, examLabel, roleLabel, FALLBACK } from '../core/engine.js';
import { ENTRIES, CATEGORIES } from '../data/knowledge.js';
import { SYNONYMS } from '../data/synonyms.js';
import { SUGGESTED, STARTERS } from '../data/suggestions.js';
import { SOURCE_TYPES, DOCUMENTS, FIELD_NOTE } from '../data/sources.js';
import { askAI } from './aiClient.js';
import './committee-advisor.css';

const CTX_KEY = 'mt-committee-advisor-ctx';
const CAT_ICONS = { meeting: Users, role: BadgeCheck, examday: DoorOpen, violations: AlertTriangle, papers: FileSignature, refer: Compass };
let seq = 0;
const uid = () => `m${++seq}`;

function loadCtx() {
  try { const v = JSON.parse(sessionStorage.getItem(CTX_KEY) || '{}'); return { exam: v.exam || null, role: v.role || null }; } catch { return { exam: null, role: null }; }
}
function saveCtx(ctx) { try { sessionStorage.setItem(CTX_KEY, JSON.stringify(ctx)); } catch { /* التخزين غير متاح — لا مشكلة */ } }

const WELCOME = { id: 'welcome', from: 'bot', kind: 'welcome' };
const OUT_OF_SCOPE = 'أنا مختص بأسئلة اللجان والامتحانات وأعمال المراقبة والكنترول فقط. اسألني مثلًا: ماذا أفعل إذا لاحظت مخالفة؟';
const BUSY = 'وصلتني أسئلة كثيرة خلال وقت قصير. انتظر دقيقة ثم أعد إرسال سؤالك، أو اختر من الأسئلة المقترحة.';

export default function CommitteeAdvisor({ getToken = null, aiEndpoint = '/api/committee-advisor' }) {
  const advisor = useMemo(() => createAdvisor({ entries: ENTRIES, synonyms: SYNONYMS }), []);
  const [tab, setTab] = useState('chat');
  const [ctx, setCtx] = useState({ exam: null, role: null });
  const [msgs, setMsgs] = useState([WELCOME]);
  const [text, setText] = useState('');
  const [openCat, setOpenCat] = useState('meeting');
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const ctxRef = useRef(ctx);
  const typedRef = useRef(new Set()); // رسائل اكتملت كتابتها (لا يُعاد تحريكها عند الرجوع للتبويب)
  ctxRef.current = ctx;
  const aiOn = !!getToken;

  useEffect(() => { setCtx(loadCtx()); }, []);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, tab]);
  // أثناء الكتابة التدريجية: يتبع آخر الرسالة ما دام المعلم في أسفل المحادثة
  const follow = () => { const el = listRef.current; if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 140) el.scrollTop = el.scrollHeight; };

  const updateCtx = (patch) => { const next = { ...ctxRef.current, ...patch }; ctxRef.current = next; setCtx(next); saveCtx(next); return next; };
  const push = (...m) => setMsgs((prev) => [...prev, ...m]);
  const replace = (id, m) => setMsgs((prev) => prev.map((x) => (x.id === id ? { ...m, id } : x)));
  const botFrom = (r, extra = {}) => ({ id: uid(), from: 'bot', r, animate: true, ...extra });

  async function viaAI(question) {
    const wait = { id: uid(), from: 'bot', r: { type: 'thinking' } };
    push(wait);
    const { exam, role } = ctxRef.current;
    const out = await askAI({ question, exam, role, getToken, endpoint: aiEndpoint });
    if (out.ok && out.answer) replace(wait.id, { from: 'bot', animate: true, r: { type: 'ai', answer: out.answer, disclaimer: out.disclaimer } });
    else if (out.ok && out.outOfScope) replace(wait.id, { from: 'bot', animate: true, r: { type: 'plain', text: OUT_OF_SCOPE } });
    else replace(wait.id, { from: 'bot', animate: true, r: { type: out.reason === 'busy' ? 'plain' : 'unknown', text: out.reason === 'busy' ? BUSY : FALLBACK } });
  }

  function askText(raw) {
    const q = raw.trim().slice(0, 400);
    if (!q) { inputRef.current?.focus(); return; }
    const r = advisor.ask(q, ctxRef.current);
    if (r.examFromText && r.examFromText !== ctxRef.current.exam && r.type !== 'unknown') updateCtx({ exam: r.examFromText });
    setText('');
    push({ id: uid(), from: 'me', text: q });
    const domain = advisor.inDomain(q);
    if (r.type === 'unknown') {
      if (!domain) { push(botFrom({ type: 'plain', text: OUT_OF_SCOPE })); return; }
      if (aiOn) { viaAI(q); return; }
    }
    push(botFrom({ ...r, question: q, canAI: aiOn && domain }));
  }

  function askEntry(id, opts) {
    const e = advisor.entryById(id); if (!e) return;
    push({ id: uid(), from: 'me', text: e.q }, botFrom(advisor.answerEntry(id, ctxRef.current, opts)));
    setTab('chat');
  }

  function askDifferent(question) {
    push({ id: uid(), from: 'me', text: 'سؤالي مختلف — أجبني عنه' });
    viaAI(question);
  }

  function chooseExam(exam, pendingId) {
    updateCtx({ exam });
    const m = { id: uid(), from: 'me', text: `نوع الامتحان: ${examLabel(exam)}` };
    if (pendingId) push(m, botFrom(advisor.answerEntry(pendingId, ctxRef.current)));
    else push(m, botFrom({ type: 'plain', text: exam === 'general' ? 'حسنًا، سأجيبك إجابات عامة وأوضح لك نوع الامتحان الذي تخصه كل معلومة. اسأل سؤالك، أو اختر من الأسئلة المقترحة.' : `تم. سأراعي أن استفسارك عن ${examLabel(exam)}. اسأل سؤالك أو اختر من الأسئلة المقترحة.` }));
  }

  function chooseRole(role, pendingId) {
    updateCtx({ role });
    const m = { id: uid(), from: 'me', text: `طبيعة التكليف: ${roleLabel(role)}` };
    if (pendingId) push(m, botFrom(advisor.answerEntry(pendingId, ctxRef.current)));
    else push(m, botFrom({ type: 'plain', text: 'تم. سأراعي طبيعة تكليفك في الإجابات.' }));
  }

  const clearChat = () => { setMsgs([{ ...WELCOME, id: uid() }]); setText(''); };
  const markTyped = (id) => typedRef.current.add(id);

  return (
    <div className="cm-root" dir="rtl">
      <div className="cm-shell">
        <header className="cm-hero">
          <div className="cm-hero-text">
            <h1><span className="cm-logo" aria-hidden="true"><ShieldCheck size={26} /></span>مستشار المعلم في اللجان والامتحانات</h1>
            <p>اسأل عن مهامك وحقوقك ومسؤولياتك، وتعرّف على ما ينتظرك داخل اللجان والامتحانات</p>
          </div>
          <div className="cm-honest" role="note"><Library size={16} aria-hidden="true" /> {aiOn ? 'يجيب أولًا من قاعدة معرفة موثقة، ويستعين بالذكاء الاصطناعي عند الحاجة فقط' : 'يعمل محليًا من قاعدة معرفة موثقة'}</div>
        </header>

        <p className="cm-disclaimer" role="note"><Info size={15} aria-hidden="true" /> أداة إرشادية ضمن MusiTeacher، لا تمثل وزارة التربية والتعليم أو أي جهة رسمية، ولا تقدم استشارات قانونية. المرجع النهائي هو ما يبلغك به رئيس اللجان والجهات المختصة.</p>

        <nav className="cm-tabs" role="tablist" aria-label="أقسام المستشار">
          <button role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'is-on' : ''} onClick={() => setTab('chat')}><MessagesSquare size={17} /> المستشار</button>
          <button role="tab" aria-selected={tab === 'sources'} className={tab === 'sources' ? 'is-on' : ''} onClick={() => setTab('sources')}><BookOpen size={17} /> المصادر</button>
        </nav>

        {tab === 'chat' ? (
          <div className="cm-grid">
            <section className="cm-chat" aria-label="المحادثة">
              <ContextBar ctx={ctx} onExam={(v) => chooseExam(v)} onRole={(v) => chooseRole(v)} />
              <div className="cm-list" ref={listRef} aria-live="polite">
                {msgs.map((m) => (m.from === 'me'
                  ? <div key={m.id} className="cm-msg is-me"><div className="cm-bubble">{m.text}</div></div>
                  : <BotMessage key={m.id} m={m} ctx={ctx} animate={!!m.animate && !typedRef.current.has(m.id)} onTyped={() => markTyped(m.id)} onTick={follow}
                      onAsk={askEntry} onExam={chooseExam} onRole={chooseRole} onDifferent={askDifferent} />))}
              </div>
              <form className="cm-input" onSubmit={(ev) => { ev.preventDefault(); askText(text); }}>
                <label htmlFor="cm-q" className="cm-sr">اكتب سؤالك</label>
                <input id="cm-q" ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={400} autoComplete="off"
                  placeholder="اكتب سؤالك… مثل: ماذا أفعل إذا لاحظت مخالفة؟" />
                <button type="submit" className="cm-send" aria-label="إرسال" disabled={!text.trim()}><Send size={19} /></button>
                <button type="button" className="cm-clear" onClick={clearChat} title="مسح المحادثة" aria-label="مسح المحادثة"><Trash2 size={17} /></button>
              </form>
              <p className="cm-privacy">لا تكتب رقمك المدني أو بياناتك البنكية — المستشار لا يحتاجها ولا يحفظ محادثتك.</p>
            </section>

            <aside className="cm-side" aria-label="أسئلة مقترحة">
              <h2>أسئلة مقترحة</h2>
              {CATEGORIES.map((c) => {
                const Icon = CAT_ICONS[c.id] || Compass; const open = openCat === c.id;
                return (
                  <div key={c.id} className={`cm-cat${open ? ' is-open' : ''}`}>
                    <button className="cm-cat-head" aria-expanded={open} onClick={() => setOpenCat(open ? null : c.id)}>
                      <Icon size={18} aria-hidden="true" /> <span>{c.label}</span> <ChevronDown size={16} className="cm-chev" aria-hidden="true" />
                    </button>
                    {open && (
                      <div className="cm-cat-body">
                        {(SUGGESTED[c.id] || []).map((id) => { const e = advisor.entryById(id); return e && <button key={id} className="cm-sugg" onClick={() => askEntry(id)}>{e.q}</button>; })}
                      </div>
                    )}
                  </div>
                );
              })}
            </aside>
          </div>
        ) : <SourcesView />}

        <p className="cm-foot">عند الشك ارجع دائمًا إلى رئيس اللجان (رئيس مركز الامتحانات) أو المراقب الأول.</p>
      </div>
    </div>
  );
}

function ContextBar({ ctx, onExam, onRole }) {
  return (
    <div className="cm-ctx" aria-label="سياق الاستفسار">
      <label className="cm-ctx-item"><span>نوع الامتحان</span>
        <select value={ctx.exam || ''} onChange={(e) => e.target.value && onExam(e.target.value)}>
          <option value="" disabled>غير محدد</option>
          {EXAMS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </label>
      <label className="cm-ctx-item"><span>طبيعة التكليف</span>
        <select value={ctx.role || ''} onChange={(e) => e.target.value && onRole(e.target.value)}>
          <option value="" disabled>غير محدد</option>
          {ROLES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </label>
    </div>
  );
}

function Chips({ items, onPick, kind = 'q' }) {
  if (!items || !items.length) return null;
  return <div className={`cm-chips is-${kind}`}>{items.map((it) => <button key={it.id} onClick={() => onPick(it.id)}>{it.label || it.q}</button>)}</div>;
}

const wordsOf = (t) => String(t || '').split(/\s+/).filter(Boolean);

/** كتابة تدريجية كلمةً كلمة: الفقرات والقوائم تظهر بترتيبها، ويمكن عرض الكل فورًا */
function useTyping(total, animate, onDone, onTick) {
  const [n, setN] = useState(animate ? 0 : total);
  const raf = useRef(0);
  const done = useRef(!animate);
  const finish = () => { cancelAnimationFrame(raf.current); setN(total); };
  useEffect(() => {
    if (!animate) return undefined;
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* */ }
    if (reduce || total <= 3) { setN(total); return undefined; }
    const wps = Math.max(12, total / 5); // إجابة طويلة لا تتجاوز ~5 ثوانٍ، والقصيرة بإيقاع طبيعي
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(total, Math.ceil(((t - t0) / 1000) * wps)); setN(k); if (k < total) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (onTick) onTick(); if (n >= total && !done.current) { done.current = true; if (onDone) onDone(); } }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  return { n, typing: n < total, finish };
}

/** blocks: [{ kind:'p', text, cls? } | { kind:'ul', items:[...] }] */
function Typed({ blocks, animate, onDone, onTick, children }) {
  const counts = blocks.map((b) => (b.kind === 'ul' ? b.items.map((i) => wordsOf(i).length) : [wordsOf(b.text).length]));
  const total = counts.flat().reduce((a, b) => a + b, 0);
  const { n, typing, finish } = useTyping(total, animate, onDone, onTick);
  let left = n;
  const take = (t) => { const w = wordsOf(t); const k = Math.max(0, Math.min(w.length, left)); left -= k; return w.slice(0, k).join(' '); };
  return (
    <>
      <div className={`cm-typed${typing ? ' is-typing' : ''}`}>
        {blocks.map((b, i) => {
          if (left <= 0 && i > 0) return null;
          if (b.kind === 'ul') {
            const items = []; for (const it of b.items) { if (left <= 0) break; items.push(take(it)); }
            return items.length ? <ul key={i} className={b.cls}>{items.map((t, j) => <li key={j}>{t}</li>)}</ul> : null;
          }
          const t = take(b.text);
          return t ? <p key={i} className={b.cls} title={b.title}>{t}</p> : null;
        })}
      </div>
      {typing
        ? <button type="button" className="cm-skip" onClick={finish}><FastForward size={14} aria-hidden="true" /> عرض الإجابة كاملة</button>
        : children}
    </>
  );
}

function entryBlocks(e) {
  const out = [];
  for (const p of e.parts) {
    const cls = p.src === 'field' ? 'cm-fld' : undefined;
    const title = p.src === 'field' ? 'خبرة ميدانية استرشادية' : undefined;
    if (p.text) out.push({ kind: 'p', text: p.text, cls, title });
    if (p.list && p.list.length) out.push({ kind: 'ul', items: p.list, cls });
  }
  return out;
}

/** زر «المصدر»: لا يظهر إلا إن كان للإجابة مصدر فعلي (وثيقة أو خبرة ميدانية) */
function SourceToggle({ e }) {
  const [open, setOpen] = useState(false);
  const docs = []; const seen = new Set();
  for (const p of e.parts) if (p.src === 'official') { const k = `${p.ref.doc}|${p.ref.part}`; if (!seen.has(k)) { seen.add(k); docs.push(p.ref); } }
  const field = e.parts.some((p) => p.src === 'field');
  const general = e.parts.some((p) => p.src === 'general');
  if (!docs.length && !field) return null;
  return (
    <>
      <button type="button" className={`cm-src-btn${open ? ' is-on' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}><BookOpen size={14} aria-hidden="true" /> المصدر</button>
      {open && (
        <div className="cm-src">
          {docs.map((r, i) => <p key={i}><Badge src="official" /> «{DOCUMENTS[r.doc].title}» — {r.part}</p>)}
          {field && <p><Badge src="field" /> من الخبرة الميدانية لصاحب المنصة في امتحانات الدبلوم العام، وليست نصًا رسميًا.</p>}
          {general && <p className="cm-muted">وما سوى ذلك في الإجابة إرشاد عام.</p>}
          {e.gap && <p className="cm-muted">ملاحظة: {e.gap}</p>}
        </div>
      )}
    </>
  );
}

function Badge({ src }) {
  const t = SOURCE_TYPES[src] || SOURCE_TYPES.none;
  return <span className={`cm-badge is-${t.tone}`}>{t.label}</span>;
}

function BotMessage({ m, ctx, animate, onTyped, onTick, onAsk, onExam, onRole, onDifferent }) {
  if (m.kind === 'welcome') {
    return (
      <div className="cm-msg is-bot"><div className="cm-bubble">
        <p className="cm-lead">مرحبًا بك. أساعدك على فهم مهامك في اللجان والامتحانات.</p>
        <p>حتى أقدم لك إجابة مناسبة، أخبرني عن نوع الامتحان الذي تستفسر بشأنه:</p>
        <Chips kind="ctx" items={EXAMS} onPick={(id) => onExam(id)} />
        <p className="cm-muted">أو ابدأ بأحد هذه الأسئلة:</p>
        <Chips items={STARTERS.map((id) => ENTRIES.find((e) => e.id === id)).filter(Boolean)} onPick={onAsk} />
      </div></div>
    );
  }
  const r = m.r;
  const wrap = (body, cls = '') => <div className={`cm-msg is-bot ${cls}`}><div className="cm-bubble">{body}</div></div>;
  const typedText = (text, cls) => <Typed blocks={[{ kind: 'p', text, cls }]} animate={animate} onDone={onTyped} onTick={onTick} />;

  switch (r.type) {
    case 'answer': {
      const e = r.entry;
      const askRole = e.cat === 'examday' && !ctx.role;
      return wrap(<>
        {r.notes && r.notes.map((n, i) => <p key={i} className="cm-note"><Info size={14} aria-hidden="true" /> {n}</p>)}
        <Typed blocks={entryBlocks(e)} animate={animate} onDone={onTyped} onTick={onTick}>
          {e.refer && <p className="cm-refer"><UserRound size={15} aria-hidden="true" /> عند الحاجة ارجع إلى: <strong>{e.refer}</strong></p>}
          <div className="cm-actions"><SourceToggle e={e} /></div>
          {askRole && <div className="cm-ask-role"><p>لأخصص لك الإجابة: ما طبيعة تكليفك؟</p><Chips kind="ctx" items={ROLES} onPick={(id) => onRole(id, e.id)} /></div>}
          {r.related && r.related.length > 0 && <><p className="cm-muted">أسئلة ذات صلة:</p><Chips items={r.related} onPick={onAsk} /></>}
        </Typed>
      </>);
    }
    case 'ai': {
      const a = r.answer;
      const blocks = [...(a.intro ? [{ kind: 'p', text: a.intro }] : []), ...(a.points && a.points.length ? [{ kind: 'ul', items: a.points }] : [])];
      return wrap(
        <Typed blocks={blocks} animate={animate} onDone={onTyped} onTick={onTick}>
          {a.refer && <p className="cm-refer"><UserRound size={15} aria-hidden="true" /> ارجع إلى: <strong>{a.refer}</strong></p>}
          <p className="cm-ai-note"><Sparkles size={13} aria-hidden="true" /> {r.disclaimer}</p>
        </Typed>, 'is-ai');
    }
    case 'thinking':
      return wrap(<div className="cm-dots" role="status" aria-label="جارٍ إعداد الإجابة"><span /><span /><span /></div>);
    case 'need-exam':
      return wrap(<><p>{r.text}</p><Chips kind="ctx" items={EXAMS} onPick={(id) => onExam(id, r.entry.id)} /></>);
    case 'mismatch':
      return wrap(<>
        {typedText(r.text)}
        <p className="cm-refer"><UserRound size={15} aria-hidden="true" /> ارجع إلى: <strong>{r.refer}</strong></p>
        <div className="cm-chips is-ghost"><button onClick={() => onAsk(r.entry.id, { force: true })}>اعرض ما يخص {r.entry.exams.map(examLabel).join(' و')} للاطلاع فقط</button></div>
        {r.related && r.related.length > 0 && <><p className="cm-muted">أسئلة قريبة تنطبق على اختيارك:</p><Chips items={r.related} onPick={onAsk} /></>}
      </>);
    case 'choices':
      return wrap(<>
        <p>{r.text}</p><Chips items={r.options} onPick={onAsk} />
        {r.canAI
          ? <div className="cm-chips is-ghost"><button onClick={() => onDifferent(r.question)}><Sparkles size={14} aria-hidden="true" /> سؤالي مختلف — أجبني عنه</button></div>
          : <p className="cm-muted">إن لم يكن سؤالك بينها، أعد صياغته بتفاصيل أكثر.</p>}
      </>);
    case 'unknown':
      return wrap(typedText(r.text || FALLBACK));
    case 'private':
      return wrap(<p>{r.text}</p>, 'is-warn');
    default:
      return wrap(typedText(r.text));
  }
}

function SourcesView() {
  return (
    <div className="cm-sources">
      <section className="cm-card">
        <h2>كيف يعمل المستشار؟</h2>
        <ul>
          <li>يبحث أولًا في قاعدة معرفة مكتوبة مسبقًا داخل المنصة، بالكلمات المفتاحية والمرادفات، ويختار الإجابة الأقرب لسؤالك.</li>
          <li>إذا كان سؤالك عن اللجان والامتحانات ولم يجد له إجابة في القاعدة، يستعين بالذكاء الاصطناعي لصياغة إجابة استرشادية مختصرة، وتظهر معها عبارة توضح أنها مولدة بالذكاء الاصطناعي. لا يُرسل مع السؤال أي بيانات شخصية.</li>
          <li>الإجابات المولدة لا تتضمن عقوبات أو قرارات إدارية؛ وعند الشك ارجع إلى رئيس اللجان (رئيس مركز الامتحانات) أو المراقب الأول.</li>
          <li>اضغط زر «المصدر» أسفل أي إجابة لتعرف من أين جاءت.</li>
        </ul>
        <h3>أنواع المصادر</h3>
        <div className="cm-legend">
          {Object.keys(SOURCE_TYPES).map((k) => <div key={k}><Badge src={k} /> <span>{{ official: 'منقولة من وثيقة مرفقة مع ذكر البند.', field: 'خبرة عملية لصاحب المنصة، للاسترشاد فقط وليست نصًا رسميًا.', general: 'نصيحة عامة لا تعارض الوثائق المتاحة.', none: 'لا تتوفر معلومة موثقة، فيُحال السؤال إلى الجهة المختصة.' }[k]}</span></div>)}
        </div>
      </section>

      {Object.values(DOCUMENTS).map((d) => (
        <section key={d.id} className="cm-card">
          <div className="cm-doc-head"><Badge src="official" /><h2>{d.title}</h2></div>
          <p className="cm-muted">{d.kind}</p>
          <ul className="cm-doc-notes">{d.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          <details className="cm-doc">
            <summary>عرض النص المنقول من الوثيقة</summary>
            <ol>
              {d.items.map((it) => (
                <li key={it.n}><strong>{it.n}.</strong> {it.heading && <em>{it.heading} </em>}{it.text}
                  {it.list && <ul>{it.list.map((x, i) => <li key={i}>{x}</li>)}</ul>}</li>
              ))}
            </ol>
          </details>
        </section>
      ))}

      <section className="cm-card">
        <div className="cm-doc-head"><Badge src="field" /><h2>الخبرة الميدانية</h2></div>
        <p>{FIELD_NOTE}</p>
        <p className="cm-muted">لا تُعرض هذه الخبرة على أنها لوائح أو تعليمات رسمية، ولا يُفترض أن كل ما فيها يحدث في كل مركز أو في كل عام.</p>
      </section>
    </div>
  );
}
