import Link from 'next/link'
import { CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck } from 'lucide-react'
import { NavLinkWithLoading } from '@/components/shared/nav-link-with-loading'
import { formatWeekRange, weekdayLabel } from '@/lib/words/week'
import type { WeeklyDay, WeeklyWordOverview } from '@/lib/words/weekly-words'
import { WEEKLY_TEST_PASSING_SCORE } from '@/lib/words/weekly-words'

function dayLabel(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number)
  return `${m}/${d}`
}

function DayStatus({ day }: { day: WeeklyDay }) {
  if (day.isDone) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#1FAF54] px-2 py-0.5 text-[11px] font-semibold text-white">
        <CheckCircle2 className="h-3 w-3" />
        완료
      </span>
    )
  }
  if (day.isStarted || day.learnedCount > 0) {
    return (
      <span className="rounded-full bg-[#F3F0FF] px-2 py-0.5 text-[11px] font-semibold text-[#7854F7]">학습중</span>
    )
  }
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">학습 전</span>
}

function DayRow({ day }: { day: WeeklyDay }) {
  const dateBlock = (
    <div className="w-12 shrink-0 text-center">
      <p className={`text-sm font-bold ${day.isToday ? 'text-[#7854F7]' : 'text-gray-900'}`}>{dayLabel(day.dateKey)}</p>
      <p className="text-[11px] text-gray-400">{weekdayLabel(day.dateKey)}요일</p>
    </div>
  )

  if (!day.setId) {
    return (
      <div className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
        {dateBlock}
        <p className="flex-1 text-sm text-gray-400">
          {day.isFuture ? '학습 예정' : day.isToday ? '오늘의 단어 준비 중' : '학습하지 않은 날'}
        </p>
      </div>
    )
  }

  return (
    <NavLinkWithLoading
      href={`/student/words/${day.setId}`}
      className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 hover:bg-gray-50"
      loadingLabel="단어 세트로 이동 중..."
    >
      {dateBlock}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-gray-900">오늘의 단어 {day.wordCount}개</p>
          {day.isToday && (
            <span className="shrink-0 rounded-full bg-[#7854F7] px-1.5 py-0.5 text-[10px] font-bold text-white">
              오늘
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {day.learnedCount}/{day.wordCount} 학습 완료
        </p>
      </div>
      <DayStatus day={day} />
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
    </NavLinkWithLoading>
  )
}

/** 단어학습 메뉴 — 이번 주 날짜별 오늘의 단어 세트 + 주간 테스트 */
export function WeeklyWordSets({ overview }: { overview: WeeklyWordOverview }) {
  const { test } = overview
  const hasWords = overview.totalWords > 0
  const isPassed = test.bestScore !== null && test.bestScore >= WEEKLY_TEST_PASSING_SCORE

  return (
    <section className="space-y-3" id="weekly-words">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-bold text-gray-900">
            <CalendarDays className="h-4 w-4 text-[#7854F7]" />
            이번 주 오늘의 단어
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatWeekRange(overview.weekStart)} · 매주 월요일에 새로 시작돼요
          </p>
        </div>
        {hasWords && (
          <p className="text-xs font-medium text-gray-500">
            이번 주 {overview.learnedWords}/{overview.totalWords}단어 학습
          </p>
        )}
      </div>

      <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {overview.days.map((day) => (
          <DayRow key={day.dateKey} day={day} />
        ))}
      </div>

      {/* 주간 테스트 */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#FFB100]/40 bg-[#FFB100]/5 p-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFB100]">
            <ClipboardCheck className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">주간 테스트</p>
            <p className="text-xs text-gray-500">
              {!hasWords
                ? '이번 주 단어를 학습하면 테스트를 볼 수 있어요'
                : test.attempts === 0
                  ? `이번 주 단어 ${overview.totalWords}개로 실력을 확인해요 · 합격 ${WEEKLY_TEST_PASSING_SCORE}%`
                  : `최고 ${test.bestScore}점${isPassed ? ' · 합격' : ''} · ${test.attempts}회 응시`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {test.lastResultId && (
            <Link
              href={`/student/words/weekly-test/result/${test.lastResultId}`}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-600 hover:border-gray-300 sm:flex-none"
            >
              결과 보기
            </Link>
          )}
          {hasWords ? (
            <NavLinkWithLoading
              href="/student/words/weekly-test"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#1865F2] px-5 text-sm font-semibold text-white hover:bg-[#1865F2]/90 sm:flex-none"
              loadingLabel="테스트 준비 중..."
            >
              {test.attempts === 0 ? '테스트 시작' : '다시 테스트'}
            </NavLinkWithLoading>
          ) : (
            <span className="inline-flex h-11 flex-1 cursor-not-allowed items-center justify-center rounded-xl bg-gray-200 px-5 text-sm font-semibold text-gray-500 sm:flex-none">
              테스트 시작
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
