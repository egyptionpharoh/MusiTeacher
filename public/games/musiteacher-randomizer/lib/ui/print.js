// =====================================================================
//  الطباعة: ورقة عمل للطالب (بلا إجابات) · مفتاح الإجابات للمعلم · ورقة مراجعة (سؤال + إجابة) · PDF عبر «حفظ كـ PDF».
//  يُبنى المحتوى عند الطلب فقط في #print-root ثم يُفرَّغ بعد الطباعة، فلا يثقل العجلة.
// =====================================================================
import { TYPES, LEVELS, answerText, scrambled, symSVG } from '../core/model.js';
import { GRADE_NAME } from './text.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CSS = `
#print-root{font-family:'Cairo',Tahoma,sans-serif;direction:rtl;color:#000;font-size:12.5pt;line-height:1.55}
#print-root .ph{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:10px}
#print-root .ph h1{font-size:17pt;margin:0}#print-root .ph .b{font-size:9pt;color:#333;text-align:left}
#print-root .info{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin:8px 0 14px;font-size:11pt}
#print-root .info div{border-bottom:1px dotted #555;padding-bottom:2px}
#print-root ol.qs{padding-inline-start:22px;margin:0}
#print-root li.q{margin:0 0 12px;break-inside:avoid;page-break-inside:avoid}
#print-root .qt{font-weight:700}
#print-root .op{display:grid;grid-template-columns:repeat(2,1fr);gap:2px 18px;margin-top:4px}
#print-root .op span:before{content:'◯ ';}
#print-root .op.ord span:before{content:'▢ ';}
#print-root .ln{border-bottom:1px solid #777;height:24px;margin-top:4px}
#print-root .ans{margin-top:3px;font-weight:700;color:#05612c}
#print-root .ans:before{content:'✔ الإجابة: ';}
#print-root .src{font-size:8.5pt;color:#555}
#print-root .sym{direction:ltr;display:inline-block;margin:4px 0;border:1px solid #bbb;border-radius:6px;padding:2px 6px}
#print-root img{max-height:60mm;max-width:80mm;display:block;margin:4px 0}
#print-root .ft{margin-top:16px;border-top:1px solid #000;padding-top:4px;font-size:8.5pt;color:#444;text-align:center}
#print-root .key{display:grid;grid-template-columns:repeat(2,1fr);gap:4px 20px}
`;

function qBlock(q, mode) {
  let h = `<li class="q"><div class="qt">${esc(q.text)}</div>`;
  if (q.sym) h += `<div class="sym">${symSVG(q.sym, 13, '#000')}</div>`;
  if (q.image) h += `<img src="${q.image}" alt="">`;
  if (q.audio) h += '<div class="src">(سؤال سمعي: يُشغَّل الصوت في الحصة)</div>';
  if (q.type === 'MC') h += `<div class="op">${q.options.map((o) => `<span>${esc(o)}</span>`).join('')}</div>`;
  else if (q.type === 'TF') h += '<div class="op"><span>صح</span><span>خطأ</span></div>';
  else if (q.type === 'ORDER') h += `<div class="op ord">${scrambled(q).map((o) => `<span>${esc(o)}</span>`).join('')}</div>${mode === 'student' ? '<div class="ln"></div>' : ''}`;
  else if (mode === 'student') h += `<div class="ln"></div>${q.type === 'OPEN' ? '<div class="ln"></div>' : ''}`;
  if (mode !== 'student') h += `<div class="ans">${esc(answerText(q))}</div>`;
  if (mode === 'review' && q.src) h += `<div class="src">المصدر: ${esc(q.src)} · ${TYPES[q.type].label} · ${LEVELS[q.level]}</div>`;
  return `${h}</li>`;
}

export function printActivity(act, mode = 'student') {
  const root = document.getElementById('print-root');
  const title = { student: 'ورقة عمل', key: 'مفتاح الإجابات (للمعلم)', review: 'ورقة مراجعة' }[mode];
  const head = `<div class="ph"><div><h1>${title}: ${esc(act.title)}</h1><div>${esc(GRADE_NAME(act.grade))}${act.lessonTitle ? ` — ${esc(act.lessonTitle)}` : ''}</div></div><div class="b">MusiTeacher<br>مكتبة الدروس التفاعلية</div></div>`;
  const info = mode === 'student' ? '<div class="info"><div>اسم الطالب/ـة:</div><div>الصف:</div><div>التاريخ:</div></div>' : '';
  let body;
  if (mode === 'key') body = `<div class="key">${act.questions.map((q, i) => `<div><b>${i + 1}.</b> ${esc(answerText(q))}</div>`).join('')}</div><h3>الأسئلة مع إجاباتها</h3><ol class="qs">${act.questions.map((q) => qBlock(q, 'key')).join('')}</ol>`;
  else body = `<ol class="qs">${act.questions.map((q) => qBlock(q, mode)).join('')}</ol>`;
  const src = act.sourceNote ? `<div class="ft">مصدر المحتوى: ${esc(act.sourceNote)}</div>` : '<div class="ft">MusiTeacher — مكتبة الدروس التفاعلية</div>';
  root.innerHTML = `<style>${CSS}</style>${head}${info}${body}${src}`;
  const clear = () => { root.innerHTML = ''; window.removeEventListener('afterprint', clear); };
  window.addEventListener('afterprint', clear);
  setTimeout(() => window.print(), 60);
}
