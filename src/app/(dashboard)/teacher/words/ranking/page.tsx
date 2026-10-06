import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { StaffLearningRanking } from '@/components/shared/staff-learning-ranking'

interface Props {
  searchParams: Promise<{ period?: string; class?: string }>
}

export default async function TeacherWordRankingPage({ searchParams }: Props) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  // 반 필터는 담당 반만 노출 (학원 전체 순위는 학생 화면과 동일하게 공개)
  const classes = await prisma.class.findMany({
    where: { academyId: user.academyId, teacherId: user.id, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <StaffLearningRanking
      academyId={user.academyId}
      classes={classes}
      basePath="/teacher/words/ranking"
      period={params.period}
      classId={params.class}
    />
  )
}
