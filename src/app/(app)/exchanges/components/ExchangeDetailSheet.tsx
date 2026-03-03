'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExchangeStatusBadge } from './ExchangeStatusBadge';
import { EXCHANGE_STATUSES, EXCHANGE_STATUS_LABELS } from '../types';
import type { Exchange, ExchangeStatus } from '../types';
import { Save, Mail, Paperclip, FileText } from 'lucide-react';

interface ExchangeDetailSheetProps {
  exchange: Exchange | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (exchangeId: string, status: ExchangeStatus) => void;
  onSaveNotes: (exchangeId: string, notes: string) => void;
  onSendEmail: (exchange: Exchange) => void;
}

export function ExchangeDetailSheet({
  exchange,
  open,
  onOpenChange,
  onStatusChange,
  onSaveNotes,
  onSendEmail,
}: ExchangeDetailSheetProps) {
  const [notes, setNotes] = useState('');
  const [notesChanged, setNotesChanged] = useState(false);

  // Sync notes when exchange changes
  const handleOpen = (isOpen: boolean) => {
    if (isOpen && exchange) {
      setNotes(exchange.internal_notes || '');
      setNotesChanged(false);
    }
    onOpenChange(isOpen);
  };

  if (!exchange) return null;

  const createdDate = new Date(exchange.created_at).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            Exchange: {exchange.order_number || 'No Order #'}
            <ExchangeStatusBadge status={exchange.status} />
          </SheetTitle>
          <SheetDescription>Created {createdDate}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select
              value={exchange.status}
              onValueChange={(v) => onStatusChange(exchange.id, v as ExchangeStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXCHANGE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {EXCHANGE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Customer</h4>
            <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs space-y-1">
              <p><span className="text-muted-foreground">Name:</span> {exchange.customer_name}</p>
              {exchange.customer_email && (
                <p><span className="text-muted-foreground">Email:</span> {exchange.customer_email}</p>
              )}
              {exchange.customer_phone && (
                <p><span className="text-muted-foreground">Phone:</span> {exchange.customer_phone}</p>
              )}
              {exchange.customer_address && (
                <p><span className="text-muted-foreground">Address:</span> {exchange.customer_address}</p>
              )}
            </div>
          </div>

          {/* Linked Order */}
          {exchange.order_id && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Linked Order</h4>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
                <p>Order: {exchange.order_number}</p>
              </div>
            </div>
          )}

          {/* Reason */}
          {exchange.reason && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Reason</h4>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs whitespace-pre-wrap">
                {exchange.reason}
              </div>
            </div>
          )}

          {/* Description */}
          {exchange.received_description && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Received Description</h4>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs whitespace-pre-wrap">
                {exchange.received_description}
              </div>
            </div>
          )}

          {/* Original Email */}
          {exchange.original_email_text && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Original Email
              </h4>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                {exchange.original_email_text}
              </div>
            </div>
          )}

          {/* Attachments */}
          {exchange.exchange_attachments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" /> Attachments ({exchange.exchange_attachments.length})
              </h4>
              <div className="space-y-1">
                {exchange.exchange_attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-2 text-xs"
                  >
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{att.file_name}</span>
                    {att.file_size && (
                      <span className="text-muted-foreground ml-auto">
                        {(att.file_size / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Internal Notes */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Internal Notes</h4>
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNotesChanged(true);
              }}
              placeholder="Add internal notes about this exchange..."
              className="min-h-[80px] text-xs"
            />
            {notesChanged && (
              <Button
                size="sm"
                onClick={() => {
                  onSaveNotes(exchange.id, notes);
                  setNotesChanged(false);
                }}
                className="bg-purple-600 text-white hover:bg-purple-500 active:bg-purple-700 active:scale-[0.98]"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save Notes
              </Button>
            )}
          </div>

          {/* Email Log */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email Log
              </h4>
              {exchange.customer_email && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs hover:bg-purple-500/20 hover:text-white"
                  onClick={() => onSendEmail(exchange)}
                >
                  Send Email
                </Button>
              )}
            </div>
            {exchange.exchange_email_log.length === 0 ? (
              <p className="text-xs text-muted-foreground">No emails sent yet.</p>
            ) : (
              <div className="space-y-1.5">
                {exchange.exchange_email_log.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-white/10 bg-black/30 p-2 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{log.subject || 'No subject'}</span>
                      <span
                        className={`text-[10px] font-semibold ${
                          log.status === 'sent'
                            ? 'text-green-400'
                            : log.status === 'failed'
                            ? 'text-red-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {log.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      To: {log.recipient_email} &middot;{' '}
                      {new Date(log.sent_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
