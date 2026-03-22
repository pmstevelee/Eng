import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'
import { ResultRadarChart } from './_components/result-radar-chart'
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'

type DomainKey = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING'

const DOMAIN_LABELS: Record<DomainKey, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '독해',
  WRITING: '쓰기',
}

// 영역 색상 (CLAUDE.md 디자인 시스템)
const DOMAIN_COLOR: Record<DomainKey, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
}

const TEST_TYPE_LABELS: Record<string, string> = {
  LEVEL_TEST: '레벨 테스트',
  UNIT_TEST: '단원 테스트',
  PRACTICE: '연습 테스트',
}

type WritingAnswerJson = {
  teacherScore?: number
  teacherComment?: string
  grammarScore?: number
  structureScore?: number
  vocabularyScore?: number
  expressionScore?: number
}

function ScoreDiffBadge({ diff }: { diff: number }) {
  if (diff > 0)
    return (
      <span className="flex items-center gap-0.5 text-xs font-semibold text-[#1FAF54]">
        <TrendingUp className="h-3.5 w-3.5" />+{diff}
      </span>
    )
  if (diff < 0)
    return (
      <span className="flex items-center gap-0.5 text-xs font-semibold text-[#D92916]">
        <TrendingDown className="h-3.5 w-3.5" />
        {diff}
      </span>
    )
  return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-gray-400">
      <Minus className="h-3.5 w-3.5" />±0
    </span>
  )
}

export default async function TestResultPage({
  params,
}: {
  params: { sessionId: string }
}) {
  const { sessionId } = params

  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { student: { select: { id: true } } },
  })
  if (!dbUser?.student) redirect('/login')

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId, studentId: dbUser.student.id },
    include: {
      test: {
        select: {
          id: true,
          title: true,
          type: true,
          totalScore: true,
          questionOrder: true,
        },
      },
      questionResponses: {
        select: {
          id: true,
          questionId: true,
          answer: true,
          answerJson: true,
          isCorrect: true,
        },
      },
    },
  })

  if (!session) notFound()
  if (session.status === 'NOT_STARTED' || session.status === 'IN_PROGRESS') {
    redirect(`/student/tests/${sessionId}`)
  }

  // 문제 데이터 로드 (questionOrder 순서 보장)
  const questionIds = (session.test.questionOrder as string[]) || []
  const questionsRaw = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, domain: true, contentJson: true },
  })
  const questionMap = new Map(questionsRaw.map((q) => [q.id, q]))
  const questions = questionIds
    .map((id) => questionMap.get(id))
    .filter((q): q is NonNullable<typeof q> => q !== undefined)

  // 응답 맵
  const responseMap = new Map(session.questionResponses.map((r) => [r.questionId, r]))

  // 이전 세션 비교 (동일 테스트 타입 기준)
  const prevSession = await prisma.testSession.findFirst({
    where: {
      studentId: dbUser.student.id,
      id: { not: sessionId },
      status: { in: ['COMPLETED', 'GRADED'] },
      test: { type: session.test.type },
      completedAt: { lt: session.completedAt ?? new Date() },
    },
    orderBy: { completedAt: 'desc' },
    select: {
      score: true,
      grammarScore: true,
      vocabularyScore: true,
      readingScore: true,
      writingScore: true,
    },
  })

  const hasWriting = questions.some(
    (q) => (q.contentJson as QuestionContentJson).type === 'essay',
  )
  const isFullyGraded = session.status === 'GRADED'

  // 총점 표시 (쓰기 미채점이면 객관식 기준)
  const displayScore = (() => {
    if (!hasWriting) return session.score
    if (!isFullyGraded) return session.score
    const scores = [
      session.grammarScore,
      session.vocabularyScore,
      session.readingScore,
      session.writingScore,
    ].filter((s): s is number => s !== null)
    if (scores.length === 0) return session.score
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  })()

  const domainScores: Record<DomainKey, number | null> = {
    GRAMMAR: session.grammarScore,
    VOCABULARY: session.vocabularyScore,
    READING: session.readingScore,
    WRITING: session.writingScore,
  }
  const prevDomainScores: Record<DomainKey, number | null> = {
    GRAMMAR: prevSession?.grammarScore ?? null,
    VOCABULARY: prevSession?.vocabularyScore ?? null,
    READING: prevSession?.readingScore ?? null,
    WRITING: prevSession?.writingScore ?? null,
  }

  const radarData = (
    ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING'] as DomainKey[]
  ).map((d) => ({
    subject: DOMAIN_LABELS[d],
    score: domainScores[d] ?? 0,
    fullMark: 100,
  }))

  const totalDiff =
    displayScore !== null && prevSession?.score !== null && prevSession?.score !== undefined
      ? displayScore - prevSession.score
      : null

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      {/* 브레드크럼 */}
      <a
        href="/student/tests"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
        테스트 목록
      </a>

      {/* 헤더 */}
      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {TEST_TYPE_LABELS[session.test.type] ?? session.test.type}
          </span>
          {isFullyGraded ? (
            <span className="rounded-full bg-[#1FAF54]/10 px-2.5 py-0.5 text-xs font-medium text-[#1FAF54]">
              채점 완료
            </span>
          ) : hasWriting ? (
            <span className="rounded-full bg-[#FFB100]/10 px-2.5 py-0.5 text-xs font-medium text-[#FFB100]">
              쓰기 채점 대기 중
            </span>
          ) : (
            <span className="rounded-full bg-[#1FAF54]/10 px-2.5 py-0.5 text-xs font-medium text-[#1FAF54]">
              채점 완료
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{session.test.title} — 결과</h1>
        {session.completedAt && (
          <p className="mt-1 text-sm text-gray-500">
            제출: {new Date(session.completedAt).toLocaleString('ko-KR')}
          </p>
        )}
      </div>

      {/* 총점 + 이전 대비 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          {/* 원형 점수 */}
          <div className="flex flex-col items-center">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-[5px] border-[#1865F2]">
              <div className="text-center">
                <p className="text-3xl font-bold leading-none text-[#1865F2]">
                  {displayScore ?? '—'}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">/ 100</p>
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-600">종합 점수</p>
            {hasWriting && !isFullyGraded && (
              <p className="mt-0.5 text-xs text-[#FFB100]">객관식 기준</p>
            )}
          </div>

          {/* 이전 대비 변화 */}
          {prevSession && totalDiff !== null && (
            <div className="flex-1 rounded-xl bg-gray-50 px-5 py-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                이전 대비
              </p>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xs text-gray-400">이전</p>
                  <p className="text-xl font-bold text-gray-400">{prevSession.score ?? '—'}</p>
                </div>
                <div className="flex-1 text-center">
                  {totalDiff > 0 ? (
                    <div className="flex flex-col items-center">
                      <TrendingUp className="h-6 w-6 text-[#1FAF54]" />
                      <span className="text-2xl font-bold text-[#1FAF54]">+{totalDiff}</span>
                    </div>
                  ) : totalDiff < 0 ? (
                    <div className="flex flex-col items-center">
                      <TrendingDown className="h-6 w-6 text-[#D92916]" />
                      <span className="text-2xl font-bold text-[#D92916]">{totalDiff}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Minus className="h-6 w-6 text-gray-400" />
                      <span className="text-lg font-bold text-gray-400">변동 없음</span>
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">이번</p>
                  <p className="text-xl font-bold text-[#1865F2]">{displayScore ?? '—'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 영역별 점수 + 레이더 차트 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">영역별 점수</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* 도메인 카드 */}
          <div className="grid grid-cols-2 gap-3">
            {(['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING'] as DomainKey[]).map((domain) => {
              const hasDomain = questions.some((q) => q.domain === domain)
              if (!hasDomain) return null

              const curr = domainScores[domain]
              const prev = prevDomainScores[domain]
              const diff = curr !== null && prev !== null ? curr - prev : null
              const isPending = domain === 'WRITING' && hasWriting && !isFullyGraded

              return (
                <div
                  key={domain}
                  className="rounded-xl border border-gray-100 p-4"
                  style={{ borderTopColor: DOMAIN_COLOR[domain], borderTopWidth: 3 }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {DOMAIN_LABELS[domain]}
                  </p>
                  {isPending ? (
                    <p className="mt-1 text-xl font-bold text-[#FFB100]">대기</p>
                  ) : (
                    <p
                      className="mt-1 text-2xl font-bold"
                      style={{ color: DOMAIN_COLOR[domain] }}
                    >
                      {curr !== null ? curr : '—'}
                      <span className="ml-0.5 text-sm font-normal text-gray-400">점</span>
                    </p>
                  )}
                  {diff !== null && <ScoreDiffBadge diff={diff} />}
                </div>
              )
            })}
          </div>

          {/* 레이더 차트 */}
          <div>
            <ResultRadarChart data={radarData} />
          </div>
        </div>
      </div>

      {/* 문제별 결과 */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">문제별 결과</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {questions.map((q, idx) => {
            const content = q.contentJson as QuestionContentJson
            const response = responseMap.get(q.id)
            const domain = q.domain as DomainKey
            const isEssay = content.type === 'essay'
            const writingData = isEssay && response?.answerJson
              ? (response.answerJson as WritingAnswerJson)
              : null
            const isWritingGraded = writingData?.teacherScore !== undefined

            return (
              <div key={q.id} className="px-5 py-4">
                {/* 문제 헤더 */}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-400">Q{idx + 1}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: DOMAIN_COLOR[domain] }}
                    >
                      {DOMAIN_LABELS[domain]}
                    </span>
                  </div>

                  {/* 정답/오답 배지 */}
                  {!isEssay && (
                    response?.isCorrect === true ? (
                      <span className="flex items-center gap-1 rounded-full bg-[#1FAF54]/10 px-2 py-0.5 text-xs font-medium text-[#1FAF54]">
                        <CheckCircle2 className="h-3 w-3" />정답
                      </span>
                    ) : response?.isCorrect === false ? (
                      <span className="flex items-center gap-1 rounded-full bg-[#D92916]/10 px-2 py-0.5 text-xs font-medium text-[#D92916]">
                        <XCircle className="h-3 w-3" />오답
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        미응답
                      </span>
                    )
                  )}
                  {isEssay && (
                    isWritingGraded ? (
                      <span className="rounded-full bg-[#7854F7]/10 px-2 py-0.5 text-xs font-medium text-[#7854F7]">
                        {writingData?.teacherScore}점
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-[#FFB100]/10 px-2 py-0.5 text-xs font-medium text-[#FFB100]">
                        <Clock className="h-3 w-3" />채점 대기중
                      </span>
                    )
                  )}
                </div>

                {/* 지문 (리딩) */}
                {content.passage && (
                  <div className="mb-3 rounded-lg bg-gray-50 p-3">
                    <p className="mb-1 text-xs font-medium text-gray-400">지문</p>
                    <p className="line-clamp-4 text-sm leading-relaxed text-gray-700">
                      {content.passage}
                    </p>
                  </div>
                )}

                {/* 문제 텍스트 */}
                <p className="mb-3 text-sm font-medium text-gray-800">{content.question_text}</p>

                {/* 객관식 선택지 */}
                {content.type === 'multiple_choice' && content.options && (
                  <div className="space-y-1.5">
                    {content.options.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i)
                      const isSelected =
                        response?.answer === opt || response?.answer === letter
                      const isCorrectOpt =
                        content.correct_answer === opt || content.correct_answer === letter
                      let cls =
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm '
                      if (isCorrectOpt)
                        cls += 'border-[#1FAF54] bg-[#1FAF54]/5 text-[#1FAF54] font-medium'
                      else if (isSelected && !isCorrectOpt)
                        cls += 'border-[#D92916] bg-[#D92916]/5 text-[#D92916] line-through'
                      else cls += 'border-gray-100 text-gray-600'
                      return (
                        <div key={i} className={cls}>
                          <span className="font-medium">{letter}.</span>
                          <span>{opt}</span>
                          {isCorrectOpt && (
                            <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-[#1FAF54]" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 단답형 / 빈칸 */}
                {(content.type === 'fill_blank' || content.type === 'short_answer') && (
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">내 답:</span>
                      <span
                        className={
                          response?.isCorrect === false
                            ? 'font-medium text-[#D92916] line-through'
                            : 'font-medium text-gray-800'
                        }
                      >
                        {response?.answer ?? '(미응답)'}
                      </span>
                    </div>
                    {response?.isCorrect === false && content.correct_answer && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">정답:</span>
                        <span className="font-medium text-[#1FAF54]">
                          {content.correct_answer}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 에세이 */}
                {isEssay && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="mb-1.5 text-xs font-medium text-gray-400">내 답안</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                        {response?.answer ?? '(미응답)'}
                      </p>
                    </div>

                    {/* 교사 채점 결과 */}
                    {isWritingGraded && (
                      <div className="rounded-lg border border-[#7854F7]/20 bg-[#7854F7]/5 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-[#7854F7]">교사 채점 결과</p>
                          <span className="text-xl font-bold text-[#7854F7]">
                            {writingData?.teacherScore}점
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: '문법', val: writingData?.grammarScore },
                            { label: '구성', val: writingData?.structureScore },
                            { label: '어휘', val: writingData?.vocabularyScore },
                            { label: '표현력', val: writingData?.expressionScore },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className="rounded-lg bg-white/60 py-2 text-center"
                            >
                              <p className="text-xs text-gray-500">{item.label}</p>
                              <p className="text-sm font-bold text-[#7854F7]">
                                {item.val ?? '—'}
                              </p>
                            </div>
                          ))}
                        </div>
                        {writingData?.teacherComment && (
                          <div className="border-t border-[#7854F7]/10 pt-3">
                            <p className="mb-1 text-xs font-medium text-gray-400">교사 코멘트</p>
                            <p className="text-sm text-gray-700">{writingData.teacherComment}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 오답 해설 */}
                {!isEssay && response?.isCorrect === false && content.explanation && (
                  <div className="mt-3 rounded-lg border border-[#1865F2]/20 bg-[#1865F2]/5 p-3">
                    <p className="mb-1 text-xs font-semibold text-[#1865F2]">해설</p>
                    <p className="text-sm text-[#1865F2]/80">{content.explanation}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex justify-center pb-4">
        <a
          href="/student/tests"
          className="inline-flex min-h-[44px] items-center rounded-xl bg-[#1865F2] px-8 py-3 text-sm font-semibold text-white hover:bg-[#1558d6]"
        >
          테스트 목록으로
        </a>
      </div>
    </div>
  )
}
