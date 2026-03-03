'use client';

import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateOrderDetails, resetTrackingNumber } from './actions';
import type { Order, EditOrderSchema, CountryCode } from './types';

// Hooks
import { useOrders } from './hooks/useOrders';
import { useOrderFilters } from './hooks/useOrderFilters';
import { usePdfExport } from './hooks/usePdfExport';
import { useExcelExport } from './hooks/useExcelExport';

// Components
import { OrderEmptyState } from './components/OrderEmptyState';
import { OrdersSkeleton } from './components/OrdersSkeleton';
import { CountryTabs } from './components/CountryTabs';
import { OrderFilters } from './components/OrderFilters';
import { OrdersTable } from './components/OrdersTable';
import { OrderEditDialog } from './components/OrderEditDialog';
import { ExportOverlay } from './components/ExportControls';

export default function MasterShopifyOrdersPage() {
  const { toast } = useToast();

  // Data hooks
  const { orders, pageLoading, isUserLoading, user } = useOrders();
  const filters = useOrderFilters(orders);
  const { isExporting, exportChunksInfo, handleExportPackingSheetPDF } = usePdfExport();
  const { handleExportCurrentListXLSX } = useExcelExport();

  // Local UI state
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [webhookExporting, setWebhookExporting] = useState(false);

  // Scroll-to-top listener
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- Handlers ---

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleTrackingChange = (orderId: string, value: string) => {
    setTrackingNumbers((prev) => ({ ...prev, [orderId]: value }));
  };

  const handleSubmitTracking = async (order: Order) => {
    if (!user) return;
    const trackingNumber = trackingNumbers[order.id];
    if (!trackingNumber) {
      toast({ variant: 'destructive', title: 'Missing Tracking Number' });
      return;
    }

    setSubmittingOrderId(order.id);
    try {
      const result = await updateOrderDetails({
        orderId: order.id,
        countryCode: order.countryCode,
        customerName: order.customer.name,
        customerAddress: order.customer.address,
        customerPhone: order.customer.phone,
        note: order.note,
        trackingNumber,
      });

      if (result.success) {
        toast({ title: 'Tracking Submitted' });
        setTrackingNumbers((prev) => ({ ...prev, [order.id]: '' }));
      } else {
        toast({ variant: 'destructive', title: 'Update Failed' });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Unexpected error' });
    } finally {
      setSubmittingOrderId(null);
    }
  };

  const handleResetTracking = async (order: Order) => {
    if (!user) return;
    try {
      const result = await resetTrackingNumber(order.id, order.countryCode);
      if (result.success) {
        toast({ title: 'Tracking Reset' });
      } else {
        toast({ variant: 'destructive', title: 'Reset Failed' });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Unexpected error' });
    }
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setIsEditModalOpen(true);
  };

  const handleUpdateOrder = async (data: EditOrderSchema) => {
    if (!editingOrder || !user) return;
    try {
      const result = await updateOrderDetails({
        orderId: editingOrder.id,
        countryCode: editingOrder.countryCode,
        ...data,
      });
      if (result.success) {
        toast({ title: 'Order Updated', description: 'The details have been saved successfully.' });
        setIsEditModalOpen(false);
      } else {
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not save the details.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Unexpected Error', description: 'Something went wrong while updating the order.' });
      console.error('Unexpected error updating order:', error);
    }
  };

  const handleWebhookExport = async () => {
    setWebhookExporting(true);
    try {
      await fetch('https://webhook-mistertuga.pulsifyai.com/webhook/app_mistertuga_export', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: user?.email,
          tab: filters.orderTab,
          filter: filters.activeFilter,
          orderCount: filters.listToShow.length,
          timestamp: new Date().toISOString(),
        }),
      });
      toast({
        title: 'Export Signal Sent',
        description: 'The request was sent to the automation service.',
        className: 'bg-green-500/20 border-green-500/50 text-white backdrop-blur-md',
      });
    } catch (error) {
      console.error('Webhook error:', error);
      toast({ variant: 'destructive', title: 'Connection Error', description: 'Could not reach the export server.' });
    } finally {
      setWebhookExporting(false);
    }
  };

  const handleFilterChange = (filter: CountryCode) => {
    filters.setActiveFilter(filter);
    filters.setSelectedOrderIdForSearch(null);
    filters.setPage(1);
  };

  const handleTabChange = (tab: 'pending' | 'shipped') => {
    filters.setOrderTab(tab);
    filters.setPage(1);
  };

  const handleSearchChange = (query: string) => {
    filters.setSearchQuery(query);
    if (query) {
      filters.setSelectedOrderIdForSearch(null);
    }
  };

  const handleSelectSearchResult = (orderId: string) => {
    filters.setSelectedOrderIdForSearch(orderId);
    filters.setPage(1);
  };

  const handleClearSearchFilter = () => {
    filters.setSelectedOrderIdForSearch(null);
    filters.setPage(1);
  };

  // --- Loading / Auth Guards ---

  if (pageLoading || isUserLoading) {
    return <OrdersSkeleton />;
  }

  if (!user) {
    return (
      <div className="text-center">
        <h1 className="font-headline text-2xl font-bold">Access Denied</h1>
        <p>Please log in.</p>
      </div>
    );
  }

  // --- Render ---

  return (
    <>
      <ExportOverlay isExporting={isExporting} exportChunksInfo={exportChunksInfo} />

      <OrderEditDialog
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        order={editingOrder}
        onSubmit={handleUpdateOrder}
      />

      <div className="flex flex-col gap-4" id="dashboard-content">
        {/* Header */}
        <div className="pt-2 flex items-start justify-between">
          <div>
            <h1 className="font-headline text-3xl md:text-4xl font-bold tracking-tight">Shopify Orders</h1>
            <p className="text-muted-foreground max-w-xl text-sm mt-1.5">
              Manage ALL your Shopify orders in one place.
            </p>
          </div>
        </div>

        {/* Country filter bar */}
        <div className="sticky top-12 z-20 flex flex-col gap-3 rounded-2xl bg-black/40 border border-white/5 px-3 py-3 backdrop-blur-md md:flex-row md:items-center">
          <CountryTabs
            activeFilter={filters.activeFilter}
            pendingCounts={filters.pendingCounts}
            onFilterChange={handleFilterChange}
          />
        </div>

        {/* Empty state */}
        {!pageLoading && orders.length === 0 && <OrderEmptyState />}

        {/* Tabs + Filters + Export */}
        <OrderFilters
          orderTab={filters.orderTab}
          pendingCount={filters.pendingOrders.length}
          shippedCount={filters.shippedOrders.length}
          onTabChange={handleTabChange}
          searchQuery={filters.searchQuery}
          searchMatches={filters.searchMatches}
          onSearchChange={handleSearchChange}
          onSelectSearchResult={handleSelectSearchResult}
          selectedOrderIdForSearch={filters.selectedOrderIdForSearch}
          onClearSearchFilter={handleClearSearchFilter}
          startDate={filters.startDate}
          endDate={filters.endDate}
          isDateFilterOpen={filters.isDateFilterOpen}
          isFilterActive={filters.isFilterActive}
          onStartDateChange={filters.setStartDate}
          onEndDateChange={filters.setEndDate}
          onDateFilterOpenChange={filters.setIsDateFilterOpen}
          onResetDateFilter={filters.handleResetDateFilter}
          isExporting={webhookExporting}
          onWebhookExport={handleWebhookExport}
        />

        {/* Orders list */}
        <OrdersTable
          orders={filters.paginatedOrders}
          orderTab={filters.orderTab}
          page={filters.page}
          totalPages={filters.totalPages}
          expandedOrders={expandedOrders}
          trackingNumbers={trackingNumbers}
          submittingOrderId={submittingOrderId}
          onPageChange={filters.setPage}
          onToggleDetails={toggleOrderDetails}
          onTrackingChange={handleTrackingChange}
          onSubmitTracking={handleSubmitTracking}
          onResetTracking={handleResetTracking}
          onEditOrder={handleEditOrder}
        />
      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          type="button"
          aria-label="Scroll to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-16 right-6 z-[9999] rounded-full bg-white/10 border border-white/30 backdrop-blur-md text-white shadow-lg p-3 hover:bg-purple-500/20 active:bg-purple-500/30 transition"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
    </>
  );
}
