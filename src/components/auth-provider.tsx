'use client';

import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  role: 'ADMIN' | 'FORNECEDOR' | null; // <-- Corrigido para FORNECEDOR
  isAdmin: boolean; 
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'ADMIN' | 'FORNECEDOR' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          const tokenResult = await user.getIdTokenResult();
          const userRole = (tokenResult.claims.role as 'ADMIN' | 'FORNECEDOR') || 'FORNECEDOR'; // <-- Corrigido
          setRole(userRole);
        } catch (error) {
          console.error("Error fetching custom claims:", error);
          setRole('FORNECEDOR'); // Assume a role mais restritiva em caso de erro
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    // Só precisamos de chamar o signOut do Firebase.
    // O onAuthStateChanged tratará de limpar o estado (user e role).
    await firebaseSignOut(auth);
  };
  
  const isAdmin = role === 'ADMIN';

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

// Hook personalizado para facilitar o uso do contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};