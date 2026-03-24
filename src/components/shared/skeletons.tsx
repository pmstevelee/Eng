import { cn } from '@/lib/utils'

// 기본 펄스 스켈레톤 블록
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 rounded animate-pulse', className)} />
}

// 통계 카드 스켈레톤
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

// 4개 통계 카드 그리드
export function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

// 차트 영역 스켈레톤
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 p-5', className)}>
      <Skeleton className="h-4 w-32 mb-4" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  )
}

// 2x2 차트 그리드
export function ChartGridSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <ChartSkeleton key={i} />
      ))}
    </div>
  )
}

// 테이블 헤더 + 행 n개 스켈레톤
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 테이블 헤더 */}
      <div className="bg-gray-50 px-4 py-3 flex gap-4 border-b border-gray-200">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn('h-3', i === 0 ? 'w-32' : 'flex-1')} />
        ))}
      </div>
      {/* 테이블 행 */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="px-4 py-3.5 flex gap-4 border-b border-gray-100 last:border-0"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              className={cn('h-4', colIdx === 0 ? 'w-32' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// 검색바 + 버튼 영역 스켈레톤
export function SearchBarSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 flex-1 max-w-sm rounded-lg" />
      <Skeleton className="h-10 w-24 rounded-lg" />
    </div>
  )
}

// 페이지 헤더 (제목 + 버튼) 스켈레톤
export function PageHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-10 w-28 rounded-lg" />
    </div>
  )
}

// 폼 필드 n개 스켈레톤
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-10 w-28 rounded-lg mt-2" />
    </div>
  )
}

// 탭 스켈레톤
export function TabsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-1 border-b border-gray-200 pb-0">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-20 rounded-t-md" />
      ))}
    </div>
  )
}

// 목록 페이지 전체 스켈레톤 (헤더 + 검색바 + 테이블)
export function ListPageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <SearchBarSkeleton />
      <TableSkeleton rows={rows} />
    </div>
  )
}

// 대시보드 전체 스켈레톤
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatsGridSkeleton />
      <ChartGridSkeleton />
    </div>
  )
}
