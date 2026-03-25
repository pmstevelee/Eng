import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import {
  BookOpen,
  BarChart2,
  MessageSquare,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Target,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'

// 영역 설정
const DOMAIN_CONFIG = {
  GRAMMAR: {
    label: '문법',
    color: '#1865F2',
    bg: '#EEF4FF',
    desc: '문법 규칙과 문장 구조를 학습합니다',
    tips: ['시제(현재·과거·미래) 규칙을 확인하세요', '조동사 사용법을 연습하세요', '수일치 규칙을 점검하세요'],
  },
  VOCABULARY: {
    label: '어휘',
    color: '#7854F7',
    bg: '#F3F0FF',
    desc: '영어 단어와 표현을 확장합니다',
    tips: ['하루 10개 단어를 목표로 하세요', '문맥 속에서 단어를 학습하세요', '동의어·반의어를 함께 암기하세요'],
  },
  READING: {
    label: '독해',
    color: '#0FBFAD',
    bg: '#EFFAF9',
    desc: '영어 지문을 읽고 이해하는 능력을 키웁니다',
    tips: ['핵심 주제를 먼저 파악하세요', '모르는 단어는 문맥으로 추론하세요', '문단 구조를 분석하세요'],
  },
  WRITING: {
    label: '쓰기',
    color: '#E35C20',
    bg: '#FFF3EE',
    desc: '영어로 생각을 글로 표현하는 능력을 키웁니다',
    tips: ['문장을 짧고 명확하게 쓰세요', '논리적 흐름을 구성하세요', '다양한 접속사를 활용하세요'],
  },
} as const

type DomainKey = keyof typeof DOMAIN_CONFIG

// 레벨 라벨
function scoreToLevel(score: number | null): string {
  if (score === null) return '미측정'
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B+'
  if (score >= 60) return 'B'
  if (score >= 50) return 'C+'
  return 'C'
}

// ── Cached data fetcher ───────────────────────────────────────────────────────

type WrongQuestionRow = {
  id: string
  domain: string
  questionText: string
  correctAnswer: string | null
  myAnswer: string | null
}

type TeacherCommentRow = {
  id: string
  content: string
  type: string
  createdAt: string
  teacherName: string
}

const getCachedStudentLearning = (studentId: string) =>
  unstable_cache(
    async () => {
      // 1. 영역별 최신 실력 점수 (SkillAssessment) - with limit
      const skillAssessments = await prisma.skillAssessment.findMany({
        where: { studentId },
        orderBy: { assessedAt: 'desc' },
        take: 200,
        select: { domain: true, score: true, assessedAt: true },
      })

      // 영역별 최신 점수만 추출
      const latestSkills: Partial<Record<DomainKey, { score: number | null; assessedAt: string }>> = {}
      for (const sa of skillAssessments) {
        const domain = sa.domain as DomainKey
        if (!latestSkills[domain]) {
          latestSkills[domain] = {
            score: sa.score,
            assessedAt: sa.assessedAt.toISOString(),
          }
        }
      }

      // 2. 최근 완료 테스트의 오답 (최근 1개)
      const recentSession = await prisma.testSession.findFirst({
        where: {
          studentId,
          status: { in: ['COMPLETED', 'GRADED'] },
        },
        orderBy: { completedAt: 'desc' },
        select: {
          id: true,
          test: { select: { title: true } },
          questionResponses: {
            where: { isCorrect: false },
            select: { questionId: true, answer: true },
            take: 10,
          },
        },
      })

      // 오답 문제 데이터 로드 (contentJson에서 필요한 필드만 추출)
      let wrongQuestions: WrongQuestionRow[] = []
      if (recentSession && recentSession.questionResponses.length > 0) {
        const wrongIds = recentSession.questionResponses.map((r) => r.questionId)
        const questions = await prisma.question.findMany({
          where: { id: { in: wrongIds } },
          select: { id: true, domain: true, contentJson: true },
        })
        const answerMap = new Map(recentSession.questionResponses.map((r) => [r.questionId, r.answer]))
        wrongQuestions = questions.map((q) => {
          const content = q.contentJson as QuestionContentJson
          return {
            id: q.id,
            domain: q.domain,
            questionText: content.question_text ?? '',
            correctAnswer: content.correct_answer ?? null,
            myAnswer: answerMap.get(q.id) ?? null,
          }
        })
      }

      // 3. 교사 코멘트 (최근 3개)
      const teacherComments = await prisma.teacherComment.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          content: true,
          type: true,
          createdAt: true,
          teacher: { select: { name: true } },
        },
      })

      // 취약 영역 계산
      const measuredDomains = (Object.keys(DOMAIN_CONFIG) as DomainKey[])
        .filter((d) => latestSkills[d]?.score !== undefined && latestSkills[d]?.score !== null)
        .sort((a, b) => (latestSkills[a]?.score ?? 100) - (latestSkills[b]?.score ?? 100))

      return {
        latestSkills,
        weakDomain: measuredDomains[0] ?? null,
        hasAnyData: Object.keys(latestSkills).length > 0,
        wrongQuestions,
        recentSessionId: recentSession?.id ?? null,
        recentSessionTitle: recentSession?.test.title ?? null,
        teacherComments: teacherComments.map((c): TeacherCommentRow => ({
          id: c.id,
          content: c.content,
          type: c.type ?? '',
          createdAt: c.createdAt.toISOString(),
          teacherName: c.teacher.name,
        })),
      }
    },
    ['student-learning', studentId],
    { revalidate: 60, tags: [`student-${studentId}-learning`] },
  )()

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LearningPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { student: { select: { id: true } } },
  })
  if (!dbUser?.student) redirect('/login')

  const {
    latestSkills,
    weakDomain,
    hasAnyData,
    wrongQuestions,
    recentSessionId,
    recentSessionTitle,
    teacherComments,
  } = await getCachedStudentLearning(dbUser.student.id)

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">학습공간</h1>
        <p className="mt-1 text-sm text-gray-500">
          나의 영역별 실력을 확인하고 취약점을 집중적으로 학습하세요.
        </p>
      </div>

      {/* 영역별 실력 분석 */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[#1865F2]" />
            <h2 className="font-semibold text-gray-900">영역별 실력</h2>
          </div>
          {!hasAnyData && (
            <p className="mt-1 text-xs text-gray-400">테스트를 완료하면 실력 분석이 표시됩니다.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-4">
          {(Object.entries(DOMAIN_CONFIG) as [DomainKey, (typeof DOMAIN_CONFIG)[DomainKey]][]).map(
            ([domain, cfg]) => {
              const skill = latestSkills[domain]
              const score = skill?.score ?? null
              const level = scoreToLevel(score)

              return (
                <div key={domain} className="bg-white px-4 py-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: cfg.color }}
                    />
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {cfg.label}
                    </span>
                  </div>

                  {score !== null ? (
                    <>
                      <p
                        className="text-3xl font-black leading-none"
                        style={{ color: cfg.color }}
                      >
                        {score}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">/ 100점</p>
                      {/* 점수바 */}
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${score}%`, backgroundColor: cfg.color }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] font-semibold" style={{ color: cfg.color }}>
                        {level}등급
                      </p>
                    </>
                  ) : (
                    <div className="mt-1">
                      <p className="text-xl font-bold text-gray-300">—</p>
                      <p className="mt-1 text-xs text-gray-400">미측정</p>
                      <p className="mt-2 text-[11px] text-gray-300">테스트 완료 후 측정</p>
                    </div>
                  )}
                </div>
              )
            },
          )}
        </div>
      </div>

      {/* 취약 영역 집중 학습 */}
      {weakDomain && (
        <div
          className="rounded-xl border p-5"
          style={{
            borderColor: DOMAIN_CONFIG[weakDomain].color + '40',
            backgroundColor: DOMAIN_CONFIG[weakDomain].bg,
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: DOMAIN_CONFIG[weakDomain].color }}
              >
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: DOMAIN_CONFIG[weakDomain].color }}
                  >
                    취약 영역
                  </span>
                </div>
                <p className="mt-0.5 font-bold text-gray-900">
                  {DOMAIN_CONFIG[weakDomain].label} 집중 학습 추천
                </p>
                <p className="mt-0.5 text-sm text-gray-600">{DOMAIN_CONFIG[weakDomain].desc}</p>
                <ul className="mt-2 space-y-0.5">
                  {DOMAIN_CONFIG[weakDomain].tips.map((tip, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span style={{ color: DOMAIN_CONFIG[weakDomain].color }}>•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p
                className="text-2xl font-black"
                style={{ color: DOMAIN_CONFIG[weakDomain].color }}
              >
                {latestSkills[weakDomain]?.score ?? '—'}
              </p>
              <p className="text-xs text-gray-400">점</p>
            </div>
          </div>
        </div>
      )}

      {/* 2열 하단 섹션 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 최근 오답 복습 */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-[#D92916]" />
                <h2 className="font-semibold text-gray-900">오답 복습</h2>
              </div>
              {recentSessionId && (
                <Link
                  href={`/student/tests/${recentSessionId}/result`}
                  className="flex items-center gap-0.5 text-xs text-[#1865F2] hover:underline"
                >
                  전체 결과 <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
            {recentSessionTitle && (
              <p className="mt-0.5 text-xs text-gray-400">
                최근 테스트: {recentSessionTitle}
              </p>
            )}
          </div>

          <div className="divide-y divide-gray-50">
            {wrongQuestions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
                {recentSessionId ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-[#1FAF54]" />
                    <p className="text-sm font-medium text-gray-600">모두 정답!</p>
                    <p className="text-xs text-gray-400">최근 테스트에서 오답이 없어요.</p>
                  </>
                ) : (
                  <>
                    <BookOpen className="h-8 w-8 text-gray-200" />
                    <p className="text-sm text-gray-400">완료된 테스트가 없습니다.</p>
                    <Link
                      href="/student/tests"
                      className="mt-1 text-xs text-[#1865F2] hover:underline"
                    >
                      테스트 응시하러 가기
                    </Link>
                  </>
                )}
              </div>
            ) : (
              wrongQuestions.slice(0, 4).map((q, idx) => {
                const domain = q.domain as DomainKey
                const cfg = DOMAIN_CONFIG[domain] ?? DOMAIN_CONFIG.GRAMMAR
                return (
                  <div key={q.id} className="px-5 py-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: cfg.color }}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ backgroundColor: cfg.bg, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-sm text-gray-700">
                          {q.questionText}
                        </p>
                        {q.myAnswer && (
                          <p className="mt-1 text-xs text-[#D92916]">
                            내 답: <span className="line-through">{q.myAnswer}</span>
                          </p>
                        )}
                        {q.correctAnswer && (
                          <p className="text-xs text-[#1FAF54]">
                            정답: {q.correctAnswer}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* 영역별 학습 팁 */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#7854F7]" />
              <h2 className="font-semibold text-gray-900">영역별 학습 가이드</h2>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {(Object.entries(DOMAIN_CONFIG) as [DomainKey, (typeof DOMAIN_CONFIG)[DomainKey]][]).map(
              ([domain, cfg]) => {
                const score = latestSkills[domain]?.score ?? null
                return (
                  <div key={domain} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: cfg.color }}
                        />
                        <span className="text-sm font-semibold text-gray-800">{cfg.label}</span>
                      </div>
                      {score !== null ? (
                        <span
                          className="text-xs font-bold"
                          style={{ color: cfg.color }}
                        >
                          {scoreToLevel(score)}등급
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">미측정</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">{cfg.desc}</p>
                    <div className="mt-2 space-y-0.5">
                      {cfg.tips.map((tip, i) => (
                        <p key={i} className="flex items-start gap-1.5 text-xs text-gray-400">
                          <span className="mt-0.5 shrink-0" style={{ color: cfg.color }}>
                            ›
                          </span>
                          {tip}
                        </p>
                      ))}
                    </div>
                  </div>
                )
              },
            )}
          </div>
        </div>
      </div>

      {/* 교사 코멘트 */}
      {teacherComments.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#0FBFAD]" />
              <h2 className="font-semibold text-gray-900">교사 피드백</h2>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {teacherComments.map((comment) => (
              <div key={comment.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0FBFAD]/10 text-sm font-bold text-[#0FBFAD]">
                    {comment.teacherName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">
                        {comment.teacherName} 선생님
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(comment.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">{comment.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 데이터 없을 때 안내 */}
      {!hasAnyData && teacherComments.length === 0 && !recentSessionId && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-gray-200" />
          <p className="mt-3 text-sm font-medium text-gray-500">
            아직 학습 데이터가 없습니다
          </p>
          <p className="mt-1 text-xs text-gray-400">
            테스트를 완료하면 영역별 실력 분석과 오답 복습 기능을 이용할 수 있어요.
          </p>
          <Link
            href="/student/tests"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#1865F2] px-5 text-sm font-semibold text-white hover:bg-[#1558d6]"
          >
            테스트 응시하기
          </Link>
        </div>
      )}
    </div>
  )
}
