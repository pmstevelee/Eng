import { Skeleton } from '@/components/ui/skeleton'

export default function RankingLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-11 w-72 rounded-full" />
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}
