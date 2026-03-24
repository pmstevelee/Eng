import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function TeacherDetailLoading() {
  return (
    <div className="space-y-6">
      {/* 뒤로 가기 */}
      <Skeleton className="h-4 w-20" />

      {/* 교사 프로필 카드 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 통계 카드 3개 */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-14" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 담당 반 목록 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5 flex gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-16" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-4 py-3.5 border-b border-gray-50 last:border-0">
              <Skeleton className="h-4 w-32 flex-1" />
              <Skeleton className="h-4 w-12 flex-1" />
              <Skeleton className="h-8 w-16 rounded-lg shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
