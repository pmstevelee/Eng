import Link from 'next/link'
import { ChevronLeft, ListChecks } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getQuestionReviewQuiz } from '@/lib/grammar/review-queries'
import { OTHER_GROUP_KEY } from '@/lib/grammar/review-logic'
import { ReviewQuiz } from '../_components/review-quiz'

// 틀린 문제 복습 — 오답노트 만기 문항을 단원별로 묶어 풀기 (결과는 기존 오답노트 간격 규칙)

export default async function StudentGrammarQuestionReviewPage({ searchParams }: { searchParams: { group?: string } }) {
  const { user, studentId } = await requireStudent()
  const key = typeof searchParams.group === 'string' && searchParams.group ? searchParams.group : OTHER_GROUP_KEY
  const quiz = user.academyId
    ? await getQuestionReviewQuiz(studentId, user.academyId, key)
    : { key, title: '', questions: [], remaining: 0 }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/student/grammar/review"
          className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          복습 목록
        </Link>
        <p className="text-sm text-gray-500">틀린 문제 복습</p>
        <h2 className="mt-1 text-xl font-bold text-gray-900">{quiz.title || '틀린 문제'}</h2>
      </div>

      {quiz.questions.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F7EE]">
            <ListChecks className="h-7 w-7 text-[#1FAF54]" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-gray-900">이 단원에서 오늘 다시 풀 문제가 없어요</h3>
          <p className="mt-1 text-sm text-gray-500">다른 단원의 복습을 확인해 보세요.</p>
          <Link
            href="/student/grammar/review"
            className="mt-6 inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 px-5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            복습 목록으로
          </Link>
        </div>
      ) : (
        <ReviewQuiz
          key={quiz.questions.map((q) => q.id).join(',')}
          mode={{ kind: 'questions', groupKey: quiz.key, remaining: quiz.remaining }}
          questions={quiz.questions}
          intro={`전에 틀린 ${quiz.questions.length}문제를 다시 풀어요. 모두 풀고 제출하면 한꺼번에 채점해요.${quiz.remaining > 0 ? ` (이어서 ${quiz.remaining}문제 더)` : ''}`}
        />
      )}
    </div>
  )
}
