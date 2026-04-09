import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { StudentDetailClient } from './student-detail-client'
import { getPromotionProgress } from '@/lib/assessment/promotion-engine'

export default async function StudentDetailPage({
  params,
}: {
  params: { studentId: string }
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  // Ensure teacher owns this student's class
  const student = await prisma.student.findFirst({
    where: {
      id: params.studentId,
      class: { teacherId: user.id },
    },
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { id: true, name: true } },
    },
  })

  if (!student) notFound()

  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)

  const [testSessions, learningPath, teacherComments, attendanceRecords, levelAssessments, promotionProgress] = await Promise.all([
    prisma.testSession.findMany({
      where: {
        studentId: student.id,
        status: { in: ['COMPLETED', 'GRADED'] },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        score: true,
        grammarScore: true,
        vocabularyScore: true,
        readingScore: true,
        listeningScore: true,
        writingScore: true,
        completedAt: true,
        test: { select: { title: true, type: true } },
      },
    }),
    prisma.learningPath.findFirst({
      where: { studentId: student.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.teacherComment.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        type: true,
        createdAt: true,
        teacher: { select: { name: true } },
      },
    }),
    prisma.attendance.findMany({
      where: {
        studentId: student.id,
        date: { gte: threeMonthsAgo },
      },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, status: true, classId: true },
    }),
    prisma.levelAssessment.findMany({
      where: { studentId: student.id },
      orderBy: { assessedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        assessmentType: true,
        grammarLevel: true,
        vocabularyLevel: true,
        readingLevel: true,
        listeningLevel: true,
        writingLevel: true,
        overallLevel: true,
        assessedAt: true,
        assessedBy: true,
        isCurrent: true,
        detailJson: true,
      },
    }),
    getPromotionProgress(student.id),
  ])

  // Serialize all Date objects
  const serializedSessions = testSessions.map((s) => ({
    id: s.id,
    score: s.score,
    grammarScore: s.grammarScore,
    vocabularyScore: s.vocabularyScore,
    readingScore: s.readingScore,
    listeningScore: s.listeningScore ?? null,
    writingScore: s.writingScore,
    completedAt: s.completedAt?.toISOString() ?? null,
    testTitle: s.test.title,
    testType: s.test.type,
  }))

  const serializedLearningPath = learningPath
    ? {
        id: learningPath.id,
        title: learningPath.title,
        description: learningPath.description,
        goalsJson: learningPath.goalsJson,
        progressJson: learningPath.progressJson,
        createdAt: learningPath.createdAt.toISOString(),
      }
    : null

  const serializedComments = teacherComments.map((c) => ({
    id: c.id,
    content: c.content,
    month: c.type ?? '',
    teacherName: c.teacher.name,
    createdAt: c.createdAt.toISOString(),
  }))

  const serializedAttendance = attendanceRecords.map((a) => ({
    id: a.id,
    date: a.date.toISOString(),
    status: a.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
    classId: a.classId,
  }))

  const serializedLevelAssessments = levelAssessments.map((la) => ({
    id: la.id,
    assessmentType: la.assessmentType,
    grammarLevel: la.grammarLevel,
    vocabularyLevel: la.vocabularyLevel,
    readingLevel: la.readingLevel,
    listeningLevel: la.listeningLevel ?? null,
    writingLevel: la.writingLevel,
    overallLevel: la.overallLevel,
    assessedAt: la.assessedAt.toISOString(),
    assessedBy: la.assessedBy,
    isCurrent: la.isCurrent,
    detailJson: la.detailJson,
  }))

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <div>
        <Link
          href="/teacher/students"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeft size={15} />
          학생 목록으로
        </Link>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#1865F2]/10 flex items-center justify-center text-[#1865F2] font-bold text-lg">
              {student.user.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{student.user.name}</h1>
              <p className="text-sm text-gray-500">
                {student.class?.name ?? '반 미배정'} · Level {student.currentLevel} · {student.user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/teacher/students/${student.id}/writing-logs`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <BookOpen size={15} />
              쓰기 기록
            </Link>
            <Link
              href={`/teacher/students/${student.id}/practice-logs`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <BookOpen size={15} />
              연습 기록
            </Link>
          </div>
        </div>
      </div>

      <StudentDetailClient
        studentId={student.id}
        studentName={student.user.name}
        currentLevel={student.currentLevel}
        classId={student.class?.id ?? ''}
        testSessions={serializedSessions}
        learningPath={serializedLearningPath}
        comments={serializedComments}
        attendance={serializedAttendance}
        levelAssessments={serializedLevelAssessments}
        promotionProgress={promotionProgress}
      />
    </div>
  )
}
