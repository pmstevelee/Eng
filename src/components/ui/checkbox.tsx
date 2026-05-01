'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface CheckboxProps {
  id?: string
  checked?: boolean
  onCheckedChange?: (checked: boolean | 'indeterminate') => void
  disabled?: boolean
  className?: string
}

export function Checkbox({
  id,
  checked,
  onCheckedChange,
  disabled,
  className,
}: CheckboxProps) {
  return (
    <button
      id={id}
      role="checkbox"
      type="button"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
        checked
          ? 'border-primary-700 bg-primary-700'
          : 'border-gray-300 bg-white hover:border-primary-700',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      {checked && <Check className="h-3 w-3 text-white stroke-[3]" />}
    </button>
  )
}
