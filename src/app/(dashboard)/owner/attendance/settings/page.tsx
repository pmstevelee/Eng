import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getOwnerBranches } from '@/lib/branch'
import { listKeypadDevices } from '@/lib/attendance/keypad-device'
import { getOrCreateAttendanceSetting } from '@/lib/attendance/settings'
import { getCreditPricing, getWallet, walletAcademyIdOf } from '@/lib/credits/wallet'
import { AttendanceSettingsClient } from './_components/attendance-settings-client'
import { KeypadDevicesSection } from './_components/keypad-devices-section'

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
  const [setting, devices, pricing, wallet] = await Promise.all([
    getOrCreateAttendanceSetting(academyId),
    listKeypadDevices(academyId),
    getCreditPricing(),
    walletAcademyIdOf(academyId).then(getWallet),
  ])

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">출결 설정</h1>
        <p className="text-sm text-gray-500 mt-1">출결 방식과 지각·결석 기준, 학부모 알림, 키패드 기기를 설정합니다.</p>
      </div>
      <AttendanceSettingsClient
        key={academyId}
        academyId={academyId}
        academies={academies}
        initial={setting}
        credit={{ perMessage: pricing.ALIMTALK, smsPerMessage: pricing.SMS, balance: wallet.balance }}
      />
      <KeypadDevicesSection academyId={academyId} devices={devices} />
    </div>
  )
}
