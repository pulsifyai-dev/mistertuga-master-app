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
  note: z.string().optional(),
});

export async function updateOrderDetails(data: z.infer<typeof updateOrderSchema>) {
  const validation = updateOrderSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, error: validation.error.flatten().fieldErrors };
  }

  const { orderId, countryCode, customerName, customerAddress, customerPhone, trackingNumber, note } = validation.data;

  try {
    const orderRef = adminDb.collection('orders').doc(countryCode).collection('orders').doc(orderId);

    // 1. Ler os dados atuais
    const doc = await orderRef.get();
    if (!doc.exists) {
        return { success: false, error: 'Order not found.' };
    }
    const currentData = doc.data();

    // 2. Preparar payload de atualização
    const updatePayload: { [key: string]: any } = {
      'customer.name': customerName,
      'customer.address': customerAddress,
      'customer.phone': customerPhone.replace(/\s/g, ''),
      note: note || '',
    };

    if (trackingNumber) {
      updatePayload.trackingNumber = trackingNumber;
      if (currentData?.status === 'Pending Production') {
        updatePayload.status = 'Shipped';
      }
    }

    // 3. Atualizar na Base de Dados
    await orderRef.update(updatePayload);

    // 4. Enviar Webhook
    try {
      const settingsDoc = await adminDb.collection('settings').doc('tracking').get();
      const webhookUrl = settingsDoc.data()?.webhookUrl;

      if (webhookUrl) {
        // Combinar dados antigos com os novos para enviar objeto completo
        const webhookPayload = {
            ...currentData,
            customer: {
                ...currentData?.customer,
                name: customerName,
                address: customerAddress,
                phone: customerPhone.replace(/\s/g, ''),
            },
            note: note || '',
            trackingNumber: trackingNumber || currentData?.trackingNumber,
            status: updatePayload.status || currentData?.status,
            orderId: orderId,
            countryCode: countryCode,
            updatedAt: new Date().toISOString()
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
            console.log("Webhook sent successfully");
        }
      } else {
          console.warn("No webhook URL found in settings/tracking");
      }
    } catch (webhookError) {
      console.error("Error sending webhook:", webhookError);
      // Não falhamos a operação principal se o webhook falhar
    }

    revalidatePath('/master-shopify-orders');
    return { success: true };

  } catch (error: any) {
    console.error("Error updating order details:", error);
    
    // Verificação específica de erro de credenciais
    if (error.message && error.message.includes("Firebase Admin SDK environment variables are not set")) {
        return { success: false, error: "Erro de Servidor: Credenciais Firebase em falta." };
    }

    return { success: false, error: error.message || 'An unexpected server error occurred.' };
  }
}
