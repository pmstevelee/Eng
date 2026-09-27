import { TabletSmartphone } from 'lucide-react'
import { findValidRegistration } from '@/lib/attendance/keypad-device'
import { KioskNotice } from '../_components/kiosk-notice'
import { RegisterDeviceForm } from './register-device-form'

export const dynamic = 'force-dynamic'

/**
 * 기기 등록 — 학원장 화면의 QR로 진입.
 * 링크 미리보기·카메라 앱의 사전 요청으로 코드가 소모되지 않도록 버튼을 눌러야 등록된다.
 */
export default async function KioskRegisterPage({ searchParams }: { searchParams: { code?: string } }) {
  const code = typeof searchParams.code === 'string' ? searchParams.code : undefined
  const registration = await findValidRegistration(code)

  if (!code || !registration) {
    return (
      <KioskNotice
        icon={TabletSmartphone}
        tone="red"
        title="등록 코드를 사용할 수 없습니다"
        description={'만료되었거나 이미 사용된 등록 코드입니다.\n학원장 화면(출결 설정 › 키패드 출결 기기)에서 QR을 다시 만들어주세요.'}
      />
    )
  }

  return (
    <KioskNotice
      icon={TabletSmartphone}
      title="이 기기를 출결 키패드로 등록할까요?"
      description={`${registration.academyName} · ${registration.name}\n등록하면 이 브라우저에서 로그인 없이 키패드 출결 화면이 열립니다.`}
    >
      <RegisterDeviceForm code={code} />
    </KioskNotice>
  )
}
