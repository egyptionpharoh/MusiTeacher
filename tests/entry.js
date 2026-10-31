import React from 'react';
import { createRoot } from 'react-dom/client';
import VirtualLab from '@/components/virtual-lab/VirtualLab';
import Player from '@/app/dashboard/resources/lab/[labId]/page';
const isPlayer = /lab\//.test(location.hash);
if (new URLSearchParams(location.search).get('dark')) document.documentElement.classList.add('dark');
createRoot(document.getElementById('root')).render(isPlayer ? React.createElement(Player) : React.createElement(VirtualLab));
