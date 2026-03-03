'use client';

import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root error:', error);
  }, [error]);

  return (
    <div className="flex h-screen w-full items-center justify-center p-4">
      <div className="flex flex-col items-center justify-center gap-4 text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
          <span className="text-2xl">!</span>
        </div>
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-500"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
