import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
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

const getCachedScheduleData = (userId: string, academyId: string) =>
  unstable_cache(
    () => getScheduleData(userId, academyId),
    [`teacher-schedule-${userId}`, academyId],
    { revalidate: 60, tags: [`teacher-${userId}-schedule`] },
  )()

// ─── 페이지 ───────────────────────────────────────────────────────────────────
export default async function SchedulePage() {
  const pageStart = performance.now()

  const authStart = performance.now()
  const user = await getCurrentUser()
  console.log(`  [쿼리1] getCurrentUser: ${(performance.now() - authStart).toFixed(0)}ms`)
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const dataStart = performance.now()
  const { classes, tests, pendingCount } = await getCachedScheduleData(user.id, user.academyId)
  console.log(`  [쿼리2] getCachedScheduleData: ${(performance.now() - dataStart).toFixed(0)}ms`)

  const totalTime = performance.now() - pageStart
  console.log(`📊 [SchedulePage] 전체 서버 시간: ${totalTime.toFixed(0)}ms`)
  if (totalTime > 200) console.log(`⚠️ SLOW PAGE: ${totalTime.toFixed(0)}ms`)

  return (
    <ScheduleClient
      userId={user.id}
      classes={classes}
      tests={tests}
      pendingCount={pendingCount}
    />
  )
}
