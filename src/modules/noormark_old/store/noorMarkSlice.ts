import { StateCreator } from 'zustand';

// 1. تحديد الأنواع (Types) بدقة
export interface Student {
  id: number;
  name: string;
  score: string | number;
  [key: string]: any; 
}

export interface NoorMarkState {
  settings: {
    subject: string;
    grade: string;
    term: string;
    year: string;
    teacherId: string;
    schoolId: string;
    themeColor: string;
    teacher: string;
    principal: string;
    isDarkMode: boolean; 
  };
  studentsData: Student[];
  updateStudent: (id: number, field: string, value: any) => void;
  setSettings: (newSettings: Partial<NoorMarkState['settings']>) => void;
  setStudentsData: (data: Student[]) => void;
  clearData: () => void;
  // إضافة التعريف هنا لإنهاء الكسر:
  linkUser: (user: { id: string, name: string }) => void; 
}

// 2. بناء الـ Slice الخاص بنورمارك
export const createNoorMarkSlice: StateCreator<NoorMarkState> = (set) => ({
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
  
  updateStudent: (id, field, value) => set((state) => ({
    studentsData: state.studentsData.map(s => s.id === id ? { ...s, [field]: value } : s)
  })),

  setSettings: (newSettings) => set((state) => ({ 
    settings: { ...state.settings, ...newSettings } 
  })),

  // هنا الدالة موجودة بالفعل، والآن الـ Interface يتعرف عليها
  linkUser: (user) => set((state) => ({
    settings: { ...state.settings, teacherId: user.id, teacher: user.name }
  })),

  setStudentsData: (data) => set({ studentsData: data }),

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
      isDarkMode: false,
    } 
  }),
});