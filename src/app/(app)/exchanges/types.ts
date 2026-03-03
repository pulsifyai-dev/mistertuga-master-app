import { z } from 'zod';

// --- Exchange Status ---
export const EXCHANGE_STATUSES = [
  'new', 'in_review', 'waiting_customer', 'approved', 'rejected', 'completed',
] as const;
export type ExchangeStatus = (typeof EXCHANGE_STATUSES)[number];

export const EXCHANGE_STATUS_LABELS: Record<ExchangeStatus, string> = {
  new: 'New',
  in_review: 'In Review',
  waiting_customer: 'Waiting Customer',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
};

export const EXCHANGE_STATUS_COLORS: Record<ExchangeStatus, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_review: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  waiting_customer: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

// --- Domain Types ---
export type Exchange = {
  id: string;
  order_id: string | null;
  order_number: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  status: ExchangeStatus;
  reason: string | null;
  received_description: string | null;
  original_email_text: string | null;
  internal_notes: string | null;
  source: 'email' | 'manual';
  created_at: string;
  updated_at: string;
  exchange_attachments: ExchangeAttachment[];
  exchange_email_log: ExchangeEmailLogEntry[];
};

export type ExchangeAttachment = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
};

export type ExchangeEmailLogEntry = {
  id: string;
  template_id: string | null;
  recipient_email: string;
  subject: string | null;
  body_rendered: string | null;
  sent_at: string;
  sent_by: string | null;
  status: 'sent' | 'failed' | 'bounced';
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject_template: string;
  body_template: string;
  template_type: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// --- Zod Schemas ---
export const updateExchangeStatusSchema = z.object({
  exchangeId: z.string().uuid(),
  status: z.enum(EXCHANGE_STATUSES),
});

export const updateExchangeNotesSchema = z.object({
  exchangeId: z.string().uuid(),
  internal_notes: z.string(),
});

export const sendEmailSchema = z.object({
  exchangeId: z.string().uuid(),
  templateId: z.string().uuid(),
  recipientEmail: z.string().email(),
  subject: z.string().min(1),
  bodyRendered: z.string().min(1),
});

export const emailTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  subject_template: z.string().min(1, 'Subject is required'),
  body_template: z.string().min(1, 'Body is required'),
  is_active: z.boolean().optional().default(true),
});

export type EmailTemplateFormData = z.infer<typeof emailTemplateSchema>;

// --- Constants ---
export const ITEMS_PER_PAGE = 10;

export const TEMPLATE_PLACEHOLDERS = [
  '{{customer_name}}',
  '{{customer_email}}',
  '{{order_number}}',
  '{{reason}}',
  '{{status}}',
];

// --- Helpers ---
export function renderTemplate(template: string, data: Record<string, string>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(data)) {
    rendered = rendered.replaceAll(`{{${key}}}`, value);
  }
  return rendered;
}
