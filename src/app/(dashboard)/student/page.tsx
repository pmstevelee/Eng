import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Trophy, BarChart2, Coins, Bell, ClipboardList, Megaphone } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getStudentDashboardData } from './_actions/gamification'
import { LearningCalendar } from '@/components/student/learning-calendar'
import { getMonthlyLearningActivity } from '@/lib/learning/home-calendar'
import { getLearningRanking } from '@/lib/learning/ranking'
import { prisma } from '@/lib/prisma/client'
import { getLevelInfo } from '@/lib/constants/levels'
import { isMonthKey, todayKst } from '@/lib/attendance/time'

/** 홈 요약 카드용: 오늘 학원 내 내 순위 (실패해도 홈은 그대로 렌더) */
async function loadMyRank(
  studentId: string,
  name: string,
  academyId: string | null,
  level: number,
): Promise<{ rank: number | null; total: number }> {
  try {
    const result = await getLearningRanking({
      scope: 'academy',
      period: 'day',
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

/** 오늘(KST) 받은 알림 */
function loadTodayNotifications(userId: string) {
  const startOfToday = new Date(`${todayKst()}T00:00:00+09:00`)
  return prisma.notification.findMany({
    where: { userId, createdAt: { gte: startOfToday } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, title: true, message: true, link: true, isRead: true, createdAt: true },
  })
}

/** 학원 공지사항 (전체 학생 대상 + 내 반 대상) */
function loadAnnouncements(studentId: string, academyId: string | null) {
  if (!academyId) return Promise.resolve([])
  return prisma.announcement.findMany({
    where: {
      academyId,
      isPublished: true,
      OR: [
        { target: 'ALL_STUDENTS' },
        { target: 'CLASS', class: { students: { some: { id: studentId } } } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, title: true, content: true, createdAt: true },
  })
}

export default async function StudentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const [{ user, studentId, userId }, params] = await Promise.all([requireStudent(), searchParams])
  const monthKey = isMonthKey(params.month) ? params.month : todayKst().slice(0, 7)
  const [data, activity, profile, notifications, announcements] = await Promise.all([
    getStudentDashboardData(),
    getMonthlyLearningActivity(studentId, monthKey),
    prisma.user.findUnique({ where: { id: userId }, select: { lastLoginAt: true } }),
    loadTodayNotifications(userId),
    loadAnnouncements(studentId, user.academyId),
  ])
  if (!data) redirect('/login')

  const { totalXp, upcomingSessions, currentLevel } = data
  const myRank = await loadMyRank(studentId, user.name, user.academyId, currentLevel)
  const levelInfo = getLevelInfo(currentLevel)
  const hasAlerts = upcomingSessions.length > 0 || notifications.length > 0

  return (
    <div className="space-y-6">
      {/* ── 이름 (접속시간) ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{user.name}</h1>
        {profile?.lastLoginAt && (
          <span className="text-sm text-gray-500">({formatAccessTime(profile.lastLoginAt)} 접속)</span>
        )}
      </div>

      {/* ── 요약: 오늘의 랭킹 · 나의 레벨 · 내 포인트 ───────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SummaryCard
          href="/student/ranking"
          icon={<Trophy size={16} className="text-[#FFB100]" />}
          label="오늘의 랭킹"
          value={myRank.rank ? `${myRank.rank}위` : '-'}
          sub={myRank.total > 0 ? `학원 ${myRank.total}명 중` : '오늘 학습을 시작해 보세요'}
        />
        <SummaryCard
          href="/student/grades"
          icon={<BarChart2 size={16} className="text-[#1865F2]" />}
          label="나의 레벨"
          value={`Lv.${currentLevel}`}
          sub={levelInfo.cefr}
        />
        <SummaryCard
          href="/student/ranking?period=all"
          icon={<Coins size={16} className="text-[#1FAF54]" />}
          label="내 포인트"
          value={`${totalXp.toLocaleString('ko-KR')}P`}
          sub="누적 포인트"
        />
      </div>

      {/* ── 오늘의 알림 (예정 테스트 + 오늘 받은 알림) ──────────────────── */}
      <section>
        <SectionHeader title="오늘의 알림" href="/student/notifications" />
        <div className="rounded-xl border border-gray-200 bg-white">
          {hasAlerts ? (
            <ul className="divide-y divide-gray-100">
              {upcomingSessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/student/tests/${s.id}`}
                    className="flex min-h-[44px] items-center gap-3 px-4 py-3 hover:bg-gray-50"
                  >
                    <ClipboardList size={16} className="flex-shrink-0 text-[#D92916]" />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                      <b className="font-bold text-[#D92916]">테스트 예정</b> · {s.test.title}
                      {s.timeLimitMin ? ` (${s.timeLimitMin}분)` : ''}
                    </span>
                    <ChevronRight size={14} className="flex-shrink-0 text-gray-400" />
                  </Link>
                </li>
              ))}
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link ?? '/student/notifications'}
                    className="flex min-h-[44px] items-center gap-3 px-4 py-3 hover:bg-gray-50"
                  >
                    <Bell
                      size={16}
                      className={`flex-shrink-0 ${n.isRead ? 'text-gray-300' : 'text-[#1865F2]'}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                      <span className={n.isRead ? '' : 'font-bold'}>{n.title}</span>
                      <span className="ml-1 text-gray-500">{n.message}</span>
                    </span>
                    <span className="flex-shrink-0 text-xs text-gray-400">
                      {formatTime(n.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-gray-400">오늘 새로운 알림이 없어요</p>
          )}
        </div>
      </section>

      {/* ── 학습 캘린더 (단어 · 문법 · 쓰기) ───────────────────────────── */}
      <LearningCalendar monthKey={monthKey} activity={activity} />

      {/* ── 공지사항 ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="공지사항" />
        <div className="rounded-xl border border-gray-200 bg-white">
          {announcements.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {announcements.map((a) => (
                <li key={a.id}>
                  <details className="group">
                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-gray-50">
                      <Megaphone size={16} className="flex-shrink-0 text-[#FFB100]" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                        {a.title}
                      </span>
                      <span className="flex-shrink-0 text-xs text-gray-400">
                        {formatDate(a.createdAt)}
                      </span>
                      <ChevronRight
                        size={14}
                        className="flex-shrink-0 text-gray-400 transition-transform group-open:rotate-90"
                      />
                    </summary>
                    <p className="whitespace-pre-wrap px-4 pb-4 pl-11 text-sm text-gray-600">
                      {a.content}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-gray-400">등록된 공지사항이 없어요</p>
          )}
        </div>
      </section>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {href && (
        <Link href={href} className="flex items-center text-xs text-gray-500 hover:text-[#1865F2]">
          전체 보기
          <ChevronRight size={12} />
        </Link>
      )}
    </div>
  )
}

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
      className="flex min-h-[44px] min-w-0 flex-col rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:bg-gray-50 sm:p-4"
    >
      <span className="flex items-center gap-1 truncate text-xs font-medium text-gray-700 sm:text-sm">
        {icon}
        {label}
      </span>
      <span className="mt-2 truncate text-xl font-bold text-gray-900 sm:text-2xl">{value}</span>
      <span className="mt-0.5 truncate text-[11px] text-gray-500 sm:text-xs">{sub}</span>
    </Link>
  )
}

const KST = 'Asia/Seoul'

function formatAccessTime(date: Date): string {
  return date.toLocaleString('ko-KR', {
    timeZone: KST,
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ko-KR', { timeZone: KST, hour: 'numeric', minute: '2-digit' })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', { timeZone: KST, month: 'numeric', day: 'numeric' })
}
