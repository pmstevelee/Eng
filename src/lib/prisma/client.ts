import { PrismaClient } from '@/generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function buildDatasourceUrl(base: string): string {
  // URL에 이미 존재하는 connection_limit / pool_timeout을 제거한 뒤 올바른 값으로 덮어씀.
  // Vercel 서버리스 + Supabase Transaction Pooler(PgBouncer) 기준:
  //   connection_limit=3  → 함수당 3개 병렬 커넥션 (Analytics Promise.all 대응)
  //   pool_timeout=20     → 커넥션 대기 최대 20초
  let url = base
    .replace(/([?&])connection_limit=[^&]*/g, '$1')
    .replace(/([?&])pool_timeout=[^&]*/g, '$1')
    .replace(/[?&]{2,}/g, (m) => m[0])  // 중복 구분자 정리
    .replace(/[?&]$/, '')               // 말미 구분자 제거

  url += (url.includes('?') ? '&' : '?') + 'connection_limit=3&pool_timeout=20'
  return url
}

function createPrismaClient() {
  return new PrismaClient({
    datasourceUrl: buildDatasourceUrl(process.env.DATABASE_URL ?? ''),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

// production 포함 항상 싱글턴 유지
// (Vercel warm invocation은 globalThis를 공유하므로 커넥션 재사용 가능)
export const prisma = globalForPrisma.prisma ?? createPrismaClient()
globalForPrisma.prisma = prisma
