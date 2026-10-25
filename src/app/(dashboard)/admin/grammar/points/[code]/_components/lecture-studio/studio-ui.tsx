'use client'

// AI 강의 제작 화면 공통 입력 요소 (shadcn에 textarea·select가 없어 같은 모양으로 맞춘 기본 요소)

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#1865F2] focus:outline-none focus:ring-2 focus:ring-[#1865F2]/20'

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1', className)}>
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-400">{hint}</span>}
    </label>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className,
  lang,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  lang?: string
}) {
  return (
    <input
      type="text"
      value={value}
      lang={lang}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputClass, className)}
    />
  )
}

export function TextArea({
  value,
  onChange,
  rows = 2,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  className?: string
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputClass, 'h-auto min-h-[44px] py-2.5 leading-relaxed', className)}
    />
  )
}

/** 등장 단계 등 작은 정수 입력. 빈칸 허용이면 undefined */
export function StepInput({
  value,
  onChange,
  allowEmpty,
  max = 50,
  min = 0,
  title,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  allowEmpty?: boolean
  max?: number
  min?: number
  title?: string
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      title={title}
      value={value ?? ''}
      placeholder={allowEmpty ? '-' : undefined}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') return onChange(allowEmpty ? undefined : min)
        const n = Math.round(Number(raw))
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
      }}
      className={cn(inputClass, 'w-16 px-2 text-center tabular-nums')}
    />
  )
}

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  className?: string
  ariaLabel?: string
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(inputClass, 'pr-8', className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function IconButton({
  label,
  onClick,
  disabled,
  children,
  tone = 'default',
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40',
        tone === 'danger' && 'hover:border-[#D92916]/40 hover:text-[#D92916]',
      )}
    >
      {children}
    </button>
  )
}

export type Notice = { kind: 'ok' | 'error' | 'warn'; text: string; details?: string[] } | null

export function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null
  const cls =
    notice.kind === 'ok'
      ? 'border-[#1FAF54]/30 bg-[#1FAF54]/5 text-[#15803D]'
      : notice.kind === 'warn'
        ? 'border-[#FFB100]/40 bg-[#FFF8E6] text-[#8A5A00]'
        : 'border-[#D92916]/30 bg-[#D92916]/5 text-[#D92916]'
  return (
    <div role={notice.kind === 'error' ? 'alert' : 'status'} className={cn('rounded-lg border px-3 py-2 text-sm', cls)}>
      <p>{notice.text}</p>
      {notice.details && notice.details.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
          {notice.details.slice(0, 12).map((d) => (
            <li key={d}>{d}</li>
          ))}
          {notice.details.length > 12 && <li>외 {notice.details.length - 12}개</li>}
        </ul>
      )}
    </div>
  )
}
