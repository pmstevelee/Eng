import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { NewOwnerWordTestForm } from './_components/new-word-test-form'
import { getClassesForOwner } from '@/app/(dashboard)/owner/words/_actions/test'

interface Props {
  params: Promise<{ setId: string }>
}

export default async function NewOwnerWordTestPage({ params }: Props) {
  const { setId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const [wordSet, classes] = await Promise.all([
    prisma.wordSet.findFirst({
      where: {
        id: setId,
        OR: [{ academyId: user.academyId }, { isPublic: true }, { ownerId: user.id }],
      },
      select: {
        id: true,
        title: true,
        _count: { select: { items: true } },
      },
    }),
    getClassesForOwner(),
  ])

  if (!wordSet) redirect('/owner/words?tab=sets')

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">단어 세트 · {wordSet.title}</p>
        <h1 className="text-2xl font-bold text-gray-900">단어 시험 출제</h1>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <NewOwnerWordTestForm
          setId={setId}
          setTitle={wordSet.title}
          wordCount={wordSet._count.items}
          classes={classes}
        />
      </div>
    </div>
  )
}
