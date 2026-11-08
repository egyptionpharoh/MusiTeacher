'use client';
// مساحة عمل المبادرة: الخطة، الجدول الزمني، الفريق، المؤشرات، المتابعة، التوثيق، الأدوات، وملف المبادرة.
import { useEffect, useState } from 'react';
import { DOMAIN, STATUSES, TWEAKS, weeksLabel } from '@/lib/initiatives/taxonomy';
import { normalizeProject, timelineOf, fmtDate, progressOf, syncTasks, surveyOf, newId } from '@/lib/initiatives/schema';
import { photos, shrinkImage } from '@/lib/initiatives/store';
import { Icon, EXTRA, DomainIcon, StatusPill, Progress, Section, Field } from './parts';
import { PlanBody } from './InitiativeDetail';
import PlanEditor from './PlanEditor';

const TABS = [
  { id: 'plan', label: 'الخطة', icon: 'book' },
  { id: 'timeline', label: 'الجدول الزمني', icon: EXTRA.gantt },
  { id: 'team', label: 'الفريق', icon: 'users' },
  { id: 'kpis', label: 'المؤشرات', icon: 'chart' },
  { id: 'track', label: 'المتابعة', icon: EXTRA.checkSquare },
  { id: 'log', label: 'التوثيق', icon: EXTRA.camera },
  { id: 'tools', label: 'الإعلان والاستبانة', icon: EXTRA.poster },
  { id: 'file', label: 'ملف المبادرة', icon: 'word' },
];

function Photo({ id, onDelete }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let a = true; photos.get(id).then((v) => { if (a && v) setSrc(v); }).catch(() => {}); return () => { a = false; }; }, [id]);
  return (
    <span className="in-photo">{src ? <img src={src} alt="صورة توثيق" /> : <span className="in-photo-missing">صورة على جهاز آخر</span>}
      {onDelete && <button type="button" onClick={() => onDelete(id)} aria-label="حذف الصورة"><Icon d="x" size={12} /></button>}</span>
  );
}

export default function Workspace({ project: p, tab, setTab, onChange, onDelete, onDuplicate, aiReady, busy, onRegen, onDevelop, onExport, notify }) {
  const d = DOMAIN[p.plan.domain] || {};
  const g = progressOf(p);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [tweaks, setTweaks] = useState([]);
  const [instr, setInstr] = useState('');
  const [entry, setEntry] = useState({ date: new Date().toISOString().slice(0, 10), activity: '', notes: '', results: '', photos: [] });
  const [newTask, setNewTask] = useState('');
  const upd = (patch) => onChange(normalizeProject({ ...p, ...patch, updatedAt: Date.now() }));
  const updPlan = (patch) => upd({ plan: { ...p.plan, ...patch } });
  const tl = timelineOf(p.plan.phases, p.meta.startDate);

  const doneSuggest = g.total > 0 && g.done === g.total && p.status !== 'done';

  const addPhoto = async (file, target) => {
    try {
      const url = await shrinkImage(file, { max: 1280, type: 'image/jpeg', quality: 0.8 });
      const id = newId('ph'); await photos.put(id, url);
      target(id);
    } catch (e) { notify('err', e && e.message === 'size' ? 'الصورة كبيرة جدًا (الحد 12 ميجابايت).' : 'تعذرت إضافة الصورة. استخدم صورة PNG أو JPG.'); }
  };
  const addLogo = async (file) => {
    try { const url = await shrinkImage(file, { max: 360, type: 'image/png' }); upd({ meta: { ...p.meta, logo: url } }); notify('ok', 'أُضيف شعار المدرسة.'); }
    catch { notify('err', 'تعذر قراءة الشعار. استخدم صورة PNG أو JPG.'); }
  };

  return (
    <div className="in-ws" style={{ '--c': d.color }}>
      <header className="in-panel in-ws-head">
        <div className="in-ws-title">
          <DomainIcon id={p.plan.domain} size={22} />
          <div><h2>{p.plan.title}</h2>{p.plan.slogan && <p>«{p.plan.slogan}»</p>}</div>
        </div>
        <div className="in-ws-meta">
          <label className="in-status-select"><span className="in-sr">حالة المبادرة</span>
            <select value={p.status} onChange={(e) => { upd({ status: e.target.value }); notify('ok', `الحالة الآن: ${STATUSES.find((s) => s.id === e.target.value).label}`); }} style={{ '--s': (STATUSES.find((s) => s.id === p.status) || {}).color }}>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <span className="in-ws-progress"><Progress pct={g.pct} /> {g.done}/{g.total} مهمة</span>
          <button type="button" className="in-icon" onClick={onDuplicate} title="نسخة جديدة للتعديل" aria-label="إنشاء نسخة"><Icon d={EXTRA.copyPlus} /></button>
          {confirmDel
            ? <span className="in-confirm">حذف نهائي؟ <button type="button" className="in-danger" onClick={onDelete}>نعم، احذف</button><button type="button" className="in-link" onClick={() => setConfirmDel(false)}>تراجع</button></span>
            : <button type="button" className="in-icon is-danger" onClick={() => setConfirmDel(true)} aria-label="حذف المبادرة"><Icon d="trash" /></button>}
        </div>
        {doneSuggest && <div className="in-suggest"><Icon d="check" /> أُنجزت كل المهام. <button type="button" className="in-link" onClick={() => upd({ status: 'done' })}>تحويل الحالة إلى «مكتملة»</button> ثم سجّل النتائج في تبويب التوثيق.</div>}
        {p.plan.brief && <div className="in-suggest is-warn"><Icon d="info" /> هذه فكرة مختصرة بلا خطة تنفيذية بعد. {aiReady ? 'طوّرها بالذكاء الاصطناعي من تبويب الخطة، أو' : ''} أضف المراحل والفريق والمؤشرات يدويًا عبر «تعديل الخطة».</div>}
        <nav className="in-ws-tabs" role="tablist" aria-label="أقسام المبادرة">
          {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => { setTab(t.id); setEditing(false); }}><Icon d={t.icon} size={16} /> {t.label}</button>)}
        </nav>
      </header>

      <div className="in-panel in-ws-body" role="tabpanel">
        {/* ------------------------------------------------ الخطة */}
        {tab === 'plan' && (editing
          ? <PlanEditor plan={p.plan} onCancel={() => setEditing(false)} onSave={(plan) => { upd({ plan, tasks: syncTasks(p.tasks, plan.phases), status: p.status === 'idea' && plan.phases.length ? 'planning' : p.status }); setEditing(false); notify('ok', 'حُفظت الخطة وحُدّثت قائمة المتابعة.'); }} />
          : <>
            <div className="in-toolbar">
              <button type="button" className="in-primary" onClick={() => setEditing(true)}><Icon d="edit" /> تعديل الخطة</button>
              <button type="button" className={`in-secondary ${devOpen ? 'is-on' : ''}`} onClick={() => setDevOpen((v) => !v)} disabled={!aiReady || !!busy}><Icon d="wand" /> {p.plan.brief ? 'طوّر إلى خطة كاملة' : 'طوّر المبادرة'}</button>
              {!aiReady && aiReady !== null && <span className="in-fine">التطوير بالذكاء الاصطناعي غير مفعّل؛ التعديل اليدوي متاح.</span>}
            </div>
            {devOpen && aiReady && (
              <form className="in-develop is-inline" onSubmit={(e) => { e.preventDefault(); onDevelop(tweaks, instr.trim()); setDevOpen(false); }}>
                <div className="in-tweaks">{TWEAKS.map((t) => <button key={t} type="button" className={`in-chip ${tweaks.includes(t) ? 'is-on' : ''}`} aria-pressed={tweaks.includes(t)} onClick={() => setTweaks((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]))}>{t}</button>)}</div>
                <textarea className="in-input" rows={2} maxLength={400} value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="تعديل آخر بكلماتك (اختياري)" aria-label="تعديل إضافي" />
                <p className="in-fine">تُستبدل الخطة الحالية بالخطة المطوَّرة، ويبقى سجل التوثيق وبيانات الملف كما هي، وتُحفظ إنجازات قائمة المتابعة للخطوات المتطابقة.</p>
                <button type="submit" className="in-primary" disabled={!!busy}><Icon d={EXTRA.rocket} /> طوّر الخطة</button>
              </form>
            )}
            <PlanBody plan={p.plan} startDate={p.meta.startDate} aiReady={aiReady} regenBusy={busy && busy.startsWith('section:') ? busy.slice(8) : ''} onRegen={(k) => onRegen(k)} />
          </>)}

        {/* ------------------------------------------------ الجدول الزمني */}
        {tab === 'timeline' && (
          <Section title="مولّد الجدول الزمني" icon="gantt">
            <div className="in-two is-tight">
              <Field label="تاريخ بدء المبادرة" hint="تُحسب كل مرحلة بأسابيع دراسية (الأحد - الخميس)."><input className="in-input" type="date" value={p.meta.startDate} onChange={(e) => upd({ meta: { ...p.meta, startDate: e.target.value } })} /></Field>
              <div className="in-field"><span>المدة الكلية</span><strong className="in-big">{weeksLabel(p.plan.phases.reduce((s, x) => s + x.w, 0) || p.plan.weeks)}</strong></div>
            </div>
            {tl.length ? (
              <table className="in-table"><thead><tr><th>#</th><th>المرحلة</th><th>المدة</th><th>البداية</th><th>النهاية</th><th>المسؤول</th></tr></thead>
                <tbody>{tl.map((r) => <tr key={r.i}><td>{r.i + 1}</td><td>{r.title}</td><td>{weeksLabel(r.weeks)}</td><td>{r.from ? fmtDate(r.from) : `الأسبوع ${r.fromWeek}`}</td><td>{r.to ? fmtDate(r.to) : `الأسبوع ${r.toWeek}`}</td><td>{r.by}</td></tr>)}</tbody></table>
            ) : <p className="in-muted">لا توجد مراحل بعد. أضفها من «تعديل الخطة».</p>}
            <p className="in-fine">لتغيير مدة مرحلة أو ترتيبها: تبويب الخطة ← تعديل الخطة. تُراعى الإجازات الرسمية يدويًا عند الحاجة.</p>
          </Section>
        )}

        {/* ------------------------------------------------ الفريق */}
        {tab === 'team' && (
          <Section title="مولّد فريق العمل" icon="users">
            <p className="in-fine">الأدوار مقترحة حسب طبيعة المبادرة. اكتب أسماء الأعضاء وعدّل المهام كما تشاء.</p>
            <div className="in-team-edit">{p.plan.team.map((t, i) => (
              <div key={i} className="in-team-row">
                <strong>{t.r}</strong>
                <input className="in-input" placeholder="اسم العضو أو الأعضاء" value={t.name || ''} maxLength={120} onChange={(e) => updPlan({ team: p.plan.team.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} aria-label={`اسم ${t.r}`} />
                <textarea className="in-input" rows={2} value={t.tasks} maxLength={300} onChange={(e) => updPlan({ team: p.plan.team.map((x, j) => (j === i ? { ...x, tasks: e.target.value } : x)) })} aria-label={`مهام ${t.r}`} />
              </div>
            ))}</div>
            <button type="button" className="in-secondary" onClick={() => updPlan({ team: [...p.plan.team, { r: 'دور جديد', name: '', tasks: '' }] })}><Icon d="plus" /> إضافة دور</button>
            {aiReady && <button type="button" className="in-mini" onClick={() => onRegen('team')} disabled={!!busy}><Icon d="refresh" size={13} /> اقترح توزيعًا آخر للأدوار</button>}
          </Section>
        )}

        {/* ------------------------------------------------ المؤشرات */}
        {tab === 'kpis' && (
          <Section title="مؤشرات الأداء: القياس القبلي والمستهدف والنتيجة" icon="chart">
            <p className="in-fine">سجّل القياس القبلي أولًا، ثم حدّد المستهدف بنفسك بما يناسب واقع مدرستك، وسجّل النتيجة بعد التنفيذ.</p>
            <div className="in-kpis">{p.plan.kpis.map((k, i) => (
              <div key={i} className="in-kpi">
                <div><strong>{k.k}</strong><small>أداة القياس: {k.tool || '—'}</small></div>
                {['base', 'target', 'result'].map((f) => (
                  <label key={f} className="in-field"><span>{f === 'base' ? 'القياس القبلي' : f === 'target' ? 'المستهدف' : 'النتيجة'}</span>
                    <input className="in-input" value={k[f] || ''} maxLength={120} onChange={(e) => updPlan({ kpis: p.plan.kpis.map((x, j) => (j === i ? { ...x, [f]: e.target.value } : x)) })} /></label>
                ))}
              </div>
            ))}</div>
            {aiReady && <button type="button" className="in-mini" onClick={() => onRegen('kpis')} disabled={!!busy}><Icon d="refresh" size={13} /> اقترح مؤشرات أخرى قابلة للقياس</button>}
          </Section>
        )}

        {/* ------------------------------------------------ المتابعة */}
        {tab === 'track' && (
          <Section title="قائمة متابعة التنفيذ" icon="checkSquare" actions={<span className="in-ws-progress"><Progress pct={g.pct} /> {g.pct}%</span>}>
            {p.plan.phases.map((ph, pi) => {
              const items = p.tasks.filter((t) => t.phase === pi);
              if (!items.length) return null;
              return (
                <div key={pi} className="in-check-group">
                  <h4>{pi + 1}. {ph.t} {tl[pi] && tl[pi].from ? <small>({fmtDate(tl[pi].from)} - {fmtDate(tl[pi].to)})</small> : null}</h4>
                  {items.map((t) => (
                    <label key={t.id} className={`in-check ${t.done ? 'is-done' : ''}`}>
                      <input type="checkbox" checked={t.done} onChange={(e) => upd({ tasks: p.tasks.map((x) => (x.id === t.id ? { ...x, done: e.target.checked, doneAt: e.target.checked ? Date.now() : 0 } : x)), status: e.target.checked && (p.status === 'planning' || p.status === 'ready' || p.status === 'idea') ? 'active' : p.status })} />
                      <span>{t.text}</span>{t.done && t.doneAt ? <small>{new Date(t.doneAt).toLocaleDateString('ar-OM-u-nu-latn')}</small> : null}
                    </label>
                  ))}
                </div>
              );
            })}
            {p.tasks.filter((t) => t.phase >= p.plan.phases.length).length > 0 && (
              <div className="in-check-group"><h4>مهام إضافية</h4>{p.tasks.filter((t) => t.phase >= p.plan.phases.length).map((t) => (
                <label key={t.id} className={`in-check ${t.done ? 'is-done' : ''}`}><input type="checkbox" checked={t.done} onChange={(e) => upd({ tasks: p.tasks.map((x) => (x.id === t.id ? { ...x, done: e.target.checked, doneAt: e.target.checked ? Date.now() : 0 } : x)) })} /><span>{t.text}</span>
                  <button type="button" className="in-x" onClick={() => upd({ tasks: p.tasks.filter((x) => x.id !== t.id) })} aria-label="حذف المهمة"><Icon d="x" size={14} /></button></label>
              ))}</div>
            )}
            <form className="in-add" onSubmit={(e) => { e.preventDefault(); if (!newTask.trim()) return; upd({ tasks: [...p.tasks, { id: newId('t'), phase: 99, text: newTask.trim(), done: false, doneAt: 0 }] }); setNewTask(''); }}>
              <input className="in-input" value={newTask} maxLength={300} onChange={(e) => setNewTask(e.target.value)} placeholder="أضف مهمة إضافية…" aria-label="مهمة إضافية" />
              <button type="submit" className="in-secondary"><Icon d="plus" /> إضافة</button>
            </form>
            {!p.tasks.length && <p className="in-muted">لا توجد مهام بعد: أضف مراحل وخطوات للخطة أولًا.</p>}
            <button type="button" className="in-link" onClick={() => { upd({ tasks: syncTasks(p.tasks, p.plan.phases) }); notify('ok', 'حُدّثت القائمة من خطوات الخطة.'); }}>تحديث القائمة من خطوات الخطة</button>
          </Section>
        )}

        {/* ------------------------------------------------ التوثيق */}
        {tab === 'log' && (<>
          <Section title="سجل الإنجاز والتوثيق" icon="camera">
            <form className="in-log-form" onSubmit={(e) => { e.preventDefault(); if (!entry.activity.trim()) { notify('err', 'اكتب اسم النشاط أولًا.'); return; } upd({ log: [{ ...entry, id: newId('l') }, ...p.log] }); setEntry({ date: entry.date, activity: '', notes: '', results: '', photos: [] }); notify('ok', 'أُضيف النشاط إلى السجل.'); }}>
              <div className="in-grid3">
                <Field label="التاريخ"><input className="in-input" type="date" value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })} /></Field>
                <Field label="النشاط المنفذ"><input className="in-input" value={entry.activity} maxLength={200} onChange={(e) => setEntry({ ...entry, activity: e.target.value })} placeholder="مثال: إطلاق المبادرة في الطابور" /></Field>
                <Field label="النتائج"><input className="in-input" value={entry.results} maxLength={800} onChange={(e) => setEntry({ ...entry, results: e.target.value })} placeholder="ما الذي تحقق؟" /></Field>
              </div>
              <Field label="الملاحظات"><textarea className="in-input" rows={2} value={entry.notes} maxLength={1500} onChange={(e) => setEntry({ ...entry, notes: e.target.value })} /></Field>
              <div className="in-photos">
                {entry.photos.map((id) => <Photo key={id} id={id} onDelete={(x) => { photos.del(x).catch(() => {}); setEntry((en) => ({ ...en, photos: en.photos.filter((y) => y !== x) })); }} />)}
                {entry.photos.length < 6 && <label className="in-upload"><Icon d={EXTRA.camera} /> إضافة صورة<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) addPhoto(f, (id) => setEntry((en) => ({ ...en, photos: [...en.photos, id] }))); }} /></label>}
              </div>
              <p className="in-fine">الصور تُحفظ على هذا الجهاز فقط (لا تُرفع إلى أي خادم). التزم بضوابط المدرسة في تصوير الطلبة.</p>
              <button type="submit" className="in-primary"><Icon d="plus" /> تسجيل النشاط</button>
            </form>
            <ol className="in-log">{p.log.map((e) => (
              <li key={e.id}>
                <div className="in-log-head"><strong>{e.activity}</strong><span>{e.date ? fmtDate(e.date) : ''}</span>
                  <button type="button" className="in-x" onClick={() => { e.photos.forEach((x) => photos.del(x).catch(() => {})); upd({ log: p.log.filter((x) => x.id !== e.id) }); }} aria-label="حذف من السجل"><Icon d="trash" size={14} /></button></div>
                {e.notes && <p>{e.notes}</p>}{e.results && <p className="in-goal">النتيجة: {e.results}</p>}
                {e.photos.length > 0 && <div className="in-photos">{e.photos.map((id) => <Photo key={id} id={id} />)}</div>}
              </li>
            ))}</ol>
          </Section>
          <Section title="نتائج المبادرة بعد الانتهاء" icon="star">
            <Field label="ملخص النتائج"><textarea className="in-input" rows={3} maxLength={2000} value={p.results.summary} onChange={(e) => upd({ results: { ...p.results, summary: e.target.value } })} placeholder="ماذا تحقق؟ قارن القياس القبلي بالبعدي من تبويب المؤشرات." /></Field>
            <Field label="الدروس المستفادة ومقترحات التطوير"><textarea className="in-input" rows={2} maxLength={1500} value={p.results.lessons} onChange={(e) => upd({ results: { ...p.results, lessons: e.target.value } })} /></Field>
            <Field label="ملاحظات عامة"><textarea className="in-input" rows={2} maxLength={3000} value={p.notes} onChange={(e) => upd({ notes: e.target.value })} /></Field>
          </Section>
        </>)}

        {/* ------------------------------------------------ الإعلان والاستبانة */}
        {tab === 'tools' && (
          <div className="in-two">
            <Section title="بطاقة التعريف بالمبادرة" icon="poster">
              <div className="in-poster-mini" style={{ '--c': d.color }}>
                <span>مبادرة {p.meta.school || 'مدرسية'}</span><strong>{p.plan.title}</strong>{p.plan.slogan && <em>{p.plan.slogan}</em>}
                <ul>{p.plan.objectives.slice(0, 3).map((o, i) => <li key={i}>{o}</li>)}</ul>{p.plan.join && <b>كيف تشارك؟ {p.plan.join}</b>}
              </div>
              <p className="in-fine">تستخدم اسم المبادرة وعبارتها وأهدافها وطريقة المشاركة وتاريخ البدء. عدّلها من الخطة ثم اطبع.</p>
              <button type="button" className="in-primary" onClick={() => onExport('poster')} disabled={!!busy}><Icon d="print" /> طباعة البطاقة / PDF</button>
            </Section>
            <Section title="نموذج قياس الأثر" icon="survey">
              {(() => { const s = surveyOf(p.plan); return (<>
                <p className="in-fine">{s.intro} (مقياس: {s.scale.join(' / ')})</p>
                <ol>{s.items.map((x, i) => <li key={i}>{x}</li>)}</ol><ul>{s.open.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </>); })()}
              <button type="button" className="in-primary" onClick={() => onExport('survey')} disabled={!!busy}><Icon d="print" /> طباعة الاستبانة / PDF</button>
              <p className="in-fine">الاستبانة بلا أسماء، ويمكن تعديل بنودها في ملف Word.</p>
            </Section>
          </div>
        )}

        {/* ------------------------------------------------ ملف المبادرة */}
        {tab === 'file' && (
          <div className="in-file">
            <Section title="بيانات الغلاف" icon="word">
              <div className="in-two is-tight">
                <Field label="اسم المدرسة"><input className="in-input" maxLength={160} value={p.meta.school} onChange={(e) => upd({ meta: { ...p.meta, school: e.target.value } })} /></Field>
                <Field label="مقدم المبادرة أو الفريق"><input className="in-input" maxLength={200} value={p.meta.presenter} onChange={(e) => upd({ meta: { ...p.meta, presenter: e.target.value } })} /></Field>
                <Field label="العام الدراسي"><input className="in-input" maxLength={40} value={p.meta.year} onChange={(e) => upd({ meta: { ...p.meta, year: e.target.value } })} /></Field>
                <Field label="تاريخ البدء"><input className="in-input" type="date" value={p.meta.startDate} onChange={(e) => upd({ meta: { ...p.meta, startDate: e.target.value } })} /></Field>
              </div>
              <div className="in-logo">
                {p.meta.logo ? <img src={p.meta.logo} alt="شعار المدرسة" /> : <span className="in-logo-empty">لا يوجد شعار</span>}
                <label className="in-upload"><Icon d={EXTRA.upload} /> {p.meta.logo ? 'تغيير شعار المدرسة' : 'رفع شعار المدرسة'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) addLogo(f); }} /></label>
                {p.meta.logo && <button type="button" className="in-link" onClick={() => upd({ meta: { ...p.meta, logo: '' } })}>إزالة الشعار</button>}
              </div>
              <p className="in-fine">يبقى الشعار على هذا الجهاز ولا يُرفع للمزامنة.</p>
            </Section>
            <Section title="محتوى الملف" icon="layers">
              <ol className="in-file-parts">
                <li><b>أ.</b> الغلاف: الاسم، المدرسة، المقدم، العام، المجال، الشعار</li>
                <li><b>ب.</b> التعريف: الخلفية، المشكلة، المبررات، الأهداف، الفئة المستهدفة</li>
                <li><b>ج.</b> خطة التنفيذ: المراحل والأنشطة، الجدول الزمني، المسؤوليات، الموارد، الشركاء، الموافقات</li>
                <li><b>د.</b> المتابعة والتقييم: المؤشرات، أدوات القياس، آلية التوثيق{p.log.length ? '، سجل الإنجاز' : ''}{p.results.summary ? '، النتائج' : ''}</li>
                <li><b>هـ.</b> الاستدامة: الاستمرار والتطوير والتعميم</li>
                <li><b>ملاحق:</b> قائمة المتابعة، نموذج قياس الأثر، سجل التوثيق</li>
              </ol>
              <p className="in-fine">لتعديل أي جزء قبل التصدير: تبويب الخطة ← تعديل الخطة، أو تبويبات الفريق والمؤشرات والتوثيق.</p>
              <div className="in-export">
                <button type="button" className="in-primary is-big" onClick={() => onExport('docx')} disabled={!!busy}>{busy === 'export:docx' ? <span className="in-spin" /> : <Icon d="word" />} تنزيل ملف Word قابل للتعديل</button>
                <button type="button" className="in-secondary is-big" onClick={() => onExport('print')} disabled={!!busy}><Icon d="print" /> طباعة / حفظ PDF</button>
                <button type="button" className="in-secondary is-big" onClick={() => onExport('copy')} disabled={!!busy}><Icon d="copy" /> نسخ المحتوى نصًا</button>
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
