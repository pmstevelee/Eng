import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { InviteCodeClient } from './_components/invite-code-client'

const getInvitePageData = (academyId: string) =>
  unstable_cache(
    async () => {
      const [academy, teacherCount, studentCount] = await Promise.all([
        prisma.academy.findUnique({ where: { id: academyId }, select: { inviteCode: true } }),
        prisma.user.count({ where: { academyId, role: 'TEACHER', isDeleted: false } }),
        prisma.user.count({ where: { academyId, role: 'STUDENT', isDeleted: false } }),
      ])
      return { inviteCode: academy?.inviteCode ?? '', teacherCount, studentCount }
    },
    [`invite-page-${academyId}`],
    { revalidate: 60, tags: [`academy-${academyId}`] },
  )()

export default async function InviteSettingsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const { inviteCode, teacherCount, studentCount } = await getInvitePageData(user.academyId)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">초대 코드</h2>
        <p className="text-sm text-gray-500 mt-1">교사와 학생이 이 코드로 학원에 가입합니다.</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <InviteCodeClient
          inviteCode={inviteCode}
          teacherCount={teacherCount}
          studentCount={studentCount}
        />
      </div>
    </div>
  )
}
