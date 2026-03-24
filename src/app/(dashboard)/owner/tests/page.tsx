import { redirect } from 'next/navigation'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { FilePen, Plus } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import TestsListClient from './_components/tests-list-client'

async function getTestsPageData(academyId: string) {
  // 1단계: 테스트 목록 + 반/교사 목록 병렬 조회
  const [tests, classes, teachers] = await Promise.all([
    prisma.test.findMany({
      where: { academyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        timeLimitMin: true,
        totalScore: true,
        questionOrder: true,
        classId: true,
        createdBy: true,
        createdAt: true,
        class: { select: { name: true } },
        creator: { select: { name: true } },
      },
    }),
    prisma.class.findMany({
      where: { academyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { academyId, role: 'TEACHER', isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const testIds = tests.map((t) => t.id)

  // 2단계: 세션 집계 — 전체 row 로딩 없이 DB 레벨에서 count/avg 계산
  const [totalCounts, completedStats] = await Promise.all([
    prisma.testSession.groupBy({
      by: ['testId'],
      where: { testId: { in: testIds } },
      _count: { id: true },
    }),
    prisma.testSession.groupBy({
      by: ['testId'],
      where: { testId: { in: testIds }, status: { in: ['COMPLETED', 'GRADED'] } },
      _count: { id: true },
      _avg: { score: true },
    }),
  ])

  const totalMap = new Map(totalCounts.map((r) => [r.testId, r._count.id]))
  const completedMap = new Map(
    completedStats.map((r) => [r.testId, { count: r._count.id, avg: r._avg.score }]),
  )

  return { tests, classes, teachers, totalMap, completedMap }
}

// 테스트 목록 + 세션 통계를 30초 캐싱 (데이터 변경 시 tag로 즉시 무효화)
const getCachedTestsPageData = (academyId: string) =>
  unstable_cache(
    () => getTestsPageData(academyId),
    ['owner-tests', academyId],
    { revalidate: 30, tags: [`academy-${academyId}-tests`] },
  )()

export default async function OwnerTestsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const { tests, classes, teachers, totalMap, completedMap } = await getCachedTestsPageData(
    user.academyId,
  )

  const testData = tests.map((t) => {
    const total = totalMap.get(t.id) ?? 0
    const completed = completedMap.get(t.id)
    const completedCount = completed?.count ?? 0
    const avgScore = completed?.avg != null ? Math.round(completed.avg) : null
    const responseRate = total > 0 ? Math.round((completedCount / total) * 100) : null

    return {
      id: t.id,
      title: t.title,
      type: t.type,
      status: t.status,
      timeLimitMin: t.timeLimitMin,
      questionCount: Array.isArray(t.questionOrder) ? (t.questionOrder as string[]).length : 0,
      totalScore: t.totalScore,
      createdAt: t.createdAt.toISOString(),
      className: t.class?.name ?? null,
      classId: t.classId,
      creatorName: t.creator?.name ?? null,
      creatorId: t.createdBy,
      sessionCount: total,
      completedCount,
      avgScore,
      responseRate,
    }
  })

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <FilePen size={20} className="text-primary-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">테스트 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">학원 내 모든 테스트를 관리하고 분석하세요.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/owner/tests/schedule"
            className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            일정
          </Link>
          <Link
            href="/owner/tests/new"
            className="flex items-center gap-2 bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus size={16} />
            새 테스트
          </Link>
        </div>
      </div>

      <TestsListClient
        tests={testData}
        classes={classes}
        teachers={teachers}
      />
    </div>
  )
}
