import React from 'react';
// تم تعديل المسار هنا ليكون دقيقاً ومطابقاً لبيئة العمل الخاصة بك
import { useStore } from '@/store/useStore';
// نستورد مكون الرفع اللي اتفقنا نحافظ عليه
import ExcelUploader from './ExcelUploader'; 

export const GradebookModule = () => {
  const { studentsData = [], settings = { subject: '', year: '' }, clearData } = useStore();

  return (
    <div className="w-full p-6 space-y-6 bg-white border border-gray-100 rounded-2xl shadow-sm" dir="rtl">
      
      {/* الجزء العلوي: العنوان والزراير */}
      <div className="flex justify-between items-center">
        <div className="text-right">
          <h2 className="text-2xl font-bold text-gray-800">نظام رصد الدرجات</h2>
          <p className="text-sm text-gray-500">{settings.subject} - {settings.year}</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* هنا استخدمنا المكون الجاهز بدل تكرار كود الرفع */}
          <ExcelUploader /> 
          
          <button 
            onClick={clearData} 
            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-100"
          >
            مسح البيانات
          </button>
        </div>
      </div>

      {/* جدول عرض الطلاب والدرجات - لا يزال فعالاً ومطلوب */}
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-3 font-semibold text-gray-600 text-right">اسم الطالب</th>
              <th className="py-3 font-semibold text-gray-600 text-right">الدرجة</th>
            </tr>
          </thead>
          <tbody>
            {studentsData.length > 0 ? (
              studentsData.map((student) => (
                <tr key={student.id} className="border-b border-gray-50">
                  <td className="py-3 text-gray-800 text-right">{student.name}</td>
                  <td className="py-3 text-gray-800 font-mono text-right">{student.score}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="py-10 text-center text-gray-400">لا توجد بيانات - يرجى رفع الملف</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};