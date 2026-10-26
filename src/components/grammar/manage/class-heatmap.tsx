'use client'

// 반 성취도 히트맵 — 행 = 학생, 열 = 배정 포인트(배정 순서), 칸 = 상태 색 + 약어
// 맨 아래 행 포인트별 통과율, 오른쪽 열 학생별 진도율. 칸을 누르면 시도 기록 팝오버.

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, BarChart3, Loader2, X } from 'lucide-react'
import type { GrammarMasteryState } from '@/generated/prisma'
import { GRAMMAR_ATTEMPT_KIND_LABEL, GRAMMAR_STATE_STYLE } from '@/lib/grammar/constants'
import { cellOf, STUCK_PASS_RATE, summarizeHeatmap } from '@/lib/grammar/achievement-logic'
import { loadHeatmapCellAttempts } from '@/lib/grammar/achievement-actions'
import type { ClassAchievementData, GrammarAttemptItem } from '@/lib/grammar/achievement-queries'
import { cn } from '@/lib/utils'
import { formatDateKey } from './format'

const LEGEND_ORDER: GrammarMasteryState[] = ['NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'MASTERED', 'WEAK']

/** 진한 칸에는 흰 글자 */
const CELL_TEXT: Record<GrammarMasteryState, string> = {
  NOT_STARTED: '#6B7280',
  IN_PROGRESS: '#FFFFFF',
  PASSED: '#14532D',
  MASTERED: '#FFFFFF',
  WEAK: '#FFFFFF',
}

interface Popover {
  studentId: string
  studentName: string
  pointId: string
  pointTitle: string
  state: GrammarMasteryState
  bestCheckScore: number | null
  /** 화면 좌표 (fixed) */
  top: number
  left: number
}

type AttemptState = { status: 'loading' } | { status: 'error'; error: string } | { status: 'done'; rows: GrammarAttemptItem[] }

const POPOVER_WIDTH = 288

function formatIsoDate(iso: string): string {
  const d = new Date(iso)
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d)
  return formatDateKey(key)
}

export function ClassHeatmap({
  data,
  studentHrefBase,
  studentHrefQuery = '',
}: {
  data: ClassAchievementData
  /** 학생 상세 경로 앞부분 — /teacher/students 등 */
  studentHrefBase: string
  studentHrefQuery?: string
}) {
  const summary = useMemo(
    () =>
      summarizeHeatmap({
        studentIds: data.students.map((s) => s.id),
        pointIds: data.points.map((p) => p.id),
        progress: data.progress,
      }),
    [data],
  )
  const [popover, setPopover] = useState<Popover | null>(null)
  const [attempts, setAttempts] = useState<AttemptState>({ status: 'loading' })
  const requestRef = useRef(0)
  const popoverRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setPopover(null), [])

  useEffect(() => {
    if (!popover) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    // 표·페이지를 스크롤하면 칸과 팝오버 위치가 어긋나므로 닫는다 (팝오버 안 목록 스크롤은 제외)
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && popoverRef.current?.contains(e.target)) return
      close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [popover, close])

  const openCell = (e: React.MouseEvent<HTMLButtonElement>, student: { id: string; name: string }, point: { id: string; title: string }) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const cell = cellOf(summary, student.id, point.id)
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - POPOVER_WIDTH / 2), window.innerWidth - POPOVER_WIDTH - 8)
    const below = rect.bottom + 6
    const top = below + 260 > window.innerHeight ? Math.max(8, rect.top - 266) : below
    setPopover({
      studentId: student.id,
      studentName: student.name,
      pointId: point.id,
      pointTitle: point.title,
      state: cell.state,
      bestCheckScore: cell.bestCheckScore,
      top,
      left,
    })
    const req = ++requestRef.current
    setAttempts({ status: 'loading' })
    loadHeatmapCellAttempts(data.classId, student.id, point.id).then((res) => {
      if (req !== requestRef.current) return
      setAttempts(res.ok ? { status: 'done', rows: res.data } : { status: 'error', error: res.error })
    })
  }

  if (data.points.length === 0 || data.students.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
        <BarChart3 className="h-10 w-10 text-gray-300" aria-hidden />
        <p className="mt-3 font-medium text-gray-900">
          {data.points.length === 0 ? '아직 배정한 단원이 없습니다' : '이 반에 재원 중인 학생이 없습니다'}
        </p>
        <p className="mt-1 max-w-md text-sm text-gray-500">
          {data.points.length === 0
            ? "'배정' 탭에서 코스를 불러오거나 포인트를 추가하면 학생별 성취도가 여기에 표시됩니다."
            : '학생이 반에 들어오면 배정 단원별 성취도가 표시됩니다.'}
        </p>
      </div>
    )
  }

  const stuckCount = summary.stuckPointIds.size

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          학생 {data.students.length}명 · 배정 {data.points.length}개 단원 · 반 진도율{' '}
          <span className="font-semibold text-gray-900">{summary.classPercent ?? 0}%</span>
        </p>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600" aria-label="칸 색 설명">
          {LEGEND_ORDER.map((s) => (
            <li key={s} className="flex items-center gap-1">
              <span
                className="flex h-4 w-5 items-center justify-center rounded text-[10px] font-semibold"
                style={{ backgroundColor: GRAMMAR_STATE_STYLE[s].color, color: CELL_TEXT[s] }}
                aria-hidden
              >
                {GRAMMAR_STATE_STYLE[s].short}
              </span>
              {GRAMMAR_STATE_STYLE[s].label}
            </li>
          ))}
        </ul>
      </div>

      {stuckCount > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-[#FDECEA] px-3 py-2.5 text-sm text-[#B42318]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          반 전체가 막힌 포인트 {stuckCount}개 — 통과율 {STUCK_PASS_RATE}% 미만인 열을 빨간 제목으로 표시했어요. 수업에서 다시 다뤄 보세요.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 min-w-[112px] border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm font-medium uppercase text-gray-500"
              >
                학생
              </th>
              {data.points.map((p, i) => {
                const stuck = summary.stuckPointIds.has(p.id)
                return (
                  <th
                    key={p.id}
                    scope="col"
                    title={`${p.code} ${p.title}${p.dueKey ? ` · 마감 ${formatDateKey(p.dueKey)}` : ''}${stuck ? ' · 반 전체가 막힌 포인트' : ''}`}
                    className={cn(
                      'h-[72px] w-12 min-w-[48px] border-b border-gray-200 px-1 py-2 align-bottom text-xs font-medium',
                      stuck ? 'bg-[#FDECEA] text-[#B42318]' : 'bg-gray-50 text-gray-500',
                    )}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      {stuck && <AlertTriangle className="h-3.5 w-3.5" aria-label="반 전체가 막힌 포인트" />}
                      <span className="tabular-nums">{i + 1}</span>
                      <span className="line-clamp-2 w-11 break-keep text-center text-[11px] font-normal leading-tight">{p.title}</span>
                    </div>
                  </th>
                )
              })}
              <th
                scope="col"
                className="min-w-[72px] border-b border-l border-gray-200 bg-gray-50 px-3 py-2 text-right text-sm font-medium uppercase text-gray-500"
              >
                진도율
              </th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => {
              const percent = summary.studentPercent.get(s.id) ?? 0
              return (
                <tr key={s.id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-[140px] truncate border-b border-r border-gray-100 bg-white px-3 py-1 text-left font-medium text-gray-900"
                  >
                    <Link href={`${studentHrefBase}/${s.id}${studentHrefQuery}`} className="hover:text-[#1865F2] hover:underline">
                      {s.name}
                    </Link>
                  </th>
                  {data.points.map((p) => {
                    const cell = cellOf(summary, s.id, p.id)
                    const style = GRAMMAR_STATE_STYLE[cell.state]
                    const active = popover?.studentId === s.id && popover.pointId === p.id
                    return (
                      <td key={p.id} className="border-b border-gray-100 p-0.5">
                        <button
                          type="button"
                          onClick={(e) => (active ? close() : openCell(e, s, p))}
                          aria-label={`${s.name} · ${p.title}: ${style.label}${cell.bestCheckScore !== null ? `, 최고 ${cell.bestCheckScore}점` : ''}`}
                          className={cn(
                            'flex h-11 w-11 items-center justify-center rounded-md text-xs font-semibold transition-[box-shadow]',
                            active ? 'ring-2 ring-[#0C2340] ring-offset-1' : 'hover:ring-2 hover:ring-gray-300',
                          )}
                          style={{
                            backgroundColor: cell.state === 'NOT_STARTED' ? '#F3F4F6' : style.color,
                            color: CELL_TEXT[cell.state],
                          }}
                        >
                          {style.short}
                        </button>
                      </td>
                    )
                  })}
                  <td className="border-b border-l border-gray-100 px-3 py-1 text-right tabular-nums">
                    <span className={cn('font-semibold', percent >= 80 ? 'text-[#15803D]' : 'text-gray-900')}>{percent}%</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm font-medium text-gray-500"
              >
                통과율
              </th>
              {data.points.map((p) => {
                const rate = summary.pointPassRate.get(p.id) ?? 0
                const stuck = summary.stuckPointIds.has(p.id)
                return (
                  <td
                    key={p.id}
                    className={cn(
                      'px-0.5 py-2 text-center text-xs font-semibold tabular-nums',
                      stuck ? 'bg-[#FDECEA] text-[#B42318]' : 'bg-gray-50 text-gray-700',
                    )}
                  >
                    {rate}%
                  </td>
                )
              })}
              <td className="border-l border-gray-200 bg-gray-50 px-3 py-2 text-right text-xs font-semibold tabular-nums text-gray-900">
                {summary.classPercent ?? 0}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-gray-400">칸을 누르면 시도 기록을 볼 수 있어요. 학생 이름을 누르면 학생 상세로 이동합니다.</p>

      {popover && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={close} aria-hidden />
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={`${popover.studentName} · ${popover.pointTitle} 시도 기록`}
            className="fixed z-50 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
            style={{ top: popover.top, left: popover.left, width: POPOVER_WIDTH }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{popover.studentName}</p>
                <p className="truncate text-xs text-gray-500">{popover.pointTitle}</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span
                className="rounded-full px-2 py-0.5 font-semibold"
                style={{ backgroundColor: GRAMMAR_STATE_STYLE[popover.state].bg, color: GRAMMAR_STATE_STYLE[popover.state].text }}
              >
                {GRAMMAR_STATE_STYLE[popover.state].label}
              </span>
              {popover.bestCheckScore !== null && <span className="text-gray-500">확인 테스트 최고 {popover.bestCheckScore}점</span>}
            </div>
            <div className="mt-3 max-h-48 overflow-y-auto">
              {attempts.status === 'loading' && (
                <p className="flex items-center gap-1.5 py-3 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중
                </p>
              )}
              {attempts.status === 'error' && <p className="py-3 text-sm text-[#D92916]">{attempts.error}</p>}
              {attempts.status === 'done' &&
                (attempts.rows.length === 0 ? (
                  <p className="py-3 text-sm text-gray-500">아직 시도 기록이 없어요.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {attempts.rows.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                        <span className="text-gray-600">
                          {GRAMMAR_ATTEMPT_KIND_LABEL[a.kind]}
                          <span className="ml-1.5 text-xs text-gray-400">{formatIsoDate(a.createdAt)}</span>
                        </span>
                        <span className="tabular-nums font-semibold text-gray-900">
                          {a.score}점
                          <span className="ml-1 text-xs font-normal text-gray-400">
                            {a.correctCount}/{a.totalCount}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
