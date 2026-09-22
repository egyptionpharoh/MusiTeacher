import gamesCatalog from '../../data/catalogs/gamesCatalog.json';
import toolsCatalog from '../../data/catalogs/toolsCatalog.json';
import platformsCatalog from '../../data/catalogs/platformsCatalog.json';
export const buildLessonContext = (rawJson) => {
  if (!rawJson) return null;
  const content = rawJson?.core?.procedures_html || "";
  
  const extractSection = (text, startWord, endWord) => {
    const start = text.indexOf(startWord);
    if (start === -1) return "غير متوفر";
    const end = endWord ? text.indexOf(endWord, start) : text.length;
    return text.substring(start + startWord.length, end !== -1 ? end : text.length)
               .replace(/<[^>]*>?/gm, '') // تنظيف الـ HTML
               .trim();
  };

  return {
    title: rawJson?.metadata?.title || "درس غير معروف",
    summary: `درس (${rawJson?.metadata?.title}) يركز على التطبيق العملي.`,
    warmup: extractSection(content, "التهيئة / التمهيد / التعلم القبلي", "إجراءات سير الدرس"),
    procedures: extractSection(content, "إجراءات سير الدرس", "التقويم التكويني"),
    strategies: extractSection(content, "الاستراتيجيات", "المصادر التعليمية"),
  };
};

export const detectIntent = (query) => {
  const q = query.toLowerCase();
  if (q.includes('لعبة') || q.includes('نشاط ترفيهي') || q.includes('ألعب')) return 'ASK_GAME';
  if (q.includes('أداة') || q.includes('رصد') || q.includes('درجات')) return 'ASK_TOOL';
  if (q.includes('منصة') || q.includes('إجادة') || q.includes('مورد')) return 'ASK_PLATFORM';
  if (q.includes('أمهد') || q.includes('تهيئة') || q.includes('أبدأ')) return 'ASK_WARMUP';
  if (q.includes('خطوات') || q.includes('إجراءات') || q.includes('شرح')) return 'ASK_PROCEDURES';
  if (q.includes('نصيحة') || q.includes('أول مرة') || q.includes('أركز على')) return 'ASK_TEACHING_ADVICE';
  return 'UNKNOWN';
};

export const generateResponse = (query, lessonContext) => {
  const intent = detectIntent(query);
  let response = { type: 'text', message: '', action: null };

  if (!lessonContext) {
    return { type: 'text', message: 'من فضلك اختار الدرس الأول عشان أقدر أساعدك!', action: null };
  }

  switch (intent) {
    case 'ASK_WARMUP':
      response.type = 'lesson';
      response.message = `خطة الدرس بتقترح التمهيد ده:\n\n${lessonContext.warmup}`;
      break;
    case 'ASK_PROCEDURES':
      response.type = 'lesson';
      response.message = `خطوات سير الدرس المعتمدة هي:\n\n${lessonContext.procedures}`;
      break;
    case 'ASK_TEACHING_ADVICE':
      response.type = 'lesson';
      response.message = `أهم حاجة تركز عليها هي التطبيق العملي. حاول تستخدم استراتيجيات زي:\n\n${lessonContext.strategies}`;
      break;
    case 'ASK_GAME':
      const game = gamesCatalog.find(g => g.recommendedFor.some(keyword => lessonContext.title.includes(keyword))) || gamesCatalog[0];
      response.type = 'game';
      response.message = `${game.assistantMessage}\n\nتحب أفتح لك اللعبة دلوقتي؟`;
      response.action = { label: "فتح اللعبة الآن", route: game.route };
      break;
    case 'ASK_TOOL':
      const tool = toolsCatalog[0]; // تبسيط للنسخة دي
      response.type = 'tool';
      response.message = tool.assistantMessage;
      response.action = { label: tool.title, route: tool.route };
      break;
    case 'ASK_PLATFORM':
      const platform = platformsCatalog[0];
      response.type = 'platform';
      response.message = platform.assistantMessage;
      response.action = { label: "الذهاب للمنصة", route: platform.route };
      break;
    default:
      response.type = 'text';
      response.message = "عذراً يا أستاذي، ممكن توضح سؤالك أكتر؟ تقدر تسألني عن التمهيد، الأنشطة، الألعاب التعليمية، أو حتى أدوات المنصة.";
  }
  return response;
};