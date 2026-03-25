import { redirect } from 'next/navigation'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { FilePen, Plus } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import TestsListClient from './_components/tests-list-client'

const getCachedTeacherTests = (userId: string, academyId: string) =>
  unstable_cache(
    async () => {
      const tests = await prisma.test.findMany({
        where: { createdBy: userId, academyId },
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
          testSessions: {
            select: { status: true, student: { select: { user: { select: { name: true } } } } },
          },
        },
      })

      return tests.map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        status: t.status,
        timeLimitMin: t.timeLimitMin,
        questionCount: Array.isArray(t.questionOrder) ? (t.questionOrder as string[]).length : 0,
        createdAt: t.createdAt.toISOString(),
        className: t.class?.name ?? null,
        sessions: t.testSessions.map((s) => ({
          status: s.status,
          studentName: s.student.user.name,
        })),
      }))
    },
    ['teacher-tests', userId],
    { revalidate: 30, tags: [`teacher-${userId}-tests`] },
  )()

export default async function TeacherTestsPage() {
  const pageStart = performance.now()

  const authStart = performance.now()
  const user = await getCurrentUser()
  console.log(`  [쿼리1] getCurrentUser: ${(performance.now() - authStart).toFixed(0)}ms`)
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const dataStart = performance.now()
  const testData = await getCachedTeacherTests(user.id, user.academyId)
  console.log(`  [쿼리2] getCachedTeacherTests: ${(performance.now() - dataStart).toFixed(0)}ms`)

  const totalTime = performance.now() - pageStart
  console.log(`📊 [TeacherTestsPage] 전체 서버 시간: ${totalTime.toFixed(0)}ms`)
  if (totalTime > 200) console.log(`⚠️ SLOW PAGE: ${totalTime.toFixed(0)}ms`)

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <FilePen size={20} className="text-primary-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">테스트 출제/채점</h1>
            <p className="text-sm text-gray-500 mt-0.5">내가 만든 테스트를 관리하고 배포하세요.</p>
          </div>
        </div>
        <Link
          href="/teacher/tests/new"
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
