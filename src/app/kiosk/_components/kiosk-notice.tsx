import type { LucideIcon } from 'lucide-react'

/** 키패드 화면 안내 (미등록·해제·등록 코드 오류 등) */
export function KioskNotice({
  icon: Icon,
  title,
  description,
  tone = 'gray',
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  tone?: 'gray' | 'red'
  children?: React.ReactNode
}) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
        <div
          className={
            tone === 'red'
              ? 'mx-auto w-14 h-14 rounded-full bg-accent-red/10 flex items-center justify-center'
              : 'mx-auto w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center'
          }
        >
          <Icon size={28} className={tone === 'red' ? 'text-accent-red' : 'text-gray-500'} />
        </div>
        <h1 className="mt-5 text-xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{description}</p>
        {children}
      </div>
    </main>
  )
}
