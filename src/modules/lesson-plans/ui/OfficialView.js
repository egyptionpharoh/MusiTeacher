'use client';
// 📘 «Plan Generator» الأصلي كما هو (القوائم المترابطة + مؤثر الكتابة + نفس التصميم)، مع إضافتين:
//  • اختيار العام الدراسي • تذكّر آخر اختيارات المعلم (لكل حساب على حدة) عند العودة للأداة
import { useEffect, useMemo, useRef, useState } from 'react';
import { OFFICIAL_YEAR } from '../core/importPlan.js';
import { loadSelection, saveSelection } from './storage';

export default function OfficialView({ plansData, uid, onUseAsDraft }) {
  const years = [OFFICIAL_YEAR];
  const saved = useMemo(() => loadSelection(uid) || {}, [uid]);
  const valid = (sem, gr, les) => !!(sem && plansData[sem] && (!gr || plansData[sem][gr]) && (!les || (gr && plansData[sem][gr][les])));
  const init = valid(saved.semester, saved.grade, saved.lesson) ? saved : {};
  const [year, setYear] = useState(years.includes(saved.year) ? saved.year : OFFICIAL_YEAR);
  const [semester, setSemester] = useState(init.semester || '');
  const [grade, setGrade] = useState(init.grade || '');
  const [lesson, setLesson] = useState(init.lesson || '');
  const [isLoading, setIsLoading] = useState(false);
  const [planDetails, setPlanDetails] = useState(() => (init.lesson ? plansData[init.semester][init.grade][init.lesson] : null));
  const [displayedText, setDisplayedText] = useState('');
  const timer = useRef(null);

  const semesters = Object.keys(plansData);
  const grades = semester ? Object.keys(plansData[semester]) : [];
  const lessons = semester && grade ? Object.keys(plansData[semester][grade]) : [];

  useEffect(() => { saveSelection(uid, { year, semester, grade, lesson }); }, [uid, year, semester, grade, lesson]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleSemesterChange = (e) => { setSemester(e.target.value); setGrade(''); setLesson(''); setPlanDetails(null); setDisplayedText(''); };
  const handleGradeChange = (e) => { setGrade(e.target.value); setLesson(''); setPlanDetails(null); setDisplayedText(''); };
  // نفس سلوك الأداة الأصلية: تحميل قصير ثم عرض نتيجة الدرس بمؤثر الكتابة
  const handleLessonChange = (e) => {
    const val = e.target.value;
    setLesson(val);
    clearTimeout(timer.current);
    if (val) {
      setIsLoading(true); setPlanDetails(null); setDisplayedText('');
      timer.current = setTimeout(() => {
        const data = plansData[semester]?.[grade]?.[val];
        setPlanDetails(data || { duration: 'غير متوفرة', weeks: 'غير متوفر', expectedDates: 'غير متوفر' });
        setIsLoading(false);
      }, 2000);
    } else { setPlanDetails(null); setDisplayedText(''); }
  };

  // تأثير الآلة الكاتبة لعرض الخطة (كما في الأداة الأصلية)
  useEffect(() => {
    if (!planDetails) return undefined;
    const cleanDates = (planDetails.expectedDates || '').replace(/\/+$/, '');
    const textToType = `📌 الأسابيع المخصصة لعرض الدرس: ${planDetails.weeks}\n📅 التواريخ المقررة وفقاً للخطة الدراسية للعام الدراسي ‎${year}‎: ‎${cleanDates}‎`;
    let i = 0;
    setDisplayedText('');
    const typingInterval = setInterval(() => {
      if (i < textToType.length) { setDisplayedText((prev) => prev + textToType.charAt(i)); i++; } else clearInterval(typingInterval);
    }, 30);
    return () => clearInterval(typingInterval);
  }, [planDetails, year]);

  const sel = 'w-full bg-gray-900/90 border border-gray-700 hover:border-cyan-500/60 hover:shadow-[0_0_15px_rgba(34,211,238,0.15)] rounded-xl p-4 text-white focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all duration-300 disabled:opacity-40 disabled:hover:border-gray-700 disabled:hover:shadow-none shadow-inner cursor-pointer';

  return (
    <div className="lp-official p-5 md:p-8 bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white rounded-3xl space-y-8" dir="rtl">
      <header className="text-center space-y-4">
        <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-l from-cyan-400 via-blue-500 to-purple-500 leading-normal pb-2" dir="ltr">Plan Generator</h2>
        <p className="text-gray-300 text-lg md:text-xl font-light tracking-wide">حدد الدرس ليقوم <span className="font-semibold text-cyan-400"> مُولِّد الخطط الفصلية الذكي</span> بتوليد الاسبوع والتاريخ المقرر لعرض الدرس</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-5 shadow-2xl relative z-10">
        <select value={year} onChange={(e) => setYear(e.target.value)} className={sel} aria-label="العام الدراسي">
          {years.map((y) => <option key={y} value={y}>العام الدراسي {y}</option>)}
        </select>
        <select value={semester} onChange={handleSemesterChange} className={sel} aria-label="الفصل الدراسي">
          <option value="">-- اختر الفصل الدراسي --</option>
          {semesters.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={grade} onChange={handleGradeChange} disabled={!semester} className={sel} aria-label="الصف">
          <option value="">-- اختر الصف --</option>
          {grades.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={lesson} onChange={handleLessonChange} disabled={!grade} className={sel} aria-label="الدرس">
          <option value="">-- اختر الدرس --</option>
          {lessons.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="min-h-[260px] backdrop-blur-xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/30 rounded-3xl p-7 md:p-9 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-500">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/10 blur-[100px] pointer-events-none" />
        {!lesson && !isLoading && (
          <div className="flex flex-col items-center justify-center text-gray-500 space-y-4 min-h-[200px]">
            <svg className="w-16 h-16 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            <p className="text-lg">في انتظار تحديد الدرس لبدء التحليل وبناء الخطة...</p>
          </div>
        )}
        {isLoading && (
          <div className="flex flex-col items-center justify-center space-y-6 min-h-[200px] text-cyan-400">
            <div className="relative w-16 h-16"><div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full" /><div className="absolute inset-0 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin" /></div>
            <p className="animate-pulse font-medium text-lg tracking-wide">الذكاء الاصطناعي يقوم بتحليل وتوليد الخطة الزمنية...</p>
          </div>
        )}
        {planDetails && !isLoading && (
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-5">
              <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
              <h3 className="text-2xl font-semibold text-cyan-300">نتيجة البحث</h3>
            </div>
            <div className="text-xl md:text-2xl leading-loose text-gray-200 font-medium tracking-wide space-y-4">
              {displayedText.split('\n').map((line, idx, arr) => {
                const colonIdx = line.indexOf(':');
                const cursor = idx === arr.length - 1 ? <span className="inline-block w-3 h-7 bg-gradient-to-b from-cyan-300 to-blue-500 mx-1 animate-pulse align-middle rounded-sm shadow-[0_0_10px_rgba(34,211,238,0.8)]" /> : null;
                const color = idx === 0 ? 'text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]' : idx === 1 ? 'text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]' : '';
                if (idx <= 1 && colonIdx !== -1) {
                  return <div key={idx}><span className={`font-bold ${color} ml-2`}>{line.slice(0, colonIdx + 1)}</span><span className="text-gray-200 [unicode-bidi:isolate]" dir="rtl">{line.slice(colonIdx + 1)}{cursor}</span></div>;
                }
                return <div key={idx}><span className={idx <= 1 ? `font-bold ${color}` : 'text-gray-200 [unicode-bidi:isolate]'} dir="rtl">{line}{cursor}</span></div>;
              })}
            </div>
          </div>
        )}
      </div>

      {semester && grade && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-gray-300 text-sm leading-7">هذه الخطة العامة المدمجة في المنصة. لربط دروس {grade} بحصصك الفعلية وتسجيل ما تنفذه، أنشئ منها خطتك الخاصة (تبقى في حسابك فقط).</p>
          <button type="button" onClick={() => onUseAsDraft(semester, grade)} className="px-4 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 font-bold hover:bg-cyan-500/25 transition">استخدامها كنقطة بداية لخطتي</button>
        </div>
      )}
    </div>
  );
}
