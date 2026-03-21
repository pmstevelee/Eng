import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function TeacherDashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>

      {/* Stat Cards (3) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-9 w-20" />
              <Skeleton className="mt-2 h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Results + Todo */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Table skeleton */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-36" />
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5">
              <div className="flex gap-8">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-16" />
                ))}
              </div>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-8 border-b border-gray-50 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Todo skeleton */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                <Skeleton className="h-[18px] w-[18px] shrink-0 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
