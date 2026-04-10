import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Brain, BookOpen, RotateCcw, PenLine, ChevronRight } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getLearnHubData } from './actions'

const DOMAIN_CARDS = [
  {
    key: 'GRAMMAR',
    label: '문법',
    color: '#1865F2',
    bg: '#EEF4FF',
    border: '#BFDBFE',
    href: '/student/learn/domain/grammar',
  },
  {
    key: 'VOCABULARY',
    label: '어휘',
    color: '#7854F7',
    bg: '#F3F0FF',
    border: '#DDD6FE',
    href: '/student/learn/domain/vocabulary',
  },
  {
    key: 'READING',
    label: '독해',
    color: '#0FBFAD',
    bg: '#EFFAF9',
    border: '#A7F3D0',
    href: '/student/learn/domain/reading',
  },
  {
    key: 'WRITING',
    label: '쓰기',
    color: '#E35C20',
    bg: '#FFF3EE',
    border: '#FDBA74',
    href: '/student/learn/domain/writing',
  },
  {
    key: 'LISTENING',
    label: '듣기',
    color: '#0EA5E9',
    bg: '#E0F2FE',
    border: '#BAE6FD',
    href: '/student/learn/domain/listening',
  },
] as const

export default async function LearnPage() {
  const pageStart = performance.now()

  const authStart = performance.now()
  const user = await getCurrentUser()
  console.log(`  [쿼리1] getCurrentUser: ${(performance.now() - authStart).toFixed(0)}ms`)
  if (!user || user.role !== 'STUDENT') redirect('/login')

  const dataStart = performance.now()
  const { wrongAnswerCount, domainScores, todayQuestions, todayCorrect } =
    await getLearnHubData()
  console.log(`  [쿼리2] getLearnHubData: ${(performance.now() - dataStart).toFixed(0)}ms`)

  const totalTime = performance.now() - pageStart
  console.log(`📊 [LearnPage] 전체 서버 시간: ${totalTime.toFixed(0)}ms`)
  if (totalTime > 200) console.log(`⚠️ SLOW PAGE: ${totalTime.toFixed(0)}ms`)

  const todayAccuracy =
    todayQuestions > 0 ? Math.round((todayCorrect / todayQuestions) * 100) : null

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">자기주도 학습</h1>
        <p className="mt-1 text-sm text-gray-500">
          원하는 방식으로 학습을 시작하세요.
        </p>
      </div>

      {/* 학습 모드 카드 4개 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 1. AI 맞춤형 학습 */}
        <div
          className="rounded-xl border p-5 flex flex-col justify-between min-h-[180px]"
          style={{ backgroundColor: '#F3F0FF', borderColor: '#C4B5FD' }}
        >
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: '#7854F7' }}
              >
                <Brain className="h-5 w-5 text-white" />
              </div>
              <h2 className="font-bold text-gray-900">AI 맞춤형 학습</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              AI가 약점을 분석하여 추천한 문제입니다
            </p>
          </div>
          <div className="mt-4">
            <Link
              href="/student/learn/adaptive"
              className="inline-flex h-11 items-center gap-1.5 rounded-xl px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#7854F7' }}
            >
              시작하기
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* 2. 영역별 연습 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col justify-between min-h-[180px]">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                <BookOpen className="h-5 w-5 text-gray-600" />
              </div>
              <h2 className="font-bold text-gray-900">영역별 연습</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DOMAIN_CARDS.map((d) => {
                const score = domainScores[d.key as keyof typeof domainScores]
                return (
                  <Link
                    key={d.key}
                    href={d.href}
                    className="flex flex-col rounded-xl border p-2.5 transition-all hover:opacity-90"
                    style={{ backgroundColor: d.bg, borderColor: d.border }}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      <span
                        className="text-xs font-semibold"
                        style={{ color: d.color }}
                      >
                        {d.label}
                      </span>
                    </div>
                    {score !== null && score !== undefined ? (
                      <span
                        className="text-base font-black leading-tight"
                        style={{ color: d.color }}
                      >
                        {score}점
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">미측정</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* 3. 오답 복습 */}
        <div
          className="rounded-xl border p-5 flex flex-col justify-between min-h-[180px]"
          style={{ backgroundColor: '#FFF5F5', borderColor: '#FCA5A5' }}
        >
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: '#D92916' }}
              >
                <RotateCcw className="h-5 w-5 text-white" />
              </div>
              <h2 className="font-bold text-gray-900">오답 복습</h2>
              {wrongAnswerCount > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                  style={{ backgroundColor: '#D92916' }}
                >
                  {wrongAnswerCount}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              틀린 문제를 다시 풀어보세요
            </p>
          </div>
          <div className="mt-4">
            <Link
              href="/student/learn/review"
              className="inline-flex h-11 items-center gap-1.5 rounded-xl px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#D92916' }}
            >
              복습 시작
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* 4. 쓰기 연습 */}
        <div
          className="rounded-xl border p-5 flex flex-col justify-between min-h-[180px]"
          style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}
        >
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: '#FFB100' }}
              >
                <PenLine className="h-5 w-5 text-white" />
              </div>
              <h2 className="font-bold text-gray-900">쓰기 연습</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              주제를 선택하고 에세이를 작성하세요
            </p>
          </div>
          <div className="mt-4">
            <Link
              href="/student/learn/writing"
              className="inline-flex h-11 items-center gap-1.5 rounded-xl px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#FFB100' }}
            >
              연습 시작
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* 오늘의 학습 현황 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900 mb-4">오늘의 학습 현황</h2>
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="text-center px-4">
            <p className="text-2xl font-black text-gray-900">{todayQuestions}</p>
            <p className="text-xs text-gray-500 mt-0.5">오늘 푼 문제</p>
          </div>
          <div className="text-center px-4">
            <p
              className="text-2xl font-black"
              style={{
                color:
                  todayAccuracy === null
                    ? '#9CA3AF'
                    : todayAccuracy >= 70
                    ? '#1FAF54'
                    : '#D92916',
              }}
            >
              {todayAccuracy !== null ? `${todayAccuracy}%` : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">오늘 정답률</p>
          </div>
          <div className="text-center px-4">
            <p
              className="text-2xl font-black"
              style={{ color: wrongAnswerCount > 0 ? '#D92916' : '#9CA3AF' }}
            >
              {wrongAnswerCount}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">복습 대기</p>
          </div>
        </div>
      </div>
    </div>
  )
}
