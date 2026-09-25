'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { Check, Copy, Download, ExternalLink, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  RETENTION_MONTH_OPTIONS,
  SLUG_RULE_TEXT,
  STALE_DAY_OPTIONS,
  WEB_FORM_FIELD_KEYS,
  WEB_FORM_FIELD_LABEL,
  WEB_FORM_INTRO_MAX,
  formatRetention,
  isValidSlug,
  sanitizeSource,
  type WebFormSettings,
} from '@/lib/consultation/constants'
import {
  updateAcademyConsultationSettings,
  updateConsultationGeneralSettings,
} from '@/lib/consultation/settings-actions'
import { cn } from '@/lib/utils'

export type AcademyConsultationSettings = {
  id: string
  label: string
  slug: string
  defaultAssigneeId: string
  webForm: WebFormSettings
  assigneeOptions: { id: string; name: string }[]
}

type Props = {
  baseUrl: string
  general: { staleDays: number; retentionMonths: number }
  academies: AcademyConsultationSettings[]
}

const selectClass =
  'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent'
const inputClass =
  'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent'

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  )
}

function SaveRow({ pending, message, onSave }: { pending: boolean; message: { ok: boolean; text: string } | null; onSave: () => void }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-1">
      {message && (
        <p role="status" className={cn('text-sm', message.ok ? 'text-accent-green' : 'text-accent-red')}>
          {message.text}
        </p>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="h-11 px-5 rounded-xl bg-primary-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
      >
        {pending && <Loader2 size={16} className="animate-spin" />}
        저장
      </button>
    </div>
  )
}

export function ConsultationSettingsClient({ baseUrl, general, academies }: Props) {
  const [activeId, setActiveId] = useState(academies[0]?.id ?? '')
  const active = academies.find((a) => a.id === activeId) ?? academies[0]

  return (
    <div className="space-y-6">
      <GeneralSettings initial={general} />

      {academies.length > 1 && (
        <nav className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-gray-200" aria-label="학원 선택">
          {academies.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setActiveId(a.id)}
              aria-current={a.id === active?.id ? 'page' : undefined}
              className={cn(
                'h-11 px-4 shrink-0 border-b-2 text-sm font-medium transition-colors',
                a.id === active?.id ? 'border-primary-700 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-900',
              )}
            >
              {a.label}
            </button>
          ))}
        </nav>
      )}

      {/* 학원 전환 시 입력 상태 초기화 */}
      {active && <AcademySettings key={active.id} academy={active} baseUrl={baseUrl} showLabel={academies.length > 1} />}
    </div>
  )
}

// ─── 공통 설정 ─────────────────────────────────────────────────────────────────

function GeneralSettings({ initial }: { initial: Props['general'] }) {
  const router = useRouter()
  const [staleDays, setStaleDays] = useState(initial.staleDays)
  const [retentionMonths, setRetentionMonths] = useState(initial.retentionMonths)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setMessage(null)
    startTransition(async () => {
      const res = await updateConsultationGeneralSettings({ staleDays, retentionMonths })
      if (res.error) setMessage({ ok: false, text: res.error })
      else {
        setMessage({ ok: true, text: '저장되었습니다.' })
        router.refresh()
      }
    })
  }

  return (
    <SectionCard title="공통 설정" description="본원과 모든 지점에 함께 적용됩니다.">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="stale-days" className="block text-sm font-semibold text-gray-900 mb-1.5">
            방치 표시 기준
          </label>
          <select id="stale-days" className={selectClass} value={staleDays} onChange={(e) => setStaleDays(Number(e.target.value))}>
            {STALE_DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                마지막 활동 후 {d}일
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1.5">이 기간 동안 활동이 없는 문의에 &lsquo;방치&rsquo; 표시를 합니다.</p>
        </div>
        <div>
          <label htmlFor="retention" className="block text-sm font-semibold text-gray-900 mb-1.5">
            미등록 문의 개인정보 보관 기간
          </label>
          <select
            id="retention"
            className={selectClass}
            value={retentionMonths}
            onChange={(e) => setRetentionMonths(Number(e.target.value))}
          >
            {RETENTION_MONTH_OPTIONS.map((m) => (
              <option key={m} value={m}>
                상담 종료 후 {formatRetention(m)}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1.5">상담신청 폼의 개인정보 동의 문구(보유 기간)에 자동으로 표시됩니다.</p>
        </div>
      </div>
      <SaveRow pending={pending} message={message} onSave={save} />
    </SectionCard>
  )
}

// ─── 학원별 설정 ───────────────────────────────────────────────────────────────

function AcademySettings({
  academy,
  baseUrl,
  showLabel,
}: {
  academy: AcademyConsultationSettings
  baseUrl: string
  showLabel: boolean
}) {
  const router = useRouter()
  const [slug, setSlug] = useState(academy.slug)
  const [defaultAssigneeId, setDefaultAssigneeId] = useState(academy.defaultAssigneeId)
  const [form, setForm] = useState<WebFormSettings>(academy.webForm)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const slugInvalid = slug !== '' && !isValidSlug(slug)
  const suffix = showLabel ? ` (${academy.label})` : ''

  function save() {
    setMessage(null)
    if (slugInvalid) return setMessage({ ok: false, text: `주소는 ${SLUG_RULE_TEXT}로 입력해주세요.` })
    startTransition(async () => {
      const res = await updateAcademyConsultationSettings(academy.id, { slug, defaultAssigneeId, webForm: form })
      if (res.error) setMessage({ ok: false, text: res.error })
      else {
        setMessage({ ok: true, text: '저장되었습니다.' })
        router.refresh()
      }
    })
  }

  return (
    <>
      <SectionCard title={`기본 담당자${suffix}`} description="웹 상담신청으로 들어온 새 문의를 자동으로 배정합니다.">
        <div className="max-w-sm">
          <label htmlFor="default-assignee" className="sr-only">
            기본 담당자
          </label>
          <select
            id="default-assignee"
            className={selectClass}
            value={defaultAssigneeId}
            onChange={(e) => setDefaultAssigneeId(e.target.value)}
          >
            <option value="">배정 안 함 (학원장이 직접 배정)</option>
            {academy.assigneeOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </SectionCard>

      <SectionCard
        title={`웹 상담신청 폼${suffix}`}
        description="학부모가 링크·QR 코드로 접속해 직접 상담을 신청하는 페이지입니다."
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">신청 폼 사용</p>
            <p className="text-xs text-gray-500 mt-0.5">끄면 신청 페이지에 &lsquo;현재 신청을 받지 않습니다&rsquo;가 표시됩니다.</p>
          </div>
          <Switch checked={form.enabled} onCheckedChange={(enabled) => setForm((f) => ({ ...f, enabled }))} />
        </div>

        <div>
          <label htmlFor="apply-slug" className="block text-sm font-semibold text-gray-900 mb-1.5">
            신청 폼 주소
          </label>
          <div className="flex items-center rounded-xl border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-primary-700">
            <span className="pl-3 text-sm text-gray-500 whitespace-nowrap hidden sm:inline">{baseUrl}/apply/</span>
            <span className="pl-3 text-sm text-gray-500 whitespace-nowrap sm:hidden">/apply/</span>
            <input
              id="apply-slug"
              className="flex-1 min-w-0 h-11 pr-3 pl-0.5 rounded-xl text-sm text-gray-900 placeholder:text-gray-500 bg-transparent focus:outline-none"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40))}
              placeholder="예: wegoup-dongtan"
              aria-invalid={slugInvalid}
            />
          </div>
          <p className={cn('text-xs mt-1.5', slugInvalid ? 'text-accent-red' : 'text-gray-500')}>
            {SLUG_RULE_TEXT}. 주소를 바꾸면 기존 링크·QR 코드는 더 이상 열리지 않습니다.
          </p>
        </div>

        <div>
          <label htmlFor="apply-intro" className="block text-sm font-semibold text-gray-900 mb-1.5">
            안내 문구 <span className="text-gray-500 font-normal">(선택)</span>
          </label>
          <textarea
            id="apply-intro"
            className={cn(inputClass, 'h-auto min-h-[96px] py-2.5 resize-y')}
            value={form.intro}
            maxLength={WEB_FORM_INTRO_MAX}
            onChange={(e) => setForm((f) => ({ ...f, intro: e.target.value }))}
            placeholder={'예: 신청해주시면 1일 이내에 연락드립니다.\n무료 레벨테스트도 함께 안내해드려요.'}
          />
          <p className="text-xs text-gray-500 mt-1 text-right tabular-nums">
            {form.intro.length}/{WEB_FORM_INTRO_MAX}
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-gray-900 mb-1">선택 항목 표시</legend>
          <p className="text-xs text-gray-500 mb-2">보호자 이름·연락처, 학생 이름은 항상 필수로 받습니다.</p>
          <div className="grid grid-cols-2 gap-x-4">
            {WEB_FORM_FIELD_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2.5 min-h-11 cursor-pointer text-sm text-gray-900">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 accent-primary-700"
                  checked={form.fields[key]}
                  onChange={(e) => setForm((f) => ({ ...f, fields: { ...f.fields, [key]: e.target.checked } }))}
                />
                {WEB_FORM_FIELD_LABEL[key]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">접수 확인 알림 발송</p>
            <p className="text-xs text-gray-500 mt-0.5">신청 직후 보호자에게 &lsquo;상담 신청 접수 안내&rsquo; 알림톡(또는 문자)을 보냅니다.</p>
          </div>
          <Switch checked={form.sendReceipt} onCheckedChange={(sendReceipt) => setForm((f) => ({ ...f, sendReceipt }))} />
        </div>

        <SaveRow pending={pending} message={message} onSave={save} />
      </SectionCard>

      {academy.slug && academy.webForm.enabled ? (
        <ShareSection url={`${baseUrl}/apply/${academy.slug}`} label={academy.label} suffix={suffix} />
      ) : (
        <section className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-gray-900">링크·QR 코드</p>
          <p className="text-sm text-gray-500 mt-1">신청 폼을 켜고 주소를 저장하면 링크와 QR 코드를 받을 수 있습니다.</p>
        </section>
      )}
    </>
  )
}

// ─── 링크 복사 · QR 코드 ───────────────────────────────────────────────────────

const SOURCE_PRESETS = [
  { value: 'blog', label: '블로그' },
  { value: 'flyer', label: '전단지' },
  { value: 'insta', label: '인스타그램' },
  { value: 'kakao', label: '카카오 채널' },
]

function ShareSection({ url, label, suffix }: { url: string; label: string; suffix: string }) {
  const [source, setSource] = useState('')
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState('')

  const src = sanitizeSource(source)
  const shareUrl = src ? `${url}?src=${encodeURIComponent(src)}` : url

  useEffect(() => {
    let canceled = false
    QRCode.toDataURL(shareUrl, { width: 1024, margin: 2, errorCorrectionLevel: 'M' })
      .then((data) => {
        if (!canceled) setQr(data)
      })
      .catch(() => setQr(''))
    return () => {
      canceled = true
    }
  }, [shareUrl])

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('아래 링크를 복사해주세요.', shareUrl)
    }
  }

  return (
    <SectionCard title={`링크 · QR 코드${suffix}`} description="블로그·문자·전단지 등에 신청 링크를 공유하세요.">
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-1.5">유입경로 표시 <span className="text-gray-500 font-normal">(선택)</span></p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSource('')}
            className={cn(
              'h-9 px-3 rounded-full border text-sm',
              !src ? 'border-primary-700 bg-primary-100 text-primary-700 font-semibold' : 'border-gray-200 text-gray-700',
            )}
          >
            없음
          </button>
          {SOURCE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setSource(p.value)}
              className={cn(
                'h-9 px-3 rounded-full border text-sm',
                src === p.value ? 'border-primary-700 bg-primary-100 text-primary-700 font-semibold' : 'border-gray-200 text-gray-700',
              )}
            >
              {p.label}
            </button>
          ))}
          <input
            aria-label="유입경로 직접 입력"
            className="h-9 w-36 px-3 rounded-full border border-gray-200 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-700"
            value={source}
            onChange={(e) => setSource(e.target.value.slice(0, 30))}
            placeholder="직접 입력"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          링크 끝에 ?src=값 이 붙어 어느 경로로 신청했는지 문의 상세의 &lsquo;유입경로&rsquo;에 기록됩니다.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-5 md:items-start">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 break-all">{shareUrl}</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copy}
              className="h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? '복사됨' : '링크 복사'}
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 inline-flex items-center gap-2"
            >
              <ExternalLink size={16} />
              신청 페이지 열기
            </a>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="w-40 h-40 rounded-xl border border-gray-200 bg-white p-2 flex items-center justify-center">
            {qr ? (
              <img src={qr} alt="상담 신청 QR 코드" className="w-full h-full" />
            ) : (
              <Loader2 size={20} className="animate-spin text-gray-500" />
            )}
          </div>
          <a
            href={qr || undefined}
            download={`상담신청_QR_${label}${src ? `_${src}` : ''}.png`}
            aria-disabled={!qr}
            className={cn(
              'h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 inline-flex items-center gap-2',
              !qr && 'pointer-events-none opacity-50',
            )}
          >
            <Download size={16} />
            QR 이미지 다운로드
          </a>
        </div>
      </div>
    </SectionCard>
  )
}
