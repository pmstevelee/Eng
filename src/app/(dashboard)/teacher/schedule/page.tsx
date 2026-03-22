import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { ScheduleClient } from './_components/schedule-client'

// ─── 데이터 패칭 ──────────────────────────────────────────────────────────────
async function getScheduleData(userId: string, academyId: string) {
  const [myClasses, publishedTests, pendingCount] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId: userId, isActive: true, academyId },
      select: {
        id: true,
        name: true,
        levelRange: true,
        scheduleJson: true,
        _count: { select: { students: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { name: 'asc' },
    }),

    prisma.test.findMany({
      where: { createdBy: userId, status: 'PUBLISHED', isActive: true },
      select: {
        id: true,
        title: true,
        type: true,
        classId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),

    prisma.testSession.count({
      where: { test: { createdBy: userId }, status: 'COMPLETED' },
    }),
  ])

  return {
    classes: myClasses.map((c) => ({
      id: c.id,
      name: c.name,
      levelRange: c.levelRange,
      scheduleJson: c.scheduleJson,
      studentCount: c._count.students,
    })),
    tests: publishedTests.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type as string,
      classId: t.classId,
      createdAt: t.createdAt.toISOString(),
    })),
    pendingCount,
  }
}

// ─── 페이지 ───────────────────────────────────────────────────────────────────
export default async function SchedulePage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const { classes, tests, pendingCount } = await getScheduleData(user.id, user.academyId)

  return (
    <ScheduleClient
      userId={user.id}
      classes={classes}
      tests={tests}
      pendingCount={pendingCount}
    />
  )
}
