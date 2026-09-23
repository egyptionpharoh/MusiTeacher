import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useStore } from './store/useStore';
import './style.css';
import LandingPage from './LandingPage';
import toast, { Toaster } from 'react-hot-toast';

const headerThemes = [
  { value: 'blue', label: 'الهيدر الأزرق الملكي ' },
  { value: 'navy', label: 'الهيدر الوردي' }, 
  { value: 'royal-blue', label: 'الهيدر الأزرق الداكن' },
  { value: 'maroon', label: 'الهيدر النبيتي الملكي ' },
  { value: 'emerald', label: 'الهيدر البنفسجي' },
  { value: 'classic-school', label: 'الهيدر الرمادي ' },
  { value: 'arabic-art', label: 'الهيدر الديواني' },
  { value: 'gold', label: 'الهيدر الذهبي' },
  { value: 'simple', label: 'الهيدر الأبيض ' }
];

export default function App() {
  const { settings, setSettings, setStudentsData, studentsData, reportMode, setReportMode } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [headerTheme, setHeaderTheme] = useState("blue");
  const [isStarted, setIsStarted] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMessage(null);
    setStudentsData([]);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 8, defval: "" });

        const firstRowKeys = Object.keys(jsonData[0] || {});
        const isMusicFile = firstRowKeys.some(key => key.includes('الشفوي') || key.includes('العزف'));
        
        if (jsonData.length === 0 || !isMusicFile) {
            setErrorMessage("عفواً، هذا الملف لا يبدو كملف درجات مهارات موسيقية صالح من منصة نور.");
            setIsLoading(false);
            return;
        }

        const students: any[] = [];

        jsonData.forEach((row: any, index: number) => {
          const name = row['اسم الطالب'];
          const totalScore = row['المجموع'];

          if (name) {
            const studentObj: any = {
              id: index + 1,
              name: name,
              score: totalScore || '0',
            };

            if (reportMode === 'detailed') {
              const keys = Object.keys(row);
              
              const getScore = (keyword: string) => {
                const key = keys.find(k => k.includes(keyword));
                return key ? row[key] : '0';
              };

              studentObj.oral = getScore('الشفوي');
              studentObj.rhythmic = getScore('الإيقاعي');
              studentObj.melodic = getScore('الغنائي');
              studentObj.playing = getScore('العزف');
              studentObj.chanting = getScore('الإنشاد');
            }

            students.push(studentObj);
          }
        });

        setStudentsData(students);
        
        if (jsonData.length > 0 && jsonData[0]['الصف']) {
           setSettings({ className: jsonData[0]['الصف'] });
        }

        toast.success('تم استخراج الدرجات بنجاح  🎉');
        setUploadedFileName(file.name);
        localStorage.setItem('noormark_filename', file.name);
      } catch (error) {
        console.error(error);
        setErrorMessage("حصلت مشكلة أثناء قراءة الملف. تأكد إنه ملف نور الصحيح.");
      } finally {
        setIsLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const exportToCSV = () => {
    if (studentsData.length === 0) {
      toast.error('لا توجد بيانات لتصديرها');
      return;
    }

    const sortedStudents = [...studentsData].sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    let csvContent = "اسم الطالب,الدرجة\n";
    sortedStudents.forEach(student => {
      const cleanScore = String(student.score).split('/')[0].trim();
      csvContent += `${student.name},${cleanScore}\n`;
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const savedFileName = uploadedFileName || localStorage.getItem('noormark_filename');
    const baseFileName = savedFileName ? savedFileName.replace(/\.[^/.]+$/, "") : `درجات_البوابة_${settings.subject || 'المادة'}`;
    link.download = `${baseFileName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isStarted) {
    return <LandingPage onEnter={() => setIsStarted(true)} />;
  }

  return (
    <div dir="rtl" className={headerTheme}>
       <Toaster />
       <div className="toolbar no-print">
          <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'center', marginBottom: '10px' }}>
              <button 
                onClick={() => setReportMode('summary')}
                style={{ backgroundColor: reportMode === 'summary' ? '#226597' : '#ccc', color: '#fff', padding: '5px 15px', borderRadius: '5px' }}
              >
                استمارة رصد درجات
              </button>
              <button 
                onClick={() => setReportMode('detailed')}
                style={{ backgroundColor: reportMode === 'detailed' ? '#226597' : '#ccc', color: '#fff', padding: '5px 15px', borderRadius: '5px' }}
              >
                سجل درجات تفصيلي
              </button>
          </div>
          <label className="custom-file-upload">
              {isLoading ? "⏳ جارٍ المعالجة..." : uploadedFileName ? `📄 ${uploadedFileName}` : "📂 اختر ملف الإكسيل"}
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={isLoading} style={{ display: 'none' }} />
          </label>
          
          <input type="text" placeholder="اسم المادة" value={settings.subject} onChange={(e) => setSettings({ subject: e.target.value })} />
          <input type="text" placeholder="الصف" value={settings.className} onChange={(e) => setSettings({ className: e.target.value })} />
          
          <select value={settings.term} onChange={(e) => setSettings({ term: e.target.value })}>
              <option value="الأول">الفصل الدراسي الأول</option>
              <option value="الثاني">الفصل الدراسي الثاني</option>
          </select>
          
          <input type="text" placeholder="العام الدراسي" value={settings.year} onChange={(e) => setSettings({ year: e.target.value })} />
          <input type="text" placeholder="اسم المعلم /ة" value={settings.teacher} onChange={(e) => setSettings({ teacher: e.target.value })} />
          <input type="text" placeholder="اسم مدير المدرسة /ة" value={settings.principal} onChange={(e) => setSettings({ principal: e.target.value })} />
          <select onChange={(e) => setHeaderTheme(e.target.value)} value={headerTheme}>
              {headerThemes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          
          <button onClick={() => window.print()}>طباعة كـ PDF احترافي</button>
          <button 
            onClick={exportToCSV}
            style={{ backgroundColor: '#10b981', color: 'white', border: 'none' }}
          >
            تصدير للبوابة (CSV)
          </button>
       </div>

       {isLoading && <div style={{ textAlign: 'center', padding: '10px', color: '#1e3a8a', fontWeight: 'bold' }}>⏳ جارٍ المعالجة...</div>}
       {errorMessage && <div style={{ textAlign: 'center', color: '#dc2626', padding: '10px' }}>⚠️ {errorMessage}</div>}

       <div className="page" id="printArea">
          <div className={`header ${headerTheme}`}>
             <h1>{reportMode === 'summary' ? 'استمارة رصد' : 'سجل'} درجات في مادة <span>{settings.subject}</span></h1>
             <p>الصف: <span>{settings.className}</span> | الفصل الدراسي: <span>{settings.term}</span> | العام الدراسي: <span>{settings.year}</span></p>
          </div>
          <table id="gradeTable">
              <thead>
                  <tr>
                      <th style={{ width: reportMode === 'summary' ? "10%" : "5%" }}>م</th>
                      <th style={{ width: reportMode === 'summary' ? "60%" : "25%" }}>اسم الطالب / ة</th>
                      {reportMode === 'detailed' && (
                          <>
                              <th style={{ width: "12%" }}>الشفوي</th>
                              <th style={{ width: "12%" }}>الإيقاعي</th>
                              <th style={{ width: "12%" }}>الغنائي</th>
                              <th style={{ width: "12%" }}>العزف</th>
                              <th style={{ width: "12%" }}>الإنشاد</th>
                          </>
                      )}
                      <th style={{ width: reportMode === 'summary' ? "30%" : "10%" }}>المجموع</th>
                  </tr>
              </thead>
              <tbody>
                  {studentsData.map((student: any) => (
                      <tr key={student.id}>
                          <td>{student.id}</td>
                          <td style={{ textAlign: 'right', paddingRight: '10px' }}>{student.name}</td>
                          {reportMode === 'detailed' && (
                              <>
                                  <td>{String(student.oral || '0').split('/')[0]}</td>
                                  <td>{String(student.rhythmic || '0').split('/')[0]}</td>
                                  <td>{String(student.melodic || '0').split('/')[0]}</td>
                                  <td>{String(student.playing || '0').split('/')[0]}</td>
                                  <td>{String(student.chanting || '0').split('/')[0]}</td>
                              </>
                          )}
                          <td style={{ fontWeight: 'bold' }}>
                              {String(student.score).split('/')[0]}
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>

          <div className="signatures">
              <div><div>توقيع معلم المادة</div><div className="sign-name">{settings.teacher}</div></div>
              <div><div>يعتمد ، مدير المدرسة</div><div className="sign-name">{settings.principal}</div></div>
          </div>
       </div>
    </div>
  );
}