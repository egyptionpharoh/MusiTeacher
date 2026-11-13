// اختبار الأداتين معًا خارج Next: /?app=plans (الخطط الفصلية) و /?app=alarm (منبّه الحصص) — الحساب من ?uid=
import React from 'react';
import { createRoot } from 'react-dom/client';
import plansData from '../../src/data/semester-plans.json';
import LessonPlansApp from '../../src/modules/lesson-plans/ui/LessonPlansApp';
import ClassAlarmApp from '../../src/modules/class-alarm/ui/ClassAlarmApp';
const q = new URLSearchParams(location.search);
if (q.get('dark')) document.documentElement.classList.add('dark');
const uid = q.get('uid') || 'teacherA';
const getToken = async () => `tok-${uid}`;
const getUserId = async () => uid;
const keep = (k) => ['uid', 'dark'].filter((x) => q.get(x)).map((x) => `${x}=${q.get(x)}`).concat(k).join('&');
const app = q.get('app') === 'alarm'
  ? React.createElement(ClassAlarmApp, { getToken, getUserId, apiBase: '/api/class-alarm', backHref: '/', swScope: '/', plansHref: `/?${keep('app=plans')}` })
  : React.createElement(LessonPlansApp, { plansData, getToken, getUserId, apiBase: '/api/lesson-plans', alarmHref: `/?${keep('app=alarm')}`, backHref: '/' });
createRoot(document.getElementById('root')).render(app);
