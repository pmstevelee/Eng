import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { getOwnerBranches } from '@/lib/branch'
import { PLANS } from '@/lib/pricing'
import { BranchesClient } from './_components/branches-client'

// 본원+지점 통계를 단일 병렬 웨이브(4쿼리)로 조회하고 60초 캐싱한다.
// (기존: 지점별 count 쿼리를 순차 웨이브로 실행해 원격 DB에서 4초 이상 소요)
const getCachedBranchStats = (ownerId: string, allIds: string[]) =>
  unstable_cache(
    async () => {
      const [studentGroups, teacherGroups, classGroups, academyDetails] = await Promise.all([
        // 학원별 활성 학생 수
        prisma.user.groupBy({
          by: ['academyId'],
          where: { academyId: { in: allIds }, student: { status: 'ACTIVE' } },
          _count: { id: true },
        }),
        // 학원별 교사 수
        prisma.user.groupBy({
          by: ['academyId'],
          where: { academyId: { in: allIds }, role: 'TEACHER', isDeleted: false },
          _count: { id: true },
        }),
        // 학원별 활성 반 수
        prisma.class.groupBy({
          by: ['academyId'],
          where: { academyId: { in: allIds }, isActive: true },
          _count: { id: true },
        }),
        // 주소/전화번호
        prisma.academy.findMany({
          where: { id: { in: allIds } },
          select: { id: true, address: true, phone: true },
        }),
      ])
      return { studentGroups, teacherGroups, classGroups, academyDetails }
    },
    ['owner-branch-stats', ownerId, allIds.join(',')],
    { revalidate: 60, tags: [`owner-${ownerId}-branches`] },
  )()

export default async function BranchesPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')

  const branchData = await getOwnerBranches(user.id)
  if (!branchData) redirect('/owner')

  const { hq, branches, plan, canManage } = branchData
  const planConfig = PLANS[plan]

  const allIds = [hq.id, ...branches.map((b) => b.id)]
  const { studentGroups, teacherGroups, classGroups, academyDetails } =
    await getCachedBranchStats(user.id, allIds)

  const countByAcademy = (groups: { academyId: string | null; _count: { id: number } }[]) => {
    const map = new Map<string, number>()
    groups.forEach((g) => {
      if (g.academyId) map.set(g.academyId, g._count.id)
    })
    return map
  }
  const studentMap = countByAcademy(studentGroups)
  const teacherMap = countByAcademy(teacherGroups)
  const classMap = countByAcademy(classGroups)
  const detailMap = new Map(academyDetails.map((d) => [d.id, d]))

  const branchesWithStats = branches.map((b) => ({
    id: b.id,
    name: b.name,
    branchName: b.branchName,
    address: detailMap.get(b.id)?.address ?? null,
    phone: detailMap.get(b.id)?.phone ?? null,
    _count: { users: 0, classes: classMap.get(b.id) ?? 0 },
    studentCount: studentMap.get(b.id) ?? 0,
    teacherCount: teacherMap.get(b.id) ?? 0,
  }))

  const hqStudents = studentMap.get(hq.id) ?? 0
  const hqTeachers = teacherMap.get(hq.id) ?? 0
  const totalStudents = hqStudents + branchesWithStats.reduce((s, b) => s + b.studentCount, 0)
  const totalTeachers = hqTeachers + branchesWithStats.reduce((s, b) => s + b.teacherCount, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">지점 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          본원과 지점을 한곳에서 관리하세요. 학생/교사 한도는 전체 합산으로 적용됩니다.
        </p>
      </div>

      <BranchesClient
        hq={{
          id: hq.id,
          name: hq.name,
          address: detailMap.get(hq.id)?.address ?? null,
          phone: detailMap.get(hq.id)?.phone ?? null,
          _count: { users: 0, classes: classMap.get(hq.id) ?? 0 },
          studentCount: hqStudents,
          teacherCount: hqTeachers,
        }}
        branches={branchesWithStats}
        canManage={canManage}
        totalStudents={totalStudents}
        maxStudents={planConfig.studentLimit}
        totalTeachers={totalTeachers}
        maxTeachers={planConfig.teacherLimit}
      />
    </div>
  )
}
