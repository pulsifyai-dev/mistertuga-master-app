'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  role: 'ADMIN' | 'BASIC' | null;
  // 💡 MUDANÇA 1: Adicionar isAdmin ao Contexto
  isAdmin: boolean; 
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'ADMIN' | 'BASIC' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const tokenResult = await user.getIdTokenResult();
        const userRole = (tokenResult.claims.role as 'ADMIN' | 'BASIC') || 'BASIC';
        setRole(userRole);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setRole(null);
  };
  
  // 💡 MUDANÇA 2: Definir isAdmin aqui (para o frontend)
  const isAdmin = role === 'ADMIN';

  // 💡 MUDANÇA 3: Exportar isAdmin no valor
  const value = { user, role, isAdmin, loading, signOut }; 

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