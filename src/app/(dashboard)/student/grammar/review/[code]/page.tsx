import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarClock, ChevronLeft } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getPointReviewQuiz } from '@/lib/grammar/review-queries'
import { GrammarStateBadge } from '@/components/grammar/grammar-state-badge'
import { ReviewQuiz } from '../_components/review-quiz'

// 단원(포인트) 복습 — 5문항 미니 퀴즈, 결과는 성취도 판정(REVIEW_DONE)에 반영

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })
}

export default async function StudentGrammarPointReviewPage({ params }: { params: { code: string } }) {
  const { user, studentId } = await requireStudent()
  const quiz = user.academyId ? await getPointReviewQuiz(studentId, user.academyId, decodeURIComponent(params.code)) : null
  if (!quiz) notFound()

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
        <p className="text-sm text-gray-500">{quiz.categoryName} · 단원 복습</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900">{quiz.title}</h2>
          <GrammarStateBadge state={quiz.state} />
        </div>
      </div>

      {quiz.status === 'NOT_DUE' ? (
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF4FF]">
            <CalendarClock className="h-7 w-7 text-[#1865F2]" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-gray-900">지금은 복습할 때가 아니에요</h3>
          <p className="mt-1 text-sm text-gray-500">
            {quiz.nextReviewAt
              ? `${formatDate(quiz.nextReviewAt)}에 복습이 열려요.`
              : quiz.state === 'MASTERED'
                ? '이미 숙달한 단원이에요.'
                : '단원의 확인 테스트를 통과하면 복습이 열려요.'}
          </p>
          <Link
            href={`/student/grammar/${encodeURIComponent(quiz.code)}`}
            className="mt-6 inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 px-5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            단원으로 가기
          </Link>
        </div>
      ) : quiz.questions.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
          <h3 className="text-lg font-bold text-gray-900">복습 문제를 준비하고 있어요</h3>
          <p className="mt-1 text-sm text-gray-500">문제가 준비되면 복습할 수 있어요.</p>
        </div>
      ) : (
        <ReviewQuiz
          key={quiz.questions.map((q) => q.id).join(',')}
          mode={{ kind: 'point', code: quiz.code }}
          questions={quiz.questions}
          intro={`${quiz.questions.length}문제를 모두 풀고 제출하면 한꺼번에 채점해요. ${quiz.passScore}% 이상이면 복습 통과 (지금 ${quiz.reviewStreak}/${quiz.masteryReviewStreak}회).`}
        />
      )}
    </div>
  )
}
