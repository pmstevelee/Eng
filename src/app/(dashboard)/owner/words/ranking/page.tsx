import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { StaffLearningRanking } from '@/components/shared/staff-learning-ranking'

interface Props {
  searchParams: Promise<{ period?: string; class?: string }>
}

export default async function OwnerWordRankingPage({ searchParams }: Props) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const classes = await prisma.class.findMany({
    where: { academyId: user.academyId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <StaffLearningRanking
      academyId={user.academyId}
      classes={classes}
      basePath="/owner/words/ranking"
      period={params.period}
      classId={params.class}
    />
  )
}
