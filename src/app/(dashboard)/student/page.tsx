import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Flame, ChevronRight, ClipboardList, Clock } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getStudentDashboardData } from './_actions/gamification'
import { DailyMissionCard } from '@/components/student/daily-mission-card'
import { DailyReviewWidget } from '@/components/words/daily-review-widget'

export default async function StudentDashboardPage() {
  const { user, studentId } = await requireStudent()
  const data = await getStudentDashboardData()
  if (!data) redirect('/login')

  const {
    mission,
    streak,
    isActiveToday,
    totalXp,
    upcomingSessions,
    recentActivities,
    dueWordCount,
  } = data

  const firstName = user.name.split(' ')[0]

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? '좋은 아침이에요' : hour < 18 ? '안녕하세요' : '오늘도 수고했어요'

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

      {/* ── 오늘의 미션 카드 ─────────────────────────────────────────────── */}
      {mission && <DailyMissionCard mission={mission} />}

      {/* ── 단어 복습 위젯 ──────────────────────────────────────────────── */}
      <DailyReviewWidget studentId={studentId} dueCount={dueWordCount} />

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

      {/* ── 최근 활동 ────────────────────────────────────────────────────── */}
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

