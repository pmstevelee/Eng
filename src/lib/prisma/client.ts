import { PrismaClient } from '@/generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const baseUrl = process.env.DATABASE_URL ?? ''

  // PgBouncer(transaction mode) 환경에서 connection_limit & pool_timeout 주입
  // Vercel 서버리스: 함수당 커넥션이 적으므로 5개 + 30초 대기로 설정
  const datasourceUrl = baseUrl.includes('connection_limit')
    ? baseUrl
    : baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'connection_limit=5&pool_timeout=30'

  return new PrismaClient({
    datasourceUrl,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

// production 포함 항상 싱글턴 유지
// (Vercel warm invocation은 globalThis를 공유하므로 커넥션 재사용 가능)
export const prisma = globalForPrisma.prisma ?? createPrismaClient()
globalForPrisma.prisma = prisma
