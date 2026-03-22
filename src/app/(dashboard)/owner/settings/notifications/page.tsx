import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { NotificationsClient } from './_components/notifications-client'

const DEFAULT_SETTINGS = {
  newTeacherJoin: true,
  newStudentJoin: true,
  testCompleted: false,
  subscriptionExpiring: true,
}

export default async function NotificationsSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: {
      role: true,
      academy: { select: { settingsJson: true } },
    },
  })
  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')

  const json =
    user.academy?.settingsJson &&
    typeof user.academy.settingsJson === 'object' &&
    !Array.isArray(user.academy.settingsJson)
      ? (user.academy.settingsJson as Record<string, unknown>)
      : {}

  const saved =
    json.notifications &&
    typeof json.notifications === 'object' &&
    !Array.isArray(json.notifications)
      ? (json.notifications as Record<string, unknown>)
      : {}

  const settings = {
    newTeacherJoin:
      typeof saved.newTeacherJoin === 'boolean' ? saved.newTeacherJoin : DEFAULT_SETTINGS.newTeacherJoin,
    newStudentJoin:
      typeof saved.newStudentJoin === 'boolean' ? saved.newStudentJoin : DEFAULT_SETTINGS.newStudentJoin,
    testCompleted:
      typeof saved.testCompleted === 'boolean' ? saved.testCompleted : DEFAULT_SETTINGS.testCompleted,
    subscriptionExpiring: true,
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">알림 설정</h2>
        <p className="text-sm text-gray-500 mt-1">학원 운영과 관련된 알림을 관리합니다.</p>
      </div>
      <NotificationsClient initialSettings={settings} />
    </div>
  )
}
