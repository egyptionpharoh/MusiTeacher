'use client';
// ⚙️ إعدادات «مولد الخطط الفصلية»: صفوفي • خططي حسب الصف • الربط بجدولي • الحفظ والمزامنة
import { Icon, Seg } from '../../class-alarm/ui/parts';
import { GRADE_NAMES, gradeNum } from '../core/model.js';
import GradePlansView, { SyncPanel } from './PlansView';
import AutoLinkView from './AutoLinkView';

export const SETTINGS_TABS = [
  { id: 'grades', label: 'صفوفي' },
  { id: 'plans', label: 'خططي حسب الصف' },
  { id: 'link', label: 'الربط بجدولي' },
  { id: 'save', label: 'الحفظ والمزامنة' },
];

export function GradesPicker({ ws, onChange, compact = false }) {
  const sel = ws.settings.grades;
  const toggle = (n) => onChange(sel.includes(n) ? sel.filter((x) => x !== n) : [...sel, n].sort((a, b) => a - b));
  return (
    <div>
      <div className="lp-grades" role="group" aria-label="الصفوف التي أدرّسها">
        {GRADE_NAMES.map((g, i) => {
          const n = i + 1, on = sel.includes(n);
          const plans = ws.plans.filter((p) => gradeNum(p.grade) === n).length;
          return (
            <button key={g} type="button" className={`lp-grade${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggle(n)}>
              <span aria-hidden="true">{on ? '✓' : '+'}</span>{g.replace('الصف ', '')}{plans > 0 && <small>{plans} {plans === 1 ? 'خطة' : 'خطط'}</small>}
            </button>
          );
        })}
      </div>
      {!compact && <p className="ca-small ca-muted ca-mt">اختر صفًا واحدًا أو أكثر. تظهر في القوائم والربط صفوفك المختارة فقط، وإلغاء اختيار صف لا يحذف خططه (تبقى محفوظة وتعود عند اختياره).</p>}
    </div>
  );
}

export default function SettingsView({ section, onSection, ws, update, notify, setGrades, prefsState, common, plansData, ai, aiReady, sync, onWipe }) {
  const grades = ws.settings.grades;
  return (
    <div className="ca-stack">
      <Seg label="أقسام الإعدادات" value={section} onChange={onSection} options={SETTINGS_TABS} />
      {section === 'grades' && (
        <section className="ca-card">
          <div className="ca-card-head"><div><h3>صفوفي</h3><p className="ca-muted">الصفوف التي تدرّسها هذا العام</p></div></div>
          <GradesPicker ws={ws} onChange={setGrades} />
          <p className={`ca-small ${prefsState === 'error' ? 'ca-error' : 'ca-muted'}`}>{prefsState === 'saved' ? '✓ حُفظت صفوفك في حسابك.' : prefsState === 'saving' ? 'جارٍ الحفظ في حسابك...' : prefsState === 'error' ? 'حُفظت صفوفك على هذا الجهاز، وتعذر حفظها في حسابك الآن (ستُعاد المحاولة عند التعديل التالي).' : prefsState === 'local' ? 'تُحفظ صفوفك في حسابك على هذا الجهاز.' : ''}</p>
          {grades.length > 0 && <button type="button" className="ca-btn is-sm" onClick={() => onSection('plans')}><Icon n="upload" size={15} />التالي: رفع خطة لكل صف</button>}
        </section>
      )}
      {section === 'plans' && <GradePlansView ws={ws} update={update} notify={notify} ai={ai} aiReady={aiReady} plansData={plansData} grades={grades} onOpenGrades={() => onSection('grades')} />}
      {section === 'link' && <AutoLinkView {...common} grades={grades} />}
      {section === 'save' && <SyncPanel sync={sync} onWipe={onWipe} />}
    </div>
  );
}
