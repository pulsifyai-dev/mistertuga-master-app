'use client';

import { Button } from '@/components/ui/button';
import { ExchangeRow } from './ExchangeRow';
import { ExchangeEmptyState } from './ExchangeEmptyState';
import type { Exchange, ExchangeStatus } from '../types';

interface ExchangesListProps {
  exchanges: Exchange[];
  page: number;
  totalPages: number;
  hasSearch: boolean;
  onPageChange: (page: number) => void;
  onViewDetails: (exchange: Exchange) => void;
  onSendEmail: (exchange: Exchange) => void;
  onStatusChange: (exchangeId: string, status: ExchangeStatus) => void;
}

export function ExchangesList({
  exchanges,
  page,
  totalPages,
  hasSearch,
  onPageChange,
  onViewDetails,
  onSendEmail,
  onStatusChange,
}: ExchangesListProps) {
  if (exchanges.length === 0) {
    return <ExchangeEmptyState variant={hasSearch ? 'search' : 'empty'} />;
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-4">
        {exchanges.map((exchange) => (
          <ExchangeRow
            key={exchange.id}
            exchange={exchange}
            onViewDetails={onViewDetails}
            onSendEmail={onSendEmail}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            className="hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
            className="hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
