import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RotateCcw, Repeat } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { prisma } from '@/lib/prisma/client'
import { todayKst } from '@/lib/attendance/time'
import { weekStartOf, weeklySetTitle } from '@/lib/words/week'
import { WEEKLY_TEST_PASSING_SCORE } from '@/lib/words/weekly-words'
import type { WordTestAnswerRecord } from '@/lib/words/test-grader'

interface Props {
  params: Promise<{ resultId: string }>
}

export default async function WeeklyWordTestResultPage({ params }: Props) {
  const { resultId } = await params
  const { studentId } = await requireStudent()

  const test = await prisma.wordTest.findFirst({
    where: { id: resultId, studentId },
    select: { score: true, answers: true, wordSet: { select: { title: true } } },
  })
  if (!test) notFound()

  const answers = test.answers as unknown as WordTestAnswerRecord[]
  const wrongAnswers = answers.filter((a) => !a.isCorrect)
  const isPassed = test.score >= WEEKLY_TEST_PASSING_SCORE
  const setTitle = test.wordSet?.title ?? ''
  // 이번 주 테스트일 때만 다시 보기 (지난주 세트는 갱신되어 응시 불가)
  const isCurrentWeek = setTitle === weeklySetTitle(weekStartOf(todayKst()))

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-8">
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <div
          className={`mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full text-3xl font-black ${
            isPassed ? 'bg-[#1FAF54]/10 text-[#1FAF54]' : 'bg-[#D92916]/10 text-[#D92916]'
          }`}
        >
          {test.score}점
        </div>
        <h1 className="mb-1 text-xl font-bold text-gray-900">{isPassed ? '합격!' : '조금 더 연습해요'}</h1>
        <p className="text-sm text-gray-500">{setTitle.replace('주간 단어', '주간 테스트')}</p>
        <div className="mt-4 flex items-center justify-center gap-6 border-t border-gray-100 pt-4">
          <div className="text-center">
            <p className="text-xs text-gray-400">정답</p>
            <p className="text-lg font-bold text-[#1FAF54]">{answers.length - wrongAnswers.length}개</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">오답</p>
            <p className="text-lg font-bold text-[#D92916]">{wrongAnswers.length}개</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">합격 기준</p>
            <p className="text-lg font-bold text-gray-700">{WEEKLY_TEST_PASSING_SCORE}%</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {wrongAnswers.length > 0 && (
          <>
            <p className="text-center text-xs text-gray-500">틀린 단어는 오늘의 복습에 자동으로 추가되었어요.</p>
            <Link
              href="/student/words/review"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7854F7] text-sm font-semibold text-white hover:bg-[#7854F7]/90"
            >
              <Repeat className="h-4 w-4" />
              틀린 단어 복습하기
            </Link>
          </>
        )}
        {isCurrentWeek && (
          <Link
            href="/student/words/weekly-test"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-gray-300"
          >
            <RotateCcw className="h-4 w-4" />
            주간 테스트 다시 보기
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">문항별 결과</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {answers.map((ans, i) => (
            <div key={ans.wordId} className="flex items-start gap-3 px-4 py-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  ans.isCorrect ? 'bg-[#1FAF54]/10 text-[#1FAF54]' : 'bg-[#D92916]/10 text-[#D92916]'
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{ans.term}</p>
                <p className="text-xs text-gray-400">{ans.meaning}</p>
                {!ans.isCorrect && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-[#D92916]">내 답: {ans.userAnswer || '(미입력)'}</p>
                    <p className="text-xs text-[#1FAF54]">정답: {ans.correctAnswer}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Link href="/student/words" className="block py-2 text-center text-sm text-gray-500 hover:text-gray-700">
        단어학습으로 돌아가기
      </Link>
    </div>
  )
}
