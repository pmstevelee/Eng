'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, UserPlus, Pencil } from 'lucide-react'
import { checkDuplicatePhone, createLead, updateLead, type DuplicateLead } from '@/lib/consultation/actions'
import {
  GRADE_OPTIONS,
  LEAD_CHANNEL_LABEL,
  LEAD_STATUS_LABEL,
  formatPhoneInput,
  isValidPhone,
  normalizePhone,
  type LeadChannelValue,
} from '@/lib/consultation/constants'
import { Field, FormActions, FormError, ModalShell, inputClass } from './modal-shell'

type Option = { id: string; name: string }

export type LeadFormValues = {
  studentName: string
  parentName: string
  phone: string
  grade: string
  school: string
  preferredSchedule: string
  channel: LeadChannelValue
  source: string
}

const EMPTY: LeadFormValues = {
  studentName: '',
  parentName: '',
  phone: '',
  grade: '',
  school: '',
  preferredSchedule: '',
  channel: 'PHONE',
  source: '',
}

type Props = {
  basePath: string
  onClose: () => void
} & (
  | {
      mode: 'create'
      academyOptions: Option[]
      defaultAcademyId?: string
      assigneeOptions: Option[]
    }
  | {
      mode: 'edit'
      leadId: string
      initial: LeadFormValues
    }
)

export function LeadFormDialog(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState<LeadFormValues>(props.mode === 'edit' ? props.initial : EMPTY)
  const [academyId, setAcademyId] = useState(props.mode === 'create' ? (props.defaultAcademyId ?? '') : '')
  const [assigneeId, setAssigneeId] = useState('')
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [duplicate, setDuplicate] = useState<{ total: number; visible: DuplicateLead[] } | null>(null)

  const set = <K extends keyof LeadFormValues>(key: K, value: LeadFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const [phoneTouched, setPhoneTouched] = useState(false)
  const phoneDigits = normalizePhone(form.phone)
  const phoneValid = isValidPhone(phoneDigits)
  const phoneError =
    phoneTouched && phoneDigits.length > 0 && !phoneValid ? '연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)' : ''
  const excludeLeadId = props.mode === 'edit' ? props.leadId : undefined

  // 번호가 완성되면(형식 유효) 같은 학원 내 중복 문의를 바로 확인
  useEffect(() => {
    if (!phoneValid) {
      setDuplicate(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const result = await checkDuplicatePhone(phoneDigits, academyId || undefined, excludeLeadId)
      if (cancelled || result.error || result.total === undefined) return
      setDuplicate(result.total > 0 ? { total: result.total, visible: result.visible ?? [] } : null)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [phoneDigits, phoneValid, academyId, excludeLeadId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!phoneValid) {
      setPhoneTouched(true)
      return
    }
    startTransition(async () => {
      if (props.mode === 'create') {
        const result = await createLead({
          ...form,
          privacyConsent,
          academyId: academyId || undefined,
          assigneeId: assigneeId || undefined,
        })
        if (result.error) {
          setError(result.error)
          return
        }
        props.onClose()
        if (result.leadId) router.push(`${props.basePath}/${result.leadId}`)
      } else {
        const result = await updateLead(props.leadId, form)
        if (result.error) {
          setError(result.error)
          return
        }
        props.onClose()
        router.refresh()
      }
    })
  }

  return (
    <ModalShell
      title={props.mode === 'create' ? '신규 문의 등록' : '문의 정보 수정'}
      icon={props.mode === 'create' ? UserPlus : Pencil}
      onClose={props.onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="학생 이름" required>
            <input
              className={inputClass}
              value={form.studentName}
              onChange={(e) => set('studentName', e.target.value)}
              placeholder="홍길동"
              maxLength={50}
              required
            />
          </Field>
          <Field label="학부모 이름">
            <input
              className={inputClass}
              value={form.parentName}
              onChange={(e) => set('parentName', e.target.value)}
              placeholder="홍부모"
              maxLength={50}
            />
          </Field>
          <Field label="학부모 연락처" required className="sm:col-span-2">
            <input
              className={phoneError ? `${inputClass} border-accent-red` : inputClass}
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => set('phone', formatPhoneInput(e.target.value))}
              onBlur={() => setPhoneTouched(true)}
              placeholder="010-1234-5678"
              maxLength={13}
              aria-invalid={!!phoneError}
              required
            />
            {phoneError && <p className="text-xs text-accent-red mt-1">{phoneError}</p>}
          </Field>
        </div>

        {duplicate && (
          <div className="rounded-xl border border-accent-gold bg-accent-gold-light px-4 py-3 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-gray-900">
              <AlertTriangle size={16} className="text-accent-gold" />
              같은 연락처로 등록된 문의가 {duplicate.total}건 있습니다.
            </p>
            {duplicate.visible.length > 0 && (
              <ul className="mt-2 space-y-1">
                {duplicate.visible.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`${props.basePath}/${d.id}`}
                      className="text-primary-700 hover:underline"
                      target="_blank"
                    >
                      {d.studentName} · {LEAD_STATUS_LABEL[d.status]} — 기존 문의 보기 ↗
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {duplicate.visible.length < duplicate.total && (
              <p className="mt-1.5 text-xs text-gray-700">
                다른 담당자의 문의 {duplicate.total - duplicate.visible.length}건은 학원장에게 확인하세요.
              </p>
            )}
            <p className="mt-1.5 text-xs text-gray-700">형제·자매 문의라면 그대로 등록해도 됩니다.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="학년">
            <select className={inputClass} value={form.grade} onChange={(e) => set('grade', e.target.value)}>
              <option value="">미선택</option>
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="학교">
            <input
              className={inputClass}
              value={form.school}
              onChange={(e) => set('school', e.target.value)}
              placeholder="OO초등학교"
              maxLength={100}
            />
          </Field>
        </div>

        <Field label="희망 요일/시간">
          <input
            className={inputClass}
            value={form.preferredSchedule}
            onChange={(e) => set('preferredSchedule', e.target.value)}
            placeholder="예: 월·수·금 오후 4시 이후"
            maxLength={200}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="문의 채널" required>
            <select
              className={inputClass}
              value={form.channel}
              onChange={(e) => set('channel', e.target.value as LeadChannelValue)}
            >
              {(Object.keys(LEAD_CHANNEL_LABEL) as LeadChannelValue[]).map((c) => (
                <option key={c} value={c}>
                  {LEAD_CHANNEL_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="유입 경로">
            <input
              className={inputClass}
              value={form.source}
              onChange={(e) => set('source', e.target.value)}
              placeholder="예: 지인 소개, 블로그"
              maxLength={100}
            />
          </Field>
        </div>

        {props.mode === 'create' && (props.academyOptions.length > 0 || props.assigneeOptions.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {props.academyOptions.length > 0 && (
              <Field label="소속 지점" required>
                <select
                  className={inputClass}
                  value={academyId}
                  onChange={(e) => {
                    setAcademyId(e.target.value)
                    setAssigneeId('')
                  }}
                  required
                >
                  {props.academyOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {props.assigneeOptions.length > 0 && (
              <Field
                label="담당자"
                hint={
                  academyId !== (props.defaultAcademyId ?? '')
                    ? '다른 지점의 담당자는 등록 후 상세 화면에서 배정하세요.'
                    : undefined
                }
              >
                <select
                  className={inputClass}
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={academyId !== (props.defaultAcademyId ?? '')}
                >
                  <option value="">미배정</option>
                  {props.assigneeOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        )}

        {props.mode === 'create' && (
          <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyConsent}
              onChange={(e) => setPrivacyConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 accent-primary-700"
            />
            <span className="text-sm text-gray-700">
              <span className="font-medium text-gray-900">
                학부모에게 개인정보 수집·이용 동의를 받았습니다. <span className="text-accent-red">*</span>
              </span>
              <br />
              <span className="text-xs text-gray-500">
                수집 항목: 학생·학부모 이름, 연락처, 학년, 학교 · 이용 목적: 상담 및 수강 안내
              </span>
            </span>
          </label>
        )}

        <FormError message={error} />
        <FormActions
          onCancel={props.onClose}
          pending={isPending}
          submitLabel={props.mode === 'create' ? '등록' : '저장'}
          pendingLabel="저장 중..."
        />
      </form>
    </ModalShell>
  )
}
