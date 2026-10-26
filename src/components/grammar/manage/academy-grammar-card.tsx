// 학원장 분석 '문법 성취도' 카드 (서버 컴포넌트) — 분석 페이지가 Suspense로 감싸 따로 스트리밍한다
// 학원 전체 통과·숙달 포인트 수, 반별 진도율 막대, 공통 취약 포인트 상위 5개

import Link from 'next/link'
import { AlertTriangle, BookOpenCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { AcademyGrammarSummary } from '@/lib/grammar/achievement-queries'

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpenCheck className="h-4 w-4 text-[#1865F2]" aria-hidden />
          문법 성취도
          <Link href="/owner/grammar" className="ml-auto text-sm font-normal text-[#1865F2] hover:underline">
            문법학습 관리
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function AcademyGrammarCardSkeleton() {
  return (
    <CardShell>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </CardShell>
  )
}

export async function AcademyGrammarCard({ summary }: { summary: Promise<AcademyGrammarSummary> }) {
  let data: AcademyGrammarSummary
  try {
    data = await summary
  } catch (error) {
    console.error('[grammar-achievement] 분석 카드 조회 실패:', error)
    return (
      <CardShell>
        <p className="text-sm text-[#D92916]">문법 성취도를 불러오지 못했습니다. 새로고침해 주세요.</p>
      </CardShell>
    )
  }

  if (data.activeStudents === 0 && data.classes.length === 0) {
    return (
      <CardShell>
        <div className="flex flex-col items-center py-6 text-center">
          <BookOpenCheck className="h-10 w-10 text-gray-300" aria-hidden />
          <p className="mt-3 font-medium text-gray-900">아직 문법 학습 기록이 없습니다</p>
          <p className="mt-1 text-sm text-gray-500">반에 문법 단원을 배정하면 진도와 취약 포인트가 여기에 모입니다.</p>
          <Link
            href="/owner/grammar"
            className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-[#1865F2] px-4 text-sm font-medium text-white hover:bg-[#1253CC]"
          >
            단원 배정하기
          </Link>
        </div>
      </CardShell>
    )
  }

  return (
    <CardShell>
      <div className="grid gap-5 lg:grid-cols-3">
        {/* 전체 수치 */}
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">통과 + 숙달 포인트 (학생별 합계)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
              {(data.passed + data.mastered).toLocaleString()}개
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              통과 {data.passed.toLocaleString()} · 숙달 {data.mastered.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">문법 학습 중인 학생</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{data.activeStudents}명</p>
          </div>
        </div>

        {/* 반별 진도율 */}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">반별 진도율</p>
          {data.classes.length === 0 ? (
            <p className="text-sm text-gray-500">문법 단원을 배정한 반이 없어요.</p>
          ) : (
            <ul className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
              {data.classes.map((c) => {
                const percent = c.averagePercent ?? 0
                return (
                  <li key={c.id}>
                    <Link href={`/owner/grammar/classes/${c.id}?view=achievement`} className="group block">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-gray-900 group-hover:text-[#1865F2]">
                          {c.name}
                          {c.academyLabel && <span className="ml-1 text-xs text-gray-400">{c.academyLabel}</span>}
                        </span>
                        <span className="shrink-0 tabular-nums font-semibold text-gray-900">{percent}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden>
                        <div className="h-full rounded-full bg-[#1865F2]" style={{ width: `${percent}%` }} />
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">
                        학생 {c.studentCount}명 · 배정 {c.assignedCount}개
                      </p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* 공통 취약 포인트 */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <AlertTriangle className="h-4 w-4 text-[#D92916]" aria-hidden />
            학원 공통 취약 포인트
          </p>
          {data.weakTop.length === 0 ? (
            <p className="text-sm text-gray-500">취약 판정을 받은 포인트가 없어요.</p>
          ) : (
            <ol className="space-y-2">
              {data.weakTop.map((w, i) => (
                <li key={w.pointId} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FDECEA] text-xs font-bold text-[#B42318]">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-900">{w.title}</span>
                    <span className="text-xs text-gray-400">{w.code}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[#B42318]">{w.students}명</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </CardShell>
  )
}
