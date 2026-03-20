'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, FileText, BookOpen, AlertCircle } from 'lucide-react'
import type { SessionForTest, TestForTest } from '../page'

const TYPE_LABEL: Record<string, string> = {
  LEVEL_TEST: '레벨 테스트',
  UNIT_TEST: '단원 테스트',
  PRACTICE: '연습 테스트',
}

type Props = {
  session: SessionForTest
  test: TestForTest
  questionCount: number
  onStart: (sessionId: string) => Promise<{ error?: string; startedAt?: string }>
}

export function TestStartScreen({ session, test, questionCount, onStart }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleStart() {
    setError(null)
    startTransition(async () => {
      const result = await onStart(session.id)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* 테스트 타입 배지 */}
        <div className="mb-4 text-center">
          <span className="inline-flex items-center rounded-full bg-[#EEF4FF] px-3 py-1 text-sm font-medium text-[#1865F2]">
            {TYPE_LABEL[test.type] ?? test.type}
          </span>
        </div>

        {/* 제목 */}
        <h1 className="mb-8 text-center text-2xl font-bold text-gray-900">{test.title}</h1>

        {/* 정보 카드 */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF4FF]">
                <FileText className="h-5 w-5 text-[#1865F2]" />
              </div>
              <div>
                <p className="text-xs text-gray-500">총 문제 수</p>
                <p className="text-lg font-bold text-gray-900">{questionCount}문제</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF4FF]">
                <Clock className="h-5 w-5 text-[#1865F2]" />
              </div>
              <div>
                <p className="text-xs text-gray-500">제한 시간</p>
                <p className="text-lg font-bold text-gray-900">
                  {test.timeLimitMin ? `${test.timeLimitMin}분` : '제한 없음'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 안내 사항 */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">응시 안내</h3>
          </div>

          {test.instructions ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
              {test.instructions}
            </p>
          ) : (
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#1865F2]">•</span>
                <span>시작하기 버튼을 누르면 타이머가 시작됩니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#1865F2]">•</span>
                <span>응답은 30초마다 자동으로 저장됩니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#1865F2]">•</span>
                <span>문제 번호를 클릭하면 해당 문제로 이동할 수 있습니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#1865F2]">•</span>
                <span>모든 문제를 풀고 제출하기 버튼을 눌러 완료하세요.</span>
              </li>
              {test.timeLimitMin && (
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#D92916]">•</span>
                  <span>제한 시간이 초과되면 자동으로 제출됩니다.</span>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* 주의 사항 */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#FFB100]/30 bg-[#FFFBEB] p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB100]" />
          <p className="text-sm text-gray-700">
            테스트 진행 중 다른 탭으로 전환하거나 창을 닫으면 경고가 표시됩니다.
          </p>
        </div>

        {/* 에러 */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-[#D92916]">{error}</div>
        )}

        {/* 시작 버튼 */}
        <button
          onClick={handleStart}
          disabled={isPending}
          className="h-12 w-full rounded-xl bg-[#1865F2] text-base font-semibold text-white transition-colors hover:bg-[#1558d6] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? '시작 중...' : '시작하기'}
        </button>
      </div>
    </div>
  )
}
