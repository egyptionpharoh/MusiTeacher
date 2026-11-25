'use client';
// بطاقة «الاقتراح التعليمي الرئيسي» في مقدمة قسم المبادرات.
import { INITIATIVE } from '../data/content.js';
import { CUT_GAP } from '../core/layout.js';
import { normalizeCard } from '../core/store.js';
import Card from './Card.js';
import { Fit } from './print.js';
import { Ico } from './parts.js';
import './excellence.css';

const SAMPLE_SETTINGS = { initiativeName: INITIATIVE.name, school: '', teacher: '', teacherGender: 'm', subject: '' };
const SAMPLE = normalizeCard({ template: 'stars', gift: true, phraseId: 'p08', dateMode: 'blank' });

export default function ExcellenceFeature({ onOpen }) {
  return (
    <section className="ec-feature" aria-labelledby="ec-feature-title">
      <div className="ec-feature-text">
        <span className="ec-badge"><Ico n="star" size={14} fill /> الاقتراح التعليمي الرئيسي</span>
        <h2 id="ec-feature-title">{INITIATIVE.name}</h2>
        <p className="ec-slogan">{INITIATIVE.slogan}</p>
        <p>كروت تحفيزية يمنحها المعلم لطلبته وفق معايير واضحة، تُجمع وتُتوَّج بتكريم في نهاية الفترة التي تحددها — مبادرة جاهزة تطبقها في مدرستك باسمك.</p>
        <ul className="ec-feature-pts">
          <li><Ico n="brush" size={16} /> مصمم كروت بقوالب جاهزة</li>
          <li><Ico n="print" size={16} /> طباعة A4 من كارت إلى 10 كروت</li>
          <li><Ico n="chart" size={16} /> متابعة اختيارية للكوبونات</li>
          <li><Ico n="report" size={16} /> تقرير تكريم لإدارة المدرسة</li>
        </ul>
        <button type="button" className="ec-btn is-primary is-big" onClick={onOpen} id="ec-open-initiative"><Ico n="star" size={18} fill /> اكتشف المبادرة</button>
      </div>
      <div className="ec-feature-art" aria-hidden="true">
        <div className="ec-feature-card"><Fit w={95 - 2 * CUT_GAP} h={55.4 - 2 * CUT_GAP} max={1.05}><Card settings={SAMPLE_SETTINGS} card={SAMPLE} w={95 - 2 * CUT_GAP} h={55.4 - 2 * CUT_GAP} /></Fit></div>
      </div>
    </section>
  );
}
