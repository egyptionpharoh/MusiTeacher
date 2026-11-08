'use client';
// تحرير خطة المبادرة: كل الحقول قابلة للتعديل، والقوائم بندًا في كل سطر، والجداول صفًا صفًا.
import { useState } from 'react';
import { DOMAINS, LEADS, COSTS, SIZES, STAGES } from '@/lib/initiatives/taxonomy';
import { normalizeInitiative } from '@/lib/initiatives/schema';
import { Icon } from './parts';

const T = (a) => (a || []).join('\n');
const L = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);

function Text({ label, value, onChange, rows, max = 600 }) {
  return (
    <label className="in-field"><span>{label}</span>
      {rows ? <textarea className="in-input" rows={rows} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
        : <input className="in-input" maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}
const Lst = ({ label, value, onChange, rows = 3 }) => <Text label={`${label} (بند في كل سطر)`} value={value} onChange={onChange} rows={rows} max={4000} />;
function Rows({ title, rows, onChange, make, render, addLabel }) {
  const upd = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const del = (i) => onChange(rows.filter((_, j) => j !== i));
  const mv = (i, n) => { const a = [...rows]; const j = i + n; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  return (
    <fieldset className="in-fs"><legend>{title}</legend>
      {rows.map((r, i) => (
        <div key={i} className="in-row-edit">
          <div className="in-row-fields">{render(r, (patch) => upd(i, patch), i)}</div>
          <div className="in-row-tools">
            <button type="button" className="in-icon" onClick={() => mv(i, -1)} disabled={i === 0} aria-label="تقديم"><Icon d="M12 19V5m-6 6 6-6 6 6" /></button>
            <button type="button" className="in-icon" onClick={() => mv(i, 1)} disabled={i === rows.length - 1} aria-label="تأخير"><Icon d="M12 5v14m6-6-6 6-6-6" /></button>
            <button type="button" className="in-icon is-danger" onClick={() => del(i)} aria-label="حذف"><Icon d="trash" /></button>
          </div>
        </div>
      ))}
      <button type="button" className="in-secondary" onClick={() => onChange([...rows, make()])}><Icon d="plus" /> {addLabel}</button>
    </fieldset>
  );
}

const toDraft = (p) => ({ ...p, rationale: T(p.rationale), objectives: T(p.objectives), partners: T(p.partners), evaluation: T(p.evaluation), outputs: T(p.outputs), sustain: T(p.sustain), approvals: T(p.approvals), phases: p.phases.map((x) => ({ ...x, steps: T(x.steps) })) });
const fromDraft = (d) => normalizeInitiative({ ...d, rationale: L(d.rationale), objectives: L(d.objectives), partners: L(d.partners), evaluation: L(d.evaluation), outputs: L(d.outputs), sustain: L(d.sustain), approvals: L(d.approvals), phases: d.phases.map((x) => ({ ...x, steps: L(x.steps) })) }, 'mine');

export default function PlanEditor({ plan, onSave, onCancel }) {
  const [d, setD] = useState(() => toDraft(plan));
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const weeks = d.phases.reduce((s, p) => s + (Number(p.w) || 0), 0);
  const save = () => { const p = fromDraft(d); onSave({ ...p, weeks: weeks || p.weeks }); };
  return (
    <form className="in-editor" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="in-editor-bar">
        <h3><Icon d="edit" /> تعديل الخطة</h3>
        <span className="in-pill">المدة: {weeks || d.weeks} أسبوع</span>
        <span className="in-grow" />
        <button type="button" className="in-secondary" onClick={onCancel}>إلغاء</button>
        <button type="submit" className="in-primary"><Icon d="save" /> حفظ الخطة</button>
      </div>
      <fieldset className="in-fs"><legend>التعريف</legend>
        <Text label="اسم المبادرة" value={d.title} onChange={(v) => set('title', v)} max={160} />
        <Text label="العبارة التعريفية" value={d.slogan} onChange={(v) => set('slogan', v)} max={160} />
        <div className="in-grid3">
          <label className="in-field"><span>المجال</span><select className="in-input" value={d.domain} onChange={(e) => set('domain', e.target.value)}>{DOMAINS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          <label className="in-field"><span>القيادة</span><select className="in-input" value={d.lead} onChange={(e) => set('lead', e.target.value)}>{LEADS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          <label className="in-field"><span>الموارد</span><select className="in-input" value={d.cost} onChange={(e) => set('cost', e.target.value)}>{COSTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          <label className="in-field"><span>الحجم</span><select className="in-input" value={d.size} onChange={(e) => set('size', e.target.value)}>{SIZES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
        </div>
        <div className="in-field" role="group" aria-label="المراحل الدراسية"><span>المراحل الدراسية</span>
          <div className="in-tweaks">{STAGES.map((s) => { const on = d.stages.includes(s.id); return <button key={s.id} type="button" className={`in-chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => set('stages', on ? d.stages.filter((x) => x !== s.id) : [...d.stages, s.id])}>{s.label}</button>; })}</div>
        </div>
        <Text label="وصف المبادرة" value={d.summary} onChange={(v) => set('summary', v)} rows={3} max={1200} />
        <Text label="المشكلة أو الاحتياج" value={d.problem} onChange={(v) => set('problem', v)} rows={2} max={900} />
        <Lst label="المبررات" value={d.rationale} onChange={(v) => set('rationale', v)} />
        <Text label="الهدف العام" value={d.goal} onChange={(v) => set('goal', v)} rows={2} max={400} />
        <Lst label="الأهداف التفصيلية" value={d.objectives} onChange={(v) => set('objectives', v)} rows={4} />
        <div className="in-two is-tight">
          <Text label="الفئة المستهدفة" value={d.audience} onChange={(v) => set('audience', v)} max={300} />
          <Text label="المستفيدون المتوقعون" value={d.beneficiaries} onChange={(v) => set('beneficiaries', v)} max={300} />
        </div>
        <Text label="طريقة المشاركة (تظهر في بطاقة الإعلان)" value={d.join} onChange={(v) => set('join', v)} max={400} />
      </fieldset>

      <Rows title="مراحل التنفيذ" rows={d.phases} onChange={(v) => set('phases', v)} addLabel="إضافة مرحلة" make={() => ({ t: 'مرحلة جديدة', w: 1, by: '', steps: '' })}
        render={(r, up) => (<>
          <div className="in-grid3">
            <Text label="اسم المرحلة" value={r.t} onChange={(v) => up({ t: v })} max={140} />
            <label className="in-field"><span>الأسابيع</span><input className="in-input" type="number" min={1} max={40} value={r.w} onChange={(e) => up({ w: Math.max(1, Math.min(40, Number(e.target.value) || 1)) })} /></label>
            <Text label="المسؤول" value={r.by} onChange={(v) => up({ by: v })} max={140} />
          </div>
          <Lst label="الخطوات والأنشطة" value={r.steps} onChange={(v) => up({ steps: v })} />
        </>)} />

      <Rows title="فريق العمل" rows={d.team} onChange={(v) => set('team', v)} addLabel="إضافة دور" make={() => ({ r: 'دور جديد', name: '', tasks: '' })}
        render={(r, up) => (<div className="in-grid3"><Text label="الدور" value={r.r} onChange={(v) => up({ r: v })} max={120} /><Text label="الاسم" value={r.name || ''} onChange={(v) => up({ name: v })} max={120} /><Text label="المهام" value={r.tasks} onChange={(v) => up({ tasks: v })} max={300} /></div>)} />

      <Rows title="الموارد" rows={d.resources} onChange={(v) => set('resources', v)} addLabel="إضافة مورد" make={() => ({ i: '', c: 'free', alt: '' })}
        render={(r, up) => (<div className="in-grid3"><Text label="المورد" value={r.i} onChange={(v) => up({ i: v })} max={200} />
          <label className="in-field"><span>التكلفة</span><select className="in-input" value={r.c} onChange={(e) => up({ c: e.target.value })}><option value="free">بلا تكلفة</option><option value="low">منخفضة</option><option value="partner">تحتاج دعمًا/شراكة</option></select></label>
          <Text label="البديل البسيط" value={r.alt} onChange={(v) => up({ alt: v })} max={200} /></div>)} />

      <Rows title="مؤشرات الأداء" rows={d.kpis} onChange={(v) => set('kpis', v)} addLabel="إضافة مؤشر" make={() => ({ k: '', tool: '' })}
        render={(r, up) => (<div className="in-two is-tight"><Text label="المؤشر (قابل للقياس)" value={r.k} onChange={(v) => up({ k: v })} max={300} /><Text label="أداة القياس" value={r.tool} onChange={(v) => up({ tool: v })} max={200} /></div>)} />

      <fieldset className="in-fs"><legend>التقييم والاستدامة</legend>
        <Lst label="الشركاء المحتملون" value={d.partners} onChange={(v) => set('partners', v)} />
        <Lst label="أساليب التقييم" value={d.evaluation} onChange={(v) => set('evaluation', v)} />
        <Lst label="المخرجات المتوقعة" value={d.outputs} onChange={(v) => set('outputs', v)} />
        <Lst label="الاستدامة والتطوير" value={d.sustain} onChange={(v) => set('sustain', v)} />
        <Lst label="الموافقات والمتطلبات قبل التنفيذ" value={d.approvals} onChange={(v) => set('approvals', v)} />
      </fieldset>
      <div className="in-editor-bar is-bottom"><span className="in-grow" /><button type="button" className="in-secondary" onClick={onCancel}>إلغاء</button><button type="submit" className="in-primary"><Icon d="save" /> حفظ الخطة</button></div>
    </form>
  );
}
