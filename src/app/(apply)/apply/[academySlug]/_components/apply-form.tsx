'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, ChevronDown, Loader2, Phone } from 'lucide-react'
import { submitWebInquiry } from '@/lib/consultation/web-inquiry-actions'
import {
  GRADE_OPTIONS,
  formatPhone,
  formatPhoneInput,
  formatRetention,
  isValidPhone,
  normalizePhone,
  type WebFormSettings,
} from '@/lib/consultation/constants'
import { cn } from '@/lib/utils'

type Props = {
  slug: string
  source: string
  academyName: string
  academyPhone: string | null
  intro: string
  fields: WebFormSettings['fields']
  retentionMonths: number
  formToken: string
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일']
const TIME_BANDS = ['오전', '오후', '저녁']

// iOS 확대 방지를 위해 입력 글자 크기는 16px(text-base) 유지
const inputClass =
  'w-full h-12 px-3.5 rounded-xl border border-gray-200 bg-white text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent'

function FieldLabel({ htmlFor, label, required }: { htmlFor?: string; label: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-gray-900 mb-1.5">
      {label}
      {required ? <span className="text-accent-red ml-0.5">*</span> : <span className="text-gray-500 font-normal ml-1">(선택)</span>}
    </label>
  )
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'h-11 min-w-11 px-3 rounded-full border text-sm font-medium transition-colors',
        selected ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-200 bg-white text-gray-700',
      )}
    >
      {children}
    </button>
  )
}

function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label className="flex items-start gap-3 min-h-11 py-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 accent-primary-700"
      />
      <span className="text-sm text-gray-900 leading-6">{children}</span>
    </label>
  )
}

export function ApplyForm({ slug, source, academyName, academyPhone, intro, fields, retentionMonths, formToken }: Props) {
  const [parentName, setParentName] = useState('')
  const [phone, setPhone] = useState('')
  const [studentName, setStudentName] = useState('')
  const [grade, setGrade] = useState('')
  const [school, setSchool] = useState('')
  const [days, setDays] = useState<string[]>([])
  const [times, setTimes] = useState<string[]>([])
  const [scheduleNote, setScheduleNote] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [guardianConfirm, setGuardianConfirm] = useState(false)
  const [showConsentDetail, setShowConsentDetail] = useState(true)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  const collectedItems = [
    '보호자 이름',
    '보호자 연락처',
    '학생 이름',
    ...(fields.grade ? ['학년'] : []),
    ...(fields.school ? ['학교'] : []),
    ...(fields.schedule ? ['희망 요일·시간'] : []),
    ...(fields.message ? ['문의 내용'] : []),
  ]

  function toggle(list: string[], value: string, order: string[]): string[] {
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    return order.filter((v) => next.includes(v))
  }

  function buildSchedule(): string {
    const parts = [days.join('·'), times.join('·'), scheduleNote.trim()].filter(Boolean)
    return parts.join(' / ')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!parentName.trim()) return setError('보호자 이름을 입력해주세요.')
    if (!isValidPhone(normalizePhone(phone))) return setError('보호자 연락처를 정확히 입력해주세요. (예: 010-1234-5678)')
    if (!studentName.trim()) return setError('학생 이름을 입력해주세요.')
    if (!privacyConsent) return setError('개인정보 수집·이용에 동의해주세요.')
    if (!guardianConfirm) return setError('보호자 확인에 체크해주세요.')

    startTransition(async () => {
      const result = await submitWebInquiry(slug, {
        formToken,
        website,
        parentName,
        phone,
        studentName,
        grade: fields.grade ? grade : undefined,
        school: fields.school ? school : undefined,
        preferredSchedule: fields.schedule ? buildSchedule() : undefined,
        message: fields.message ? message : undefined,
        source: source || undefined,
        privacyConsent,
        guardianConfirm,
      })
      if (result.ok) {
        setDone(true)
        window.scrollTo({ top: 0 })
      } else {
        setError(result.error)
      }
    })
  }

  if (done) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm font-semibold text-gray-500 mb-6">{academyName}</p>
        <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-accent-green-light text-accent-green">
          <CheckCircle2 size={28} />
        </div>
        <h1 className="text-xl font-bold text-gray-900">상담 신청이 접수되었습니다</h1>
        <p className="mt-2 text-sm text-gray-500 leading-6">
          담당 선생님이 확인 후 입력하신 연락처로
          <br />
          연락드리겠습니다. 감사합니다.
        </p>
        {academyPhone && (
          <a
            href={`tel:${normalizePhone(academyPhone)}`}
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-900"
          >
            <Phone size={16} className="text-primary-700" />
            학원 전화 {formatPhone(academyPhone)}
          </a>
        )}
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-16">
      <header className="mb-6">
        <p className="text-sm font-semibold text-primary-700">{academyName}</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">상담 신청</h1>
        <p className="mt-2 text-sm text-gray-500">
          <span className="inline-flex items-center rounded-full bg-primary-100 text-primary-700 px-2 py-0.5 text-xs font-semibold mr-1.5 align-middle">
            보호자 작성
          </span>
          학부모(보호자)님이 작성해주세요.
        </p>
        {intro && (
          <p className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 leading-6 whitespace-pre-line">
            {intro}
          </p>
        )}
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* honeypot — 화면·스크린리더에서 숨김 */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="apply-website">웹사이트</label>
          <input
            id="apply-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <h2 className="text-base font-bold text-gray-900">보호자 정보</h2>
          <div>
            <FieldLabel htmlFor="apply-parent" label="보호자 이름" required />
            <input
              id="apply-parent"
              className={inputClass}
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              maxLength={30}
              autoComplete="name"
              placeholder="홍길동"
            />
          </div>
          <div>
            <FieldLabel htmlFor="apply-phone" label="보호자 연락처" required />
            <input
              id="apply-phone"
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              inputMode="tel"
              type="tel"
              autoComplete="tel"
              placeholder="010-1234-5678"
            />
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <h2 className="text-base font-bold text-gray-900">학생 정보</h2>
          <div>
            <FieldLabel htmlFor="apply-student" label="학생 이름" required />
            <input
              id="apply-student"
              className={inputClass}
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              maxLength={30}
              autoComplete="off"
              placeholder="학생 이름"
            />
          </div>
          {fields.grade && (
            <div>
              <FieldLabel htmlFor="apply-grade" label="학년" />
              <div className="relative">
                <select
                  id="apply-grade"
                  className={cn(inputClass, 'appearance-none pr-10', !grade && 'text-gray-500')}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                >
                  <option value="">선택해주세요</option>
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
            </div>
          )}
          {fields.school && (
            <div>
              <FieldLabel htmlFor="apply-school" label="학교" />
              <input
                id="apply-school"
                className={inputClass}
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                maxLength={50}
                autoComplete="off"
                placeholder="예: 동탄초등학교"
              />
            </div>
          )}
        </section>

        {(fields.schedule || fields.message) && (
          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
            <h2 className="text-base font-bold text-gray-900">상담 희망 사항</h2>
            {fields.schedule && (
              <div>
                <FieldLabel label="희망 요일·시간" />
                <div className="flex flex-wrap gap-2" role="group" aria-label="희망 요일">
                  {DAYS.map((d) => (
                    <Chip key={d} selected={days.includes(d)} onClick={() => setDays((prev) => toggle(prev, d, DAYS))}>
                      {d}
                    </Chip>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="희망 시간대">
                  {TIME_BANDS.map((t) => (
                    <Chip key={t} selected={times.includes(t)} onClick={() => setTimes((prev) => toggle(prev, t, TIME_BANDS))}>
                      {t}
                    </Chip>
                  ))}
                </div>
                <input
                  aria-label="희망 시간 메모"
                  className={cn(inputClass, 'mt-2')}
                  value={scheduleNote}
                  onChange={(e) => setScheduleNote(e.target.value)}
                  maxLength={40}
                  placeholder="예: 4시 이후 가능"
                />
              </div>
            )}
            {fields.message && (
              <div>
                <FieldLabel htmlFor="apply-message" label="문의 내용" />
                <textarea
                  id="apply-message"
                  className={cn(inputClass, 'h-auto min-h-[112px] py-3 resize-y')}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={1000}
                  placeholder="궁금하신 점이나 학생의 영어 학습 상황을 자유롭게 적어주세요."
                />
              </div>
            )}
          </section>
        )}

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-gray-900">개인정보 수집·이용 동의</h2>
            <button
              type="button"
              onClick={() => setShowConsentDetail((v) => !v)}
              className="h-11 px-2 -mr-2 text-sm text-gray-500 inline-flex items-center gap-1"
              aria-expanded={showConsentDetail}
            >
              {showConsentDetail ? '접기' : '자세히'}
              <ChevronDown size={16} className={cn('transition-transform', showConsentDetail && 'rotate-180')} />
            </button>
          </div>
          {showConsentDetail && (
            <dl className="mt-2 rounded-lg bg-gray-50 p-3 text-sm leading-6 space-y-2">
              <div>
                <dt className="font-semibold text-gray-900">수집 항목</dt>
                <dd className="text-gray-700">{collectedItems.join(', ')}</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-900">이용 목적</dt>
                <dd className="text-gray-700">상담 신청 확인 및 연락, 상담 일정 안내, 레벨테스트·수업 안내</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-900">보유 기간</dt>
                <dd className="text-gray-700">
                  상담 종료 후 <strong className="text-gray-900">{formatRetention(retentionMonths)}</strong> 보관 후 파기
                  (학원 등록 시에는 재원 기간 동안 보관)
                </dd>
              </div>
              <p className="text-xs text-gray-500 pt-1">
                동의를 거부하실 수 있으며, 거부 시 온라인 상담 신청이 제한됩니다.
              </p>
            </dl>
          )}
          <div className="mt-2 border-t border-gray-100 pt-1">
            <CheckRow checked={privacyConsent} onChange={setPrivacyConsent}>
              <span className="font-semibold">[필수]</span> 위 개인정보 수집·이용에 동의합니다.
            </CheckRow>
            <CheckRow checked={guardianConfirm} onChange={setGuardianConfirm}>
              <span className="font-semibold">[필수]</span> 보호자로서 학생 정보를 제공합니다.
            </CheckRow>
          </div>
        </section>

        {error && (
          <p role="alert" className="text-sm text-accent-red bg-accent-red-light px-3 py-2.5 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full h-12 rounded-xl bg-primary-700 text-white text-base font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {pending && <Loader2 size={18} className="animate-spin" />}
          {pending ? '신청 중…' : '상담 신청하기'}
        </button>
      </form>
    </main>
  )
}
