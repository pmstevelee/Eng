'use client'

import { useTransition, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingOverlay } from '@/components/shared/loading-overlay'

interface Props {
  href: string
  className?: string
  style?: CSSProperties
  children: ReactNode
  loadingLabel?: string
}

export function NavLinkWithLoading({ href, className, style, children, loadingLabel }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <a
        href={href}
        className={className}
        style={style}
        onClick={(e) => {
          e.preventDefault()
          startTransition(() => {
            router.push(href)
          })
        }}
      >
        {children}
      </a>
      <LoadingOverlay show={isPending} label={loadingLabel} />
    </>
  )
}
