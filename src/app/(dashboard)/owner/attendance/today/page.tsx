import { redirect } from 'next/navigation'
import { getOwnerBranches } from '@/lib/branch'
import { getAttendanceScope } from '@/lib/attendance/access'
import { getTodayAttendance } from '@/lib/attendance/queries'
import { isDateKey, todayKst } from '@/lib/attendance/time'
import { TodayAttendance } from '@/components/shared/attendance/today-attendance'

export default async function AttendanceTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; academy?: string }>
}) {
  const scope = await getAttendanceScope()
  if (!scope || scope.role !== 'ACADEMY_OWNER') redirect('/login')

  // 본원 + 소유 지점 (지점이 있을 때만 학원 선택 표시)
  const branchData = await getOwnerBranches(scope.userId).catch(() => null)
  const academies = branchData
    ? [
        { id: branchData.hq.id, label: '본원' },
        ...branchData.branches.map((b) => ({ id: b.id, label: b.branchName ?? b.name })),
      ]
    : [{ id: scope.academyIds[0], label: '본원' }]

  const { date, academy } = await searchParams
  const today = todayKst()
  const dateKey = isDateKey(date) ? date : today
  const academyId = academies.some((a) => a.id === academy) ? academy! : academies[0].id
  const data = await getTodayAttendance(scope, academyId, dateKey)

  return (
    <TodayAttendance
      key={`${academyId}:${dateKey}`}
      data={data}
      basePath="/owner/attendance"
      today={today}
      nowMs={Date.now()}
      academies={academies}
      academyId={academyId}
    />
  )
}
