'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  CalendarClock,
  CalendarPlus,
  GraduationCap,
  History,
  NotebookPen,
  Pencil,
  Phone,
  Trash2,
  UserCheck,
} from 'lucide-react'
import { assignLead, deleteConsultation, deleteLead } from '@/lib/consultation/actions'
import { cancelAppointment, markAppointmentNoShow } from '@/lib/consultation/appointment-actions'
import {
  APPOINTMENT_STATUS_BADGE,
  APPOINTMENT_STATUS_LABEL,
  CONSULTATION_TYPE_LABEL,
  LEAD_CHANNEL_LABEL,
  LEAD_STATUS_BADGE,
  LEAD_STATUS_LABEL,
  LOST_REASON_LABEL,
  formatKstDate,
  formatKstDateTime,
  formatPhone,
  type ConsultationTypeValue,
  type LeadChannelValue,
  type LeadStatusValue,
  type LostReasonValue,
} from '@/lib/consultation/constants'
import type { LeadDetail } from '@/lib/consultation/queries'
import { AppointmentFormDialog } from './appointment-form-dialog'
import { ConsultationFormDialog, type ConsultationFormInitial } from './consultation-form-dialog'
import { ConvertToStudentDialog } from './convert-to-student-dialog'
import { FollowUpSection } from './follow-up-section'
import { NotificationHistory } from './notification-history'
import { LeadFormDialog } from './lead-form-dialog'
import { StatusBadge } from './modal-shell'
import { StatusChangeDialog } from './status-change-dialog'

type Option = { id: string; name: string }

type Props = {
  basePath: string
  currentUserId: string
  studentBasePath: string
  isOwner: boolean
  showAcademy: boolean
  lead: LeadDetail
  assigneeOptions: Option[]
  classOptions: Option[]
}

type Dialog =
  | { kind: 'edit' }
  | { kind: 'status' }
  | { kind: 'consultation'; initial?: ConsultationFormInitial; appointment?: { id: string; scheduledAt: string } }
  | { kind: 'appointment'; reschedule?: LeadDetail['appointments'][number] }
  | { kind: 'convert' }
  | null

export function LeadDetailClient({
  basePath,
  currentUserId,
  studentBasePath,
  isOwner,
  showAcademy,
  lead,
  assigneeOptions,
  classOptions,
}: Props) {
  const router = useRouter()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState('')

  const status = lead.status as LeadStatusValue
  const enrolled = status === 'ENROLLED' || !!lead.studentId

  const handleDelete = () => {
    if (!confirm(`'${lead.studentName}' 문의와 모든 상담 기록을 삭제합니다. 삭제 후에는 복구할 수 없습니다.`)) return
    startTransition(async () => {
      const result = await deleteLead(lead.id)
      if (result.error) {
        setActionError(result.error)
        return
      }
      router.push(basePath)
    })
  }

  const handleAssign = (assigneeId: string) => {
    setActionError('')
    startTransition(async () => {
      const result = await assignLead(lead.id, assigneeId || null)
      if (result.error) setActionError(result.error)
      else router.refresh()
    })
  }

  const runAppointmentAction = (action: () => Promise<{ error?: string }>) => {
    setActionError('')
    startTransition(async () => {
      const result = await action()
      if (result.error) setActionError(result.error)
      else router.refresh()
    })
  }

  const handleCancelAppointment = (id: string) => {
    if (!confirm('이 상담 예약을 취소할까요?')) return
    runAppointmentAction(() => cancelAppointment(id))
  }

  const handleNoShow = (id: string) => {
    if (!confirm('노쇼로 처리할까요? 노쇼 횟수는 문의 상세에 표시됩니다.')) return
    runAppointmentAction(() => markAppointmentNoShow(id))
  }

  const handleDeleteConsultation = (id: string) => {
    if (!confirm('이 상담 기록을 삭제할까요?')) return
    startTransition(async () => {
      const result = await deleteConsultation(id)
      if (result.error) setActionError(result.error)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div>
        <Link
          href={basePath}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 h-11 -mt-2"
        >
          <ArrowLeft size={16} />
          상담 목록
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{lead.studentName}</h1>
          <div className="flex flex-wrap gap-2">
            {!enrolled && (
              <ActionButton icon={GraduationCap} label="학생으로 등록" primary onClick={() => setDialog({ kind: 'convert' })} />
            )}
            {!enrolled && (
              <ActionButton icon={CalendarPlus} label="상담 예약" onClick={() => setDialog({ kind: 'appointment' })} />
            )}
            <ActionButton icon={Pencil} label="정보 수정" onClick={() => setDialog({ kind: 'edit' })} />
            {isOwner && <ActionButton icon={Trash2} label="삭제" danger onClick={handleDelete} disabled={isPending} />}
          </div>
        </div>
      </div>


      {actionError && (
        <p className="text-sm text-accent-red bg-accent-red-light px-3 py-2 rounded-lg">{actionError}</p>
      )}

      {lead.siblings.length > 0 && (
        <div className="rounded-xl border border-accent-gold bg-accent-gold-light px-4 py-3 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
          <AlertTriangle size={16} className="text-accent-gold" />
          <span className="text-gray-900">같은 연락처의 다른 문의:</span>
          {lead.siblings.map((s) => (
            <Link key={s.id} href={`${basePath}/${s.id}`} className="text-primary-700 hover:underline">
              {s.studentName} ({LEAD_STATUS_LABEL[s.status as LeadStatusValue]})
            </Link>
          ))}
        </div>
      )}

      {enrolled && lead.student && (
        <div className="rounded-xl border border-accent-green bg-accent-green-light px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
          <span className="text-gray-900 flex items-center gap-1.5">
            <UserCheck size={16} className="text-accent-green" />
            학생 계정으로 등록되었습니다 · {lead.student.user.email}
          </span>
          <Link href={`${studentBasePath}/${lead.student.id}`} className="font-medium text-primary-700 hover:underline">
            학생 정보 보기
          </Link>
        </div>
      )}


      {/* 상단: 기본 정보 · 현재 상태 · 담당자 */}
      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 border-b border-gray-200">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">현재 상태</p>
            <div className="flex items-center gap-2 min-h-11">
              <StatusBadge className={LEAD_STATUS_BADGE[status]} label={LEAD_STATUS_LABEL[status]} />
              {lead.noShowCount > 0 && (
                <StatusBadge className="bg-accent-red-light text-accent-red" label={`노쇼 ${lead.noShowCount}회`} />
              )}
              {!enrolled && (
                <button
                  type="button"
                  onClick={() => setDialog({ kind: 'status' })}
                  className="h-11 px-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5"
                >
                  <ArrowRightLeft size={14} />
                  상태 변경
                </button>
              )}
            </div>
            {status === 'LOST' && lead.lostReason && (
              <p className="text-sm mt-1.5">
                <span className="text-accent-red font-medium">
                  이탈 사유: {LOST_REASON_LABEL[lead.lostReason as LostReasonValue]}
                </span>
                {lead.lostReasonNote && (
                  <span className="block text-gray-700 whitespace-pre-wrap">{lead.lostReasonNote}</span>
                )}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="lead-assignee" className="block text-xs font-medium text-gray-500 mb-1.5">
              담당자
            </label>
            {isOwner ? (
              <select
                id="lead-assignee"
                value={lead.assigneeId ?? ''}
                onChange={(e) => handleAssign(e.target.value)}
                disabled={isPending}
                className="h-11 w-full sm:max-w-xs px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700"
              >
                <option value="">미배정</option>
                {assigneeOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="min-h-11 flex items-center text-sm text-gray-900">{lead.assignee?.name ?? '미배정'}</p>
            )}
          </div>
        </div>

        <div className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">기본 정보</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <InfoRow label="학부모">{lead.parentName ?? '-'}</InfoRow>
            <InfoRow label="연락처">
              <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-primary-700 hover:underline tabular-nums">
                <Phone size={13} />
                {formatPhone(lead.phone)}
              </a>
            </InfoRow>
            <InfoRow label="학년·학교">{[lead.grade, lead.school].filter(Boolean).join(' · ') || '-'}</InfoRow>
            <InfoRow label="희망 일정">{lead.preferredSchedule ?? '-'}</InfoRow>
            <InfoRow label="문의 채널">{LEAD_CHANNEL_LABEL[lead.channel as LeadChannelValue]}</InfoRow>
            <InfoRow label="유입 경로">{lead.source ?? '-'}</InfoRow>
            {showAcademy && <InfoRow label="소속">{lead.academyLabel}</InfoRow>}
            <InfoRow label="개인정보 동의">
              {lead.privacyConsentAt ? formatKstDateTime(lead.privacyConsentAt) : <span className="text-accent-red">미확인</span>}
            </InfoRow>
            <InfoRow label="문의 등록일">{formatKstDate(lead.createdAt)}</InfoRow>
          </dl>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* 본문: 상담 기록 타임라인 (최신순) */}
        <section className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              상담 기록 <span className="text-gray-500 font-normal">{lead.consultations.length}건</span>
            </h2>
            {lead.consultations.length > 0 && (
              <ActionButton icon={NotebookPen} label="상담 기록 추가" primary onClick={() => setDialog({ kind: 'consultation' })} />
            )}
          </div>
          {lead.consultations.length === 0 ? (
            <div className="py-10 flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center mb-2">
                <NotebookPen size={20} className="text-primary-700" />
              </div>
              <p className="text-sm font-medium text-gray-900">아직 상담 기록이 없습니다</p>
              <p className="text-xs text-gray-500 mt-1">상담 내용을 기록하면 담당 교사가 맥락을 이어받을 수 있습니다.</p>
              <button
                type="button"
                onClick={() => setDialog({ kind: 'consultation' })}
                className="mt-4 h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800"
              >
                첫 상담 기록하기
              </button>
            </div>
          ) : (
            <ol className="relative border-l-2 border-gray-100 ml-2 space-y-5">
              {lead.consultations.map((c) => (
                <li key={c.id} className="pl-5 relative">
                  <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-primary-700 ring-4 ring-white" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{formatKstDateTime(c.consultedAt)}</span>
                      <span className="text-xs rounded-full bg-gray-100 text-gray-700 px-2 py-0.5">
                        {CONSULTATION_TYPE_LABEL[c.type as ConsultationTypeValue]}
                      </span>
                      <span className="text-xs text-gray-500">{c.counselor?.name ?? '(삭제된 사용자)'}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setDialog({
                            kind: 'consultation',
                            initial: { ...c, type: c.type as ConsultationTypeValue },
                          })
                        }
                        className="h-9 px-2.5 rounded-lg text-xs text-gray-700 hover:bg-gray-100"
                      >
                        수정
                      </button>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleDeleteConsultation(c.id)}
                          disabled={isPending}
                          className="h-9 px-2.5 rounded-lg text-xs text-accent-red hover:bg-accent-red-light"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                  <dl className="mt-2 space-y-2 text-sm">
                    <RecordRow label="영어 학습 이력" value={c.learningHistory} />
                    <RecordRow label="타 학원 경험" value={c.prevAcademy} />
                    <RecordRow label="목표" value={c.goal} />
                    <RecordRow label="학부모 요구사항" value={c.parentNeeds} />
                    <RecordRow label="메모" value={c.memo} />
                  </dl>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="space-y-5 lg:sticky lg:top-4">
        {/* 사이드: 상담 예약 */}
        <AppointmentSection
          appointments={lead.appointments}
          enrolled={enrolled}
          pending={isPending}
          onCreate={() => setDialog({ kind: 'appointment' })}
          onComplete={(a) => setDialog({ kind: 'consultation', appointment: { id: a.id, scheduledAt: a.scheduledAt } })}
          onReschedule={(a) => setDialog({ kind: 'appointment', reschedule: a })}
          onCancel={handleCancelAppointment}
          onNoShow={handleNoShow}
        />

        {/* 사이드: 팔로업 할 일 */}
        <FollowUpSection
          leadId={lead.id}
          tasks={lead.followUpTasks}
          isOwner={isOwner}
          currentUserId={currentUserId}
          assigneeOptions={assigneeOptions}
          defaultAssigneeId={lead.assigneeId ?? assigneeOptions[0]?.id ?? null}
        />

        {/* 사이드: 알림 발송 이력 */}
        <NotificationHistory logs={lead.notificationLogs} />

        {/* 사이드: 상태 변경 이력 */}
        <aside className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <History size={16} className="text-gray-500" />
            상태 변경 이력
          </h2>
          <ol className="space-y-3 text-sm">
            {lead.statusHistory.map((h) => (
              <li key={h.id} className="flex gap-2.5">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5">
                    {h.fromStatus && (
                      <>
                        <span className="text-gray-500">{LEAD_STATUS_LABEL[h.fromStatus as LeadStatusValue]}</span>
                        <span className="text-gray-300">→</span>
                      </>
                    )}
                    <span className="font-medium text-gray-900">{LEAD_STATUS_LABEL[h.toStatus as LeadStatusValue]}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {h.changedBy?.name ?? '(삭제된 사용자)'} · {formatKstDateTime(h.changedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
        </div>
      </div>

      {dialog?.kind === 'edit' && (
        <LeadFormDialog
          mode="edit"
          basePath={basePath}
          leadId={lead.id}
          onClose={() => setDialog(null)}
          initial={{
            studentName: lead.studentName,
            parentName: lead.parentName ?? '',
            phone: formatPhone(lead.phone),
            grade: lead.grade ?? '',
            school: lead.school ?? '',
            preferredSchedule: lead.preferredSchedule ?? '',
            channel: lead.channel as LeadChannelValue,
            source: lead.source ?? '',
          }}
        />
      )}
      {dialog?.kind === 'status' && (
        <StatusChangeDialog
          leadId={lead.id}
          currentStatus={status}
          currentLostReason={lead.lostReason as LostReasonValue | null}
          currentLostReasonNote={lead.lostReasonNote}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'consultation' && (
        <ConsultationFormDialog
          leadId={lead.id}
          hasConsultations={lead.consultations.length > 0}
          initial={dialog.initial}
          appointment={dialog.appointment}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'appointment' && (
        <AppointmentFormDialog
          leadId={lead.id}
          studentName={lead.studentName}
          reschedule={dialog.reschedule}
          counselorOptions={assigneeOptions}
          defaultCounselorId={lead.assigneeId ?? assigneeOptions[0]?.id ?? null}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'convert' && (
        <ConvertToStudentDialog
          leadId={lead.id}
          studentName={lead.studentName}
          defaultGrade={lead.grade}
          classOptions={classOptions}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  primary,
  danger,
  disabled,
}: {
  icon: typeof Pencil
  label: string
  onClick: () => void
  primary?: boolean
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? 'h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 inline-flex items-center gap-1.5 disabled:opacity-50'
          : danger
            ? 'h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-accent-red hover:bg-accent-red-light inline-flex items-center gap-1.5 disabled:opacity-50'
            : 'h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5 disabled:opacity-50'
      }
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 items-start">
      <dt className="text-gray-500 pt-0.5">{label}</dt>
      <dd className="text-gray-900 min-w-0 break-words">{children}</dd>
    </div>
  )
}

function RecordRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-gray-900 whitespace-pre-wrap">{value}</dd>
    </div>
  )
}

type AppointmentItem = LeadDetail['appointments'][number]

function AppointmentSection({
  appointments,
  enrolled,
  pending,
  onCreate,
  onComplete,
  onReschedule,
  onCancel,
  onNoShow,
}: {
  appointments: AppointmentItem[]
  enrolled: boolean
  pending: boolean
  onCreate: () => void
  onComplete: (a: AppointmentItem) => void
  onReschedule: (a: AppointmentItem) => void
  onCancel: (id: string) => void
  onNoShow: (id: string) => void
}) {
  // 예정 일정은 가까운 순으로 위에, 지난/처리된 일정은 최신순으로 아래에
  const upcoming = appointments
    .filter((a) => a.status === 'SCHEDULED')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const past = appointments.filter((a) => a.status !== 'SCHEDULED')
  const now = Date.now()

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
          <CalendarClock size={16} className="text-gray-500" />
          상담 예약
        </h2>
        {!enrolled && appointments.length > 0 && (
          <button
            type="button"
            onClick={onCreate}
            className="h-11 px-3 rounded-xl text-sm font-medium text-primary-700 hover:bg-primary-100 inline-flex items-center gap-1"
          >
            <CalendarPlus size={15} />
            추가
          </button>
        )}
      </div>

      {appointments.length === 0 ? (
        <div className="py-4 flex flex-col items-center text-center">
          <p className="text-sm text-gray-500">예약된 상담이 없습니다</p>
          {!enrolled && (
            <button
              type="button"
              onClick={onCreate}
              className="mt-3 h-11 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5"
            >
              <CalendarPlus size={15} />
              상담 예약하기
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((a) => {
            const started = new Date(a.scheduledAt).getTime() <= now
            return (
              <li key={a.id} className="rounded-xl border border-primary-100 bg-primary-100/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatKstDateTime(a.scheduledAt)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {a.durationMinutes}분 · {a.counselor?.name ?? '(삭제된 사용자)'}
                      {a.rescheduledFromId && ' · 일정 변경됨'}
                    </p>
                  </div>
                  <StatusBadge className={APPOINTMENT_STATUS_BADGE[a.status]} label={APPOINTMENT_STATUS_LABEL[a.status]} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => onComplete(a)}
                    disabled={pending}
                    className="col-span-2 h-11 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50"
                  >
                    상담 완료 · 기록 작성
                  </button>
                  <button
                    type="button"
                    onClick={() => onReschedule(a)}
                    disabled={pending}
                    className="h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    일정 변경
                  </button>
                  {started ? (
                    <button
                      type="button"
                      onClick={() => onNoShow(a.id)}
                      disabled={pending}
                      className="h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-accent-red hover:bg-accent-red-light disabled:opacity-50"
                    >
                      노쇼
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onCancel(a.id)}
                      disabled={pending}
                      className="h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      예약 취소
                    </button>
                  )}
                  {started && (
                    <button
                      type="button"
                      onClick={() => onCancel(a.id)}
                      disabled={pending}
                      className="col-span-2 h-11 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      예약 취소
                    </button>
                  )}
                </div>
              </li>
            )
          })}
          {past.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className={a.status === 'CANCELED' ? 'text-gray-500 line-through tabular-nums' : 'text-gray-900 tabular-nums'}>
                  {formatKstDateTime(a.scheduledAt)}
                </p>
                <p className="text-xs text-gray-500">{a.counselor?.name ?? '(삭제된 사용자)'}</p>
              </div>
              <StatusBadge className={APPOINTMENT_STATUS_BADGE[a.status]} label={APPOINTMENT_STATUS_LABEL[a.status]} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
