'use server';

import { z } from 'zod';
import { adminDb } from '@/lib/firebase/server';
import { revalidatePath } from 'next/cache';

const updateOrderSchema = z.object({
  orderId: z.string().min(1),
  countryCode: z.string().min(1),
  customerName: z.string().min(1),
  customerAddress: z.string().min(1),
  customerPhone: z.string().min(1),
  trackingNumber: z.string().optional(),
  note: z.string().optional(), // Added note field
});

export async function updateOrderDetails(data: z.infer<typeof updateOrderSchema>) {
  const validation = updateOrderSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, error: validation.error.flatten().fieldErrors };
  }

  const { orderId, countryCode, customerName, customerAddress, customerPhone, trackingNumber, note } = validation.data;

  try {
    const orderRef = adminDb.collection('orders').doc(countryCode).collection('orders').doc(orderId);

    const updatePayload: { [key: string]: any } = {
      'customer.name': customerName,
      'customer.address': customerAddress,
      'customer.phone': customerPhone.replace(/\s/g, ''),
      note: note || '', // Add or clear the note
    };

    if (trackingNumber) {
      updatePayload.trackingNumber = trackingNumber;
      const doc = await orderRef.get();
      if (doc.exists && doc.data()?.status === 'Pending Production') {
        updatePayload.status = 'Shipped';
      }
    }

    await orderRef.update(updatePayload);

    revalidatePath('/master-shopify-orders');

    return { success: true };

  } catch (error) {
    console.error("Error updating order details:", error);
    return { success: false, error: 'An unexpected server error occurred.' };
  }
}
