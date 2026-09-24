import { BellRing } from 'lucide-react'
import { formatKstDateTime } from '@/lib/consultation/constants'
import type { LeadDetail } from '@/lib/consultation/queries'
import { TEMPLATE_LABEL, isTemplateKey } from '@/lib/notifications/templates'
import { StatusBadge } from './modal-shell'

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  SENT: { label: '발송', className: 'bg-accent-green-light text-[#16803D]' },
  FAILED: { label: '실패', className: 'bg-accent-red-light text-accent-red' },
  SKIPPED: { label: '미발송', className: 'bg-gray-100 text-gray-700' },
  PENDING: { label: '발송 중', className: 'bg-primary-100 text-primary-700' },
}

const CHANNEL_LABEL: Record<string, string> = { ALIMTALK: '알림톡', SMS: '문자', LMS: '장문 문자' }

/** 문의 상세: 학부모 알림 발송 이력 (최근 20건) */
export function NotificationHistory({ logs }: { logs: LeadDetail['notificationLogs'] }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
        <BellRing size={16} className="text-gray-500" />
        알림 발송 이력
      </h2>
      {logs.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-3">보낸 알림이 없습니다</p>
      ) : (
        <ul className="space-y-3">
          {logs.map((n) => {
            const badge = STATUS_BADGE[n.status] ?? STATUS_BADGE.PENDING
            return (
              <li key={n.id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900">
                    {isTemplateKey(n.templateKey) ? TEMPLATE_LABEL[n.templateKey] : n.templateKey}
                  </span>
                  <StatusBadge className={badge.className} label={badge.label} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatKstDateTime(n.sentAt ?? n.createdAt)} · {CHANNEL_LABEL[n.channel] ?? n.channel}
                </p>
                {n.errorMessage && n.status !== 'SENT' && (
                  <p className={n.status === 'FAILED' ? 'text-xs text-accent-red mt-0.5' : 'text-xs text-gray-500 mt-0.5'}>
                    {n.errorMessage}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
