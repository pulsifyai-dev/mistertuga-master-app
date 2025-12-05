'use client';

import { Construction } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function MistakeHandlingPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* HEADER */}
      <div className="pt-1">
        <h1 className="font-headline text-3xl md:text-4xl font-bold tracking-tight">
          Mistake Handling
        </h1>
        <p className="text-muted-foreground max-w-xl text-sm mt-1">
          Area dedicated to handling order mistakes. 
        </p>
      </div>

      {/* CARD IN CONSTRUCTION */}
      <Card className="mt-2 rounded-2xl border border-dashed border-white/15 bg-black/30 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/40">
            <Construction className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <CardTitle className="text-base">In construction</CardTitle>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}