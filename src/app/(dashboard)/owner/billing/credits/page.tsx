import { redirect } from 'next/navigation'

// AI 전용 크레딧은 알림·AI 통합 크레딧으로 바뀌었다 — 예전 주소는 통합 크레딧 화면으로 보낸다.
// (이전 화면 컴포넌트 credits-client.tsx는 더 이상 쓰지 않음)
export default function LegacyAiCreditsPage() {
  redirect('/owner/credits')
}
