// التحقق من الطلبات ومن الملفات الصوتية — دوال نقية تعمل على Buffer فقط (بلا مكتبات خارجية).
// الخادم لا يثق بما يقوله المتصفح: بعد الرفع يقرأ أول بايتات الملف ليتأكد من نوعه الحقيقي ومدته
// (المدة تحدد تكلفة المعالجة، فلا نرسل ملفًا أطول من الحد إلى خدمة الذكاء الاصطناعي).
import { INPUT_FORMATS, MODES, OUTPUT_FORMATS, MP3_BITRATES } from './config.js';

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function extOf(name) {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

/** اسم آمن وواضح للملف الناتج (يحتفظ بالحروف العربية والإنجليزية والأرقام). */
export function baseNameOf(name) {
  let s = String(name || '').replace(/\.[A-Za-z0-9]{1,5}$/, '');
  s = s.normalize('NFC').replace(/[^\p{L}\p{N}\s_\-()]+/gu, ' ').trim().replace(/\s+/g, '_').replace(/_+/g, '_');
  s = s.replace(/^[_\-.]+|[_\-.]+$/g, '');
  if (s.length > 80) s = s.slice(0, 80).replace(/_+$/, '');
  return s || 'Song';
}

export function outputFileName(baseName, mode, format) {
  return `${baseName}_${MODES[mode].suffix}.${OUTPUT_FORMATS[format].ext}`;
}

/** ترويسة Content-Disposition تدعم الأسماء العربية مع بديل ASCII للمتصفحات القديمة. */
export function contentDisposition(fileName, type = 'attachment') {
  const ascii = fileName.replace(/[^\x20-\x7E]+/g, '').replace(/["\\]/g, '').replace(/^_+/, '') || 'MusiTeacher_Audio' + fileName.slice(fileName.lastIndexOf('.'));
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** يتحقق من طلب إنشاء مهمة. يعيد { ok, value } أو { ok:false, error, detail }. */
export function validateCreate(body, limits) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad-request' };
  const { fileName, size, type, duration, mode, format, requestId, consent } = body;
  let { bitrate } = body;
  if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > 240) return { ok: false, error: 'bad-file-name' };
  const ext = extOf(fileName);
  const fmt = INPUT_FORMATS[ext];
  if (!fmt) return { ok: false, error: 'unsupported-format' };
  // نوع MIME قد يكون فارغًا في بعض المتصفحات؛ إن وُجد يجب أن يكون صوتيًا معروفًا لهذا الامتداد
  if (type && typeof type === 'string' && type !== 'application/octet-stream' && !fmt.mimes.includes(type.toLowerCase())) {
    return { ok: false, error: 'unsupported-format' };
  }
  if (!Number.isSafeInteger(size) || size <= 0) return { ok: false, error: 'bad-size' };
  if (size > limits.maxBytes) return { ok: false, error: 'too-large' };
  if (duration !== undefined && duration !== null) {
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) return { ok: false, error: 'bad-duration' };
    if (duration > limits.maxSeconds + 1) return { ok: false, error: 'too-long' };
    if (duration > 0 && duration < limits.minSeconds) return { ok: false, error: 'too-short' };
  }
  if (!MODES[mode]) return { ok: false, error: 'bad-mode' };
  if (!OUTPUT_FORMATS[format]) return { ok: false, error: 'bad-output-format' };
  if (format === 'mp3') {
    if (bitrate === undefined) bitrate = 320;
    if (!MP3_BITRATES.includes(bitrate)) return { ok: false, error: 'bad-bitrate' };
  } else bitrate = null;
  if (typeof requestId !== 'string' || !REQUEST_ID.test(requestId)) return { ok: false, error: 'bad-request' };
  if (consent !== true) return { ok: false, error: 'consent-required' };
  return {
    ok: true,
    value: {
      fileName: fileName.trim(), ext, container: fmt.container, size, type: type || '',
      clientDuration: typeof duration === 'number' ? duration : null, mode, format, bitrate, requestId,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// فحص الحاوية الصوتية وقراءة المدة من الترويسات
// ---------------------------------------------------------------------------------------------

const ascii = (buf, at, len) => (at + len <= buf.length ? buf.toString('latin1', at, at + len) : '');

/** طول وسم ID3v2 في بداية الملف (0 إن لم يوجد). */
export function id3v2Size(buf) {
  if (buf.length < 10 || ascii(buf, 0, 3) !== 'ID3') return 0;
  const s = buf.subarray(6, 10);
  if ((s[0] | s[1] | s[2] | s[3]) & 0x80) return 0;
  const size = (s[0] << 21) | (s[1] << 14) | (s[2] << 7) | s[3];
  const footer = buf[5] & 0x10 ? 10 : 0;
  return 10 + size + footer;
}

export function sniffContainer(buf) {
  if (buf.length < 12) return null;
  if ((ascii(buf, 0, 4) === 'RIFF' || ascii(buf, 0, 4) === 'RF64') && ascii(buf, 8, 4) === 'WAVE') return 'wav';
  if (ascii(buf, 0, 4) === 'fLaC') return 'flac';
  if (ascii(buf, 4, 4) === 'ftyp') return 'mp4';
  if (findMp3Frame(buf, 0) >= 0) return 'mp3';
  return null;
}

export function parseWav(buf, fileSize) {
  let byteRate = 0, dataSize = -1, dataAt = -1, off = 12;
  while (off + 8 <= buf.length) {
    const id = ascii(buf, off, 4), size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ' && off + 20 <= buf.length) byteRate = buf.readUInt32LE(off + 16);
    if (id === 'data') { dataSize = size; dataAt = off + 8; break; }
    off += 8 + size + (size & 1);
  }
  if (!byteRate) return null;
  const rest = fileSize - (dataAt > 0 ? dataAt : 44);
  if (dataSize < 0 || dataSize === 0 || dataSize === 0xffffffff || dataSize > rest) dataSize = rest; // RF64 أو ترويسة بثّ
  return { duration: dataSize / byteRate };
}

export function parseFlac(buf) {
  if (buf.length < 26 || ascii(buf, 0, 4) !== 'fLaC' || (buf[4] & 0x7f) !== 0) return null;
  const sr = (buf[18] << 12) | (buf[19] << 4) | (buf[20] >> 4);
  const total = (buf[21] & 0x0f) * 2 ** 32 + buf.readUInt32BE(22);
  if (!sr) return null;
  if (!total) return { duration: null }; // FLAC مبثوث بلا عدد عينات
  return { duration: total / sr };
}

const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BR2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** يقرأ ترويسة إطار MPEG Layer III عند الموضع i (أو null). */
export function mp3FrameAt(buf, i) {
  if (i + 4 > buf.length || buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) return null;
  const ver = (buf[i + 1] >> 3) & 3, layer = (buf[i + 1] >> 1) & 3;
  const bri = buf[i + 2] >> 4, sri = (buf[i + 2] >> 2) & 3, pad = (buf[i + 2] >> 1) & 1;
  if (ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) return null;
  const bitrate = (ver === 3 ? BR1 : BR2)[bri], sampleRate = SR[ver][sri];
  const samples = ver === 3 ? 1152 : 576;
  const length = Math.floor((samples / 8) * bitrate * 1000 / sampleRate) + pad;
  const mono = (buf[i + 3] >> 6) === 3;
  return { ver, bitrate, sampleRate, samples, length, mono };
}

/** أول إطار MP3 صالح يتبعه إطار صالح آخر (لتجنّب التطابق العشوائي داخل بيانات غير صوتية). */
export function findMp3Frame(buf, from, maxScan = 64 * 1024) {
  const end = Math.min(buf.length - 4, from + maxScan);
  for (let i = from; i < end; i++) {
    const f = mp3FrameAt(buf, i);
    if (!f || f.length < 24) continue;
    const next = i + f.length;
    if (next + 4 > buf.length) { if (i === from) return i; continue; }
    const g = mp3FrameAt(buf, next);
    if (g && g.ver === f.ver && g.sampleRate === f.sampleRate) return i;
  }
  return -1;
}

/** buf يبدأ بعد وسم ID3؛ audioBytes = حجم الجزء الصوتي. يعيد المدة والمعدل التقريبي. */
export function parseMp3(buf, audioBytes) {
  const at = findMp3Frame(buf, 0);
  if (at < 0) return null;
  const f = mp3FrameAt(buf, at);
  const side = f.ver === 3 ? (f.mono ? 17 : 32) : (f.mono ? 9 : 17);
  const x = at + 4 + side;
  const tag = ascii(buf, x, 4);
  if ((tag === 'Xing' || tag === 'Info') && x + 12 <= buf.length) {
    const flags = buf.readUInt32BE(x + 4);
    if (flags & 1) {
      const frames = buf.readUInt32BE(x + 8);
      if (frames > 0) {
        const duration = (frames * f.samples) / f.sampleRate;
        return { duration, kbps: Math.round((audioBytes * 8) / duration / 1000), vbr: tag === 'Xing' };
      }
    }
  }
  if (ascii(buf, at + 36, 4) === 'VBRI' && at + 54 <= buf.length) {
    const frames = buf.readUInt32BE(at + 36 + 14);
    if (frames > 0) {
      const duration = (frames * f.samples) / f.sampleRate;
      return { duration, kbps: Math.round((audioBytes * 8) / duration / 1000), vbr: true };
    }
  }
  return { duration: ((audioBytes - at) * 8) / (f.bitrate * 1000), kbps: f.bitrate, vbr: false };
}

/** يبحث عن صندوق mvhd ويقرأ المدة (MP4/M4A). */
export function parseMp4(buf) {
  let i = buf.indexOf('mvhd', 0, 'latin1');
  while (i >= 4) {
    const v = buf[i + 4];
    if (v === 0 && i + 24 <= buf.length) {
      const ts = buf.readUInt32BE(i + 16), d = buf.readUInt32BE(i + 20);
      if (ts) return { duration: d / ts };
    } else if (v === 1 && i + 36 <= buf.length) {
      const ts = buf.readUInt32BE(i + 24), d = Number(buf.readBigUInt64BE(i + 28));
      if (ts) return { duration: d / ts };
    }
    i = buf.indexOf('mvhd', i + 4, 'latin1');
  }
  return null;
}

/**
 * يفحص الملف المرفوع عبر قارئ مدى بايتات (readRange(start, endInclusive) → Buffer).
 * يعيد { container, duration, kbps? } أو { error }.
 */
export async function probeAudio(readRange, size) {
  const HEAD = 256 * 1024;
  let head = await readRange(0, Math.min(size, HEAD) - 1);
  let skip = id3v2Size(head);
  if (skip >= size) return { error: 'unreadable' };
  if (skip > 0) head = await readRange(skip, Math.min(size, skip + HEAD) - 1);
  const container = sniffContainer(head);
  if (!container) return { error: 'unsupported-format' };
  let info = null;
  if (container === 'wav') info = parseWav(head, size - skip);
  else if (container === 'flac') info = parseFlac(head);
  else if (container === 'mp3') {
    const tail = size >= 128 ? await readRange(size - 128, size - 1) : Buffer.alloc(0);
    const id3v1 = tail.length === 128 && ascii(tail, 0, 3) === 'TAG' ? 128 : 0;
    info = parseMp3(head, size - skip - id3v1);
  } else if (container === 'mp4') {
    info = parseMp4(head);
    if (!info && size > HEAD) {
      const TAIL = 2 * 1024 * 1024;
      info = parseMp4(await readRange(Math.max(0, size - TAIL), size - 1));
    }
  }
  if (!info || info.duration === null || !Number.isFinite(info.duration) || info.duration <= 0) {
    return { container, error: 'unreadable' };
  }
  return { container, duration: info.duration, kbps: info.kbps || null };
}
