'use client'

import { useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ModalShellProps = {
  title: string
  icon?: LucideIcon
  onClose: () => void
  children: React.ReactNode
  size?: 'md' | 'lg'
}

/** 상담관리 다이얼로그 공통 틀 (기존 학생 추가 다이얼로그와 동일한 스타일) */
export function ModalShell({ title, icon: Icon, onClose, children, size = 'md' }: ModalShellProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'bg-white rounded-t-2xl sm:rounded-2xl w-full sm:mx-4 max-h-[92vh] flex flex-col border border-gray-200',
          size === 'md' ? 'sm:max-w-md' : 'sm:max-w-2xl',
        )}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={18} className="text-primary-700" />}
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-11 h-11 -mr-2 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export const inputClass =
  'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent'

export const textareaClass =
  'w-full min-h-[88px] px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent resize-y'

export function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-accent-red">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

export function FormError({ message }: { message: string }) {
  if (!message) return null
  return <p className="text-sm text-accent-red bg-accent-red-light px-3 py-2 rounded-lg">{message}</p>
}

export function FormActions({
  onCancel,
  pending,
  submitLabel,
  pendingLabel,
  danger,
}: {
  onCancel: () => void
  pending: boolean
  submitLabel: string
  pendingLabel: string
  danger?: boolean
}) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        취소
      </button>
      <button
        type="submit"
        disabled={pending}
        className={cn(
          'flex-1 h-11 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-colors',
          danger ? 'bg-accent-red hover:opacity-90' : 'bg-primary-700 hover:bg-primary-800',
        )}
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </div>
  )
}

export function StatusBadge({ className, label }: { className: string; label: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', className)}>
      {label}
    </span>
  )
}

/** 방치 표시 (마지막 활동 후 기준 일수 경과) */
/** 확인 전 웹 상담신청(신규·재문의) 표시 */
export function WebInquiryBadge() {
  return (
    <span
      title="확인하지 않은 웹 상담신청이 있습니다"
      className="inline-flex items-center rounded-full bg-primary-700 text-white px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
    >
      웹 신청
    </span>
  )
}

export function StaleBadge() {
  return (
    <span
      title="마지막 활동 후 기준 일수가 지났습니다"
      className="inline-flex items-center rounded-full bg-accent-gold-light text-[#9A6B00] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
    >
      방치
    </span>
  )
}
