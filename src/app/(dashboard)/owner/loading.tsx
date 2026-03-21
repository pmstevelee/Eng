import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="mt-3 h-9 w-24" />
        <Skeleton className="mt-2 h-4 w-20" />
      </CardContent>
    </Card>
  )
}

function ChartCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-5 w-36" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[220px] w-full" />
      </CardContent>
    </Card>
  )
}

export default function OwnerDashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts 2×2 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <ChartCardSkeleton key={i} />
        ))}
      </div>

      {/* Recent Results + At-Risk */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Table skeleton */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-36" />
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5">
              <div className="flex gap-8">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-16" />
                ))}
              </div>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-8 border-b border-gray-50 px-4 py-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-14" />
                </div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* At-risk skeleton */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-24" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
