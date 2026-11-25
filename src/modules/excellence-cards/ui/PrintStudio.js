'use client';
// «الطباعة»: مصدر الكروت + عدد الكروت في صفحة A4 + ألوان/أبيض وأسود + خطوط القص + معاينة الصفحات.
import { useMemo, useState } from 'react';
import { LAYOUTS, layoutFor, paginate, CUT_GAP } from '../core/layout.js';
import { PHRASE_TAGS, phrasesFor, phraseText } from '../data/phrases.js';
import { templateById } from '../data/templates.js';
import Card from './Card.js';
import { Fit } from './print.js';
import { Ico, Seg } from './parts.js';

export function Sheet({ cards, perPage, settings, bw, cut, now }) {
  const l = layoutFor(perPage);
  return (
    <div className={`ec-sheet ${cut ? 'with-cut' : ''}`} style={{ '--cols': l.cols, '--rows': l.rows, '--cw': `${l.w}mm`, '--ch': `${l.h}mm` }}>
      {cards.map((c, i) => (
        <div className="ec-cell" key={c.qid || i}>
          <Card settings={settings} card={c} w={+(l.w - 2 * CUT_GAP).toFixed(2)} h={+(l.h - 2 * CUT_GAP).toFixed(2)} bw={bw} now={now} />
        </div>
      ))}
      {cut ? <span className="ec-scissor">✂ قُص على الخطوط المتقطعة</span> : null}
    </div>
  );
}

/** قائمة الكروت المطلوب طباعتها حسب المصدر المختار */
export function buildCards(state, { picked = [] } = {}) {
  const { print, card } = state;
  if (print.source === 'queue') return state.queue;
  if (print.source === 'variety') return phrasesFor(print.varietyTag).map((p) => ({ ...card, phraseId: p.id, custom: '', student: '', grade: card.grade, qid: p.id }));
  if (print.source === 'students') {
    const set = new Set(picked);
    return state.students.filter((s) => set.has(s.id)).map((s) => ({ ...card, student: s.name, grade: s.grade || card.grade, gender: s.gender, qid: s.id }));
  }
  return Array.from({ length: print.copies }, (_, i) => ({ ...card, qid: `c${i}` }));
}

export default function PrintStudio({ state, update, picked, setPicked, onPrint, goDesigner, goTracker }) {
  const { print } = state;
  const setPrint = (patch) => update((s) => ({ ...s, print: { ...s.print, ...patch } }));
  const cards = useMemo(() => buildCards(state, { picked }), [state, picked]);
  const pages = useMemo(() => paginate(cards, print.perPage), [cards, print.perPage]);
  const [showAll, setShowAll] = useState(false);
  const lay = layoutFor(print.perPage);
  const students = state.students.filter((s) => !s.archived);
  const grades = [...new Set(students.map((s) => s.grade).filter(Boolean))];
  const visible = showAll ? pages : pages.slice(0, 2);

  return (
    <div className="ec-print">
      <div className="ec-print-controls">
        <section className="ec-box">
          <h3><Ico n="copy" /> ماذا تطبع؟</h3>
          <div className="ec-sources" role="radiogroup" aria-label="مصدر الكروت">
            {[
              { id: 'copies', t: 'نسخ من كارتي الحالي', d: 'نفس التصميم والعبارة — مناسب للكتابة باليد.' },
              { id: 'variety', t: 'عبارات منوعة بنفس التصميم', d: 'كارت لكل عبارة، مثل ورقة الكروت الجاهزة.' },
              { id: 'students', t: 'كارت باسم كل طالب', d: students.length ? 'من قائمة طلبتك في «متابعة الكوبونات».' : 'يحتاج إضافة الطلبة في «متابعة الكوبونات».' },
              { id: 'queue', t: `قائمتي المختارة (${state.queue.length})`, d: 'كروت مختلفة أضفتها من المصمم.' },
            ].map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={print.source === o.id} className={`ec-source ${print.source === o.id ? 'is-on' : ''}`} onClick={() => setPrint({ source: o.id })} data-src={o.id}>
                <b>{o.t}</b><small>{o.d}</small>
              </button>
            ))}
          </div>
          {print.source === 'copies' && (
            <div className="ec-row">
              <label className="ec-inline">عدد النسخ
                <input type="number" className="ec-input is-num" id="ec-copies" min={1} max={200} value={print.copies} onChange={(e) => setPrint({ copies: Math.min(200, Math.max(1, +e.target.value || 1)) })} />
              </label>
              <button type="button" className="ec-chip" onClick={() => setPrint({ copies: lay.n })}>صفحة كاملة ({lay.n})</button>
              <button type="button" className="ec-chip" onClick={() => setPrint({ copies: 1 })}>كارت واحد</button>
            </div>
          )}
          {print.source === 'variety' && (
            <div className="ec-row">
              <label className="ec-inline">العبارات
                <select className="ec-input" value={print.varietyTag} onChange={(e) => setPrint({ varietyTag: e.target.value })}>
                  {PHRASE_TAGS.map((t) => <option key={t.id} value={t.id}>{t.label} ({phrasesFor(t.id).length})</option>)}
                </select>
              </label>
            </div>
          )}
          {print.source === 'students' && (
            students.length ? (
              <div className="ec-pick">
                <div className="ec-row">
                  <button type="button" className="ec-chip" onClick={() => setPicked(students.map((s) => s.id))}>تحديد الكل</button>
                  {grades.map((g) => <button key={g} type="button" className="ec-chip" onClick={() => setPicked(students.filter((s) => s.grade === g).map((s) => s.id))}>الصف {g}</button>)}
                  <button type="button" className="ec-chip" onClick={() => setPicked([])}>إلغاء التحديد</button>
                </div>
                <div className="ec-picklist">
                  {students.map((s) => (
                    <label key={s.id} className="ec-check"><input type="checkbox" checked={picked.includes(s.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))} /> {s.name}{s.grade ? <small> · {s.grade}</small> : null}</label>
                  ))}
                </div>
                <small className="ec-hint">تُستخدم عبارة الكارت الحالي، بصيغة الطالب أو الطالبة حسب بيانات كل اسم.</small>
              </div>
            ) : <div className="ec-empty">لا يوجد طلبة بعد. <button type="button" className="ec-link" onClick={goTracker}>أضف طلبتك</button> (اختياري).</div>
          )}
          {print.source === 'queue' && (
            state.queue.length ? (
              <ul className="ec-queue">
                {state.queue.map((q) => (
                  <li key={q.qid}>
                    <span className="ec-qdot" style={{ background: templateById(q.template).c1 }} />
                    <span className="ec-qtext">{phraseText(q).replace('\n', ' ')}{q.student ? <b> — {q.student}</b> : null}</span>
                    <button type="button" className="ec-icon-btn" aria-label="حذف من القائمة" onClick={() => update((s) => ({ ...s, queue: s.queue.filter((x) => x.qid !== q.qid) }))}><Ico n="x" size={16} /></button>
                  </li>
                ))}
                <li className="ec-queue-foot"><button type="button" className="ec-link" onClick={() => update((s) => ({ ...s, queue: [] }))}>تفريغ القائمة</button></li>
              </ul>
            ) : <div className="ec-empty">القائمة فارغة. من <button type="button" className="ec-link" onClick={goDesigner}>المصمم</button> صمّم كارتًا واضغط «أضف إلى قائمة الطباعة»، وكرر ذلك لكروت مختلفة في نفس الصفحة.</div>
          )}
        </section>

        <section className="ec-box">
          <h3><Ico n="print" /> إعدادات صفحة A4</h3>
          <div className="ec-layouts" role="radiogroup" aria-label="عدد الكروت في الصفحة">
            {LAYOUTS.map((l) => (
              <button key={l.n} type="button" role="radio" aria-checked={print.perPage === l.n} className={`ec-layout ${print.perPage === l.n ? 'is-on' : ''}`} onClick={() => setPrint({ perPage: l.n })} data-per={l.n}>
                <span className="ec-mini" style={{ '--cols': l.cols, '--rows': l.rows, '--mh': l.n === 1 ? '43%' : '100%' }}>{Array.from({ length: l.n }, (_, i) => <i key={i} />)}</span>
                <b>{l.n === 1 ? 'كارت واحد' : `${l.n} كروت`}</b><small>{l.cm}</small>
              </button>
            ))}
          </div>
          <div className="ec-row">
            <Seg label="الألوان" value={print.color ? 'c' : 'bw'} onChange={(v) => setPrint({ color: v === 'c' })} options={[{ id: 'c', label: 'ملونة' }, { id: 'bw', label: 'أبيض وأسود (موفّر للحبر)' }]} />
            <label className="ec-switch is-inline"><input type="checkbox" id="ec-cut" checked={print.cut} onChange={(e) => setPrint({ cut: e.target.checked })} /><span><Ico n="scissors" size={16} /> خطوط القص</span></label>
          </div>
        </section>

        <div className="ec-printbar">
          <div><b id="ec-total">{cards.length} كارت · {pages.length} صفحة</b><small>A4 عمودي · المقياس 100%</small></div>
          <button type="button" className="ec-btn is-primary is-big" id="ec-do-print" disabled={!cards.length} onClick={() => onPrint(cards)}><Ico n="print" /> طباعة</button>
        </div>
        <details className="ec-tip"><summary><Ico n="info" size={16} /> نصائح لطباعة سليمة</summary>
          <ul><li>في نافذة الطباعة اختر الورق <b>A4</b> والمقياس <b>100% / الافتراضي</b> (لا تختر «ملاءمة الصفحة»).</li>
            <li>فعّل «رسومات الخلفية» إن أردت ظهور الألوان الخفيفة خلف العبارات.</li>
            <li>لحفظ الكروت كملف PDF اختر الطابعة «حفظ بتنسيق PDF».</li>
            <li>الورق المقوى (160–250 جم) يعطي كروتًا أجمل وأقوى.</li></ul>
        </details>
      </div>

      <div className="ec-pages" aria-label="معاينة صفحات الطباعة">
        {pages.length ? visible.map((p, i) => (
          <figure key={i} className="ec-page"><Fit w={210} h={297} max={0.9}><Sheet cards={p} perPage={print.perPage} settings={state.settings} bw={!print.color} cut={print.cut} /></Fit>
            <figcaption>صفحة {i + 1} من {pages.length}</figcaption></figure>
        )) : <div className="ec-empty">لا توجد كروت للطباعة بعد.</div>}
        {pages.length > 2 && !showAll ? <button type="button" className="ec-btn is-ghost" onClick={() => setShowAll(true)}>عرض كل الصفحات ({pages.length})</button> : null}
      </div>
    </div>
  );
}
