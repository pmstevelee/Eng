import Link from 'next/link'
import { XCircle, RefreshCw, HeadphonesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageProps {
  searchParams: Promise<{ plan?: string; cycle?: string; reason?: string }>
}

export default async function BillingFailedPage({ searchParams }: PageProps) {
  const params = await searchParams
  const plan = params.plan
  const cycle = params.cycle
  const reason = params.reason

  const retryUrl =
    plan && cycle
      ? `/owner/billing/checkout?plan=${plan}&cycle=${cycle}`
      : '/owner/billing/plans'

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        {/* 실패 아이콘 */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
            <XCircle className="h-12 w-12 text-accent-red" />
          </div>
        </div>

        {/* 제목 */}
        <h1 className="mb-3 text-2xl font-bold text-gray-900">결제가 실패했습니다</h1>

        {/* 실패 이유 */}
        <p className="mb-2 text-gray-500">
          {reason
            ? reason
            : '카드 정보 확인 또는 한도 초과로 결제가 완료되지 않았습니다.'}
        </p>
        <p className="mb-8 text-sm text-gray-400">
          결제 금액은 청구되지 않았습니다.
        </p>

        {/* 자주 있는 원인 */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-5 text-left">
          <p className="mb-3 text-sm font-semibold text-gray-700">자주 있는 실패 원인</p>
          <ul className="flex flex-col gap-1.5 text-sm text-gray-600">
            {[
              '카드 한도 초과',
              '해외 결제 차단 설정',
              '카드 비밀번호 또는 생년월일 오류',
              '카드사 일시적 오류',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="bg-primary-700 hover:bg-primary-800 text-white h-11">
            <Link href={retryUrl}>
              <RefreshCw className="mr-2 h-4 w-4" />
              다시 결제하기
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="mailto:support@wigoup.com">
              <HeadphonesIcon className="mr-2 h-4 w-4" />
              고객 지원
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
