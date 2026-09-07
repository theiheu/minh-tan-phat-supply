import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="space-y-4">
      {/* Header bar skeleton: Title & action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-48 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Filter / Search bar skeleton */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-48 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      {/* Table / List skeleton */}
      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
