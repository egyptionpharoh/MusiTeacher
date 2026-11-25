// تطبيق اختبار صغير: صفحات الأدوات الحقيقية + شريط التنقل الموحد + موجّه بسيط بالمسارات (pushState).
import React from 'react';
import { createRoot } from 'react-dom/client';
import { usePathname, navigate } from './router-stub.js';
window.__nav = (h) => navigate(h);
import ToolsLayout from '../../src/app/dashboard/tools/layout.js';
import ToolsPage from '../../src/app/dashboard/tools/page.js';
import MusicFactory from '../../src/app/dashboard/tools/music-factory/page.js';
import InteractiveBook from '../../src/app/dashboard/tools/interactive-book/page.js';
import Covers from '../../src/app/dashboard/tools/covers/page.js';
import AudioSeparator from '../../src/app/dashboard/tools/audio-separator/page.js';
import Workshops from '../../src/app/dashboard/tools/workshops/page.js';
import Plans from '../../src/app/dashboard/tools/plans/page.js';
import Anthem from '../../src/app/dashboard/tools/anthem/page.js';
import Initiatives from '../../src/app/dashboard/tools/initiatives/page.js';
import ClassAlarm from '../../src/app/dashboard/tools/class-alarm/page.js';
import CommitteeAdvisor from '../../src/app/dashboard/tools/committee-advisor/page.js';
const ROUTES = { '/dashboard/tools': ToolsPage, '/dashboard/tools/music-factory': MusicFactory, '/dashboard/tools/interactive-book': InteractiveBook, '/dashboard/tools/covers': Covers,
  '/dashboard/tools/audio-separator': AudioSeparator, '/dashboard/tools/workshops': Workshops, '/dashboard/tools/plans': Plans, '/dashboard/tools/anthem': Anthem,
  '/dashboard/tools/initiatives': Initiatives, '/dashboard/tools/class-alarm': ClassAlarm, '/dashboard/tools/committee-advisor': CommitteeAdvisor,
  '/dashboard/tools/radio': () => React.createElement('h1', { id: 'radio-page' }, 'مولد الإذاعات (صفحة خارج النطاق)') };
if (new URLSearchParams(location.search).get('dark')) document.documentElement.classList.add('dark');
window.__toggleDark = () => document.documentElement.classList.toggle('dark');
function Home() { return React.createElement('div', { id: 'home-page', style: { padding: 40, fontSize: 28 } }, 'الصفحة الرئيسية للمنصة (/)'); }
function App() {
  const path = usePathname().replace(/\/+$/, '') || '/';
  if (path === '/') return React.createElement(Home);
  const Page = ROUTES[path];
  if (!Page) return React.createElement('div', { id: 'nf' }, '404 ' + path);
  return React.createElement('div', { style: { minHeight: '100vh', background: '#f9fafb' } },
    React.createElement('main', { className: 'mt-dash-main' }, React.createElement(ToolsLayout, null, React.createElement(Page, { key: path }))));
}
createRoot(document.getElementById('root')).render(React.createElement(App));
