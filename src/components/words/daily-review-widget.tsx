import Link from 'next/link'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import { prisma } from '@/lib/prisma/client'

interface Props {
  studentId: string
  newWordHref?: string
}

export async function DailyReviewWidget({ studentId, newWordHref = '/student/words' }: Props) {
  const now = new Date()
  const dueCount = await prisma.wordProgress.count({
    where: { studentId, nextReviewAt: { lte: now } },
  })

  if (dueCount === 0) {
    return (
      <div className="rounded-xl border border-[#1FAF54]/30 bg-[#1FAF54]/5 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1FAF54]/15">
            <Sparkles className="h-5 w-5 text-[#1FAF54]" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">오늘 복습 끝!</p>
            <p className="text-xs text-gray-500">새 단어를 시작해 보세요</p>
          </div>
        </div>
        <Link
          href={newWordHref}
          className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-semibold text-white bg-[#1FAF54] hover:bg-[#1FAF54]/90 transition-colors shrink-0"
        >
          새 단어<ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    )
  }

  return (
    <Link
      href="/student/words/review"
      className="rounded-xl border border-[#DDD6FE] bg-[#F3F0FF] p-4 flex items-center justify-between gap-3 hover:border-[#7854F7]/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7854F7]">
          <RotateCcw className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">
            오늘 복습할 단어{' '}
            <span className="text-[#7854F7]">{dueCount}개</span>
          </p>
          <p className="text-xs text-gray-500">지금 바로 복습하세요</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#7854F7]" />
    </Link>
  )
}
