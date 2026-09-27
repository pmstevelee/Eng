import { notFound, redirect } from 'next/navigation'
import { getAttendanceScope } from '@/lib/attendance/access'
import { getSessionDetail } from '@/lib/attendance/queries'
import { todayKst } from '@/lib/attendance/time'
import { SessionCheck } from '@/components/shared/attendance/session-check'

export default async function AttendanceSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const scope = await getAttendanceScope()
  if (!scope || scope.role !== 'ACADEMY_OWNER') redirect('/login')

  const { sessionId } = await params
  // 권한 없는 반(교사: 담당 반이 아닌 경우)의 회차는 존재 여부도 드러내지 않음
  const detail = await getSessionDetail(scope, sessionId)
  if (!detail) notFound()

  return <SessionCheck detail={detail} basePath="/owner/attendance" today={todayKst()} />
}
