'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { formatCredits } from '@/lib/credits/constants'
import { cn } from '@/lib/utils'
import { adjustStudentCredits } from '../actions'

const inputClass =
  'h-11 w-full px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700'

const QUICK_AMOUNTS = [1_000, 3_000, 5_000, 10_000]

export function StudentCreditAdjustForm({ studentId, balance }: { studentId: string; balance: number }) {
  const router = useRouter()
  const [mode, setMode] = useState<'grant' | 'deduct'>('grant')
  const [credits, setCredits] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const value = Number(credits)
  const valid = Number.isInteger(value) && value > 0
  const delta = mode === 'grant' ? value : -value
  const overDeduct = mode === 'deduct' && valid && value > balance

  const submit = () =>
    startTransition(async () => {
      const res = await adjustStudentCredits(studentId, delta, reason)
      if (res.error) {
        setMessage({ ok: false, text: res.error })
        return
      }
      setMessage({
        ok: true,
        text: `${formatCredits(value)}크레딧을 ${mode === 'grant' ? '지급' : '차감'}했습니다. 현재 잔액 ${formatCredits(res.balanceAfter ?? 0)}크레딧`,
      })
      setCredits('')
      setReason('')
      router.refresh()
    })

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-gray-200 p-1" role="radiogroup" aria-label="지급 또는 차감">
        {(
          [
            { key: 'grant', label: '지급' },
            { key: 'deduct', label: '차감' },
          ] as const
        ).map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={mode === m.key}
            onClick={() => {
              setMode(m.key)
              setMessage(null)
            }}
            className={cn(
              'h-10 min-w-20 rounded-lg px-4 text-sm font-semibold',
              mode === m.key
                ? m.key === 'grant'
                  ? 'bg-primary-700 text-white'
                  : 'bg-accent-red text-white'
                : 'text-gray-700 hover:bg-gray-50',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">크레딧</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={credits}
            placeholder="예: 3000"
            onChange={(e) => {
              setCredits(e.target.value)
              setMessage(null)
            }}
            className={cn(inputClass, 'mt-1 text-right')}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">사유 (필수 · 학생 사용 내역에 표시)</span>
          <input
            value={reason}
            maxLength={200}
            placeholder={mode === 'grant' ? '예: 이벤트 지급, 결제 오류 보상' : '예: 잘못 지급된 크레딧 회수'}
            onChange={(e) => {
              setReason(e.target.value)
              setMessage(null)
            }}
            className={cn(inputClass, 'mt-1')}
          />
        </label>
      </div>

      {mode === 'grant' && (
        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setCredits(String(n))
                setMessage(null)
              }}
              className="h-11 rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {formatCredits(n)}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn('text-sm', overDeduct ? 'text-accent-red' : 'text-gray-500')}>
          {overDeduct
            ? `잔액(${formatCredits(balance)}크레딧)보다 많이 차감할 수 없습니다.`
            : valid
              ? `처리 후 잔액: ${formatCredits(balance + delta)}크레딧`
              : `현재 잔액: ${formatCredits(balance)}크레딧`}
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !valid || overDeduct || !reason.trim()}
          className={cn(
            'h-11 px-5 rounded-xl text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60',
            mode === 'grant' ? 'bg-primary-700' : 'bg-accent-red',
          )}
        >
          {pending && <Loader2 size={16} className="animate-spin" />}
          {mode === 'grant' ? '지급하기' : '차감하기'}
        </button>
      </div>
      {message && (
        <p role="status" className={cn('text-sm', message.ok ? 'text-accent-green' : 'text-accent-red')}>
          {message.text}
        </p>
      )}
    </div>
  )
}
