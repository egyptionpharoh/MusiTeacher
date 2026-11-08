// نقطة دخول اختبار الواجهة خارج Next (tests/class-alarm/build-ui.cjs)
import React from 'react';
import { createRoot } from 'react-dom/client';
import ClassAlarmApp from '../../src/modules/class-alarm/ui/ClassAlarmApp';
const q = new URLSearchParams(location.search);
if (q.get('dark')) document.documentElement.classList.add('dark');
const getToken = q.get('noauth') ? null : async () => 'test-token';
createRoot(document.getElementById('root')).render(React.createElement(ClassAlarmApp, { getToken, apiBase: '/api/class-alarm', backHref: '/', swScope: '/' }));
