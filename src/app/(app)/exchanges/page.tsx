'use client';

import { useState, useEffect, useCallback } from 'react';
import { useExchanges } from './hooks/useExchanges';
import { useExchangeFilters } from './hooks/useExchangeFilters';
import { ExchangesSkeleton } from './components/ExchangesSkeleton';
import { ExchangeFilters } from './components/ExchangeFilters';
import { ExchangesList } from './components/ExchangesList';
import { ExchangeDetailSheet } from './components/ExchangeDetailSheet';
import { SendEmailDialog } from './components/SendEmailDialog';
import { updateExchangeStatus, updateExchangeNotes, sendExchangeEmail } from './actions';
import { listEmailTemplates } from '@/app/(app)/settings/email-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';
import type { Exchange, ExchangeStatus, EmailTemplate } from './types';

export default function ExchangesPage() {
  const { exchanges, loading, isUserLoading } = useExchanges();
  const filters = useExchangeFilters(exchanges);
  const { toast } = useToast();

  // Detail sheet state
  const [selectedExchange, setSelectedExchange] = useState<Exchange | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Send email state
  const [emailExchange, setEmailExchange] = useState<Exchange | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [sending, setSending] = useState(false);

  // Scroll to top
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Load email templates when send dialog opens
  const loadTemplates = useCallback(async () => {
    const result = await listEmailTemplates();
    if (result.success) {
      setEmailTemplates(result.templates as EmailTemplate[]);
    }
  }, []);

  // --- Handlers ---
  const handleViewDetails = (exchange: Exchange) => {
    setSelectedExchange(exchange);
    setDetailOpen(true);
  };

  const handleSendEmail = (exchange: Exchange) => {
    setEmailExchange(exchange);
    setEmailDialogOpen(true);
    loadTemplates();
  };

  const handleStatusChange = async (exchangeId: string, status: ExchangeStatus) => {
    const result = await updateExchangeStatus({ exchangeId, status });
    if (result.success) {
      toast({ title: 'Status updated', description: `Changed to ${status.replace('_', ' ')}.` });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleSaveNotes = async (exchangeId: string, notes: string) => {
    const result = await updateExchangeNotes({ exchangeId, internal_notes: notes });
    if (result.success) {
      toast({ title: 'Notes saved' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleSendEmailSubmit = async (data: {
    exchangeId: string;
    templateId: string;
    recipientEmail: string;
    subject: string;
    bodyRendered: string;
  }) => {
    setSending(true);
    const result = await sendExchangeEmail(data);
    setSending(false);

    if (result.success) {
      toast({
        title: 'Email sent',
        description: `Email sent to ${data.recipientEmail}.`,
      });
      setEmailDialogOpen(false);
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleSearchSelect = (exchange: Exchange) => {
    setSelectedExchange(exchange);
    setDetailOpen(true);
  };

  // --- Loading state ---
  if (loading || isUserLoading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Exchanges & Returns</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Manage exchange and return requests from customers.
        </p>
        <ExchangesSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <h1 className="text-2xl font-bold mb-1">Exchanges & Returns</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Manage exchange and return requests from customers.
      </p>

      {/* Filters */}
      <ExchangeFilters
        statusFilter={filters.statusFilter}
        statusCounts={filters.statusCounts}
        searchQuery={filters.searchQuery}
        searchMatches={filters.searchMatches}
        onStatusChange={filters.setStatusFilter}
        onSearchChange={filters.setSearchQuery}
        onSelectSearchResult={handleSearchSelect}
      />

      {/* List */}
      <ExchangesList
        exchanges={filters.paginatedExchanges}
        page={filters.page}
        totalPages={filters.totalPages}
        hasSearch={!!filters.searchQuery.trim()}
        onPageChange={filters.setPage}
        onViewDetails={handleViewDetails}
        onSendEmail={handleSendEmail}
        onStatusChange={handleStatusChange}
      />

      {/* Detail Sheet */}
      <ExchangeDetailSheet
        exchange={selectedExchange}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStatusChange={handleStatusChange}
        onSaveNotes={handleSaveNotes}
        onSendEmail={handleSendEmail}
      />

      {/* Send Email Dialog */}
      <SendEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        exchange={emailExchange}
        templates={emailTemplates}
        onSend={handleSendEmailSubmit}
        sending={sending}
      />

      {/* Scroll to top */}
      {showScrollTop && (
        <Button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full bg-purple-600 text-white hover:bg-purple-500 active:bg-purple-700 shadow-lg"
          size="icon"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
