'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

function ExchangeRowSkeleton() {
  return (
    <Card className="relative overflow-hidden rounded-xl shadow-md border-l-4 border-l-[#888]">
      <CardHeader className="flex flex-row items-center justify-between p-4 bg-muted/20">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-24" />
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-3 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ExchangesSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading exchanges">
      {/* Filter bar skeleton */}
      <div className="flex items-center gap-2 flex-wrap">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
        <div className="ml-auto">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Exchange cards */}
      <div className="flex flex-col gap-4 mt-4">
        {[1, 2, 3].map((i) => (
          <ExchangeRowSkeleton key={i} />
        ))}
      </div>

      <span className="sr-only">Loading exchanges, please wait...</span>
    </div>
  );
}
