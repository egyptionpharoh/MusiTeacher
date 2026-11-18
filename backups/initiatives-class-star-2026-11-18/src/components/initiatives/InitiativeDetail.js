'use client';
// بطاقة المبادرة التفصيلية (من المكتبة أو مولدة) + لوحة «طوّر المبادرة».
import { useState } from 'react';
import { DOMAIN, LEADS, COSTS, SIZES, STAGES, TWEAKS, label, weeksLabel } from '@/lib/initiatives/taxonomy';
import { timelineOf } from '@/lib/initiatives/schema';
import { COST_SHORT } from '@/lib/initiatives/export-html';
import { Icon, EXTRA, DomainIcon, CostTag, Section, List } from './parts';

export function PlanBody({ plan, startDate, onRegen, regenBusy, aiReady }) {
  const tl = timelineOf(plan.phases, startDate);
  const total = plan.phases.reduce((s, p) => s + p.w, 0) || 1;
  const R = (key) => (onRegen && aiReady ? (
    <button type="button" className="in-mini" onClick={() => onRegen(key)} disabled={!!regenBusy}>
      {regenBusy === key ? <span className="in-spin is-sm" /> : <Icon d="refresh" size={13} />} أعد الصياغة
    </button>
  ) : null);
  return (
    <>
      <Section title="وصف المبادرة" icon="book"><p>{plan.summary}</p></Section>
      <div className="in-two">
        <Section title="المشكلة أو الاحتياج" icon="target" accent><p>{plan.problem || '—'}</p></Section>
        <Section title="مبررات اختيارها" icon="bulb"><List items={plan.rationale} /></Section>
      </div>
      <Section title="الأهداف" icon="flag" actions={R('objectives')}>
        <p className="in-goal"><strong>الهدف العام:</strong> {plan.goal}</p>
        <List items={plan.objectives} ordered />
      </Section>
      {plan.brief ? (
        <div className="in-brief-note"><Icon d="info" /> هذه فكرة مختصرة. اضغط «طوّر المبادرة» لتحويلها إلى خطة تنفيذية كاملة (الفريق، المراحل، الجدول، المؤشرات...).</div>
      ) : (
        <>
          <Section title="خطوات التنفيذ" icon="checkSquare" actions={R('phases')}>
            <ol className="in-phases">{plan.phases.map((ph, i) => (
              <li key={i}><div className="in-phase-head"><strong>{ph.t}</strong><span className="in-pill">{weeksLabel(ph.w)}</span>{ph.by && <span className="in-by">المسؤول: {ph.by}</span>}</div><List items={ph.steps} /></li>
            ))}</ol>
          </Section>
          <Section title="الجدول الزمني" icon="gantt">
            <div className="in-gantt">{tl.map((r) => (
              <div key={r.i} className="in-gantt-row">
                <span className="in-gantt-t">{r.title}</span>
                <span className="in-gantt-track"><span className="in-gantt-bar" style={{ insetInlineStart: `${((r.fromWeek - 1) / total) * 100}%`, width: `${(r.weeks / total) * 100}%` }} /></span>
                <span className="in-gantt-w">{r.from ? <bdi dir="ltr">{`${r.from.slice(8)}/${r.from.slice(5, 7)} - ${r.to.slice(8)}/${r.to.slice(5, 7)}`}</bdi> : `أسبوع ${r.fromWeek}${r.toWeek > r.fromWeek ? `-${r.toWeek}` : ''}`}</span>
              </div>
            ))}</div>
          </Section>
          <div className="in-two">
            <Section title="فريق العمل والمسؤوليات" icon="users" actions={R('team')}>
              <ul className="in-team">{plan.team.map((t, i) => <li key={i}><strong>{t.r}{t.name ? ` — ${t.name}` : ''}</strong><span>{t.tasks}</span></li>)}</ul>
            </Section>
            <Section title="الموارد والأدوات" icon="tools" actions={R('resources')}>
              <ul className="in-res">{plan.resources.map((r, i) => <li key={i}><span>{r.i}</span><span className={`in-cost is-${r.c}`}>{COST_SHORT[r.c]}</span>{r.alt && <small>بديل: {r.alt}</small>}</li>)}</ul>
              {plan.partners.length > 0 && <><h4>الشركاء المحتملون</h4><List items={plan.partners} /><p className="in-fine">الشراكات مقترحة وتتطلب التنسيق وموافقة الإدارة.</p></>}
            </Section>
          </div>
          <Section title="مؤشرات الأداء والنجاح" icon="chart" actions={R('kpis')}>
            <table className="in-table"><thead><tr><th>المؤشر</th><th>أداة القياس</th></tr></thead><tbody>{plan.kpis.map((k, i) => <tr key={i}><td>{k.k}</td><td>{k.tool}</td></tr>)}</tbody></table>
            <p className="in-fine">لا نضع نسبًا مستهدفة جاهزة: يحددها الفريق بعد القياس القبلي.</p>
            {plan.evaluation.length > 0 && <><h4>أساليب التقييم</h4><List items={plan.evaluation} /></>}
          </Section>
          <div className="in-two">
            <Section title="النتائج والمخرجات المتوقعة" icon="star" actions={R('sustain')}><List items={plan.outputs} /></Section>
            <Section title="الاستدامة والتطوير" icon="leaf"><List items={plan.sustain} /></Section>
          </div>
          {plan.approvals.length > 0 && <Section title="قبل التنفيذ: الموافقات والمتطلبات" icon="info" accent><List items={plan.approvals} /></Section>}
        </>
      )}
    </>
  );
}

export default function InitiativeDetail({ item, fav, onFav, onBack, onAdopt, onDevelop, aiReady, busy, list, onOpen }) {
  const d = DOMAIN[item.domain] || {};
  const [devOpen, setDevOpen] = useState(false);
  const [tweaks, setTweaks] = useState([]);
  const [instr, setInstr] = useState('');
  const idx = list ? list.findIndex((x) => x.id === item.id) : -1;
  const step = (n) => { if (!list || list.length < 2) return; const j = ((idx < 0 ? 0 : idx) + n + list.length) % list.length; onOpen(list[j].id); };
  const toggle = (t) => setTweaks((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));
  return (
    <div className="in-detail" style={{ '--c': d.color }}>
      <article className="in-panel in-detail-main">
        <div className="in-detail-nav">
          {onBack && <button type="button" className="in-icon" onClick={onBack} aria-label="رجوع"><Icon d="back" /></button>}
          <span className="in-detail-domain"><DomainIcon id={item.domain} />{d.label}{item.topic ? ` · ${item.topic}` : ''}</span>
          {list && list.length > 1 && <>
            <button type="button" className="in-icon" onClick={() => step(-1)} aria-label="المبادرة السابقة"><Icon d="next" /></button>
            <button type="button" className="in-icon" onClick={() => step(1)} aria-label="المبادرة التالية"><Icon d="prev" /></button>
          </>}
          {onFav && <button type="button" className={`in-fav is-inline ${fav ? 'is-on' : ''}`} onClick={() => onFav(item.id)} aria-pressed={!!fav} aria-label="حفظ"><Icon d="heart" fill={fav ? 'currentColor' : 'none'} /></button>}
        </div>
        <span className={`in-source is-${item.source}`}>{item.source === 'ai' ? <><Icon d="spark" size={14} /> مقترحة بالذكاء الاصطناعي — راجعها قبل الاعتماد</> : <><Icon d="book" size={14} /> من مكتبة MusiTeacher المنتقاة</>}</span>
        <h2 className="in-title">{item.title}</h2>
        {item.slogan && <p className="in-slogan">«{item.slogan}»</p>}
        {item.why && <p className="in-why"><Icon d={EXTRA.bulb} size={16} /> {item.why}</p>}
        <div className="in-facts">
          <div><span>الفئة المستهدفة</span><strong>{item.audience || '—'}</strong></div>
          <div><span>المستفيدون المتوقعون</span><strong>{item.beneficiaries || '—'}</strong></div>
          <div><span>مدة التنفيذ</span><strong>{weeksLabel(item.weeks)}</strong></div>
          <div><span>القيادة والحجم</span><strong>{label(LEADS, item.lead)} · {label(SIZES, item.size)}</strong></div>
          <div><span>الموارد</span><strong><CostTag cost={item.cost} /> {label(COSTS, item.cost)}</strong></div>
          <div><span>المراحل الدراسية</span><strong>{item.stages.map((s) => label(STAGES, s)).join('، ')}</strong></div>
        </div>
        <PlanBody plan={item} />
        {item.join && <div className="in-join"><Icon d="users" /> <strong>طريقة المشاركة:</strong> {item.join}</div>}
      </article>

      <aside className="in-panel in-actions" aria-label="إجراءات المبادرة">
        <h2><Icon d={EXTRA.rocket} /> من الفكرة إلى التنفيذ</h2>
        <button type="button" className="in-primary is-big" onClick={() => onAdopt(item)} disabled={!!busy}><Icon d={EXTRA.copyPlus} /> {item.brief ? 'احفظها في مبادراتي كفكرة' : 'أضفها إلى مبادراتي وابدأ التخطيط'}</button>
        <button type="button" className={`in-secondary is-big ${devOpen ? 'is-on' : ''}`} onClick={() => setDevOpen((v) => !v)} disabled={!aiReady || !!busy} aria-expanded={devOpen}>
          <Icon d="wand" /> طوّر المبادرة
        </button>
        {!aiReady && <p className="in-fine">{aiReady === false ? 'التطوير بالذكاء الاصطناعي غير مفعّل على الخادم حاليًا. يمكنك إضافة المبادرة إلى مبادراتك وتعديل خطتها يدويًا.' : 'جارٍ التحقق من توفر الذكاء الاصطناعي…'}</p>}
        {devOpen && aiReady && (
          <form className="in-develop" onSubmit={(e) => { e.preventDefault(); onDevelop(item, { tweaks, instruction: instr.trim() }); }}>
            <p className="in-fine">{item.brief ? 'يحوّل الذكاء الاصطناعي الفكرة إلى خطة تنفيذية متكاملة.' : 'يعيد الذكاء الاصطناعي بناء الخطة وفق تعديلاتك.'} اختر ما يناسبك (اختياري):</p>
            <div className="in-tweaks">{TWEAKS.map((t) => (
              <button key={t} type="button" className={`in-chip ${tweaks.includes(t) ? 'is-on' : ''}`} aria-pressed={tweaks.includes(t)} onClick={() => toggle(t)}>{t}</button>
            ))}</div>
            <textarea className="in-input" rows={2} maxLength={400} value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="تعديل آخر بكلماتك… مثل: أريدها لطلبة الصف السادس خلال أسبوعين" aria-label="تعديل إضافي" />
            <button type="submit" className="in-primary is-big" disabled={!!busy}>{busy === 'develop' ? <span className="in-spin" /> : <Icon d={EXTRA.rocket} />} طوّر وأضف إلى مبادراتي</button>
          </form>
        )}
        <div className="in-steps-hint">
          <span><b>1</b> أضفها إلى مبادراتك</span><span><b>2</b> عدّل الخطة والجدول والفريق</span><span><b>3</b> أعدّ ملف المبادرة وصدّره</span>
        </div>
      </aside>
    </div>
  );
}
