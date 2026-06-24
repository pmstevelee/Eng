import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { Button } from '@/components/ui/button'
import { BookOpen, Plus, BarChart2 } from 'lucide-react'

export default async function TeacherWordsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const wordSets = await prisma.wordSet.findMany({
    where: {
      OR: [{ academyId: user.academyId }, { isPublic: true }, { ownerId: user.id }],
    },
    select: {
      id: true,
      title: true,
      cefrLevel: true,
      source: true,
      _count: { select: { items: true, wordTestAssignments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">단어 세트</h1>
        <Link href="/teacher/words/report">
          <Button variant="outline" size="sm" className="h-9 gap-2 text-[#1865F2] border-[#1865F2]/30 hover:bg-[#EFF4FE]">
            <BarChart2 className="w-4 h-4" />
            학습 리포트
          </Button>
        </Link>
      </div>

      {wordSets.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>사용 가능한 단어 세트가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wordSets.map((set) => (
            <div
              key={set.id}
              className="rounded-xl border border-gray-200 bg-white px-5 py-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{set.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {set._count.items}개 단어 · 출제 {set._count.wordTestAssignments}회
                </p>
              </div>
              <Link href={`/teacher/words/sets/${set.id}/test/new`}>
                <Button size="sm" className="h-9 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white">
                  <Plus className="w-4 h-4 mr-1" />
                  시험 출제
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
