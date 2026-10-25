'use client'

// 결과 단계 — 점수, 통과/미달, 틀린 문제 해설, 다음 행동

import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { GrammarStateBadge } from '@/components/grammar/grammar-state-badge'
import type { GrammarCheckResult } from '@/lib/grammar/unit-queries'

interface Props {
  result: GrammarCheckResult
  onRetryPractice: () => void
  onReviewConcept: () => void
  onRetryCheck: () => void
}

export function ResultStep({ result, onRetryPractice, onReviewConcept, onRetryCheck }: Props) {
  const wrong = result.items.filter((i) => !i.isCorrect)
  const color = result.passed ? '#1FAF54' : '#D92916'

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold" style={{ color }}>
          {result.passed ? '통과했어요!' : '아직 통과 기준에 못 미쳤어요'}
        </p>
        <p className="mt-2 text-5xl font-black" style={{ color }}>
          {result.score}
          <span className="text-2xl">점</span>
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {result.totalCount}문제 중 {result.correctCount}개 정답 · 통과 기준 {result.passScore}%
        </p>
        <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-gray-100">
          <div className="h-2 rounded-full" style={{ width: `${result.score}%`, backgroundColor: color }} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <GrammarStateBadge state={result.state} />
          {result.xpEarned > 0 && (
            <span className="rounded-full bg-[#FFF4D6] px-2.5 py-0.5 text-xs font-semibold text-[#9A6700]">+{result.xpEarned} XP</span>
          )}
        </div>
        {result.passed && result.state === 'PASSED' && (
          <p className="mt-3 text-sm text-gray-600">3일 뒤 복습에서 다시 한번 확인해요.</p>
        )}
        {result.state === 'WEAK' && (
          <p className="mt-3 text-sm text-[#B42318]">취약 단원으로 표시됐어요. 개념을 다시 보고 연습한 뒤 도전해 보세요.</p>
        )}
      </div>

      {wrong.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-base font-bold text-gray-900">틀린 문제 해설 ({wrong.length})</h3>
          <ul className="mt-3 space-y-3">
            {wrong.map((item, i) => (
              <li key={item.questionId} className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-900">
                  {i + 1}. {item.questionText}
                </p>
                <p className="mt-2 flex items-start gap-1.5 text-sm text-[#B42318]">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>내 답: {item.myAnswer}</span>
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-[#15803D]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>정답: {item.correctAnswer}</span>
                </p>
                {item.explanation && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-700">{item.explanation}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {result.passed ? (
          <>
            <Link
              href="/student/grammar"
              className="flex h-11 flex-1 items-center justify-center rounded-lg bg-[#1865F2] text-sm font-semibold text-white hover:bg-[#1558d6]"
            >
              다음 단원 보러 가기
            </Link>
            <Link
              href="/student/grammar/map"
              className="flex h-11 flex-1 items-center justify-center rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              커리큘럼 지도
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onRetryPractice}
              className="h-11 flex-1 rounded-lg bg-[#1865F2] text-sm font-semibold text-white hover:bg-[#1558d6]"
            >
              연습 다시 하기
            </button>
            <button
              type="button"
              onClick={onReviewConcept}
              className="h-11 flex-1 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              개념 다시 보기
            </button>
            <button
              type="button"
              onClick={onRetryCheck}
              className="h-11 flex-1 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              확인 테스트 다시 풀기
            </button>
          </>
        )}
      </div>
    </div>
  )
}
