/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
    // Prisma 엔진 파일을 Vercel 서버리스 번들에 포함 (experimental 안에 있어야 함)
    outputFileTracingIncludes: {
      '/**': ['./src/generated/prisma/**'],
    },
  },
};

export default nextConfig;
