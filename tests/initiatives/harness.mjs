// خادم اختبار: الواجهة المبنية + مسارات /api/initiatives الحقيقية (handlers.js) مع ذكاء اصطناعي «محاكى» ومخزن مزامنة في الذاكرة.
// AI=0 يحاكي خادمًا بلا مفتاح Gemini، SYNC=0 بلا MongoDB. لا يتصل بأي خدمة خارجية.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { makeHandlers } from '../../src/lib/initiatives/handlers.js';

const dir = path.dirname(fileURLToPath(import.meta.url)); const dist = path.join(dir, '_dist');
const port = +(process.env.PORT || 5340); const delay = +(process.env.AI_DELAY || 600);
const POOL = [
  ['ساعة المختبر المفتوح: تجارب يصممها الطلبة', 'academic', 'students'], ['جدار الأسئلة الصامتة', 'academic', 'teacher'], ['سوق المهارات بين الصفوف', 'leadership', 'students'],
  ['بنك الكتب المتنقل في الحافلات المدرسية', 'culture', 'parents'], ['تحدي الأسبوع الأخضر بالأرقام', 'health', 'students'], ['مقهى الآباء التربوي الشهري', 'community', 'parents'],
  ['مختبر البودكاست الصفي', 'digital', 'students'], ['يوم بلا ورق', 'health', 'team'], ['الطالب المرشد للصفوف الأولى', 'leadership', 'students'],
];
let n = 0;
export const fakeAI = {
  configured: () => process.env.AI !== '0',
  async generateJSON({ prompt }) {
    await new Promise((r) => setTimeout(r, delay));
    if (prompt.startsWith('ابتكر')) {
      const k = n++;
      return { model: 'fake', data: { ideas: [0, 1, 2].map((j) => { const [title, domain, lead] = POOL[(k * 3 + j) % POOL.length]; return {
        title, slogan: 'فكرة محاكاة للاختبار', domain, lead, cost: 'free', size: 'medium', stages: ['c2'], weeks: 3,
        summary: `وصف موجز لمبادرة «${title}» (ذكاء اصطناعي محاكى).`, problem: 'احتياج مدرسي يعالجه الطلبة.', why: 'آلية تنفيذ مختلفة عن المعتاد.',
        goal: 'هدف عام قابل للتحقق.', objectives: ['هدف أول قابل للقياس.', 'هدف ثانٍ.'], audience: 'طلبة الحلقة الثانية', join: 'سجّل اسمك لدى منسق المبادرة.',
        phases: [{ t: 'يجب أن تُحذف', w: 9 }],
      }; }) } };
    }
    if (prompt.startsWith('طوّر')) {
      return { model: 'fake', data: {
        title: (prompt.match(/"title":"([^"]+)"/) || [])[1] || 'مبادرة مطورة', slogan: 'نسخة مطوّرة بالذكاء الاصطناعي (محاكاة)', domain: 'leadership', lead: 'students', cost: 'low', size: 'wide', stages: ['c2', 'post'], weeks: 99,
        summary: 'خطة مطورة متكاملة.', problem: 'المشكلة بعد التطوير.', rationale: ['مبرر أول.', 'مبرر ثانٍ.'], goal: 'الهدف العام المطوّر.',
        objectives: ['هدف مطور أول.', 'هدف مطور ثانٍ.', 'هدف مطور ثالث.'], audience: 'طلبة المدرسة', beneficiaries: 'المدرسة كلها تقريبًا',
        team: [{ r: 'منسق المبادرة', tasks: 'المتابعة' }, { r: 'الفرق الطلابية', tasks: 'التنفيذ' }], partners: ['أولياء الأمور (بعد التنسيق)'],
        resources: [{ i: 'أوراق وأقلام', c: 'low', alt: 'أوراق مستعملة' }],
        phases: [{ t: 'التهيئة', w: 1, by: 'المنسق', steps: ['إعلان المبادرة', 'تكوين الفرق'] }, { t: 'التنفيذ', w: 3, by: 'الفرق', steps: ['تنفيذ الأنشطة', 'التوثيق'] }, { t: 'التقييم', w: 1, by: 'المنسق', steps: ['قياس بعدي', 'معرض ختامي'] }],
        kpis: [{ k: 'عدد المشاركين', tool: 'سجل الحضور' }, { k: 'رأي المستفيدين', tool: 'استبانة' }], evaluation: ['استبانة'], outputs: ['معرض'], sustain: ['تكرارها سنويًا'],
        approvals: ['موافقة الإدارة'], join: 'انضم عبر رائد صفك.', survey: ['استفدت من المبادرة.'],
      } };
    }
    const sec = (prompt.match(/أعد كتابة قسم «([^»]+)»/) || [])[1] || '';
    if (sec.startsWith('فريق')) return { model: 'fake', data: { team: [{ r: 'منسق المبادرة', tasks: 'مهام معاد صياغتها' }, { r: 'مسؤول التوثيق', tasks: 'التصوير والسجل' }] } };
    if (sec.startsWith('مؤشرات')) return { model: 'fake', data: { kpis: [{ k: 'مؤشر معاد صياغته قابل للقياس', tool: 'أداة جديدة' }], evaluation: ['تقييم جديد'] } };
    if (sec === 'الأهداف') return { model: 'fake', data: { goal: 'هدف عام جديد', objectives: ['هدف جديد أول.', 'هدف جديد ثانٍ.'] } };
    return { model: 'fake', data: {} };
  },
};
const mem = new Map();
const store = process.env.SYNC === '0' ? null : {
  async get(uid) { return mem.get(uid) || null; },
  async put(uid, data, updatedAt) { mem.set(uid, { data: JSON.parse(JSON.stringify(data)), updatedAt }); },
  async remove(uid) { mem.delete(uid); },
};
const handlers = makeHandlers({
  ai: fakeAI, store, log: () => {}, burstMax: 200, hourlyMax: 2000, syncMax: 500,
  verifyIdToken: async (t) => { if (String(t).startsWith('good-')) return { uid: t.slice(5) }; throw new Error('bad'); },
  findUser: async () => ({ role: 'user', isSubscribed: true, subscriptionEndDate: new Date(Date.now() + 864e5) }),
});
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const m = url.pathname.match(/^\/api\/initiatives\/(\w+)$/);
  if (m) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'DELETE'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const a = m[1];
    const fn = a === 'status' ? handlers.status : a === 'sync' ? handlers.sync : (req.method === 'POST' && handlers[a]) || null;
    const r = fn ? await fn(request) : Response.json({ ok: false, error: 'not-found' }, { status: 404 });
    res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  if (url.pathname === '/__store') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify([...mem.entries()])); }
  const f = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname);
  if (f.startsWith(dist) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); return res.end(fs.readFileSync(f)); }
  res.writeHead(404); res.end('nf');
}).listen(port, '127.0.0.1', () => console.log(`initiatives harness on ${port} (AI ${process.env.AI === '0' ? 'off' : 'fake'}, sync ${store ? 'mem' : 'off'})`));
