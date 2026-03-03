'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

// --- Validation ---

const VALID_COUNTRIES = ['PT', 'ES', 'DE'] as const;
type ValidCountry = typeof VALID_COUNTRIES[number];

function isValidCountryCode(code: string): code is ValidCountry {
  return VALID_COUNTRIES.includes(code as ValidCountry);
}

const FILE_URL_PATTERN = /^[A-Z]{2}\/[A-Z]{2}_orders_\d{4}-\d{2}-\d{2}_.+\.xlsx$/;

// --- Types ---

type ExportOrder = {
  id: string;
  order_number: string;
  country_code: string;
  shopify_created_at: string | null;
  customers: { name: string; address_line1: string | null; city: string | null; postal_code: string | null } | null;
  shipping_address: Record<string, string> | null;
  order_items: {
    id: string;
    product_name: string;
    quantity: number;
    size: string | null;
    customization: string | null;
    version: string | null;
    thumbnail_url: string | null;
  }[];
  order_costs: {
    production_cost: number | null;
    shipping_cost: number | null;
    total_cost: number | null;
  }[];
};

export type SupplierExport = {
  id: string;
  country_code: string;
  file_name: string;
  file_url: string | null;
  order_range: string | null;
  total_items: number | null;
  total_production_cost: number | null;
  total_shipping_cost: number | null;
  total_cost: number | null;
  exported_at: string;
};

// --- Helpers ---

function buildAddress(order: ExportOrder): string {
  const sa = order.shipping_address;
  if (sa) {
    const parts = [sa.address1, sa.address2, sa.city, sa.zip, sa.province, sa.country].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }
  const c = order.customers;
  if (!c) return '';
  return [c.address_line1, c.city, c.postal_code].filter(Boolean).join(', ');
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch {
    return null;
  }
}

// --- Public Actions ---

export async function getExportableOrderCount(countryCode: string) {
  try {
    if (!isValidCountryCode(countryCode)) return { success: false as const, count: 0 };
    await requireAdmin();
    const supabase = createServiceClient();

    // Get last checkpoint for this country
    const { data: checkpoint } = await supabase
      .from('export_checkpoints')
      .select('last_order_number')
      .eq('country_code', countryCode)
      .eq('export_type', 'supplier_orders')
      .single();

    // Count orders after last checkpoint
    let query = supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('country_code', countryCode)
      .is('deleted_at', null);

    if (checkpoint?.last_order_number) {
      query = query.gt('order_number', checkpoint.last_order_number);
    }

    const { count, error } = await query;
    if (error) return { success: false as const, count: 0 };
    return { success: true as const, count: count ?? 0 };
  } catch {
    return { success: false as const, count: 0 };
  }
}

export async function getExportHistory(countryCode?: string) {
  try {
    await requireAdmin();
    const supabase = createServiceClient();

    let query = supabase
      .from('supplier_exports')
      .select('*')
      .order('exported_at', { ascending: false })
      .limit(20);

    if (countryCode && countryCode !== 'ALL') {
      query = query.eq('country_code', countryCode);
    }

    const { data, error } = await query;
    if (error) return { success: false as const, error: error.message, exports: [] as SupplierExport[] };
    return { success: true as const, exports: (data ?? []) as SupplierExport[] };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg, exports: [] as SupplierExport[] };
  }
}

export async function getExportDownloadUrl(fileUrl: string) {
  try {
    if (!FILE_URL_PATTERN.test(fileUrl)) {
      return { success: false as const, error: 'Invalid file path.' };
    }
    await requireAdmin();
    const supabase = createServiceClient();

    // fileUrl is stored as the storage path (e.g., "PT/PT_orders_2026-03-03_...xlsx")
    const { data, error } = await supabase.storage
      .from('supplier-exports')
      .createSignedUrl(fileUrl, 300); // 5 minute signed URL

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, url: data.signedUrl };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

export async function generateSupplierExport(countryCode: string) {
  try {
    if (!isValidCountryCode(countryCode)) {
      return { success: false as const, error: 'Invalid country code.' };
    }
    const { user } = await requireAdmin();
    const rl = rateLimit(`supplierExport:${user.id}`, 3, 60_000);
    if (!rl.success) {
      return { success: false as const, error: 'Too many export requests. Wait before generating another.' };
    }

    const supabase = createServiceClient();

    // 1. Get last checkpoint
    const { data: checkpoint } = await supabase
      .from('export_checkpoints')
      .select('last_order_number')
      .eq('country_code', countryCode)
      .eq('export_type', 'supplier_orders')
      .single();

    // 2. Fetch orders since last checkpoint
    let query = supabase
      .from('orders')
      .select(`
        id, order_number, country_code, shopify_created_at,
        customers (name, address_line1, city, postal_code),
        shipping_address,
        order_items (id, product_name, quantity, size, customization, version, thumbnail_url),
        order_costs (production_cost, shipping_cost, total_cost)
      `)
      .eq('country_code', countryCode)
      .is('deleted_at', null)
      .order('order_number', { ascending: true });

    if (checkpoint?.last_order_number) {
      query = query.gt('order_number', checkpoint.last_order_number);
    }

    const { data: orders, error: ordersError } = await query;
    if (ordersError) {
      return { success: false as const, error: `Failed to fetch orders: ${ordersError.message}` };
    }

    const typedOrders = (orders ?? []) as unknown as ExportOrder[];
    if (typedOrders.length === 0) {
      return { success: false as const, error: 'No new orders to export.' };
    }

    // 3. Generate Excel with ExcelJS
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MisterTuga';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Supplier Orders', {
      properties: { defaultRowHeight: 65 },
    });

    // Define columns
    sheet.columns = [
      { header: 'Order', key: 'order', width: 16 },
      { header: 'Item Name', key: 'item_name', width: 30 },
      { header: 'Qty', key: 'quantity', width: 6 },
      { header: 'Customer', key: 'customer', width: 20 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Size', key: 'size', width: 10 },
      { header: 'Customization', key: 'customization', width: 20 },
      { header: 'Version', key: 'version', width: 14 },
      { header: 'Thumbnail', key: 'thumbnail', width: 12 },
      { header: 'Prod Cost', key: 'prod_cost', width: 11 },
      { header: 'Ship Cost', key: 'ship_cost', width: 11 },
      { header: 'Total Cost', key: 'total_cost', width: 11 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A148C' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.height = 25;

    // Flatten orders into rows and track totals
    let totalProdCost = 0;
    let totalShipCost = 0;
    let totalTotalCost = 0;
    let totalItems = 0;
    const exportItems: Array<{
      order_item_id: string;
      order_number: string;
      item_name: string;
      quantity: number;
      size: string | null;
      customization: string | null;
      thumbnail_url: string | null;
      production_cost: number | null;
      shipping_cost: number | null;
    }> = [];

    for (const order of typedOrders) {
      const customerName = order.customers?.name ?? '';
      const address = buildAddress(order);
      const costData = order.order_costs?.[0];
      const itemCount = order.order_items?.length ?? 0;
      // Split cost evenly across items for per-row display
      const perItemProd = costData?.production_cost && itemCount > 0
        ? Math.round((costData.production_cost / itemCount) * 100) / 100 : null;
      const perItemShip = costData?.shipping_cost && itemCount > 0
        ? Math.round((costData.shipping_cost / itemCount) * 100) / 100 : null;

      if (costData?.production_cost) totalProdCost += costData.production_cost;
      if (costData?.shipping_cost) totalShipCost += costData.shipping_cost;
      if (costData?.total_cost) totalTotalCost += costData.total_cost;

      for (const item of order.order_items ?? []) {
        totalItems += item.quantity;

        const rowNum = sheet.rowCount + 1;
        const row = sheet.addRow({
          order: order.order_number,
          item_name: item.product_name,
          quantity: item.quantity,
          customer: customerName,
          address: address,
          size: item.size ?? '',
          customization: item.customization ?? '',
          version: item.version ?? '',
          thumbnail: '', // Placeholder — image added below
          prod_cost: perItemProd,
          ship_cost: perItemShip,
          total_cost: perItemProd != null && perItemShip != null
            ? Math.round((perItemProd + perItemShip) * 100) / 100
            : null,
        });
        row.height = 65;

        // Try to embed image
        if (item.thumbnail_url && item.thumbnail_url.startsWith('http')) {
          const imgBase64 = await fetchImageAsBase64(item.thumbnail_url);
          if (imgBase64) {
            const imageId = workbook.addImage({
              base64: imgBase64,
              extension: 'png',
            });
            sheet.addImage(imageId, {
              tl: { col: 8, row: rowNum - 1 },
              ext: { width: 55, height: 55 },
            });
          } else {
            // Fallback: show URL text
            row.getCell('thumbnail').value = item.thumbnail_url;
            row.getCell('thumbnail').font = { size: 7 };
          }
        }

        exportItems.push({
          order_item_id: item.id,
          order_number: order.order_number,
          item_name: item.product_name,
          quantity: item.quantity,
          size: item.size,
          customization: item.customization,
          thumbnail_url: item.thumbnail_url,
          production_cost: perItemProd,
          shipping_cost: perItemShip,
        });
      }
    }

    // Summary row
    const summaryRow = sheet.addRow({
      order: 'TOTAL',
      item_name: '',
      quantity: totalItems,
      customer: '',
      address: '',
      size: '',
      customization: '',
      version: '',
      thumbnail: '',
      prod_cost: Math.round(totalProdCost * 100) / 100,
      ship_cost: Math.round(totalShipCost * 100) / 100,
      total_cost: Math.round(totalTotalCost * 100) / 100,
    });
    summaryRow.font = { bold: true };
    summaryRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };

    // 4. Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // 5. Build file name
    const firstOrder = typedOrders[0].order_number;
    const lastOrder = typedOrders[typedOrders.length - 1].order_number;
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `${countryCode}_orders_${dateStr}_${firstOrder}-${lastOrder}_${totalItems}pcs.xlsx`;
    const storagePath = `${countryCode}/${fileName}`;

    // 6. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('supplier-exports')
      .upload(storagePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { success: false as const, error: `Failed to upload file: ${uploadError.message}` };
    }

    // 7. Insert supplier_exports record
    const { data: exportRecord, error: insertError } = await supabase
      .from('supplier_exports')
      .insert({
        country_code: countryCode,
        file_name: fileName,
        file_url: storagePath,
        order_range: `${firstOrder}-${lastOrder}`,
        total_items: totalItems,
        total_production_cost: Math.round(totalProdCost * 100) / 100,
        total_shipping_cost: Math.round(totalShipCost * 100) / 100,
        total_cost: Math.round(totalTotalCost * 100) / 100,
        exported_by: user.id,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert export record error:', insertError);
      return { success: false as const, error: 'File uploaded but failed to record export.' };
    }

    // 8. Insert supplier_export_items
    if (exportRecord) {
      const itemsToInsert = exportItems.map((item) => ({
        ...item,
        export_id: exportRecord.id,
      }));
      const { error: itemsError } = await supabase.from('supplier_export_items').insert(itemsToInsert);
      if (itemsError) console.error('Failed to insert export items:', itemsError);
    }

    // 9. Update checkpoint
    await supabase
      .from('export_checkpoints')
      .upsert(
        {
          country_code: countryCode,
          export_type: 'supplier_orders',
          last_order_number: lastOrder,
          last_export_at: new Date().toISOString(),
          exported_by: user.id,
          metadata: { file_name: fileName, total_items: totalItems },
        },
        { onConflict: 'country_code,export_type' }
      );

    revalidatePath('/master-shopify-orders');

    // 10. Get signed URL for immediate download
    const { data: signedData } = await supabase.storage
      .from('supplier-exports')
      .createSignedUrl(storagePath, 300);

    return {
      success: true as const,
      fileName,
      downloadUrl: signedData?.signedUrl ?? null,
      totalOrders: typedOrders.length,
      totalItems,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Export generation error:', msg);
    return { success: false as const, error: msg };
  }
}
