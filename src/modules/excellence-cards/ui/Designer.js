'use client';
// «مصمم كروت التميز»: بيانات المبادرة + القالب + العبارة (بصيغة الطالب أو الطالبة) + بيانات الطالب، مع معاينة حية.
import { useMemo, useState } from 'react';
import { TEMPLATES } from '../data/templates.js';
import { PHRASES, PHRASE_TAGS, phrasesFor, phraseText } from '../data/phrases.js';
import { NAME_OPTIONS } from '../data/content.js';
import { layoutFor, CUT_GAP } from '../core/layout.js';
import Card, { Motif } from './Card.js';
import { Fit } from './print.js';
import { Ico, Seg, Field } from './parts.js';

export function SettingsForm({ settings, onChange, compact }) {
  const set = (k) => (e) => onChange({ ...settings, [k]: e.target.value });
  return (
    <div className={`ec-form ${compact ? 'is-compact' : ''}`}>
      <Field label="اسم المبادرة" hint="اختر من المقترحات أو اكتب اسمًا خاصًا بك." wide>
        <input className="ec-input" value={settings.initiativeName} maxLength={50} onChange={set('initiativeName')} list="ec-names" id="ec-set-name" />
        <datalist id="ec-names">{NAME_OPTIONS.map((n) => <option key={n} value={n} />)}</datalist>
      </Field>
      <div className="ec-namechips" aria-label="أسماء مقترحة">
        {NAME_OPTIONS.slice(0, 8).map((n) => (
          <button key={n} type="button" className={`ec-chip ${settings.initiativeName === n ? 'is-on' : ''}`} onClick={() => onChange({ ...settings, initiativeName: n })}>{n}</button>
        ))}
      </div>
      <Field label="اسم المدرسة"><input className="ec-input" id="ec-set-school" value={settings.school} maxLength={80} onChange={set('school')} placeholder="مثال: مدرسة …" /></Field>
      <Field label="اسم صاحب المبادرة / المعلم المنفذ"><input className="ec-input" id="ec-set-teacher" value={settings.teacher} maxLength={60} onChange={set('teacher')} placeholder="مثال: أ. …" /></Field>
      <Field label="أنا" group>
        <Seg label="أنا" value={settings.teacherGender} onChange={(v) => onChange({ ...settings, teacherGender: v })} options={[{ id: 'm', label: 'معلم' }, { id: 'f', label: 'معلمة' }]} />
      </Field>
      <Field label="المادة أو النشاط (اختياري)"><input className="ec-input" id="ec-set-subject" value={settings.subject} maxLength={50} onChange={set('subject')} placeholder="مثال: المهارات الموسيقية، اللغة العربية، جماعة العلوم" /></Field>
    </div>
  );
}

export default function Designer({ state, update, onPrintOne, onFillPage, onQueue }) {
  const { settings, card } = state;
  const [tag, setTag] = useState('all');
  const [setupOpen] = useState(!settings.teacher && !settings.school);   // تُفتح أول مرة فقط، ولا تنغلق أثناء الكتابة
  const setCard = (patch) => update((s) => ({ ...s, card: { ...s.card, ...patch } }));
  const list = useMemo(() => phrasesFor(tag), [tag]);
  const lay = layoutFor(state.print.perPage);
  const w = lay.w - 2 * CUT_GAP; const h = lay.h - 2 * CUT_GAP;
  const custom = card.custom.trim();

  return (
    <div className="ec-designer">
      <div className="ec-controls">
        <details className="ec-box" open={setupOpen}>
          <summary><Ico n="user" /> بيانات مبادرتي <small>تظهر في كل الكروت والتقارير</small></summary>
          <SettingsForm settings={settings} onChange={(v) => update((s) => ({ ...s, settings: v }))} />
        </details>

        <section className="ec-box" aria-labelledby="ec-h-tpl">
          <h3 id="ec-h-tpl"><Ico n="brush" /> القالب</h3>
          <div className="ec-tpls" role="radiogroup" aria-label="قوالب الكروت">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={card.template === t.id} className={`ec-tpl ${card.template === t.id ? 'is-on' : ''}`}
                style={{ '--c1': t.c1, '--c2': t.c2, '--tint': t.tint, '--ec-p3': '#f59e0b', '--ec-p4': '#10b981' }} onClick={() => setCard({ template: t.id, gift: t.gift })} data-tpl={t.id}>
                <Motif name={t.motif} /><span>{t.name}</span>
              </button>
            ))}
          </div>
          <label className="ec-switch">
            <input type="checkbox" id="ec-gift" checked={card.gift} onChange={(e) => setCard({ gift: e.target.checked })} />
            <span><Ico n="gift" size={17} /> مساحة لتثبيت هدية رمزية (قطعة شوكولاتة أو ملصق)</span>
          </label>
          <small className="ec-hint">الهدية اختيارية ووفق سياسة المدرسة — الكارت يكفي وحده.</small>
        </section>

        <section className="ec-box" aria-labelledby="ec-h-ph">
          <h3 id="ec-h-ph"><Ico n="star" /> العبارة التحفيزية</h3>
          <Field label="صيغة العبارة" group hint="تتحول العبارة تلقائيًا إلى صيغة الطالب أو الطالبة، وكذلك «إلى الطالب المبدع / الطالبة المبدعة».">
            <Seg label="صيغة العبارة" value={card.gender} onChange={(v) => setCard({ gender: v })} options={[{ id: 'm', label: 'طالب' }, { id: 'f', label: 'طالبة' }]} />
          </Field>
          <div className="ec-tags" role="group" aria-label="تصنيف العبارات">
            {PHRASE_TAGS.map((t) => <button key={t.id} type="button" className={`ec-chip ${tag === t.id ? 'is-on' : ''}`} aria-pressed={tag === t.id} onClick={() => setTag(t.id)}>{t.label}</button>)}
          </div>
          <div className={`ec-phrases ${custom ? 'is-muted' : ''}`} role="radiogroup" aria-label="العبارات">
            {list.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={!custom && card.phraseId === p.id} className={`ec-phrase ${!custom && card.phraseId === p.id ? 'is-on' : ''}`} onClick={() => setCard({ phraseId: p.id, custom: '' })} data-ph={p.id}>
                {(card.gender === 'f' ? p.f : p.m).replace('\n', ' ')}
              </button>
            ))}
          </div>
          <Field label="أو اكتب عبارتك الخاصة" hint={custom ? 'عبارتك هي المستخدمة الآن. امسحها للعودة إلى العبارات الجاهزة. استخدم سطرًا جديدًا لتقسيمها إلى سطرين.' : `${PHRASES.length} عبارة جاهزة لكل المواد، أو اكتب ما يناسب طلبتك.`} wide>
            <textarea className="ec-input" id="ec-custom" rows={2} maxLength={160} value={card.custom} onChange={(e) => setCard({ custom: e.target.value })} placeholder={phraseText({ ...card, custom: '' })} />
          </Field>
        </section>

        <section className="ec-box" aria-labelledby="ec-h-st">
          <h3 id="ec-h-st"><Ico n="edit" /> بيانات الطالب <small>اختيارية — اتركها فارغة للكتابة باليد</small></h3>
          <div className="ec-form">
            <Field label="اسم الطالب"><input className="ec-input" id="ec-student" value={card.student} maxLength={60} onChange={(e) => setCard({ student: e.target.value })} placeholder="فارغ = خط منقط للكتابة" /></Field>
            <Field label="الصف"><input className="ec-input" id="ec-grade" value={card.grade} maxLength={30} onChange={(e) => setCard({ grade: e.target.value })} placeholder="مثال: الخامس / 6-2" /></Field>
            <Field label="تاريخ تقديم الكارت" group>
              <Seg label="التاريخ" value={card.dateMode} onChange={(v) => setCard({ dateMode: v })} options={[{ id: 'today', label: 'اليوم' }, { id: 'blank', label: 'فارغ' }, { id: 'fixed', label: 'تاريخ محدد' }]} />
              {card.dateMode === 'fixed' ? <input type="date" className="ec-input" aria-label="التاريخ المحدد" value={card.date} onChange={(e) => setCard({ date: e.target.value })} /> : null}
            </Field>
          </div>
        </section>
      </div>

      <aside className="ec-preview" aria-label="معاينة الكارت">
        <div className="ec-preview-sticky">
          <div className="ec-preview-head"><b>المعاينة</b><span>{lay.label} · {lay.cm}</span></div>
          <div className="ec-paper"><Fit w={w} h={h} max={1.5}><Card settings={settings} card={card} w={w} h={h} bw={!state.print.color} /></Fit></div>
          <div className="ec-actions">
            <button type="button" className="ec-btn is-primary" onClick={onFillPage} id="ec-fill"><Ico n="print" /> صفحة A4 كاملة من هذا الكارت</button>
            <button type="button" className="ec-btn" onClick={onPrintOne} id="ec-print-one"><Ico n="print" /> اطبع هذا الكارت وحده</button>
            <button type="button" className="ec-btn is-ghost" onClick={onQueue} id="ec-queue"><Ico n="plus" /> أضف إلى قائمة الطباعة {state.queue.length ? <b className="ec-count">{state.queue.length}</b> : null}</button>
          </div>
          <small className="ec-hint">غيّر الحجم واللون وخطوط القص من تبويب «الطباعة».</small>
        </div>
      </aside>
    </div>
  );
}
