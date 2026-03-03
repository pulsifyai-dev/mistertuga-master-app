'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Pencil, StickyNote, Eye, EyeOff, DollarSign } from 'lucide-react';
import { countryFlags } from './CountryFlags';
import { TrackingInput } from './TrackingInput';
import type { Order } from '../types';

interface OrderRowProps {
  order: Order;
  isShipped: boolean;
  isExpanded: boolean;
  trackingValue: string;
  isSubmitting: boolean;
  onToggleDetails: (orderId: string) => void;
  onTrackingChange: (orderId: string, value: string) => void;
  onSubmitTracking: (order: Order) => void;
  onResetTracking: (order: Order) => void;
  onEditOrder: (order: Order) => void;
}

export function OrderRow({
  order,
  isShipped,
  isExpanded,
  trackingValue,
  isSubmitting,
  onToggleDetails,
  onTrackingChange,
  onSubmitTracking,
  onResetTracking,
  onEditOrder,
}: OrderRowProps) {
  const countryColor =
    order.countryCode === 'PT' ? '#008000' :
    order.countryCode === 'DE' ? '#FFCE00' :
    order.countryCode === 'ES' ? '#C60B1E' :
    order.countryCode === 'GB' ? '#0000FF' :
    '#888';

  return (
    <Card
      id={`order-${order.id}`}
      className="relative overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 bg-card"
      style={{ borderLeft: `4px solid ${countryColor}` }}
    >
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between p-4 bg-muted/20 gap-2">
        <div className="flex items-center gap-3 font-semibold text-card-foreground min-w-0">
          {countryFlags[order.countryCode]}
          <div className="flex flex-col min-w-0">
            <span className="truncate">{order.id}</span>
            <span className="text-[11px] font-normal text-muted-foreground truncate md:hidden">{order.customer.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[12px] text-muted-foreground shrink-0">
          {order.date}
        </div>
      </CardHeader>

      {/* Body */}
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3.5">
        {/* ITEMS */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {Array.isArray(order.items) &&
            order.items
              .filter((it) => it && typeof it === 'object')
              .map((item, index) => {
                const validThumb =
                  item.thumbnailUrl &&
                  item.thumbnailUrl !== 'null' &&
                  item.thumbnailUrl !== 'undefined' &&
                  item.thumbnailUrl.trim() !== '' &&
                  item.thumbnailUrl.startsWith('http');

                return (
                  <div key={index} className="flex items-start gap-4">
                    <div className="thumb-wrapper">
                      <img
                        src={validThumb ? item.thumbnailUrl : 'https://placehold.co/80x80/e2e8f0/64748b?text=N/A'}
                        alt={item.name || 'Item'}
                        className="thumb-image rounded-md shadow-sm"
                      />
                    </div>
                    <div className="text-sm leading-tight space-y-1">
                      <p className="font-semibold">{item.name ?? 'Unnamed Product'}</p>
                      <p className="text-muted-foreground">ID: {item.productId ?? '—'}</p>
                      <p className="text-muted-foreground">Customization: {item.customization ?? '—'}</p>
                      <p className="text-muted-foreground">Size: {item.size ?? '—'}  /  Qty: {item.quantity ?? 0}</p>
                      <p className="text-muted-foreground">
                        Version:{' '}
                        {item.version === 'Player Edition' ? (
                          <strong>{item.version}</strong>
                        ) : (
                          item.version ?? '—'
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
        </div>

        {/* CUSTOMER + TRACKING */}
        <div className="flex flex-col gap-4">
          <div className="relative bg-black/30 border border-white/10 p-4 rounded-lg text-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Tracking</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
                type="button"
                aria-label={isExpanded ? 'Hide details' : 'Show details'}
                onClick={() => onToggleDetails(order.id)}
              >
                {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>

            <TrackingInput
              order={order}
              isShipped={isShipped}
              trackingValue={trackingValue}
              isSubmitting={isSubmitting}
              onTrackingChange={onTrackingChange}
              onSubmit={onSubmitTracking}
              onReset={onResetTracking}
            />

            {/* Note — always visible if exists */}
            {order.note && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-500/20 border border-amber-500/20 p-2">
                <StickyNote className="h-3.5 w-3.5 mt-0.5 text-amber-400" />
                <p className="text-[11px] italic whitespace-pre-line">{order.note}</p>
              </div>
            )}

            {/* Collapsed panel — Customer Details + Cost */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">Customer Details</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
                    type="button"
                    aria-label="Edit order details"
                    onClick={() => onEditOrder(order)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <p className="font-medium">{order.customer.name}</p>
                <p className="text-muted-foreground whitespace-pre-line">{order.customer.address}</p>
                <p className="text-muted-foreground">{order.customer.phone}</p>

                {/* Cost Summary */}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <DollarSign className="h-3 w-3 text-purple-400" />
                    <p className="text-xs font-semibold">Supplier Cost</p>
                  </div>
                  {order.cost ? (
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="rounded border border-white/5 py-1">
                        <p className="text-[9px] text-muted-foreground">Prod</p>
                        <p className="text-[11px] font-medium">${order.cost.production_cost?.toFixed(2) ?? '—'}</p>
                      </div>
                      <div className="rounded border border-white/5 py-1">
                        <p className="text-[9px] text-muted-foreground">Ship</p>
                        <p className="text-[11px] font-medium">${order.cost.shipping_cost?.toFixed(2) ?? '—'}</p>
                      </div>
                      <div className="rounded border border-purple-500/20 bg-purple-500/5 py-1">
                        <p className="text-[9px] text-muted-foreground">Total</p>
                        <p className="text-[11px] font-semibold text-purple-400">${order.cost.total_cost?.toFixed(2) ?? '—'}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">Not calculated</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
