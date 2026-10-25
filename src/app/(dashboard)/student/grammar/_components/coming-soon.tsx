import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

/** 아직 만들지 않은 문법학습 화면 자리 (빈 상태: 아이콘 + 설명 + 버튼) */
export function GrammarComingSoon({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF4FF]">
        <Icon className="h-7 w-7 text-[#1865F2]" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-gray-900">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
      <Link
        href="/student/grammar"
        className="mt-6 inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 px-5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
      >
        문법 홈으로
      </Link>
    </div>
  )
}
