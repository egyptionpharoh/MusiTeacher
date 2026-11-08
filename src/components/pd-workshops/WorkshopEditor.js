'use client';
// محرر المشغل: كل قسم قابل للتعديل قبل التصدير. القوائم تُكتب بندًا في كل سطر.
import { useState } from 'react';
import { Icon } from './icons';
import { retime } from '@/lib/pd-workshops/compose';
import { normalizeWorkshop, totalMinutes, ordinal } from '@/lib/pd-workshops/schema';

const toText = (arr) => (arr || []).join('\n');
const toList = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);

function Text({ label, value, onChange, rows, max = 600, hint }) {
  return (
    <label className="pd-field">
      <span>{label}</span>
      {rows ? <textarea className="pd-input" rows={rows} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
        : <input className="pd-input" value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />}
      {hint && <small className="pd-fine">{hint}</small>}
    </label>
  );
}
// القوائم تُحرَّر نصًا خامًا ثم تُحوَّل إلى بنود عند الحفظ (حتى لا تختفي الأسطر الفارغة أثناء الكتابة)
function List({ label, value, onChange, rows = 4 }) {
  return <Text label={`${label} (بند في كل سطر)`} value={value} onChange={onChange} rows={rows} max={4000} />;
}
function Minutes({ value, onChange }) {
  return (
    <label className="pd-minutes"><span>الزمن</span>
      <input type="number" min={0} max={180} value={value} onChange={(e) => onChange(Math.max(0, Math.min(180, Number(e.target.value) || 0)))} /><span>دقيقة</span>
    </label>
  );
}

/** نحرر نسخة "نصية" من المشغل: القوائم نصوص متعددة الأسطر. */
function toDraft(w) {
  return {
    ...w,
    objectives: toText(w.objectives), materials: toText(w.materials), strategies: toText(w.strategies), outcomes: toText(w.outcomes), refs: toText(w.refs),
    opening: { ...w.opening, agreements: toText(w.opening.agreements) },
    hook: { ...w.hook, steps: toText(w.hook.steps) },
    axes: w.axes.map((a) => ({ ...a, points: toText(a.points) })),
    activity: { ...w.activity, steps: toText(w.activity.steps), tips: toText(w.activity.tips) },
    discussion: { ...w.discussion, questions: toText(w.discussion.questions) },
    closing: { ...w.closing, recs: toText(w.closing.recs) },
    evaluation: { ...w.evaluation, items: toText(w.evaluation.items), feedback: toText(w.evaluation.feedback) },
  };
}
function fromDraft(d) {
  return normalizeWorkshop({
    ...d,
    objectives: toList(d.objectives), materials: toList(d.materials), strategies: toList(d.strategies), outcomes: toList(d.outcomes), refs: toList(d.refs),
    opening: { ...d.opening, agreements: toList(d.opening.agreements) },
    hook: { ...d.hook, steps: toList(d.hook.steps) },
    axes: d.axes.map((a) => ({ ...a, points: toList(a.points) })),
    activity: { ...d.activity, steps: toList(d.activity.steps), tips: toList(d.activity.tips) },
    discussion: { ...d.discussion, questions: toList(d.discussion.questions) },
    closing: { ...d.closing, recs: toList(d.closing.recs) },
    evaluation: { ...d.evaluation, items: toList(d.evaluation.items), feedback: toList(d.evaluation.feedback) },
  });
}

export default function WorkshopEditor({ workshop, onSave, onCancel }) {
  const [d, setD] = useState(() => toDraft(workshop));
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const sub = (k, f, v) => setD((x) => ({ ...x, [k]: { ...x[k], [f]: v } }));
  const axis = (i, f, v) => setD((x) => ({ ...x, axes: x.axes.map((a, j) => (j === i ? { ...a, [f]: v } : a)) }));
  const moveAxis = (i, n) => setD((x) => { const a = [...x.axes]; const j = i + n; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, axes: a }; });
  const addAxis = () => setD((x) => ({ ...x, axes: [...x.axes, { title: 'محور جديد', explain: '', points: '', example: '', minutes: 5 }] }));
  const delAxis = (i) => setD((x) => ({ ...x, axes: x.axes.filter((_, j) => j !== i) }));
  const st = (f, v) => setD((x) => ({ ...x, settings: { ...x.settings, [f]: v } }));

  const current = fromDraft(d);
  const total = totalMinutes(current);
  const target = d.settings.duration;
  const redistribute = () => setD(toDraft(retime(fromDraft(d), target)));

  return (
    <form className="pd-panel pd-editor" onSubmit={(e) => { e.preventDefault(); onSave(fromDraft(d)); }}>
      <div className="pd-editor-bar">
        <h2><Icon d="edit" /> تعديل المشغل</h2>
        <span className={`pd-total ${total === target ? 'is-ok' : 'is-off'}`}>المجموع {total} من {target} دقيقة</span>
        {total !== target && <button type="button" className="pd-link" onClick={redistribute}>وزّع الوقت تلقائيًا</button>}
        <span className="pd-grow" />
        <button type="button" className="pd-secondary" onClick={onCancel}>إلغاء</button>
        <button type="submit" className="pd-primary"><Icon d="save" /> حفظ التعديلات</button>
      </div>

      <fieldset className="pd-fs"><legend>البيانات العامة</legend>
        <Text label="عنوان المشغل" value={d.title} onChange={(v) => set('title', v)} max={160} />
        <Text label="عبارة تعريفية" value={d.tagline} onChange={(v) => set('tagline', v)} max={200} />
        <Text label="الفئة المستهدفة" value={d.audienceText} onChange={(v) => set('audienceText', v)} max={300} />
        <Text label="وصف المشغل" value={d.summary} onChange={(v) => set('summary', v)} rows={3} max={1200} />
        <Text label="أهميته" value={d.importance} onChange={(v) => set('importance', v)} rows={2} max={1200} />
        <Text label="الهدف العام" value={d.goal} onChange={(v) => set('goal', v)} rows={2} max={400} />
        <List label="الأهداف التفصيلية" value={d.objectives} onChange={(v) => set('objectives', v)} />
        <div className="pd-two is-tight">
          <label className="pd-field"><span>المدة المطلوبة (دقيقة)</span><input className="pd-input" type="number" min={10} max={180} value={d.settings.duration} onChange={(e) => st('duration', Math.max(10, Math.min(180, Number(e.target.value) || 10)))} /></label>
          <label className="pd-field"><span>عدد المشاركين</span><input className="pd-input" type="number" min={2} max={300} value={d.settings.participants} onChange={(e) => st('participants', Math.max(2, Math.min(300, Number(e.target.value) || 2)))} /></label>
        </div>
        <div className="pd-two is-tight">
          <Text label="مقدّم المشغل" value={d.settings.presenter} onChange={(v) => st('presenter', v)} max={120} />
          <Text label="المدرسة" value={d.settings.school} onChange={(v) => st('school', v)} max={160} />
        </div>
        <div className="pd-two is-tight">
          <Text label="التاريخ" value={d.settings.date} onChange={(v) => st('date', v)} max={60} />
          <Text label="المكان" value={d.settings.venue} onChange={(v) => st('venue', v)} max={120} />
        </div>
      </fieldset>

      <fieldset className="pd-fs"><legend>الافتتاح</legend>
        <Minutes value={d.opening.minutes} onChange={(v) => sub('opening', 'minutes', v)} />
        <Text label="نص الترحيب" value={d.opening.welcome} onChange={(v) => sub('opening', 'welcome', v)} rows={3} max={800} />
        <List label="اتفاقيات المشغل" value={d.opening.agreements} onChange={(v) => sub('opening', 'agreements', v)} rows={3} />
      </fieldset>

      <fieldset className="pd-fs"><legend>النشاط التمهيدي</legend>
        <Minutes value={d.hook.minutes} onChange={(v) => sub('hook', 'minutes', v)} />
        <Text label="اسم النشاط" value={d.hook.title} onChange={(v) => sub('hook', 'title', v)} max={160} />
        <Text label="الغرض منه" value={d.hook.purpose} onChange={(v) => sub('hook', 'purpose', v)} max={400} />
        <List label="الخطوات" value={d.hook.steps} onChange={(v) => sub('hook', 'steps', v)} />
      </fieldset>

      {d.axes.map((a, i) => (
        <fieldset key={i} className="pd-fs"><legend>المحور {ordinal(i + 1)}</legend>
          <div className="pd-axis-tools">
            <Minutes value={a.minutes} onChange={(v) => axis(i, 'minutes', v)} />
            <button type="button" className="pd-icon" onClick={() => moveAxis(i, -1)} disabled={i === 0} aria-label="تقديم المحور"><Icon d="M12 19V5m-6 6 6-6 6 6" /></button>
            <button type="button" className="pd-icon" onClick={() => moveAxis(i, 1)} disabled={i === d.axes.length - 1} aria-label="تأخير المحور"><Icon d="M12 5v14m6-6-6 6-6-6" /></button>
            <button type="button" className="pd-icon is-danger" onClick={() => delAxis(i)} disabled={d.axes.length < 2} aria-label="حذف المحور"><Icon d="trash" /></button>
          </div>
          <Text label="عنوان المحور" value={a.title} onChange={(v) => axis(i, 'title', v)} max={160} />
          <Text label="شرح الميسّر" value={a.explain} onChange={(v) => axis(i, 'explain', v)} rows={3} max={1200} />
          <List label="نقاط العرض" value={a.points} onChange={(v) => axis(i, 'points', v)} rows={3} />
          <Text label="مثال من الواقع المدرسي" value={a.example} onChange={(v) => axis(i, 'example', v)} rows={2} max={600} />
        </fieldset>
      ))}
      {d.axes.length < 6 && <button type="button" className="pd-secondary" onClick={addAxis}><Icon d="plus" /> إضافة محور</button>}

      <fieldset className="pd-fs"><legend>النشاط التطبيقي</legend>
        <Minutes value={d.activity.minutes} onChange={(v) => sub('activity', 'minutes', v)} />
        <Text label="اسم النشاط" value={d.activity.title} onChange={(v) => sub('activity', 'title', v)} max={160} />
        <Text label="التنظيم" value={d.activity.grouping} onChange={(v) => sub('activity', 'grouping', v)} max={200} />
        <List label="الخطوات" value={d.activity.steps} onChange={(v) => sub('activity', 'steps', v)} rows={5} />
        <Text label="المنتج المتوقع" value={d.activity.output} onChange={(v) => sub('activity', 'output', v)} rows={2} max={400} />
        <List label="ملاحظات للميسّر" value={d.activity.tips} onChange={(v) => sub('activity', 'tips', v)} rows={2} />
      </fieldset>

      <fieldset className="pd-fs"><legend>النقاش وتبادل الخبرات</legend>
        <Minutes value={d.discussion.minutes} onChange={(v) => sub('discussion', 'minutes', v)} />
        <List label="أسئلة النقاش" value={d.discussion.questions} onChange={(v) => sub('discussion', 'questions', v)} rows={3} />
      </fieldset>

      <fieldset className="pd-fs"><legend>الخاتمة والتوصيات</legend>
        <Minutes value={d.closing.minutes} onChange={(v) => sub('closing', 'minutes', v)} />
        <Text label="الفكرة الرئيسة" value={d.closing.takeaway} onChange={(v) => sub('closing', 'takeaway', v)} rows={2} max={500} />
        <List label="التوصيات" value={d.closing.recs} onChange={(v) => sub('closing', 'recs', v)} />
      </fieldset>

      <fieldset className="pd-fs"><legend>التقويم والتغذية الراجعة</legend>
        <Minutes value={d.evaluation.minutes} onChange={(v) => sub('evaluation', 'minutes', v)} />
        <Text label="طريقة قياس الأثر" value={d.evaluation.method} onChange={(v) => sub('evaluation', 'method', v)} max={200} />
        <List label="بنود التقويم" value={d.evaluation.items} onChange={(v) => sub('evaluation', 'items', v)} />
        <List label="أسئلة بطاقة التغذية الراجعة" value={d.evaluation.feedback} onChange={(v) => sub('evaluation', 'feedback', v)} />
      </fieldset>

      <fieldset className="pd-fs"><legend>المواد والنتائج والملاحظات</legend>
        <List label="المواد والأدوات" value={d.materials} onChange={(v) => set('materials', v)} />
        <List label="أساليب التدريب" value={d.strategies} onChange={(v) => set('strategies', v)} rows={3} />
        <List label="النتائج المتوقعة" value={d.outcomes} onChange={(v) => set('outcomes', v)} rows={3} />
        <Text label="ملاحظات للميسّر" value={d.notes} onChange={(v) => set('notes', v)} rows={3} max={2000} />
        <List label="المراجع" value={d.refs} onChange={(v) => set('refs', v)} rows={3} />
        <p className="pd-fine">أضف إلى المراجع فقط كتبًا أو مصادر حقيقية تحققت منها بنفسك.</p>
      </fieldset>

      <div className="pd-editor-bar is-bottom">
        <span className={`pd-total ${total === target ? 'is-ok' : 'is-off'}`}>المجموع {total} من {target} دقيقة</span>
        <span className="pd-grow" />
        <button type="button" className="pd-secondary" onClick={onCancel}>إلغاء</button>
        <button type="submit" className="pd-primary"><Icon d="save" /> حفظ التعديلات</button>
      </div>
    </form>
  );
}
