'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
// 💡 MUDANÇA: Agora também importa isAdmin para a lógica de redirecionamento
import { useAuth } from '@/hooks/use-auth'; 
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  // 💡 MUDANÇA: Obter isAdmin do useAuth
  const { user, loading, isAdmin } = useAuth(); 
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // 💡 MUDANÇA PRINCIPAL: Lógica de redirecionamento baseada na função
        const destination = isAdmin ? '/profit-stats' : '/master-shopify-orders';
        
        router.replace(destination);
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, isAdmin, router]); // Adicionar isAdmin às dependências

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}