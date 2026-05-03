import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { StudentReportPdf } from '@/components/shared/student-report-pdf'
import type { ReportResult } from '@/types'

const DOMAIN_COLORS: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  LISTENING: '#E91E8A',
  WRITING: '#E35C20',
}

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  LISTENING: '듣기',
  WRITING: '쓰기',
}

export default async function StudentReportPrintPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || (currentUser.role !== 'TEACHER' && currentUser.role !== 'ACADEMY_OWNER')) {
    redirect('/login')
  }

  const { studentId } = await params

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

  const [latestSessions, teacherComments, latestReport] = await Promise.all([
    prisma.testSession.findMany({
      where: {
        studentId: student.id,
        status: { in: ['COMPLETED', 'GRADED'] },
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
      select: {
        grammarScore: true,
        vocabularyScore: true,
        readingScore: true,
        listeningScore: true,
        writingScore: true,
        score: true,
      },
    }),
    prisma.teacherComment.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { teacher: { select: { name: true } } },
    }),
    prisma.report.findFirst({
      where: { studentId: student.id, type: 'AI_MONTHLY' },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const domainAvg: Record<string, number[]> = {
    GRAMMAR: [],
    VOCABULARY: [],
    READING: [],
    WRITING: [],
  }

  for (const s of latestSessions) {
    if (s.grammarScore != null) domainAvg.GRAMMAR.push(s.grammarScore)
    if (s.vocabularyScore != null) domainAvg.VOCABULARY.push(s.vocabularyScore)
    if (s.readingScore != null) domainAvg.READING.push(s.readingScore)
    if (s.writingScore != null) domainAvg.WRITING.push(s.writingScore)
  }

  const listeningScores = latestSessions.flatMap((s) =>
    s.listeningScore != null ? [s.listeningScore] : [],
  )
  if (listeningScores.length > 0) domainAvg.LISTENING = listeningScores

  const domainScores = Object.entries(domainAvg).map(([key, scores]) => ({
    subject: DOMAIN_LABEL[key],
    score: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    fullMark: 100,
    color: DOMAIN_COLORS[key],
    key: key.toLowerCase() as 'grammar' | 'vocabulary' | 'reading' | 'listening' | 'writing',
  }))

  const comments = teacherComments.map((c) => ({
    id: c.id,
    content: c.content,
    teacherName: c.teacher.name,
    createdAt: c.createdAt,
  }))

  const savedReport =
    latestReport &&
    typeof latestReport.dataJson === 'object' &&
    latestReport.dataJson !== null &&
    !Array.isArray(latestReport.dataJson)
      ? (latestReport.dataJson as unknown as ReportResult & { metadata?: unknown })
      : null

  const aiReport = savedReport
    ? (({ metadata: _m, ...rest }) => rest as ReportResult)(savedReport)
    : null

  const academyName =
    student.user.academy?.businessName ?? student.user.academy?.name ?? '학원'

  return (
    <div className="max-w-4xl mx-auto px-8 py-8 print:px-6 print:py-6">
      <StudentReportPdf
        studentName={student.user.name}
        studentId={student.id}
        grade={student.grade}
        currentLevel={student.currentLevel}
        className={student.class?.name}
        academyName={academyName}
        domainScores={domainScores}
        teacherComments={comments}
        initialReport={aiReport}
      />
    </div>
  )
}
