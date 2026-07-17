import Link from 'next/link'
import { BookOpen, ChevronRight, Lock, Layers, ClipboardList } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { prisma } from '@/lib/prisma/client'
import {
  canUseWordLearning,
  getAcademyDailyNewWords,
} from '@/lib/words/access-guard'
import { getLevelInfo } from '@/lib/constants/levels'
import { DailyReviewWidget } from '@/components/words/daily-review-widget'
import { NavLinkWithLoading } from '@/components/shared/nav-link-with-loading'

async function getWordsHubData(studentId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      academyId: true,
      academy: { select: { settingsJson: true } },
      student: { select: { currentLevel: true } },
    },
  })

  return { user }
}

const CEFR_LABEL_MAP: Record<number, string> = {
  1: 'Pre-A1', 2: 'A1 하', 3: 'A1 상', 4: 'A2 하', 5: 'A2 상',
  6: 'B1 하', 7: 'B1 상', 8: 'B2 하', 9: 'B2 상', 10: 'C1+',
}

async function ensureSystemWordSets() {
  const levelGroups = await prisma.word.groupBy({
    by: ['cefrLevel'],
    _count: { _all: true },
    orderBy: { cefrLevel: 'asc' },
  })

  for (const { cefrLevel, _count } of levelGroups) {
    if (_count._all === 0) continue

    const existing = await prisma.wordSet.findFirst({
      where: { isPublic: true, cefrLevel, academyId: null, source: 'PUBLISHER' },
    })
    if (existing) continue

    const words = await prisma.word.findMany({
      where: { cefrLevel },
      select: { id: true },
      orderBy: { term: 'asc' },
    })

    const label = CEFR_LABEL_MAP[cefrLevel] ?? `Lv${cefrLevel}`
    await prisma.$transaction(async (tx) => {
      const set = await tx.wordSet.create({
        data: {
          title: `${label} 전체 단어`,
          description: `${label} 레벨의 모든 단어 (${words.length}개)`,
          cefrLevel,
          isPublic: true,
          source: 'PUBLISHER',
        },
      })
      await tx.wordSetItem.createMany({
        data: words.map((w, i) => ({ setId: set.id, wordId: w.id, order: i })),
      })
    })
  }
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
    take: 50,
  })
}

const CEFR_LABEL = CEFR_LABEL_MAP

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
  const { user } = await getWordsHubData(studentId, userId)

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
  await ensureSystemWordSets()
  const wordSets = await getWordSets(academyId, studentLevel)

  // 배정된 시험 (미응시만)
  const now = new Date()
  const pendingTests = await prisma.wordTestAssignment.findMany({
    where: {
      AND: [
        {
          OR: [
            { classAssignments: { some: { class: { students: { some: { id: studentId } } } } } },
            { studentAssignments: { some: { studentId } } },
          ],
        },
        { attempts: { none: { studentId } } },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    select: {
      id: true,
      title: true,
      mode: true,
      numQuestions: true,
      passingScore: true,
      endsAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">단어학습</h1>
          <p className="mt-1 text-sm text-gray-500">
            플래시카드로 어휘를 체계적으로 학습하세요.
          </p>
        </div>
        <NavLinkWithLoading
          href="/student/words/report"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:border-gray-300 transition-colors"
          loadingLabel="리포트로 이동 중..."
        >
          <Layers className="w-4 h-4" />
          내 리포트
        </NavLinkWithLoading>
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

        <div className="space-y-3">
          {/* 배정 시험 */}
          {pendingTests.length > 0 && (
            <div className="rounded-xl border border-[#FFB100]/40 bg-[#FFB100]/5 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[#FFB100]/20 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#FFB100]" />
                <span className="text-sm font-semibold text-gray-900">응시 대기 시험</span>
                <span className="ml-auto text-xs bg-[#FFB100] text-white px-2 py-0.5 rounded-full font-bold">
                  {pendingTests.length}
                </span>
              </div>
              <div className="divide-y divide-[#FFB100]/10">
                {pendingTests.map((test) => (
                  <NavLinkWithLoading
                    key={test.id}
                    href={`/student/words/test/${test.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#FFB100]/10"
                    loadingLabel="테스트 준비 중..."
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{test.title}</p>
                      <p className="text-xs text-gray-400">
                        {test.numQuestions}문항 · 합격 {test.passingScore}%
                        {test.endsAt && ` · ${test.endsAt.toLocaleDateString('ko-KR')} 마감`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#FFB100] shrink-0" />
                  </NavLinkWithLoading>
                ))}
              </div>
            </div>
          )}

          {/* 오늘의 복습 위젯 */}
          <DailyReviewWidget studentId={studentId} newWordHref="#word-sets" />

          {/* 신규 학습 */}
          <div
            className="flex items-center gap-3 rounded-xl border bg-white p-4"
            style={{ borderColor: '#DDD6FE' }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#F3F0FF' }}>
              <Layers className="h-5 w-5" style={{ color: '#7854F7' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">하루 신규 단어 한도</p>
              <p className="text-xs text-gray-500">{dailyNewWords}개/일</p>
            </div>
          </div>
        </div>
      </div>

      {/* 추천 단어 세트 */}
      {recommendedSets.length > 0 && (
        <section id="word-sets">
          <h2 className="text-base font-bold text-gray-900 mb-3">
            추천 세트 — 내 레벨 ({levelInfo.cefr})
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recommendedSets.map((set) => {
              const style = cefrBadgeStyle(set.cefrLevel, studentLevel)
              return (
                <NavLinkWithLoading
                  key={set.id}
                  href={`/student/words/${set.id}/flashcard`}
                  className="flex items-center justify-between rounded-xl border bg-white p-4 transition-all hover:border-violet-300 hover:shadow-sm"
                  style={{ borderColor: '#E5E7EB' }}
                  loadingLabel="단어 세트로 이동 중..."
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
                </NavLinkWithLoading>
              )
            })}
          </div>
        </section>
      )}

      {/* 전체 단어 세트 */}
      {otherSets.length > 0 && (
        <section id={recommendedSets.length === 0 ? 'word-sets' : undefined}>
          <h2 className="text-base font-bold text-gray-900 mb-3">전체 단어 세트</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {otherSets.map((set) => {
              const style = cefrBadgeStyle(set.cefrLevel, studentLevel)
              return (
                <NavLinkWithLoading
                  key={set.id}
                  href={`/student/words/${set.id}/flashcard`}
                  className="flex items-center justify-between rounded-xl border bg-white p-4 transition-all hover:border-violet-300 hover:shadow-sm"
                  style={{ borderColor: '#E5E7EB' }}
                  loadingLabel="단어 세트로 이동 중..."
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
                </NavLinkWithLoading>
              )
            })}
          </div>
        </section>
      )}

      {wordSets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-gray-200 bg-white">
          <BookOpen className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-500">등록된 단어 세트가 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">단어 데이터를 불러오는 중 오류가 발생했습니다.</p>
        </div>
      )}
    </div>
  )
}
