import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { getSelectedBranchId, getViewableAcademyIds } from '@/lib/branch'
import { getStudentActivityEvents } from '@/lib/schedule/get-student-activity'
import { ScheduleClient } from '@/components/schedule/schedule-client'

// ─── 데이터 패칭 (학원 전체 반/테스트/학생 활동) ────────────────────────────────
async function getScheduleData(viewIds: string[]) {
  const [classes, publishedTests, students] = await Promise.all([
    prisma.class.findMany({
      where: { academyId: { in: viewIds }, isActive: true },
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
      where: { academyId: { in: viewIds }, status: 'PUBLISHED', isActive: true },
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

    prisma.student.findMany({
      where: { user: { academyId: { in: viewIds }, isDeleted: false }, status: 'ACTIVE' },
      select: { id: true },
    }),
  ])

  const activities = await getStudentActivityEvents(students.map((s) => s.id))

  return {
    classes: classes.map((c) => ({
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
    pendingCount: 0,
    activities,
  }
}

const getCachedScheduleData = (branchKey: string, viewIds: string[]) =>
  unstable_cache(
    () => getScheduleData(viewIds),
    [`owner-schedule-${branchKey}`],
    { revalidate: 60, tags: [`academy-${branchKey}-schedule`] },
  )()

// ─── 페이지 ───────────────────────────────────────────────────────────────────
export default async function OwnerSchedulePage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const selectedBranchId = await getSelectedBranchId()
  const viewIds = await getViewableAcademyIds(user.id, selectedBranchId)
  const branchKey = viewIds.join(',')

  const { classes, tests, pendingCount, activities } = await getCachedScheduleData(branchKey, viewIds)

  return (
    <ScheduleClient
      userId={user.id}
      classes={classes}
      tests={tests}
      pendingCount={pendingCount}
      activities={activities}
      basePath="/owner"
      showTodayLink={false}
    />
  )
}
