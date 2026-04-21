import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Flame,
  ChevronRight,
  CalendarCheck,
  ClipboardList,
  Clock,
  TrendingUp,
  CheckCircle2,
  Circle,
  AlertCircle,
} from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getStudentDashboardData } from './_actions/gamification'
import { getLevelInfo } from '@/lib/constants/levels'
import { DailyMissionCard } from '@/components/student/daily-mission-card'

export default async function StudentDashboardPage() {
  const { user } = await requireStudent()
  const data = await getStudentDashboardData()
  if (!data) redirect('/login')

  const {
    mission,
    streak,
    isActiveToday,
    weeklyQuestionCount,
    weeklyGoal,
    currentLevel,
    totalXp,
    upcomingSessions,
    recentActivities,
    promotionProgress,
  } = data

  const firstName = user.name.split(' ')[0]

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? '좋은 아침이에요' : hour < 18 ? '안녕하세요' : '오늘도 수고했어요'

  const levelInfo = getLevelInfo(currentLevel)
  const levelColor = LEVEL_TEXT_COLORS[currentLevel] ?? 'text-[#1865F2]'
  const weeklyProgress = Math.min(100, Math.round((weeklyQuestionCount / weeklyGoal) * 100))

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

      {/* ── 승급 진행 카드 ──────────────────────────────────────────────── */}
      {promotionProgress.allMet ? (
        /* 승급 완료 축하 카드 */
        <div className="rounded-xl border border-[#1FAF54]/40 bg-[#F0FDF4] p-5">
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp size={18} className="text-[#1FAF54]" />
            <span className="text-sm font-medium text-[#1FAF54]">레벨 승급</span>
          </div>
          <div className="mt-3 text-center">
            <p className="text-2xl font-black text-gray-900">🎉 축하합니다!</p>
            <p className="mt-1 text-base font-bold text-[#1FAF54]">
              Level {promotionProgress.currentLevel} → Level {promotionProgress.targetLevel} 승급!
            </p>
            <p className="mt-1 text-sm text-gray-600">
              &quot;{getLevelInfo(promotionProgress.currentLevel).nameKo}&quot; →{' '}
              &quot;{getLevelInfo(promotionProgress.targetLevel).nameKo}&quot;
            </p>
            <div className="mt-3 flex justify-center gap-4">
              <span className="rounded-full bg-[#FFB100]/20 px-3 py-1 text-sm font-bold text-[#FFB100]">
                +100 XP 획득!
              </span>
              <span className="rounded-full bg-[#1FAF54]/20 px-3 py-1 text-sm font-bold text-[#1FAF54]">
                🏆 LEVEL_UP 배지
              </span>
            </div>
            <Link
              href="/student/missions"
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#1FAF54] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#178a42]"
            >
              새 레벨의 학습 시작하기
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      ) : (
        /* 승급 진행 카드 */
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className={levelColor} />
              <span className="text-sm font-medium text-gray-700">현재 레벨</span>
            </div>
            <Link href="/student/grades" className="text-xs text-[#1865F2] hover:underline">
              레벨 이력 보기 →
            </Link>
          </div>

          {/* 현재 레벨 배지 */}
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{ backgroundColor: LEVEL_BG_COLORS[currentLevel] ?? '#1865F2' }}
            >
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase leading-none tracking-wide opacity-80">
                  Level
                </p>
                <p className="text-2xl font-black leading-tight">{currentLevel}</p>
              </div>
            </div>
            <div>
              <p className={`text-lg font-black ${levelColor}`}>{levelInfo.nameKo}</p>
              <p className="text-xs text-gray-400">{levelInfo.cefr}</p>
            </div>
          </div>

          {/* Level 승급 조건 */}
          <p className="mb-3 text-xs font-semibold text-gray-500">
            Level {promotionProgress.targetLevel} 승급까지:
          </p>
          <div className="space-y-3">
            {/* 조건 1: 레벨 테스트 */}
            <ConditionRow
              met={promotionProgress.conditions.levelTest.met}
              label="레벨 테스트 통과"
              detail={promotionProgress.conditions.levelTest.detail}
            />

            {/* 조건 2: 단원 테스트 */}
            <div>
              <ConditionRow
                met={promotionProgress.conditions.unitTests.met}
                label={`단원 테스트 이수`}
                detail={promotionProgress.conditions.unitTests.detail}
              />
              {!promotionProgress.conditions.unitTests.met &&
                promotionProgress.conditions.unitTests.progress !== undefined &&
                promotionProgress.conditions.unitTests.progress > 0 && (
                  <div className="mt-1.5 pl-7">
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-[#1865F2] transition-all"
                        style={{ width: `${promotionProgress.conditions.unitTests.progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {promotionProgress.conditions.unitTests.progress}% 이수
                      {promotionProgress.conditions.unitTests.remaining
                        ? ` · ${promotionProgress.conditions.unitTests.remaining}`
                        : ''}
                    </p>
                  </div>
                )}
            </div>

            {/* 조건 3: 학습 활동 */}
            <ConditionRow
              met={promotionProgress.conditions.learningActivity.met}
              label="학습 활동 충족"
              detail={promotionProgress.conditions.learningActivity.detail}
            />
          </div>

          {/* 다음 액션 안내 */}
          <div className="mt-4 rounded-xl bg-[#EEF4FF] px-4 py-3">
            <p className="text-xs font-medium text-[#1865F2]">💡 {promotionProgress.nextAction}</p>
          </div>

          {/* 취약 영역 경고 */}
          {promotionProgress.weakAreas.length > 0 && (
            <div className="mt-2 rounded-xl bg-[#FFF7E6] px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-[#FFB100]" />
                <div>
                  <p className="text-xs font-medium text-[#FFB100]">
                    보강 추천: {promotionProgress.weakAreas.slice(0, 2).join(', ')}
                  </p>
                  <Link
                    href="/student/missions"
                    className="mt-0.5 text-xs text-[#FFB100] underline"
                  >
                    학습 시작하기 →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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

function ConditionRow({
  met,
  label,
  detail,
}: {
  met: boolean
  label: string
  detail: string
}) {
  return (
    <div className="flex items-start gap-2">
      {met ? (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#1FAF54]" />
      ) : (
        <Circle size={16} className="mt-0.5 shrink-0 text-gray-300" />
      )}
      <div className="min-w-0">
        <p className={`text-sm font-medium ${met ? 'text-[#1FAF54]' : 'text-gray-700'}`}>
          {label}
        </p>
        <p className="text-xs text-gray-400 leading-relaxed">{detail}</p>
      </div>
    </div>
  )
}

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

// 레벨별 배경 색상 (10단계)
const LEVEL_BG_COLORS: Record<number, string> = {
  1:  '#9CA3AF',
  2:  '#6B7280',
  3:  '#16A34A',
  4:  '#15803D',
  5:  '#1865F2',
  6:  '#1D4ED8',
  7:  '#7854F7',
  8:  '#6D28D9',
  9:  '#EA580C',
  10: '#FFB100',
}

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


