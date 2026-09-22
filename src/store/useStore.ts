import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NoorMarkState } from '../modules/noormark_old/store/noorMarkSlice';

export const useStore = create<NoorMarkState>()(
  persist(
    (set) => ({
      settings: {
        subject: 'المهارات الموسيقية',
        grade: '',
        term: 'الثاني',
        year: '2025 / 2026',
        teacherId: '',
        schoolId: '',
        themeColor: '#113f67',
        teacher: 'اسم المعلم',
        principal: 'اسم المدير',
        isDarkMode: false,
      },
      studentsData: [],
      
      // دالة التعديل المباشر للطالب
      updateStudent: (id, field, value) => set((state) => ({
        studentsData: state.studentsData.map(s => s.id === id ? { ...s, [field]: value } : s)
      })),

      // دالة ربط المستخدم المسجل
      linkUser: (user) => set((state) => ({
        settings: { ...state.settings, teacherId: user.id, teacher: user.name }
      })),

      // دالة تحديث الإعدادات
      setSettings: (newSettings) => set((state) => ({ 
        settings: { ...state.settings, ...newSettings } 
      })),

      // دالة رفع بيانات الطلاب
      setStudentsData: (data) => set({ studentsData: data }),

      // دالة مسح البيانات والعودة للقيم العامة
      clearData: () => set({ 
        studentsData: [], 
        settings: { 
          subject: 'المهارات الموسيقية', 
          grade: '', 
          term: 'الثاني', 
          year: '2025 / 2026',
          teacherId: '',
          schoolId: '',
          themeColor: '#113f67',
          teacher: 'اسم المعلم',
          principal: 'اسم المدير',
          isDarkMode: false 
        } 
      }),
    }),
    { name: 'noormark-storage' }
  )
);