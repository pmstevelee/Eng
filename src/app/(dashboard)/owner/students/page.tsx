import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import StudentsListClient from './_components/students-list-client'

const PAGE_SIZE = 20

type SearchParams = {
  q?: string
  classId?: string
  status?: string
  page?: string
}

export default async function OwnerStudentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  // getCurrentUser()는 layout에서 이미 호출됨 → cache()로 즉시 반환
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const params = await searchParams
  const query = params.q?.trim() ?? ''
  const classIdFilter = params.classId ?? ''
  const statusFilter = params.status ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10))

  type StudentWhere = {
    user: {
      academyId: string
      isDeleted: boolean
      OR?: Array<{ name: { contains: string; mode: 'insensitive' } } | { email: { contains: string; mode: 'insensitive' } }>
    }
    classId?: string | null
    status?: 'ACTIVE' | 'ON_LEAVE' | 'WITHDRAWN'
  }

  const where: StudentWhere = {
    user: {
      academyId: user.academyId,
      isDeleted: false,
    },
  }

  if (query) {
    where.user.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
    ]
  }

  if (classIdFilter === 'unassigned') {
    where.classId = null
  } else if (classIdFilter) {
    where.classId = classIdFilter
  }

  if (statusFilter === 'ACTIVE' || statusFilter === 'ON_LEAVE' || statusFilter === 'WITHDRAWN') {
    where.status = statusFilter
  }

  // 모든 쿼리를 한 번에 병렬 실행
  const [classes, [totalCount, students], academy, totalStudents] = await Promise.all([
    prisma.class.findMany({
      where: { academyId: user.academyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          currentLevel: true,
          status: true,
          createdAt: true,
          classId: true,
          class: { select: { id: true, name: true } },
          user: { select: { name: true, email: true } },
        },
      }),
    ]),
    prisma.academy.findUnique({
      where: { id: user.academyId },
      select: { maxStudents: true, subscriptionStatus: true },
    }),
    prisma.student.count({
      where: { user: { academyId: user.academyId, isDeleted: false } },
    }),
  ])

  const studentData = students.map((s) => ({
    id: s.id,
    name: s.user.name,
    email: s.user.email,
    className: s.class?.name ?? null,
    classId: s.classId,
    currentLevel: s.currentLevel,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
  }))

  const classData = classes.map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <Users size={20} className="text-primary-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">학생 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">가입한 학생을 관리하고 반을 배정하세요.</p>
          </div>
        </div>

        {/* 학생 수 현황 */}
        <div className="text-right">
          <p className="text-sm text-gray-500">등록 학생</p>
          <p className="text-lg font-bold text-gray-900">
            {totalStudents}
            <span className="text-sm font-normal text-gray-400"> / {academy?.maxStudents ?? 10}명</span>
          </p>
          {academy && totalStudents >= academy.maxStudents && (
            <Link
              href="/owner/settings/subscription"
              className="text-xs text-accent-red font-medium hover:underline"
            >
              정원 초과 — 업그레이드 필요
            </Link>
          )}
        </div>
      </div>

      {/* 정원 초과 배너 */}
      {academy && totalStudents >= academy.maxStudents && (
        <div className="bg-accent-red-light border border-accent-red rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-accent-red font-medium">
            현재 플랜의 최대 학생 수({academy.maxStudents}명)에 도달했습니다. 새 학생의 초대 코드 가입이 차단됩니다.
          </p>
          <Link
            href="/owner/settings/subscription"
            className="text-sm font-semibold text-accent-red underline whitespace-nowrap ml-4"
          >
            플랜 업그레이드
          </Link>
        </div>
      )}

      <StudentsListClient
        students={studentData}
        classes={classData}
        totalCount={totalCount}
        page={page}
        pageSize={PAGE_SIZE}
        initialQuery={query}
        initialClassId={classIdFilter}
        initialStatus={statusFilter}
      />
    </div>
  )
}
