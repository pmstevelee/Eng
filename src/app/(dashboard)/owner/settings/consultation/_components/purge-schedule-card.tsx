'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarPlus, ShieldCheck, Trash2 } from 'lucide-react'
import {
  LEAD_STATUS_BADGE,
  LEAD_STATUS_LABEL,
  PURGE_NOTICE_DAYS,
  formatKstDate,
  formatKstDateTime,
  formatRetention,
} from '@/lib/consultation/constants'
import type { PurgeSchedule, PurgeScheduleItem } from '@/lib/consultation/purge'
import { extendLeadRetention } from '@/lib/consultation/purge-actions'
import { StatusBadge } from '@/components/shared/consultation/modal-shell'
import { PurgeLeadDialog } from '@/components/shared/consultation/purge-lead-dialog'
import { cn } from '@/lib/utils'

function DueLabel({ item }: { item: PurgeScheduleItem }) {
  const overdue = item.daysLeft === 0
  return (
    <span className="whitespace-nowrap">
      {formatKstDate(item.purgeAt)}
      <span
        className={cn(
          'ml-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
          overdue ? 'bg-accent-red-light text-accent-red' : item.daysLeft <= 7 ? 'bg-accent-gold-light text-[#9A6B00]' : 'bg-gray-100 text-gray-700',
        )}
      >
        {overdue ? '다음 자동 파기' : `D-${item.daysLeft}`}
      </span>
    </span>
  )
}

/** 상담관리 설정: 30일 안에 파기될 문의 — 보관 연장 / 즉시 파기 */
export function PurgeScheduleCard({
  data,
  retentionMonths,
  showAcademy,
}: {
  data: PurgeSchedule
  retentionMonths: number
  showAcademy: boolean
}) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [purgeTarget, setPurgeTarget] = useState<PurgeScheduleItem | null>(null)
  const [, startTransition] = useTransition()

  function extend(item: PurgeScheduleItem) {
    setMessage(null)
    setPendingId(item.id)
    startTransition(async () => {
      const res = await extendLeadRetention(item.id)
      setPendingId(null)
      if (res.error) setMessage({ ok: false, text: res.error })
      else {
        setMessage({ ok: true, text: `${item.studentName} 문의의 보관기간을 오늘부터 ${formatRetention(retentionMonths)} 연장했습니다.` })
        router.refresh()
      }
    })
  }

  const actions = (item: PurgeScheduleItem) => (
    <div className="flex gap-2 lg:justify-end">
      <button
        type="button"
        onClick={() => extend(item)}
        disabled={pendingId !== null}
        className="h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 inline-flex items-center gap-1.5 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
      >
        <CalendarPlus size={16} />
        {pendingId === item.id ? '연장 중…' : '보관 연장'}
      </button>
      <button
        type="button"
        onClick={() => setPurgeTarget(item)}
        disabled={pendingId !== null}
        className="h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-accent-red inline-flex items-center gap-1.5 hover:bg-accent-red-light disabled:opacity-50 whitespace-nowrap"
      >
        <Trash2 size={16} />
        즉시 파기
      </button>
    </div>
  )

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            파기 예정 <span className="text-gray-500 font-normal text-sm">{data.total}건</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {PURGE_NOTICE_DAYS}일 안에 개인정보가 자동 파기될 문의입니다. 계속 상담 중이라면 &lsquo;보관 연장&rsquo;으로 마지막
            활동일을 오늘로 바꿀 수 있습니다.
          </p>
        </div>
        <p className="text-xs text-gray-500">
          {data.lastRun
            ? `최근 자동 파기 ${formatKstDateTime(data.lastRun.at)} · ${data.lastRun.count}건`
            : '아직 자동 파기 기록이 없습니다.'}
        </p>
      </div>

      {message && (
        <p role="status" className={cn('mt-4 text-sm', message.ok ? 'text-accent-green' : 'text-accent-red')}>
          {message.text}
        </p>
      )}

      {data.items.length === 0 ? (
        <div className="mt-5 flex flex-col items-center text-center py-8">
          <ShieldCheck size={28} className="text-gray-300" />
          <p className="text-sm font-semibold text-gray-900 mt-2">{PURGE_NOTICE_DAYS}일 안에 파기될 문의가 없습니다</p>
          <p className="text-sm text-gray-500 mt-1">이탈·보류 문의는 마지막 활동 후 {formatRetention(retentionMonths)}이 지나면 파기됩니다.</p>
        </div>
      ) : (
        <>
          <ul className="mt-5 divide-y divide-gray-100 rounded-xl border border-gray-200">
            {data.items.map((item) => (
              <li key={item.id} className="flex flex-col lg:flex-row lg:items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/owner/consultations/${item.id}`} className="font-semibold text-gray-900 hover:text-primary-700">
                      {item.studentName}
                    </Link>
                    <StatusBadge className={LEAD_STATUS_BADGE[item.status]} label={LEAD_STATUS_LABEL[item.status]} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    마지막 활동 {formatKstDate(item.lastActivityAt)}
                    {` · 담당 ${item.assigneeName ?? '미배정'}`}
                    {showAcademy && ` · ${item.academyLabel}`}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    파기 예정 <DueLabel item={item} />
                  </p>
                </div>
                <div className="shrink-0">{actions(item)}</div>
              </li>
            ))}
          </ul>
          {data.total > data.items.length && (
            <p className="text-xs text-gray-500 mt-2">파기일이 가까운 순으로 {data.items.length}건까지 표시합니다.</p>
          )}
        </>
      )}

      {purgeTarget && (
        <PurgeLeadDialog
          leadId={purgeTarget.id}
          studentName={purgeTarget.studentName}
          onClose={() => setPurgeTarget(null)}
          onDone={() => {
            setMessage({ ok: true, text: `${purgeTarget.studentName} 문의의 개인정보를 파기했습니다.` })
            setPurgeTarget(null)
            router.refresh()
          }}
        />
      )}
    </section>
  )
}
