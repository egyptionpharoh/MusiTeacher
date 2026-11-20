/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.0.103'],
  // ألعاب استوديو الموسيقى تُقرأ من القرص وقت التشغيل: نضمن تضمينها في حزمة مسار /play (مثلًا على Vercel)
  outputFileTracingIncludes: {
    '/play/[gameId]/[[...path]]': ['./private-games/**/*'],
  },
  // النسخ الاحتياطية داخل مجلدات الألعاب لا تُشحن إلى الخادم (حجم أقل، ولا كشف لنسخ قديمة من الكود)
  outputFileTracingExcludes: {
    '/play/[gameId]/[[...path]]': ['./private-games/**/_backup_*/**', './private-games/**/*.md'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;