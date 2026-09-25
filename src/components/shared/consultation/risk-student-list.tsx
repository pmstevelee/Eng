'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarClock, ChevronRight, RefreshCw, Settings, ShieldCheck, ShieldAlert } from 'lucide-react'
import { formatKstDate, formatKstDateTime } from '@/lib/consultation/constants'
import { recalculateRisk } from '@/lib/consultation/risk-actions'
import { RISK_CRITERION_LABEL, type RiskCriterionKey, type RiskSettings } from '@/lib/consultation/risk-constants'
import type { RiskListResult, RiskListItem } from '@/lib/consultation/risk-queries'
import { AppointmentFormDialog } from './appointment-form-dialog'
import { RiskBadge } from './risk-badge'
import { StudentConsultationFormDialog } from './student-consultation-form-dialog'

type Option = { id: string; name: string }

type Props = {
  data: RiskListResult
  isOwner: boolean
  studentBasePath: string
  counselorOptionsByAcademy: Record<string, Option[]>
  currentUserId: string
}

type Dialog = { kind: 'appointment' | 'consultation'; item: RiskListItem } | null

function criterionText(key: RiskCriterionKey, s: RiskSettings): string {
  if (key === 'INACTIVE') return `${s.inactiveDays}일 연속 미학습`
  if (key === 'STUDY_DROP') return `학습일수 ${s.studyDropPct}% 이상 감소`
  return `정답률 ${s.accuracyDropPp}%p 이상 하락`
}

/** 재원생 상담 탭 — 퇴원 위험군 (규칙 기반, 매일 계산) */
export function RiskStudentList({ data, isOwner, studentBasePath, counselorOptionsByAcademy, currentUserId }: Props) {
  const router = useRouter()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const multiAcademy = new Set(data.items.map((i) => i.academyLabel)).size > 1
  const detailHref = (id: string) =>
    isOwner ? `${studentBasePath}/${id}#consultation` : `${studentBasePath}/${id}?tab=consultation`

  const recalc = () => {
    setError('')
    startTransition(async () => {
      const res = await recalculateRisk()
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  const riskCount = data.items.filter((i) => i.level === 'RISK').length
  const watchCount = data.items.length - riskCount

  return (
    <section className="space-y-3" aria-labelledby="risk-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="risk-heading" className="text-base font-bold text-gray-900">
            퇴원 위험 학생
          </h2>
          <p className="text-sm text-gray-700 mt-0.5">
            위험 <span className="font-semibold text-accent-red">{riskCount}명</span> · 주의{' '}
            <span className="font-semibold text-[#9A6B00]">{watchCount}명</span>
            {data.lastCalculatedAt && (
              <span className="text-gray-500"> · {formatKstDateTime(data.lastCalculatedAt)} 기준</span>
            )}
          </p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <Link
              href="/owner/settings/consultation"
              className="h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5"
            >
              <Settings size={16} />
              기준 설정
            </Link>
            <button
              type="button"
              onClick={recalc}
              disabled={isPending}
              className="h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw size={16} className={isPending ? 'animate-spin' : undefined} />
              지금 다시 계산
            </button>
          </div>
        )}
      </div>

      {/* 적용 중인 기준 — 끈 기준, 데이터가 없어 판정하지 못한 기준을 함께 알린다 */}
      <ul className="flex flex-wrap gap-2 text-xs">
        {data.criteria.map((c) => {
          const noData = c.enabled && data.calculatedStudents > 0 && c.evaluable === 0
          return (
            <li
              key={c.key}
              className={
                !c.enabled
                  ? 'rounded-full border border-gray-200 px-2.5 py-1 text-gray-500 line-through'
                  : noData
                    ? 'rounded-full border border-accent-gold bg-accent-gold-light px-2.5 py-1 text-[#9A6B00]'
                    : 'rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-700'
              }
            >
              {criterionText(c.key, data.settings)}
              {!c.enabled && ' (사용 안 함)'}
              {noData && ' — 데이터 부족으로 판정 제외'}
            </li>
          )
        })}
      </ul>
      {data.criteria.some((c) => c.enabled && data.calculatedStudents > 0 && c.evaluable === 0) && (
        <p className="text-xs text-gray-500">
          판정 제외된 기준은 필요한 학습 기록(
          {data.criteria
            .filter((c) => c.enabled && c.evaluable === 0)
            .map((c) => RISK_CRITERION_LABEL[c.key])
            .join(', ')}
          )이 쌓이면 자동으로 적용됩니다.
        </p>
      )}

      {error && <p className="text-sm text-accent-red">{error}</p>}

      {data.calculatedStudents === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 px-4 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-3">
            <ShieldAlert size={22} className="text-primary-700" />
          </div>
          <p className="text-base font-semibold text-gray-900">아직 계산된 결과가 없습니다</p>
          <p className="text-sm text-gray-500 mt-1">매일 오전 10시에 재원생 학습 기록으로 자동 계산됩니다.</p>
          {isOwner && (
            <button
              type="button"
              onClick={recalc}
              disabled={isPending}
              className="mt-5 h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw size={16} className={isPending ? 'animate-spin' : undefined} />
              지금 계산
            </button>
          )}
        </div>
      ) : data.items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 px-4 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-accent-green-light flex items-center justify-center mb-3">
            <ShieldCheck size={22} className="text-accent-green" />
          </div>
          <p className="text-base font-semibold text-gray-900">퇴원 위험 신호가 있는 학생이 없습니다</p>
          <p className="text-sm text-gray-500 mt-1">재원생 {data.calculatedStudents}명 모두 기준에 해당하지 않습니다.</p>
        </div>
      ) : (
        <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-200">
          {data.items.map((item) => (
            <li key={item.studentId} className="px-4 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={detailHref(item.studentId)}
                    className="text-sm font-semibold text-gray-900 hover:text-primary-700 inline-flex items-center gap-0.5"
                  >
                    {item.name}
                    <ChevronRight size={14} className="text-gray-500" />
                  </Link>
                  {item.grade && <span className="text-xs text-gray-500">{item.grade}</span>}
                  <RiskBadge level={item.level} />
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {item.reasons.map((r) => (
                    <li key={r} className="text-sm text-gray-900 flex gap-1.5">
                      <span aria-hidden className="text-gray-500">
                        ·
                      </span>
                      {r}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-gray-500">
                  {multiAcademy && `${item.academyLabel} · `}
                  {item.className ?? '반 미배정'}
                  {isOwner && item.teacherName && ` (${item.teacherName})`}
                  {item.lastRetentionAt && ` · 마지막 퇴원방지 상담 ${formatKstDate(item.lastRetentionAt)}`}
                </p>
                {item.upcomingAppointment && (
                  <p className="mt-0.5 text-xs text-[#16803D]">
                    예약: {formatKstDateTime(item.upcomingAppointment.scheduledAt)}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setDialog({ kind: 'appointment', item })}
                  className="h-11 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5"
                >
                  <CalendarClock size={16} />
                  예약
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: 'consultation', item })}
                  className="h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 inline-flex items-center gap-1.5"
                >
                  <ShieldCheck size={16} />
                  퇴원방지 상담 등록
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {dialog?.kind === 'appointment' && (
        <AppointmentFormDialog
          studentId={dialog.item.studentId}
          studentName={dialog.item.name}
          counselorOptions={counselorOptionsByAcademy[dialog.item.academyId] ?? []}
          defaultCounselorId={currentUserId}
          notifyUnavailableReason={dialog.item.hasParentPhone ? undefined : '학부모 연락처가 없어 알림을 보낼 수 없습니다.'}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'consultation' && (
        <StudentConsultationFormDialog
          studentId={dialog.item.studentId}
          studentName={dialog.item.name}
          defaultType="RETENTION"
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  )
}
