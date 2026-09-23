import { create } from 'zustand';
import { persist } from 'zustand/middleware'; // 1. استيراد ميزة الحفظ الدائم

export const useStore = create(
  persist(
    (set) => ({
      settings: {
        subject: '',
        className: '',
        term: 'الثاني', // صلحنا دي عشان تطابق اللي موجود في App.tsx وتشتغل صح
        year: '2025 / 2026',
        teacher: '',
        principal: '',
      },
      studentsData: [],
      reportMode: 'summary', // 'summary' للكشف المختصر، 'detailed' للسجل التفصيلي
      setSettings: (newSettings) => set((state) => ({ 
        settings: { ...state.settings, ...newSettings } 
      })),
      setStudentsData: (data) => set({ studentsData: data }),
      setReportMode: (mode) => set({ reportMode: mode }),
    }),
    { 
      name: 'noormark-storage' // 2. الاسم الذي سيظهر في متصفحك (في LocalStorage)
    }
  )
);