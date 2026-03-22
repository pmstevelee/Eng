import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { WithdrawModal } from '../_components/withdraw-modal'

export default async function WithdrawPage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: {
      role: true,
      academy: { select: { name: true, businessName: true } },
    },
  })
  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')

  const displayName = user.academy?.businessName ?? user.academy?.name ?? '학원'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">계정 탈퇴</h2>
        <p className="text-sm text-gray-500 mt-1">학원 계정을 영구 삭제합니다.</p>
      </div>

      <div className="bg-white rounded-xl border border-red-200 p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-red-600">위험 구역</h3>
          <p className="text-sm text-gray-600 mt-1">
            학원을 탈퇴하면 학원에 속한 모든 교사, 학생, 테스트, 성적 데이터가
            <span className="font-medium text-gray-900"> 영구적으로 삭제</span>됩니다.
            이 작업은 되돌릴 수 없습니다.
          </p>
        </div>

        <ul className="space-y-1.5 text-sm text-gray-600">
          {[
            '학원 정보 및 설정',
            '교사 및 학생 계정',
            '모든 테스트와 문제',
            '학생 성적 및 분석 데이터',
            '구독 이력',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        <div className="pt-2 border-t border-red-100">
          <WithdrawModal academyName={displayName} />
        </div>
      </div>
    </div>
  )
}
