import Link from 'next/link'
import { BookOpen, RotateCcw, ChevronRight, Lock, Layers } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { prisma } from '@/lib/prisma/client'
import {
  canUseWordLearning,
  getAcademyDailyNewWords,
} from '@/lib/words/access-guard'
import { getLevelInfo } from '@/lib/constants/levels'

async function getWordsHubData(studentId: string, userId: string) {
  const now = new Date()

  const [user, dueCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        academyId: true,
        academy: { select: { settingsJson: true } },
        student: { select: { currentLevel: true } },
      },
    }),
    prisma.wordProgress.count({
      where: { studentId, nextReviewAt: { lte: now } },
    }),
  ])

  return { user, dueCount }
}

async function getWordSets(academyId: string | null, studentLevel: number) {
  return prisma.wordSet.findMany({
    where: {
      OR: [
        { isPublic: true },
        ...(academyId ? [{ academyId }] : []),
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      cefrLevel: true,
      _count: { select: { items: true } },
    },
    orderBy: { cefrLevel: 'asc' },
    take: 20,
  })
}

// CEFR level (1~10) → label
const CEFR_LABEL: Record<number, string> = {
  1: 'Pre-A1', 2: 'A1 하', 3: 'A1 상', 4: 'A2 하', 5: 'A2 상',
  6: 'B1 하', 7: 'B1 상', 8: 'B2 하', 9: 'B2 상', 10: 'C1+',
}

function cefrBadgeStyle(cefrLevel: number, studentLevel: number) {
  if (cefrLevel <= studentLevel) return { bg: '#F3F0FF', text: '#7854F7', border: '#DDD6FE' }
  return { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB' }
}

function UpgradePrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
        style={{ backgroundColor: '#F3F0FF' }}
      >
        <Lock className="h-8 w-8" style={{ color: '#7854F7' }} />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">구독이 필요합니다</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        단어학습 기능은 스타터 이상 구독 플랜에서 사용할 수 있습니다.
        학원 원장님께 문의하세요.
      </p>
      <Link
        href="/student"
        className="inline-flex h-11 items-center gap-1.5 rounded-xl px-5 text-sm font-semibold text-white"
        style={{ backgroundColor: '#7854F7' }}
      >
        홈으로 돌아가기
      </Link>
    </div>
  )
}

export default async function WordsHubPage() {
  const { studentId, userId } = await requireStudent()
  const { user, dueCount } = await getWordsHubData(studentId, userId)

  const academyId = user?.academyId ?? null

  if (!academyId || !(await canUseWordLearning(academyId))) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">단어학습</h1>
          <p className="mt-1 text-sm text-gray-500">플래시카드로 어휘를 체계적으로 학습하세요.</p>
        </div>
        <UpgradePrompt />
      </div>
    )
  }

  const studentLevel = user?.student?.currentLevel ?? 1
  const levelInfo = getLevelInfo(studentLevel)
  const dailyNewWords = getAcademyDailyNewWords(user?.academy?.settingsJson)
  const wordSets = await getWordSets(academyId, studentLevel)

  // 추천 세트: 현재 레벨 ±1 범위
  const recommendedSets = wordSets.filter(
    (s) => s.cefrLevel >= studentLevel - 1 && s.cefrLevel <= studentLevel + 1,
  )
  const otherSets = wordSets.filter(
    (s) => s.cefrLevel < studentLevel - 1 || s.cefrLevel > studentLevel + 1,
  )

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">단어학습</h1>
        <p className="mt-1 text-sm text-gray-500">
          플래시카드로 어휘를 체계적으로 학습하세요.
        </p>
      </div>

      {/* 오늘의 현황 카드 */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: '#F3F0FF', borderColor: '#DDD6FE' }}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: '#7854F7' }}
          >
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">오늘의 단어학습</h2>
            <p className="text-xs text-gray-500">
              현재 레벨: {levelInfo.cefr} ({levelInfo.nameKo}) · 하루 신규 단어 {dailyNewWords}개
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* 오늘의 복습 */}
          <Link
            href="/student/words/review"
            className="flex flex-col rounded-xl border bg-white p-4 transition-opacity hover:opacity-90"
            style={{ borderColor: '#DDD6FE' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <RotateCcw className="h-4 w-4" style={{ color: '#7854F7' }} />
              <span className="text-sm font-semibold text-gray-700">복습할 단어</span>
            </div>
            <p
              className="text-3xl font-black leading-none"
              style={{ color: dueCount > 0 ? '#7854F7' : '#9CA3AF' }}
            >
              {dueCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">개 대기 중</p>
          </Link>

          {/* 신규 학습 */}
          <div
            className="flex flex-col rounded-xl border bg-white p-4"
            style={{ borderColor: '#DDD6FE' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4" style={{ color: '#7854F7' }} />
              <span className="text-sm font-semibold text-gray-700">하루 신규 한도</span>
            </div>
            <p
              className="text-3xl font-black leading-none"
              style={{ color: '#7854F7' }}
            >
              {dailyNewWords}
            </p>
            <p className="text-xs text-gray-500 mt-1">개/일</p>
          </div>
        </div>
      </div>

      {/* 추천 단어 세트 */}
      {recommendedSets.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">
            추천 세트 — 내 레벨 ({levelInfo.cefr})
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recommendedSets.map((set) => {
              const style = cefrBadgeStyle(set.cefrLevel, studentLevel)
              return (
                <Link
                  key={set.id}
                  href={`/student/words/${set.id}/flashcard`}
                  className="flex items-center justify-between rounded-xl border bg-white p-4 transition-all hover:border-violet-300 hover:shadow-sm"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{
                          backgroundColor: style.bg,
                          color: style.text,
                          border: `1px solid ${style.border}`,
                        }}
                      >
                        {CEFR_LABEL[set.cefrLevel] ?? `Lv${set.cefrLevel}`}
                      </span>
                      <span className="text-xs text-gray-400">{set._count.items}단어</span>
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{set.title}</p>
                    {set.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{set.description}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 ml-3" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* 전체 단어 세트 */}
      {otherSets.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">전체 단어 세트</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {otherSets.map((set) => {
              const style = cefrBadgeStyle(set.cefrLevel, studentLevel)
              return (
                <Link
                  key={set.id}
                  href={`/student/words/${set.id}/flashcard`}
                  className="flex items-center justify-between rounded-xl border bg-white p-4 transition-all hover:border-violet-300 hover:shadow-sm"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{
                          backgroundColor: style.bg,
                          color: style.text,
                          border: `1px solid ${style.border}`,
                        }}
                      >
                        {CEFR_LABEL[set.cefrLevel] ?? `Lv${set.cefrLevel}`}
                      </span>
                      <span className="text-xs text-gray-400">{set._count.items}단어</span>
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{set.title}</p>
                    {set.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{set.description}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 ml-3" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {wordSets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-gray-200 bg-white">
          <BookOpen className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-500">등록된 단어 세트가 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">학원 선생님께 단어 세트 추가를 요청하세요.</p>
        </div>
      )}
    </div>
  )
}
