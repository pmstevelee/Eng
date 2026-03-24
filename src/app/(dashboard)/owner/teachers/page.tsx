import { redirect } from 'next/navigation'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { UserCheck } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import TeachersListClient from './_components/teachers-list-client'

const PAGE_SIZE = 20

type SearchParams = {
  q?: string
  page?: string
}

// 자주 바뀌지 않는 정적 데이터: 학원 정보 + 전체 교사 수 (60초 캐싱)
const getStaticTeachersPageData = (academyId: string) =>
  unstable_cache(
    async () => {
      const [academy, totalTeachers] = await Promise.all([
        prisma.academy.findUnique({
          where: { id: academyId },
          select: { maxTeachers: true, subscriptionStatus: true },
        }),
        prisma.user.count({
          where: { academyId, role: 'TEACHER', isDeleted: false },
        }),
      ])
      return { academy, totalTeachers }
    },
    ['owner-teachers-static', academyId],
    { revalidate: 60, tags: [`academy-${academyId}-teachers`] },
  )()

export default async function OwnerTeachersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  // getCurrentUser()는 layout에서 이미 호출됨 → cache()로 즉시 반환
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const params = await searchParams
  const query = params.q?.trim() ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10))

  type TeacherWhere = {
    academyId: string
    role: 'TEACHER'
    isDeleted: boolean
    OR?: Array<
      | { name: { contains: string; mode: 'insensitive' } }
      | { email: { contains: string; mode: 'insensitive' } }
    >
  }

  const where: TeacherWhere = {
    academyId: user.academyId,
    role: 'TEACHER',
    isDeleted: false,
  }

  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
    ]
  }

  // 정적 데이터(캐싱)와 동적 쿼리를 병렬 실행
  const [{ academy, totalTeachers }, [totalCount, teachers]] = await Promise.all([
    getStaticTeachersPageData(user.academyId),
    Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          taughtClasses: {
            where: { isActive: true },
            select: { id: true, name: true },
          },
        },
      }),
    ]),
  ])

  const teacherData = teachers.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    createdAt: t.createdAt.toISOString(),
    classes: t.taughtClasses.map((c) => ({ id: c.id, name: c.name })),
  }))

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <UserCheck size={20} className="text-primary-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">교사 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">초대 코드로 가입한 교사를 관리하세요.</p>
          </div>
        </div>

        {/* 교사 수 현황 */}
        <div className="text-right">
          <p className="text-sm text-gray-500">등록 교사</p>
          <p className="text-lg font-bold text-gray-900">
            {totalTeachers}
            <span className="text-sm font-normal text-gray-400">
              {' '}
              / {academy?.maxTeachers ?? 2}명
            </span>
          </p>
          {academy && totalTeachers >= academy.maxTeachers && (
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
      {academy && totalTeachers >= academy.maxTeachers && (
        <div className="bg-accent-red-light border border-accent-red rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-accent-red font-medium">
            현재 플랜의 최대 교사 수({academy.maxTeachers}명)에 도달했습니다. 새 교사의 초대 코드
            가입이 차단됩니다.
          </p>
          <Link
            href="/owner/settings/subscription"
            className="text-sm font-semibold text-accent-red underline whitespace-nowrap ml-4"
          >
            플랜 업그레이드
          </Link>
        </div>
      )}

      <TeachersListClient
        teachers={teacherData}
        totalCount={totalCount}
        page={page}
        pageSize={PAGE_SIZE}
        initialQuery={query}
      />
    </div>
  )
}
