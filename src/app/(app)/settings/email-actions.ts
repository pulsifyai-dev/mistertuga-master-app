'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { emailTemplateSchema } from '@/app/(app)/exchanges/types';

export async function listEmailTemplates() {
  try {
    await requireAdmin();
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message, templates: [] };
    }
    return { success: true, templates: data ?? [] };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false, error: msg, templates: [] };
  }
}

export async function createEmailTemplate(
  data: { name: string; subject_template: string; body_template: string; is_active?: boolean }
) {
  const validation = emailTemplateSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: 'Invalid input.' };
  }

  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`emailTemplate:${user.id}`, 10, 60_000);
    if (!rl.success) {
      return { success: false, error: 'Too many requests.' };
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from('email_templates').insert({
      ...validation.data,
      created_by: user.id,
    });

    if (error) {
      console.error('Error creating email template:', error);
      return { success: false, error: 'Failed to create template.' };
    }

    revalidatePath('/settings');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false, error: msg };
  }
}

export async function updateEmailTemplate(
  id: string,
  data: { name: string; subject_template: string; body_template: string; is_active?: boolean }
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { success: false, error: 'Invalid ID.' };
  }
  const validation = emailTemplateSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: 'Invalid input.' };
  }

  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`emailTemplate:${user.id}`, 10, 60_000);
    if (!rl.success) {
      return { success: false, error: 'Too many requests.' };
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('email_templates')
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating email template:', error);
      return { success: false, error: 'Failed to update template.' };
    }

    revalidatePath('/settings');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false, error: msg };
  }
}

export async function deleteEmailTemplate(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { success: false, error: 'Invalid ID.' };
  }
  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`emailTemplate:${user.id}`, 10, 60_000);
    if (!rl.success) {
      return { success: false, error: 'Too many requests.' };
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('email_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting email template:', error);
      return { success: false, error: 'Failed to delete template.' };
    }

    revalidatePath('/settings');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false, error: msg };
  }
}
