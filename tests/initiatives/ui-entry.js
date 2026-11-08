import React from 'react';
import { createRoot } from 'react-dom/client';
import InitiativesStudio from '@/components/initiatives/InitiativesStudio';
if (new URLSearchParams(location.search).get('dark')) document.documentElement.classList.add('dark');
createRoot(document.getElementById('root')).render(React.createElement(InitiativesStudio));
