import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { getOwnerBranches } from '@/lib/branch'
import { PLANS } from '@/lib/pricing'
import { BranchesClient } from './_components/branches-client'

export default async function BranchesPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')

  const branchData = await getOwnerBranches(user.id)
  if (!branchData) redirect('/owner')

  const { hq, branches, plan, canManage } = branchData
  const planConfig = PLANS[plan]

  // 본원 통계
  const [hqStudents, hqTeachers, hqClasses] = await Promise.all([
    prisma.student.count({ where: { user: { academyId: hq.id }, status: 'ACTIVE' } }),
    prisma.user.count({ where: { academyId: hq.id, role: 'TEACHER', isDeleted: false } }),
    prisma.class.count({ where: { academyId: hq.id, isActive: true } }),
  ])

  // 지점별 통계
  const branchesWithStats = await Promise.all(
    branches.map(async (b) => {
      const [studentCount, teacherCount, classes] = await Promise.all([
        prisma.student.count({ where: { user: { academyId: b.id }, status: 'ACTIVE' } }),
        prisma.user.count({ where: { academyId: b.id, role: 'TEACHER', isDeleted: false } }),
        prisma.class.count({ where: { academyId: b.id, isActive: true } }),
      ])
      return {
        id: b.id,
        name: b.name,
        branchName: b.branchName,
        address: null as string | null,
        phone: null as string | null,
        _count: { users: 0, classes },
        studentCount,
        teacherCount,
      }
    }),
  )

  // 지점 주소/전화번호 보완
  if (branches.length > 0) {
    const details = await prisma.academy.findMany({
      where: { id: { in: branches.map((b) => b.id) } },
      select: { id: true, address: true, phone: true },
    })
    details.forEach((d) => {
      const idx = branchesWithStats.findIndex((b) => b.id === d.id)
      if (idx !== -1) {
        branchesWithStats[idx].address = d.address
        branchesWithStats[idx].phone = d.phone
      }
    })
  }

  const hqDetail = await prisma.academy.findUnique({
    where: { id: hq.id },
    select: { address: true, phone: true },
  })

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
          address: hqDetail?.address ?? null,
          phone: hqDetail?.phone ?? null,
          _count: { users: 0, classes: hqClasses },
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
