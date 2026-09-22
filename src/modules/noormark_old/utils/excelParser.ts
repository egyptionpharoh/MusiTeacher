import * as XLSX from 'xlsx';

export const parseNoorExcel = (file: File, reportMode: 'summary' | 'detailed') => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 8, defval: "" });

        // حارس البوابة (Validation)
        const firstRowKeys = Object.keys(jsonData[0] || {});
        const isMusicFile = firstRowKeys.some(key => key.includes('الشفوي') || key.includes('العزف'));
        
        if (jsonData.length === 0 || !isMusicFile) {
          reject("عفواً، هذا الملف لا يبدو كملف درجات مهارات موسيقية صالح.");
          return;
        }

        const students = jsonData.map((row: any, index: number) => {
          const studentObj: any = {
            id: index + 1,
            name: row['اسم الطالب'],
            score: row['المجموع'] || '0',
          };

          if (reportMode === 'detailed') {
            const getScore = (keyword: string) => {
              const key = Object.keys(row).find(k => k.includes(keyword));
              return key ? String(row[key]).split('/')[0] : '0';
            };
            studentObj.oral = getScore('الشفوي');
            studentObj.rhythmic = getScore('الإيقاعي');
            studentObj.melodic = getScore('الغنائي');
            studentObj.playing = getScore('العزف');
            studentObj.chanting = getScore('الإنشاد');
          }
          return studentObj;
        });

        resolve({ students, className: jsonData[0]['الصف'] });
      } catch (error) {
        reject("حصلت مشكلة أثناء قراءة الملف.");
      }
    };

    reader.readAsArrayBuffer(file);
  });
};