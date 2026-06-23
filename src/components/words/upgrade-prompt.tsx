import Link from 'next/link'
import { BookOpen, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UpgradePromptProps {
  className?: string
}

export function UpgradePrompt({ className }: UpgradePromptProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white px-8 py-12 text-center ${className ?? ''}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF4FF]">
        <BookOpen className="h-7 w-7 text-[#1865F2]" />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-gray-900">단어학습 기능 안내</h3>
        <p className="text-sm text-gray-500">
          단어학습은 구독(스타터 이상)에서 사용할 수 있어요.
        </p>
      </div>

      <p className="max-w-xs text-sm text-gray-500">
        학생은 직접 구독을 변경할 수 없습니다. <br />
        이용을 원하시면 <strong className="text-gray-700">학원 선생님이나 원장님</strong>께
        문의해 주세요.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/student/settings">
            <MessageCircle className="mr-1.5 h-4 w-4" />
            학원에 문의하기
          </Link>
        </Button>
      </div>
    </div>
  )
}
