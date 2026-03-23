import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, PenLine } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { WritingClient } from './_components/writing-client'

export default async function WritingPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')

  return (
    <div className="space-y-4">
      {/* 뒤로가기 + 헤더 */}
      <div className="flex items-center gap-3">
        <Link
          href="/student/learn"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">쓰기 연습</h1>
          <p className="text-xs text-gray-500">주제를 선택하고 영어 에세이를 작성하세요</p>
        </div>
      </div>

      {/* 안내 배너 */}
      <div
        className="flex items-center gap-3 rounded-xl border px-4 py-3.5"
        style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: '#FFB100' }}
        >
          <PenLine className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">AI 피드백 제공</p>
          <p className="text-xs text-gray-500">
            작성 후 AI가 문법, 구성, 어휘, 표현력을 분석해 드립니다
          </p>
        </div>
      </div>

      <WritingClient />
    </div>
  )
}
