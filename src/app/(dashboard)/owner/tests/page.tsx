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

  // 학원장은 학원 내 모든 테스트 조회 (교사 포함)
  const tests = await prisma.test.findMany({
    where: { academyId: user.academyId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      timeLimitMin: true,
      questionOrder: true,
      createdAt: true,
      class: { select: { name: true } },
      creator: { select: { name: true } },
      testSessions: {
        select: { status: true, student: { select: { user: { select: { name: true } } } } },
      },
    },
  })

  const testData = tests.map((t) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    status: t.status,
    timeLimitMin: t.timeLimitMin,
    questionCount: Array.isArray(t.questionOrder) ? (t.questionOrder as string[]).length : 0,
    createdAt: t.createdAt.toISOString(),
    className: t.class?.name ?? null,
    creatorName: t.creator?.name ?? null,
    sessions: t.testSessions.map((s) => ({
      status: s.status,
      studentName: s.student.user.name,
    })),
  }))

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
            <p className="text-sm text-gray-500 mt-0.5">학원 내 모든 테스트를 관리하고 배포하세요.</p>
          </div>
        </div>
        <Link
          href="/owner/tests/new"
          className="flex items-center gap-2 bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={16} />
          새 테스트 만들기
        </Link>
      </div>

      <TestsListClient tests={testData} />
    </div>
  )
}
