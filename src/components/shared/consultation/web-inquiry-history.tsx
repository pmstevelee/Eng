import { Globe } from 'lucide-react'
import { LEAD_ACTIVITY_LABEL, formatKstDateTime } from '@/lib/consultation/constants'
import type { LeadDetail } from '@/lib/consultation/queries'
import { cn } from '@/lib/utils'

/** 문의 상세: 웹 상담신청 접수 내역 (신규 신청 + 재문의) */
export function WebInquiryHistory({
  activities,
  newSince,
}: {
  activities: LeadDetail['activities']
  /** 확인 전 웹 신청 접수 시각 — 이 시각 이후 항목에 '새 신청' 표시 */
  newSince: string | null
}) {
  if (activities.length === 0) return null

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-1.5">
        <Globe size={16} className="text-primary-700" />
        웹 상담신청 내역 <span className="text-gray-500 font-normal">{activities.length}건</span>
      </h2>
      <ol className="space-y-3">
        {activities.map((a) => {
          const isNew = newSince !== null && a.createdAt >= newSince
          const p = a.payload
          const rows: [string, string | undefined][] = [
            ['보호자', p.parentName],
            ['학생', [p.studentName, p.grade, p.school].filter(Boolean).join(' · ')],
            ['희망 일정', p.preferredSchedule],
            ['유입경로', p.source],
          ]
          return (
            <li
              key={a.id}
              className={cn('rounded-lg border p-3.5', isNew ? 'border-primary-700 bg-primary-100/40' : 'border-gray-200')}
            >
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="font-semibold text-gray-900">{LEAD_ACTIVITY_LABEL[a.type]}</span>
                {isNew && (
                  <span className="inline-flex items-center rounded-full bg-primary-700 text-white px-2 py-0.5 text-[11px] font-semibold">
                    새 신청
                  </span>
                )}
                <span className="text-xs text-gray-500 ml-auto tabular-nums">{formatKstDateTime(a.createdAt)}</span>
              </div>
              <dl className="mt-2 grid grid-cols-[72px_1fr] gap-x-2 gap-y-1 text-sm">
                {rows
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label} className="contents">
                      <dt className="text-gray-500">{label}</dt>
                      <dd className="text-gray-900 break-words">{value}</dd>
                    </div>
                  ))}
              </dl>
              {p.message && (
                <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap break-words">
                  {p.message}
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
