'use client';

import { RefreshCw, SearchX } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ExchangeEmptyStateProps {
  variant?: 'empty' | 'search';
}

export function ExchangeEmptyState({ variant = 'empty' }: ExchangeEmptyStateProps) {
  const config = {
    empty: {
      icon: RefreshCw,
      title: 'No exchange requests',
      description:
        'Exchange requests from customer emails will appear here once the n8n workflow sends them.',
    },
    search: {
      icon: SearchX,
      title: 'No exchanges match your search',
      description: 'Try a different search term or clear the filter.',
    },
  };

  const { icon: Icon, title, description } = config[variant];

  return (
    <Card className="flex flex-col items-center justify-center p-8 gap-4 text-center">
      <Icon className="w-12 h-12 text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Card>
  );
}
