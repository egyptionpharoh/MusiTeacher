'use client';
import { read, utils } from 'xlsx';
import { useStore } from '@/store/useStore'; // تأكد من مسار الـ RootStore عندك
import { Upload } from 'lucide-react';

export default function ExcelUploader() {
  const setStudentsData = useStore((state) => state.setStudentsData);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = utils.sheet_to_json(ws);
      
      // هنا نقوم بتحويل بيانات الإكسيل لتناسب واجهة Student الخاصة بنا
      setStudentsData(data as any);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="border-2 border-dashed border-gray-400 p-8 rounded-xl text-center hover:border-blue-500 transition-colors">
      <input type="file" onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" id="excel-upload" />
      <label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center gap-2">
        <Upload size={40} className="text-blue-500" />
        <span className="font-bold">ارفع كشف الدرجات (Excel)</span>
      </label>
    </div>
  );
}