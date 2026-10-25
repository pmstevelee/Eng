import Link from 'next/link'
import { ChevronRight, ListChecks, RotateCcw } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getGrammarReviewData } from '@/lib/grammar/review-queries'
import { GrammarStateBadge } from '@/components/grammar/grammar-state-badge'
import { todayKst } from '@/lib/attendance/time'

// 문법 복습 — ① 포인트 복습(통과 단원 3일·7일 뒤 5문항) ② 문항 복습(오답노트 만기 문항)

function overdueLabel(nextReviewAt: string, today: string): string {
  const key = new Date(new Date(nextReviewAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${key}T00:00:00Z`)) / 86_400_000)
  return days <= 0 ? '오늘 복습' : `${days}일 지남`
}

export default async function StudentGrammarReviewPage() {
  const { user, studentId } = await requireStudent()
  const data = user.academyId
    ? await getGrammarReviewData(studentId, user.academyId)
    : { points: [], questionGroups: [], questionTotal: 0, masteryReviewStreak: 2 }
  const today = todayKst()

  if (data.points.length === 0 && data.questionTotal === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F7EE]">
          <RotateCcw className="h-7 w-7 text-[#1FAF54]" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900">오늘 복습할 게 없어요</h2>
        <p className="mt-1 max-w-sm text-sm text-gray-500">
          단원을 통과하면 3일 뒤, 7일 뒤에 복습이 열려요. 틀린 문제는 다음 날 다시 풀 수 있어요.
        </p>
        <Link
          href="/student/grammar"
          className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-[#1865F2] px-5 text-sm font-semibold text-white hover:bg-[#1558d6]"
        >
          다음 단원 학습하기
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">단원 복습 {data.points.length}개</h2>
            <p className="text-sm text-gray-500">
              단원마다 5문제를 풀어요. 복습을 {data.masteryReviewStreak}번 연속 통과하면 숙달이에요.
            </p>
          </div>
        </div>
        {data.points.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white px-5 py-6 text-center text-sm text-gray-500">
            오늘 복습할 단원이 없어요.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.points.map((p) => (
              <li key={p.code}>
                <Link
                  href={`/student/grammar/review/${encodeURIComponent(p.code)}`}
                  className="flex min-h-[64px] items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-[#1865F2]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500">{p.categoryName}</p>
                    <p className="truncate text-sm font-semibold text-gray-900">{p.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      복습 통과 {p.reviewStreak}/{data.masteryReviewStreak}회 · {overdueLabel(p.nextReviewAt, today)}
                    </p>
                  </div>
                  <GrammarStateBadge state={p.state} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">틀린 문제 복습 {data.questionTotal}개</h2>
          <p className="text-sm text-gray-500">오답노트 문제를 단원별로 다시 풀어요. 2번 연속 맞히면 해결돼요.</p>
        </div>
        {data.questionGroups.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white px-5 py-6 text-center text-sm text-gray-500">
            오늘 다시 풀 틀린 문제가 없어요.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.questionGroups.map((g) => (
              <li key={g.key}>
                <Link
                  href={`/student/grammar/review/questions?group=${encodeURIComponent(g.key)}`}
                  className="flex min-h-[64px] items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-[#1865F2]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FF]">
                    <ListChecks className="h-5 w-5 text-[#1865F2]" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    {g.categoryName && <p className="text-xs text-gray-500">{g.categoryName}</p>}
                    <p className="truncate text-sm font-semibold text-gray-900">{g.title}</p>
                  </div>
                  <span className="rounded-full bg-[#FDECEA] px-2.5 py-0.5 text-xs font-semibold text-[#D92916]">
                    {g.count}문제
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
