import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, PenLine, AlertCircle, BookOpen, CheckCircle2 } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import type { WritingPracticeData } from '@/app/(dashboard)/student/learn/writing/history/page'

function getScoreColor(pct: number) {
  if (pct >= 80) return '#1FAF54'
  if (pct >= 60) return '#FFB100'
  return '#D92916'
}

function getScoreBg(pct: number) {
  if (pct >= 80) return '#F0FDF4'
  if (pct >= 60) return '#FFFBEB'
  return '#FEF2F2'
}

function formatDate(date: Date) {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const SCORE_LABELS: Record<string, string> = {
  grammar: '문법',
  organization: '구성',
  vocabulary: '어휘',
  expression: '표현',
}

const CATEGORY_LABELS: Record<string, string> = {
  grammar: '문법',
  vocabulary: '어휘',
  expression: '표현',
}

export default async function TeacherWritingLogsPage({
  params,
}: {
  params: { studentId: string }
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const student = await prisma.student.findFirst({
    where: { id: params.studentId, class: { teacherId: user.id } },
    include: {
      user: { select: { name: true } },
      class: { select: { name: true } },
    },
  })
  if (!student) notFound()

  const reports = await prisma.report.findMany({
    where: { studentId: student.id, type: 'WRITING_PRACTICE' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, createdAt: true, dataJson: true },
  })

  const history = reports.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    data: r.dataJson as WritingPracticeData,
  }))

  const avgScore =
    history.length > 0
      ? Math.round(history.reduce((sum, h) => sum + h.data.percentage, 0) / history.length)
      : null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* 뒤로가기 */}
      <Link
        href={`/teacher/students/${student.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={15} />
        {student.user.name} 학생 상세로
      </Link>

      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: '#FFF7ED' }}
        >
          <PenLine className="h-5 w-5" style={{ color: '#E35C20' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {student.user.name} 쓰기 연습 기록
          </h1>
          <p className="text-sm text-gray-500">
            {student.class?.name ?? '반 미배정'} · 총 {history.length}회 연습
          </p>
        </div>
      </div>

      {/* 요약 */}
      {history.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
            <p className="text-2xl font-black text-gray-900">{history.length}</p>
            <p className="mt-0.5 text-sm text-gray-500">총 연습 횟수</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
            <p
              className="text-2xl font-black"
              style={{ color: avgScore !== null ? getScoreColor(avgScore) : '#6B6F7A' }}
            >
              {avgScore !== null ? `${avgScore}%` : '-'}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">평균 점수</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
            <p className="text-2xl font-black text-gray-900">
              Level {history[0]?.data.level ?? '-'}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">현재 레벨</p>
          </div>
        </div>
      )}

      {/* 목록 */}
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: '#FFF7ED' }}
          >
            <PenLine className="h-7 w-7" style={{ color: '#E35C20' }} />
          </div>
          <p className="font-semibold text-gray-700">아직 쓰기 연습 기록이 없어요</p>
          <p className="mt-1 text-sm text-gray-400">학생이 쓰기 연습을 완료하면 이곳에 기록됩니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => {
            const pct = item.data.percentage
            const color = getScoreColor(pct)
            const bg = getScoreBg(pct)

            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                {/* 상단 요약 */}
                <div className="flex items-start justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                      style={{ backgroundColor: bg, color }}
                    >
                      {Math.round(pct)}%
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{item.data.topicTitle}</p>
                      <p className="text-xs text-gray-400">
                        Level {item.data.level} ({item.data.cefrLevel}) · {item.data.wordCount}단어 ·{' '}
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{ backgroundColor: bg, color }}
                  >
                    {item.data.totalScore}/{item.data.totalMaxScore}점
                  </span>
                </div>

                {/* 영역별 점수 바 */}
                <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
                  {(Object.entries(item.data.scores) as [string, { score: number; maxForLevel: number; details: string }][]).map(
                    ([key, val]) => (
                      <div key={key} className="px-3 py-3 text-center">
                        <p className="text-xs text-gray-400">{SCORE_LABELS[key]}</p>
                        <p
                          className="text-base font-bold"
                          style={{
                            color: getScoreColor((val.score / val.maxForLevel) * 100),
                          }}
                        >
                          {val.score}
                          <span className="text-xs font-normal text-gray-300">/{val.maxForLevel}</span>
                        </p>
                      </div>
                    ),
                  )}
                </div>

                {/* AI 총평 */}
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                  <p className="text-sm text-gray-600 leading-relaxed">{item.data.overallComment}</p>
                </div>

                {/* 에세이 원문 */}
                <details className="group border-t border-gray-100">
                  <summary className="cursor-pointer list-none px-5 py-3 text-xs font-semibold text-gray-500 hover:bg-gray-50 group-open:bg-gray-50">
                    에세이 원문 보기 ▾
                  </summary>
                  <div className="px-5 pb-4">
                    <p className="whitespace-pre-wrap rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-800 leading-relaxed">
                      {item.data.essay}
                    </p>
                  </div>
                </details>

                {/* 교정 포인트 */}
                {item.data.corrections.length > 0 && (
                  <details className="group border-t border-gray-100">
                    <summary className="cursor-pointer list-none px-5 py-3 text-xs font-semibold text-gray-500 hover:bg-gray-50 group-open:bg-gray-50">
                      교정 포인트 ({item.data.corrections.length}개) ▾
                    </summary>
                    <div className="space-y-2 px-5 pb-4">
                      {item.data.corrections.map((c, i) => (
                        <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                          <div className="mb-1 flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5" style={{ color: '#D92916' }} />
                            <span className="text-xs font-medium" style={{ color: '#D92916' }}>
                              {CATEGORY_LABELS[c.category] ?? c.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 line-through">{c.original}</p>
                          <p className="text-sm font-medium text-gray-900">{c.corrected}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{c.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* 모범 답안 */}
                <details className="group border-t border-gray-100">
                  <summary className="cursor-pointer list-none px-5 py-3 text-xs font-semibold text-gray-500 hover:bg-gray-50 group-open:bg-gray-50">
                    모범 답안 보기 ▾
                  </summary>
                  <div className="px-5 pb-4">
                    <div
                      className="rounded-xl border p-4"
                      style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
                    >
                      <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                        {item.data.modelEssay.text}
                      </p>
                      {item.data.modelEssay.keyFeatures.length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {item.data.modelEssay.keyFeatures.map((f, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                              <CheckCircle2
                                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                style={{ color: '#1865F2' }}
                              />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </details>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
