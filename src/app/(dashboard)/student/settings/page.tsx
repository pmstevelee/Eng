import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { requireStudent } from '@/lib/auth-student'
import { WithdrawModal } from './_components/withdraw-modal'

const getCachedSettingsUser = (userId: string) =>
  unstable_cache(
    () =>
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          phone: true,
          academy: { select: { name: true, businessName: true } },
          student: { select: { grade: true, currentLevel: true } },
        },
      }),
    ['student-settings-user', userId],
    { revalidate: 300, tags: [`user-${userId}`] },
  )()

export default async function StudentSettingsPage() {
  const { userId } = await requireStudent()
  const user = await getCachedSettingsUser(userId)
  if (!user) return null

  const academyName = user.academy?.businessName ?? user.academy?.name ?? '-'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-sm text-gray-500 mt-1">계정 설정을 관리합니다</p>
      </div>

      {/* 계정 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">계정 정보</h2>
        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-gray-500">이름</dt>
            <dd className="text-sm font-medium text-gray-900 mt-0.5">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">이메일</dt>
            <dd className="text-sm text-gray-700 mt-0.5">{user.email}</dd>
          </div>
          {user.phone && (
            <div>
              <dt className="text-xs text-gray-500">연락처</dt>
              <dd className="text-sm text-gray-700 mt-0.5">{user.phone}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-gray-500">소속 학원</dt>
            <dd className="text-sm text-gray-700 mt-0.5">{academyName}</dd>
          </div>
          {user.student && (
            <div>
              <dt className="text-xs text-gray-500">현재 레벨</dt>
              <dd className="text-sm text-gray-700 mt-0.5">Level {user.student.currentLevel}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* 위험 구역 */}
      <div className="bg-accent-red-light border border-accent-red rounded-xl p-6">
        <h2 className="text-base font-semibold text-accent-red mb-2">위험 구역</h2>
        <p className="text-sm text-gray-700 mb-4">
          계정을 탈퇴하면 내 모든 학습 기록, 성적, 배지 등 관련 데이터가 영구적으로 삭제됩니다.
          이 작업은 되돌릴 수 없습니다.
        </p>
        <WithdrawModal />
      </div>
    </div>
  )
}
