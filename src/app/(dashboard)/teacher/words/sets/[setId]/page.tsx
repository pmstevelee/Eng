import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface Props {
  params: Promise<{ setId: string }>
}

const MODE_LABELS: Record<string, string> = {
  EN_TO_KO: '영→한',
  KO_TO_EN: '한→영',
  SPELL: '스펠링',
  MIXED: '혼합',
}

export default async function TeacherWordSetPage({ params }: Props) {
  const { setId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const wordSet = await prisma.wordSet.findFirst({
    where: {
      id: setId,
      OR: [{ academyId: user.academyId }, { isPublic: true }, { ownerId: user.id }],
    },
    include: {
      items: {
        orderBy: { order: 'asc' },
        include: { word: { select: { id: true, term: true, meaning: true, partOfSpeech: true } } },
      },
      wordTestAssignments: {
        where: { teacherId: user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          mode: true,
          passingScore: true,
          createdAt: true,
          _count: { select: { attempts: true } },
        },
      },
    },
  })

  if (!wordSet) redirect('/teacher/words')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">단어 세트</p>
          <h1 className="text-2xl font-bold text-gray-900">{wordSet.title}</h1>
          <p className="text-sm text-gray-400 mt-1">{wordSet.items.length}개 단어</p>
        </div>
        <Link href={`/teacher/words/sets/${setId}/test/new`}>
          <Button className="h-10 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white shrink-0">
            <Plus className="w-4 h-4 mr-1.5" />
            시험 출제
          </Button>
        </Link>
      </div>

      {/* 출제 이력 */}
      {wordSet.wordTestAssignments.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">출제 이력</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {wordSet.wordTestAssignments.map((a) => (
              <Link
                key={a.id}
                href={`/teacher/words/sets/${setId}/test/${a.id}/results`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                  <p className="text-xs text-gray-400">
                    {MODE_LABELS[a.mode]} · 합격 {a.passingScore}% ·{' '}
                    {a.createdAt.toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">
                  {a._count.attempts}명 응시
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 단어 목록 */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">단어 목록</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {wordSet.items.map((item, i) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xs text-gray-300 w-5 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <p className="text-sm font-medium text-gray-900">{item.word.term}</p>
                <p className="text-sm text-gray-500">{item.word.meaning}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
