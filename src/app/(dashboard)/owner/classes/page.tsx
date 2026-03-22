import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Sparkles } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import ClassesListClient from './_components/classes-list-client'
import type { ScheduleData } from './actions'

function parseSchedule(json: unknown): ScheduleData | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const obj = json as Record<string, unknown>
  return {
    days: Array.isArray(obj.days) ? (obj.days as string[]) : [],
    startTime: typeof obj.startTime === 'string' ? obj.startTime : '',
    endTime: typeof obj.endTime === 'string' ? obj.endTime : '',
    room: typeof obj.room === 'string' ? obj.room : '',
  }
}

export default async function OwnerClassesPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const [classes, teachers] = await Promise.all([
    prisma.class.findMany({
      where: { academyId: user.academyId },
      orderBy: { createdAt: 'desc' },
      include: {
        teacher: { select: { id: true, name: true } },
        students: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            testSessions: {
              where: { score: { not: null } },
              select: { score: true },
              orderBy: { completedAt: 'desc' },
              take: 5,
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { academyId: user.academyId, role: 'TEACHER', isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const classData = classes.map((c) => {
    const allScores = c.students.flatMap((s) => s.testSessions.map((ts) => ts.score!))
    const avgScore =
      allScores.length > 0
        ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
        : null

    return {
      id: c.id,
      name: c.name,
      levelRange: c.levelRange,
      isActive: c.isActive,
      teacherName: c.teacher?.name ?? null,
      teacherId: c.teacherId,
      studentCount: c.students.length,
      avgScore,
      schedule: parseSchedule(c.scheduleJson),
    }
  })

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <BookOpen size={20} className="text-primary-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">반 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              반을 생성하고 학생을 배정하세요.
            </p>
          </div>
        </div>

        <Link
          href="/owner/classes/auto-assign"
          className="flex items-center gap-2 px-4 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Sparkles size={16} className="text-accent-purple" />
          AI 반 편성 추천
        </Link>
      </div>

      <ClassesListClient
        initialClasses={classData}
        teachers={teachers.map((t) => ({ id: t.id, name: t.name }))}
      />
    </div>
  )
}
