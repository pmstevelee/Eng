import { cookies } from 'next/headers'
import { ShieldOff, TabletSmartphone } from 'lucide-react'
import { findKioskDevice, KIOSK_COOKIE } from '@/lib/attendance/keypad-device'
import { KioskKeypad } from './_components/kiosk-keypad'
import { KioskNotice } from './_components/kiosk-notice'

export const dynamic = 'force-dynamic'

/** 키패드 출결 화면 — 기기 쿠키로만 동작 (로그인 불필요) */
export default async function KioskPage() {
  const device = await findKioskDevice(cookies().get(KIOSK_COOKIE)?.value)

  if (!device) {
    return (
      <KioskNotice
        icon={TabletSmartphone}
        title="등록되지 않은 기기입니다"
        description={'학원장 계정의 출결 설정 › 키패드 출결 기기에서 [기기 추가]를 누르고\n이 기기로 QR을 스캔해 등록해주세요.'}
      />
    )
  }
  if (device.revoked) {
    return (
      <KioskNotice
        icon={ShieldOff}
        tone="red"
        title="기기 등록이 해제되었습니다"
        description={'학원장님께 문의해주세요.\n다시 사용하려면 출결 설정에서 기기를 새로 추가해야 합니다.'}
      />
    )
  }

  return <KioskKeypad academyName={device.academyName} />
}
