'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Download, Receipt } from 'lucide-react'
import { addMonths } from '@/lib/attendance/time'
import {
  CREDIT_ITEM_LABEL,
  CREDIT_TX_TYPE_LABEL,
  CREDIT_USAGE_FILTER_LABEL,
  NOTIFICATION_JOB_TYPE_LABEL,
  formatCredits,
  isAiCreditItem,
  matchesUsageFilter,
  type CreditUsageFilter,
  type CreditUsageRow,
} from '@/lib/credits/constants'
import { cn } from '@/lib/utils'

const DATETIME_FMT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function formatDateTime(iso: string): string {
  return DATETIME_FMT.format(new Date(iso))
}

/** 사용처 (알림 종류 또는 AI 기능) */
function kindLabel(row: CreditUsageRow): string {
  if (row.item && isAiCreditItem(row.item)) {
    return row.memo ? `${CREDIT_ITEM_LABEL[row.item]} · ${row.memo}` : CREDIT_ITEM_LABEL[row.item]
  }
  if (!row.jobType) return row.memo ?? ''
  const channel = row.item ? ` (${CREDIT_ITEM_LABEL[row.item]})` : ''
  return `${NOTIFICATION_JOB_TYPE_LABEL[row.jobType]}${channel}`
}

const FILTERS: CreditUsageFilter[] = ['ALL', 'AI', 'NOTIFICATION', 'CHARGE']

const TYPE_BADGE: Record<CreditUsageRow['type'], string> = {
  CHARGE: 'bg-green-50 text-accent-green',
  USE: 'bg-gray-100 text-gray-700',
  REFUND: 'bg-red-50 text-accent-red',
  ADMIN_ADJUST: 'bg-blue-50 text-primary-700',
}

type Props = { monthKey: string; rows: CreditUsageRow[]; truncated: boolean }

export function CreditUsageTable({ monthKey, rows, truncated }: Props) {
  const [y, m] = monthKey.split('-').map(Number)
  const monthHref = (key: string) => `/owner/credits?month=${key}#usage`
  const [filter, setFilter] = useState<CreditUsageFilter>('ALL')
  const visible = rows.filter((r) => matchesUsageFilter(r, filter))

  const downloadCsv = () => {
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const header = ['일시', '구분', '사용처', '학생명', '크레딧 증감', '잔액', '메모']
    const lines = [header.join(',')]
    for (const r of visible) {
      lines.push(
        [
          formatDateTime(r.createdAt),
          CREDIT_TX_TYPE_LABEL[r.type],
          r.jobType || r.item ? kindLabel(r) : '',
          r.studentName ?? '',
          String(r.amount),
          String(r.balanceAfter),
          r.memo ?? '',
        ]
          .map(escape)
          .join(','),
      )
    }
    // UTF-8 BOM — 엑셀에서 한글 깨짐 방지
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `크레딧_사용내역_${monthKey}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section id="usage" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">사용 내역</h2>
        <div className="flex items-center gap-2">
          <Link
            href={monthHref(addMonths(monthKey, -1))}
            aria-label="이전 달"
            className="h-11 w-11 rounded-xl border border-gray-200 bg-white inline-flex items-center justify-center hover:bg-gray-50"
          >
            <ChevronLeft size={18} />
          </Link>
          <span className="min-w-[6.5rem] text-center text-sm font-semibold text-gray-900">
            {y}년 {m}월
          </span>
          <Link
            href={monthHref(addMonths(monthKey, 1))}
            aria-label="다음 달"
            className="h-11 w-11 rounded-xl border border-gray-200 bg-white inline-flex items-center justify-center hover:bg-gray-50"
          >
            <ChevronRight size={18} />
          </Link>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={visible.length === 0}
            className="h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-900 inline-flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download size={16} /> CSV
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="내역 분류" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'h-11 rounded-full border px-4 text-sm font-medium',
              filter === f
                ? 'border-primary-700 bg-primary-700 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            {CREDIT_USAGE_FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <Receipt size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {rows.length === 0 ? '이 달의 크레딧 내역이 없습니다.' : '선택한 분류의 내역이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
              <tr>
                <th className="px-4 py-3 text-left font-medium">일시</th>
                <th className="px-4 py-3 text-left font-medium">구분</th>
                <th className="px-4 py-3 text-left font-medium">사용처 · 메모</th>
                <th className="px-4 py-3 text-left font-medium">학생명</th>
                <th className="px-4 py-3 text-right font-medium">크레딧 증감</th>
                <th className="px-4 py-3 text-right font-medium">잔액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDateTime(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', TYPE_BADGE[r.type])}>
                      {CREDIT_TX_TYPE_LABEL[r.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{kindLabel(r) || '-'}</td>
                  <td className="px-4 py-3 text-gray-900">{r.studentName ?? '-'}</td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right font-semibold tabular-nums',
                      r.amount >= 0 ? 'text-accent-green' : 'text-gray-900',
                    )}
                  >
                    {r.amount > 0 ? '+' : ''}
                    {formatCredits(r.amount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{formatCredits(r.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {truncated && (
        <p className="text-xs text-gray-500">내역이 많아 최근 {formatCredits(rows.length)}건만 표시합니다.</p>
      )}
    </section>
  )
}
