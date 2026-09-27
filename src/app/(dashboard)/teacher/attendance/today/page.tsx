import { redirect } from 'next/navigation'
import { getAttendanceScope } from '@/lib/attendance/access'
import { getTodayAttendance } from '@/lib/attendance/queries'
import { isDateKey, todayKst } from '@/lib/attendance/time'
import { TodayAttendance } from '@/components/shared/attendance/today-attendance'

export default async function AttendanceTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const scope = await getAttendanceScope()
  if (!scope || scope.role !== 'TEACHER') redirect('/login')

  const { date } = await searchParams
  const today = todayKst()
  const dateKey = isDateKey(date) ? date : today
  const data = await getTodayAttendance(scope, scope.academyIds[0], dateKey)

  return (
    <TodayAttendance key={dateKey} data={data} basePath="/teacher/attendance" today={today} nowMs={Date.now()} />
  )
}
