'use client';

import React from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import DashboardSidebar from '@/components/dashboard/sidebar';
import DashboardHeader from '@/components/dashboard/header';
import { FirebaseClientProvider } from '@/firebase/client-provider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Auth is handled by Next.js middleware (src/middleware.ts) via Supabase
  // FirebaseClientProvider is kept TEMPORARILY for Firestore data access
  // It will be removed in Story 1.5 when hooks are rewritten to use Supabase

  return (
    <FirebaseClientProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <DashboardSidebar />
        </Sidebar>
        <SidebarInset>
          <DashboardHeader />
          <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </FirebaseClientProvider>
  );
}
