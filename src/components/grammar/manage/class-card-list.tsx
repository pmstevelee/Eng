// 문법학습 관리 첫 화면 — 반 카드 목록 (배정 단원 수, 반 평균 진도율, 마감 지난 미통과 학생 수)

import Link from 'next/link'
import { AlertCircle, ChevronRight, GraduationCap } from 'lucide-react'
import type { GrammarClassCard } from '@/lib/grammar/manage-queries'

export function ClassCardList({ classes, basePath }: { classes: GrammarClassCard[]; basePath: string }) {
  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
        <GraduationCap className="h-10 w-10 text-gray-300" aria-hidden />
        <p className="mt-3 font-medium text-gray-900">관리할 반이 없습니다</p>
        <p className="mt-1 text-sm text-gray-500">반이 만들어지고 담당 교사로 지정되면 여기에서 문법 진도를 배정할 수 있어요.</p>
      </div>
    )
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {classes.map((c) => (
        <li key={c.id}>
          <Link
            href={`${basePath}/classes/${c.id}`}
            className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-[#1865F2]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">{c.name}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {[c.academyLabel, c.teacherName ? `${c.teacherName} 선생님` : '담당 교사 없음', `학생 ${c.studentCount}명`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" aria-hidden />
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-gray-50 px-2 py-2">
                <dt className="text-xs text-gray-500">배정 단원</dt>
                <dd className="mt-0.5 text-lg font-semibold text-gray-900">{c.assignedCount}</dd>
              </div>
              <div className="rounded-lg bg-gray-50 px-2 py-2">
                <dt className="text-xs text-gray-500">평균 진도</dt>
                <dd className="mt-0.5 text-lg font-semibold text-gray-900">
                  {c.averagePercent === null ? '-' : `${c.averagePercent}%`}
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 px-2 py-2">
                <dt className="text-xs text-gray-500">마감 지남</dt>
                <dd className={`mt-0.5 text-lg font-semibold ${c.overdueStudents > 0 ? 'text-[#D92916]' : 'text-gray-900'}`}>
                  {c.overdueStudents}명
                </dd>
              </div>
            </dl>

            {c.averagePercent !== null && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
                <div className="h-full rounded-full bg-[#1865F2]" style={{ width: `${c.averagePercent}%` }} />
              </div>
            )}
            {c.assignedCount === 0 && (
              <p className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                아직 배정한 단원이 없어요 — 학생은 레벨에 맞는 본사 코스로 학습합니다
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
