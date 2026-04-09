import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Target, RotateCcw, Sparkles } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '독해',
  LISTENING: '듣기',
  WRITING: '쓰기',
}

const DOMAIN_COLOR: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  LISTENING: '#E91E8A',
  WRITING: '#E35C20',
}

const MODE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  adaptive: {
    label: 'AI 맞춤형 학습',
    icon: <Sparkles className="h-4 w-4" />,
    color: '#7854F7',
  },
  domain: {
    label: '영역별 연습',
    icon: <Target className="h-4 w-4" />,
    color: '#1865F2',
  },
  review: {
    label: '오답 복습',
    icon: <RotateCcw className="h-4 w-4" />,
    color: '#D92916',
  },
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function OwnerPracticeLogsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const owner = await getCurrentUser()
  if (!owner || owner.role !== 'ACADEMY_OWNER' || !owner.academyId) redirect('/login')

  const { id: studentId } = await params

  const student = await prisma.student.findFirst({
    where: { id: studentId, user: { academyId: owner.academyId, isDeleted: false } },
    include: {
      user: { select: { name: true } },
      class: { select: { name: true } },
    },
  })

  if (!student) notFound()

  const logs = await prisma.practiceLog.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // 통계 계산
  const totalSessions = logs.length
  const totalQuestions = logs.reduce((sum, l) => sum + l.totalCount, 0)
  const totalCorrect = logs.reduce((sum, l) => sum + l.correctCount, 0)
  const overallAccuracy =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0

  // 도메인별 통계
  const domainStats: Record<string, { count: number; correct: number; total: number }> = {}
  for (const log of logs) {
    if (!log.domain) continue
    const d = log.domain as string
    if (!domainStats[d]) domainStats[d] = { count: 0, correct: 0, total: 0 }
    domainStats[d].count++
    domainStats[d].correct += log.correctCount
    domainStats[d].total += log.totalCount
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 뒤로 가기 */}
      <Link
        href={`/owner/students/${student.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft size={15} />
        {student.user.name} 학생 상세로
      </Link>

      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7854F7]/10">
          <BookOpen className="h-5 w-5 text-[#7854F7]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{student.user.name} 학습공간 연습 기록</h1>
          <p className="text-sm text-gray-500">
            {student.class?.name ?? '반 미배정'} · 총 {totalSessions}회 연습
          </p>
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
          <p className="text-2xl font-black text-gray-900">{totalSessions}</p>
          <p className="mt-0.5 text-sm text-gray-500">총 연습 횟수</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
          <p className="text-2xl font-black text-gray-900">{totalQuestions}</p>
          <p className="mt-0.5 text-sm text-gray-500">총 풀이 문제 수</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
          <p
            className="text-2xl font-black"
            style={{ color: overallAccuracy >= 70 ? '#1FAF54' : '#D92916' }}
          >
            {overallAccuracy}%
          </p>
          <p className="mt-0.5 text-sm text-gray-500">전체 정답률</p>
        </div>
      </div>

      {/* 영역별 통계 */}
      {Object.keys(domainStats).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">영역별 연습 통계</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(domainStats).map(([domain, stat]) => {
              const accuracy =
                stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0
              const color = DOMAIN_COLOR[domain] ?? '#1865F2'
              return (
                <div
                  key={domain}
                  className="rounded-xl border p-4"
                  style={{ borderColor: color + '40', backgroundColor: color + '08' }}
                >
                  <p className="text-xs font-semibold" style={{ color }}>
                    {DOMAIN_LABEL[domain] ?? domain}
                  </p>
                  <p className="mt-2 text-xl font-black" style={{ color }}>
                    {accuracy}%
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {stat.correct}/{stat.total} 정답 · {stat.count}회
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 연습 기록 목록 */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700">연습 기록</h2>
        </div>

        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 text-4xl">📚</div>
            <p className="text-sm font-medium text-gray-600">아직 연습 기록이 없습니다</p>
            <p className="mt-1 text-xs text-gray-400">학습공간에서 연습을 완료하면 기록이 쌓입니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => {
              const mode = MODE_CONFIG[log.mode] ?? {
                label: log.mode,
                icon: <BookOpen className="h-4 w-4" />,
                color: '#1865F2',
              }
              const accuracy = Math.round((log.correctCount / log.totalCount) * 100)
              const domainColor = log.domain
                ? (DOMAIN_COLOR[log.domain as string] ?? '#1865F2')
                : mode.color

              return (
                <div key={log.id} className="flex items-center gap-4 px-5 py-4">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: mode.color + '15', color: mode.color }}
                  >
                    {mode.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{mode.label}</span>
                      {log.domain && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                          style={{ backgroundColor: domainColor }}
                        >
                          {DOMAIN_LABEL[log.domain as string] ?? log.domain}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">{formatDate(log.createdAt)}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className="text-base font-black"
                      style={{ color: accuracy >= 70 ? '#1FAF54' : '#D92916' }}
                    >
                      {accuracy}%
                    </p>
                    <p className="text-xs text-gray-400">
                      {log.correctCount}/{log.totalCount}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
