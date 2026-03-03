'use client';

import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import type { Order } from '../types';

export function useExcelExport() {
  const { toast } = useToast();

  const handleExportCurrentListXLSX = (
    ordersToExport: Order[],
    orderTab: 'pending' | 'shipped',
    selectedOrderIdForSearch: string | null
  ) => {
    try {
      let filtered = ordersToExport;
      if (selectedOrderIdForSearch) {
        filtered = filtered.filter((o) => o.id === selectedOrderIdForSearch);
      }

      if (filtered.length === 0) {
        toast({ title: 'No Orders', description: 'There are no orders to export with the current filters.' });
        return;
      }

      const rows = filtered.flatMap((order) =>
        (order.items || []).map((item) => {
          const variants = [item.size, item.customization].filter(Boolean).join(' ; ');
          return {
            'Order Name': order.id,
            'Name of the item': item.name ?? '',
            'Quantity': item.quantity ?? '',
            'Customer name': order.customer?.name ?? '',
            'Address': order.customer?.address ?? '',
            'Variants (Size ; customization)': variants,
            'Version': item.version ?? '',
            'thumbnailUrl': item.thumbnailUrl ?? '',
          };
        })
      );

      if (rows.length === 0) {
        toast({ title: 'No Items', description: 'There are no items to export in the current list.' });
        return;
      }

      const header = [
        'Order Name',
        'Name of the item',
        'Quantity',
        'Customer name',
        'Address',
        'Variants (Size ; customization)',
        'Version',
        'thumbnailUrl',
      ];

      const ws = XLSX.utils.json_to_sheet(rows, { header });

      const thumbColIndex = header.indexOf('thumbnailUrl');
      for (let i = 0; i < rows.length; i++) {
        const rowNumberInSheet = i + 1;
        const cellAddress = XLSX.utils.encode_cell({ r: rowNumberInSheet, c: thumbColIndex });
        const thumbUrl = (rows[i] as any)['thumbnailUrl'] ?? '';
        ws[cellAddress] = { t: 's', v: thumbUrl };
      }

      ws['!cols'] = [
        { wch: 15 },
        { wch: 35 },
        { wch: 10 },
        { wch: 24 },
        { wch: 45 },
        { wch: 38 },
        { wch: 12 },
        { wch: 60 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Current List');

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.download = `current-list-${orderTab}-${stamp}.xlsx`;

      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ title: 'XLSX exported', description: `Exported ${rows.length} line(s) with Order Names.` });
    } catch (err) {
      console.error('XLSX export error:', err);
      toast({ title: 'Export failed', description: 'Something went wrong while exporting the XLSX.', variant: 'destructive' });
    }
  };

  return { handleExportCurrentListXLSX };
}
