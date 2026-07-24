import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { WordSetPrint } from './_components/word-set-print'
import type { Prisma } from '@/generated/prisma'

const ROLE_LABEL: Record<string, string> = {
  STUDENT: '학생',
  TEACHER: '담당교사',
  ACADEMY_OWNER: '담당자',
}

export default async function WordSetPrintPage({
  params,
}: {
  params: Promise<{ setId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!['STUDENT', 'TEACHER', 'ACADEMY_OWNER', 'SUPER_ADMIN'].includes(user.role)) {
    redirect('/login')
  }

  const { setId } = await params

  const accessConditions: Prisma.WordSetWhereInput[] = [{ isPublic: true }]
  if (user.academyId) accessConditions.push({ academyId: user.academyId })
  if (user.role === 'STUDENT' && user.student) accessConditions.push({ ownerId: user.student.id })
  if (user.role === 'TEACHER') accessConditions.push({ ownerId: user.id })

  const wordSet = await prisma.wordSet.findFirst({
    where:
      user.role === 'SUPER_ADMIN'
        ? { id: setId }
        : { id: setId, OR: accessConditions },
    include: {
      items: {
        orderBy: { order: 'asc' },
        include: { word: true },
      },
    },
  })

  if (!wordSet) notFound()

  const academy = user.academyId
    ? await prisma.academy.findUnique({
        where: { id: user.academyId },
        select: { name: true, businessName: true, address: true, phone: true },
      })
    : null

  return (
    <WordSetPrint
      academy={academy}
      printedBy={{ label: ROLE_LABEL[user.role] ?? '다운로드', name: user.name }}
      wordSet={{
        title: wordSet.title,
        description: wordSet.description,
        cefrLevel: wordSet.cefrLevel,
      }}
      words={wordSet.items.map((item) => ({
        term: item.word.term,
        partOfSpeech: item.word.partOfSpeech,
        meaning: item.word.meaning,
        definition: item.word.definition,
        example: item.word.example,
      }))}
    />
  )
}
