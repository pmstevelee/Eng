import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { ChevronLeft, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteSetButton } from './_components/delete-set-button'

interface Props {
  params: Promise<{ setId: string }>
}

export default async function OwnerWordSetPage({ params }: Props) {
  const { setId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const wordSet = await prisma.wordSet.findFirst({
    where: {
      id: setId,
      OR: [{ academyId: user.academyId }, { isPublic: true }],
    },
    include: {
      items: {
        orderBy: { order: 'asc' },
        include: { word: { select: { id: true, term: true, meaning: true, partOfSpeech: true } } },
      },
    },
  })

  if (!wordSet) redirect('/owner/words?tab=sets')

  const canDelete = wordSet.source !== 'PUBLISHER' && wordSet.academyId === user.academyId

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link
          href="/owner/words?tab=sets"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          세트 목록으로
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">단어 세트</p>
            <h1 className="text-2xl font-bold text-gray-900">{wordSet.title}</h1>
            <p className="text-sm text-gray-400 mt-1">{wordSet.items.length}개 단어</p>
          </div>
          {canDelete && (
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/owner/words/sets/${setId}/edit`}>
                <Button variant="outline" size="sm" className="h-9 text-gray-600 border-gray-200">
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  수정
                </Button>
              </Link>
              <DeleteSetButton setId={setId} setTitle={wordSet.title} />
            </div>
          )}
        </div>
      </div>

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
