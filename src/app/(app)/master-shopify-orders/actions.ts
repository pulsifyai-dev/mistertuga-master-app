'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/supabase/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { rateLimit } from '@/lib/rate-limit';
import { validateWebhookUrl } from '@/lib/validate-webhook-url';

const updateOrderSchema = z.object({
  orderId: z.string().min(1),
  countryCode: z.string().min(1),
  customerName: z.string().min(1),
  customerAddress: z.string().min(1),
  customerPhone: z.string().min(1),
  trackingNumber: z.string().optional(),
  note: z.string().optional(),
});

export async function updateOrderDetails(data: z.infer<typeof updateOrderSchema>) {
  const validation = updateOrderSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, error: validation.error.flatten().fieldErrors };
  }

  const { orderId, countryCode, customerName, customerAddress, customerPhone, trackingNumber, note } = validation.data;

  try {
    const { user } = await requireAdmin();

    // Rate limit: 10 updates per minute per user
    const rl = rateLimit(`updateOrder:${user.id}`, 10, 60_000);
    if (!rl.success) {
      return { success: false, error: 'Too many requests. Please wait a moment before trying again.' };
    }

    const supabase = createServiceClient();

    // 1. Find the order by order_number + country_code
    const { data: order, error: findError } = await supabase
      .from('orders')
      .select('id, status, customer_id, tracking_number')
      .eq('order_number', orderId)
      .eq('country_code', countryCode)
      .is('deleted_at', null)
      .single();

    if (findError || !order) {
      return { success: false, error: 'Order not found.' };
    }

    // 2. Update the order
    const orderUpdate: Record<string, unknown> = {
      note: note || '',
      updated_at: new Date().toISOString(),
    };

    if (trackingNumber) {
      orderUpdate.tracking_number = trackingNumber;
      if (order.status === 'open') {
        orderUpdate.status = 'fulfilled';
        orderUpdate.fulfillment_status = 'fulfilled';
      }
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(orderUpdate)
      .eq('id', order.id);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return { success: false, error: 'Failed to update order.' };
    }

    // 3. Update the customer record
    if (order.customer_id) {
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          name: customerName,
          phone: customerPhone.replace(/\s/g, ''),
          address_line1: customerAddress,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.customer_id);

      if (customerError) {
        console.error('Error updating customer:', customerError);
      }
    }

    // 4. Send webhook
    try {
      const { data: setting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'webhook_url')
        .single();

      const webhookUrl = setting?.value?.url || setting?.value;

      if (webhookUrl && typeof webhookUrl === 'string') {
        // Validate webhook URL before sending (SSRF protection)
        const urlValidation = validateWebhookUrl(webhookUrl);
        if (!urlValidation.valid) {
          console.warn(`Webhook URL blocked: ${urlValidation.error}`);
        } else {
        const webhookPayload = {
          customer: {
            name: customerName,
            address: customerAddress,
            phone: customerPhone.replace(/\s/g, ''),
          },
          note: note || '',
          trackingNumber: trackingNumber || order.tracking_number,
          status: orderUpdate.status || order.status,
          orderId,
          countryCode,
          updatedAt: new Date().toISOString(),
        };

        console.log(`Sending webhook to ${webhookUrl}`);
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        });

        if (!webhookResponse.ok) {
          console.error(`Webhook failed with status: ${webhookResponse.status}`);
        } else {
          console.log('Webhook sent successfully');
        }
        }
      } else {
        console.warn('No webhook URL found in settings');
      }
    } catch (webhookError) {
      console.error('Error sending webhook:', webhookError);
    }

    revalidatePath('/master-shopify-orders');
    return { success: true };

  } catch (error: any) {
    console.error('Error updating order details:', error);

    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return { success: false, error: error.message };
    }

    return { success: false, error: error.message || 'An unexpected server error occurred.' };
  }
}

export async function resetTrackingNumber(orderId: string, countryCode: string) {
  try {
    const { user } = await requireAdmin();

    // Rate limit: 10 resets per minute per user
    const rl = rateLimit(`resetTracking:${user.id}`, 10, 60_000);
    if (!rl.success) {
      return { success: false, error: 'Too many requests. Please wait a moment before trying again.' };
    }

    const supabase = createServiceClient();

    const { error } = await supabase
      .from('orders')
      .update({
        tracking_number: '',
        status: 'open',
        fulfillment_status: 'unfulfilled',
        updated_at: new Date().toISOString(),
      })
      .eq('order_number', orderId)
      .eq('country_code', countryCode)
      .is('deleted_at', null);

    if (error) {
      console.error('Error resetting tracking:', error);
      return { success: false, error: 'Failed to reset tracking.' };
    }

    revalidatePath('/master-shopify-orders');
    return { success: true };
  } catch (error: any) {
    console.error('Error resetting tracking:', error);
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}
