'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="font-body antialiased bg-background text-foreground">
        <div className="flex h-screen w-full items-center justify-center p-4">
          <div className="flex flex-col items-center justify-center gap-4 text-center max-w-md">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-2xl">!</span>
            </div>
            <h2 className="text-lg font-semibold">Critical Error</h2>
            <p className="text-sm text-muted-foreground">
              The application encountered a critical error. Please try refreshing the page.
            </p>
            <button
              onClick={reset}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-500"
            >
              Refresh
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
