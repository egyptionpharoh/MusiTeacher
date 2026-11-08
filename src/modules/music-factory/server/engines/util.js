// أدوات مشتركة لمحركات التوليد الصوتي
export const fail = (message, code, extra) => Object.assign(new Error(message), { code, ...extra });
export const clip = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
export const ascii = (s) => String(s || '').replace(/[^\x20-\x7E]/g, ' ').replace(/\s{2,}/g, ' ').trim();
export const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(fail('انتهت المهلة.', 'timeout')); }, { once: true });
});

/** أقصى طول للأغنية بالثواني (افتراضيًا 4 دقائق حتى يبقى الملف أقل من حد استجابة الاستضافة) */
export const maxSeconds = (env = {}) => Math.max(30, Math.min(600, parseInt(env.MF_MAX_AUDIO_SECONDS || '240', 10) || 240));

/** تقسيم وصف الأسلوب إلى أنماط قصيرة بالإنجليزية بدون تكرار */
export function splitStyles(style, max = 50) {
  const seen = new Set();
  return ascii(style).replace(/^-+\s*STYLE\s*-+/i, '').split(',')
    .map((s) => s.trim().replace(/^[-:]+|[-:]+$/g, '').trim())
    .filter((s) => s.length >= 2 && s.length <= 120)
    .filter((s) => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, max);
}

export async function readError(res) {
  const txt = await res.text().catch(() => '');
  try {
    const j = JSON.parse(txt);
    const d = j.detail !== undefined ? j.detail : j.error;
    if (Array.isArray(d)) return d.map((x) => (x.loc ? x.loc.join('.') + ': ' : '') + (x.msg || x.message || '')).join(' | ');
    if (d && typeof d === 'object') return d.message || d.status || JSON.stringify(d);
    return d || j.message || txt;
  } catch { return txt; }
}

/** وصف الأغنية لمحركات تقبل خانة نصية واحدة (Lyria وغيرها) */
export function directionText(req) {
  const style = ascii(req.output.style).replace(/^-+\s*STYLE\s*-+/i, '').trim();
  const ex = splitStyles(req.output.exclude, 20);
  return { style, avoid: ex.join(', ') };
}

export const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
