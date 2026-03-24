import { Skeleton } from '@/components/ui/skeleton'

export default function OwnerStudentsLoading() {
  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      {/* 검색 + 필터 */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 flex-1 max-w-sm rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      {/* 테이블 */}
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex gap-6">
          {['이름', '반', '레벨', '최근 테스트', '평균 점수', ''].map((_, i) => (
            <Skeleton key={i} className={`h-3 ${i === 0 ? 'w-24' : i === 5 ? 'w-16' : 'flex-1'}`} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 flex items-center gap-6 border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-3 w-24 shrink-0">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-14 rounded-full flex-1" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
