'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';
import type { Order } from '../types';

interface TrackingInputProps {
  order: Order;
  isShipped: boolean;
  trackingValue: string;
  isSubmitting: boolean;
  onTrackingChange: (orderId: string, value: string) => void;
  onSubmit: (order: Order) => void;
  onReset: (order: Order) => void;
}

export function TrackingInput({
  order,
  isShipped,
  trackingValue,
  isSubmitting,
  onTrackingChange,
  onSubmit,
  onReset,
}: TrackingInputProps) {
  const displayTracking = order.trackingNumber ? order.trackingNumber.replace(/^TN_/, '') : '';

  if (isShipped) {
    return (
      <div className="flex items-center justify-between pt-1 border-t border-white/10">
        <p className="font-semibold">
          Tracking:{' '}
          <span className="font-normal text-primary">{displayTracking}</span>
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
          type="button"
          aria-label="Reset tracking number"
          onClick={() => onReset(order)}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="text"
        placeholder="Tracking Number"
        value={trackingValue}
        onChange={(e) => onTrackingChange(order.id, e.target.value)}
        className="h-8 text-xs bg-black/30 border-white/10"
      />
      <Button
        onClick={() => onSubmit(order)}
        disabled={isSubmitting}
        className="h-8 text-xs bg-purple-600 text-white hover:bg-purple-500 active:bg-purple-700 active:scale-[0.98]"
        type="button"
      >
        {isSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
        Submit
      </Button>
    </div>
  );
}
