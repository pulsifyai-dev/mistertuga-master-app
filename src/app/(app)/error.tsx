'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="flex h-[400px] w-full items-center justify-center p-4">
      <Card className="flex flex-col items-center justify-center p-8 gap-4 text-center max-w-md">
        <AlertTriangle className="w-12 h-12 text-red-400" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <h2 className="font-headline text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>
        </div>
        <Button
          onClick={reset}
          className="bg-purple-600 text-white hover:bg-purple-500 active:bg-purple-700"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </Card>
    </div>
  );
}
