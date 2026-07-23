import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { ChevronLeft } from 'lucide-react'
import { OwnerSetBuilderClient } from '../../new/_components/owner-set-builder-client'

interface Props {
  params: Promise<{ setId: string }>
}

export default async function OwnerWordSetEditPage({ params }: Props) {
  const { setId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const wordSet = await prisma.wordSet.findFirst({
    where: { id: setId, academyId: user.academyId },
    include: {
      items: {
        orderBy: { order: 'asc' },
        include: {
          word: {
            select: { id: true, term: true, meaning: true, partOfSpeech: true, cefrLevel: true, oxfordCefr: true },
          },
        },
      },
    },
  })

  if (!wordSet || wordSet.source === 'PUBLISHER') redirect(`/owner/words/sets/${setId}`)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/owner/words/sets/${setId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          세트로 돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">단어 세트 수정</h1>
        <p className="text-sm text-gray-400 mt-1">세트 이름, 레벨, 포함된 단어를 수정할 수 있습니다.</p>
      </div>
      <OwnerSetBuilderClient
        mode="edit"
        setId={wordSet.id}
        initialTitle={wordSet.title}
        initialDescription={wordSet.description ?? ''}
        initialCefrLevel={wordSet.cefrLevel}
        initialWords={wordSet.items.map((item) => item.word)}
      />
    </div>
  )
}
