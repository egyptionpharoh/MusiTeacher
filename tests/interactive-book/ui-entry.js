// اختبار «الكتاب التفاعلي الذكي» خارج Next:  /?uid=teacherA&dark=1
// يُغلّف الأداة بنفس غلاف لوحة التحكم الحقيقي (خلفية bg-gray-50 + حشوة main) حتى تظهر مشكلات التباين كما في المنصة.
import React from 'react';
import { createRoot } from 'react-dom/client';
import InteractiveBookApp from '../../src/modules/interactive-book/ui/InteractiveBookApp.js';
const q = new URLSearchParams(location.search);
const uid = q.get('uid') || 'teacherA';
if (q.get('dark')) document.documentElement.classList.add('dark');
window.__toggleDark = () => document.documentElement.classList.toggle('dark');
const shell = (child) => React.createElement('div', { style: { minHeight: '100vh', background: '#f9fafb' } },
  React.createElement('main', { className: 'mt-dash-main' }, child));
createRoot(document.getElementById('root')).render(shell(React.createElement(InteractiveBookApp, { getUserId: async () => uid, onBack: () => { location.href = '/?back=1'; } })));
