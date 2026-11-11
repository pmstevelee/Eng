import { AtSign, Globe, Instagram, Youtube, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SocialLink {
  label: string
  href: string
  icon: LucideIcon
}

/** 위고업잉글리시 홈페이지·SNS (사이드바 하단 아이콘) */
export const SOCIAL_LINKS: SocialLink[] = [
  { label: '홈페이지', href: 'https://wegoupenglish.com', icon: Globe },
  { label: '유튜브', href: 'https://www.youtube.com/@wegoupenglishcom', icon: Youtube },
  // lucide에 쓰레드 로고가 없어 모양이 닮은 @ 아이콘을 쓴다
  { label: '쓰레드', href: 'https://www.threads.com/@pm.stevelee2', icon: AtSign },
  { label: '인스타그램', href: 'https://www.instagram.com/pm.stevelee2/', icon: Instagram },
]

/** 사이드바 하단 SNS 아이콘 줄. 접힌 사이드바에서는 세로로 쌓는다 */
export function SocialLinks({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 px-3 pb-2',
        collapsed ? 'flex-col' : 'justify-start',
      )}
    >
      {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={label}
          aria-label={`위고업잉글리시 ${label} (새 창)`}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-blue-200 transition-colors hover:bg-primary-800 hover:text-white"
        >
          <Icon size={20} />
        </a>
      ))}
    </div>
  )
}
