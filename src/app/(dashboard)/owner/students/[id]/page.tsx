import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { ChevronLeft, BookOpen } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import StudentDetailClient from './_components/student-detail-client'

const getStudentDetail = (academyId: string, studentId: string) =>
  unstable_cache(
    async () => {
      const [student, classes] = await Promise.all([
        prisma.student.findFirst({
          where: { id: studentId, user: { academyId, isDeleted: false } },
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
                listeningScore: true,
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
        }),
        prisma.class.findMany({
          where: { academyId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
      ])
      if (!student) return null
      return {
        student: {
          ...student,
          createdAt: student.createdAt.toISOString(),
          user: {
            ...student.user,
            createdAt: student.user.createdAt.toISOString(),
          },
          testSessions: student.testSessions.map((s) => ({
            ...s,
            startedAt: s.startedAt.toISOString(),
            completedAt: s.completedAt?.toISOString() ?? null,
          })),
          skillAssessments: student.skillAssessments.map((a) => ({
            ...a,
            assessedAt: a.assessedAt.toISOString(),
          })),
        },
        classes,
      }
    },
    ['owner-student-detail', academyId, studentId],
    { revalidate: 30, tags: [`academy-${academyId}-students`, `student-${studentId}`] },
  )()

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const owner = await getCurrentUser()
  if (!owner || owner.role !== 'ACADEMY_OWNER' || !owner.academyId) redirect('/login')

  const { id: studentId } = await params

  const data = await getStudentDetail(owner.academyId, studentId)
  if (!data) notFound()

  const { student, classes } = data

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
    createdAt: student.user.createdAt,
    testSessions: student.testSessions.map((s) => ({
      id: s.id,
      score: s.score,
      grammarScore: s.grammarScore,
      vocabularyScore: s.vocabularyScore,
      readingScore: s.readingScore,
      writingScore: s.writingScore,
      listeningScore: s.listeningScore,
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      testTitle: s.test.title,
      testType: s.test.type,
    })),
    radarData: latestGradedSession
      ? {
          grammarScore: latestGradedSession.grammarScore,
          vocabularyScore: latestGradedSession.vocabularyScore,
          readingScore: latestGradedSession.readingScore,
          writingScore: latestGradedSession.writingScore,
          listeningScore: latestGradedSession.listeningScore,
        }
      : null,
  }

  const classData = classes.map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="space-y-6">
      {/* 뒤로 가기 + 연습 기록 */}
      <div className="flex items-center justify-between">
        <Link
          href="/owner/students"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft size={16} />
          학생 목록
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/owner/students/${studentId}/writing-logs`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <BookOpen size={15} />
            쓰기 기록
          </Link>
          <Link
            href={`/owner/students/${studentId}/practice-logs`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <BookOpen size={15} />
            연습 기록
          </Link>
        </div>
      </div>

      <StudentDetailClient student={studentData} classes={classData} />
    </div>
  )
}
