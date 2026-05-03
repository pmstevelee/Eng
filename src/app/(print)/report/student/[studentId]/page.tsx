import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { StudentDetailedReport } from '@/components/shared/student-detailed-report'
import type {
  TestSessionData,
  PracticeLogData,
  WritingLogData,
  GradeComparisonData,
  TeacherCommentData,
} from '@/components/shared/student-detailed-report'
import type { DetailedReportResult } from '@/types'

type WritingDataJson = {
  topicTitle?: string
  level?: number
  cefrLevel?: string
  wordCount?: number
  percentage?: number
  totalScore?: number
  totalMaxScore?: number
  scores?: {
    grammar?: { score: number; maxForLevel: number }
    organization?: { score: number; maxForLevel: number }
    vocabulary?: { score: number; maxForLevel: number }
    expression?: { score: number; maxForLevel: number }
  }
}

export default async function StudentDetailedReportPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || (currentUser.role !== 'TEACHER' && currentUser.role !== 'ACADEMY_OWNER')) {
    redirect('/login')
  }

  const { studentId } = await params

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      user: { academyId: currentUser.academyId ?? undefined },
    },
    include: {
      user: {
        select: {
          name: true,
          academyId: true,
          academy: { select: { name: true, businessName: true } },
        },
      },
      class: { select: { name: true } },
    },
  })

  if (!student) notFound()

  const [testSessions, practiceLogs, writingLogs, teacherComments, latestDetailedReport] =
    await Promise.all([
      prisma.testSession.findMany({
        where: {
          studentId,
          status: { in: ['COMPLETED', 'GRADED'] },
          completedAt: { gte: threeMonthsAgo },
        },
        include: { test: { select: { title: true, type: true } } },
        orderBy: { completedAt: 'asc' },
      }),
      prisma.practiceLog.findMany({
        where: { studentId, createdAt: { gte: threeMonthsAgo } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.report.findMany({
        where: { studentId, type: 'WRITING_PRACTICE', createdAt: { gte: threeMonthsAgo } },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
      prisma.teacherComment.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { teacher: { select: { name: true } } },
      }),
      prisma.report.findFirst({
        where: { studentId, type: 'AI_DETAILED' },
        orderBy: { createdAt: 'desc' },
      }),
    ])

  // 동학년 비교 데이터
  const nonNull = <T,>(v: T | null): v is T => v !== null
  const calcAvg = (arr: (number | null)[]): number | null => {
    const vals = arr.filter(nonNull)
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }

  let gradeComparison: GradeComparisonData = {
    grade: student.grade,
    peerCount: 0,
    studentAvgScore: calcAvg(testSessions.map((s) => s.score)),
    peerAvgScore: null,
    studentAvgGrammar: calcAvg(testSessions.map((s) => s.grammarScore)),
    peerAvgGrammar: null,
    studentAvgVocabulary: calcAvg(testSessions.map((s) => s.vocabularyScore)),
    peerAvgVocabulary: null,
    studentAvgReading: calcAvg(testSessions.map((s) => s.readingScore)),
    peerAvgReading: null,
    studentAvgWriting: calcAvg(testSessions.map((s) => s.writingScore)),
    peerAvgWriting: null,
  }

  if (student.grade && student.user.academyId) {
    const peers = await prisma.student.findMany({
      where: {
        grade: student.grade,
        id: { not: studentId },
        user: { academyId: student.user.academyId, isDeleted: false },
      },
      select: {
        testSessions: {
          where: {
            status: { in: ['COMPLETED', 'GRADED'] },
            completedAt: { gte: threeMonthsAgo },
          },
          select: {
            score: true,
            grammarScore: true,
            vocabularyScore: true,
            readingScore: true,
            writingScore: true,
          },
        },
      },
    })

    const peerSessions = peers.flatMap((p) => p.testSessions)
    gradeComparison = {
      ...gradeComparison,
      peerCount: peers.length,
      peerAvgScore: calcAvg(peerSessions.map((s) => s.score)),
      peerAvgGrammar: calcAvg(peerSessions.map((s) => s.grammarScore)),
      peerAvgVocabulary: calcAvg(peerSessions.map((s) => s.vocabularyScore)),
      peerAvgReading: calcAvg(peerSessions.map((s) => s.readingScore)),
      peerAvgWriting: calcAvg(peerSessions.map((s) => s.writingScore)),
    }
  }

  // 최신 AI 상세 리포트 복원
  const savedReport =
    latestDetailedReport &&
    typeof latestDetailedReport.dataJson === 'object' &&
    latestDetailedReport.dataJson !== null &&
    !Array.isArray(latestDetailedReport.dataJson)
      ? (latestDetailedReport.dataJson as unknown as DetailedReportResult & { metadata?: unknown })
      : null

  const aiReport = savedReport
    ? (({ metadata: _m, ...rest }) => rest as DetailedReportResult)(savedReport)
    : null

  // 직렬화
  const testSessionData: TestSessionData[] = testSessions.map((s) => ({
    id: s.id,
    testTitle: s.test.title,
    testType: s.test.type,
    score: s.score,
    grammarScore: s.grammarScore,
    vocabularyScore: s.vocabularyScore,
    readingScore: s.readingScore,
    writingScore: s.writingScore,
    listeningScore: s.listeningScore,
    completedAt: s.completedAt?.toISOString() ?? null,
  }))

  const practiceLogData: PracticeLogData[] = practiceLogs.map((l) => ({
    id: l.id,
    mode: l.mode,
    domain: l.domain,
    totalCount: l.totalCount,
    correctCount: l.correctCount,
    score: l.score,
    createdAt: l.createdAt.toISOString(),
  }))

  const writingLogData: WritingLogData[] = writingLogs.map((r) => {
    const d = r.dataJson as WritingDataJson
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      topicTitle: d.topicTitle ?? '',
      level: d.level ?? 0,
      cefrLevel: d.cefrLevel ?? '',
      wordCount: d.wordCount ?? 0,
      percentage: d.percentage ?? 0,
      grammarScore: d.scores?.grammar?.score ?? 0,
      grammarMax: d.scores?.grammar?.maxForLevel ?? 0,
      orgScore: d.scores?.organization?.score ?? 0,
      orgMax: d.scores?.organization?.maxForLevel ?? 0,
      vocabScore: d.scores?.vocabulary?.score ?? 0,
      vocabMax: d.scores?.vocabulary?.maxForLevel ?? 0,
      expressionScore: d.scores?.expression?.score ?? 0,
      expressionMax: d.scores?.expression?.maxForLevel ?? 0,
    }
  })

  const commentData: TeacherCommentData[] = teacherComments.map((c) => ({
    id: c.id,
    content: c.content,
    teacherName: c.teacher.name,
    createdAt: c.createdAt.toISOString(),
  }))

  const academyName =
    student.user.academy?.businessName ?? student.user.academy?.name ?? '학원'

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 print:px-4 print:py-4">
      <StudentDetailedReport
        studentId={student.id}
        studentName={student.user.name}
        grade={student.grade}
        currentLevel={student.currentLevel}
        className={student.class?.name ?? null}
        academyName={academyName}
        testSessions={testSessionData}
        practiceLogs={practiceLogData}
        writingLogs={writingLogData}
        gradeComparison={gradeComparison}
        teacherComments={commentData}
        initialReport={aiReport}
      />
    </div>
  )
}
