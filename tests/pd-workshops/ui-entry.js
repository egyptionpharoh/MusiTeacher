import React from 'react';
import { createRoot } from 'react-dom/client';
import WorkshopStudio from '@/components/pd-workshops/WorkshopStudio';
if (new URLSearchParams(location.search).get('dark')) document.documentElement.classList.add('dark');
createRoot(document.getElementById('root')).render(React.createElement(WorkshopStudio));
