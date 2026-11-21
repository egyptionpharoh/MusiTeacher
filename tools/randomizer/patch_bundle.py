# يرقّع حزمة العجلة الكلاسيكية (Vite مصغّرة) بأقل تعديل ممكن:
#  1) محرّر الأسئلة: زر «تعديل» لكل سؤال (يملأ نفس حقول الإضافة) + تحريك لأعلى/لأسفل.
#  2) خطوة «إعداد الاسئلة»: زر اختياري «استيراد أسئلة من درس جاهز» يفتح مكتبة الدروس فوق العجلة.
#  3) استقبال الأسئلة المستوردة (postMessage من إطار المكتبة) وإضافتها لقائمة الأسئلة الحالية.
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, (old[:60], n)
    s = s.replace(old, new)

BLANK = '{left:"",leftImage:"",right:"",rightImage:""}'
# ---- 1) محرّر الأسئلة (vr)
rep('[F,P]=(0,ve.useState)(30),U=()=>{f(!0),',
    '[F,P]=(0,ve.useState)(30),[rzE,rzSE]=(0,ve.useState)(null),'
    'rzB={background:"#fff",border:"1px solid #d5d8dc",borderRadius:"6px",cursor:"pointer",padding:"4px 9px",fontSize:"0.9rem",fontWeight:"bold",color:"#2c3e50"},'
    'rzEdit=w=>{let T=w.type||"ESSAY",OP=Array.isArray(w.options)?w.options:[];l(T),m(w.text||""),g(w.mediaUrl||""),P(w.timeLimit||30),we(w.targetItemId||"");'
    'if(T==="MULTIPLE_CHOICE"){let L=OP.length>=2?OP:[{text:""},{text:""},{text:""},{text:""}];W(L.map(o=>o.text||"")),b(L.map(o=>o.imageUrl||"")),_(Math.max(0,L.findIndex(o=>o.isCorrect)))}'
    'else if(T==="TRUE_FALSE"){let c=OP.find(o=>o.isCorrect);O(!c||c.text==="صح")}'
    'else if(T==="MATCHING"){let ps=OP.map(o=>{try{return JSON.parse(o.text)}catch{return null}}).filter(Boolean).map(x=>({left:x.left||"",leftImage:x.leftImage||"",right:x.right||"",rightImage:x.rightImage||""}));for(;ps.length<2;)ps.push(' + BLANK + ');re(ps)}'
    'else{let c=OP.find(o=>o.isCorrect)||OP[0];xe(c&&c.text||"")}'
    'rzSE(w.id),f(!0),setTimeout(()=>{let el=document.querySelector("[data-rz-form]");el&&el.scrollIntoView({behavior:"smooth",block:"start"})},60)},'
    'rzMove=(i,k)=>{let j=i+k;if(j<0||j>=e.length)return;let Z=[...e];[Z[i],Z[j]]=[Z[j],Z[i]],t(Z)},'
    'U=()=>{rzSE(null),f(!0),')
# التعديل يحلّ محل السؤال في مكانه بمعرّف جديد (نسخ عند الكتابة): لا يتأثر أي قالب آخر يشير إلى السؤال القديم
rep('t([...e,D]),f(!1)}', 'rzE&&e.some(x=>x.id===rzE)?t(e.map(x=>x.id===rzE?D:x)):t([...e,D]),rzSE(null),f(!1)}')
rep('le=w=>{t(e.filter(N=>N.id!==w))}', 'le=w=>{t(e.filter(N=>N.id!==w)),rzE===w&&(rzSE(null),f(!1))}')
rep('onClick:()=>f(!1)', 'onClick:()=>{rzSE(null),f(!1)}')
rep('d?(0,h.jsxs)("div",{style:{padding:"20px",', 'd?(0,h.jsxs)("div",{"data-rz-form":"1",style:{padding:"20px",')
# نص زر الحفظ أثناء التعديل
i = s.index('onClick:ae,style:'); j = s.index('children:', i); k = s.index('"', j + len('children:') + 1)
assert s[j + len('children:')] == '"'
s = s[:j] + 'children:rzE?"\U0001F4BE حفظ التعديل":' + s[j + len('children:'):]
# أزرار ▲ ▼ ✏️ بجوار «حذف»
rep('(0,h.jsx)("button",{onClick:()=>le(w.id),',
    '(0,h.jsxs)("span",{"data-rz-qtools":"1",style:{display:"flex",gap:"6px",flexShrink:0,marginLeft:"6px"},children:['
    '(0,h.jsx)("button",{type:"button",title:"تحريك لأعلى",disabled:N===0,onClick:()=>rzMove(N,-1),style:{...rzB,opacity:N===0?.35:1},children:"▲"}),'
    '(0,h.jsx)("button",{type:"button",title:"تحريك لأسفل",disabled:N===e.length-1,onClick:()=>rzMove(N,1),style:{...rzB,opacity:N===e.length-1?.35:1},children:"▼"}),'
    '(0,h.jsx)("button",{type:"button","data-rz-edit":"1",title:"تعديل السؤال",onClick:()=>rzEdit(w),style:{...rzB,color:rzE===w.id?"#fff":"#1f618d",background:rzE===w.id?"#1f618d":"#fff"},children:"✏️ تعديل"})]}),'
    '(0,h.jsx)("button",{onClick:()=>le(w.id),')

# صف السؤال يلتف على الشاشات الضيقة (الهاتف) بدل ضغط النص بجوار الأزرار
rep('(0,h.jsxs)("li",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"15px",',
    '(0,h.jsxs)("li",{style:{display:"flex",flexWrap:"wrap",gap:"8px",justifyContent:"space-between",alignItems:"center",padding:"15px",')
i = s.index('(0,h.jsxs)("li",{style:{display:"flex",flexWrap:"wrap"')
j = s.index('children:[(0,h.jsxs)("div",{style:{flex:1}', i)
assert j - i < 400
s = s[:j] + 'children:[(0,h.jsxs)("div",{style:{flex:"1 1 220px",minWidth:0}' + s[j + len('children:[(0,h.jsxs)("div",{style:{flex:1}'):]

# ---- 2) استقبال الأسئلة المستوردة داخل معالج الإعداد (Sr)
rep('},[r]);let Oe=()=>{',
    '},[r]);(0,K.useEffect)(()=>{let rzH=ev=>{let D0=ev.data;'
    'if(ev.origin!==location.origin||!D0||D0.type!=="rz-import"||!Array.isArray(D0.questions)||!ev.source||ev.source===window||ev.source.parent!==window)return;'
    'let Q0=D0.questions.filter(x=>x&&typeof x.id=="string"&&typeof x.text=="string"&&Array.isArray(x.options));if(!Q0.length)return;'
    'v(p0=>{let s0=new Set(p0.map(x=>x.id));return[...p0,...Q0.filter(x=>!s0.has(x.id))]}),C(b0=>({...b0,enableQuestions:!0})),'
    'typeof D0.title=="string"&&D0.title&&d(t0=>t0||D0.title),typeof D0.lessonTitle=="string"&&D0.lessonTitle&&y(c0=>c0||D0.lessonTitle),'
    'q(e0=>({...e0,questions:void 0})),n("QUESTIONS")};'
    'return window.addEventListener("message",rzH),()=>window.removeEventListener("message",rzH)},[]);let Oe=()=>{')

# ---- 3) زر المكتبة داخل «إعداد الاسئلة» (اختياري تمامًا)
rep('(0,a.jsx)(vr,{questions:_,onChange:v,currentStudents:nt,participants:nt})',
    '(0,a.jsxs)("div",{"data-testid":"rz-library-box",style:{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap",padding:"12px 14px",background:"linear-gradient(135deg,#fffaf0,#fbefd0)",border:"2px dashed #d4af37",borderRadius:"10px"},children:['
    '(0,a.jsx)("button",{type:"button","data-testid":"rz-open-library",onClick:()=>window.__rzOpenLibrary&&window.__rzOpenLibrary(),style:{padding:"10px 18px",background:"#8b0000",color:"#fff8dc",border:"1px solid #5c0000",borderRadius:"8px",cursor:"pointer",fontWeight:"bold",fontSize:"1rem",boxShadow:"0 3px 0 #5c0000",fontFamily:"inherit"},children:"\U0001F4DA استيراد أسئلة من درس جاهز"}),'
    '(0,a.jsx)("span",{style:{color:"#5c4033",fontSize:"0.9rem",flex:"1 1 240px",lineHeight:1.6},children:"اختياري: افتح «مكتبة الدروس التفاعلية» واختر الصف والدرس، فتُضاف أسئلته هنا لتراجعها وتعدّلها قبل اللعب."})]}),'
    '(0,a.jsx)(vr,{questions:_,onChange:v,currentStudents:nt,participants:nt})')
# ---- 4) شارة مصدر القالب في «استرداد القوالب المحفوظة»
rep('(0,a.jsx)("h4",{style:{margin:"0 0 4px 0",color:"#3e2723"},children:c.name})',
    '(0,a.jsx)("h4",{style:{margin:"0 0 4px 0",color:"#3e2723"},children:c.name}),'
    '(0,a.jsx)("span",{"data-rz-origin":String(c.id).startsWith("rz_")?"library":(c.questionRefs||[]).some(r=>String(r.questionId).startsWith("imp_"))?"imported":"own",'
    'style:{display:"inline-block",margin:"0 0 6px 0",fontSize:"0.78rem",fontWeight:"bold",padding:"2px 9px",borderRadius:"999px",background:"#f3e5c4",color:"#5c4033",border:"1px solid #d4af37"},'
    'children:String(c.id).startsWith("rz_")?"\U0001F4D7 من مكتبة الدروس":(c.questionRefs||[]).some(r=>String(r.questionId).startsWith("imp_"))?"\U0001F4DA نسختك من أسئلة مكتبة الدروس":"\u270D\uFE0F من إعدادك"})')
open(dst, 'w', encoding='utf-8').write(s)
print('ok', len(s))
