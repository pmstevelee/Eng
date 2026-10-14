import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Flame, ChevronRight, ClipboardList, Clock, Trophy, BarChart2, Award } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getStudentDashboardData } from './_actions/gamification'
import { canUseWordLearning } from '@/lib/words/access-guard'
import { getOrCreateTodayMission } from '@/lib/missions/mission-engine'
import {
  getOrCreateTodayWordPlan,
  getTodayLearningSummary,
  refreshTodayPlanCompletion,
} from '@/lib/words/daily-plan'
import { TodayLearningCard } from '@/components/student/today-learning'
import { LearningCalendar } from '@/components/student/learning-calendar'
import { getMonthlyLearningActivity } from '@/lib/learning/home-calendar'
import { getLearningRanking } from '@/lib/learning/ranking'
import { prisma } from '@/lib/prisma/client'
import { getLevelInfo } from '@/lib/constants/levels'
import { isMonthKey, todayKst } from '@/lib/attendance/time'

/** 오늘의 단어 계획을 준비한 뒤 3단계 진행 요약을 조회 (실패해도 홈은 그대로 렌더) */
async function loadTodayLearning(studentId: string, userId: string, academyId: string | null) {
  try {
    // 문법 미션은 대시보드 캐시에서도 생성하지만, 하루 첫 접속 시 요약 조회가 먼저 끝나지 않도록 함께 보장한다.
    // (동시 생성은 (studentId, missionDate) 유니크 제약 + 재조회로 처리됨)
    await Promise.all([
      getOrCreateTodayMission(studentId),
      academyId && (await canUseWordLearning(academyId))
        ? getOrCreateTodayWordPlan({ studentId, userId, academyId })
        : null,
    ])
    const summary = await getTodayLearningSummary(studentId)
    if (summary.isAllComplete && summary.plan && !summary.plan.bonusAwarded) {
      const res = await refreshTodayPlanCompletion(studentId)
      if (res.completedNow) return await getTodayLearningSummary(studentId)
    }
    return summary
  } catch (e) {
    console.error('[student-home] 오늘의 단어학습 조회 실패:', e)
    return null
  }
}

/** 홈 요약 카드용: 이번 주 학원 내 내 순위 (실패해도 홈은 그대로 렌더) */
async function loadMyRank(
  studentId: string,
  name: string,
  academyId: string | null,
  level: number,
): Promise<{ rank: number | null; total: number }> {
  try {
    const result = await getLearningRanking({
      scope: 'academy',
      period: 'week',
      academyId,
      classId: null,
      viewer: { studentId, name, level, className: null },
    })
    return { rank: result.me?.rank ?? null, total: result.totalParticipants }
  } catch (e) {
    console.error('[student-home] 랭킹 조회 실패:', e)
    return { rank: null, total: 0 }
  }
}

export default async function StudentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const [{ user, studentId, userId }, params] = await Promise.all([requireStudent(), searchParams])
  const monthKey = isMonthKey(params.month) ? params.month : todayKst().slice(0, 7)
  // 대시보드 데이터(문법 미션 생성 포함)와 오늘의 단어 계획을 함께 준비한다.
  const [data, todayLearning, activity, badgeCount] = await Promise.all([
    getStudentDashboardData(),
    loadTodayLearning(studentId, userId, user.academyId),
    getMonthlyLearningActivity(studentId, monthKey),
    prisma.badgeEarning.count({ where: { studentId } }),
  ])
  if (!data) redirect('/login')

  const { streak, isActiveToday, totalXp, upcomingSessions, recentActivities, currentLevel, recentAvgScore } = data
  const myRank = await loadMyRank(studentId, user.name, user.academyId, currentLevel)
  const levelInfo = getLevelInfo(currentLevel)

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

      {/* ── 요약: 랭킹 · 내 성적 · 배지 ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          href="/student/ranking"
          icon={<Trophy size={18} className="text-[#FFB100]" />}
          label="이번 주 랭킹"
          value={myRank.rank ? `${myRank.rank}위` : '-'}
          sub={myRank.total > 0 ? `학원 ${myRank.total}명 중` : '이번 주 학습을 시작해 보세요'}
        />
        <SummaryCard
          href="/student/grades"
          icon={<BarChart2 size={18} className="text-[#1865F2]" />}
          label="내 성적"
          value={`Lv.${currentLevel}`}
          sub={`${levelInfo.cefr}${recentAvgScore !== null ? ` · 최근 평균 ${recentAvgScore}점` : ''}`}
        />
        <SummaryCard
          href="/student/badges"
          icon={<Award size={18} className="text-[#7854F7]" />}
          label="배지"
          value={`${badgeCount}개`}
          sub="획득한 배지 보기"
        />
      </div>

      {/* ── 오늘의 단어학습 (복습 → 새 단어 → 문법) ─────────────────────── */}
      {todayLearning && <TodayLearningCard summary={todayLearning} />}

      {/* ── 학습 캘린더 (단어 · 문법 · 쓰기) ───────────────────────────── */}
      <LearningCalendar monthKey={monthKey} activity={activity} />

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

function SummaryCard({
  href,
  icon,
  label,
  value,
  sub,
}: {
  href: string
  icon: React.ReactNode
  label: string
  value: string
  sub: string
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] flex-col rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          {icon}
          {label}
        </span>
        <ChevronRight size={14} className="text-gray-400" />
      </div>
      <span className="mt-2 text-2xl font-bold text-gray-900">{value}</span>
      <span className="mt-0.5 text-xs text-gray-500">{sub}</span>
    </Link>
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

