'use client';

import { Database } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function OrderEmptyState() {
  return (
    <Card className="flex flex-col items-center justify-center p-8 gap-4 text-center">
      <Database className="w-12 h-12 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <h3 className="font-headline text-lg font-semibold">O seu banco de dados está vazio</h3>
        <p className="text-sm text-muted-foreground">Não há pedidos para exibir.</p>
      </div>
    </Card>
  );
}
