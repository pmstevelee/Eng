import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { StudentsClient } from './students-client'

export const metadata = { title: '학생 학습관리' }

export default async function TeacherStudentsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [classes, students] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId: user.id, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, levelRange: true },
    }),
    prisma.student.findMany({
      where: {
        class: { teacherId: user.id },
        status: 'ACTIVE',
      },
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

  const serializedStudents = students.map((s) => ({
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
              100
          )
        : null,
  }))

  return (
    <StudentsClient
      classes={classes}
      students={serializedStudents}
      teacherId={user.id}
    />
  )
}
