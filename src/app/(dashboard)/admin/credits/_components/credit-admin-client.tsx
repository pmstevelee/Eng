'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Search } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  CREDIT_CHANNEL_LABEL,
  CREDIT_CHANNELS,
  formatCredits,
  type CreditChannelValue,
  type CreditPricingMap,
} from '@/lib/credits/constants'
import { cn } from '@/lib/utils'
import { adjustAcademyCredits, saveCreditPackage, updateCreditPricing, type CreditPackageInput } from '../actions'

export type AcademyCreditRow = {
  id: string
  name: string
  balance: number
  lowBalanceThreshold: number
  updatedAt: string | null
}

type PackageRow = CreditPackageInput & { id: string }

type Props = { pricing: CreditPricingMap; packages: PackageRow[]; academies: AcademyCreditRow[] }

const inputClass =
  'h-11 w-full px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700'

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Message({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null
  return (
    <p role="status" className={cn('text-sm', message.ok ? 'text-accent-green' : 'text-accent-red')}>
      {message.text}
    </p>
  )
}

// ─── 단가 ──────────────────────────────────────────────────────────────────────

function PricingSection({ pricing }: { pricing: CreditPricingMap }) {
  const router = useRouter()
  const [values, setValues] = useState<Record<CreditChannelValue, string>>({
    ALIMTALK: String(pricing.ALIMTALK),
    SMS: String(pricing.SMS),
  })
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const save = () =>
    startTransition(async () => {
      const res = await updateCreditPricing({ ALIMTALK: Number(values.ALIMTALK), SMS: Number(values.SMS) })
      setMessage(res.error ? { ok: false, text: res.error } : { ok: true, text: '저장되었습니다.' })
      if (!res.error) router.refresh()
    })

  return (
    <Section title="채널별 건당 크레딧" description="발송에 성공한 건만 실제 발송 채널의 단가로 차감됩니다. 알림톡 실패 후 문자로 대체발송되면 문자 단가가 적용됩니다.">
      <div className="grid gap-4 sm:grid-cols-2">
        {CREDIT_CHANNELS.map((channel) => (
          <label key={channel} className="block">
            <span className="text-sm font-semibold text-gray-900">{CREDIT_CHANNEL_LABEL[channel]}</span>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={values[channel]}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [channel]: e.target.value }))
                  setMessage(null)
                }}
                className={cn(inputClass, 'text-right')}
              />
              <span className="shrink-0 text-sm text-gray-700">크레딧</span>
            </div>
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        <Message message={message} />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-11 px-5 rounded-xl bg-primary-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
        >
          {pending && <Loader2 size={16} className="animate-spin" />}
          저장
        </button>
      </div>
    </Section>
  )
}

// ─── 충전 상품 ─────────────────────────────────────────────────────────────────

type PackageDraft = { name: string; credits: string; priceKrw: string; active: boolean; sortOrder: string }

const toDraft = (p?: PackageRow): PackageDraft => ({
  name: p?.name ?? '',
  credits: p ? String(p.credits) : '',
  priceKrw: p ? String(p.priceKrw) : '',
  active: p?.active ?? true,
  sortOrder: p ? String(p.sortOrder) : '0',
})

function PackageEditor({ pkg, onDone }: { pkg?: PackageRow; onDone: () => void }) {
  const router = useRouter()
  const [draft, setDraft] = useState<PackageDraft>(toDraft(pkg))
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const set = <K extends keyof PackageDraft>(key: K, value: PackageDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setError('')
  }

  const save = () =>
    startTransition(async () => {
      const res = await saveCreditPackage(pkg?.id ?? null, {
        name: draft.name,
        credits: Number(draft.credits),
        priceKrw: Number(draft.priceKrw),
        active: draft.active,
        sortOrder: Number(draft.sortOrder),
      })
      if (res.error) {
        setError(res.error)
        return
      }
      router.refresh()
      onDone()
    })

  return (
    <div className="rounded-xl border border-primary-700 bg-primary-100/40 p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-1">
          <span className="text-xs font-semibold text-gray-700">상품명</span>
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} className={cn(inputClass, 'mt-1')} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">크레딧</span>
          <input
            type="number"
            inputMode="numeric"
            value={draft.credits}
            onChange={(e) => set('credits', e.target.value)}
            className={cn(inputClass, 'mt-1 text-right')}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">가격 (원)</span>
          <input
            type="number"
            inputMode="numeric"
            value={draft.priceKrw}
            onChange={(e) => set('priceKrw', e.target.value)}
            className={cn(inputClass, 'mt-1 text-right')}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">정렬 순서</span>
          <input
            type="number"
            inputMode="numeric"
            value={draft.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value)}
            className={cn(inputClass, 'mt-1 text-right')}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-900">
          <Switch checked={draft.active} onCheckedChange={(on) => set('active', on)} />
          판매 중
        </label>
        <div className="flex items-center gap-2">
          {error && <p className="text-sm text-accent-red">{error}</p>}
          <button
            type="button"
            onClick={onDone}
            className="h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="h-11 px-5 rounded-xl bg-primary-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
          >
            {pending && <Loader2 size={16} className="animate-spin" />}
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

function PackagesSection({ packages, alimtalkPrice }: { packages: PackageRow[]; alimtalkPrice: number }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  return (
    <Section
      title="충전 상품"
      description="학원장 충전 화면에는 판매 중인 상품만 보입니다. 진행 중인 결제는 결제 시점의 상품 정보로 충전됩니다."
    >
      <div className="space-y-3">
        {packages.map((p) =>
          editing === p.id ? (
            <PackageEditor key={p.id} pkg={p} onDone={() => setEditing(null)} />
          ) : (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {p.name}
                  <span
                    className={cn(
                      'ml-2 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      p.active ? 'bg-green-50 text-accent-green' : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {p.active ? '판매 중' : '중지'}
                  </span>
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formatCredits(p.credits)}크레딧 · {p.priceKrw.toLocaleString('ko-KR')}원 · 크레딧당{' '}
                  {(p.priceKrw / p.credits).toFixed(2)}원 · 알림톡 약{' '}
                  {formatCredits(Math.floor(p.credits / Math.max(1, alimtalkPrice)))}건
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(p.id)}
                className="h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                수정
              </button>
            </div>
          ),
        )}
        {packages.length === 0 && editing !== 'new' && (
          <p className="py-6 text-center text-sm text-gray-500">등록된 충전 상품이 없습니다.</p>
        )}
        {editing === 'new' ? (
          <PackageEditor onDone={() => setEditing(null)} />
        ) : (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="h-11 px-4 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-primary-700 inline-flex items-center gap-1.5 hover:bg-gray-50"
          >
            <Plus size={16} /> 상품 추가
          </button>
        )}
      </div>
    </Section>
  )
}

// ─── 학원별 잔액 · 수동 조정 ───────────────────────────────────────────────────

function AdjustForm({ academy, onDone }: { academy: AcademyCreditRow; onDone: () => void }) {
  const router = useRouter()
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const amount = Number(delta)

  const save = () =>
    startTransition(async () => {
      const res = await adjustAcademyCredits(academy.id, amount, reason)
      if (res.error) {
        setError(res.error)
        return
      }
      router.refresh()
      onDone()
    })

  return (
    <div className="space-y-3 bg-gray-50 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">증감 (차감은 음수)</span>
          <input
            type="number"
            inputMode="numeric"
            value={delta}
            placeholder="예: 1000 또는 -500"
            onChange={(e) => {
              setDelta(e.target.value)
              setError('')
            }}
            className={cn(inputClass, 'mt-1 text-right')}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">사유 (필수)</span>
          <input
            value={reason}
            maxLength={200}
            placeholder="예: 발송 오류 보상, 테스트 충전 회수"
            onChange={(e) => {
              setReason(e.target.value)
              setError('')
            }}
            className={cn(inputClass, 'mt-1')}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {Number.isInteger(amount) && amount !== 0
            ? `조정 후 잔액: ${formatCredits(academy.balance + amount)}크레딧`
            : `현재 잔액: ${formatCredits(academy.balance)}크레딧`}
        </p>
        <div className="flex items-center gap-2">
          {error && <p className="text-sm text-accent-red">{error}</p>}
          <button
            type="button"
            onClick={onDone}
            className="h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !reason.trim() || !Number.isInteger(amount) || amount === 0}
            className="h-11 px-5 rounded-xl bg-primary-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
          >
            {pending && <Loader2 size={16} className="animate-spin" />}
            조정
          </button>
        </div>
      </div>
    </div>
  )
}

function AcademiesSection({ academies }: { academies: AcademyCreditRow[] }) {
  const [query, setQuery] = useState('')
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? academies.filter((a) => a.name.toLowerCase().includes(q)) : academies
  }, [academies, query])

  return (
    <Section title="학원별 잔액" description="지점은 본원 지갑을 함께 사용합니다. 수동 조정은 사유와 함께 사용 내역에 '관리자 조정'으로 남습니다.">
      <div className="relative mb-4 max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="학원명 검색"
          aria-label="학원명 검색"
          className={cn(inputClass, 'pl-9')}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
            <tr>
              <th className="px-4 py-3 text-left font-medium">학원</th>
              <th className="px-4 py-3 text-right font-medium">잔액</th>
              <th className="px-4 py-3 text-right font-medium">부족 기준</th>
              <th className="px-4 py-3 text-right font-medium">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((a) => (
              <AcademyCreditTableRow key={a.id} academy={a} open={adjusting === a.id} onToggle={setAdjusting} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                  검색 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function AcademyCreditTableRow({
  academy,
  open,
  onToggle,
}: {
  academy: AcademyCreditRow
  open: boolean
  onToggle: (id: string | null) => void
}) {
  const low = academy.balance <= academy.lowBalanceThreshold
  return (
    <>
      <tr>
        <td className="px-4 py-3 font-medium text-gray-900">{academy.name}</td>
        <td className={cn('px-4 py-3 text-right tabular-nums font-semibold', low ? 'text-accent-red' : 'text-gray-900')}>
          {formatCredits(academy.balance)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-gray-500">{formatCredits(academy.lowBalanceThreshold)}</td>
        <td className="px-4 py-2 text-right">
          <button
            type="button"
            onClick={() => onToggle(open ? null : academy.id)}
            className="h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {open ? '닫기' : '수동 조정'}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={4} className="p-0">
            <AdjustForm academy={academy} onDone={() => onToggle(null)} />
          </td>
        </tr>
      )}
    </>
  )
}

export function CreditAdminClient({ pricing, packages, academies }: Props) {
  return (
    <div className="space-y-6">
      <PricingSection pricing={pricing} />
      <PackagesSection packages={packages} alimtalkPrice={pricing.ALIMTALK} />
      <AcademiesSection academies={academies} />
    </div>
  )
}
