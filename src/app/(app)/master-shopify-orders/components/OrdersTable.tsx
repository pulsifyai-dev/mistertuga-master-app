'use client';

import { Package, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OrderRow } from './OrderRow';
import type { Order } from '../types';

interface OrdersTableProps {
  orders: Order[];
  orderTab: 'pending' | 'shipped';
  page: number;
  totalPages: number;
  expandedOrders: Record<string, boolean>;
  trackingNumbers: Record<string, string>;
  submittingOrderId: string | null;
  onPageChange: (page: number) => void;
  onToggleDetails: (orderId: string) => void;
  onTrackingChange: (orderId: string, value: string) => void;
  onSubmitTracking: (order: Order) => void;
  onResetTracking: (order: Order) => void;
  onEditOrder: (order: Order) => void;
}

export function OrdersTable({
  orders,
  orderTab,
  page,
  totalPages,
  expandedOrders,
  trackingNumbers,
  submittingOrderId,
  onPageChange,
  onToggleDetails,
  onTrackingChange,
  onSubmitTracking,
  onResetTracking,
  onEditOrder,
}: OrdersTableProps) {
  const isShipped = orderTab === 'shipped';

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-4">
        {orderTab === 'pending' ? 'Pending Production' : 'Shipped Orders'}
      </h2>

      {orders.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-8 gap-3 text-center">
          {orderTab === 'pending' ? (
            <Package className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Truck className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
          )}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">
              {orderTab === 'pending' ? 'No pending orders' : 'No shipped orders'}
            </p>
            <p className="text-xs text-muted-foreground">
              {orderTab === 'pending'
                ? 'All orders have been processed or no orders match the current filters.'
                : 'No orders have been shipped yet for the current filters.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              isShipped={isShipped}
              isExpanded={!!expandedOrders[order.id]}
              trackingValue={trackingNumbers[order.id] ?? order.trackingNumber ?? ''}
              isSubmitting={submittingOrderId === order.id}
              onToggleDetails={onToggleDetails}
              onTrackingChange={onTrackingChange}
              onSubmitTracking={onSubmitTracking}
              onResetTracking={onResetTracking}
              onEditOrder={onEditOrder}
            />
          ))}
        </div>
      )}

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
