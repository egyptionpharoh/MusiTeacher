'use client';
// 🗓️ إنشاء الجدول وإدارته: بيانات المعلم والمدرسة، أيام العمل، توقيت الحصص والفسح، الجدول الأسبوعي، والجداول المتعددة.
import { useState } from 'react';
import { Icon, Modal, Field, Toggle, Seg } from './parts';
import PlanEditor from './PlanEditor';
import { DAY_NAMES, TIMEZONES, fmtTime, parseHHMM, toHHMM, isDateKey } from '../core/time.js';
import { ORDINALS, generatePeriods, uid, classLabel } from '../core/model.js';
import { shortClass } from '../core/sheet.js';
import { logoDataUrl } from './files';

const GRADES = ['الصف الأول', 'الصف الثاني', 'الصف الثالث', 'الصف الرابع', 'الصف الخامس', 'الصف السادس', 'الصف السابع', 'الصف الثامن', 'الصف التاسع', 'الصف العاشر', 'الصف الحادي عشر', 'الصف الثاني عشر'];
const SEMESTERS = ['الأول', 'الثاني', 'الصيفي'];

/** شبكة الجدول الأسبوعي (تستخدم أيضًا في مراجعة الجدول المستورد) */
export function WeekGrid({ data, subject, onCell, h24, dayTimes }) {
  const days = data.days.length ? data.days : [0, 1, 2, 3, 4];
  return (
    <div className="ca-grid-wrap" role="region" aria-label="الجدول الأسبوعي" tabIndex={0}>
      <table className="ca-wgrid">
        <thead><tr><th className="ca-wg-corner">الحصة</th>{days.map((d) => <th key={d}>{DAY_NAMES[d]}</th>)}</tr></thead>
        <tbody>
          {data.periods.map((p) => p.kind === 'break' ? (
            <tr key={p.id} className="ca-wg-break"><th>{p.name || 'استراحة'}<small>{p.start ? `${fmtTime(p.start, h24)} – ${fmtTime(p.end, h24)}` : ''}</small></th><td colSpan={days.length}>{p.name || 'استراحة'}</td></tr>
          ) : (
            <tr key={p.id}>
              <th className={p.uncertain ? 'is-unsure' : ''}><b>{p.label}</b><small>{p.start ? `${fmtTime(p.start, h24)} – ${fmtTime(p.end, h24)}` : 'بلا توقيت'}</small></th>
              {days.map((d) => {
                const l = (data.lessons[d] || {})[p.id];
                const own = dayTimes && dayTimes[d] && dayTimes[d][p.id];
                return (
                  <td key={d}>
                    <button type="button" className={`ca-cell${l ? ' is-on' : ''}${l && l.uncertain ? ' is-unsure' : ''}`} onClick={() => onCell(d, p)} aria-label={`${DAY_NAMES[d]} – الحصة ${p.label}: ${l ? classLabel(l) || l.subject : 'فارغة'}`}>
                      {l ? <><strong>{shortClass(l) || l.subject || 'حصة'}</strong>{l.subject && l.subject !== subject && shortClass(l) && <span>{l.subject}</span>}{l.room && <span className="ca-muted">{l.room}</span>}{(l.note || l.plan || l.muted) && <span className="ca-cell-icons">{l.note && <Icon n="note" size={12} />}{l.plan && <Icon n="bell" size={12} />}{l.muted && <Icon n="bellOff" size={12} />}</span>}</> : <span className="ca-cell-plus"><Icon n="plus" size={16} /></span>}
                      {own && <i className="ca-own">{fmtTime(own.start, h24)}</i>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ScheduleView({ profile, store, settings, onProfile, onStore, onImport, tones, onPreview, notify }) {
  const [cell, setCell] = useState(null);
  const [gen, setGen] = useState(false);
  const [timesDay, setTimesDay] = useState('all');
  const [manage, setManage] = useState(false);
  const h24 = settings.h24;
  const set = (k) => (e) => onProfile((p) => ({ ...p, [k]: e.target.value }));
  const lessonsCount = Object.values(profile.lessons).reduce((a, r) => a + Object.keys(r).length, 0);

  const toggleDay = (d) => onProfile((p) => ({ ...p, days: p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d].sort((a, b) => a - b) }));
  const setPeriod = (id, patch) => onProfile((p) => ({ ...p, periods: p.periods.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const setDayTime = (d, id, k, v) => onProfile((p) => {
    const dt = JSON.parse(JSON.stringify(p.dayTimes || {}));
    const base = p.periods.find((x) => x.id === id);
    const cur = (dt[d] && dt[d][id]) || { start: base.start, end: base.end };
    const next = { ...cur, [k]: v };
    if (!v || (next.start === base.start && next.end === base.end)) { if (dt[d]) delete dt[d][id]; } else (dt[d] ||= {})[id] = next;
    return { ...p, dayTimes: dt };
  });
  const addPeriod = (kind) => onProfile((p) => {
    const last = [...p.periods].reverse().find((x) => x.end);
    const startM = last ? parseHHMM(last.end) : 450;
    const n = p.periods.filter((x) => x.kind === 'lesson').length + 1;
    let id = kind === 'break' ? uid('b') : `p${n}`; while (p.periods.some((x) => x.id === id)) id = uid('p');
    const len = kind === 'break' ? 20 : 40;
    return { ...p, periods: [...p.periods, { id, kind, no: kind === 'lesson' ? n : 0, label: kind === 'lesson' ? ORDINALS[n - 1] || String(n) : '', name: kind === 'break' ? 'الفسحة' : '', start: toHHMM(startM), end: toHHMM(startM + len) }] };
  });
  const removePeriod = (id) => {
    const used = Object.values(profile.lessons).some((r) => r[id]);
    if (used && !window.confirm('هذه الحصة مستخدمة في الجدول. حذفها سيحذف الحصص المسجلة فيها من كل الأيام. متابعة؟')) return;
    onProfile((p) => {
      const lessons = {}; for (const [d, r] of Object.entries(p.lessons)) { const { [id]: _, ...rest } = r; lessons[d] = rest; }
      return { ...p, periods: p.periods.filter((x) => x.id !== id), lessons };
    });
  };
  const timeIssues = profile.periods.filter((p) => !p.start || !p.end || parseHHMM(p.end) <= parseHHMM(p.start));
  const overlaps = profile.periods.filter((p, i) => i > 0 && p.start && profile.periods[i - 1].end && parseHHMM(p.start) < parseHHMM(profile.periods[i - 1].end));

  return (
    <div className="ca-stack">
      <section className="ca-card">
        <div className="ca-card-head">
          <div><h3>{profile.name}</h3><p className="ca-muted">{lessonsCount} حصة في الأسبوع • {store.profiles.length > 1 ? `${store.profiles.length} جداول محفوظة` : 'جدول واحد محفوظ'}</p></div>
          <div className="ca-row ca-wrap">
            <button type="button" className="ca-btn is-ghost" onClick={onImport}><Icon n="upload" />استيراد من ملف</button>
            <button type="button" className="ca-btn is-ghost" onClick={() => setManage(true)}><Icon n="copy" />جداولي ({store.profiles.length})</button>
          </div>
        </div>
        <div className="ca-form-grid">
          <Field label="اسم الجدول"><input className="ca-input" value={profile.name} onChange={set('name')} placeholder="جدول الفصل الدراسي الأول" /></Field>
          <Field label="اسم المعلم/ة"><input className="ca-input" value={profile.teacher} onChange={set('teacher')} placeholder="أ. ..." /></Field>
          <Field label="اسم المدرسة"><input className="ca-input" value={profile.school} onChange={set('school')} placeholder="مدرسة ... للتعليم الأساسي" /></Field>
          <Field label="المادة الأساسية" hint="تُستخدم لأي حصة لم تُحدد مادتها"><input className="ca-input" value={profile.subject} onChange={set('subject')} list="ca-subjects" /></Field>
          <Field label="العام الدراسي"><input className="ca-input" value={profile.year} onChange={set('year')} placeholder="2026-2027" /></Field>
          <Field label="الفصل الدراسي"><select className="ca-input" value={profile.semester} onChange={set('semester')}>{[...new Set([...SEMESTERS, profile.semester].filter(Boolean))].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="المنطقة الزمنية للمدرسة"><select className="ca-input" value={profile.tz} onChange={set('tz')}>{TIMEZONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
          <Field label="شعار المدرسة (اختياري)" hint="يظهر في الجدول المطبوع">
            <span className="ca-row">
              {profile.schoolLogo && <img src={profile.schoolLogo} alt="شعار المدرسة" className="ca-logo-prev" />}
              <label className="ca-btn is-ghost is-sm ca-file"><Icon n="upload" size={15} />{profile.schoolLogo ? 'تغيير' : 'رفع صورة'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (f.size > 5e6) { notify('الصورة كبيرة جدًا (الحد 5 ميجابايت).', 'err'); return; } try { const src = await logoDataUrl(f); onProfile((p) => ({ ...p, schoolLogo: src })); } catch { notify('تعذر قراءة الصورة.', 'err'); } }} /></label>
              {profile.schoolLogo && <button type="button" className="ca-icon-btn" onClick={() => onProfile((p) => ({ ...p, schoolLogo: '' }))} aria-label="حذف الشعار"><Icon n="trash" size={16} /></button>}
            </span>
          </Field>
        </div>
        <datalist id="ca-subjects"><option value="المهارات الموسيقية" /><option value="الفنون الموسيقية" /><option value="الفنون التشكيلية" /><option value="الرياضة المدرسية" /><option value="اللغة العربية" /><option value="الرياضيات" /><option value="العلوم" /><option value="اللغة الإنجليزية" /><option value="التربية الإسلامية" /><option value="الدراسات الاجتماعية" /><option value="تقنية المعلومات" /></datalist>
      </section>

      <section className="ca-card">
        <div className="ca-card-head"><div><h3>أيام العمل</h3><p className="ca-muted">الأيام التي تتابعها التنبيهات</p></div></div>
        <div className="ca-row ca-wrap">{[0, 1, 2, 3, 4, 5, 6].map((d) => <button type="button" key={d} className={`ca-chip ca-chip-btn is-lg${profile.days.includes(d) ? ' is-on' : ''}`} aria-pressed={profile.days.includes(d)} onClick={() => toggleDay(d)}>{DAY_NAMES[d]}</button>)}</div>
      </section>

      <section className="ca-card">
        <div className="ca-card-head">
          <div><h3>توقيت الحصص والفسح</h3><p className="ca-muted">لا يشترط أن يتطابق مع أي مدرسة أخرى؛ عدّل كما في مدرستك</p></div>
          <div className="ca-row ca-wrap">
            <button type="button" className="ca-btn is-ghost" onClick={() => setGen(true)}><Icon n="sparkle" />توليد تلقائي</button>
          </div>
        </div>
        <div className="ca-row ca-wrap ca-mb">
          <span className="ca-muted">تعديل توقيت:</span>
          <Seg label="اليوم" value={timesDay} onChange={setTimesDay} options={[{ id: 'all', label: 'كل الأيام' }, ...profile.days.map((d) => ({ id: String(d), label: DAY_NAMES[d] }))]} />
        </div>
        {timesDay !== 'all' && <div className="ca-notice is-info"><Icon n="info" /><span>تعدّل الآن توقيت يوم <b>{DAY_NAMES[+timesDay]}</b> فقط (مثلًا: دوام مختصر يوم الخميس). الخانات الفارغة تتبع التوقيت العام.</span></div>}
        <div className="ca-periods">
          {profile.periods.map((p) => {
            const own = timesDay !== 'all' && profile.dayTimes[timesDay] && profile.dayTimes[timesDay][p.id];
            const v = timesDay === 'all' ? p : own || p;
            const bad = !p.start || !p.end || parseHHMM(p.end) <= parseHHMM(p.start);
            return (
              <div key={p.id} className={`ca-period${p.kind === 'break' ? ' is-break' : ''}${bad ? ' is-bad' : ''}${own ? ' is-own' : ''}`}>
                {p.kind === 'break'
                  ? <input className="ca-input ca-period-name" value={p.name} onChange={(e) => setPeriod(p.id, { name: e.target.value })} aria-label="اسم الاستراحة" disabled={timesDay !== 'all'} />
                  : <span className="ca-period-name"><b>الحصة {p.label}</b></span>}
                <label className="ca-time"><span>من</span><input className="ca-input" type="time" value={v.start || ''} onChange={(e) => (timesDay === 'all' ? setPeriod(p.id, { start: e.target.value }) : setDayTime(timesDay, p.id, 'start', e.target.value))} /></label>
                <label className="ca-time"><span>إلى</span><input className="ca-input" type="time" value={v.end || ''} onChange={(e) => (timesDay === 'all' ? setPeriod(p.id, { end: e.target.value }) : setDayTime(timesDay, p.id, 'end', e.target.value))} /></label>
                <span className="ca-muted ca-small">{p.start && p.end && !bad ? `${parseHHMM(v.end) - parseHHMM(v.start)} د` : ''}</span>
                {timesDay === 'all' ? <button type="button" className="ca-icon-btn" onClick={() => removePeriod(p.id)} aria-label="حذف"><Icon n="trash" size={16} /></button>
                  : own ? <button type="button" className="ca-icon-btn" onClick={() => setDayTime(timesDay, p.id, 'start', '')} aria-label="إعادة للتوقيت العام" title="إعادة للتوقيت العام"><Icon n="x" size={16} /></button> : <span />}
              </div>
            );
          })}
        </div>
        {timesDay === 'all' && <div className="ca-row ca-wrap ca-mt"><button type="button" className="ca-btn is-ghost" onClick={() => addPeriod('lesson')}><Icon n="plus" />إضافة حصة</button><button type="button" className="ca-btn is-ghost" onClick={() => addPeriod('break')}><Icon n="plus" />إضافة فسحة/استراحة</button></div>}
        {(timeIssues.length > 0 || overlaps.length > 0) && <p className="ca-error">{timeIssues.length ? `يوجد ${timeIssues.length} توقيت ناقص أو غير صحيح (النهاية قبل البداية). ` : ''}{overlaps.length ? 'بعض الأوقات متداخلة؛ راجع الترتيب.' : ''}</p>}
      </section>

      <section className="ca-card">
        <div className="ca-card-head"><div><h3>الجدول الأسبوعي</h3><p className="ca-muted">انقر أي خانة لإضافة حصة أو تعديلها أو نقلها</p></div></div>
        <WeekGrid data={profile} subject={profile.subject} h24={h24} dayTimes={profile.dayTimes} onCell={(d, p) => setCell({ d, p })} />
      </section>

      {cell && <CellModal profile={profile} d={cell.d} p={cell.p} onClose={() => setCell(null)} onProfile={onProfile} tones={tones} onPreview={onPreview} h24={h24} />}
      {gen && <GenModal profile={profile} onClose={() => setGen(false)} onApply={(periods) => { onProfile((p) => remapPeriods(p, periods)); setGen(false); notify('تم توليد التوقيت. راجع الأوقات وعدّلها إن لزم.'); }} />}
      {manage && <ProfilesModal store={store} onStore={onStore} onClose={() => setManage(false)} notify={notify} />}
    </div>
  );
}

/** عند توليد توقيت جديد: نحافظ على حصص الجدول بربط رقم الحصة القديم بالجديد */
function remapPeriods(p, periods) {
  const byNo = new Map(periods.filter((x) => x.kind === 'lesson').map((x) => [x.no, x.id]));
  const map = new Map(p.periods.filter((x) => x.kind === 'lesson').map((x) => [x.id, byNo.get(x.no)]));
  const lessons = {};
  for (const [d, r] of Object.entries(p.lessons)) for (const [pid, l] of Object.entries(r)) { const n = map.get(pid); if (n) (lessons[d] ||= {})[n] = l; }
  return { ...p, periods, lessons, dayTimes: {} };
}

function GenModal({ profile, onClose, onApply }) {
  const lessonsN = profile.periods.filter((x) => x.kind === 'lesson').length || 8;
  const [o, setO] = useState({ first: profile.periods[0] && profile.periods[0].start || '07:30', duration: 40, count: lessonsN, gap: 0, breaks: [{ after: 4, minutes: 20, name: 'الفسحة' }] });
  const preview = generatePeriods(o);
  const setB = (i, k, v) => setO({ ...o, breaks: o.breaks.map((b, j) => (j === i ? { ...b, [k]: v } : b)) });
  return (
    <Modal title="توليد توقيت اليوم الدراسي" onClose={onClose} footer={<><button type="button" className="ca-btn" onClick={() => onApply(preview)}><Icon n="check" />اعتماد التوقيت</button><button type="button" className="ca-btn is-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="ca-grid2">
        <Field label="بداية الحصة الأولى"><input className="ca-input" type="time" value={o.first} onChange={(e) => setO({ ...o, first: e.target.value })} /></Field>
        <Field label="مدة الحصة (دقيقة)"><input className="ca-input" type="number" min="20" max="120" value={o.duration} onChange={(e) => setO({ ...o, duration: Math.max(10, +e.target.value || 40) })} /></Field>
        <Field label="عدد الحصص اليومية"><input className="ca-input" type="number" min="1" max="12" value={o.count} onChange={(e) => setO({ ...o, count: Math.min(12, Math.max(1, +e.target.value || 1)) })} /></Field>
        <Field label="فاصل بين الحصص (دقيقة)"><input className="ca-input" type="number" min="0" max="15" value={o.gap} onChange={(e) => setO({ ...o, gap: Math.max(0, +e.target.value || 0) })} /></Field>
      </div>
      <div className="ca-label">الفسح والاستراحات</div>
      {o.breaks.map((b, i) => (
        <div className="ca-row ca-wrap ca-mb" key={i}>
          <input className="ca-input ca-w8" value={b.name} onChange={(e) => setB(i, 'name', e.target.value)} aria-label="اسم الاستراحة" />
          <span>بعد الحصة</span><select className="ca-input ca-num" value={b.after} onChange={(e) => setB(i, 'after', +e.target.value)}>{Array.from({ length: Math.max(1, o.count - 1) }, (_, k) => <option key={k} value={k + 1}>{ORDINALS[k]}</option>)}</select>
          <span>لمدة</span><input className="ca-input ca-num" type="number" min="5" max="60" value={b.minutes} onChange={(e) => setB(i, 'minutes', +e.target.value || 20)} /><span>د</span>
          <button type="button" className="ca-icon-btn" onClick={() => setO({ ...o, breaks: o.breaks.filter((_, j) => j !== i) })} aria-label="حذف"><Icon n="trash" size={16} /></button>
        </div>
      ))}
      <button type="button" className="ca-btn is-ghost is-sm" onClick={() => setO({ ...o, breaks: [...o.breaks, { after: Math.min(o.count - 1, 5), minutes: 10, name: 'استراحة' }] })}><Icon n="plus" size={15} />إضافة استراحة</button>
      <div className="ca-gen-prev">{preview.map((p) => <span key={p.id} className={p.kind === 'break' ? 'is-break' : ''}>{p.kind === 'break' ? p.name : p.label}<small>{fmtTime(p.start)}</small></span>)}</div>
      <p className="ca-muted ca-small">سيُحتفظ بالحصص المسجلة في الجدول حسب رقم الحصة. ويمكنك تعديل أي وقت يدويًا بعد التوليد.</p>
    </Modal>
  );
}

function CellModal({ profile, d, p, onClose, onProfile, tones, onPreview, h24 }) {
  const cur = (profile.lessons[d] || {})[p.id] || null;
  const [l, setL] = useState(cur || { subject: '', grade: '', section: '', room: '', note: '', muted: false, plan: null });
  const [target, setTarget] = useState({ d: String(d), p: p.id });
  const set = (k) => (e) => setL({ ...l, [k]: e.target.value });
  const lessonPeriods = profile.periods.filter((x) => x.kind === 'lesson');
  const write = (fn) => { onProfile((pr) => { const lessons = JSON.parse(JSON.stringify(pr.lessons)); fn(lessons); return { ...pr, lessons }; }); };
  const save = () => { write((ls) => { (ls[d] ||= {})[p.id] = { ...l }; }); onClose(); };
  const clear = () => { write((ls) => { if (ls[d]) delete ls[d][p.id]; }); onClose(); };
  const moveOrCopy = (copy) => {
    const td = +target.d, tp = target.p;
    if (td === d && tp === p.id) return;
    const occupied = (profile.lessons[td] || {})[tp];
    if (occupied && !window.confirm(copy ? 'الخانة المستهدفة فيها حصة. استبدالها؟' : 'الخانة المستهدفة فيها حصة. تبديل الحصتين؟')) return;
    write((ls) => {
      const mine = { ...l };
      (ls[td] ||= {})[tp] = mine;
      if (!copy) { if (occupied) ls[d][p.id] = occupied; else delete ls[d][p.id]; }
    });
    onClose();
  };
  return (
    <Modal title={`${DAY_NAMES[d]} – الحصة ${p.label} (${fmtTime(p.start, h24)})`} onClose={onClose} wide
      footer={<><button type="button" className="ca-btn" onClick={save}><Icon n="check" />حفظ</button>{cur && <button type="button" className="ca-btn is-danger" onClick={clear}><Icon n="trash" />تفريغ الخانة</button>}<button type="button" className="ca-btn is-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="ca-form-grid">
        <Field label="الصف"><input className="ca-input" list="ca-grades" value={l.grade} onChange={set('grade')} placeholder="الصف الخامس" /></Field>
        <Field label="الشعبة"><input className="ca-input" value={l.section} onChange={set('section')} placeholder="1" /></Field>
        <Field label="المادة" hint={`فارغة = ${profile.subject || 'المادة الأساسية'}`}><input className="ca-input" list="ca-subjects" value={l.subject} onChange={set('subject')} /></Field>
        <Field label="القاعة/المكان"><input className="ca-input" value={l.room} onChange={set('room')} placeholder="قاعة الموسيقى" /></Field>
      </div>
      <datalist id="ca-grades">{GRADES.map((g) => <option key={g} value={g} />)}</datalist>
      <Field label="ملاحظة دائمة لهذه الحصة (تظهر في التنبيه ومساعد الاستعداد)"><textarea className="ca-input" rows={2} value={l.note} onChange={set('note')} placeholder="مثال: الصف يحتاج تهيئة الآلات قبل البدء" /></Field>
      <Toggle checked={l.muted} onChange={(v) => setL({ ...l, muted: v })} label="بدون تنبيه لهذه الحصة" />
      <Toggle checked={!!l.plan} onChange={(v) => setL({ ...l, plan: v ? JSON.parse(JSON.stringify(profile.plan)) : null })} label="تنبيه مخصص لهذه الحصة" hint="بدلًا من خطة التنبيه العامة للجدول" disabled={l.muted} />
      {l.plan && !l.muted && <PlanEditor plan={l.plan} onChange={(plan) => setL({ ...l, plan })} tones={tones} onPreview={onPreview} compact />}
      {(cur || l.grade || l.subject) && (
        <div className="ca-move">
          <div className="ca-label">نقل أو نسخ هذه الحصة إلى خانة أخرى</div>
          <div className="ca-row ca-wrap">
            <select className="ca-input ca-w8" value={target.d} onChange={(e) => setTarget({ ...target, d: e.target.value })} aria-label="اليوم">{profile.days.map((x) => <option key={x} value={x}>{DAY_NAMES[x]}</option>)}</select>
            <select className="ca-input ca-w8" value={target.p} onChange={(e) => setTarget({ ...target, p: e.target.value })} aria-label="الحصة">{lessonPeriods.map((x) => <option key={x.id} value={x.id}>الحصة {x.label}</option>)}</select>
            <button type="button" className="ca-btn is-ghost is-sm" onClick={() => moveOrCopy(false)}><Icon n="move" size={15} />نقل</button>
            <button type="button" className="ca-btn is-ghost is-sm" onClick={() => moveOrCopy(true)}><Icon n="copy" size={15} />نسخ</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ProfilesModal({ store, onStore, onClose, notify }) {
  const [hol, setHol] = useState(null);
  const active = store.profiles.find((p) => p.id === store.activeId);
  return (
    <Modal title="جداولي المحفوظة" onClose={onClose} wide>
      <p className="ca-muted">يمكنك حفظ أكثر من جدول (الفصل الأول والثاني، أو أسبوع استثنائي). المنبه يتابع الجدول <b>النشط</b> فقط.</p>
      <ul className="ca-profiles">
        {store.profiles.map((p) => {
          const n = Object.values(p.lessons).reduce((a, r) => a + Object.keys(r).length, 0);
          return (
            <li key={p.id} className={p.id === store.activeId ? 'is-active' : ''}>
              <div><strong>{p.name}</strong><span className="ca-muted">{[p.semester && `الفصل ${p.semester}`, p.year, `${n} حصة`].filter(Boolean).join(' • ')}</span></div>
              <div className="ca-row ca-wrap">
                {p.id === store.activeId ? <span className="ca-badge is-now">النشط</span> : <button type="button" className="ca-btn is-sm" onClick={() => { onStore((s) => ({ ...s, activeId: p.id })); notify(`أصبح «${p.name}» هو الجدول النشط.`); }}>تفعيل</button>}
                <button type="button" className="ca-btn is-ghost is-sm" onClick={() => onStore((s) => { const c = clone(p); return { ...s, profiles: [...s.profiles, c] }; })}><Icon n="copy" size={15} />نسخ لفصل جديد</button>
                {store.profiles.length > 1 && <button type="button" className="ca-icon-btn" onClick={() => { if (window.confirm(`حذف «${p.name}» نهائيًا؟`)) onStore((s) => { const profiles = s.profiles.filter((x) => x.id !== p.id); return { ...s, profiles, activeId: s.activeId === p.id ? profiles[0].id : s.activeId }; }); }} aria-label="حذف الجدول"><Icon n="trash" size={16} /></button>}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="ca-row ca-wrap"><button type="button" className="ca-btn is-ghost" onClick={() => onStore((s) => ({ ...s, profiles: [...s.profiles, blank(active)] }))}><Icon n="plus" />جدول جديد فارغ</button></div>

      <h4 className="ca-h4">الإجازات والعطلات في «{active.name}»</h4>
      <p className="ca-muted ca-small">لا تصدر أي تنبيهات في أيام الإجازة.</p>
      <ul className="ca-holidays">
        {active.holidays.map((h) => <li key={h.id}><span><b>{h.name}</b> {h.from === h.to ? h.from : `${h.from} ← ${h.to}`}</span><button type="button" className="ca-icon-btn" aria-label="حذف" onClick={() => onStore((s) => ({ ...s, profiles: s.profiles.map((x) => (x.id === active.id ? { ...x, holidays: x.holidays.filter((y) => y.id !== h.id) } : x)) }))}><Icon n="trash" size={16} /></button></li>)}
        {!active.holidays.length && <li className="ca-muted">لا توجد إجازات مسجلة.</li>}
      </ul>
      {hol ? (
        <div className="ca-row ca-wrap">
          <input className="ca-input ca-w8" value={hol.name} onChange={(e) => setHol({ ...hol, name: e.target.value })} aria-label="اسم الإجازة" />
          <label className="ca-time"><span>من</span><input className="ca-input" type="date" value={hol.from} onChange={(e) => setHol({ ...hol, from: e.target.value })} /></label>
          <label className="ca-time"><span>إلى</span><input className="ca-input" type="date" value={hol.to} onChange={(e) => setHol({ ...hol, to: e.target.value })} /></label>
          <button type="button" className="ca-btn is-sm" disabled={!isDateKey(hol.from)} onClick={() => { onStore((s) => ({ ...s, profiles: s.profiles.map((x) => (x.id === active.id ? { ...x, holidays: [...x.holidays, { ...hol, id: uid('h'), to: hol.to || hol.from }] } : x)) })); setHol(null); }}><Icon n="check" size={15} />إضافة</button>
        </div>
      ) : <button type="button" className="ca-btn is-ghost is-sm" onClick={() => setHol({ name: 'إجازة', from: '', to: '' })}><Icon n="plus" size={15} />إضافة إجازة</button>}
    </Modal>
  );
}

const clone = (p) => ({ ...JSON.parse(JSON.stringify(p)), id: uid('s'), name: `${p.name} (نسخة)`, overrides: {}, holidays: [], createdAt: Date.now(), updatedAt: Date.now() });
const blank = (a) => ({ id: uid('s'), name: 'جدول جديد', teacher: a ? a.teacher : '', school: a ? a.school : '', subject: a ? a.subject : '', year: a ? a.year : '', semester: a ? a.semester : '', tz: a ? a.tz : 'Asia/Muscat', schoolLogo: a ? a.schoolLogo : '', days: a ? a.days : [0, 1, 2, 3, 4], periods: a ? a.periods : generatePeriods(), dayTimes: {}, lessons: {}, overrides: {}, holidays: [], plan: a ? a.plan : undefined, createdAt: Date.now(), updatedAt: Date.now() });
