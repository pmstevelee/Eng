'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Download, FileText, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import type { PaymentType, PaymentStatus } from '@/generated/prisma'

const TYPE_LABELS: Record<PaymentType, string> = {
  SUBSCRIPTION: '구독 결제',
  OVERAGE_AI_WRITING: 'AI 쓰기 초과',
  OVERAGE_AI_QUESTION: 'AI 문제 초과',
  CREDIT_PACKAGE: '크레딧 충전',
  ANNUAL: '연간 구독',
  STUDENT_OVERAGE: '학생 초과',
  STORAGE_OVERAGE: '스토리지 초과',
}

const TYPE_COLORS: Record<PaymentType, string> = {
  SUBSCRIPTION: 'bg-blue-50 text-[#1865F2]',
  OVERAGE_AI_WRITING: 'bg-purple-50 text-[#7854F7]',
  OVERAGE_AI_QUESTION: 'bg-purple-50 text-[#7854F7]',
  CREDIT_PACKAGE: 'bg-purple-50 text-[#7854F7]',
  ANNUAL: 'bg-blue-50 text-[#1865F2]',
  STUDENT_OVERAGE: 'bg-orange-50 text-[#E35C20]',
  STORAGE_OVERAGE: 'bg-orange-50 text-[#E35C20]',
}

const STATUS_LABELS: Partial<Record<PaymentStatus, { label: string; color: string }>> = {
  PAID: { label: '완료', color: 'bg-green-50 text-[#1FAF54]' },
  PENDING: { label: '대기', color: 'bg-yellow-50 text-[#FFB100]' },
  FAILED: { label: '실패', color: 'bg-red-50 text-[#D92916]' },
  REFUNDED: { label: '환불', color: 'bg-gray-100 text-gray-500' },
  CANCELLED: { label: '취소', color: 'bg-gray-100 text-gray-500' },
  CANCELED: { label: '취소', color: 'bg-gray-100 text-gray-500' },
  PARTIAL_CANCELED: { label: '부분환불', color: 'bg-yellow-50 text-[#FFB100]' },
  EXPIRED: { label: '만료', color: 'bg-gray-100 text-gray-500' },
}

interface PaymentRow {
  id: string
  paymentId: string
  type: PaymentType
  amount: number
  status: PaymentStatus
  paidAt: string | null
  canceledAt: string | null
  receiptUrl: string | null
  failureReason: string | null
}

interface HistoryClientProps {
  payments: PaymentRow[]
  total: number
  page: number
  totalPages: number
  typeFilter: PaymentType | undefined
  academyId: string
}

const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: '전체', value: '' },
  { label: '구독', value: 'SUBSCRIPTION' },
  { label: '크레딧', value: 'CREDIT_PACKAGE' },
  { label: 'AI 초과', value: 'OVERAGE_AI_WRITING' },
]

export function HistoryClient({
  payments,
  total,
  page,
  totalPages,
  typeFilter,
  academyId,
}: HistoryClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [downloading, setDownloading] = useState(false)

  function buildUrl(newType?: string, newPage?: number) {
    const params = new URLSearchParams()
    const t = newType !== undefined ? newType : (typeFilter ?? '')
    if (t) params.set('type', t)
    const p = newPage ?? page
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `${pathname}${qs ? `?${qs}` : ''}`
  }

  async function handleCsvDownload() {
    setDownloading(true)
    try {
      // 전체 데이터 조회 (클라이언트에서 API로 직접 처리)
      const rows = [
        ['날짜', '항목', '금액(원)', '상태', '결제ID'].join(','),
        ...payments.map((p) =>
          [
            p.paidAt ? new Date(p.paidAt).toLocaleDateString('ko-KR') : '-',
            TYPE_LABELS[p.type] ?? p.type,
            p.amount,
            STATUS_LABELS[p.status]?.label ?? p.status,
            p.paymentId,
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
        ),
      ].join('\n')

      const blob = new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `결제내역_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 필터 + CSV 다운로드 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {FILTER_OPTIONS.map(({ label, value }) => (
            <Link
              key={value}
              href={buildUrl(value, 1)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                (typeFilter ?? '') === value
                  ? 'bg-[#1865F2] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <button
          onClick={handleCsvDownload}
          disabled={downloading || payments.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          CSV 다운로드
        </button>
      </div>

      {/* 결제 내역 테이블 */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {payments.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-400">결제 내역이 없습니다.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  날짜
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  항목
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  금액
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  상태
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  영수증
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map((payment) => {
                const statusInfo = STATUS_LABELS[payment.status]
                const date = payment.paidAt
                  ? new Date(payment.paidAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })
                  : '-'

                return (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3.5 text-gray-600">{date}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[payment.type]}`}
                      >
                        {TYPE_LABELS[payment.type] ?? payment.type}
                      </span>
                      {payment.failureReason && (
                        <p className="mt-0.5 text-xs text-[#D92916]">
                          {payment.failureReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gray-900">
                      {payment.amount.toLocaleString('ko-KR')}원
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {statusInfo ? (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{payment.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {payment.status === 'PAID' ||
                      payment.status === 'PARTIAL_CANCELED' ||
                      payment.status === 'REFUNDED' ? (
                        <a
                          href={`/api/billing/receipt/${payment.paymentId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#1865F2] hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          보기
                        </a>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Link
            href={buildUrl(undefined, page - 1)}
            className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              page <= 1
                ? 'pointer-events-none text-gray-300'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </Link>

          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>

          <Link
            href={buildUrl(undefined, page + 1)}
            className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              page >= totalPages
                ? 'pointer-events-none text-gray-300'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <p className="text-center text-xs text-gray-400">
        총 {total.toLocaleString()}건의 결제 내역
      </p>
    </div>
  )
}
