import { Skeleton } from "../Skeleton";

export function CardSkeleton() {
  return (
    <div className="card p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <Skeleton className="w-10 h-10 rounded-full" />
    </div>
  );
}
