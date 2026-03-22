import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import StudentDetailClient from './_components/student-detail-client'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const owner = await getCurrentUser()
  if (!owner || owner.role !== 'ACADEMY_OWNER' || !owner.academyId) redirect('/login')

  const { id: studentId } = await params

  const student = await prisma.student.findFirst({
    where: { id: studentId, user: { academyId: owner.academyId, isDeleted: false } },
    select: {
      id: true,
      currentLevel: true,
      status: true,
      classId: true,
      createdAt: true,
      class: { select: { id: true, name: true } },
      user: { select: { name: true, email: true, createdAt: true } },
      testSessions: {
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          score: true,
          grammarScore: true,
          vocabularyScore: true,
          readingScore: true,
          writingScore: true,
          status: true,
          startedAt: true,
          completedAt: true,
          test: { select: { title: true, type: true } },
        },
      },
      skillAssessments: {
        orderBy: { assessedAt: 'desc' },
        take: 4,
        select: {
          domain: true,
          level: true,
          score: true,
          assessedAt: true,
        },
      },
    },
  })

  if (!student) notFound()

  // 반 목록
  const classes = await prisma.class.findMany({
    where: { academyId: owner.academyId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  // 최신 완료 테스트 세션 점수 (레이더 차트용)
  const latestGradedSession = student.testSessions.find(
    (s) => s.status === 'GRADED' || s.status === 'COMPLETED',
  )

  const studentData = {
    id: student.id,
    name: student.user.name,
    email: student.user.email,
    currentLevel: student.currentLevel,
    status: student.status,
    classId: student.classId,
    className: student.class?.name ?? null,
    createdAt: student.user.createdAt.toISOString(),
    testSessions: student.testSessions.map((s) => ({
      id: s.id,
      score: s.score,
      grammarScore: s.grammarScore,
      vocabularyScore: s.vocabularyScore,
      readingScore: s.readingScore,
      writingScore: s.writingScore,
      status: s.status,
      startedAt: s.startedAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
      testTitle: s.test.title,
      testType: s.test.type,
    })),
    radarData: latestGradedSession
      ? {
          grammarScore: latestGradedSession.grammarScore,
          vocabularyScore: latestGradedSession.vocabularyScore,
          readingScore: latestGradedSession.readingScore,
          writingScore: latestGradedSession.writingScore,
        }
      : null,
  }

  const classData = classes.map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="space-y-6">
      {/* 뒤로 가기 */}
      <Link
        href="/owner/students"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ChevronLeft size={16} />
        학생 목록
      </Link>

      <StudentDetailClient student={studentData} classes={classData} />
    </div>
  )
}
