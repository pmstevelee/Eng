import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function StudentGradesLoading() {
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-4 w-44" />
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 영역별 점수 */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-20 shrink-0" />
              <Skeleton className="h-3 flex-1 rounded-full" />
              <Skeleton className="h-4 w-12 shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 테스트 결과 테이블 */}
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={`h-3 ${i === 0 ? 'w-36' : 'flex-1'}`} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
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
