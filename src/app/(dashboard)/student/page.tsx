import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Flame,
  ChevronRight,
  CalendarCheck,
  ClipboardList,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getStudentDashboardData } from './_actions/gamification'
import { getLevelInfo, LEVEL_UP_THRESHOLDS } from '@/lib/constants/levels'
import { DailyMissionCard } from '@/components/student/daily-mission-card'

export default async function StudentDashboardPage() {
  const pageStart = performance.now()

  const authStart = performance.now()
  const user = await getCurrentUser()
  console.log(`  [쿼리1] getCurrentUser: ${(performance.now() - authStart).toFixed(0)}ms`)
  if (!user || user.role !== 'STUDENT') redirect('/login')

  const dataStart = performance.now()
  const data = await getStudentDashboardData()
  console.log(`  [쿼리2] getStudentDashboardData: ${(performance.now() - dataStart).toFixed(0)}ms`)
  if (!data) redirect('/login')

  const totalTime = performance.now() - pageStart
  console.log(`📊 [StudentDashboardPage] 전체 서버 시간: ${totalTime.toFixed(0)}ms`)
  if (totalTime > 200) console.log(`⚠️ SLOW PAGE: ${totalTime.toFixed(0)}ms`)

  const {
    mission,
    streak,
    isActiveToday,
    weeklyQuestionCount,
    weeklyGoal,
    currentLevel,
    totalXp,
    recentAvgScore,
    domainScores,
    upcomingSessions,
    recentActivities,
  } = data

  const firstName = user.name.split(' ')[0]

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? '좋은 아침이에요' : hour < 18 ? '안녕하세요' : '오늘도 수고했어요'

  const levelInfo = getLevelInfo(currentLevel)
  const levelColor = LEVEL_TEXT_COLORS[currentLevel] ?? 'text-[#1865F2]'
  const weeklyProgress = Math.min(100, Math.round((weeklyQuestionCount / weeklyGoal) * 100))

  // Level ring progress (LEVEL_UP_THRESHOLDS 기반)
  const currentThresholdEntry = LEVEL_UP_THRESHOLDS.find((t) => t.from === currentLevel)
  const currentThreshold = currentThresholdEntry?.requiredAvg ?? 0
  const prevThresholdEntry = LEVEL_UP_THRESHOLDS.find((t) => t.to === currentLevel)
  const prevThreshold = prevThresholdEntry?.requiredAvg ?? 0
  const levelRingProgress =
    recentAvgScore !== null && currentThreshold > prevThreshold
      ? Math.min(
          100,
          Math.max(
            0,
            ((recentAvgScore - prevThreshold) / (currentThreshold - prevThreshold)) * 100,
          ),
        )
      : 0
  const pointsToNext =
    recentAvgScore !== null && currentLevel < 10
      ? Math.max(0, currentThreshold - recentAvgScore)
      : null

  // SVG ring constants
  const SVG_R = 52
  const SVG_C = 2 * Math.PI * SVG_R
  const svgOffset = SVG_C * (1 - levelRingProgress / 100)

  return (
    <div className="space-y-6">
      {/* ── 상단 인사 영역 ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {greeting}, {firstName}님!
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {streak.currentStreak > 0
              ? `🔥${streak.currentStreak}일  ⚡${totalXp} XP`
              : isActiveToday
                ? `오늘도 학습했어요. ⚡${totalXp} XP`
                : `오늘부터 시작해볼까요? ⚡${totalXp} XP`}
          </p>
        </div>
        {/* Streak badge */}
        <div
          className={`flex min-w-[64px] flex-shrink-0 flex-col items-center rounded-2xl border p-3 ${
            streak.currentStreak > 0
              ? 'border-[#FFB100]/40 bg-[#FFB100]/10'
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          <Flame
            size={22}
            className={streak.currentStreak > 0 ? 'text-[#FFB100]' : 'text-gray-300'}
          />
          <span className="text-3xl font-black leading-tight text-gray-900">
            {streak.currentStreak}
          </span>
          <span className="text-[10px] text-gray-500">연속</span>
        </div>
      </div>

      {/* ── 내 레벨 카드 ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp size={18} className={levelColor} />
          <span className="text-sm font-medium text-gray-700">내 레벨</span>
        </div>
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          {/* Circular ring */}
          <div className="flex flex-shrink-0 flex-col items-center gap-2">
            <div className="relative h-36 w-36">
              <svg
                width="144"
                height="144"
                viewBox="0 0 144 144"
                className="-rotate-90"
                aria-hidden="true"
              >
                <circle cx="72" cy="72" r={SVG_R} fill="none" stroke="#E5E7EB" strokeWidth="10" />
                <circle
                  cx="72"
                  cy="72"
                  r={SVG_R}
                  fill="none"
                  stroke="#1FAF54"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={SVG_C}
                  strokeDashoffset={svgOffset}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-black ${levelColor}`}>Lv.{currentLevel}</span>
                <span className="mt-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
                  {levelInfo.nameKo}
                </span>
              </div>
            </div>
            {pointsToNext !== null ? (
              <p className="text-center text-sm text-gray-500">
                다음 레벨까지{' '}
                <span className="font-bold text-gray-700">{pointsToNext}점</span> 필요
              </p>
            ) : recentAvgScore === null ? (
              <p className="text-center text-xs text-gray-400">테스트를 완료하면 갱신돼요</p>
            ) : (
              <p className="text-center text-sm font-bold text-[#FFB100]">🏆 최고 레벨 달성!</p>
            )}
          </div>

          {/* Domain bars */}
          <div className="w-full flex-1 space-y-3">
            {DOMAIN_KEYS.map((domain) => {
              const cfg = DOMAIN_CONFIG[domain]
              const score = domainScores[domain] ?? 0
              return (
                <div key={domain}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{cfg.label}</span>
                    <span className="text-sm font-bold" style={{ color: cfg.color }}>
                      {score}/100
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-2.5 rounded-full transition-all duration-700"
                      style={{ width: `${score}%`, backgroundColor: cfg.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── 오늘의 미션 카드 ─────────────────────────────────────────────── */}
      {mission && <DailyMissionCard mission={mission} />}

      {/* ── 예정된 테스트 카드 ───────────────────────────────────────────── */}
      {upcomingSessions.length > 0 && (
        <div className="rounded-xl border border-[#D92916]/30 bg-red-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList size={18} className="text-[#D92916]" />
            <span className="text-sm font-bold text-[#D92916]">📝 테스트 예정</span>
          </div>
          <div className="space-y-2">
            {upcomingSessions.map((s) => {
              const qCount = s.test.totalScore > 0 ? s.test.totalScore : null
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-red-100 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-bold text-gray-900">{s.test.title}</p>
                    <div className="mt-0.5 flex items-center gap-3">
                      {s.timeLimitMin && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock size={11} />
                          {s.timeLimitMin}분
                        </span>
                      )}
                      {qCount !== null && (
                        <span className="text-xs text-gray-500">{qCount}문제</span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/student/tests/${s.id}`}
                    className="flex min-h-[36px] items-center gap-1 rounded-lg bg-[#D92916] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#b82410]"
                  >
                    지금 시작
                    <ChevronRight size={12} />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 이번 주 목표 + 최근 활동 ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Weekly goal */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck size={18} className="text-[#7854F7]" />
              <span className="text-sm font-medium text-gray-700">이번 주 목표</span>
            </div>
            <span className="text-xs font-bold text-[#7854F7]">
              {weeklyQuestionCount} / {weeklyGoal}문제
            </span>
          </div>
          <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-gray-100">
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
          <p className="text-xs text-gray-400">
            {weeklyProgress >= 100
              ? '🎉 이번 주 목표 달성!'
              : `${weeklyGoal - weeklyQuestionCount}문제 더 풀면 목표 달성!`}
          </p>
          {weeklyProgress >= 100 && (
            <p className="mt-1 text-xs font-medium text-[#1FAF54]">배지 획득 완료 🏅</p>
          )}
        </div>

        {/* Recent activities */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3">
            <span className="text-sm font-medium text-gray-700">최근 활동</span>
          </div>
          {recentActivities.length > 0 ? (
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg leading-none">{activity.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {activity.label}
                      {activity.detail && (
                        <span className="ml-1 font-bold text-[#1865F2]">{activity.detail}</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatRelativeTime(activity.time)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-gray-400">
              <p className="text-sm">아직 활동 기록이 없어요</p>
              <p className="mt-1 text-xs">미션을 완료하면 활동이 기록돼요!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay === 1) return '어제'
  if (diffDay < 7) return `${diffDay}일 전`
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

// ─── Constants ────────────────────────────────────────────────────────────────

// 레벨별 텍스트 색상 (10단계)
const LEVEL_TEXT_COLORS: Record<number, string> = {
  1:  'text-gray-500',
  2:  'text-gray-600',
  3:  'text-green-600',
  4:  'text-green-700',
  5:  'text-[#1865F2]',
  6:  'text-blue-700',
  7:  'text-[#7854F7]',
  8:  'text-purple-700',
  9:  'text-orange-500',
  10: 'text-[#FFB100]',
}

const DOMAIN_KEYS = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING'] as const

const DOMAIN_CONFIG: Record<string, { label: string; color: string }> = {
  GRAMMAR: { label: 'Grammar', color: '#1865F2' },
  VOCABULARY: { label: 'Vocabulary', color: '#7854F7' },
  READING: { label: 'Reading', color: '#0FBFAD' },
  WRITING: { label: 'Writing', color: '#E35C20' },
  LISTENING: { label: 'Listening', color: '#0EA5E9' },
}

