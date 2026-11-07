import React from 'react';
import { createRoot } from 'react-dom/client';
import AudioSeparator from '@/components/audio-separator/AudioSeparator';
const q = new URLSearchParams(location.search);
if (q.get('dark')) document.documentElement.classList.add('dark');
if (q.get('uid')) globalThis.__TEST_UID = q.get('uid');
createRoot(document.getElementById('root')).render(React.createElement(AudioSeparator));
