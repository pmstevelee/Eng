import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { StudentsClient } from './students-client'

export const metadata = { title: '학생 학습관리' }

const getCachedTeacherStudents = (teacherId: string) =>
  unstable_cache(
    async () => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const [classes, students] = await Promise.all([
        prisma.class.findMany({
          where: { teacherId, isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, levelRange: true },
        }),
        prisma.student.findMany({
          where: { class: { teacherId }, status: 'ACTIVE' },
          include: {
            user: { select: { name: true, email: true } },
            class: { select: { id: true, name: true } },
            testSessions: {
              where: { status: { in: ['COMPLETED', 'GRADED'] } },
              orderBy: { completedAt: 'desc' },
              take: 2,
              select: {
                id: true,
                score: true,
                grammarScore: true,
                vocabularyScore: true,
                readingScore: true,
                writingScore: true,
                completedAt: true,
              },
            },
            attendance: {
              where: { date: { gte: monthStart } },
              select: { status: true },
            },
          },
          orderBy: { user: { name: 'asc' } },
        }),
      ])

      return {
        classes,
        students: students.map((s) => ({
          id: s.id,
          currentLevel: s.currentLevel,
          user: s.user,
          class: s.class,
          testSessions: s.testSessions.map((ts) => ({
            id: ts.id,
            score: ts.score,
            grammarScore: ts.grammarScore,
            vocabularyScore: ts.vocabularyScore,
            readingScore: ts.readingScore,
            writingScore: ts.writingScore,
            completedAt: ts.completedAt?.toISOString() ?? null,
          })),
          attendanceRate:
            s.attendance.length > 0
              ? Math.round(
                  (s.attendance.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length /
                    s.attendance.length) *
                    100,
                )
              : null,
        })),
      }
    },
    ['teacher-students', teacherId],
    { revalidate: 30, tags: [`teacher-${teacherId}-students`] },
  )()

export default async function TeacherStudentsPage() {
  const pageStart = performance.now()

  const authStart = performance.now()
  const user = await getCurrentUser()
  console.log(`  [쿼리1] getCurrentUser: ${(performance.now() - authStart).toFixed(0)}ms`)
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const dataStart = performance.now()
  const { classes, students } = await getCachedTeacherStudents(user.id)
  console.log(`  [쿼리2] getCachedTeacherStudents: ${(performance.now() - dataStart).toFixed(0)}ms`)

  const totalTime = performance.now() - pageStart
  console.log(`📊 [TeacherStudentsPage] 전체 서버 시간: ${totalTime.toFixed(0)}ms`)
  if (totalTime > 200) console.log(`⚠️ SLOW PAGE: ${totalTime.toFixed(0)}ms`)

  return (
    <StudentsClient
      classes={classes}
      students={students}
      teacherId={user.id}
    />
  )
}
