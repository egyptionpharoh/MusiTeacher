import React from 'react';
import { createRoot } from 'react-dom/client';
import CoverStudio from '@/components/cover-studio/CoverStudio';
if (new URLSearchParams(location.search).get('dark')) document.documentElement.classList.add('dark');
createRoot(document.getElementById('root')).render(React.createElement(CoverStudio));
