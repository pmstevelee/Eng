import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import TeacherDetailClient from './_components/teacher-detail-client'
import type { TeacherPermissions } from '../actions'

const getTeacherDetail = (academyId: string, teacherId: string) =>
  unstable_cache(
    async () => {
      // teacher, allClasses, academy를 병렬로 조회
      const [teacher, allClasses, academy] = await Promise.all([
        prisma.user.findFirst({
          where: { id: teacherId, academyId, role: 'TEACHER', isDeleted: false },
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            taughtClasses: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                _count: { select: { students: true } },
              },
            },
            _count: {
              select: { createdTests: true },
            },
          },
        }),
        prisma.class.findMany({
          where: { academyId, isActive: true },
          select: { id: true, name: true, teacherId: true },
          orderBy: { name: 'asc' },
        }),
        prisma.academy.findUnique({
          where: { id: academyId },
          select: { settingsJson: true },
        }),
      ])

      if (!teacher) return null

      // 중간 studentIds 쿼리 제거 — 중첩 where로 직접 집계
      const classIds = teacher.taughtClasses.map((c) => c.id)
      const avgScoreResult =
        classIds.length > 0
          ? await prisma.testSession.aggregate({
              where: {
                student: { classId: { in: classIds } },
                status: 'GRADED',
                score: { not: null },
              },
              _avg: { score: true },
            })
          : null

      return {
        teacher: {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          createdAt: teacher.createdAt.toISOString(),
          taughtClasses: teacher.taughtClasses.map((c) => ({
            id: c.id,
            name: c.name,
            studentCount: c._count.students,
          })),
          testCount: teacher._count.createdTests,
          avgScore: avgScoreResult?._avg.score ?? null,
        },
        allClasses: allClasses.map((c) => ({
          id: c.id,
          name: c.name,
          currentTeacherId: c.teacherId,
        })),
        settingsJson: (academy?.settingsJson as Record<string, unknown>) ?? {},
      }
    },
    ['owner-teacher-detail', academyId, teacherId],
    { revalidate: 30, tags: [`academy-${academyId}-teachers`, `teacher-${teacherId}`] },
  )()

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const owner = await getCurrentUser()
  if (!owner || owner.role !== 'ACADEMY_OWNER' || !owner.academyId) redirect('/login')

  const { id: teacherId } = await params

  const data = await getTeacherDetail(owner.academyId, teacherId)
  if (!data) notFound()

  const { teacher, allClasses, settingsJson } = data

  const teacherPermissionsMap =
    (settingsJson.teacherPermissions as Record<string, TeacherPermissions>) ?? {}
  const permissions: TeacherPermissions = teacherPermissionsMap[teacherId] ?? {
    canCreateQuestions: false,
    canEditGrades: false,
  }

  const teacherData = {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    createdAt: teacher.createdAt,
    classes: teacher.taughtClasses,
    totalStudents: teacher.taughtClasses.reduce((sum, c) => sum + c.studentCount, 0),
    testCount: teacher.testCount,
    avgScore: teacher.avgScore,
  }

  return (
    <div className="space-y-6">
      {/* 뒤로 가기 */}
      <Link
        href="/owner/teachers"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ChevronLeft size={16} />
        교사 목록
      </Link>

      <TeacherDetailClient
        teacher={teacherData}
        allClasses={allClasses}
        permissions={permissions}
      />
    </div>
  )
}
