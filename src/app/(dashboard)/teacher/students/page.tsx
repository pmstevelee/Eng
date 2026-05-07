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

      // 1단계: 반과 학생 본체(+최근 2개 세션)를 동시 로드
      const [classes, students] = await Promise.all([
        prisma.class.findMany({
          where: { teacherId, isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, levelRange: true },
        }),
        prisma.student.findMany({
          where: { class: { teacherId }, status: 'ACTIVE' },
          select: {
            id: true,
            currentLevel: true,
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
                listeningScore: true,
                writingScore: true,
                completedAt: true,
              },
            },
          },
          orderBy: { user: { name: 'asc' } },
        }),
      ])

      // 2단계: 출석 통계는 학생별 raw row 로딩 대신 DB groupBy 집계로 한 번에 계산
      // (학생수 × 월별 출석일수 = 수십~수백 rows → 학생별 status 카운트만)
      const studentIds = students.map((s) => s.id)
      const attendanceAgg =
        studentIds.length > 0
          ? await prisma.attendance.groupBy({
              by: ['studentId', 'status'],
              where: { studentId: { in: studentIds }, date: { gte: monthStart } },
              _count: { id: true },
            })
          : []

      const attRateById: Record<string, number | null> = {}
      const tally: Record<string, { present: number; total: number }> = {}
      for (const r of attendanceAgg) {
        const t = tally[r.studentId] ?? (tally[r.studentId] = { present: 0, total: 0 })
        t.total += r._count.id
        if (r.status === 'PRESENT' || r.status === 'LATE') t.present += r._count.id
      }
      for (const id of studentIds) {
        const t = tally[id]
        attRateById[id] = t && t.total > 0 ? Math.round((t.present / t.total) * 100) : null
      }

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
            listeningScore: ts.listeningScore ?? null,
            writingScore: ts.writingScore,
            completedAt: ts.completedAt?.toISOString() ?? null,
          })),
          attendanceRate: attRateById[s.id] ?? null,
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
