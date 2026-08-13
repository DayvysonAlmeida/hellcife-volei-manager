import { Skeleton } from '@/components/ui/Skeleton';
import { CardSkeleton } from '@/components/ui/skeletons/CardSkeleton';
import { TableSkeleton } from '@/components/ui/skeletons/TableSkeleton';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-10 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <Skeleton className="flex-1 h-48 rounded-2xl" />
        <div className="flex flex-col gap-3 justify-center lg:w-64">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card p-5 space-y-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="card p-5">
          <TableSkeleton rows={5} />
        </div>
      </div>
      <div className="card p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
           <CardSkeleton />
           <CardSkeleton />
           <CardSkeleton />
           <CardSkeleton />
        </div>
      </div>
    </div>
  );
}
