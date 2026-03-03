'use client';

import { EXCHANGE_STATUS_LABELS, EXCHANGE_STATUS_COLORS } from '../types';
import type { ExchangeStatus } from '../types';

interface ExchangeStatusBadgeProps {
  status: ExchangeStatus;
}

export function ExchangeStatusBadge({ status }: ExchangeStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${EXCHANGE_STATUS_COLORS[status]}`}
    >
      {EXCHANGE_STATUS_LABELS[status]}
    </span>
  );
}
