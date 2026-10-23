import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ClipboardCheck } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { canUseWordLearning } from '@/lib/words/access-guard'
import {
  buildWeeklyTest,
  WEEKLY_TEST_PASSING_SCORE,
  WEEKLY_TEST_SECONDS_PER_QUESTION,
} from '@/lib/words/weekly-words'
import { WordTestClient } from '../test/[testId]/_components/word-test-client'

export const dynamic = 'force-dynamic'

export default async function WeeklyWordTestPage() {
  const { studentId, userId, user } = await requireStudent()
  if (!user.academyId || !(await canUseWordLearning(user.academyId))) redirect('/student/words')

  const test = await buildWeeklyTest(studentId, userId)

  if (!test) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#FFB100]/10">
          <ClipboardCheck className="h-7 w-7 text-[#FFB100]" />
        </div>
        <p className="text-lg font-semibold text-gray-900">이번 주에 학습한 단어가 없어요</p>
        <p className="text-sm text-gray-500">오늘의 단어를 먼저 학습한 뒤 주간 테스트를 볼 수 있어요.</p>
        <Link
          href="/student/words"
          className="mt-2 inline-flex h-11 items-center rounded-xl bg-[#1865F2] px-5 text-sm font-semibold text-white"
        >
          단어학습으로 돌아가기
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-4 py-3 text-center">
        <h1 className="text-base font-semibold text-gray-900">{test.title}</h1>
        <p className="mt-0.5 text-xs text-gray-400">
          {test.questions.length}문항 · 합격 기준 {WEEKLY_TEST_PASSING_SCORE}%
        </p>
      </div>
      <WordTestClient
        assignment={{
          id: test.setId,
          title: test.title,
          mode: 'MIXED',
          timePerQuestion: WEEKLY_TEST_SECONDS_PER_QUESTION,
          numQuestions: test.questions.length,
          passingScore: WEEKLY_TEST_PASSING_SCORE,
        }}
        questions={test.questions}
        weekly={{ setId: test.setId }}
      />
    </div>
  )
}
