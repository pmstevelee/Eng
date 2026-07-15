import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CheckCircle2, XCircle, Zap } from 'lucide-react'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'

// ── Types ─────────────────────────────────────────────────────────────────────

type AnsweredQuestion = {
  questionId: string
  answer: string
  isCorrect: boolean
  xpEarned: number
}

type MissionItemRaw = {
  id: string
  type: string
  title: string
  description: string
  domain: string | null
  subCategory: string | null
  questionIds: string[]
  questionCount: number
  xpReward: number
  status: string
  completedAt: string | null
  correctCount: number
  order: number
  reason: string
  answeredQuestions?: AnsweredQuestion[]
}

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ m?: string }>
}

// ── 상수 ─────────────────────────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D']

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  WRITING: '쓰기',
  LISTENING: '듣기',
}

function letterToOptionText(content: QuestionContentJson, letter: string): string | null {
  const idx = LETTERS.indexOf(letter)
  if (idx === -1) return null
  return content.options?.[idx] ?? null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MissionResultPage({ params, searchParams }: Props) {
  const { id: dailyMissionId } = await params
  const { m } = await searchParams
  const missionIndex = parseInt(m ?? '0', 10)

  if (isNaN(missionIndex) || missionIndex < 0) notFound()

  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id, isDeleted: false },
    select: { student: { select: { id: true } } },
  })
  if (!dbUser?.student) redirect('/student')
  const studentId = dbUser.student.id

  const mission = await prisma.dailyMission.findUnique({ where: { id: dailyMissionId } })
  if (!mission || mission.studentId !== studentId) notFound()

  const missionsJson = (mission.missionsJson ?? []) as MissionItemRaw[]
  const missionItem = missionsJson[missionIndex]
  if (!missionItem) notFound()

  const answeredQuestions = missionItem.answeredQuestions ?? []
  if (answeredQuestions.length === 0) {
    // 아직 응시하지 않은 미션 → 문제 풀이 화면으로
    redirect(`/student/missions/${dailyMissionId}?m=${missionIndex}`)
  }

  const questionIds = missionItem.questionIds
  const questionsRaw = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, domain: true, contentJson: true },
  })
  const questionMap = new Map(questionsRaw.map((q) => [q.id, q]))

  const rows = questionIds
    .map((qId) => {
      const question = questionMap.get(qId)
      const answered = answeredQuestions.find((a) => a.questionId === qId)
      if (!question || !answered) return null
      return { question, answered }
    })
    .filter(Boolean)
    .map((r) => r!)

  const correctCount = missionItem.correctCount
  const totalCount = missionItem.questionCount
  const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
  const totalXp = answeredQuestions.reduce((sum, a) => sum + a.xpEarned, 0)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* 헤더 */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-400">미션 결과</p>
        <h1 className="text-xl font-bold text-gray-900">{missionItem.title}</h1>
        {missionItem.reason && <p className="text-sm text-gray-500">{missionItem.reason}</p>}
      </div>

      {/* 요약 카드 */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <p className="text-xs text-gray-500">정답</p>
          <p className="text-lg font-bold text-gray-900">
            {correctCount}/{totalCount}
            <span className="ml-2 text-sm font-medium text-gray-400">({scorePercent}%)</span>
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-[#FFB100]/10 px-3 py-1.5 text-sm font-bold text-[#FFB100]">
          <Zap className="h-4 w-4" />
          +{totalXp} XP
        </div>
      </div>

      {/* 문제별 리뷰 */}
      <div className="space-y-4">
        {rows.map(({ question, answered }, idx) => {
          const content = question.contentJson as QuestionContentJson
          const isEssay = content.type === 'essay'
          const studentOptionText = letterToOptionText(content, answered.answer)
          const correctOptionText = content.correct_answer
            ? letterToOptionText(content, content.correct_answer)
            : null

          return (
            <div
              key={question.id}
              className={`rounded-xl border p-5 space-y-3 ${
                isEssay
                  ? 'border-gray-200 bg-white'
                  : answered.isCorrect
                  ? 'border-[#1FAF54]/30 bg-[#F0FBF4]'
                  : 'border-[#D92916]/20 bg-red-50'
              }`}
            >
              {/* 상단: 번호 + 도메인 + 정오 표시 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400">문제 {idx + 1}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    {DOMAIN_LABEL[question.domain] ?? question.domain}
                  </span>
                </div>
                {!isEssay &&
                  (answered.isCorrect ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-[#1FAF54]">
                      <CheckCircle2 className="h-4 w-4" />
                      정답
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-[#D92916]">
                      <XCircle className="h-4 w-4" />
                      오답
                    </span>
                  ))}
              </div>

              {/* 문제 텍스트 */}
              <p className="text-sm leading-relaxed text-gray-900">{content.question_text}</p>
              {content.question_text_ko && (
                <p className="text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
              )}

              {/* 답변 */}
              {isEssay ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-1.5 text-xs font-medium text-gray-400">내 답안</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                    {answered.answer || '(미응답)'}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg bg-white/70 p-3 space-y-1.5 text-sm">
                  <div>
                    <span className="font-semibold text-gray-500">내 답: </span>
                    <span
                      className={`font-bold ${
                        answered.isCorrect ? 'text-[#1FAF54]' : 'text-[#D92916]'
                      }`}
                    >
                      {answered.answer}
                      {studentOptionText ? ` — ${studentOptionText}` : ''}
                    </span>
                  </div>
                  {!answered.isCorrect && content.correct_answer && (
                    <div>
                      <span className="font-semibold text-gray-500">정답: </span>
                      <span className="font-bold text-[#1FAF54]">
                        {content.correct_answer}
                        {correctOptionText ? ` — ${correctOptionText}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 해설 */}
              {content.explanation && (
                <div className="rounded-lg border border-[#1865F2]/20 bg-[#1865F2]/5 p-3">
                  <p className="mb-1 text-xs font-semibold text-[#1865F2]">해설</p>
                  <p className="text-sm leading-relaxed text-[#1865F2]/80">{content.explanation}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 하단 버튼 */}
      <div className="flex justify-center pb-4">
        <Link
          href="/student"
          className="inline-flex min-h-[44px] items-center rounded-xl bg-[#1865F2] px-8 py-3 text-sm font-semibold text-white hover:bg-[#1558d6]"
        >
          홈으로
        </Link>
      </div>
    </div>
  )
}
