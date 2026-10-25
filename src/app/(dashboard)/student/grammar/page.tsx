import Link from 'next/link'
import { AlertTriangle, BookOpen, CalendarClock, ChevronRight, Map, RotateCcw } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getGrammarHomeData, type GrammarHomeData } from '@/lib/grammar/student-queries'
import { GrammarStateBadge } from '@/components/grammar/grammar-state-badge'
import { NEXT_UNIT_REASON_LABEL } from '@/lib/grammar/constants'
import { formatDaysLeft, formatDueKey } from './_components/format'

const FREE_PRACTICE_HREF = '/student/learn/domain/grammar'

export default async function StudentGrammarHomePage() {
  const { user, studentId } = await requireStudent()
  const data = user.academyId ? await getGrammarHomeData(studentId, user.academyId) : null

  if (!data || !data.hasPoints) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF4FF]">
          <BookOpen className="h-7 w-7 text-[#1865F2]" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900">아직 열린 문법 단원이 없어요</h2>
        <p className="mt-1 max-w-sm text-sm text-gray-500">
          단원이 준비되면 여기에서 순서대로 배울 수 있어요. 그동안 자유 연습으로 문법 문제를 풀어 보세요.
        </p>
        <Link
          href={FREE_PRACTICE_HREF}
          className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-[#1865F2] px-5 text-sm font-semibold text-white hover:bg-[#1453c9]"
        >
          자유 연습 하기
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <NextUnitCard next={data.next} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ReviewCard review={data.review} />
        <ProgressCard progress={data.progress} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DueSoonCard items={data.dueSoon} />
        <WeakCard items={data.weak} />
      </div>
    </div>
  )
}

// ─── ① 이어서 학습 ───────────────────────────────────────────────────────────

function NextUnitCard({ next }: { next: GrammarHomeData['next'] }) {
  if (!next) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm font-semibold text-[#1FAF54]">모두 통과했어요</p>
        <h2 className="mt-1 text-lg font-bold text-gray-900">지금 배울 단원을 모두 통과했어요</h2>
        <p className="mt-1 text-sm text-gray-500">커리큘럼 지도에서 더 배우고 싶은 단원을 골라 보세요.</p>
        <Link
          href="/student/grammar/map"
          className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-200 px-4 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          <Map className="h-4 w-4" />
          커리큘럼 지도 보기
        </Link>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[#1865F2]">{NEXT_UNIT_REASON_LABEL[next.reason]}</span>
        <GrammarStateBadge state={next.state} />
      </div>
      <p className="mt-3 text-sm text-gray-500">
        {next.categoryName} · {next.subCategoryName}
      </p>
      <h2 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">{next.title}</h2>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
        {next.stepLabel && <span>현재 단계: {next.stepLabel}</span>}
        {next.dueKey && <span>마감: {formatDueKey(next.dueKey)}</span>}
      </div>
      <Link
        href={`/student/grammar/${next.code}`}
        className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-lg bg-[#1865F2] px-6 text-base font-semibold text-white hover:bg-[#1453c9] sm:w-auto"
      >
        {next.state === 'IN_PROGRESS' ? '이어서 학습하기' : '학습 시작하기'}
        <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  )
}

// ─── ② 오늘 복습 ─────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: GrammarHomeData['review'] }) {
  const total = review.points + review.questions
  return (
    <Link
      href="/student/grammar/review"
      className="flex min-h-[44px] items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:bg-gray-50"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FF]">
        <RotateCcw className="h-5 w-5 text-[#1865F2]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-500">오늘 복습</p>
        <p className="text-2xl font-bold text-gray-900">{total}개</p>
        <p className="text-xs text-gray-500">
          {total === 0 ? '오늘 복습할 것이 없어요' : `단원 ${review.points}개 · 문제 ${review.questions}개`}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 text-gray-400" />
    </Link>
  )
}

// ─── ④ 진도율 ────────────────────────────────────────────────────────────────

function ProgressCard({ progress }: { progress: GrammarHomeData['progress'] }) {
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  const scopeLabel =
    progress.scope === 'ASSIGNED'
      ? '배정된 단원 기준'
      : progress.scope === 'COURSE'
        ? `${progress.courseName} 코스 기준`
        : '전체 단원 기준'
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-gray-500">진도율</p>
        <p className="text-xs text-gray-500">{scopeLabel}</p>
      </div>
      <p className="mt-1 text-2xl font-bold text-gray-900">
        {percent}%
        <span className="ml-2 text-sm font-medium text-gray-500">
          {progress.done} / {progress.total} 단원 통과
        </span>
      </p>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="진도율"
      >
        <div className="h-full rounded-full bg-[#1FAF54]" style={{ width: `${percent}%` }} />
      </div>
    </section>
  )
}

// ─── ③ 마감 임박 ─────────────────────────────────────────────────────────────

function DueSoonCard({ items }: { items: GrammarHomeData['dueSoon'] }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
        <CalendarClock className="h-5 w-5 text-[#FFB100]" />
        마감 임박 단원
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">7일 안에 마감되는 배정 단원이 없어요.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.code}>
              <UnitRow
                href={`/student/grammar/${item.code}`}
                title={item.title}
                sub={`${item.categoryName} · ${formatDueKey(item.dueKey)}까지`}
                right={
                  <span
                    className={
                      item.daysLeft < 0 ? 'text-xs font-semibold text-[#D92916]' : 'text-xs font-semibold text-[#8A5A00]'
                    }
                  >
                    {formatDaysLeft(item.daysLeft)}
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ─── ⑤ 취약 포인트 ───────────────────────────────────────────────────────────

function WeakCard({ items }: { items: GrammarHomeData['weak'] }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
        <AlertTriangle className="h-5 w-5 text-[#D92916]" />
        취약 단원
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">취약 단원이 없어요. 잘하고 있어요!</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.code}>
              <UnitRow
                href={`/student/grammar/${item.code}`}
                title={item.title}
                sub={item.categoryName}
                right={
                  item.lastCheckScore !== null ? (
                    <span className="text-xs font-semibold text-[#D92916]">최근 {item.lastCheckScore}점</span>
                  ) : null
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function UnitRow({ href, title, sub, right }: { href: string; title: string; sub: string; right: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-h-[44px] items-center gap-3 py-2.5 hover:bg-gray-50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
        <p className="truncate text-xs text-gray-500">{sub}</p>
      </div>
      {right}
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
    </Link>
  )
}
