import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { StudentReportPdf } from '@/components/shared/student-report-pdf'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReportResult } from '@/app/api/ai/generate-report/route'

const DOMAIN_COLORS: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
}

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  WRITING: '쓰기',
}

export default async function StudentReportPage({
  params,
}: {
  params: { studentId: string }
}) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    include: {
      user: {
        select: { name: true, academyId: true, academy: { select: { name: true, businessName: true } } },
      },
      class: { select: { name: true } },
    },
  })

  if (!student) notFound()

  const [latestSessions, teacherComments, latestReport] = await Promise.all([
    // 영역별 점수 (최근 완료 세션들)
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
        writingScore: true,
        score: true,
      },
    }),
    // 교사 코멘트
    prisma.teacherComment.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { teacher: { select: { name: true } } },
    }),
    // 최근 AI 리포트
    prisma.report.findFirst({
      where: { studentId: student.id, type: 'AI_MONTHLY' },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // 영역 평균 점수 계산
  const domainAvg: Record<string, number[]> = {
    GRAMMAR: [],
    VOCABULARY: [],
    READING: [],
    WRITING: [],
  }

  latestSessions.forEach((s) => {
    if (s.grammarScore != null) domainAvg.GRAMMAR.push(s.grammarScore)
    if (s.vocabularyScore != null) domainAvg.VOCABULARY.push(s.vocabularyScore)
    if (s.readingScore != null) domainAvg.READING.push(s.readingScore)
    if (s.writingScore != null) domainAvg.WRITING.push(s.writingScore)
  })

  const domainScores = Object.entries(domainAvg).map(([key, scores]) => ({
    subject: DOMAIN_LABEL[key],
    score: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    fullMark: 100,
    color: DOMAIN_COLORS[key],
    key: key.toLowerCase() as 'grammar' | 'vocabulary' | 'reading' | 'writing',
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
    <div className="max-w-4xl mx-auto space-y-4">
      {/* 뒤로 가기 - 화면에서만 */}
      <div className="print:hidden">
        <Link
          href="/teacher/students"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={15} />
          학생 목록으로
        </Link>
      </div>

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
