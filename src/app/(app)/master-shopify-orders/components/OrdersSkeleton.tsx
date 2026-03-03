'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

function OrderRowSkeleton() {
  return (
    <Card className="relative overflow-hidden rounded-xl shadow-md border-l-4 border-l-[#888]">
      <CardHeader className="flex flex-row items-center justify-between p-4 bg-muted/20">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-3 w-24" />
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3.5">
        <div className="md:col-span-2 flex flex-col gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 rounded-md" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <div className="bg-black/30 border border-white/10 p-4 rounded-lg space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrdersSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading orders">
      {/* Country tabs skeleton */}
      <div className="sticky top-12 z-20 flex gap-3 rounded-2xl bg-black/40 border border-white/5 px-3 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div className="flex items-center gap-2 justify-end">
        <Skeleton className="h-8 w-40 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Section title */}
      <Skeleton className="h-6 w-48 mt-4" />

      {/* Order cards */}
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <OrderRowSkeleton key={i} />
        ))}
      </div>

      <span className="sr-only">Loading orders, please wait...</span>
    </div>
  );
}
