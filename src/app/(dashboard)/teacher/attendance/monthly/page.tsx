import { redirect } from 'next/navigation'
import { getAttendanceScope } from '@/lib/attendance/access'
import { getMonthlySheet } from '@/lib/attendance/queries'
import { isMonthKey, todayKst } from '@/lib/attendance/time'
import { MonthlySheet } from '@/components/shared/attendance/monthly-sheet'

export default async function AttendanceMonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; month?: string }>
}) {
  const scope = await getAttendanceScope()
  if (!scope || scope.role !== 'TEACHER') redirect('/login')

  const { class: classId, month } = await searchParams
  const monthKey = isMonthKey(month) ? month : todayKst().slice(0, 7)
  const sheet = await getMonthlySheet(scope, classId, monthKey)

  return <MonthlySheet key={`${sheet.classId}:${monthKey}`} sheet={sheet} basePath="/teacher/attendance" />
}
