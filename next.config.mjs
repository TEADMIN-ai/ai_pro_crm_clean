/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Allow build to succeed even if there are TS errors
    ignoreBuildErrors: true,
  },
  eslint: {
    // Don't block builds on lint errors either
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
