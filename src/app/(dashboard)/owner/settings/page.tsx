import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { WithdrawModal } from './_components/withdraw-modal'
import { InviteCodeSection } from './_components/invite-code-section'

export default async function OwnerSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: {
      name: true,
      email: true,
      role: true,
      academy: { select: { name: true, businessName: true, inviteCode: true } },
    },
  })
  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')

  const displayName = user.academy?.businessName ?? user.academy?.name ?? '학원'

  return (
    <div className="space-y-6">
      {/* 학원 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">학원 정보</h2>
        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-gray-500">학원명</dt>
            <dd className="text-sm font-medium text-gray-900 mt-0.5">{displayName}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">학원장</dt>
            <dd className="text-sm text-gray-700 mt-0.5">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">이메일</dt>
            <dd className="text-sm text-gray-700 mt-0.5">{user.email}</dd>
          </div>
        </dl>
      </div>

      {/* 초대 코드 관리 */}
      {user.academy?.inviteCode && (
        <InviteCodeSection inviteCode={user.academy.inviteCode} />
      )}

      {/* 위험 구역 */}
      <div className="bg-accent-red-light border border-accent-red rounded-xl p-6">
        <h2 className="text-base font-semibold text-accent-red mb-2">위험 구역</h2>
        <p className="text-sm text-gray-700 mb-4">
          학원을 탈퇴하면 학원에 속한 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
        </p>
        <WithdrawModal academyName={displayName} />
      </div>
    </div>
  )
}
