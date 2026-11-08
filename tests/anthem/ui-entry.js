import React from 'react';
import { createRoot } from 'react-dom/client';
import AnthemStudio from '@/components/anthem/AnthemStudio';
import files from '@/data/anthem.json';
if (new URLSearchParams(location.search).get('dark')) document.documentElement.classList.add('dark');
createRoot(document.getElementById('root')).render(React.createElement(AnthemStudio, { files }));
// للاختبار فقط: أدوات يستدعيها e2e.cjs داخل الصفحة (التحقق من التردد بالعرض غير المتصل، والإجابات من النموذج)
import * as audio from '@/lib/anthem/audio';
import * as songs from '@/lib/anthem/songs';
import * as notation from '@/lib/anthem/notation';
window.__an = { audio, songs, notation };
