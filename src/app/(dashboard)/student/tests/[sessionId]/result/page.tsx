import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'
import { ResultRadarChart } from './_components/result-radar-chart'

const DOMAIN_LABELS: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '독해',
  WRITING: '쓰기',
}

const DOMAIN_COLORS: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
}

type WritingAnswerJson = {
  teacherScore?: number
  teacherComment?: string
  grammarScore?: number
  structureScore?: number
  vocabularyScore?: number
  expressionScore?: number
  aiAnalysis?: string
}

export default async function TestResultPage({
  params,
}: {
  params: { sessionId: string }
}) {
  const { sessionId } = params

  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { role: true, student: { select: { id: true } } },
  })
  if (!user || user.role !== 'STUDENT' || !user.student) redirect('/login')

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId, studentId: user.student.id },
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

  // 문제 데이터 로드
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
      studentId: user.student.id,
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

  const scoreDiff = (curr: number | null, prev: number | null) => {
    if (curr === null || prev === null) return null
    return curr - prev
  }

  const hasWriting = questions.some((q) => {
    const c = q.contentJson as QuestionContentJson
    return c.type === 'essay'
  })

  const isFullyGraded = session.status === 'GRADED'

  // 총점 표시 (쓰기 포함 여부에 따라)
  const displayScore = (() => {
    if (!hasWriting) return session.score
    if (!isFullyGraded) return session.score // 쓰기 채점 전: 객관식 점수만
    // 쓰기 채점 후: 전체 평균
    const scores = [session.grammarScore, session.vocabularyScore, session.readingScore, session.writingScore].filter((s): s is number => s !== null)
    if (scores.length === 0) return session.score
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  })()

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* 헤더 */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <a href="/student" className="text-sm text-gray-500 hover:text-gray-700">
            대시보드
          </a>
          <span className="text-gray-400">/</span>
          <span className="text-sm text-gray-700">{session.test.title}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{session.test.title} — 결과</h1>
        {session.completedAt && (
          <p className="mt-1 text-sm text-gray-500">
            제출일: {new Date(session.completedAt).toLocaleString('ko-KR')}
          </p>
        )}
      </div>

      {/* 총점 카드 */}
      <div className="flex items-center gap-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full border-4 border-[#1865F2]">
          <span className="text-3xl font-bold text-[#1865F2]">
            {displayScore !== null ? `${displayScore}` : '—'}
          </span>
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-500">종합 점수</p>
          <div className="mt-1 flex items-center gap-2">
            {isFullyGraded ? (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                채점 완료
              </span>
            ) : hasWriting ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                쓰기 채점 대기 중
              </span>
            ) : (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                채점 완료
              </span>
            )}
          </div>
          {hasWriting && !isFullyGraded && (
            <p className="mt-2 text-xs text-gray-400">쓰기 채점 완료 후 최종 점수가 확정됩니다.</p>
          )}
        </div>
      </div>

      {/* 영역별 점수 + 레이더 차트 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">영역별 점수</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING'] as const).map((domain) => {
            const scoreMap = {
              GRAMMAR: session.grammarScore,
              VOCABULARY: session.vocabularyScore,
              READING: session.readingScore,
              WRITING: session.writingScore,
            }
            const prevScoreMap = {
              GRAMMAR: prevSession?.grammarScore ?? null,
              VOCABULARY: prevSession?.vocabularyScore ?? null,
              READING: prevSession?.readingScore ?? null,
              WRITING: prevSession?.writingScore ?? null,
            }
            const curr = scoreMap[domain]
            const prev = prevScoreMap[domain]
            const diff = scoreDiff(curr, prev)
            const hasDomainQuestions = questions.some((q) => q.domain === domain)
            if (!hasDomainQuestions) return null

            const isPending = domain === 'WRITING' && hasWriting && !isFullyGraded
            return (
              <div
                key={domain}
                className="rounded-xl border border-gray-100 p-3 text-center"
                style={{ borderTopColor: DOMAIN_COLORS[domain], borderTopWidth: 3 }}
              >
                <p className="text-xs font-medium text-gray-500">{DOMAIN_LABELS[domain]}</p>
                {isPending ? (
                  <p className="mt-1 text-lg font-bold text-amber-500">대기</p>
                ) : (
                  <p className="mt-1 text-2xl font-bold" style={{ color: DOMAIN_COLORS[domain] }}>
                    {curr !== null ? curr : '—'}
                  </p>
                )}
                {diff !== null && (
                  <p className={`mt-0.5 text-xs font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '±0'}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-6">
          <ResultRadarChart
            grammarScore={session.grammarScore}
            vocabularyScore={session.vocabularyScore}
            readingScore={session.readingScore}
            writingScore={session.writingScore}
          />
        </div>
      </div>

      {/* 이전 대비 변화 */}
      {prevSession && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900">이전 대비 변화</h2>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-500">이전 점수</p>
              <p className="text-xl font-bold text-gray-400">{prevSession.score ?? '—'}</p>
            </div>
            <div className="flex-1 text-center">
              {(() => {
                const d = scoreDiff(displayScore ?? null, prevSession.score)
                if (d === null) return <span className="text-gray-400">—</span>
                return (
                  <span
                    className={`text-2xl font-bold ${d > 0 ? 'text-green-600' : d < 0 ? 'text-red-500' : 'text-gray-400'}`}
                  >
                    {d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : '→ 동일'}
                  </span>
                )
              })()}
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">이번 점수</p>
              <p className="text-xl font-bold text-[#1865F2]">{displayScore ?? '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* 문제별 결과 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">문제별 결과</h2>
        <div className="space-y-4">
          {questions.map((q, idx) => {
            const content = q.contentJson as QuestionContentJson
            const response = responseMap.get(q.id)
            const isEssay = content.type === 'essay'
            const writingData = isEssay && response?.answerJson
              ? (response.answerJson as WritingAnswerJson)
              : null
            const isGraded = writingData?.teacherScore !== undefined

            return (
              <div key={q.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-500">Q{idx + 1}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: DOMAIN_COLORS[q.domain] }}
                    >
                      {DOMAIN_LABELS[q.domain]}
                    </span>
                  </div>
                  {!isEssay && (
                    response?.isCorrect === true ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">정답</span>
                    ) : response?.isCorrect === false ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">오답</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">미응답</span>
                    )
                  )}
                  {isEssay && (
                    isGraded ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        {writingData?.teacherScore}점
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">채점 대기중</span>
                    )
                  )}
                </div>

                {/* 문제 텍스트 */}
                {content.passage && (
                  <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600 leading-relaxed">
                    {content.passage}
                  </p>
                )}
                <p className="mt-2 text-sm font-medium text-gray-800">{content.question_text}</p>

                {/* 선택지 (객관식) */}
                {content.type === 'multiple_choice' && content.options && (
                  <div className="mt-2 space-y-1">
                    {content.options.map((opt, i) => {
                      const isSelected = response?.answer === opt
                      const isCorrectOpt = content.correct_answer === opt
                      let cls = 'rounded-lg border px-3 py-1.5 text-sm '
                      if (isCorrectOpt) cls += 'border-green-400 bg-green-50 text-green-800 font-medium'
                      else if (isSelected && !isCorrectOpt) cls += 'border-red-300 bg-red-50 text-red-700'
                      else cls += 'border-gray-100 text-gray-600'
                      return (
                        <div key={i} className={cls}>
                          {opt}
                          {isCorrectOpt && <span className="ml-2 text-xs text-green-600">✓ 정답</span>}
                          {isSelected && !isCorrectOpt && <span className="ml-2 text-xs text-red-500">✗ 내 답</span>}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 주관식/빈칸 답 */}
                {(content.type === 'fill_blank' || content.type === 'short_answer') && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">내 답:</span>
                      <span className={response?.isCorrect === false ? 'text-red-600 line-through' : 'text-gray-800'}>
                        {response?.answer || '(미응답)'}
                      </span>
                    </div>
                    {response?.isCorrect === false && content.correct_answer && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">정답:</span>
                        <span className="font-medium text-green-700">{content.correct_answer}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 에세이 */}
                {isEssay && (
                  <div className="mt-2 space-y-2">
                    <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {response?.answer || '(미응답)'}
                    </div>
                    {writingData?.teacherComment && (
                      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                        <p className="text-xs font-medium text-blue-700 mb-1">교사 코멘트</p>
                        <p className="text-sm text-blue-800">{writingData.teacherComment}</p>
                      </div>
                    )}
                    {writingData && isGraded && (
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        {[
                          { label: '문법', val: writingData.grammarScore },
                          { label: '구성', val: writingData.structureScore },
                          { label: '어휘', val: writingData.vocabularyScore },
                          { label: '표현', val: writingData.expressionScore },
                        ].map((item) => (
                          item.val !== undefined && (
                            <div key={item.label} className="rounded-lg bg-purple-50 p-2">
                              <p className="text-gray-500">{item.label}</p>
                              <p className="font-bold text-[#7854F7]">{item.val}</p>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 오답 해설 */}
                {!isEssay && response?.isCorrect === false && content.explanation && (
                  <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
                    <p className="text-xs font-medium text-amber-700 mb-1">해설</p>
                    <p className="text-sm text-amber-800">{content.explanation}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex justify-center pb-8">
        <a
          href="/student"
          className="rounded-xl bg-[#1865F2] px-8 py-3 text-sm font-medium text-white hover:bg-[#1558d6]"
        >
          대시보드로 돌아가기
        </a>
      </div>
    </div>
  )
}
