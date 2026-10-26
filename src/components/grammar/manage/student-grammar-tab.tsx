'use client'

// 교사 학생 상세 '문법' 탭 — 탭을 열 때 불러온다
// 포인트별 상태·최고 점수·시도 횟수(대분류별), 취약 포인트, 최근 확인 테스트 10건, 개인 배정 추가·삭제

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { AlertTriangle, BookOpen, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GRAMMAR_STATE_STYLE } from '@/lib/grammar/constants'
import { loadStudentGrammarDetail } from '@/lib/grammar/achievement-actions'
import type { StudentGrammarDetail } from '@/lib/grammar/achievement-queries'
import { assignGrammarToStudent, removeStudentAssignment } from '@/lib/grammar/manage-actions'
import type { GrammarMasteryState } from '@/generated/prisma'
import { cn } from '@/lib/utils'
import { AddPointsDialog } from './add-points-dialog'
import { formatDateKey } from './format'

type LoadState = { status: 'loading' } | { status: 'error'; error: string } | { status: 'done'; data: StudentGrammarDetail }
type Notice = { type: 'success' | 'error'; text: string } | null

function isoToDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(iso))
}

function StateBadge({ state }: { state: GrammarMasteryState }) {
  const s = GRAMMAR_STATE_STYLE[state]
  return (
    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

export function StudentGrammarTab({ studentId }: { studentId: string }) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [addOpen, setAddOpen] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    const res = await loadStudentGrammarDetail(studentId)
    setLoad(res.ok ? { status: 'done', data: res.data } : { status: 'error', error: res.error })
  }, [studentId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const data = load.status === 'done' ? load.data : null
  const assignedPointIds = useMemo(
    () => new Set(data ? data.groups.flatMap((g) => g.rows.filter((r) => r.assigned).map((r) => r.pointId)) : []),
    [data],
  )

  if (load.status === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-16 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> 문법 학습 기록을 불러오는 중
      </div>
    )
  }
  if (load.status === 'error' || !data) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white py-14 text-center">
        <p className="text-sm text-[#D92916]">{load.status === 'error' ? load.error : '기록을 불러오지 못했습니다.'}</p>
        <Button type="button" variant="outline" className="mt-3 min-h-[44px]" onClick={() => { setLoad({ status: 'loading' }); void refresh() }}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> 다시 시도
        </Button>
      </div>
    )
  }

  const onRemove = (a: StudentGrammarDetail['personalAssignments'][number]) => {
    if (!window.confirm(`'${a.title}' 개인 배정을 삭제할까요? 학생의 학습 기록은 그대로 남아요.`)) return
    setBusyId(a.id)
    setNotice(null)
    startTransition(async () => {
      const res = await removeStudentAssignment(a.id)
      if (!res.ok) setNotice({ type: 'error', text: res.error })
      else {
        setNotice({ type: 'success', text: `'${a.title}' 개인 배정을 삭제했어요.` })
        await refresh()
      }
      setBusyId(null)
    })
  }

  const { totals } = data

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">반 배정과 개인 배정, 학생이 스스로 공부한 단원이 모두 보여요.</p>
        <Button type="button" className="min-h-[44px]" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> 단원 추가 배정
        </Button>
      </div>

      {notice && (
        <p
          role="status"
          className={cn(
            'rounded-lg px-3 py-2.5 text-sm',
            notice.type === 'success' ? 'bg-[#E8F7EE] text-[#15803D]' : 'bg-[#FDECEA] text-[#D92916]',
          )}
        >
          {notice.text}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="배정 단원" value={totals.assigned} color="#1865F2" />
        <Stat label="통과" value={totals.passed} color="#15803D" />
        <Stat label="숙달" value={totals.mastered} color="#166534" />
        <Stat label="취약" value={totals.weak} color="#D92916" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 취약 포인트 */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="flex items-center gap-1.5 text-base font-semibold text-gray-900">
            <AlertTriangle className="h-4 w-4 text-[#D92916]" aria-hidden /> 취약 포인트
          </h3>
          {data.weak.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">취약 포인트가 없어요.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {data.weak.map((w) => (
                <li key={w.pointId} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900">{w.title}</span>
                    <span className="text-xs text-gray-400">
                      {w.code}
                      {w.lastActivityAt && ` · 마지막 학습 ${formatDateKey(isoToDateKey(w.lastActivityAt))}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">최고 {w.bestCheckScore ?? '-'}점</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 최근 확인 테스트 */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-base font-semibold text-gray-900">최근 확인 테스트</h3>
          {data.recentChecks.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">아직 확인 테스트를 본 적이 없어요.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {data.recentChecks.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-gray-900">{a.point?.title ?? '삭제된 포인트'}</span>
                    <span className="text-xs text-gray-400">{formatDateKey(isoToDateKey(a.createdAt))}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold text-gray-900">
                    {a.score}점
                    <span className="ml-1 text-xs font-normal text-gray-400">
                      {a.correctCount}/{a.totalCount}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 개인 배정 */}
      {data.personalAssignments.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-base font-semibold text-gray-900">개인 배정</h3>
          <ul className="mt-2 divide-y divide-gray-100">
            {data.personalAssignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="min-w-0">
                  <span className="truncate text-gray-900">{a.title}</span>
                  {a.dueKey && (
                    <span className={cn('ml-2 text-xs', a.dueKey < data.todayKey ? 'text-[#D92916]' : 'text-gray-400')}>
                      마감 {formatDateKey(a.dueKey)}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(a)}
                  disabled={busyId !== null}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-[#D92916] disabled:opacity-50"
                  aria-label={`${a.title} 개인 배정 삭제`}
                >
                  {busyId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 포인트별 표 */}
      {data.groups.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
          <BookOpen className="h-10 w-10 text-gray-300" aria-hidden />
          <p className="mt-3 font-medium text-gray-900">아직 문법 학습 기록이 없습니다</p>
          <p className="mt-1 max-w-md text-sm text-gray-500">단원을 배정하면 학생 문법 홈에 바로 나타나요.</p>
          <Button type="button" className="mt-4 min-h-[44px]" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> 단원 추가 배정
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {data.groups.map((g) => (
            <details key={g.id} open className="group overflow-hidden rounded-xl border border-gray-200 bg-white">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 hover:bg-gray-50">
                <span className="font-semibold text-gray-900">{g.name}</span>
                <span className="text-sm text-gray-500">
                  통과 {g.passedCount}/{g.rows.length}
                </span>
              </summary>
              <div className="overflow-x-auto border-t border-gray-100">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-sm uppercase text-gray-500">
                      <th className="px-4 py-2 font-medium">포인트</th>
                      <th className="px-3 py-2 font-medium">상태</th>
                      <th className="px-3 py-2 text-right font-medium">최고 점수</th>
                      <th className="px-3 py-2 text-right font-medium">시도</th>
                      <th className="px-4 py-2 font-medium">배정</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {g.rows.map((r) => (
                      <tr key={r.pointId}>
                        <td className="px-4 py-2">
                          <span className="block text-gray-900">{r.title}</span>
                          <span className="text-xs text-gray-400">{r.code}</span>
                        </td>
                        <td className="px-3 py-2">
                          <StateBadge state={r.state} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                          {r.bestCheckScore !== null ? `${r.bestCheckScore}점` : '-'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-600">{r.checkAttempts}회</td>
                        <td className="px-4 py-2 text-xs text-gray-500">
                          {r.assigned === 'CLASS' ? '반' : r.assigned === 'STUDENT' ? '개인' : '자율'}
                          {r.dueKey && (
                            <span className={cn('ml-1', r.dueKey < data.todayKey && r.state !== 'PASSED' && r.state !== 'MASTERED' && 'text-[#D92916]')}>
                              · {formatDateKey(r.dueKey)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}

      <AddPointsDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        tree={data.tree}
        assignedPointIds={assignedPointIds}
        title="단원 추가 배정"
        description="이 학생에게만 배정합니다. 반 배정과 함께 학생 문법 홈의 '이어서 학습'에 나와요."
        onAssign={(input) => assignGrammarToStudent(studentId, input)}
        onDone={(text) => {
          setNotice({ type: 'success', text })
          void refresh()
        }}
      />
    </div>
  )
}
