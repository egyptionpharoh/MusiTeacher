'use client';
// أيقونات خطية خفيفة (بنفس أسلوب Lucide المستخدم في المنصة) — بلا أي اعتمادية.
import React from 'react';

const P = {
  back: 'M5 12h14M13 6l6 6-6 6',
  prev: 'M9 6l6 6-6 6',
  next: 'M15 6l-6 6 6 6',
  first: 'M6 6l6 6-6 6M12 6l6 6-6 6',
  last: 'M18 6l-6 6 6 6M12 6l-6 6 6 6',
  zoomIn: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.3-4.3M11 8v6M8 11h6',
  zoomOut: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.3-4.3M8 11h6',
  fitPage: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M9 8h6v8H9z',
  fitWidth: 'M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3M3 5v14M21 5v14',
  spread: 'M2 5c3-1.3 6.5-1.3 10 1 3.5-2.3 7-2.3 10-1v14c-3-1.3-6.5-1.3-10 1-3.5-2.3-7-2.3-10-1zM12 6v14',
  single: 'M6 3h9l4 4v14H6zM15 3v4h4',
  thumbs: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.3-4.3',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  notes: 'M5 3h14v12l-6 6H5zM13 21v-6h6M8 8h8M8 12h5',
  pen: 'M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z',
  highlight: 'M9 11l-5 5v4h4l5-5M14 6l4 4M9 11l5-5 4 4-5 5zM13 20h8',
  eraser: 'M20 20H8l-5-5a1.5 1.5 0 0 1 0-2L13 3a1.5 1.5 0 0 1 2 0l6 6a1.5 1.5 0 0 1 0 2l-9 9M7 11l6 6',
  arrow: 'M5 19L19 5M10 5h9v9',
  rect: 'M4 6h16v12H4z',
  ellipse: 'M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff: 'M3 3l18 18M10.6 5.1C11 5 11.5 5 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  laser: 'M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8',
  present: 'M3 4h18v12H3zM8 20h8M12 16v4M10 8l5 2-5 2z',
  fullscreen: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  exitFull: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5',
  quiet: 'M3 3l18 18M4 7h7M4 12h9M4 17h6M15 7h5',
  close: 'M6 6l12 12M18 6L6 18',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4',
  book: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5',
  swap: 'M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4',
  annotate: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  library: 'M4 19V5M8 19V5M12 19l3-14M16 19l4-14M3 21h18',
};

export default function Icon({ name, size = 20, className = '', strokeWidth = 1.9 }) {
  const d = P[name] || P.close;
  return (
    <svg className={`ib-ic ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}
