'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Eye, Send } from 'lucide-react';
import { renderTemplate, TEMPLATE_PLACEHOLDERS } from '../types';
import type { Exchange, EmailTemplate } from '../types';

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exchange: Exchange | null;
  templates: EmailTemplate[];
  onSend: (data: {
    exchangeId: string;
    templateId: string;
    recipientEmail: string;
    subject: string;
    bodyRendered: string;
  }) => void;
  sending: boolean;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  exchange,
  templates,
  onSend,
  sending,
}: SendEmailDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (open && exchange) {
      setRecipientEmail(exchange.customer_email || '');
      setSelectedTemplateId('');
      setSubject('');
      setBody('');
      setShowPreview(false);
    }
  }, [open, exchange]);

  // Apply template
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template && exchange) {
      const data: Record<string, string> = {
        customer_name: exchange.customer_name,
        customer_email: exchange.customer_email || '',
        order_number: exchange.order_number || '',
        reason: exchange.reason || '',
        status: exchange.status,
      };
      setSubject(renderTemplate(template.subject_template, data));
      setBody(renderTemplate(template.body_template, data));
    }
  };

  const handleSend = () => {
    if (!exchange || !selectedTemplateId) return;
    onSend({
      exchangeId: exchange.id,
      templateId: selectedTemplateId,
      recipientEmail,
      subject,
      bodyRendered: body,
    });
  };

  if (!exchange) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
          <DialogDescription>
            Send an email to {exchange.customer_name} regarding exchange {exchange.order_number || 'N/A'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Template Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Template</label>
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No templates available. Create one in Settings first.
              </p>
            ) : (
              <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Recipient */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">To</label>
            <Input
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="customer@example.com"
              type="email"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Body</label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-3 w-3 mr-1" />
                {showPreview ? 'Edit' : 'Preview'}
              </Button>
            </div>
            {showPreview ? (
              <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs whitespace-pre-wrap min-h-[120px]">
                {body || 'Nothing to preview yet.'}
              </div>
            ) : (
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Email body..."
                className="min-h-[120px] text-xs"
              />
            )}
          </div>

          {/* Placeholders hint */}
          <p className="text-[10px] text-muted-foreground">
            Placeholders: {TEMPLATE_PLACEHOLDERS.join(', ')}
          </p>
        </div>

        <DialogFooter className="pt-4">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSend}
            disabled={!selectedTemplateId || !recipientEmail || !subject || !body || sending}
            className="bg-purple-600 text-white hover:bg-purple-500 active:bg-purple-700 active:scale-[0.98]"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {sending ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
