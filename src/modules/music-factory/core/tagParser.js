// قراءة كلمات البرومبت النهائية (بوسوم Suno) وتحويلها إلى أقسام منظمة لمحركات التوليد.
// الصيغة المدعومة: [Verse 1: soft oud] أو [Chorus] [Catchy hook] ثم سطور الكلمات.
const TAG_LINE = /^\s*(\[[^\]\n]{1,160}\]\s*)+$/;
const ascii = (s) => String(s || '').replace(/[^\x20-\x7E]/g, ' ').replace(/\s{2,}/g, ' ').trim();

export function parseTaggedLyrics(text) {
  const sections = [];
  let cur = null;
  for (const raw of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^-{2,}\s*(STYLE|LYRICS|TITLE|EXCLUDE)\s*-{2,}$/i.test(line)) continue;
    if (TAG_LINE.test(line)) {
      const tags = [...line.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim()).filter(Boolean);
      if (!tags.length) continue;
      if (/^end$/i.test(tags[0])) { cur = null; continue; }
      const [head, ...rest] = tags;
      const idx = head.indexOf(':');
      const name = (idx >= 0 ? head.slice(0, idx) : head).trim().slice(0, 60) || 'Section';
      const cues = [idx >= 0 ? head.slice(idx + 1) : '', ...rest].join(', ').split(',').map((s) => ascii(s)).filter(Boolean);
      cur = { name, cues, lines: [] };
      sections.push(cur);
    } else {
      if (!cur) { cur = { name: 'Verse', cues: [], lines: [] }; sections.push(cur); }
      cur.lines.push(line);
    }
  }
  return sections;
}

export const isInstrumentalName = (n) => /intro|outro|interlude|instrumental|break|solo|ending|fade|theme|climax/i.test(n);
