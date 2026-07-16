import { prisma } from '@/lib/prisma/client'
import { Activity } from 'lucide-react'
import { ACTIVITY_ACTION_LABELS } from '@/lib/constants/activity-actions'
import { ActionFrequencyChart, type ActionFrequencyData } from '../_components/charts'
import type { Role } from '@/generated/prisma'

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: '관리자',
  ACADEMY_OWNER: '학원장',
  TEACHER: '교사',
  STUDENT: '학생',
}
const ROLE_CLASS: Record<Role, string> = {
  SUPER_ADMIN: 'bg-gray-100 text-gray-600',
  ACADEMY_OWNER: 'bg-primary-100 text-primary-700',
  TEACHER: 'bg-accent-green-light text-accent-green',
  STUDENT: 'bg-accent-purple-light text-accent-purple',
}
const TARGET_ROLES: Role[] = ['ACADEMY_OWNER', 'TEACHER', 'STUDENT']
const DAY_OPTIONS = [7, 30, 90] as const
const PAGE_SIZE = 30

interface PageProps {
  searchParams: { role?: string; action?: string; days?: string; page?: string }
}

export default async function ActivityLogsPage({ searchParams }: PageProps) {
  const roleFilter = TARGET_ROLES.includes(searchParams.role as Role)
    ? (searchParams.role as Role)
    : null
  const actionFilter = searchParams.action && searchParams.action in ACTIVITY_ACTION_LABELS
    ? searchParams.action
    : null
  const days = DAY_OPTIONS.includes(Number(searchParams.days) as (typeof DAY_OPTIONS)[number])
    ? Number(searchParams.days)
    : 30
  const page = Math.max(1, Number(searchParams.page) || 1)

  const since = new Date()
  since.setDate(since.getDate() - days)

  const where = {
    createdAt: { gte: since },
    role: roleFilter ? roleFilter : { in: TARGET_ROLES },
    ...(actionFilter ? { action: actionFilter } : {}),
  }

  const [actionCounts, roleCounts, totalCount, logs] = await Promise.all([
    prisma.activityLog.groupBy({
      by: ['action'],
      where,
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    }),
    prisma.activityLog.groupBy({
      by: ['role'],
      where,
      _count: { role: true },
    }),
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])

  const userIds = Array.from(new Set(logs.map((l) => l.userId)))
  const academyIds = Array.from(
    new Set(logs.map((l) => l.academyId).filter((id): id is string => !!id)),
  )

  const [users, academies] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : Promise.resolve([]),
    academyIds.length
      ? prisma.academy.findMany({
          where: { id: { in: academyIds } },
          select: { id: true, name: true, businessName: true },
        })
      : Promise.resolve([]),
  ])
  const userMap = new Map(users.map((u) => [u.id, u]))
  const academyMap = new Map(academies.map((a) => [a.id, a]))

  const chartData: ActionFrequencyData[] = actionCounts.map((a) => ({
    action: a.action,
    label: ACTIVITY_ACTION_LABELS[a.action] ?? a.action,
    count: a._count.action,
  }))

  const roleCountMap = new Map(roleCounts.map((r) => [r.role, r._count.role]))
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const buildHref = (overrides: Record<string, string | number | null>) => {
    const params = new URLSearchParams()
    if (roleFilter) params.set('role', roleFilter)
    if (actionFilter) params.set('action', actionFilter)
    params.set('days', String(days))
    params.set('page', '1')
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) params.delete(key)
      else params.set(key, String(value))
    }
    return `/admin/activity-logs?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">활동 로그</h1>
        <p className="text-sm text-gray-500 mt-1">
          구독자(학원장/교사/학생)의 주요 기능 사용 현황을 확인하고 업데이트에 참고하세요
        </p>
      </div>

      {/* 기간 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        {DAY_OPTIONS.map((d) => (
          <a
            key={d}
            href={buildHref({ days: d })}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              days === d ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            최근 {d}일
          </a>
        ))}
        <span className="w-px h-4 bg-gray-200 mx-1" />
        <a
          href={buildHref({ role: null })}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            !roleFilter ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          전체 역할
        </a>
        {TARGET_ROLES.map((r) => (
          <a
            key={r}
            href={buildHref({ role: r })}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              roleFilter === r ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {ROLE_LABEL[r]} {roleCountMap.get(r) ?? 0}
          </a>
        ))}
      </div>

      {/* 기능별 사용 빈도 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">기능별 사용 빈도</h2>
        {chartData.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-gray-400">
            <Activity size={32} className="text-gray-300" />
            <p className="text-sm">해당 기간에 기록된 활동이 없습니다</p>
          </div>
        ) : (
          <ActionFrequencyChart data={chartData} />
        )}
      </div>

      {/* 액션 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={buildHref({ action: null })}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            !actionFilter ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          전체 기능
        </a>
        {Object.entries(ACTIVITY_ACTION_LABELS).map(([action, label]) => (
          <a
            key={action}
            href={buildHref({ action })}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              actionFilter === action
                ? 'bg-primary-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {/* 최근 로그 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">최근 활동 ({totalCount.toLocaleString()}건)</span>
        </div>
        {logs.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <Activity size={40} className="text-gray-300" />
            <p className="text-sm text-gray-500">조건에 맞는 활동 로그가 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['시각', '역할', '사용자', '학원', '기능', '상세'].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const user = userMap.get(log.userId)
                  const academy = log.academyId ? academyMap.get(log.academyId) : null
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {log.createdAt.toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_CLASS[log.role]}`}
                        >
                          {ROLE_LABEL[log.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {user ? user.name : '(삭제된 사용자)'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {academy ? academy.businessName ?? academy.name : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {ACTIVITY_ACTION_LABELS[log.action] ?? log.action}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">
                        {log.metadata ? JSON.stringify(log.metadata) : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-gray-100">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(Math.max(0, page - 3), page + 2)
              .map((p) => (
                <a
                  key={p}
                  href={buildHref({ page: p })}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium ${
                    p === page ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </a>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
