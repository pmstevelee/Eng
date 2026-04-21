import { unstable_cache } from 'next/cache'
import { Suspense } from 'react'
import { Award } from 'lucide-react'
import { prisma } from '@/lib/prisma/client'
import { requireStudent } from '@/lib/auth-student'
import { BadgesClient } from './_components/badges-client'

const getCachedStudentBadges = (studentId: string) =>
  unstable_cache(
    async () => {
      const [allBadges, badgeEarnings] = await Promise.all([
        prisma.badge.findMany({
          where: { code: { not: null } },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.badgeEarning.findMany({
          where: { studentId },
          include: { badge: true },
          orderBy: { earnedAt: 'desc' },
          take: 50,
        }),
      ])
      return { allBadges, badgeEarnings }
    },
    ['student-badges', studentId],
    { revalidate: 60, tags: [`student-${studentId}-badges`] },
  )()

export default async function BadgesPage() {
  const { studentId } = await requireStudent()
  const { allBadges, badgeEarnings } = await getCachedStudentBadges(studentId)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FFB100]/15 flex items-center justify-center">
          <Award size={20} className="text-[#FFB100]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">내 배지 컬렉션</h1>
          <p className="text-sm text-gray-500 mt-0.5">학습하고 도전을 완료하면 배지를 획득해요</p>
        </div>
      </div>

      <Suspense fallback={<div className="text-sm text-gray-500">로딩 중...</div>}>
        <BadgesClient allBadges={allBadges} badgeEarnings={badgeEarnings} />
      </Suspense>
    </div>
  )
}
