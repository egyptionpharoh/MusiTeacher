/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.0.103'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;