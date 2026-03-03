'use client';

import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  role: 'ADMIN' | 'FORNECEDOR' | null;
  isAdmin: boolean;
  assignedCountries: string[];
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'ADMIN' | 'FORNECEDOR' | null>(null);
  const [assignedCountries, setAssignedCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user);
        const userRole = (user.app_metadata?.user_role as 'ADMIN' | 'FORNECEDOR') || 'FORNECEDOR';
        setRole(userRole);
        setAssignedCountries(user.app_metadata?.assigned_countries || []);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        const userRole = (session.user.app_metadata?.user_role as 'ADMIN' | 'FORNECEDOR') || 'FORNECEDOR';
        setRole(userRole);
        setAssignedCountries(session.user.app_metadata?.assigned_countries || []);
      } else {
        setUser(null);
        setRole(null);
        setAssignedCountries([]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  const isAdmin = role === 'ADMIN';

  const value = { user, role, isAdmin, assignedCountries, loading, signOut };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
