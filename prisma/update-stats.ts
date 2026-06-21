import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  const domains = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING', 'LISTENING']

  for (const domain of domains) {
    for (let diff = 1; diff <= 10; diff++) {
      const totalCount = await prisma.question.count({
        where: { domain: domain as any, difficulty: diff, isActive: true, academyId: null },
      })
      const verifiedCount = await prisma.question.count({
        where: { domain: domain as any, difficulty: diff, isActive: true, isVerified: true, academyId: null },
      })
      const qualityAgg = await prisma.question.aggregate({
        where: { domain: domain as any, difficulty: diff, isActive: true, academyId: null, qualityScore: { not: null } },
        _avg: { qualityScore: true },
      })

      await prisma.questionBankStats.upsert({
        where: { domain_difficulty: { domain, difficulty: diff } },
        create: { domain, difficulty: diff, totalCount, verifiedCount, avgQualityScore: qualityAgg._avg.qualityScore ?? null, lastUpdatedAt: new Date() },
        update: { totalCount, verifiedCount, avgQualityScore: qualityAgg._avg.qualityScore ?? null, lastUpdatedAt: new Date() },
      })
      if (totalCount > 0) console.log(`${domain} diff ${diff}: ${totalCount}개`)
    }
  }

  const total = await prisma.questionBankStats.aggregate({ _sum: { totalCount: true } })
  console.log(`\n📦 stats 합계: ${total._sum.totalCount}개`)
  console.log('✅ question_bank_stats 갱신 완료')
}

main().catch(console.error).finally(() => prisma.$disconnect())
