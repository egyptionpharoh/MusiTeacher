/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.0.103'],
  // ألعاب المختبر تُقرأ من القرص وقت التشغيل: نضمن تضمينها في حزمة مسار /play (مثلًا على Vercel)
  outputFileTracingIncludes: {
    '/play/[gameId]/[[...path]]': ['./private-games/**/*'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;