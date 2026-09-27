'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { setMonthlyCell } from '@/lib/attendance/record-actions'
import type { MonthlyCell, MonthlyColumn, MonthlySheet as MonthlySheetData } from '@/lib/attendance/queries'
import {
  ATTENDANCE_MODE_LABEL,
  ATTENDANCE_STATUS_META,
  attendanceRate,
  emptyCounts,
  SELECTABLE_STATUSES,
  type AttendanceStatusValue,
} from '@/lib/attendance/constants'
import { addMonths, dayOfWeekOf } from '@/lib/attendance/time'
import { cn } from '@/lib/utils'
import { useToastMessage } from './use-toast-message'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const LEGEND: AttendanceStatusValue[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'EARLY_LEAVE', 'MAKEUP']

type Student = MonthlySheetData['students'][number]

function columnLabel(col: MonthlyColumn, multiPerDay: boolean): string {
  const [, m, d] = col.dateKey.split('-').map(Number)
  const base = `${m}/${d}(${WEEKDAY[dayOfWeekOf(col.dateKey)]})`
  return multiPerDay ? `${base} ${col.startTime}` : base
}

/** 퇴원일 이후 수업은 출석부에서 제외 */
function isAfterWithdrawal(student: Student, col: MonthlyColumn): boolean {
  return !!student.withdrawnDateKey && col.dateKey > student.withdrawnDateKey
}

function studentRate(student: Student, columns: MonthlyColumn[], cells: Record<string, MonthlyCell>, today: string) {
  const counts = emptyCounts()
  let total = 0
  for (const col of columns) {
    if (col.dateKey > today || isAfterWithdrawal(student, col)) continue
    total++
    counts[cells[`${student.id}|${col.key}`]?.status ?? 'UNCHECKED']++
  }
  return attendanceRate(counts, total)
}

export function MonthlySheet({ sheet, basePath }: { sheet: MonthlySheetData; basePath: string }) {
  const router = useRouter()
  const toast = useToastMessage()
  const [cells, setCells] = useState(sheet.cells)
  const [popover, setPopover] = useState<{ student: Student; col: MonthlyColumn; x: number; y: number } | null>(null)

  useEffect(() => setCells(sheet.cells), [sheet.cells])

  const href = (params: { classId?: string | null; month?: string }) => {
    const sp = new URLSearchParams()
    const classId = params.classId ?? sheet.classId
    if (classId) sp.set('class', classId)
    sp.set('month', params.month ?? sheet.monthKey)
    return `${basePath}/monthly?${sp.toString()}`
  }

  const multiPerDay = useMemo(() => {
    const seen = new Set<string>()
    for (const c of sheet.columns) {
      if (seen.has(c.dateKey)) return true
      seen.add(c.dateKey)
    }
    return false
  }, [sheet.columns])

  const [year, month] = sheet.monthKey.split('-').map(Number)

  const openCell = (e: React.MouseEvent<HTMLButtonElement>, student: Student, col: MonthlyColumn) => {
    if (col.dateKey < sheet.today && !sheet.canEditPast) {
      toast.show('지난 날짜의 출결은 학원장만 수정할 수 있습니다.')
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const width = 176
    const x = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8)
    const y = rect.bottom + 320 > window.innerHeight ? Math.max(8, rect.top - 312) : rect.bottom + 4
    setPopover({ student, col, x, y })
  }

  const choose = async (status: AttendanceStatusValue) => {
    if (!popover || !sheet.classId) return
    const { student, col } = popover
    setPopover(null)
    const key = `${student.id}|${col.key}`
    const before = cells[key]
    setCells((prev) => ({ ...prev, [key]: { status, reason: before?.reason ?? null } }))
    const res = await setMonthlyCell({
      classId: sheet.classId,
      studentId: student.id,
      dateKey: col.dateKey,
      startTime: col.startTime,
      endTime: col.endTime,
      sessionId: col.sessionId,
      status,
    })
    if (res.error) {
      setCells((prev) => {
        const next = { ...prev }
        if (before) next[key] = before
        else delete next[key]
        return next
      })
      toast.show(res.error)
    }
  }

  const downloadCsv = () => {
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const header = ['이름', ...sheet.columns.map((c) => columnLabel(c, multiPerDay)), '출석률']
    const lines = [header.map(escape).join(',')]
    for (const st of sheet.students) {
      const row = [st.name]
      for (const col of sheet.columns) {
        if (isAfterWithdrawal(st, col)) {
          row.push('-')
          continue
        }
        const cell = cells[`${st.id}|${col.key}`]
        row.push(cell && cell.status !== 'UNCHECKED' ? ATTENDANCE_STATUS_META[cell.status].label : '')
      }
      const rate = studentRate(st, sheet.columns, cells, sheet.today)
      row.push(rate === null ? '' : `${rate}%`)
      lines.push(row.map(escape).join(','))
    }
    // UTF-8 BOM — 엑셀에서 한글 깨짐 방지
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `출석부_${sheet.className ?? ''}_${sheet.monthKey}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">월간 출석부</h1>
          <p className="text-sm text-gray-500 mt-1">
            반의 수업일별 출결과 학생별 출석률을 확인합니다. · {ATTENDANCE_MODE_LABEL[sheet.mode].title}
          </p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={!sheet.classId || sheet.students.length === 0}
          className="h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-900 inline-flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download size={16} /> CSV 다운로드
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={sheet.classId ?? ''}
          onChange={(e) => router.push(href({ classId: e.target.value }))}
          aria-label="반 선택"
          disabled={sheet.classes.length === 0}
          className="h-11 min-w-[10rem] px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700"
        >
          {sheet.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <Link
            href={href({ month: addMonths(sheet.monthKey, -1) })}
            aria-label="이전 달"
            className="w-11 h-11 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            <ChevronLeft size={20} />
          </Link>
          <div className="h-11 px-4 inline-flex items-center rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-900 tabular-nums">
            {year}년 {month}월
          </div>
          <Link
            href={href({ month: addMonths(sheet.monthKey, 1) })}
            aria-label="다음 달"
            className="w-11 h-11 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            <ChevronRight size={20} />
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
        {LEGEND.map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span style={{ color: ATTENDANCE_STATUS_META[s].color }} aria-hidden>
              {ATTENDANCE_STATUS_META[s].symbol}
            </span>
            {ATTENDANCE_STATUS_META[s].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-full border border-gray-300" aria-hidden />
          미체크
        </span>
      </div>

      {!sheet.classId ? (
        <Empty title="담당 반이 없습니다" description="반이 배정되면 월간 출석부를 확인할 수 있습니다." />
      ) : sheet.columns.length === 0 ? (
        <Empty
          title="이 달에는 수업일이 없습니다"
          description="반 상세 화면의 시간표 탭에서 요일별 수업 시간을 등록해주세요."
        />
      ) : sheet.students.length === 0 ? (
        <Empty title="이 반에 학생이 없습니다" description="학생 관리에서 학생의 반을 지정해주세요." />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-medium min-w-[7rem] border-b border-gray-200">
                  학생
                </th>
                {sheet.columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-1 py-3 font-medium text-xs whitespace-nowrap border-b border-gray-200 min-w-[2.75rem]',
                      col.dateKey === sheet.today && 'text-primary-700 bg-primary-100',
                    )}
                  >
                    {columnLabel(col, multiPerDay)}
                  </th>
                ))}
                <th className="sticky right-0 z-10 bg-gray-50 px-4 py-3 font-medium whitespace-nowrap border-b border-l border-gray-200">
                  출석률
                </th>
              </tr>
            </thead>
            <tbody>
              {sheet.students.map((st) => {
                const rate = studentRate(st, sheet.columns, cells, sheet.today)
                return (
                  <tr key={st.id}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-semibold text-gray-900 whitespace-nowrap border-b border-gray-100"
                    >
                      {st.name}
                      {st.withdrawnDateKey && <span className="ml-1 text-xs font-medium text-gray-500">퇴원</span>}
                    </th>
                    {sheet.columns.map((col) => {
                      const cell = cells[`${st.id}|${col.key}`]
                      const status = cell?.status ?? 'UNCHECKED'
                      const future = col.dateKey > sheet.today
                      if (isAfterWithdrawal(st, col)) {
                        return (
                          <td key={col.key} className="text-center text-gray-300 border-b border-gray-100">
                            -
                          </td>
                        )
                      }
                      return (
                        <td
                          key={col.key}
                          className={cn('p-0 text-center border-b border-gray-100', col.dateKey === sheet.today && 'bg-primary-50')}
                        >
                          <button
                            type="button"
                            onClick={(e) => openCell(e, st, col)}
                            title={cell?.reason ?? ATTENDANCE_STATUS_META[status].label}
                            aria-label={`${st.name} ${columnLabel(col, multiPerDay)} ${ATTENDANCE_STATUS_META[status].label}`}
                            className="w-11 h-11 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 text-base"
                          >
                            {status === 'UNCHECKED' ? (
                              future ? (
                                <span className="text-gray-300">·</span>
                              ) : (
                                <span className="w-3.5 h-3.5 rounded-full border border-gray-300" aria-hidden />
                              )
                            ) : (
                              <span style={{ color: ATTENDANCE_STATUS_META[status].color }} aria-hidden>
                                {ATTENDANCE_STATUS_META[status].symbol}
                              </span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                    <td className="sticky right-0 z-10 bg-white px-4 py-2 text-center font-bold text-gray-900 tabular-nums border-b border-l border-gray-100">
                      {rate === null ? '-' : `${rate}%`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500">
        출석률 = (출석 + 지각 + 보강) ÷ (오늘까지의 수업일 − 인정결석). 미체크는 출석하지 않은 것으로 계산합니다.
        {!sheet.canEditPast && ' 지난 날짜는 학원장만 수정할 수 있습니다.'}
      </p>

      {popover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPopover(null)} />
          <div
            role="menu"
            aria-label={`${popover.student.name} 출결 변경`}
            className="fixed z-50 w-44 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm"
            style={{ left: popover.x, top: popover.y }}
          >
            <p className="px-2.5 py-1.5 text-xs text-gray-500 truncate">
              {popover.student.name} · {columnLabel(popover.col, multiPerDay)}
            </p>
            {SELECTABLE_STATUSES.map((s) => {
              const current = (cells[`${popover.student.id}|${popover.col.key}`]?.status ?? 'UNCHECKED') === s
              return (
                <button
                  key={s}
                  type="button"
                  role="menuitem"
                  onClick={() => choose(s)}
                  className={cn(
                    'w-full h-10 px-2.5 rounded-lg flex items-center gap-2 text-sm text-gray-900 hover:bg-gray-50',
                    current && 'bg-gray-100 font-semibold',
                  )}
                >
                  <span className="w-4 text-center" style={{ color: ATTENDANCE_STATUS_META[s].color }} aria-hidden>
                    {s === 'UNCHECKED' ? '○' : ATTENDANCE_STATUS_META[s].symbol}
                  </span>
                  {ATTENDANCE_STATUS_META[s].label}
                </button>
              )
            })}
          </div>
        </>
      )}
      {toast.node}
    </div>
  )
}

function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white py-14 px-6 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
        <CalendarDays size={24} className="text-primary-700" />
      </div>
      <p className="mt-4 text-base font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  )
}
