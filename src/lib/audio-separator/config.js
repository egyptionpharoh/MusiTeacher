// إعدادات «استوديو فصل الصوت بالذكاء الاصطناعي» — قيم نقية بلا اعتماديات (تُختبر بسهولة).
// كل حدٍّ هنا يمكن تعديله من متغيرات البيئة دون لمس الكود.

const int = (v, d, min, max) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return d;
  return Math.min(max, Math.max(min, n));
};

/** الصيغ المقبولة للرفع: الامتداد → نوع الحاوية المتوقع عند فحص بايتات الملف. */
export const INPUT_FORMATS = {
  mp3: { container: 'mp3', label: 'MP3', mimes: ['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3'] },
  wav: { container: 'wav', label: 'WAV', mimes: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'] },
  flac: { container: 'flac', label: 'FLAC', mimes: ['audio/flac', 'audio/x-flac'] },
  m4a: { container: 'mp4', label: 'M4A', mimes: ['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac'] },
};

export const MODES = {
  vocals: { label: 'الصوت البشري فقط', suffix: 'Vocals' },
  instrumental: { label: 'الموسيقى فقط', suffix: 'Instrumental' },
};

export const OUTPUT_FORMATS = {
  mp3: { ext: 'mp3', contentType: 'audio/mpeg' },
  wav: { ext: 'wav', contentType: 'audio/wav' },
};

export const MP3_BITRATES = [320, 256, 192];

/** نماذج الفصل المتاحة عبر Replicate. التبديل بمتغير البيئة SEPARATOR_MODEL. */
export const MODEL_PRESETS = {
  // الافتراضي: Demucs v4 (Hybrid Transformer) — النسخة المحسّنة htdemucs_ft من Meta، رخصة MIT.
  // الإصدار مثبّت عمدًا: الإصدارات الأحدث من هذا النموذج غيّرت أسماء المدخلات.
  'demucs-ft': {
    provider: 'replicate',
    model: 'ryan5453/demucs',
    defaultVersion: 'f88aedb120e625ad464e822308515da335d50888824b975a587517068301bc0b',
    versionEnv: 'REPLICATE_DEMUCS_VERSION',
    label: 'Demucs v4 (htdemucs_ft)',
    // htdemucs_ft «حقيبة» من 4 نماذج متخصصة؛ كل نموذج يطبع شريط تقدم مستقلًا في السجل
    progressPasses: 4,
    buildInput({ audioUrl, format, bitrate }) {
      return {
        audio: audioUrl,
        model: 'htdemucs_ft',
        stem: 'vocals', // فصل ثنائي: الغناء + كل ما عداه (المصاحبة)
        output_format: format,
        mp3_bitrate: bitrate,
        mp3_preset: 2, // أعلى جودة ترميز في LAME
        wav_format: 'int16',
        clip_mode: 'rescale', // يمنع التشويه الناتج عن القصّ
        shifts: 1,
        overlap: 0.25,
        split: true,
      };
    },
  },
  // تجريبي: BS-RoFormer (أعلى دقة في المقاييس الحديثة)، لكنه نموذج مجتمعي حديث بلا توثيق للرخصة أو نقطة التدريب.
  // لا يُفعَّل إلا يدويًا بعد اختبار جودته ومراجعة شروطه: SEPARATOR_MODEL=bs-roformer
  'bs-roformer': {
    provider: 'replicate',
    model: 'cottom/bs-roformer',
    defaultVersion: '5c123ec6862fdb05a81b503b85e35348747b33326e97756bac5b17ae74c191e0',
    versionEnv: 'REPLICATE_ROFORMER_VERSION',
    label: 'BS-RoFormer (تجريبي)',
    progressPasses: 0, // لا نعرف شكل سجله → لا نسبة تقدم، حالة فقط
    fixedMp3Bitrate: 320, // النموذج يخرج MP3 بمعدل 320 فقط
    buildInput({ audioUrl, format }) {
      return { audio: audioUrl, mode: 'vocals', output_format: format };
    },
  },
};

export function getLimits(env = process.env) {
  return {
    maxBytes: int(env.SEPARATOR_MAX_MB, 120, 1, 500) * 1024 * 1024,
    maxSeconds: int(env.SEPARATOR_MAX_MINUTES, 10, 1, 30) * 60,
    minSeconds: 3,
    dailyPerUser: int(env.SEPARATOR_DAILY_LIMIT, 10, 1, 1000),
    activePerUser: 1,
    activeGlobal: int(env.SEPARATOR_MAX_CONCURRENT, 4, 1, 100),
    resultTtlHours: int(env.SEPARATOR_RESULT_TTL_HOURS, 24, 1, 72),
    uploadUrlTtlSec: 15 * 60,
    providerInputUrlTtlSec: 2 * 60 * 60,
    playUrlTtlSec: 60 * 60,
    // مهلة قصوى لأي مهمة نشطة؛ بعدها تُعتبر عالقة وتُلغى (لا تحجز حصة المستخدم إلى الأبد)
    staleActiveMs: 45 * 60 * 1000,
    staleUploadMs: 30 * 60 * 1000,
    finalizeLeaseMs: 4 * 60 * 1000,
  };
}

export function getPreset(env = process.env) {
  const id = env.SEPARATOR_MODEL && MODEL_PRESETS[env.SEPARATOR_MODEL] ? env.SEPARATOR_MODEL : 'demucs-ft';
  const p = MODEL_PRESETS[id];
  return { id, ...p, version: (env[p.versionEnv] || p.defaultVersion).trim() };
}

/** حالات المهمة. «نشطة» = تحجز من حصة التزامن. */
export const ACTIVE_STATUSES = ['awaiting-upload', 'queued', 'processing', 'finalizing'];
export const FINAL_STATUSES = ['ready', 'failed', 'canceled', 'expired', 'deleted'];

export const STORAGE_PREFIX = 'audio-separator/';
