import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set) => ({
      settings: {
        subject: 'مهارات موسيقية',
        school: 'مدرسة طلحة بن عبيدالله للبنين',
        className: '',
        term: 'الفصل الدراسي الثاني',
        year: '2025/2026',
        teacher: 'ا. حسين محمد سيد عبدالعال',
        principal: 'ا/. محمد بن عديم الجابري',
        themeColor: '#113f67',
        isDarkMode: false,
      },
      studentsData: [],
      setSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      setStudentsData: (data) => set({ studentsData: data }),
      updateStudent: (id, field, value) => set((state) => ({
        studentsData: state.studentsData.map(s => s.id === id ? { ...s, [field]: value } : s)
      })),
    }),
    { name: 'gradebook-storage' }
  )
);