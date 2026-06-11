import Link from 'next/link'
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageProps {
  searchParams: Promise<{ code?: string; message?: string }>
}

export default async function TossFailPage({ searchParams }: PageProps) {
  const params = await searchParams
  const code = params.code ?? 'UNKNOWN'
  const message = params.message ?? '결제 처리 중 오류가 발생했습니다'

  const isCanceled = code === 'PAY_PROCESS_CANCELED'

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
            <XCircle className="h-12 w-12 text-accent-red" />
          </div>
        </div>

        <h1 className="mb-3 text-2xl font-bold text-gray-900">
          {isCanceled ? '결제가 취소되었습니다' : '카드 등록에 실패했습니다'}
        </h1>

        <p className="mb-2 text-gray-500">
          {isCanceled
            ? '결제창을 닫으셨습니다. 다시 시도하려면 아래 버튼을 눌러주세요.'
            : message}
        </p>

        {!isCanceled && (
          <p className="mb-8 text-sm text-gray-400">오류 코드: {code}</p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="bg-primary-700 hover:bg-primary-800 text-white h-11">
            <Link href="/owner/billing/plans">
              <RefreshCw className="mr-2 h-4 w-4" />
              다시 시도하기
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="/owner">
              <ArrowLeft className="mr-2 h-4 w-4" />
              대시보드로 이동
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
