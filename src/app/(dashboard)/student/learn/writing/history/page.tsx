import Link from 'next/link'
import { ChevronLeft, PenLine } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { prisma } from '@/lib/prisma/client'
import {
  normalizeWritingPracticeData,
  type WritingPracticeView,
} from '@/lib/writing/practice-history'
import { WritingHistoryAccordion } from './_components/writing-history-accordion'

// 화면 표시용 정규화 모델 (구형/신형 dataJson 모두 지원)
export type WritingPracticeData = WritingPracticeView

export type WritingHistoryItem = {
  id: string
  createdAt: Date
  data: WritingPracticeData
}

export default async function WritingHistoryPage() {
  const { studentId } = await requireStudent()

  const reports = await prisma.report.findMany({
    where: { studentId, type: 'WRITING_PRACTICE' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, createdAt: true, dataJson: true },
  })

  const history: WritingHistoryItem[] = reports.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    data: normalizeWritingPracticeData(r.dataJson),
  }))

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link
          href="/student/learn/writing"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">쓰기 연습 이력</h1>
          <p className="text-xs text-gray-500">총 {history.length}회 연습 기록</p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: '#FFF7ED' }}
          >
            <PenLine className="h-7 w-7" style={{ color: '#E35C20' }} />
          </div>
          <p className="mb-1 font-semibold text-gray-700">아직 쓰기 연습 기록이 없어요</p>
          <p className="mb-5 text-sm text-gray-400">쓰기 연습을 완료하면 이곳에 기록됩니다</p>
          <Link
            href="/student/learn/writing"
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: '#E35C20' }}
          >
            쓰기 연습 시작하기
          </Link>
        </div>
      ) : (
        <WritingHistoryAccordion history={history} />
      )}
    </div>
  )
}
