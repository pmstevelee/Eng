import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { PasswordResetSection } from './_components/password-reset-section'
import { PasswordChangedToast } from './_components/password-changed-toast'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start py-3 border-b border-gray-100 last:border-0">
      <span className="w-36 flex-shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value}</span>
    </div>
  )
}

function AgreeBadge({ agreed }: { agreed: boolean }) {
  return agreed ? (
    <span className="inline-flex items-center gap-1 text-green-700 text-sm">
      <span className="text-base">✓</span> 동의
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-gray-400 text-sm">
      <span className="text-base">–</span> 미동의
    </span>
  )
}

const getAccountData = (userId: string) =>
  unstable_cache(
    async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId, isDeleted: false },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          agreedTerms: true,
          agreedPrivacy: true,
          agreedMarketing: true,
          academy: {
            select: {
              businessName: true,
              name: true,
              address: true,
              phone: true,
              planType: true,
              subscriptionPlan: true,
              trialEndsAt: true,
              createdAt: true,
            },
          },
        },
      })
      if (!user) return null
      return {
        ...user,
        createdAt: user.createdAt.toISOString(),
        academy: user.academy
          ? {
              ...user.academy,
              createdAt: user.academy.createdAt.toISOString(),
              trialEndsAt: user.academy.trialEndsAt?.toISOString() ?? null,
            }
          : null,
      }
    },
    [`account-page-${userId}`],
    { revalidate: 60, tags: [`user-${userId}`] },
  )()

export default async function AccountPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'ACADEMY_OWNER') redirect('/login')

  const user = await getAccountData(currentUser.id)
  if (!user) redirect('/login')

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date))

  const planLabel: Record<string, string> = {
    BASIC: 'Basic',
    STANDARD: 'Standard',
    PREMIUM: 'Premium',
  }

  return (
    <div className="space-y-5">
      <Suspense fallback={null}>
        <PasswordChangedToast />
      </Suspense>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">계정 정보</h2>
        <div>
          <InfoRow label="이름" value={user.name} />
          <InfoRow label="이메일" value={user.email} />
          <InfoRow label="전화번호" value={user.phone ?? <span className="text-gray-400">미입력</span>} />
          <InfoRow label="가입일" value={formatDate(user.createdAt)} />
        </div>
      </div>

      {user.academy && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">학원 가입 정보</h2>
          <div>
            <InfoRow
              label="상호명"
              value={user.academy.businessName ?? <span className="text-gray-400">미입력</span>}
            />
            <InfoRow
              label="학원 주소"
              value={user.academy.address ?? <span className="text-gray-400">미입력</span>}
            />
            <InfoRow
              label="학원 전화번호"
              value={user.academy.phone ?? <span className="text-gray-400">미입력</span>}
            />
            <InfoRow
              label="가입 요금제"
              value={planLabel[user.academy.subscriptionPlan as string] ?? user.academy.subscriptionPlan}
            />
            <InfoRow label="학원 등록일" value={formatDate(user.academy.createdAt)} />
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">약관 동의 현황</h2>
        <div>
          <InfoRow label="이용약관 (필수)" value={<AgreeBadge agreed={user.agreedTerms} />} />
          <InfoRow
            label="개인정보 처리방침 (필수)"
            value={<AgreeBadge agreed={user.agreedPrivacy} />}
          />
          <InfoRow
            label="마케팅 수신 (선택)"
            value={<AgreeBadge agreed={user.agreedMarketing} />}
          />
        </div>
      </div>

      <PasswordResetSection email={user.email} />
    </div>
  )
}
