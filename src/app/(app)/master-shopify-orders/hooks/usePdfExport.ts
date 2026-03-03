'use client';

import { useState } from 'react';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';
import type { Order } from '../types';
import { MAX_ORDERS_PER_PDF } from '../types';

export function usePdfExport() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportChunksInfo, setExportChunksInfo] = useState<{
    totalChunks: number;
    totalOrders: number;
  } | null>(null);

  const formatSizeForPdf = (size: unknown): string | string[] => {
    if (!size) return '—';
    const s = String(size).trim();
    if (/years/i.test(s)) {
      return s.replace(/years/i, '\nyears').split('\n');
    }
    return s;
  };

  const handleExportPackingSheetPDF = async (
    ordersToExport: Order[],
    orderTab: 'pending' | 'shipped'
  ) => {
    setIsExporting(true);

    const imageCache: Record<string, string> = {};

    const loadImageAsDataURL = async (url: string): Promise<string> => {
      if (imageCache[url]) return imageCache[url];
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          imageCache[url] = dataUrl;
          resolve(dataUrl);
        };
        reader.readAsDataURL(blob);
      });
    };

    const toText = (value: unknown, fallback: string = '—'): string => {
      if (value === undefined || value === null) return fallback;
      const s = String(value);
      return s.trim() === '' ? fallback : s;
    };

    try {
      if (ordersToExport.length === 0) {
        toast({ title: 'No Orders', description: 'There are no orders to export with the current filters.' });
        return;
      }

      const total = ordersToExport.length;
      const chunks: Order[][] = [];
      for (let i = 0; i < total; i += MAX_ORDERS_PER_PDF) {
        chunks.push(ordersToExport.slice(i, i + MAX_ORDERS_PER_PDF));
      }

      setExportChunksInfo({ totalChunks: chunks.length, totalOrders: total });

      const todayStr = new Date().toISOString().split('T')[0];
      const baseName = orderTab === 'pending' ? 'pending_orders' : 'shipped_orders';

      for (let batchIndex = 0; batchIndex < chunks.length; batchIndex++) {
        const batchOrders = chunks[batchIndex];
        const partNumber = batchIndex + 1;
        const totalParts = chunks.length;

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const marginX = 10;
        const marginY = 10;
        const rowHeight = 26;
        const thumbSize = 18;

        const columns = [
          { key: 'thumb', label: 'Thumbnail', width: 26 },
          { key: 'product', label: 'Product', width: 68 },
          { key: 'size', label: 'Size', width: 12 },
          { key: 'qty', label: 'Qty', width: 12 },
          { key: 'version', label: 'Version', width: 25 },
          { key: 'custom', label: 'Customization', width: pageWidth - marginX * 2 - (26 + 68 + 12 + 12 + 25) },
        ];

        let cursorY = marginY;

        for (let orderIndex = 0; orderIndex < batchOrders.length; orderIndex++) {
          const order = batchOrders[orderIndex];

          if (orderIndex > 0) {
            pdf.addPage();
            cursorY = marginY;
            pdf.setDrawColor(0, 0, 0);
            pdf.setTextColor(0, 0, 0);
            pdf.setLineWidth(0.3);
          }

          // Order Header
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          const orderHeader = `Order ${order.id.replace(/^#/, '')} - ${order.customer.name} - ${order.date.split(' | ')[0]} (${order.countryCode})`;
          pdf.text(orderHeader, marginX, cursorY);
          cursorY += 7;

          // Address and Tracking
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);

          const addressText = toText(order.customer.address);
          const addressLines = pdf.splitTextToSize(addressText, 70);
          const addressLineSpacing = 4;
          const minAddressHeight = addressLines.length * addressLineSpacing + 6;

          if (cursorY + minAddressHeight > pageHeight - marginY) {
            pdf.addPage();
            cursorY = marginY;
            pdf.setDrawColor(0, 0, 0);
            pdf.setTextColor(0, 0, 0);
            pdf.setLineWidth(0.3);
          }

          let currentAddressY = cursorY;
          addressLines.forEach((line: string) => {
            pdf.text(line, marginX, currentAddressY);
            currentAddressY += addressLineSpacing;
          });
          cursorY = currentAddressY + 1;

          pdf.text(`Phone: ${toText(order.customer.phone)}`, marginX + 80, cursorY - addressLineSpacing);

          const cleanTrackingPDF = order.trackingNumber ? order.trackingNumber.replace(/^TN_/, '') : '';
          pdf.text(`Tracking: ${toText(cleanTrackingPDF)}`, marginX, cursorY);
          cursorY += 6;

          // Table Header
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.3);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          let headerX = marginX;
          columns.forEach((col) => {
            pdf.rect(headerX, cursorY, col.width, 8);
            pdf.text(col.label, headerX + 2, cursorY + 5);
            headerX += col.width;
          });
          cursorY += 8;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);

          for (const item of order.items) {
            const lineSpacing = 3.5;
            const productNameLines = pdf.splitTextToSize(toText(item.name), columns[1].width - 4);
            const custLines = pdf.splitTextToSize(toText(item.customization), columns[5].width - 4);
            const textBlockHeight = Math.max(
              productNameLines.length * lineSpacing + 8,
              custLines.length * lineSpacing + 4,
              thumbSize + 8
            );
            const dynamicRowHeight = Math.max(26, textBlockHeight);

            if (cursorY + dynamicRowHeight > pageHeight - marginY) {
              pdf.addPage();
              cursorY = marginY;
              pdf.setDrawColor(0, 0, 0);
              pdf.setTextColor(0, 0, 0);
              pdf.setLineWidth(0.3);

              pdf.setFontSize(12);
              pdf.setFont('helvetica', 'bold');
              pdf.text(`Order ${order.id.replace(/^#/, '')} — (cont.)`, marginX, cursorY);
              cursorY += 8;

              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'bold');
              let contHeaderX = marginX;
              columns.forEach((col) => {
                pdf.rect(contHeaderX, cursorY, col.width, 8);
                pdf.text(col.label, contHeaderX + 2, cursorY + 5);
                contHeaderX += col.width;
              });
              cursorY += 8;
              pdf.setFont('helvetica', 'normal');
              pdf.setFontSize(8);
            }

            pdf.setDrawColor(0, 0, 0);
            let cellX = marginX;
            columns.forEach((col) => {
              pdf.rect(cellX, cursorY, col.width, dynamicRowHeight);
              cellX += col.width;
            });

            // Thumbnail
            const validThumb = item.thumbnailUrl && item.thumbnailUrl !== 'null' && item.thumbnailUrl !== 'undefined' && item.thumbnailUrl.trim() !== '' && item.thumbnailUrl.startsWith('http');
            const thumbUrl = validThumb ? item.thumbnailUrl : 'https://placehold.co/80x80/e2e8f0/64748b?text=N/A';

            try {
              const imgData = await loadImageAsDataURL(thumbUrl);
              const imgY = cursorY + (dynamicRowHeight - thumbSize) / 2;
              pdf.addImage(imgData, 'JPEG', marginX + 4, imgY, thumbSize, thumbSize);
            } catch (imgError) {
              console.error('Error loading image:', imgError);
              pdf.text('Image N/A', marginX + 4, cursorY + rowHeight / 2);
            }

            // Product Name
            let currentNameY = cursorY + 5;
            productNameLines.forEach((line: string) => {
              pdf.text(line, marginX + columns[0].width + 2, currentNameY);
              currentNameY += lineSpacing;
            });
            const productIdY = currentNameY + 1.5;
            pdf.text(`ID: ${toText(item.productId)}`, marginX + columns[0].width + 2, productIdY);

            // Size + Qty
            const centerY = cursorY + dynamicRowHeight / 2 + 2;
            const sizeCenterX = marginX + columns[0].width + columns[1].width + columns[2].width / 2;
            const formattedSize = formatSizeForPdf(item.size);
            pdf.text(formattedSize, sizeCenterX, cursorY + dynamicRowHeight / 2 - 2, { align: 'center' });

            const qtyCenterX = marginX + columns[0].width + columns[1].width + columns[2].width + columns[3].width / 2;
            pdf.text(toText(item.quantity), qtyCenterX, centerY, { align: 'center' });

            // Version
            pdf.text(
              toText(item.version),
              marginX + columns[0].width + columns[1].width + columns[2].width + columns[3].width + 2,
              centerY,
              { maxWidth: columns[4].width - 4 }
            );

            // Customization
            const textH = custLines.length * lineSpacing;
            const centeredY = cursorY + dynamicRowHeight / 2 - textH / 2 + lineSpacing / 2;
            pdf.text(
              custLines,
              marginX + columns[0].width + columns[1].width + columns[2].width + columns[3].width + columns[4].width + 2,
              centeredY
            );

            cursorY += dynamicRowHeight;
          }

          // Order Note
          if (order.note) {
            const noteText = `Note: ${toText(order.note)}`;
            const noteLines = pdf.splitTextToSize(noteText, pageWidth - marginX * 2 - 6);

            if (cursorY + noteLines.length * 6 + 7 > pageHeight - marginY) {
              pdf.addPage();
              cursorY = marginY;
              pdf.setDrawColor(0, 0, 0);
              pdf.setTextColor(0, 0, 0);
              pdf.setLineWidth(0.3);
            }

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.rect(marginX, cursorY, pageWidth - marginX * 2, noteLines.length * 6 + 7);
            let noteY = cursorY + 4;
            pdf.text('NOTE:', marginX + 2, noteY);
            pdf.setFont('helvetica', 'normal');
            noteY += 5;
            noteLines.forEach((line: string) => {
              pdf.text(line, marginX + 3, noteY);
              noteY += 5;
            });
            cursorY += noteLines.length * 6 + 7;
          }

          // Separator
          cursorY += 4;
          pdf.setLineWidth(0.2);
          pdf.line(marginX, cursorY, pageWidth - marginX, cursorY);
          cursorY += 4;
        }

        const suffix = totalParts > 1 ? `_part-${partNumber}-of-${totalParts}` : '';
        pdf.save(`${baseName}_${todayStr}${suffix}.pdf`);
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({ variant: 'destructive', title: 'Erro ao gerar o PDF', description: 'Tenta novamente em alguns segundos.' });
    } finally {
      setIsExporting(false);
      setExportChunksInfo(null);
    }
  };

  return { isExporting, exportChunksInfo, handleExportPackingSheetPDF };
}
