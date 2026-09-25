import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, FileDown, MessagesSquare } from 'lucide-react'
import { unstable_cache } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { RiskBadge } from '@/components/shared/consultation/risk-badge'
import { StudentConsultationPanel } from '@/components/shared/consultation/student-consultation-panel'
import { toRiskBadge } from '@/lib/consultation/risk-queries'
import { StudentDetailClient } from './student-detail-client'
import { getPromotionProgress } from '@/lib/assessment/promotion-engine'
import { getStudentWordDetail } from '@/lib/words/student-word-stats'

const getStudentDetailData = (studentId: string, teacherId: string) =>
  unstable_cache(
    async () => {
      const now = new Date()
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)

      const [testSessions, learningPath, teacherComments, attendanceRecords, levelAssessments, promotionProgress, wordDetail] =
        await Promise.all([
          prisma.testSession.findMany({
            where: { studentId, status: { in: ['COMPLETED', 'GRADED'] } },
            orderBy: { completedAt: 'desc' },
            take: 10,
            select: {
              id: true, score: true, grammarScore: true, vocabularyScore: true,
              readingScore: true, listeningScore: true, writingScore: true, completedAt: true,
              test: { select: { title: true, type: true } },
            },
          }),
          prisma.learningPath.findFirst({
            where: { studentId, isActive: true },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.teacherComment.findMany({
            where: { studentId },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true, content: true, type: true, createdAt: true,
              teacher: { select: { name: true } },
            },
          }),
          prisma.attendance.findMany({
            where: { studentId, date: { gte: threeMonthsAgo } },
            orderBy: { date: 'asc' },
            select: { id: true, date: true, status: true, classId: true },
          }),
          prisma.levelAssessment.findMany({
            where: { studentId },
            orderBy: { assessedAt: 'desc' },
            take: 20,
            select: {
              id: true, assessmentType: true, grammarLevel: true, vocabularyLevel: true,
              readingLevel: true, listeningLevel: true, writingLevel: true, overallLevel: true,
              assessedAt: true, assessedBy: true, isCurrent: true, detailJson: true,
            },
          }),
          getPromotionProgress(studentId),
          getStudentWordDetail(studentId),
        ])

      return {
        testSessions: testSessions.map((s) => ({
          id: s.id, score: s.score, grammarScore: s.grammarScore, vocabularyScore: s.vocabularyScore,
          readingScore: s.readingScore, listeningScore: s.listeningScore ?? null, writingScore: s.writingScore,
          completedAt: s.completedAt?.toISOString() ?? null,
          testTitle: s.test.title, testType: s.test.type,
        })),
        learningPath: learningPath ? {
          id: learningPath.id, title: learningPath.title, description: learningPath.description,
          goalsJson: learningPath.goalsJson, progressJson: learningPath.progressJson,
          createdAt: learningPath.createdAt.toISOString(),
        } : null,
        teacherComments: teacherComments.map((c) => ({
          id: c.id, content: c.content, month: c.type ?? '',
          teacherName: c.teacher.name, createdAt: c.createdAt.toISOString(),
        })),
        attendanceRecords: attendanceRecords.map((a) => ({
          id: a.id, date: a.date.toISOString(),
          status: a.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED', classId: a.classId,
        })),
        levelAssessments: levelAssessments.map((la) => ({
          id: la.id, assessmentType: la.assessmentType, grammarLevel: la.grammarLevel,
          vocabularyLevel: la.vocabularyLevel, readingLevel: la.readingLevel,
          listeningLevel: la.listeningLevel ?? null, writingLevel: la.writingLevel,
          overallLevel: la.overallLevel, assessedAt: la.assessedAt.toISOString(),
          assessedBy: la.assessedBy, isCurrent: la.isCurrent, detailJson: la.detailJson,
        })),
        promotionProgress,
        wordDetail,
      }
    },
    [`student-detail-${studentId}`, teacherId],
    { revalidate: 30, tags: [`student-${studentId}-detail`, `teacher-${teacherId}-students`] },
  )()

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: { studentId: string }
  searchParams: { tab?: string }
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
      lead: { select: { id: true, assigneeId: true } },
      riskSnapshot: { select: { level: true, reasons: true } },
    },
  })

  if (!student) notFound()

  const {
    testSessions: serializedSessions,
    learningPath: serializedLearningPath,
    teacherComments: serializedComments,
    attendanceRecords: serializedAttendance,
    levelAssessments: serializedLevelAssessments,
    promotionProgress,
    wordDetail,
  } = await getStudentDetailData(student.id, user.id)

  // 교사는 본인 담당 문의만 열람 가능 (leadScopeWhere와 동일 기준)
  const leadId = student.lead?.assigneeId === user.id ? student.lead.id : null
  const risk = toRiskBadge(student.riskSnapshot, student.status)


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
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{student.user.name}</h1>
                {risk && <RiskBadge level={risk.level} reasons={risk.reasons} />}
              </div>
              <p className="text-sm text-gray-500">
                {student.class?.name ?? '반 미배정'} · Level {student.currentLevel} · {student.user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {leadId && (
              <Link
                href={`/teacher/consultations/${leadId}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <MessagesSquare size={15} />
                상담 기록 보기
              </Link>
            )}
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
            <a
              href={`/report/student/${student.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent-purple hover:bg-purple-700 text-white px-4 py-2 text-sm font-medium transition-colors"
            >
              <FileDown size={15} />
              AI 성적 분석 상세
            </a>
          </div>
        </div>
        {risk && risk.reasons.length > 0 && (
          <ul className="mt-4 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 space-y-0.5">
            {risk.reasons.map((r) => (
              <li key={r} className="text-sm text-gray-900">
                · {r}
              </li>
            ))}
          </ul>
        )}
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
        wordDetail={wordDetail}
        initialTab={searchParams.tab === 'consultation' ? 'consultation' : undefined}
        consultation={<StudentConsultationPanel studentId={student.id} />}
      />
    </div>
  )
}
