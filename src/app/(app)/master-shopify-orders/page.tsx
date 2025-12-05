'use client';

import { useState, useEffect, useTransition } from 'react';
import Image from 'next/image';
import { useFirebase } from '@/firebase';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Database, Pencil, RotateCcw, StickyNote, Download, Calendar as CalendarIcon, X } from 'lucide-react';
import { collectionGroup, query, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { updateOrderDetails } from './actions';
import jsPDF from 'jspdf';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from "lucide-react";

// --- Type Definitions ---
type Product = { name: string; productId: string; customization: string; size: string; quantity: number; thumbnailUrl: string; version: string; };
type Customer = { name: string; address: string; phone: string; };
type Order = { id: string; country: string; countryCode: string; date: string; status: 'Pending Production' | 'Shipped'; customer: Customer; trackingNumber: string; items: Product[]; note?: string; };
type FirestoreOrder = Omit<Order, 'date' | 'items' | 'customer'> & { date: Timestamp | string; items?: Product[]; note?: string; customer: Omit<Customer, 'phone'> & { phone: string | number } };
type ExportType = 'pending' | 'shipped' | 'all';

// --- Zod Schema for the Edit Modal ---
const editOrderSchema = z.object({
  customerName: z.string().min(1, 'Name is required'),
  customerAddress: z.string().min(1, 'Address is required'),
  customerPhone: z.string().min(1, 'Phone is required'),
  trackingNumber: z.string().optional(),
  note: z.string().optional(),
});
type EditOrderSchema = z.infer<typeof editOrderSchema>;

// --- Flag Components ---
const FlagPT = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15"><path fill="#006233" d="M0 0h8v15H0z"/><path fill="#D21034" d="M8 0h12v15H8z"/><circle cx="8" cy="7.5" r="2.5" fill="#FFE000"/><path fill="none" stroke="#D21034" strokeWidth="0.5" d="M8 5a2.5 2.5 0 000 5m-1.5-3.5h3"/></svg>;
const FlagDE = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15"><path fill="#000" d="M0 0h20v5H0z"/><path fill="#D00" d="M0 5h20v5H0z"/><path fill="#FFCE00" d="M0 10h20v5H0z"/></svg>;
const FlagES = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15"><path fill="#C60B1E" d="M0 0h20v3.75H0zM0 11.25h20V15H0z"/><path fill="#FFC400" d="M0 3.75h20v7.5H0z"/></svg>;
const countryFlags: { [key: string]: React.ReactNode } = { PT: <FlagPT />, DE: <FlagDE />, ES: <FlagES /> };

// --- Date Filter Components ---
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// Helper to pad numbers
const pad = (n: number) => n.toString().padStart(2, '0');

// --- Main Page Component ---
export default function MasterShopifyOrdersPage() {
  const { firestore, user, isUserLoading } = useFirebase();
    
    // Tabs
  const [orderTab, setOrderTab] = useState<"pending" | "shipped">("pending");
  
  // Overlay State
  const [isExporting, setIsExporting] = useState(false);

  // Pagination
  const ITEMS_PER_PAGE = 10;
  const [page, setPage] = useState(1);

  const [orders, setOrders] = useState<Order[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [trackingNumbers, setTrackingNumbers] = useState<{ [key: string]: string }>({});
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isPending, startTransition] = useTransition();

  // Date Filter State
  const [startDate, setStartDate] = useState<{ day: string; month: string }>({ day: '', month: '' });
  const [endDate, setEndDate] = useState<{ day: string; month: string }>({ day: '', month: '' });
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

  const { toast } = useToast();
  const form = useForm<EditOrderSchema>({ resolver: zodResolver(editOrderSchema) });

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (editingOrder) {
      form.reset({
        customerName: editingOrder.customer.name,
        customerAddress: editingOrder.customer.address,
        customerPhone: String(editingOrder.customer.phone || ''),
        trackingNumber: editingOrder.trackingNumber || '',
        note: editingOrder.note || '',
      });
    }
  }, [editingOrder, form]);

  useEffect(() => {
    if (isUserLoading || !firestore || !user) {
      setPageLoading(false);
      return;
    }
    const q = query(collectionGroup(firestore, 'orders'));
    setPageLoading(true);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => {
        const data = doc.data() as FirestoreOrder;
        
        let finalDate = "";
        if (data.date instanceof Timestamp) {
          // 🔥 Caso Firestore Timestamp
          const d = data.date.toDate();
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const hh = String(d.getHours()).padStart(2, "0");
          const min = String(d.getMinutes()).padStart(2, "0");
        
          finalDate = `${yyyy}-${mm}-${dd} | ${hh}:${min}`;
        } else {
          // 🔥 Caso seja string que vem do Shopify ("3 de dezembro de 2025 às 23:36:17 UTC")
          const raw = String(data.date);
        
          // Extrair hora (23:36)
          const timeMatch = raw.match(/\d{1,2}:\d{2}/);
          const time = timeMatch ? timeMatch[0] : "";
        
          // Tentar converter a data inteira
          const parsed = new Date(raw);
        
          if (!isNaN(parsed.getTime())) {
            // Se a string for válida para o JS, formatamos corretamente
            const yyyy = parsed.getFullYear();
            const mm = String(parsed.getMonth() + 1).padStart(2, "0");
            const dd = String(parsed.getDate()).padStart(2, "0");
        
            finalDate = `${yyyy}-${mm}-${dd}${time ? ` | ${time}` : ""}`;
          } else {
            // Fallback — mantém a string original
            finalDate = raw;
          }
        }        
        const customer: Customer = {
          name: data.customer?.name || '',
          address: data.customer?.address || '',
          phone: String(data.customer?.phone || ''),
        };
        return { ...data, id: doc.id, date: finalDate, customer, items: data.items || [] } as Order;
      });
      setOrders(allOrders);
      setPageLoading(false);
    }, (error) => { console.error("Error fetching orders: ", error); setPageLoading(false); });
    return () => unsubscribe();
  }, [user, isUserLoading, firestore]);

  const handleOpenEditModal = (order: Order) => {
    setEditingOrder(order);
    setIsEditModalOpen(true);
  };

  const handleUpdateOrder = (data: EditOrderSchema) => {
    if (!editingOrder) return;
    startTransition(async () => {
      const result = await updateOrderDetails({ orderId: editingOrder.id, countryCode: editingOrder.countryCode, ...data });
      if (result.success) {
        toast({ title: 'Order Updated', description: 'The details have been saved successfully.' });
        setIsEditModalOpen(false);
      } else {
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not save the details.' });
        console.error("Failed to update order:", result.error);
      }
    });
  };

  const handleSubmitTrackingNumber = async (order: Order) => {
    if (!user || !firestore) return;
    const trackingNumber = trackingNumbers[order.id];
    if (!trackingNumber) { toast({ variant: "destructive", title: "Missing Tracking Number" }); return; }
    startTransition(async () => {
        const result = await updateOrderDetails({ 
            orderId: order.id,
            countryCode: order.countryCode,
            customerName: order.customer.name, 
            customerAddress: order.customer.address, 
            customerPhone: order.customer.phone,
            note: order.note,
            trackingNumber 
        });
        if(result.success) { toast({ title: "Tracking Submitted"}); setTrackingNumbers(p => ({...p, [order.id]: ''})); } 
        else { toast({ variant: "destructive", title: "Update Failed"}); }
    });
  };
  
  const handleResetTrackingNumber = async (order: Order) => {
    if (!user || !firestore) return;
    const orderRef = doc(firestore, 'orders', order.countryCode, 'orders', order.id);
    await updateDoc(orderRef, { trackingNumber: "", status: "Pending Production" });
    toast({ title: "Tracking Reset" });
  };

  const handleTrackingNumberChange = (orderId: string, value: string) => setTrackingNumbers(prev => ({ ...prev, [orderId]: value }));

  const filterOrdersByDate = (ordersToFilter: Order[]) => {
    if (!startDate.day || !startDate.month || !endDate.day || !endDate.month) return ordersToFilter;

    // Construct date strings for comparison (MM-DD format is enough since we ignore year mostly, but let's assume current year for simplicity or handle strictly month/day)
    // Actually, orders have 'YYYY-MM-DD'. Let's parse that.
    
    // Convert selected month name to index (0-11) + 1 => string padded
    const startMonthIndex = MONTHS.indexOf(startDate.month) + 1;
    const endMonthIndex = MONTHS.indexOf(endDate.month) + 1;

    const startMonthStr = pad(startMonthIndex);
    const endMonthStr = pad(endMonthIndex);
    const startDayStr = pad(parseInt(startDate.day));
    const endDayStr = pad(parseInt(endDate.day));

    // We will compare strings "MM-DD" for filtering across any year, or assume current year.
    // The prompt implies a simple date filter. Let's assume the user wants to filter within the current year or just by absolute date range if years were involved.
    // However, the UI requested is just Day/Month. This usually implies a "this year" context or "recurring date".
    // Given the order dates are full YYYY-MM-DD strings.
    // Let's assume the filter applies to the date regardless of year, OR (better) assume the current year for the filter bounds if year isn't selected.
    // But since year isn't in the filter UI, let's just filter by comparing the "MM-DD" part of the strings. 
    // Wait, that might be weird if range wraps around year end.
    // Let's stick to standard string comparison on "MM-DD" which works for within-year ranges.
    
    const startCompare = `${startMonthStr}-${startDayStr}`;
    const endCompare = `${endMonthStr}-${endDayStr}`;

    return ordersToFilter.filter(o => {
      const [_, m, d] = o.date.split('-');
      const orderCompare = `${m}-${d}`;
      return orderCompare >= startCompare && orderCompare <= endCompare;
    });
  };

  const filteredOrders = filterOrdersByDate(activeFilter === 'ALL' ? orders : orders.filter(o => o.countryCode === activeFilter));

  const handleExportPackingSheetPDF = async (
    mode: "pending" | "shipped" | "all"
  ) => {
    // Cache apenas para este export
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
  
    const toText = (value: unknown, fallback: string = "—"): string => {
      if (value === undefined || value === null) return fallback;
      const s = String(value);
      return s.trim() === "" ? fallback : s;
    };
  
    setIsExporting(true);
  
    try {
      // 1) Filtrar encomendas
      let ordersToExport: Order[];
  
      if (mode === "pending") {
        ordersToExport = filteredOrders.filter(
          (o) => o.status === "Pending Production"
        );
      } else if (mode === "shipped") {
        ordersToExport = filteredOrders.filter((o) => o.status === "Shipped");
      } else {
        ordersToExport = filteredOrders;
      }
  
      if (ordersToExport.length === 0) {
        toast({
          title: "No Orders",
          description: "There are no orders to export in this category.",
        });
        return;
      }
  
      // 2) Setup PDF
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 10;
      const marginY = 10;
      const rowHeight = 26;
      const thumbSize = 18;
  
      const columns = [
        { key: "thumb", label: "Thumbnail", width: 26 },
        { key: "product", label: "Product", width: 68 },
        { key: "size", label: "Size", width: 12 },
        { key: "qty", label: "Qty", width: 12 },
        { key: "version", label: "Version", width: 25 },
        {
          key: "custom",
          label: "Customization",
          width:
            pageWidth -
            marginX * 2 -
            (26 + 68 + 12 + 12 + 25),
        },
      ];

      // 🔹 X inicial de cada coluna (mesmo que uses em várias páginas)
      const colXPositions: number[] = [];
      {
        let runningX = marginX;
        for (const col of columns) {
          colXPositions.push(runningX);
          runningX += col.width;
        }
      }
  
      let firstPage = true;
  
      for (const order of ordersToExport) {
        if (!firstPage) {
          pdf.addPage();
        }
        firstPage = false;
  
        let cursorY = marginY;
  
        // ---------- HEADER DA ENCOMENDA ----------
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text(
          toText(`Order ${order.id.replace(/^#/, "")} - ${order.date}`),
          marginX,
          cursorY
        );
  
        cursorY += 8;
  
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.text("Customer", marginX, cursorY);
        cursorY += 5;
  
        pdf.setFont("helvetica", "normal");
  
        const addressLines = (order.customer.address || "")
          .split("\n")
          .filter((l) => l.trim() !== "");
  
        const customerLines = [
          toText(order.customer.name),
          ...addressLines.map((l) => toText(l)),
          `Phone: ${toText(order.customer.phone)}`,
          "",
          `Status: ${toText(order.status)}`,
          `Tracking: ${toText(order.trackingNumber, " ")}`,
        ];
  
        customerLines.forEach((line) => {
          pdf.text(line, marginX, cursorY);
          cursorY += 4.5;
        });
  
        // ---------- ESPAÇO + TÍTULO "ITEMS" ----------
        cursorY += 8; // mais respiro depois de Tracking
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Items", marginX, cursorY);
  
        cursorY += 6; // espaço entre título e tabela
  
        // ---------- CABEÇALHO DA TABELA ----------
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
  
        let colX = marginX;
        columns.forEach((col) => {
          pdf.rect(colX, cursorY, col.width, 8);
          pdf.text(col.label, colX + 2, cursorY + 5);
          colX += col.width;
        });
  
        cursorY += 8;
        pdf.setFont("helvetica", "normal");
  
        // ---------- LINHAS DA TABELA ----------
        const items = (order.items || []).filter(
          (it) => it && typeof it === "object"
        );
  
        for (const item of items) {
          // Se não couber mais uma linha, nova página com header de continuação
          if (cursorY + rowHeight > pageHeight - marginY) {
            pdf.addPage();
  
            cursorY = marginY;
            pdf.setFontSize(12);
            pdf.setFont("helvetica", "bold");
            pdf.text(
              toText(`Order ${order.id.replace(/^#/, "")} — (cont.)`),
              marginX,
              cursorY
            );
  
            cursorY += 6;
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "bold");
  
            let headerX = marginX;
            columns.forEach((col) => {
              pdf.rect(headerX, cursorY, col.width, 8);
              pdf.text(col.label, headerX + 2, cursorY + 5);
              headerX += col.width;
            });
  
            cursorY += 8;
            pdf.setFont("helvetica", "normal");
          }
  
          // Caixa da linha
          let cellX = marginX;
          columns.forEach((col) => {
            pdf.rect(cellX, cursorY, col.width, rowHeight);
            cellX += col.width;
          });
  
          // Thumbnail
          const validThumb =
            item.thumbnailUrl &&
            item.thumbnailUrl !== "null" &&
            item.thumbnailUrl !== "undefined" &&
            item.thumbnailUrl.trim() !== "" &&
            item.thumbnailUrl.startsWith("http");
  
          const thumbUrl = validThumb
            ? item.thumbnailUrl
            : "https://placehold.co/80x80/e2e8f0/64748b?text=N/A";
  
          try {
            const imgData = await loadImageAsDataURL(thumbUrl);
            pdf.addImage(
              imgData,
              "JPEG",
              marginX + 4,
              cursorY + 4,
              thumbSize,
              thumbSize
            );
          } catch (e) {
            console.error("Erro ao carregar thumbnail", e);
          }
  
          // ---------- TEXTO NAS COLUNAS ----------
          const baseY = cursorY + 6;

          const productName = toText(item.name);
          const sizeText = toText(item.size);
          const qtyText = toText(item.quantity ?? 0, "0");
          const versionText = toText(item.version);
          const customizationText = toText(item.customization);

          // X de cada coluna
          const thumbX = colXPositions[0];
          const productX = colXPositions[1];
          const sizeX = colXPositions[2];
          const qtyX = colXPositions[3];
          const versionX = colXPositions[4];
          const customX = colXPositions[5];

          // Product (esquerda, com maxWidth)
          pdf.setFont("helvetica", "normal");
          pdf.text(productName, productX + 2, baseY, {
            maxWidth: columns[1].width - 4,
          });

          // Size (centrado na coluna)
          const sizeCenterX = sizeX + columns[2].width / 2;
          pdf.text(sizeText, sizeCenterX, baseY, { align: "center" });

          // Qty (centrado na coluna)
          const qtyCenterX = qtyX + columns[3].width / 2;
          pdf.text(qtyText, qtyCenterX, baseY, { align: "center" });

          // Version (Player Edition em negrito)
          if (versionText === "Player Edition") {
            pdf.setFont("helvetica", "bold");
          } else {
            pdf.setFont("helvetica", "normal");
          }
          pdf.text(versionText, versionX + 2, baseY, {
            maxWidth: columns[4].width - 4,
          });

          // Customization (normal, esquerda)
          pdf.setFont("helvetica", "normal");
          pdf.text(customizationText, customX + 2, baseY, {
            maxWidth: columns[5].width - 4,
          });
  
          cursorY += rowHeight;
        }
  
        // ---------- NOTAS ----------
        if (order.note) {
          if (cursorY + 20 > pageHeight - marginY) {
            pdf.addPage();
            cursorY = marginY + 10;
          }
  
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.text("Notes", marginX, cursorY + 5);
  
          pdf.setFont("helvetica", "normal");
  
          const noteLines = pdf.splitTextToSize(
            order.note,
            pageWidth - marginX * 2
          );
  
          pdf.rect(
            marginX,
            cursorY + 7,
            pageWidth - marginX * 2,
            noteLines.length * 5 + 6
          );
  
          let noteY = cursorY + 12;
          noteLines.forEach((line) => {
            pdf.text(line, marginX + 3, noteY);
            noteY += 5;
          });
        }
      }
  
      pdf.save(`${mode}_orders_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar o PDF",
        description: "Tenta novamente em alguns segundos.",
      });
    } finally {
      setIsExporting(false);
    }
  };
    

  if (pageLoading || isUserLoading) return <div className="flex h-[400px] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <div className="text-center"><h1 className="font-headline text-2xl font-bold">Access Denied</h1><p>Please log in.</p></div>;

  const pendingCounts = {
    ALL: orders.filter(o => o.status === 'Pending Production').length,
    PT: orders.filter(o => o.countryCode === 'PT' && o.status === 'Pending Production').length,
    DE: orders.filter(o => o.countryCode === 'DE' && o.status === 'Pending Production').length,
    ES: orders.filter(o => o.countryCode === 'ES' && o.status === 'Pending Production').length,
  };

  const pendingOrders = filteredOrders.filter(o => o.status === 'Pending Production');
  const shippedOrders = filteredOrders.filter(o => o.status === 'Shipped');

  // Select list based on tab
  const listToShow = orderTab === "pending" ? pendingOrders : shippedOrders;
  const totalPages = Math.ceil(listToShow.length / ITEMS_PER_PAGE);

  const paginatedOrders = listToShow.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const renderOrderCard = (order: Order, isShipped = false) => {
    // Cor da barra vertical por país
    const countryColor =
      order.countryCode === "PT" ? "#008000" : // Verde
      order.countryCode === "DE" ? "#FFCE00" : // Amarelo
      order.countryCode === "ES" ? "#C60B1E" : // Vermelho
      "#888"; // fallback

    return (
      <Card
        id={`order-${order.id}`}
        key={order.id}
        className="relative overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 bg-card"
        style={{
          borderLeft: `8px solid ${countryColor}`,
        }}
      >
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between p-4 bg-muted/20">
          <div className="flex items-center gap-3 font-semibold text-card-foreground">
            {countryFlags[order.countryCode]}
            <span>{order.id}</span>
          </div>
  
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="text-lg">🕒</span> {order.date}
          </div>
        </CardHeader>
  
        {/* Body */}
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
          {/* ITEMS */}
          <div className="md:col-span-2 flex flex-col gap-4">
            {Array.isArray(order.items) &&
              order.items
                .filter((it) => it && typeof it === "object")
                .map((item, index) => {
                  const validThumb =
                    item.thumbnailUrl &&
                    item.thumbnailUrl !== "null" &&
                    item.thumbnailUrl !== "undefined" &&
                    item.thumbnailUrl.trim() !== "" &&
                    item.thumbnailUrl.startsWith("http");
  
                  return (
                    <div key={index} className="flex items-start gap-4">
                      <div className="thumb-wrapper">
                        <img
                          src={
                            validThumb
                              ? item.thumbnailUrl
                              : "https://placehold.co/80x80/e2e8f0/64748b?text=N/A"
                          }
                          alt={item.name || "Item"}
                          className="thumb-image rounded-md shadow-sm"
                        />
                      </div>
  
                      <div className="text-sm leading-tight space-y-1">
                        <p className="font-semibold">{item.name ?? "Unnamed Product"}</p>
                        <p className="text-muted-foreground">ID: {item.productId ?? "—"}</p>
                        <p className="text-muted-foreground">Customization: {item.customization ?? "—"}</p>
                        <p className="text-muted-foreground">Size: {item.size ?? "—"}</p>
                        <p className="text-muted-foreground">Qty: {item.quantity ?? 0}</p>
                        <p className="text-muted-foreground">
                          Version:{" "}
                          {item.version === "Player Edition" ? (
                            <strong>{item.version}</strong>
                          ) : (
                            item.version ?? "—"
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
          </div>
  
          {/* CUSTOMER + TRACKING */}
          <div className="flex flex-col gap-4">
            <div className="relative bg-muted/40 p-4 rounded-lg text-sm shadow-inner space-y-2">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => handleOpenEditModal(order)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
  
              <h3 className="font-semibold mb-1">Customer Details</h3>
  
              <p>{order.customer.name}</p>
              <p className="text-muted-foreground whitespace-pre-line">{order.customer.address}</p>
              <p className="text-muted-foreground">{order.customer.phone}</p>
  
              {order.note && (
                <>
                  <Separator className="my-2" />
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <StickyNote className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
                    <p className="text-sm italic whitespace-pre-line">{order.note}</p>
                  </div>
                </>
              )}
  
              {/* TRACKING SECTION */}
              {isShipped ? (
                <div className="flex items-center justify-between mt-3">
                  <p className="font-semibold">
                    Tracking:{" "}
                    <span className="font-normal text-primary">{order.trackingNumber}</span>
                  </p>
  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleResetTrackingNumber(order)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Separator className="my-2" />
  
                  <div className="flex flex-col gap-2">
                    <Input
                      type="text"
                      placeholder="Tracking Number"
                      value={trackingNumbers[order.id] || ""}
                      onChange={(e) => handleTrackingNumberChange(order.id, e.target.value)}
                    />
  
                    <Button onClick={() => handleSubmitTrackingNumber(order)} disabled={isPending}>
                      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const clearDateFilter = () => {
    setStartDate({ day: '', month: '' });
    setEndDate({ day: '', month: '' });
    setIsDateFilterOpen(false);
  };

  const isFilterActive = startDate.day && startDate.month && endDate.day && endDate.month;

  return (
    <>
      {isExporting && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-white" />
          <p className="text-white text-lg font-semibold">A gerar o PDF…</p>
        </div>
      )}  

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
         <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Order {editingOrder?.id}</DialogTitle>
            <DialogDescription>Update customer details, tracking, and notes.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateOrder)} className="space-y-4 pt-4">
              <FormField control={form.control} name="customerName" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="customerAddress" render={({ field }) => <FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="customerPhone" render={({ field }) => <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="trackingNumber" render={({ field }) => <FormItem><FormLabel>Tracking</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="note" render={({ field }) => <FormItem><FormLabel>Note</FormLabel><FormControl><Textarea {...field} placeholder="Add a manual note for this order..." /></FormControl><FormMessage /></FormItem>} />
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="p-0 max-w-lg">
          <div className="border-b p-3 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-none shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {searchQuery.trim().length === 0 ? (
              <p className="text-center text-muted-foreground p-4 text-sm">
                Type to search for an order…
              </p>
            ) : (
              <div className="flex flex-col">
                {orders
                  .filter((o) => {
                    const q = searchQuery.toLowerCase();
                    return (
                      o.id.toLowerCase().includes(q) ||
                      o.customer.name.toLowerCase().includes(q)
                    );
                  })
                  .slice(0, 12)
                  .map((order) => (
                    <button
                      key={order.id}
                      className="text-left p-3 hover:bg-muted transition flex justify-between"
                      onClick={() => {
                        // Close modal
                        setIsSearchOpen(false);
                        // Scroll to order card
                        setTimeout(() => {
                          const el = document.getElementById(`order-${order.id}`);
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }, 150);
                      }}
                    >
                      <div>
                        <p className="font-semibold">{order.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.customer.name}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{order.status}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-8" id="dashboard-content">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Pedidos Shopify</h1>
          <p className="text-muted-foreground">Faça a gestão e acompanhe os seus pedidos Shopify aqui.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant={activeFilter === 'ALL' ? 'default' : 'outline'} onClick={() => setActiveFilter('ALL')} className="flex items-center">
            ALL
            {activeFilter !== 'ALL' && pendingCounts.ALL > 0 && <span className="ml-1.5 rounded-lg bg-muted-foreground/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums">{pendingCounts.ALL}</span>}
          </Button>
          <Button variant={activeFilter === 'PT' ? 'default' : 'outline'} onClick={() => setActiveFilter('PT')} className="flex items-center">
            <FlagPT />
            <span className="ml-2">Portugal</span>
            {activeFilter !== 'PT' && pendingCounts.PT > 0 && <span className="ml-1.5 rounded-lg bg-muted-foreground/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums">{pendingCounts.PT}</span>}
          </Button>
          <Button variant={activeFilter === 'DE' ? 'default' : 'outline'} onClick={() => setActiveFilter('DE')} className="flex items-center">
            <FlagDE />
            <span className="ml-2">Germany</span>
            {activeFilter !== 'DE' && pendingCounts.DE > 0 && <span className="ml-1.5 rounded-lg bg-muted-foreground/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums">{pendingCounts.DE}</span>}
          </Button>
          <Button variant={activeFilter === 'ES' ? 'default' : 'outline'} onClick={() => setActiveFilter('ES')} className="flex items-center">
            <FlagES />
            <span className="ml-2">Spain</span>
            {activeFilter !== 'ES' && pendingCounts.ES > 0 && <span className="ml-1.5 rounded-lg bg-muted-foreground/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums">{pendingCounts.ES}</span>}
          </Button>

          {/* Date Filter */}
          <Popover open={isDateFilterOpen} onOpenChange={setIsDateFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant={isFilterActive ? "default" : "outline"} className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {isFilterActive ? (
                  <span>{startDate.day} {startDate.month.slice(0,3)} - {endDate.day} {endDate.month.slice(0,3)}</span>
                ) : (
                  <span>Date Filter</span>
                )}
                {isFilterActive && <span className="ml-auto" onClick={(e) => { e.stopPropagation(); clearDateFilter(); }}><X className="h-3 w-3" /></span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="start">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Start Date</h4>
                  <div className="flex gap-2">
                    <Select value={startDate.day} onValueChange={(v) => setStartDate(p => ({...p, day: v}))}>
                      <SelectTrigger className="w-[70px]">
                        <SelectValue placeholder="Day" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={startDate.month} onValueChange={(v) => setStartDate(p => ({...p, month: v}))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">End Date</h4>
                  <div className="flex gap-2">
                    <Select value={endDate.day} onValueChange={(v) => setEndDate(p => ({...p, day: v}))}>
                      <SelectTrigger className="w-[70px]">
                        <SelectValue placeholder="Day" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={endDate.month} onValueChange={(v) => setEndDate(p => ({...p, month: v}))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="ml-auto flex items-center gap-2">
  
            {/* 🔍 Search Button */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* ▼ Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Download className="h-4 w-4" />
                  <span className="sr-only">Export Orders</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleExportPackingSheetPDF("pending")}>
                  Pending Orders (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPackingSheetPDF("shipped")}>
                  Shipped Orders (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPackingSheetPDF("all")}>
                  All Orders (PDF)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </div>
      
        {!pageLoading && orders.length === 0 && (
            <Card className="flex flex-col items-center justify-center p-8 gap-4 text-center">
                <Database className="w-12 h-12 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                    <h3 className="font-headline text-lg font-semibold">O seu banco de dados está vazio</h3>
                    <p className="text-sm text-muted-foreground">Não há pedidos para exibir.</p>
                </div>
            </Card>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-4 mt-6">
          <Button 
            variant={orderTab === "pending" ? "default" : "outline"}
            onClick={() => { setOrderTab("pending"); setPage(1); }}
          >
            Pending Orders ({pendingOrders.length})
          </Button>

          <Button 
            variant={orderTab === "shipped" ? "default" : "outline"}
            onClick={() => { setOrderTab("shipped"); setPage(1); }}
          >
            Shipped Orders ({shippedOrders.length})
          </Button>
        </div>

        {/* Selected Tab Content */}
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">
            {orderTab === "pending" ? "Pending Production" : "Shipped Orders"}
          </h2>

          {paginatedOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm">No orders found.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {paginatedOrders.map(order =>
                renderOrderCard(order, orderTab === "shipped")
              )}
            </div>
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <Button 
                variant="outline" 
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>

              <span className="text-sm text-muted-foreground">
                Page {page} / {totalPages}
              </span>

              <Button 
                variant="outline" 
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
