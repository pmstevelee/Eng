'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ClipboardCheck, Copy, ExternalLink, FileText, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createPlacementInvite, sendPlacementResult } from '@/lib/consultation/placement-actions'
import { formatKstDate, formatKstDateTime } from '@/lib/consultation/constants'
import type { LeadDetail } from '@/lib/consultation/queries'
import {
  INVITE_STATUS_BADGE,
  INVITE_STATUS_LABEL,
  PLACEMENT_DOMAIN_COLOR,
  PLACEMENT_DOMAIN_LABEL,
  levelHeadline,
} from '@/lib/placement/display'
import { ModalShell, StatusBadge } from './modal-shell'

type Props = {
  leadId: string
  studentName: string
  enrolled: boolean
  invite: LeadDetail['placementInvite']
  result: LeadDetail['placementResult']
  resultSent: boolean
}

function inviteUrl(token: string) {
  return `${window.location.origin}/placement/invite/${token}`
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** 문의 상세: 레벨테스트 발송·진행 상태·결과 요약 (상담 참고용) */
export function PlacementSection({ leadId, studentName, enrolled, invite, result, resultSent }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)

  const activeInvite = invite && (invite.status === 'SENT' || invite.status === 'STARTED') ? invite : null

  const handleCopy = async (token: string) => {
    const ok = await copyText(inviteUrl(token))
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      setError('클립보드 복사에 실패했습니다. 링크를 직접 선택해 복사해주세요.')
    }
  }

  const handleSendResult = () => {
    if (!confirm(`${studentName} 학생 학부모님께 결과 리포트 링크를 보낼까요?`)) return
    setError('')
    setNotice('')
    startTransition(async () => {
      const res = await sendPlacementResult(leadId)
      if (res.error) setError(res.error)
      else {
        setNotice(res.status === 'SKIPPED' ? '발송 기록을 남겼습니다. (log 모드라 실제 발송은 되지 않았습니다)' : '결과 리포트를 발송했습니다.')
        router.refresh()
      }
    })
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
          <ClipboardCheck size={16} className="text-accent-purple" />
          레벨테스트
          {invite && (
            <StatusBadge className={INVITE_STATUS_BADGE[invite.status]} label={INVITE_STATUS_LABEL[invite.status]} />
          )}
        </h2>
        {!enrolled && (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className={cn(
              'h-11 px-4 rounded-xl text-sm font-medium inline-flex items-center gap-1.5',
              invite
                ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                : 'bg-primary-700 text-white hover:bg-primary-800',
            )}
          >
            <Send size={15} />
            {invite ? '새 링크 보내기' : '레벨테스트 보내기'}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-accent-red bg-accent-red-light px-3 py-2 rounded-lg">{error}</p>}
      {notice && <p className="text-sm text-[#16803D] bg-accent-green-light px-3 py-2 rounded-lg">{notice}</p>}

      {activeInvite && (
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
          <span className="text-gray-700">
            응시 링크 마감 <span className="font-medium text-gray-900">{formatKstDate(activeInvite.expiresAt)}</span>
            <span className="text-gray-500"> · {formatKstDateTime(activeInvite.createdAt)} 발급</span>
          </span>
          <button
            type="button"
            onClick={() => handleCopy(activeInvite.token)}
            className="h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5"
          >
            {copied ? <Check size={15} className="text-accent-green" /> : <Copy size={15} />}
            {copied ? '복사됨' : '링크 복사'}
          </button>
        </div>
      )}

      {result ? (
        <PlacementResultCard result={result} resultSent={resultSent} pending={isPending} onSend={handleSendResult} />
      ) : (
        !activeInvite && (
          <p className="text-sm text-gray-500">
            {invite?.status === 'EXPIRED'
              ? '응시 링크가 만료되었습니다. 새 링크를 보내주세요.'
              : '학부모에게 응시 링크를 보내면 로그인 없이 레벨테스트를 볼 수 있습니다. 결과는 상담 전 이곳에서 먼저 확인할 수 있습니다.'}
          </p>
        )
      )}

      {dialogOpen && (
        <InviteDialog
          leadId={leadId}
          studentName={studentName}
          hasActiveInvite={!!activeInvite}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </section>
  )
}

function PlacementResultCard({
  result,
  resultSent,
  pending,
  onSend,
}: {
  result: NonNullable<LeadDetail['placementResult']>
  resultSent: boolean
  pending: boolean
  onSend: () => void
}) {
  const headline = levelHeadline(result.overallLevel)
  const resultOpen = !!result.resultToken && (!result.resultExpiresAt || new Date(result.resultExpiresAt).getTime() > Date.now())

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500">{formatKstDateTime(result.completedAt)} 응시</p>
          <p className="text-xl font-bold text-gray-900">{headline.title}</p>
          <p className="text-sm text-accent-purple font-medium">CEFR {headline.cefr}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {result.domains.map((d) => (
          <li key={d.domain} className="grid grid-cols-[40px_1fr_56px] items-center gap-2 text-sm">
            <span className="text-gray-700">{PLACEMENT_DOMAIN_LABEL[d.domain]}</span>
            <span className="h-2 rounded-full bg-gray-100 overflow-hidden">
              {d.level !== null && (
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${d.level * 10}%`, backgroundColor: PLACEMENT_DOMAIN_COLOR[d.domain] }}
                />
              )}
            </span>
            <span className="text-right tabular-nums text-gray-900">{d.level !== null ? `Lv ${d.level}` : '미측정'}</span>
          </li>
        ))}
      </ul>

      {(result.weakestDomain || result.imbalanceWarning) && (
        <div className="rounded-xl bg-accent-gold-light px-4 py-3 text-sm text-gray-900 space-y-1">
          <p className="font-medium">상담 참고</p>
          {result.strongestDomain && (
            <p>강점: {PLACEMENT_DOMAIN_LABEL[result.strongestDomain]}</p>
          )}
          {result.weakestDomain && (
            <p>약점: {PLACEMENT_DOMAIN_LABEL[result.weakestDomain]} — 보완 학습 계획을 안내하세요.</p>
          )}
          {result.imbalanceWarning && <p>영역 간 편차가 큽니다 (종합보다 3단계 이상 낮은 영역 있음).</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {resultOpen && result.resultToken && (
          <a
            href={`/placement/result/${result.resultToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5"
          >
            <FileText size={15} />
            학부모용 결과 보기
            <ExternalLink size={13} className="text-gray-500" />
          </a>
        )}
        {resultOpen && (
          <button
            type="button"
            onClick={onSend}
            disabled={pending || resultSent}
            className="h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Send size={15} />
            {resultSent ? '결과 리포트 발송됨' : '결과 리포트 발송'}
          </button>
        )}
        {!resultOpen && <p className="text-xs text-gray-500">학부모용 결과 페이지 공개 기간(30일)이 지났습니다.</p>}
      </div>
    </div>
  )
}

function InviteDialog({
  leadId,
  studentName,
  hasActiveInvite,
  onClose,
}: {
  leadId: string
  studentName: string
  hasActiveInvite: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ url: string; notified: boolean; notice: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const create = (notify: boolean) => {
    setError('')
    startTransition(async () => {
      const res = await createPlacementInvite(leadId, { notify })
      if (res.error || !res.token) {
        setError(res.error ?? '링크를 만들지 못했습니다.')
        return
      }
      const url = inviteUrl(res.token)
      setCreated({ url, notified: notify, notice: res.notifyError ?? '' })
      if (!notify) {
        const ok = await copyText(url)
        setCopied(ok)
      }
      router.refresh()
    })
  }

  return (
    <ModalShell title="레벨테스트 보내기" icon={Send} onClose={onClose}>
      <div className="px-5 sm:px-6 py-5 space-y-4">
        {!created ? (
          <>
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">{studentName}</span> 학생이 로그인 없이 응시할 수 있는 링크를
              만듭니다. 링크는 7일 동안 유효하며 한 번만 응시할 수 있습니다.
            </p>
            {hasActiveInvite && (
              <p className="text-xs text-[#9A6B00] bg-accent-gold-light px-3 py-2 rounded-lg">
                아직 응시하지 않은 기존 링크는 새 링크를 만들면 만료됩니다.
              </p>
            )}
            {error && <p className="text-sm text-accent-red bg-accent-red-light px-3 py-2 rounded-lg">{error}</p>}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => create(true)}
                disabled={isPending}
                className="w-full h-11 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50"
              >
                {isPending ? '처리 중...' : '학부모에게 알림톡으로 보내기'}
              </button>
              <button
                type="button"
                onClick={() => create(false)}
                disabled={isPending}
                className="w-full h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                링크만 만들기 (복사)
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-900 font-medium">
              {created.notified ? '응시 링크를 만들고 학부모 알림을 요청했습니다.' : '응시 링크를 만들었습니다.'}
            </p>
            {created.notice && (
              <p className="text-sm text-accent-red bg-accent-red-light px-3 py-2 rounded-lg">{created.notice}</p>
            )}
            <div className="flex gap-2">
              <input
                readOnly
                value={created.url}
                aria-label="응시 링크"
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-900"
              />
              <button
                type="button"
                onClick={async () => setCopied(await copyText(created.url))}
                className="h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5 shrink-0"
              >
                {copied ? <Check size={15} className="text-accent-green" /> : <Copy size={15} />}
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              닫기
            </button>
          </>
        )}
      </div>
    </ModalShell>
  )
}
