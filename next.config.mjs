/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/**': ['./src/generated/prisma/**'],
  },
};

export default nextConfig;
