import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Flame,
  Target,
  Trophy,
  TrendingUp,
  ChevronRight,
  Zap,
  Award,
  CalendarCheck,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { getGamificationData, generateOrGetDailyMission, levelLabel } from './_actions/gamification'

// ─── Level XP thresholds ──────────────────────────────────────────────────────
const LEVEL_COLORS = [
  '',
  'text-gray-500',    // 1 A1
  'text-green-600',   // 2 A2
  'text-teal-600',    // 3 B1-
  'text-[#1865F2]',   // 4 B1
  'text-[#7854F7]',   // 5 B2
  'text-orange-500',  // 6 C1
  'text-[#FFB100]',   // 7 C2
]
const LEVEL_BG = [
  '',
  'bg-gray-100',
  'bg-green-50',
  'bg-teal-50',
  'bg-blue-50',
  'bg-purple-50',
  'bg-orange-50',
  'bg-yellow-50',
]

export default async function StudentDashboardPage() {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { name: true, student: { select: { id: true } } },
  })
  if (!user?.student) redirect('/login')

  // Fetch gamification data
  const [gData, mission] = await Promise.all([
    getGamificationData(),
    generateOrGetDailyMission(),
  ])

  if (!gData) redirect('/login')

  const {
    streak,
    isActiveToday,
    weeklyQuestionCount,
    weeklyGoal,
    currentLevel,
    recentAvgScore,
    badgeEarnings,
    allBadges,
  } = gData

  const weeklyProgress = Math.min(100, Math.round((weeklyQuestionCount / weeklyGoal) * 100))
  const firstName = user.name.split(' ')[0]
  const levelColor = LEVEL_COLORS[currentLevel] ?? 'text-[#1865F2]'
  const levelBg = LEVEL_BG[currentLevel] ?? 'bg-blue-50'

  // Greeting based on time
  const hour = new Date().getHours()
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '안녕하세요' : '오늘도 수고했어요'

  return (
    <div className="space-y-6">
      {/* ── Greeting ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {greeting}, {firstName}님! 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {isActiveToday
            ? '오늘도 학습했어요. 훌륭해요!'
            : '오늘의 미션을 완료하고 스트릭을 유지해요!'}
        </p>
      </div>

      {/* ── Streak + Level hero row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Streak card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame
                size={20}
                className={streak.currentStreak > 0 ? 'text-orange-500' : 'text-gray-300'}
              />
              <span className="text-sm font-medium text-gray-600">연속 학습</span>
            </div>
            {isActiveToday && (
              <span className="text-[10px] font-bold text-[#1FAF54] bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                오늘 완료
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-gray-900">{streak.currentStreak}</span>
            <span className="text-gray-400 text-sm">일</span>
          </div>
          <p className="text-xs text-gray-400">
            최장 {streak.longestStreak}일 · 총 {streak.totalDays}일
          </p>
          {/* Streak milestones */}
          <div className="flex gap-1 mt-1">
            {[3, 7, 14, 30, 100].map((milestone) => (
              <div
                key={milestone}
                className={`flex-1 h-1 rounded-full ${
                  streak.currentStreak >= milestone ? 'bg-orange-400' : 'bg-gray-100'
                }`}
                title={`${milestone}일`}
              />
            ))}
          </div>
          <p className="text-[10px] text-gray-400">3 · 7 · 14 · 30 · 100일</p>
        </div>

        {/* Level card */}
        <div className={`rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-2`}>
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className={levelColor} />
            <span className="text-sm font-medium text-gray-600">현재 레벨</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-black ${levelColor}`}>{currentLevel}</span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${levelBg} ${levelColor}`}
            >
              {levelLabel(currentLevel)}
            </span>
          </div>
          {recentAvgScore !== null ? (
            <>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                <div
                  className="h-1.5 rounded-full bg-[#1865F2] transition-all"
                  style={{ width: `${recentAvgScore}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">최근 3회 평균 {recentAvgScore}점</p>
            </>
          ) : (
            <p className="text-xs text-gray-400">테스트를 3회 완료하면 갱신돼요</p>
          )}
        </div>
      </div>

      {/* ── Today's mission ─────────────────────────────────────────────── */}
      {mission && (
        <div
          className={`rounded-xl border-2 p-5 ${
            mission.isCompleted
              ? 'border-[#1FAF54] bg-green-50'
              : 'border-[#1865F2] bg-blue-50'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  mission.isCompleted ? 'bg-[#1FAF54]' : 'bg-[#1865F2]'
                }`}
              >
                {mission.isCompleted ? (
                  <CheckCircle2 size={20} className="text-white" />
                ) : (
                  <Target size={20} className="text-white" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">오늘의 미션</span>
                  <span className="text-[10px] font-medium text-[#7854F7] bg-purple-100 px-1.5 py-0.5 rounded-full">
                    AI 추천
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  {mission.isCompleted
                    ? '오늘 미션 완료! 스트릭이 유지됐어요 🎉'
                    : `${DOMAIN_LABEL[mission.domainFocus ?? ''] ?? '영어'} 집중 학습 · ${(mission.questionIds as string[]).length}문제`}
                </p>
              </div>
            </div>

            {!mission.isCompleted && (
              <Link
                href="/student/daily-mission"
                className="flex-shrink-0 flex items-center gap-1 bg-[#1865F2] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#1558d6] transition-colors min-h-[36px]"
              >
                시작
                <ChevronRight size={13} />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Weekly goal + Stats row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Weekly goal */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarCheck size={18} className="text-[#7854F7]" />
              <span className="text-sm font-medium text-gray-700">주간 목표</span>
            </div>
            <span className="text-xs font-bold text-[#7854F7]">
              {weeklyQuestionCount} / {weeklyGoal}문제
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-700 ${
                weeklyProgress >= 100
                  ? 'bg-[#1FAF54]'
                  : weeklyProgress >= 50
                    ? 'bg-[#7854F7]'
                    : 'bg-[#1865F2]'
              }`}
              style={{ width: `${weeklyProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {weeklyProgress >= 100
              ? '🎉 주간 목표 달성!'
              : `${weeklyGoal - weeklyQuestionCount}문제 더 풀면 목표 달성!`}
          </p>
        </div>

        {/* Badges earned */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-[#FFB100]" />
              <span className="text-sm font-medium text-gray-700">획득 배지</span>
            </div>
            <Link
              href="/student/badges"
              className="text-xs text-[#1865F2] font-medium hover:underline flex items-center gap-0.5"
            >
              전체보기 <ChevronRight size={12} />
            </Link>
          </div>

          {badgeEarnings.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {badgeEarnings.slice(0, 6).map((e) => (
                <div
                  key={e.id}
                  className="w-10 h-10 rounded-xl bg-[#FFB100]/10 flex items-center justify-center text-xl"
                  title={e.badge.name}
                >
                  {e.badge.iconUrl ?? '🏅'}
                </div>
              ))}
              {badgeEarnings.length > 6 && (
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                  +{badgeEarnings.length - 6}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <Lock size={14} />
              <p className="text-xs">미션을 완료하면 배지를 받아요!</p>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-2.5">
            {badgeEarnings.length} / {allBadges.length} 수집
          </p>
        </div>
      </div>

      {/* ── Streak milestones visual ─────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-[#FFB100]" />
          <span className="text-sm font-medium text-gray-700">스트릭 배지 달성 현황</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {STREAK_MILESTONES.map(({ days, emoji, label }) => {
            const achieved = streak.currentStreak >= days
            const badgeEarned = badgeEarnings.some((e) => e.badge.code === `STREAK_${days}`)
            return (
              <div
                key={days}
                className={`flex flex-col items-center gap-1.5 rounded-xl p-2.5 text-center transition-all ${
                  badgeEarned
                    ? 'bg-orange-50 border border-orange-200'
                    : achieved
                      ? 'bg-gray-50 border border-gray-200'
                      : 'bg-gray-50 border border-gray-100 opacity-40'
                }`}
              >
                <span className="text-xl">{badgeEarned ? emoji : '🔒'}</span>
                <span className="text-[10px] font-bold text-gray-700">{label}</span>
                <span className="text-[9px] text-gray-400">{days}일</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/student/daily-mission"
          className="rounded-xl border-2 border-[#1865F2] bg-[#1865F2]/5 hover:bg-[#1865F2]/10 p-4 flex items-center gap-3 transition-colors"
        >
          <Target size={20} className="text-[#1865F2] flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-gray-900">오늘의 미션</p>
            <p className="text-xs text-gray-500">AI 추천 학습</p>
          </div>
        </Link>
        <Link
          href="/student/badges"
          className="rounded-xl border-2 border-[#FFB100] bg-[#FFB100]/5 hover:bg-[#FFB100]/10 p-4 flex items-center gap-3 transition-colors"
        >
          <Award size={20} className="text-[#FFB100] flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-gray-900">배지 컬렉션</p>
            <p className="text-xs text-gray-500">{badgeEarnings.length}개 달성</p>
          </div>
        </Link>
      </div>
    </div>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: 'Grammar',
  VOCABULARY: 'Vocabulary',
  READING: 'Reading',
  WRITING: 'Writing',
}

const STREAK_MILESTONES = [
  { days: 3, emoji: '🔥', label: '3일' },
  { days: 7, emoji: '⚡', label: '7일' },
  { days: 14, emoji: '💫', label: '14일' },
  { days: 30, emoji: '🌟', label: '30일' },
  { days: 100, emoji: '👑', label: '100일' },
]
