import { Skeleton } from "../Skeleton";

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between pb-4">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-8 w-[100px]" />
      </div>
      <div className="border border-border rounded-lg p-4 space-y-4 bg-surface">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-[100px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
