import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import {
  buildTestResultReportData,
  findSavedTestResultReport,
} from '@/lib/reports/test-result-report'
import { SessionReportPrint } from './_components/session-report-print'

export default async function SessionReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'ACADEMY_OWNER' && user.role !== 'TEACHER') redirect('/login')

  const { sessionId } = await params

  // 권한 확인: 같은 학원의 교사/학원장만 접근 가능
  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      student: { select: { user: { select: { academyId: true } } } },
    },
  })
  if (!session) notFound()
  if (user.academyId !== session.student.user.academyId) notFound()

  // 저장된 결과표 스냅샷이 있으면 그대로 사용, 없으면 통계를 실시간 집계
  const saved = await findSavedTestResultReport(sessionId)
  const stats = saved?.stats ?? (await buildTestResultReportData(sessionId))
  if (!stats) notFound()

  return (
    <SessionReportPrint
      stats={stats}
      savedNarrative={saved?.narrative ?? null}
      hasSnapshot={saved !== null}
    />
  )
}
