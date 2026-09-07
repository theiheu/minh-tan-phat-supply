import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <div className="space-y-4">
      {/* Ô tìm kiếm skeleton */}
      <div className="mx-auto flex w-full max-w-xl gap-2">
        <Skeleton className="h-9 flex-1 rounded-md" />
        <Skeleton className="h-9 w-16 shrink-0 rounded-md" />
      </div>

      {/* Danh mục dạng ô vuông skeleton */}
      <div className="mx-auto grid w-max auto-cols-[4.25rem] grid-flow-col grid-rows-2 gap-2 overflow-x-auto pb-1 sm:auto-cols-[4.75rem] md:auto-cols-[5rem] lg:w-auto lg:flex lg:flex-wrap lg:justify-start lg:gap-x-3 lg:gap-y-2 lg:overflow-visible lg:pb-0 xl:gap-x-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton
            key={i}
            className="aspect-square w-full rounded-lg lg:w-16 xl:w-[4.7rem]"
          />
        ))}
      </div>

      {/* Đếm số vật tư skeleton */}
      <Skeleton className="h-4 w-24" />

      {/* Grid thẻ vật tư skeleton */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border bg-card shadow-sm">
            {/* Ảnh vuông */}
            <Skeleton className="aspect-square w-full rounded-none" />
            {/* Nội dung thẻ */}
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="pt-1">
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Phân trang skeleton */}
      <div className="flex justify-center pt-2">
        <Skeleton className="h-9 w-64 rounded-md" />
      </div>
    </div>
  );
}
