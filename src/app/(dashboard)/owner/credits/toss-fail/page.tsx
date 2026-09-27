import Link from 'next/link'
import { RefreshCw, XCircle } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ code?: string; message?: string }>
}

export default async function NotificationCreditTossFailPage({ searchParams }: PageProps) {
  const params = await searchParams
  const code = params.code ?? 'UNKNOWN'
  const isCanceled = code === 'PAY_PROCESS_CANCELED'

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <XCircle size={36} className="text-accent-red" />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-gray-900">
          {isCanceled ? '결제가 취소되었습니다' : '크레딧 충전 결제에 실패했습니다'}
        </h1>
        <p className="mt-2 text-gray-500">
          {isCanceled ? '결제창을 닫으셨습니다. 다시 시도하려면 아래 버튼을 눌러주세요.' : (params.message ?? '결제 처리 중 오류가 발생했습니다.')}
        </p>
        {!isCanceled && <p className="mt-1 text-sm text-gray-400">오류 코드: {code}</p>}
        <Link
          href="/owner/credits#charge"
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-primary-700 px-5 text-sm font-semibold text-white hover:bg-primary-800"
        >
          <RefreshCw size={16} /> 다시 시도하기
        </Link>
      </div>
    </div>
  )
}
