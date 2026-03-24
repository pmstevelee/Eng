import { Skeleton } from '@/components/ui/skeleton'

export default function OwnerTestsLoading() {
  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-t-md" />
        ))}
      </div>

      {/* 검색 + 필터 */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 flex-1 max-w-sm rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      {/* 테이블 */}
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={`h-3 ${i === 0 ? 'w-36' : 'flex-1'}`} />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 flex items-center gap-4 border-b border-gray-100 last:border-0">
            <Skeleton className="h-4 w-36 shrink-0" />
            <Skeleton className="h-5 w-16 rounded-full flex-1" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
