import Link from 'next/link'
import { CheckCircle2, ArrowRight, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLAN_DISPLAY_NAMES, BILLING_CYCLE_DISPLAY_NAMES } from '@/lib/pricing'
import type { Plan, BillingCycle } from '@/generated/prisma'

interface PageProps {
  searchParams: Promise<{ plan?: string; cycle?: string; free?: string }>
}

export default async function BillingSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams
  const plan = params.plan as Plan | undefined
  const billingCycle = params.cycle as BillingCycle | undefined
  const isFree = params.free === '1'

  const planName = plan ? PLAN_DISPLAY_NAMES[plan] : null
  const cycleName = billingCycle ? BILLING_CYCLE_DISPLAY_NAMES[billingCycle] : null

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        {/* 성공 아이콘 */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 className="h-12 w-12 text-accent-green" />
          </div>
        </div>

        {/* 제목 */}
        <h1 className="mb-3 text-2xl font-bold text-gray-900">
          {isFree ? '무료 플랜이 활성화되었습니다' : '결제가 완료되었습니다!'}
        </h1>

        {/* 부제목 */}
        {isFree ? (
          <p className="mb-8 text-gray-500">
            무료 플랜으로 위고업잉글리시를 시작하세요.
            <br />
            언제든지 유료 플랜으로 업그레이드할 수 있습니다.
          </p>
        ) : planName && cycleName ? (
          <p className="mb-8 text-gray-500">
            <span className="font-semibold text-gray-700">{planName}</span> 플랜{' '}
            <span className="font-semibold text-gray-700">{cycleName}</span> 구독이 시작되었습니다.
            <br />
            모든 기능을 자유롭게 사용하세요.
          </p>
        ) : (
          <p className="mb-8 text-gray-500">
            구독이 성공적으로 활성화되었습니다.
          </p>
        )}

        {/* 다음 단계 카드 */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-5 text-left">
          <p className="mb-3 text-sm font-semibold text-gray-700">다음 단계</p>
          <ul className="flex flex-col gap-2">
            {[
              '교사 계정 초대코드 발급',
              '학생 등록 및 반 편성',
              '레벨 테스트 생성 및 배포',
            ].map((step, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-700/10 text-xs font-bold text-primary-700">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA 버튼 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="bg-primary-700 hover:bg-primary-800 text-white h-11">
            <Link href="/owner">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              대시보드로 이동
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="/owner/settings">
              구독 관리
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
