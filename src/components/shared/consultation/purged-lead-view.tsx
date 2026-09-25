import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import {
  LEAD_CHANNEL_LABEL,
  LEAD_STATUS_BADGE,
  LEAD_STATUS_LABEL,
  LOST_REASON_LABEL,
  formatKstDate,
  type LeadChannelValue,
  type LeadStatusValue,
  type LostReasonValue,
} from '@/lib/consultation/constants'
import { PurgedBadge, StatusBadge } from './modal-shell'

export type PurgedLeadSummary = {
  status: LeadStatusValue
  channel: string
  source: string | null
  lostReason: string | null
  assigneeName: string | null
  createdAt: string
  purgedAt: string
}

/** 개인정보가 파기된 문의 — 상세 내용 대신 통계용 정보만 표시 */
export function PurgedLeadView({ basePath, lead }: { basePath: string; lead: PurgedLeadSummary }) {
  const rows: [string, React.ReactNode][] = [
    ['상태', <StatusBadge key="s" className={LEAD_STATUS_BADGE[lead.status]} label={LEAD_STATUS_LABEL[lead.status]} />],
    ['채널', LEAD_CHANNEL_LABEL[lead.channel as LeadChannelValue] ?? lead.channel],
    ['유입경로', lead.source ?? '-'],
    ['이탈 사유', lead.lostReason ? (LOST_REASON_LABEL[lead.lostReason as LostReasonValue] ?? lead.lostReason) : '-'],
    ['담당자', lead.assigneeName ?? '미배정'],
    ['문의일', formatKstDate(lead.createdAt)],
    ['파기일', formatKstDate(lead.purgedAt)],
  ]

  return (
    <div className="space-y-5">
      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 h-11 -mt-2">
        <ArrowLeft size={16} />
        상담 목록
      </Link>

      <section className="rounded-xl border border-gray-200 bg-white p-6 md:p-8 flex flex-col items-center text-center">
        <ShieldCheck size={32} className="text-gray-300" />
        <h1 className="mt-3 text-xl font-bold text-gray-900 flex items-center gap-2">
          파기된 문의 <PurgedBadge />
        </h1>
        <p className="mt-2 text-sm text-gray-500 max-w-md">
          개인정보 보관기간이 지나 이름·연락처·상담 기록 내용이 파기되어 상세 내용을 열람할 수 없습니다. 통계용 정보만
          남아 있습니다.
        </p>
        <dl className="mt-6 w-full max-w-sm grid grid-cols-[88px_1fr] gap-x-3 gap-y-2.5 text-sm text-left">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-gray-500">{label}</dt>
              <dd className="text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
