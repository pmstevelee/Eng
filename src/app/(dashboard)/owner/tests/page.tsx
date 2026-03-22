import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FilePen, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import TestsListClient from './_components/tests-list-client'

export default async function OwnerTestsPage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const [tests, classes, teachers] = await Promise.all([
    prisma.test.findMany({
      where: { academyId: user.academyId },
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
        testSessions: {
          select: { status: true, score: true },
        },
      },
    }),
    prisma.class.findMany({
      where: { academyId: user.academyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { academyId: user.academyId, role: 'TEACHER', isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const testData = tests.map((t) => {
    const completedSessions = t.testSessions.filter((s) =>
      ['COMPLETED', 'GRADED'].includes(s.status),
    )
    const scoredSessions = t.testSessions.filter((s) => s.score !== null)
    const avgScore =
      scoredSessions.length > 0
        ? Math.round(
            scoredSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) / scoredSessions.length,
          )
        : null
    const responseRate =
      t.testSessions.length > 0
        ? Math.round((completedSessions.length / t.testSessions.length) * 100)
        : null

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
      sessionCount: t.testSessions.length,
      completedCount: completedSessions.length,
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
