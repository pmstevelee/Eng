'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, Copy, RefreshCw, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PLAN_TYPE_LABEL, SELECTABLE_PLAN_TYPES } from '@/lib/plan-types'
import { createOwnerAccount, type CreatedOwnerAccount } from '../actions'

const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function makePassword(): string {
  const arr = new Uint32Array(10)
  crypto.getRandomValues(arr)
  return Array.from(arr, (n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length]).join('')
}

const EMPTY_FORM = {
  ownerName: '',
  email: '',
  password: '',
  ownerPhone: '',
  businessName: '',
  academyAddress: '',
  academyPhone: '',
  planType: 'STANDARD',
  startMode: 'TRIAL' as 'TRIAL' | 'ACTIVE',
  months: '12',
}

const selectClass =
  'flex h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 focus-visible:outline-none focus-visible:border-primary-700 focus-visible:ring-2 focus-visible:ring-primary-100'

function buildShareText(a: CreatedOwnerAccount): string {
  return [
    `[위고업잉글리시] ${a.businessName} 학원장 계정 안내`,
    '',
    `로그인 주소: ${a.loginUrl}`,
    `아이디(이메일): ${a.email}`,
    `임시 비밀번호: ${a.password}`,
    `교사·학생 초대코드: ${a.inviteCode}`,
    '',
    '처음 로그인하신 뒤 [설정 > 계정 > 비밀번호 변경]에서 비밀번호를 꼭 바꿔 주세요. (가입 이메일로 변경 링크가 발송됩니다)',
  ].join('\n')
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          setCopied(false)
        }
      }}
      aria-label={`${label} 복사`}
    >
      {copied ? <Check className="text-accent-green" /> : <Copy />}
      {copied ? '복사됨' : '복사'}
    </Button>
  )
}

function ResultCard({ account, onReset }: { account: CreatedOwnerAccount; onReset: () => void }) {
  const rows: { label: string; value: string }[] = [
    { label: '로그인 주소', value: account.loginUrl },
    { label: '아이디(이메일)', value: account.email },
    { label: '임시 비밀번호', value: account.password },
    { label: '교사·학생 초대코드', value: account.inviteCode },
  ]
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-accent-green-light flex items-center justify-center shrink-0">
          <Check className="text-accent-green" size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">학원장 계정을 만들었습니다</h2>
          <p className="text-sm text-gray-500 mt-1">
            {account.businessName} · {account.ownerName} · {PLAN_TYPE_LABEL[account.planType as keyof typeof PLAN_TYPE_LABEL]} ·{' '}
            {account.statusText}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-accent-gold/40 bg-accent-gold-light px-4 py-3 text-sm text-gray-900">
        임시 비밀번호는 이 화면을 벗어나면 다시 볼 수 없습니다. 지금 복사해서 학원장에게 전달해 주세요.
      </div>

      <dl className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 px-4 py-3">
            <dt className="w-32 shrink-0 text-sm text-gray-500">{r.label}</dt>
            <dd className="flex-1 min-w-0 font-mono text-sm text-gray-900 break-all">{r.value}</dd>
            <CopyButton text={r.value} label={r.label} />
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        <CopyButton text={buildShareText(account)} label="안내 문구 전체" />
        <span className="self-center text-xs text-gray-400">← 안내 문구 전체 복사 (문자·카톡으로 전달)</span>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button asChild>
          <Link href={`/admin/academies/${account.academyId}`}>학원 상세 보기</Link>
        </Button>
        <Button type="button" variant="outline" onClick={onReset}>
          <UserPlus />
          계정 하나 더 만들기
        </Button>
      </div>
    </div>
  )
}

export function CreateOwnerForm() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedOwnerAccount | null>(null)
  const [isPending, startTransition] = useTransition()

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const result = await createOwnerAccount({ ...form, months: Number(form.months) })
        if (result.ok) {
          setCreated(result.account)
          setForm(EMPTY_FORM)
        } else {
          setError(result.error)
        }
      } catch {
        setError('요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      }
    })
  }

  if (created) return <ResultCard account={created} onReset={() => setCreated(null)} />

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">학원장 정보</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ownerName">이름 *</Label>
            <Input id="ownerName" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ownerPhone">연락처</Label>
            <Input
              id="ownerPhone"
              value={form.ownerPhone}
              onChange={(e) => set('ownerPhone', e.target.value)}
              placeholder="010-0000-0000"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="email">아이디(이메일) *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="owner@example.com"
              autoComplete="off"
              required
            />
            <p className="text-xs text-gray-500">학원장이 로그인할 때 쓰는 아이디입니다. 다른 계정에서 쓰는 이메일은 사용할 수 없습니다.</p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="password">임시 비밀번호</Label>
            <div className="flex gap-2">
              <Input
                id="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="비워두면 자동으로 만듭니다 (8자 이상)"
                autoComplete="new-password"
                className="font-mono"
              />
              <Button type="button" variant="outline" onClick={() => set('password', makePassword())}>
                <RefreshCw />
                자동 생성
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">학원 정보</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="businessName">학원명 *</Label>
            <Input
              id="businessName"
              value={form.businessName}
              onChange={(e) => set('businessName', e.target.value)}
              placeholder="사이드바에 표시되는 학원 이름"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="academyPhone">학원 전화</Label>
            <Input id="academyPhone" value={form.academyPhone} onChange={(e) => set('academyPhone', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="academyAddress">주소</Label>
            <Input id="academyAddress" value={form.academyAddress} onChange={(e) => set('academyAddress', e.target.value)} />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">요금제 · 이용 기간</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="planType">요금제</Label>
            <select
              id="planType"
              value={form.planType}
              onChange={(e) => set('planType', e.target.value)}
              className={selectClass}
            >
              {SELECTABLE_PLAN_TYPES.map((p) => (
                <option key={p} value={p}>
                  {PLAN_TYPE_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startMode">시작 상태</Label>
            <select
              id="startMode"
              value={form.startMode}
              onChange={(e) => set('startMode', e.target.value as 'TRIAL' | 'ACTIVE')}
              className={selectClass}
            >
              <option value="TRIAL">14일 무료 체험</option>
              <option value="ACTIVE">바로 이용 시작 (입금 확인됨)</option>
            </select>
          </div>
          {form.startMode === 'ACTIVE' && (
            <div className="space-y-1.5">
              <Label htmlFor="months">이용 기간</Label>
              <select
                id="months"
                value={form.months}
                onChange={(e) => set('months', e.target.value)}
                className={selectClass}
              >
                {[1, 3, 6, 12, 24].map((m) => (
                  <option key={m} value={String(m)}>
                    {m}개월
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-accent-red">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          <UserPlus />
          {isPending ? '만드는 중…' : '학원장 계정 만들기'}
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/academies">취소</Link>
        </Button>
      </div>
    </form>
  )
}
