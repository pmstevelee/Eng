import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import AutoAssignClient from './_components/auto-assign-client'

export default async function AutoAssignPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const [classes, students] = await Promise.all([
    prisma.class.findMany({
      where: { academyId: user.academyId, isActive: true },
      select: { id: true, name: true, levelRange: true },
      orderBy: { name: 'asc' },
    }),
    prisma.student.findMany({
      where: {
        status: 'ACTIVE',
        user: { academyId: user.academyId, isDeleted: false },
      },
      select: {
        id: true,
        currentLevel: true,
        classId: true,
        user: { select: { name: true } },
      },
      orderBy: { user: { name: 'asc' } },
    }),
  ])

  return (
    <AutoAssignClient
      classes={classes.map((c) => ({
        id: c.id,
        name: c.name,
        levelRange: c.levelRange,
      }))}
      students={students.map((s) => ({
        id: s.id,
        name: s.user.name,
        level: s.currentLevel,
        currentClassId: s.classId,
      }))}
    />
  )
}
