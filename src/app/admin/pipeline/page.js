'use client';
import { useState, useRef, useEffect } from 'react';
import AppHeader from '../../../components/AppHeader'; // تأكد من صحة المسار
import { CheckCircle, XCircle } from 'lucide-react'; // استدعاء الأيقونات

// داتا المنهج (كما هي)
const semesterOneData = {
  "الصف الأول": ["النشيد الوطني", "العلامة الإيقاعية النوار والسكتة المقابلة لها", "الحدة والغلظة - السرعة والبطء", "اللعبة الشعبية (حبوه موه تدوري)", "المدرج الموسيقي ومفتاح صول", "تطبيقات على المدرج الموسيقي"],
  "الصف الثاني": ["النشيد الوطني", "سلم (دو) الكبير وإشارات اليد الدالة على الأثر النفسي", "تدريبات صوتية وغنائية", "العلامة الإيقاعية البلانش والسكتة المقابلة لها", "نشيد (أقسمت أحبك يا وطني)", "الشدة والخفوت"],
  "الصف الثالث": ["نشيد (موطني)", "الشكل الإيقاعي (طفاتيفي)", "الكريشيندو والديمنويندو", "التيمينة", "آلة الإكسيلوفون", "عزف مقطوعة موسيقية على آلة الإكسيلوفون"],
  "الصف الرابع": ["تدريبات صوتية بالتظليلات", "نشيد (علم بلادي)", "الشكل الإيقاعي (طفاتي)", "نشيد (سلامتي)", "آلة الأورج", "عزف مقطوعة موسيقية على آلة الأورج"],
  "الصف الخامس": ["نشيد (نهضة متجددة)", "الميزان الرباعي", "العلامة الإيقاعية (الروند) والسكتة المقابلة لها", "آلة الأوكورديون", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية على آلة الأكورديون"],
  "الصف السادس": ["الأزمنة الأساسية وتقسيماتها", "نشيد (عُمان عظيمة بشعبها )", "التمييز السمعي", "الشكل الإيقاعي (طفافي)", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية"],
  "الصف السابع": ["نشيد (وَحْيُ الإِلْهَامِ).", "الرِّباط الزَّمَنِي والنُّقْطَة الزَّمَنِيَّة.", "الشَّكْلان الإِيقاعيَّان (تافي&تافا).", "شَخْصيَّة موسيقيَّة عالميَّة (موتسارت).", "قِراءَة إِيقاعيَّة وصولفيج غِنائي.", "عَزْف مَقْطوعَة موسيقيَّة."],
  "الصف الثامن": ["فَنَّا (البَرْعة) و(طَبْل النِّساء).", "نشيدان من فَنَّي (البرعة) و(طبل النِّساء).", "ابتكارات لحنية.", "أبعاد سلَّم (دو) الكبير.", "قراءة إيقاعية وصولفيج غنائي.", "عزف مقطوعة موسيقية."],
  "الصف التاسع": ["الحبال الصوتية والجهاز التنفسي", "العيوب الشائعة في الغناء وطرق معالجتها", "تدريبات لتحسين مستوى الصوت", "الدور", "إنشاد دور يا من به تجلى الكروب", "عزف موسيقا الدور", "الآلات الإيقاعية العربية", "ضربي سماعي سربند وسماعي ثقيل", "استماع وتذوق موسيقا عربية سماعي بياتي"],
  "الصف العاشر": ["مفتاح ( فا ) الخط الرابع", "سلم ( فا ) الكبير وسلم ( رى ) الصغير الهارموني", "التآلف الكبير والتآلف الصغير", "فن المولد", "نشيد (يا نبي سلام عليك)", "آلات من التراث العماني", "العصر الرومانسي (الرومانتيكي) (١٨٠٠ - ١٩٠٠)", "جوزيبه فردي (١٨١٣ - ١٩٠١)", "عزف مقطوعة موسيقية"],
  "الصف الحادي عشر": [
  "1. عنصر الإيقاع",
"2. عنصر النغم",
"3. عنصر التعبير (التظليل)",
"4. التآلفات الهارمونية",
"5. المصاحبة الهارمونية",
"6. عزف الألحان الهارمونية",
"7. نبذة تاريخية لآلة الجيتار",
"8. مكونات آلة الجيتار",
"9. طريقة العزف على آلة الجيتار",
"10. فن الصوت",
"11. من فن الصوت (صوت عمان الجميلة)",
  ],
  "الصف الثاني عشر": ["الطبقات الصوتية", "التنفس والرنين", "تدريبات عملية لتربية الصوت", "قواعد هارمونية", "مصاحبة هارمونية", "عزف تآلفات هارمونية", "انتشار الموسيقا في الأندلس", "زرياب (٧٧٧م - ٨٥٢م)", "الموشحات الأندلسية"]};
const semesterTwoData = {
  "الصف الأول": ["نشيد (أرقامي)", "العلامة الإيقاعية الكروش والسكتة المقابلة لها", "إيقاع حركي", "نشيد (أسرتي)", "آلات الباند", "عزف مقطوعة على آلات الباند"],
  "الصف الثاني": ["اللعبة الشعبية (حدلجي مدلجي)", "الميزان الثنائي", "قراءة إيقاعية وغناء صولفائي", "نشيد (أركان الإسلام)", "عزف مقطوعة موسيقية على آلات الباند", "إيقاع حركي للبلانش (ل)"],
  "الصف الثالث": ["نشيد (الصوم)", "الشكل الإيقاعي ()1", "إيقاع حركي ()", "نشيد (نظافتي)", "قراءة إيقاعية وغناء صولفائي", "النغمات الصاعدة والهابطة والمتكررة"],
  "الصف الرابع": ["اللعبة الشعبية (تراني بقطع السناسل)", "الميزان الثلاثي", "إيقاع حركي ()1", "نشيد (حرف الأجداد)", "أربيج سلم (دو) الكبير", "قراءة إيقاعية وغناء صولفائي"],
  "الصف الخامس": ["فنا (الرزحة) و (الكيذا)", "نشيدان من فني (الرزحة) و (الكيذا)", "التمييز بين الموازين الموسيقية البسيطة", "إملاء إيقاعي", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية"],
  "الصف السادس": ["فنا (المديمة) و (الحمبورة)", "نشيدان من فني (المديمة) و (الحمبورة)", "إملاء إيقاعي", "المرجع (ذو الخطين)", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية"],
  "الصف السابع": ["فَنَّا (العَيَّالَة) و(الويْليَّة)", "نشيدان من فَنَّي (العيَّالة) و(الويْليَّة)", "إملاء ايقاعي", "العبارات والقفلات الموسيقية", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية"],
  "الصف الثامن": ["علامات التَّحويل (الدييز - البيمول - البيكار)", "قراءة إيقاعية وصولفيج غنائي.", "عزف مقطوعة موسيقية.", "Song Of «Dreams Within Reach»", "إملاء إيقاعي.", "التَّدوين الموسيقي الرَّقمي."],
  "الصف التاسع": ["فن العيالة", "تطبيق ايقاع العيالة والآلات الإيقاعية المستخدمة فيه", "نشيد بلادنا تفتدى", "الاوركسترا السيمفوني", "الصيغ الموسيقية", "السيمفونية", "إنشاد نشيد سبحان ربي", "قراءة ايقاعيه ونغميه لموسيقي نشيد سبحان ربي", "عزف موسيقا لنشيد سبحان ربي"],
  "الصف العاشر": ["مقام الكرد", "عزف مقطوعة موسيقية", "نشيد (الولاء)", "( الدولاب - البشرف - اللونجا )", "رياض السنباطي (١٩٠٦-١٩٨١)", "عزف مقطوعة موسيقية", "دراسة آلة ( البيانو )", "الكانون (المحاكاة) في الموسيقا", "عزف موسيقا ((نشيد الفرح)) لبيتهوفن"],
  "الصف الحادي عشر": ["الصفراوي (قيثارة الوطن)", "تطبيقات", "السلالم الكبيرة", "الموازين المركبة والمقابلات الإيقاعية", "التآلفات اللحنية", "تطبيقات", "محمد القصبجي", "تحليل مقطوعة موسيقيه (ذكرياتي)", "عزف مقطوعة ذكرياتي", "تطبيقات", "عصر الباروك", "يوهان سباستيان باخ", "فن الاوبرا"],
  "الصف الثاني عشر": ["تصوير السلالم والألحان", "الأشكال الإيقاعية الغير مألوفة", "صولفيج غنائي", "فن الشرح", "شخصية عمانية ( محمد حبريش )", "نشيد ( نور العلم ) من فن الشرح", "مراجعة المقامات السابقة", "مقامات ( الحجاز ، والصبا ، والعجم عشيران )", "عزف مقطوعات موسيقية صغيرة", "موسيقا الشعوب", "العصر الحديث وبعض رواده", "عزف مقطوعة موسيقية من العصر الحديث", "ضروب عربية", "((البشرف))", "استماع وتذوق"]
};

const syllabusData = {
  "الفصل الدراسي الأول": semesterOneData,
  "الفصل الدراسي الثاني": semesterTwoData
};

export default function SmartContentEditor() {
  const [metadata, setMetadata] = useState({ semester: '', grade: '', title: '' });
  const proceduresRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  // حالة التوست الجديد
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const availableGrades = metadata.semester ? Object.keys(syllabusData[metadata.semester] || {}) : [];
  const availableLessons = (metadata.semester && metadata.grade) ? syllabusData[metadata.semester][metadata.grade] || [] : [];

  // دالة تشغيل التوست
  const showToastMessage = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 4000); // التوست بيختفي لوحده بعد 4 ثواني
  };

  const handleSemesterChange = (e) => {
    setMetadata({ semester: e.target.value, grade: '', title: '' });
  };

  const handleGradeChange = (e) => {
    setMetadata({ ...metadata, grade: e.target.value, title: '' });
  };

  const handleSaveToBank = async () => {
    if (!metadata.semester || !metadata.grade || !metadata.title) {
      showToastMessage("يا ملك لازم تختار الفصل والصف وعنوان الدرس الأول!", "error");
      return;
    }

    setIsSaving(true);
    try {
      const editorClone = proceduresRef.current.cloneNode(true);
      
      const extractedImages = [];
      const imageNodes = editorClone.querySelectorAll('img');
      imageNodes.forEach((img, index) => {
        extractedImages.push(img.src);
        const placeholder = document.createTextNode(`[صورة_${index + 1}]`);
        img.parentNode.replaceChild(placeholder, img);
      });

      let rawJsonText = editorClone.textContent;
      
      // --- بداية كود التنظيف والإصلاح الذكي للـ JSON ---
      
      // 1. إزالة وسوم الكود (Markdown) مثل ```json و ```
      rawJsonText = rawJsonText.replace(/```json/gi, '').replace(/```/g, '');

      // 2. تنظيف الحروف المخفية غير المرئية
      rawJsonText = rawJsonText.replace(/[\uFFFC\u200B\u200C\u200D\uFEFF]/g, '');

      // 3. تحويل علامات التنصيص المائلة والعربية (“” « ») إلى مفردة (') حتى لا تكسر الـ JSON
      rawJsonText = rawJsonText.replace(/[“”«»]/g, "'");

      // 4. معالجة علامات التنصيص المزدوجة الداخليّة الملتصقة بنصوص عربية وتحويلها لمفردة (')
      rawJsonText = rawJsonText.replace(/([\u0600-\u06FF]\s*)"([\u0600-\u06FF])/g, "$1'$2");

      // 5. إزالة الفواصل الزائدة قبل الأقواس المغلقة
      rawJsonText = rawJsonText.replace(/,\s*([\}\]])/g, '$1');

      // 6. إصلاح مشكلة انفصال علامات التنصيص حول الصورة
      rawJsonText = rawJsonText.replace(/"\s*\[(صورة_\d+)\]\s*"/g, ' [$1] ');
      rawJsonText = rawJsonText.replace(/"\s*\[(صورة_\d+)\]\s*,/g, ' [$1]",');
      
      // 7. تأمين الأسطر الجديدة (Enter) والمسافات الخاصة داخل النصوص
      let safeJson = '';
      let isInsideString = false;
      let isEscaped = false;
      
      for (let i = 0; i < rawJsonText.length; i++) {
        const char = rawJsonText[i];
        if (isEscaped) { safeJson += char; isEscaped = false; continue; }
        if (char === '\\') { safeJson += char; isEscaped = true; continue; }
        if (char === '"') { isInsideString = !isInsideString; safeJson += char; continue; }
        
        // تحويل Enter والـ Tab داخل النصوص إلى رموز آمنة للـ JSON
        if (char === '\n' || char === '\r') {
          if (isInsideString) {
            safeJson += '\\n';
          } else {
            safeJson += char;
          }
        } else if (char === '\t') {
          if (isInsideString) {
            safeJson += '\\t';
          } else {
            safeJson += char;
          }
        } else {
          safeJson += char;
        }
      }
      // --- نهاية كود التنظيف ---

      let parsedLesson;
      try {
        parsedLesson = JSON.parse(safeJson);
      } catch (parseErr) {
        console.error("خطأ JSON:", parseErr);
        showToastMessage("يوجد خطأ في بنية النص، تأكد من عدم مسح أقواس بالخطأ!", "error");
        setIsSaving(false);
        return;
      }

      const updatedMetadata = {
        ...metadata,
        lessonScreenshots: extractedImages
      };

      const lessonPayload = {
        metadata: updatedMetadata,
        core: parsedLesson.core,
        precomputed_ai: {}
      };

      const res = await fetch('/api/admin/save-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lessonPayload)
      });

      const result = await res.json();
      if (result.success) {
        showToastMessage('تسلم إيدك يا ملك.. تم حفظ الدرس والصور في البنك بنجاح 🚀', 'success');
        proceduresRef.current.innerHTML = '';
        setMetadata({ ...metadata, title: '' }); 
      } else {
        showToastMessage('حصل مشكلة: ' + result.error, 'error');
      }
    } catch (error) {
      console.error(error);
      showToastMessage('خطأ في الاتصال بالخادم!', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center pb-32 transition-colors duration-1000 bg-transparent" dir="rtl">
      
      <AppHeader /> 
      
      {/* تصميم التوست العائم (يظهر ويختفي بأنيميشن سلس) */}
      <div 
        className={`fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500 ease-in-out ${
          toast.show ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95 pointer-events-none'
        }`}
      >
        <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-md border font-bold text-lg ${
          toast.type === 'success' 
            ? 'bg-emerald-600/90 border-emerald-400 text-white dark:bg-emerald-900/90' 
            : 'bg-red-600/90 border-red-400 text-white dark:bg-red-900/90'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={28} /> : <XCircle size={28} />}
          <span>{toast.message}</span>
        </div>
      </div>

      <div className="w-full max-w-5xl mt-32 p-4">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text mb-8 drop-shadow-md text-center" style={{ backgroundImage: 'var(--text-gradient-primary)' }}>
          مصنع إدخال الدروس (نوت بوك LM إلى JSON)
        </h1>

        {/* الميتاداتا */}
        <div className="glass-card p-8 rounded-3xl mb-8 transition-all duration-500 relative overflow-hidden">
          <h2 className="text-xl font-bold mb-4 text-stone-800 dark:text-cyan-300">1. بيانات الدرس</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <select 
              value={metadata.semester} 
              onChange={handleSemesterChange} 
              className="w-full bg-stone-50 hover:bg-stone-100 dark:bg-white/5 text-stone-900 dark:text-white border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500 outline-none transition-all duration-300 dark:backdrop-blur-sm"
            >
              <option value="" disabled className="bg-white dark:bg-[#111827] text-stone-500">اختر الفصل الدراسي...</option>
              <option value="الفصل الدراسي الأول" className="bg-white dark:bg-[#111827]">الفصل الدراسي الأول</option>
              <option value="الفصل الدراسي الثاني" className="bg-white dark:bg-[#111827]">الفصل الدراسي الثاني</option>
            </select>

            <select 
              value={metadata.grade} 
              onChange={handleGradeChange} 
              disabled={!isMounted || !metadata.semester}
              className="w-full bg-stone-50 hover:bg-stone-100 dark:bg-white/5 text-stone-900 dark:text-white border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500 outline-none disabled:opacity-50 transition-all duration-300 dark:backdrop-blur-sm"
            >
              <option value="" disabled className="bg-white dark:bg-[#111827] text-stone-500">اختر الصف...</option>
              {availableGrades.map((g, idx) => (
                <option key={`grade-${idx}-${g}`} value={g} className="bg-white dark:bg-[#111827]">{g}</option>
              ))}
            </select>

            <select 
              value={metadata.title} 
              onChange={(e) => setMetadata({...metadata, title: e.target.value})} 
              disabled={!isMounted || !metadata.grade}
              className="w-full bg-stone-50 hover:bg-stone-100 dark:bg-white/5 text-stone-900 dark:text-white border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500 outline-none disabled:opacity-50 transition-all duration-300 dark:backdrop-blur-sm"
            >
              <option value="" disabled className="bg-white dark:bg-[#111827] text-stone-500">اختر الدرس...</option>
              {availableLessons.map((l, idx) => (
                <option key={`lesson-${idx}-${l}`} value={l} className="bg-white dark:bg-[#111827]">{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* مساحة العمل */}
        <div className="glass-card p-8 rounded-3xl mb-8 transition-all duration-500 relative overflow-hidden">
          <h2 className="text-xl font-bold mb-2 text-stone-800 dark:text-cyan-300">2. إجراءات السير (انسخ النص والصور هنا)</h2>
          
          {/* تعديل 1: العبارة باللون الأبيض في الوضع الليلي فقط */}
          <p className="text-sm text-stone-600 dark:text-white mb-4 transition-colors">
            اضغط بالأسفل واعمل Paste لرد NotebookLM مع صور الاسكرين شوت...
          </p>
          
          {/* المربع الآمن للحفاظ على صناديق الليجو (JSON) والصور معاً */}
          <div 
            ref={proceduresRef}
            contentEditable="true"
            suppressContentEditableWarning={true}
            className="w-full min-h-[300px] max-h-[500px] border-2 border-dashed border-stone-300 dark:border-cyan-500/50 p-6 rounded-xl focus:outline-none focus:border-blue-500 dark:focus:border-cyan-400 bg-white text-stone-900 transition-colors font-mono text-left overflow-auto whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-stone-400"
            data-placeholder="قم بلصق كود JSON الخارج من نوت بوك والصور هنا..."
            dir="ltr"
            onPaste={(e) => {
              // التقاط الصور المنسوخة (Screenshots) وتحويلها للعرض الفوري
              const items = e.clipboardData?.items;
              if (items) {
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.indexOf('image') !== -1) {
                    e.preventDefault(); // نمنع السلوك الافتراضي للصورة فقط حتى لا تضيع
                    const file = items[i].getAsFile();
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const img = document.createElement('img');
                      img.src = event.target.result; // Data URL (Base64)
                      img.className = 'max-w-full rounded-lg my-4 border border-stone-200 shadow-sm';
                      
                      // وضع الصورة في المكان الذي يقف فيه مؤشر الماوس
                      const selection = window.getSelection();
                      if (selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        range.insertNode(img);
                        range.setStartAfter(img);
                        range.setEndAfter(img);
                        selection.removeAllRanges();
                        selection.addRange(range);
                      } else {
                        proceduresRef.current.appendChild(img);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }
              }
            }}
          />
        </div>

        <button 
          onClick={handleSaveToBank}
          disabled={isSaving}
          className="w-full text-white font-bold text-xl px-12 py-5 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50 transition-all duration-300 flex justify-center items-center gap-2"
          style={{ background: 'var(--primary-gradient)' }}
        >
          {isSaving ? 'جاري استخراج الصور وحفظ الدرس...' : 'حفظ في البنك 💾'}
        </button>
      </div>
    </div>
  );
}