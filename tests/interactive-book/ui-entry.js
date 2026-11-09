// اختبار «الكتاب التفاعلي الذكي» خارج Next:  /?uid=teacherA&dark=1
import React from 'react';
import { createRoot } from 'react-dom/client';
import InteractiveBookApp from '../../src/modules/interactive-book/ui/InteractiveBookApp';
const q = new URLSearchParams(location.search);
if (q.get('dark')) document.documentElement.classList.add('dark');
const uid = q.get('uid') || 'teacherA';
createRoot(document.getElementById('root')).render(React.createElement(InteractiveBookApp, { getUserId: async () => uid, onBack: () => { location.href = '/?back=1'; } }));
