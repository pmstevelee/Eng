import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, RotateCcw } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getWrongAnswersForReview } from '../actions'
import { ReviewClient } from './_components/review-client'

export default async function ReviewPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')

  const { items, total } = await getWrongAnswersForReview()

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
          <h1 className="text-xl font-bold text-gray-900">오답 복습</h1>
          <p className="text-xs text-gray-500">틀린 문제를 다시 풀어보세요</p>
        </div>
      </div>

      {/* 안내 배너 */}
      <div className="flex items-center gap-3 rounded-xl border p-4" style={{ backgroundColor: '#FFF5F5', borderColor: '#FCA5A5' }}>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: '#D92916' }}
        >
          <RotateCcw className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            최근 30일 오답 {total}문제
          </p>
          <p className="text-xs text-gray-500">
            맞추면 목록에서 제거됩니다 · 스페이스드 리피티션으로 효과적으로 복습하세요
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <div className="mb-3 text-4xl">🎉</div>
          <p className="text-sm font-medium text-gray-600">복습할 오답이 없습니다!</p>
          <p className="mt-1 text-xs text-gray-400">
            최근 30일간 틀린 문제가 없거나 아직 테스트를 응시하지 않았어요.
          </p>
          <Link
            href="/student/tests"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#1865F2] px-5 text-sm font-semibold text-white"
          >
            테스트 응시하기
          </Link>
        </div>
      ) : (
        <ReviewClient items={items} />
      )}
    </div>
  )
}
