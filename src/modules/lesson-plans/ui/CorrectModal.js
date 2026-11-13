'use client';
// ✏️ تصحيح الدرس المتوقع لحصة واحدة (يُستخدم في «منبّه الحصص» وفي ⚙️ «الربط بجدولي»):
// اختيار درس محدد، أو «لا درس من الخطة في هذه الحصة»، أو العودة للربط التلقائي. يؤثر على هذه الحصة فقط.
import { useState } from 'react';
import { Icon, Modal } from '../../class-alarm/ui/parts';
import { planLabel } from '../core/model.js';
import { lessonChoices } from '../core/auto.js';
import { formatRangeAr, formatDateAr } from '../core/calendar.js';

export default function CorrectModal({ ws, dateKey, event, link, onSave, onClose }) {
  const l = event.lesson || {};
  const groups = lessonChoices(ws, l.grade);
  const candIds = new Set((link && link.candidates || []).map((c) => `${c.planId}|${c.lessonId}`));
  const cur = link && link.overridden ? (link.lessonId ? `${link.planId}|${link.lessonId}` : 'none') : link && link.state === 'sure' ? `${link.planId}|${link.lessonId}` : '';
  const [val, setVal] = useState(cur);
  const save = () => {
    if (val === 'auto') onSave({ lessonId: null });
    else if (val === 'none') onSave({ lessonId: '', planId: '' });
    else { const [planId, lessonId] = val.split('|'); onSave({ planId, lessonId }); }
  };
  return (
    <Modal title="تصحيح درس الحصة" onClose={onClose}
      footer={<><button type="button" className="ca-btn" onClick={save} disabled={!val}><Icon n="check" />حفظ لهذه الحصة</button><button type="button" className="ca-btn is-ghost" onClick={onClose}>إلغاء</button></>}>
      <p className="ca-small"><b>{formatDateAr(dateKey, { day: true })}</b> • {event.type === 'lesson' ? `الحصة ${event.label}` : 'حصة استثنائية'}{event.cls ? ` • ${event.cls}` : ''}</p>
      {link && link.reason && link.review && <div className="ca-notice is-warn"><Icon n="warn" /><span>{link.reason}</span></div>}
      {!groups.length && <p className="ca-muted">لا توجد خطة لهذا الصف.</p>}
      <div className="lp-correct" role="radiogroup" aria-label="الدرس">
        {groups.map((g) => (
          <fieldset key={g.plan.id} className="lp-correct-group">
            <legend>{planLabel(g.plan)}</legend>
            {g.lessons.map((x) => {
              const v = `${x.planId}|${x.lessonId}`;
              return (
                <label key={v} className={`lp-correct-opt${candIds.has(v) ? ' is-cand' : ''}`}>
                  <input type="radio" name="lp-correct" value={v} checked={val === v} onChange={() => setVal(v)} />
                  <span><b>{x.title || 'درس بلا اسم'}</b>{candIds.has(v) && <i className="lp-st is-warn">محتمل</i>}<small className="ca-muted">{x.start ? <bdi>{formatRangeAr(x.start, x.end, { days: false })}</bdi> : 'بلا فترة'}</small></span>
                </label>
              );
            })}
          </fieldset>
        ))}
        <label className="lp-correct-opt"><input type="radio" name="lp-correct" value="none" checked={val === 'none'} onChange={() => setVal('none')} /><span><b>لا يوجد درس من الخطة في هذه الحصة</b><small className="ca-muted">مثل: مراجعة، نشاط، اختبار</small></span></label>
        {link && link.overridden && <label className="lp-correct-opt"><input type="radio" name="lp-correct" value="auto" checked={val === 'auto'} onChange={() => setVal('auto')} /><span><b>إلغاء التصحيح والعودة للربط التلقائي</b></span></label>}
      </div>
      <p className="ca-small ca-muted">التصحيح يخص هذه الحصة فقط، ولا يغيّر الخطة ولا الجدول.</p>
    </Modal>
  );
}
