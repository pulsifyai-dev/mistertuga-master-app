'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, Mail, ChevronDown, Mail as MailIcon } from 'lucide-react';
import { ExchangeStatusBadge } from './ExchangeStatusBadge';
import { EXCHANGE_STATUSES, EXCHANGE_STATUS_LABELS } from '../types';
import type { Exchange, ExchangeStatus } from '../types';

interface ExchangeRowProps {
  exchange: Exchange;
  onViewDetails: (exchange: Exchange) => void;
  onSendEmail: (exchange: Exchange) => void;
  onStatusChange: (exchangeId: string, status: ExchangeStatus) => void;
}

export function ExchangeRow({
  exchange,
  onViewDetails,
  onSendEmail,
  onStatusChange,
}: ExchangeRowProps) {
  const statusColor =
    exchange.status === 'new' ? '#3b82f6' :
    exchange.status === 'in_review' ? '#f59e0b' :
    exchange.status === 'waiting_customer' ? '#f97316' :
    exchange.status === 'approved' ? '#22c55e' :
    exchange.status === 'rejected' ? '#ef4444' :
    '#6b7280';

  const createdDate = new Date(exchange.created_at).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Card
      className="relative overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 bg-card"
      style={{ borderLeft: `4px solid ${statusColor}` }}
    >
      <CardHeader className="flex flex-row items-center justify-between p-4 bg-muted/20 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold text-card-foreground truncate">
            {exchange.order_number || 'No Order #'}
          </span>
          <ExchangeStatusBadge status={exchange.status} />
          {exchange.source === 'email' && (
            <span className="inline-flex items-center rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 text-[10px] font-medium">
              <MailIcon className="h-3 w-3 mr-1" />
              Email
            </span>
          )}
        </div>
        <span className="text-[12px] text-muted-foreground shrink-0">{createdDate}</span>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium truncate">{exchange.customer_name}</p>
            {exchange.customer_email && (
              <p className="text-xs text-muted-foreground truncate">{exchange.customer_email}</p>
            )}
            {exchange.reason && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                <span className="font-medium">Reason:</span> {exchange.reason}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
            onClick={() => onViewDetails(exchange)}
            aria-label={`View details for exchange ${exchange.order_number}`}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Details
          </Button>

          {exchange.customer_email && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
              onClick={() => onSendEmail(exchange)}
              aria-label={`Send email to ${exchange.customer_email}`}
            >
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Send Email
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30 ml-auto"
                aria-label="Change status"
              >
                Status
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {EXCHANGE_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  disabled={s === exchange.status}
                  onClick={() => onStatusChange(exchange.id, s)}
                >
                  {EXCHANGE_STATUS_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
