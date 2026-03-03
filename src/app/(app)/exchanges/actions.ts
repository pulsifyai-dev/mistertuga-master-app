'use server';

import { revalidatePath } from 'next/cache';
import { Resend } from 'resend';
import { requireAdmin } from '@/lib/supabase/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import {
  updateExchangeStatusSchema,
  updateExchangeNotesSchema,
  sendEmailSchema,
} from './types';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function updateExchangeStatus(
  data: { exchangeId: string; status: string }
) {
  const validation = updateExchangeStatusSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: 'Invalid input.' };
  }

  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`exchangeStatus:${user.id}`, 20, 60_000);
    if (!rl.success) {
      return { success: false, error: 'Too many requests. Please wait.' };
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('exchanges')
      .update({
        status: validation.data.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validation.data.exchangeId);

    if (error) {
      console.error('Error updating exchange status:', error);
      return { success: false, error: 'Failed to update status.' };
    }

    revalidatePath('/exchanges');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false, error: msg };
  }
}

export async function updateExchangeNotes(
  data: { exchangeId: string; internal_notes: string }
) {
  const validation = updateExchangeNotesSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: 'Invalid input.' };
  }

  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`exchangeNotes:${user.id}`, 20, 60_000);
    if (!rl.success) {
      return { success: false, error: 'Too many requests. Please wait.' };
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('exchanges')
      .update({
        internal_notes: validation.data.internal_notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validation.data.exchangeId);

    if (error) {
      console.error('Error updating exchange notes:', error);
      return { success: false, error: 'Failed to update notes.' };
    }

    revalidatePath('/exchanges');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false, error: msg };
  }
}

export async function sendExchangeEmail(
  data: {
    exchangeId: string;
    templateId: string;
    recipientEmail: string;
    subject: string;
    bodyRendered: string;
  }
) {
  const validation = sendEmailSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: 'Invalid input.' };
  }

  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`exchangeEmail:${user.id}`, 10, 60_000);
    if (!rl.success) {
      return { success: false, error: 'Too many requests. Please wait.' };
    }

    const { recipientEmail, subject, bodyRendered, exchangeId, templateId } =
      validation.data;

    // Send via Resend
    let emailStatus: 'sent' | 'failed' = 'sent';
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'MisterTuga <noreply@mistertuga.com>',
        to: recipientEmail,
        subject,
        html: bodyRendered,
      });
    } catch (emailError) {
      console.error('Resend email error:', emailError);
      emailStatus = 'failed';
    }

    // Log email in database
    const supabase = createServiceClient();
    await supabase.from('exchange_email_log').insert({
      exchange_id: exchangeId,
      template_id: templateId,
      recipient_email: recipientEmail,
      subject,
      body_rendered: bodyRendered,
      sent_by: user.id,
      status: emailStatus,
    });

    revalidatePath('/exchanges');

    if (emailStatus === 'failed') {
      return { success: false, error: 'Email failed to send. It has been logged.' };
    }

    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false, error: msg };
  }
}
