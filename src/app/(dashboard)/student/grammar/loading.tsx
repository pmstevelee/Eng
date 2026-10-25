import { Skeleton } from '@/components/ui/skeleton'

export default function StudentGrammarHomeLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-11 w-40 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-gray-200 bg-white p-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
            <Skeleton className="h-5 w-28" />
            {Array.from({ length: 3 }).map((__, j) => (
              <Skeleton key={j} className="h-10 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
