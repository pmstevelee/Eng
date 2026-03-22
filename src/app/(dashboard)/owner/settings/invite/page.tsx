import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { InviteCodeClient } from './_components/invite-code-client'

export default async function InviteSettingsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const academy = await prisma.academy.findUnique({
    where: { id: user.academyId },
    select: { inviteCode: true },
  })

  const [teacherCount, studentCount] = await Promise.all([
    prisma.user.count({
      where: { academyId: user.academyId, role: 'TEACHER', isDeleted: false },
    }),
    prisma.user.count({
      where: { academyId: user.academyId, role: 'STUDENT', isDeleted: false },
    }),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">초대 코드</h2>
        <p className="text-sm text-gray-500 mt-1">교사와 학생이 이 코드로 학원에 가입합니다.</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <InviteCodeClient
          inviteCode={academy?.inviteCode ?? ''}
          teacherCount={teacherCount}
          studentCount={studentCount}
        />
      </div>
    </div>
  )
}
