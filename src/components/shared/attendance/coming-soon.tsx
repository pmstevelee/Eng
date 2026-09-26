import Link from 'next/link'
import { CalendarCheck } from 'lucide-react'

/** 출결관리 중 아직 제공되지 않는 화면 */
export function AttendanceComingSoon({
  title,
  description,
  settingsHref,
}: {
  title: string
  description: string
  /** 학원장에게만 출결 설정 바로가기 표시 */
  settingsHref?: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white py-16 px-6 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
          <CalendarCheck size={24} className="text-primary-700" />
        </div>
        <p className="mt-4 text-base font-semibold text-gray-900">준비 중입니다</p>
        <p className="mt-1 text-sm text-gray-500">곧 이 화면에서 {title}을(를) 확인할 수 있습니다.</p>
        {settingsHref && (
          <Link
            href={settingsHref}
            className="mt-6 h-11 px-5 rounded-xl bg-primary-700 text-white text-sm font-semibold inline-flex items-center hover:bg-primary-800"
          >
            출결 설정 먼저 하기
          </Link>
        )}
      </div>
    </div>
  )
}
