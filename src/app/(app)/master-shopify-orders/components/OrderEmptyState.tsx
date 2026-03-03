'use client';

import { Database, SearchX, Globe } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface OrderEmptyStateProps {
  variant?: 'database' | 'search' | 'country';
  countryName?: string;
}

export function OrderEmptyState({ variant = 'database', countryName }: OrderEmptyStateProps) {
  const config = {
    database: {
      icon: Database,
      title: 'Your database is empty',
      description: 'No orders to display. Orders will appear here once imported from Shopify.',
    },
    search: {
      icon: SearchX,
      title: 'No orders match your search',
      description: 'Try a different search term or clear the filter.',
    },
    country: {
      icon: Globe,
      title: `No orders in ${countryName || 'this country'}`,
      description: 'There are no orders for the selected country filter.',
    },
  };

  const { icon: Icon, title, description } = config[variant];

  return (
    <Card className="flex flex-col items-center justify-center p-8 gap-4 text-center">
      <Icon className="w-12 h-12 text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h3 className="font-headline text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Card>
  );
}
