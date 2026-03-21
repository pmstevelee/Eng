import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import TeacherDetailClient from './_components/teacher-detail-client'
import type { TeacherPermissions } from '../actions'

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const owner = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  if (!owner || owner.role !== 'ACADEMY_OWNER' || !owner.academyId) redirect('/login')

  const { id: teacherId } = await params

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, academyId: owner.academyId, role: 'TEACHER', isDeleted: false },
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
  })

  if (!teacher) notFound()

  // 담당 학생들의 최근 테스트 세션 평균 점수
  const studentIds = await prisma.student
    .findMany({
      where: { classId: { in: teacher.taughtClasses.map((c) => c.id) } },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id))

  const avgScoreResult =
    studentIds.length > 0
      ? await prisma.testSession.aggregate({
          where: {
            studentId: { in: studentIds },
            status: 'GRADED',
            score: { not: null },
          },
          _avg: { score: true },
        })
      : null

  // 학원 전체 반 목록 (배정 가능한 반)
  const allClasses = await prisma.class.findMany({
    where: { academyId: owner.academyId, isActive: true },
    select: { id: true, name: true, teacherId: true },
    orderBy: { name: 'asc' },
  })

  // 교사 권한 (academy.settingsJson에서 읽기)
  const academy = await prisma.academy.findUnique({
    where: { id: owner.academyId },
    select: { settingsJson: true },
  })
  const settingsJson = (academy?.settingsJson as Record<string, unknown>) ?? {}
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
    createdAt: teacher.createdAt.toISOString(),
    classes: teacher.taughtClasses.map((c) => ({
      id: c.id,
      name: c.name,
      studentCount: c._count.students,
    })),
    totalStudents: teacher.taughtClasses.reduce((sum, c) => sum + c._count.students, 0),
    testCount: teacher._count.createdTests,
    avgScore: avgScoreResult?._avg.score ?? null,
  }

  const allClassData = allClasses.map((c) => ({
    id: c.id,
    name: c.name,
    currentTeacherId: c.teacherId,
  }))

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
        allClasses={allClassData}
        permissions={permissions}
      />
    </div>
  )
}
