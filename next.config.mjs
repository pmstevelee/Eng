/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
  // Prisma 엔진 파일을 Vercel 서버리스 번들에 포함 (App Router 전체 라우트 대상)
  outputFileTracingIncludes: {
    '**': ['./src/generated/prisma/**'],
  },
};

export default nextConfig;
