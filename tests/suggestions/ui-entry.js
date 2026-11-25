// اختبار واجهتي «صندوق الاقتراحات السرية» خارج Next:  /?page=box   أو   /?page=admin&dark=1
import React from 'react';
import { createRoot } from 'react-dom/client';
import SuggestionBox from '../../src/components/suggestions/SuggestionBox.jsx';
import SuggestionsAdmin from '../../src/components/suggestions/SuggestionsAdmin.jsx';
const q = new URLSearchParams(location.search);
if (q.get('dark')) document.documentElement.classList.add('dark');
const el = q.get('page') === 'admin'
  ? React.createElement('div', { style: { background: '#0a0f16', minHeight: '100vh' } }, React.createElement('main', { className: 'sg-admin-wrap', style: { paddingTop: 24 } },
      React.createElement(SuggestionsAdmin, { getToken: async () => q.get('as') || 'tok-admin' })))
  : React.createElement(SuggestionBox);
createRoot(document.getElementById('root')).render(el);
