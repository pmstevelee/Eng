'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  NotebookPen,
  Pencil,
  Phone,
  RefreshCw,
  Send,
} from 'lucide-react'
import { cancelAppointment, markAppointmentNoShow } from '@/lib/consultation/appointment-actions'
import {
  ALL_CONSULTATION_TYPE_LABEL,
  APPOINTMENT_STATUS_BADGE,
  APPOINTMENT_STATUS_LABEL,
  CONSULTATION_TYPE_BADGE,
  formatKstDate,
  formatKstDateTime,
  formatPhone,
  formatPhoneInput,
  type StudentConsultationTypeValue,
} from '@/lib/consultation/constants'
import {
  deleteStudentConsultation,
  issueReportLink,
  sendStudentReport,
  updateParentPhone,
} from '@/lib/consultation/student-consultation-actions'
import type {
  StudentAppointmentItem,
  StudentConsultationData,
  StudentConsultationItem,
} from '@/lib/consultation/student-consultation-queries'
import { cn } from '@/lib/utils'
import { AppointmentFormDialog } from './appointment-form-dialog'
import { LearningSummaryView } from './learning-summary-view'
import { FormError, StatusBadge, inputClass } from './modal-shell'
import { StudentConsultationFormDialog, type StudentConsultationFormInitial } from './student-consultation-form-dialog'

type Option = { id: string; name: string }

type Props = {
  data: StudentConsultationData
  isOwner: boolean
  /** 문의 상세 경로 (/owner/consultations 등) */
  consultationBasePath: string
  /** 학원장만: 상담 담당자 선택지 */
  counselorOptions: Option[]
  currentUserId: string
}

type Dialog =
  | { kind: 'consultation'; initial?: StudentConsultationFormInitial; appointment?: { id: string; scheduledAt: string } }
  | { kind: 'appointment'; reschedule?: StudentAppointmentItem }
  | null

const NO_PHONE_REASON = '학부모 연락처가 없어 알림을 보낼 수 없습니다.'

/** 학생 상세 "상담" 영역 — 학부모 연락처, 예약, 상담 기록 타임라인(문의 시절 포함), 학부모 리포트 */
export function StudentConsultationSection({ data, isOwner, consultationBasePath, counselorOptions, currentUserId }: Props) {
  const router = useRouter()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [isPending, startTransition] = useTransition()
  const withdrawn = data.status === 'WITHDRAWN'

  const run = (fn: () => Promise<{ error?: string }>, confirmMessage?: string) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return
    startTransition(async () => {
      const res = await fn()
      if (res.error) alert(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <ParentPhoneCard studentId={data.studentId} phone={data.parentPhone} />

      {/* 상담 예약 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
            <CalendarClock size={16} className="text-gray-500" />
            예정된 상담
          </h3>
          <div className="flex gap-2">
            {!withdrawn && (
              <button
                type="button"
                onClick={() => setDialog({ kind: 'appointment' })}
                className="h-11 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5"
              >
                <CalendarClock size={16} />
                상담 예약
              </button>
            )}
            <button
              type="button"
              onClick={() => setDialog({ kind: 'consultation' })}
              className="h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 inline-flex items-center gap-1.5"
            >
              <NotebookPen size={16} />
              상담 기록 작성
            </button>
          </div>
        </div>
        {data.appointments.length === 0 ? (
          <p className="text-sm text-gray-500">예정된 상담이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {data.appointments.map((a) => {
              const past = new Date(a.scheduledAt).getTime() <= Date.now()
              return (
                <li key={a.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      {formatKstDateTime(a.scheduledAt)}
                      <StatusBadge className={APPOINTMENT_STATUS_BADGE[a.status]} label={APPOINTMENT_STATUS_LABEL[a.status]} />
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Clock size={11} />
                      {a.durationMinutes}분 · {a.counselorName ?? '(삭제된 사용자)'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <SmallButton
                      primary
                      onClick={() => setDialog({ kind: 'consultation', appointment: { id: a.id, scheduledAt: a.scheduledAt } })}
                    >
                      상담 완료
                    </SmallButton>
                    <SmallButton onClick={() => setDialog({ kind: 'appointment', reschedule: a })}>일정 변경</SmallButton>
                    <SmallButton disabled={isPending} onClick={() => run(() => cancelAppointment(a.id), '예약을 취소할까요?')}>
                      취소
                    </SmallButton>
                    {past && (
                      <SmallButton
                        danger
                        disabled={isPending}
                        onClick={() => run(() => markAppointmentNoShow(a.id), '노쇼로 처리할까요?')}
                      >
                        노쇼
                      </SmallButton>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* 상담 기록 타임라인 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          상담 기록 <span className="text-gray-500 font-normal">{data.items.length}건</span>
        </h3>
        {data.items.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-center">
            <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center mb-2">
              <NotebookPen size={20} className="text-primary-700" />
            </div>
            <p className="text-sm font-medium text-gray-900">아직 상담 기록이 없습니다</p>
            <p className="text-xs text-gray-500 mt-1">상담을 기록하면 당시 학습 요약이 함께 저장됩니다.</p>
            <button
              type="button"
              onClick={() => setDialog({ kind: 'consultation' })}
              className="mt-4 h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800"
            >
              첫 상담 기록하기
            </button>
          </div>
        ) : (
          <ol className="relative border-l-2 border-gray-100 ml-2 space-y-6">
            {data.items.map((c) => (
              <TimelineItem
                key={c.id}
                item={c}
                isOwner={isOwner}
                leadHref={c.source === 'LEAD' && data.leadId ? `${consultationBasePath}/${data.leadId}` : null}
                hasParentPhone={!!data.parentPhone}
                pending={isPending}
                onEdit={() =>
                  setDialog({
                    kind: 'consultation',
                    initial: {
                      id: c.id,
                      consultedAt: c.consultedAt,
                      type: c.type as StudentConsultationTypeValue,
                      goal: c.goal,
                      parentNeeds: c.parentNeeds,
                      memo: c.memo,
                      parentComment: c.parentComment,
                      snapshot: c.snapshot,
                    },
                  })
                }
                onDelete={() =>
                  run(
                    () => deleteStudentConsultation(c.id),
                    '상담 기록을 삭제할까요? 학부모 리포트 링크도 더 이상 열리지 않습니다.',
                  )
                }
              />
            ))}
          </ol>
        )}
      </section>

      {dialog?.kind === 'consultation' && (
        <StudentConsultationFormDialog
          studentId={data.studentId}
          studentName={data.studentName}
          initial={dialog.initial}
          appointment={dialog.appointment}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'appointment' && (
        <AppointmentFormDialog
          studentId={data.studentId}
          studentName={data.studentName}
          reschedule={dialog.reschedule}
          counselorOptions={counselorOptions}
          defaultCounselorId={dialog.reschedule?.counselorId ?? currentUserId}
          notifyUnavailableReason={data.parentPhone ? undefined : NO_PHONE_REASON}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

// ─── 학부모 연락처 ─────────────────────────────────────────────────────────────

function ParentPhoneCard({ studentId, phone }: { studentId: string; phone: string | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(phone ? formatPhone(phone) : '')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const save = () => {
    setError('')
    startTransition(async () => {
      const res = await updateParentPhone(studentId, value)
      if (res.error) setError(res.error)
      else {
        setEditing(false)
        router.refresh()
      }
    })
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Phone size={16} className="text-gray-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-900">학부모 연락처</span>
          {!editing && (
            <span className={cn('text-sm', phone ? 'text-gray-900 tabular-nums' : 'text-gray-500')}>
              {phone ? formatPhone(phone) : '미등록'}
            </span>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-11 px-3 rounded-xl text-sm text-gray-700 hover:bg-gray-100 inline-flex items-center gap-1"
          >
            <Pencil size={14} />
            {phone ? '수정' : '등록'}
          </button>
        )}
      </div>
      {!phone && !editing && (
        <p className="mt-1 text-xs text-gray-500">등록하면 상담 예약 알림과 학습 리포트를 학부모에게 보낼 수 있습니다.</p>
      )}
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          className="mt-3 space-y-2"
        >
          <div className="flex gap-2">
            <label htmlFor={`parent-phone-${studentId}`} className="sr-only">
              학부모 연락처
            </label>
            <input
              id={`parent-phone-${studentId}`}
              type="tel"
              inputMode="numeric"
              className={cn(inputClass, 'max-w-xs')}
              value={value}
              onChange={(e) => setValue(formatPhoneInput(e.target.value))}
              placeholder="010-1234-5678"
              autoFocus
            />
            <button
              type="submit"
              disabled={isPending}
              className="h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setValue(phone ? formatPhone(phone) : '')
                setError('')
              }}
              className="h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
          </div>
          <FormError message={error} />
        </form>
      )}
    </section>
  )
}

// ─── 타임라인 항목 ─────────────────────────────────────────────────────────────

function TimelineItem({
  item: c,
  isOwner,
  leadHref,
  hasParentPhone,
  pending,
  onEdit,
  onDelete,
}: {
  item: StudentConsultationItem
  isOwner: boolean
  leadHref: string | null
  hasParentPhone: boolean
  pending: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const isLead = c.source === 'LEAD'
  return (
    <li className="pl-5 relative">
      <span
        className={cn(
          'absolute -left-[7px] top-1.5 w-3 h-3 rounded-full ring-4 ring-white',
          isLead ? 'bg-gray-300' : 'bg-primary-700',
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{formatKstDateTime(c.consultedAt)}</span>
          {isLead && <StatusBadge className="bg-gray-100 text-gray-700" label="등록 전 상담" />}
          <StatusBadge className={CONSULTATION_TYPE_BADGE[c.type]} label={ALL_CONSULTATION_TYPE_LABEL[c.type]} />
          <span className="text-xs text-gray-500">{c.counselorName ?? '(삭제된 사용자)'}</span>
        </div>
        {isLead ? (
          leadHref && (
            <Link
              href={leadHref}
              className="h-9 px-2.5 rounded-lg text-xs text-primary-700 hover:bg-primary-100 inline-flex items-center gap-1"
            >
              문의 기록 보기
              <ExternalLink size={12} />
            </Link>
          )
        ) : (
          <div className="flex gap-1">
            <button type="button" onClick={onEdit} className="h-9 px-2.5 rounded-lg text-xs text-gray-700 hover:bg-gray-100">
              수정
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                className="h-9 px-2.5 rounded-lg text-xs text-accent-red hover:bg-accent-red-light"
              >
                삭제
              </button>
            )}
          </div>
        )}
      </div>

      <dl className="mt-2 space-y-2 text-sm">
        <RecordRow label="영어 학습 이력" value={c.learningHistory} />
        <RecordRow label="타 학원 경험" value={c.prevAcademy} />
        <RecordRow label="학부모 요청사항" value={c.parentNeeds} />
        <RecordRow label={isLead ? '목표' : '다음 목표'} value={c.goal} />
      </dl>

      {c.parentComment && (
        <div className="mt-3 rounded-lg bg-primary-100/50 px-3 py-2">
          <p className="text-xs font-semibold text-primary-700">학부모 공유용 코멘트</p>
          <p className="mt-0.5 text-sm text-gray-900 whitespace-pre-wrap">{c.parentComment}</p>
        </div>
      )}
      {c.memo && (
        <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <p className="text-xs font-semibold text-gray-500">{isLead ? '메모' : '교사 내부 메모 · 학부모 비공개'}</p>
          <p className="mt-0.5 text-sm text-gray-900 whitespace-pre-wrap">{c.memo}</p>
        </div>
      )}

      {c.snapshot && (
        <details className="mt-3 rounded-xl border border-gray-200">
          <summary className="min-h-11 px-3 flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
            <FileText size={14} className="text-gray-500" />
            상담 당시 학습 요약 ({formatKstDate(`${c.snapshot.period.from}T00:00:00+09:00`)} ~{' '}
            {formatKstDate(`${c.snapshot.period.to}T00:00:00+09:00`)})
          </summary>
          <div className="px-3 pb-3">
            <LearningSummaryView summary={c.snapshot} compact />
          </div>
        </details>
      )}

      {!isLead && (c.snapshot || c.parentComment) && (
        <ReportActions consultationId={c.id} report={c.report} reportSent={c.reportSent} hasParentPhone={hasParentPhone} />
      )}
    </li>
  )
}

function RecordRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-gray-900 whitespace-pre-wrap">{value}</dd>
    </div>
  )
}

// ─── 학부모 리포트 ─────────────────────────────────────────────────────────────

function ReportActions({
  consultationId,
  report,
  reportSent,
  hasParentPhone,
}: {
  consultationId: string
  report: StudentConsultationItem['report']
  reportSent: boolean
  hasParentPhone: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const valid = report && !report.expired

  /** 클립보드 복사 — 권한이 없거나 막힌 환경에서는 false (아래에 링크를 직접 보여준다) */
  const copy = async (url: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return true
    } catch {
      return false
    }
  }

  const issue = (renew: boolean) => {
    if (renew && !window.confirm('새 링크를 발급하면 기존 링크는 더 이상 열리지 않습니다. 재발급할까요?')) return
    setMessage(null)
    startTransition(async () => {
      const res = await issueReportLink(consultationId, renew)
      if (res.error || !res.url) return setMessage({ ok: false, text: res.error ?? '링크 발급에 실패했습니다.' })
      const copiedOk = await copy(res.url)
      setMessage({ ok: true, text: copiedOk ? '링크를 발급하고 복사했습니다.' : '링크를 발급했습니다.' })
      router.refresh()
    })
  }

  const send = () => {
    if (!window.confirm('학부모에게 학습 리포트 알림을 보낼까요?')) return
    setMessage(null)
    startTransition(async () => {
      const res = await sendStudentReport(consultationId)
      if (res.error) return setMessage({ ok: false, text: res.error })
      setMessage({
        ok: true,
        text: res.skipped ? '발송 기록을 남겼습니다. (테스트 모드: 실제 발송 안 함)' : '리포트를 발송했습니다.',
      })
      router.refresh()
    })
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-200 px-3 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-gray-900">학부모 리포트</span>
        {report ? (
          report.expired ? (
            <span className="text-accent-red">링크 만료됨</span>
          ) : (
            <span className="text-gray-500">{formatKstDate(report.expiresAt)}까지 열람 가능</span>
          )
        ) : (
          <span className="text-gray-500">링크 미발급</span>
        )}
        {reportSent && <StatusBadge className="bg-accent-green-light text-[#16803D]" label="발송함" />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {valid ? (
          <>
            <SmallButton
              onClick={async () => {
                if (!(await copy(report.url))) setMessage({ ok: false, text: '자동 복사가 안 되어 아래 링크를 직접 복사해주세요.' })
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? '복사됨' : '링크 복사'}
            </SmallButton>
            <a
              href={report.url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1"
            >
              <ExternalLink size={13} />
              미리보기
            </a>
            <SmallButton disabled={isPending} onClick={() => issue(true)}>
              <RefreshCw size={13} />
              링크 재발급
            </SmallButton>
          </>
        ) : (
          <SmallButton disabled={isPending} onClick={() => issue(!!report)}>
            <Copy size={13} />
            {report ? '링크 재발급' : '링크 만들기'}
          </SmallButton>
        )}
        <SmallButton primary disabled={isPending || !hasParentPhone} onClick={send}>
          <Send size={13} />
          리포트 발송
        </SmallButton>
      </div>
      {valid && (
        <input
          readOnly
          value={report.url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="리포트 링크"
          className="w-full h-9 px-2.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-700"
        />
      )}
      {!hasParentPhone && <p className="text-xs text-gray-500">{NO_PHONE_REASON}</p>}
      {message && (
        <p className={cn('text-xs', message.ok ? 'text-[#16803D]' : 'text-accent-red')}>{message.text}</p>
      )}
    </div>
  )
}

function SmallButton({
  children,
  onClick,
  disabled,
  primary,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1 disabled:opacity-50 transition-colors',
        primary
          ? 'bg-primary-700 text-white hover:bg-primary-800'
          : danger
            ? 'border border-gray-200 text-accent-red hover:bg-accent-red-light'
            : 'border border-gray-200 text-gray-700 hover:bg-gray-50',
      )}
    >
      {children}
    </button>
  )
}
