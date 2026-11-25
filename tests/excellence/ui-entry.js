// اختبار «كوبون التميز» خارج Next:  /?page=studio|initiative&uid=teacherA&dark=1
import React from 'react';
import { createRoot } from 'react-dom/client';
import InitiativesStudio from '../../src/components/initiatives/InitiativesStudio.js';
import ExcellenceInitiative from '../../src/modules/excellence-cards/ui/ExcellenceInitiative.js';
import { getUserId } from './stub-client.js';
import { Sheet } from '../../src/modules/excellence-cards/ui/PrintStudio.js';
import { TEMPLATES } from '../../src/modules/excellence-cards/data/templates.js';
import { PHRASES } from '../../src/modules/excellence-cards/data/phrases.js';
import { normalizeCard } from '../../src/modules/excellence-cards/core/store.js';
import '../../src/modules/excellence-cards/ui/excellence.css';
const q = new URLSearchParams(location.search);
if (q.get('dark')) document.documentElement.classList.add('dark');
window.__toggleDark = () => document.documentElement.classList.toggle('dark');
const shell = (child) => React.createElement('div', { style: { minHeight: '100vh', background: '#f9fafb' } }, React.createElement('main', { className: 'mt-dash-main' }, child));
// معرض: كل القوالب × كل الأحجام × أطول العبارات، مع بيانات كاملة — لاكتشاف أي نص يخرج عن الكارت
const gallery = () => {
  const per = +(q.get('per') || 10); const bw = !!q.get('bw');
  const settings = { initiativeName: q.get('name') || 'نجوم التميز والإبداع', school: 'مدرسة النموذجية للتعليم الأساسي (5–12)', teacher: 'أ. اسم المعلم الثلاثي', teacherGender: q.get('tg') || 'm', subject: 'المهارات الموسيقية' };
  const long = [...PHRASES].sort((a, b) => b.m.length - a.m.length);
  const cards = [];
  TEMPLATES.forEach((t, i) => { [true, false].forEach((gift, j) => { const ph = long[(i * 2 + j) % long.length]; cards.push(normalizeCard({ template: t.id, gift, phraseId: ph.id, gender: (i + j) % 2 ? 'f' : 'm', student: (i + j) % 3 ? 'عبدالرحمن بن سليمان البوسعيدي' : '', grade: (i + j) % 3 ? '10-2' : '', dateMode: j ? 'blank' : 'today' })); }); });
  const pages = []; for (let i = 0; i < cards.length; i += per) pages.push(cards.slice(i, i + per));
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', background: '#888', padding: 20 } },
    pages.map((p, i) => React.createElement(Sheet, { key: i, cards: p, perPage: per, settings, bw, cut: true })));
};
const page = q.get('page') === 'gallery' ? gallery() : q.get('page') === 'initiative'
  ? React.createElement('div', { className: 'in-root', dir: 'rtl' }, React.createElement('div', { className: 'in-shell' }, React.createElement(ExcellenceInitiative, { getUserId, onBack: () => { location.href = '/?page=studio'; } })))
  : React.createElement(InitiativesStudio);
createRoot(document.getElementById('root')).render(shell(page));
