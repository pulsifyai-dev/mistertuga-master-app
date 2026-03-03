'use client';

import { Loader2 } from 'lucide-react';

// Root page: middleware handles all redirects (login → /login, authenticated → dashboard).
// This is a fallback that shows a spinner during the brief transition.
export default function HomePage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
