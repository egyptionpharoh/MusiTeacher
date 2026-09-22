'use client';

import dynamic from 'next/dynamic';

const NoorMarkModule = dynamic(
  () => import('@/features/NoorMark/NoorMark-Frontend/src/App'),
  { ssr: false }
);

export default function NoorMarkClient() {
  return <NoorMarkModule />;
}