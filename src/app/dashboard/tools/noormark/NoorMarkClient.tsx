'use client';

import dynamic from 'next/dynamic';

const NoorMarkModule = dynamic(
  () => import('@/features/NoorMark/NoorMarkWrapper'),
  { ssr: false }
);

export default function NoorMarkClient() {
  return <NoorMarkModule />;
}