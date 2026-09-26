import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getOwnerBranches } from '@/lib/branch'
import { getOrCreateAttendanceSetting } from '@/lib/attendance/settings'
import { AttendanceSettingsClient } from './_components/attendance-settings-client'

export default async function AttendanceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ academy?: string }>
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  // 본원 + 소유 지점 (지점이 있을 때만 학원 선택 표시)
  const branchData = await getOwnerBranches(user.id).catch(() => null)
  const academies = branchData
    ? [
        { id: branchData.hq.id, label: '본원' },
        ...branchData.branches.map((b) => ({ id: b.id, label: b.branchName ?? b.name })),
      ]
    : [{ id: user.academyId, label: '본원' }]

  const { academy } = await searchParams
  const academyId = academies.some((a) => a.id === academy) ? academy! : academies[0].id
  const setting = await getOrCreateAttendanceSetting(academyId)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">출결 설정</h1>
        <p className="text-sm text-gray-500 mt-1">출결 방식과 지각·결석 기준, 학부모 알림을 설정합니다.</p>
      </div>
      <AttendanceSettingsClient
        key={academyId}
        academyId={academyId}
        academies={academies}
        initial={setting}
      />
    </div>
  )
}
