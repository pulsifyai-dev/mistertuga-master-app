'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
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
import { Search, ChevronUp, Eye, EyeOff } from "lucide-react";

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
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

// ajusta para 200 conforme te parecer melhor
const MAX_ORDERS_PER_PDF = 200; 

const PDF_LOADING_MESSAGES = [
  "Making your PDF look pretty...",
  "Printing pixels on invisible paper...",
  "Collecting all your orders in one place...",
  "Polishing thumbnails, hang on...",
  "Lining up rows and columns...",
  "Double-checking names and numbers...",
  "Almost there, don’t go anywhere...",
  "Last touch, your PDF is coming...",
];

// Helper to pad numbers
const pad = (n: number) => n.toString().padStart(2, '0');

// --- Main Page Component ---
export default function MasterShopifyOrdersPage() {
  const { firestore, user, isUserLoading } = useFirebase();
    
    // Tabs
  const [orderTab, setOrderTab] = useState<"pending" | "shipped">("pending");
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Overlay State
  const [isExporting, setIsExporting] = useState(false);
  const [exportChunksInfo, setExportChunksInfo] = useState<{
    totalChunks: number;
    totalOrders: number;
  } | null>(null);
  const [showSplitNotice, setShowSplitNotice] = useState(false);

  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [typedLoadingText, setTypedLoadingText] = useState("");

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
  const [startDate, setStartDate] = useState<{ day: string; month: string; year: string }>({
    day: '',
    month: '',
    year: '',
  });
  const [endDate, setEndDate] = useState<{ day: string; month: string; year: string }>({
    day: '',
    month: '',
    year: '',
  });
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

  const { toast } = useToast();
  const form = useForm<EditOrderSchema>({ resolver: zodResolver(editOrderSchema) });

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
  
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
        
          finalDate = `${yyyy}-${mm}-${dd} | ${hh}:${min} PT`;
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
        
            finalDate = `${yyyy}-${mm}-${dd}${time ? ` | ${time} PT` : ""}`;
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

  useEffect(() => {
    if (!isExporting) {
      // reset quando termina a exportação
      setTypedLoadingText("");
      setLoadingMessageIndex(0);
      return;
    }
    // ⬅️ não escrever mensagens enquanto o aviso de split está ativo
    if (showSplitNotice) return;

    const fullText = PDF_LOADING_MESSAGES[loadingMessageIndex] ?? "";
    const typeSpeed = 40;   // ms entre caracteres
    const holdMs = 2000;    // ms com a frase COMPLETA parada
  
    let charIndex = 0;
    let cancelled = false;
  
    // começar nova mensagem
    setTypedLoadingText("");
  
    const typeNextChar = () => {
      if (cancelled) return;
  
      if (charIndex < fullText.length) {
        charIndex += 1;
        setTypedLoadingText(fullText.slice(0, charIndex));
        window.setTimeout(typeNextChar, typeSpeed);
      } else {
        // terminou de escrever → manter a frase parada durante holdMs
        window.setTimeout(() => {
          if (cancelled) return;
          setLoadingMessageIndex((prev) =>
            (prev + 1) % PDF_LOADING_MESSAGES.length
          );
        }, holdMs);
      }
    };
  
    typeNextChar();
  
    return () => {
      // marca como cancelado para não correr timeouts após unmount / mudança
      cancelled = true;
    };
  }, [isExporting, loadingMessageIndex]);

  useEffect(() => {
    if (!isExporting) {
      setShowSplitNotice(false);
      return;
    }
  
    // só mostramos o aviso se houver split
    if (!exportChunksInfo || exportChunksInfo.totalChunks <= 1) {
      setShowSplitNotice(false);
      return;
    }
  
    // mostrar aviso em grande durante 1 segundo
    setShowSplitNotice(true);
    const t = window.setTimeout(() => {
      setShowSplitNotice(false);
    }, 3000); // 3s
  
    return () => {
      window.clearTimeout(t);
    };
  }, [isExporting, exportChunksInfo?.totalChunks]);

  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

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
    if (
      !startDate.day || !startDate.month || !startDate.year ||
      !endDate.day || !endDate.month || !endDate.year
    ) {
      return ordersToFilter;
    }
  
    const startMonthIndex = MONTHS.indexOf(startDate.month) + 1;
    const endMonthIndex = MONTHS.indexOf(endDate.month) + 1;
  
    if (startMonthIndex <= 0 || endMonthIndex <= 0) {
      return ordersToFilter;
    }
  
    const startYearStr = startDate.year;
    const endYearStr = endDate.year;
  
    const startKey = `${startYearStr}-${pad(startMonthIndex)}-${pad(parseInt(startDate.day, 10))}`;
    const endKey = `${endYearStr}-${pad(endMonthIndex)}-${pad(parseInt(endDate.day, 10))}`;
  
    const normalizeOrderDate = (dateStr: string) => {
      // "2025-12-04 | 12:30" → "2025-12-04"
      const [datePart] = dateStr.split('|');
      const safe = datePart.trim();
      const parts = safe.split('-');
      if (parts.length !== 3) return null;
      const [y, m, d] = parts;
      return `${y}-${m}-${pad(parseInt(d, 10))}`;
    };
  
    return ordersToFilter.filter((o) => {
      const orderKey = normalizeOrderDate(o.date);
      if (!orderKey) return false;
  
      // INCLUSIVO: inclui o próprio dia de início e fim
      return orderKey >= startKey && orderKey <= endKey;
    });
  };

  const filteredOrders = filterOrdersByDate(activeFilter === 'ALL' ? orders : orders.filter(o => o.countryCode === activeFilter));

  const handleExportPackingSheetPDF = async () => {
    setIsExporting(true);
  
    // Cache apenas para este export (partilhada entre todos os PDFs)
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
  
    try {
      // usa sempre os filtros já aplicados (country + date) + tab atual
      const ordersToExport =
        orderTab === "pending" ? pendingOrders : shippedOrders;
  
      if (ordersToExport.length === 0) {
        toast({
          title: "No Orders",
          description: "There are no orders to export with the current filters.",
        });
        return;
      }
  
      const total = ordersToExport.length;

      // dividir em batches
      const chunks: Order[][] = [];
      for (let i = 0; i < total; i += MAX_ORDERS_PER_PDF) {
        chunks.push(ordersToExport.slice(i, i + MAX_ORDERS_PER_PDF));
      }
      
      // guardar info para o overlay
      setExportChunksInfo({
        totalChunks: chunks.length,
        totalOrders: total,
      });

      const todayStr = new Date().toISOString().split("T")[0];
      const baseName =
        orderTab === "pending" ? "pending_orders" : "shipped_orders";
  
      // gerar um PDF por batch
      for (let batchIndex = 0; batchIndex < chunks.length; batchIndex++) {
        const batchOrders = chunks[batchIndex];
        const partNumber = batchIndex + 1;
        const totalParts = chunks.length;
  
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
  
        // X inicial de cada coluna
        const colXPositions: number[] = [];
        {
          let runningX = marginX;
          for (const col of columns) {
            colXPositions.push(runningX);
            runningX += col.width;
          }
        }
  
        let firstPage = true;
  
        for (const order of batchOrders) {
          if (!firstPage) {
            pdf.addPage();
          }
          firstPage = false;
  
          let cursorY = marginY;
  
          // ---------- HEADER DA ENCOMENDA ----------
          pdf.setFontSize(14);
          pdf.setFont("helvetica", "bold");
          pdf.text(
            toText(`Order ${order.id} - ${order.date}`),
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
          cursorY += 8;
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "bold");
          pdf.text("Items", marginX, cursorY);
  
          cursorY += 6;
  
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
  
            const productX = colXPositions[1];
            const sizeX = colXPositions[2];
            const qtyX = colXPositions[3];
            const versionX = colXPositions[4];
            const customX = colXPositions[5];
  
            // Product
            pdf.setFont("helvetica", "normal");
            pdf.text(productName, productX + 2, baseY, {
              maxWidth: columns[1].width - 4,
            });
  
            // Size centrado
            const sizeCenterX = sizeX + columns[2].width / 2;
            pdf.text(sizeText, sizeCenterX, baseY, { align: "center" });
  
            // Qty centrado
            const qtyCenterX = qtyX + columns[3].width / 2;
            pdf.text(qtyText, qtyCenterX, baseY, { align: "center" });
  
            // Version (Player Edition bold)
            if (versionText === "Player Edition") {
              pdf.setFont("helvetica", "bold");
            } else {
              pdf.setFont("helvetica", "normal");
            }
            pdf.text(versionText, versionX + 2, baseY, {
              maxWidth: columns[4].width - 4,
            });
  
            // Customization
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
  
        const suffix = totalParts > 1 ? `_part-${partNumber}-of-${totalParts}` : "";
        pdf.save(`${baseName}_${todayStr}${suffix}.pdf`);
      }
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar o PDF",
        description: "Tenta novamente em alguns segundos.",
      });
    } finally {
      setIsExporting(false);
      setExportChunksInfo(null);
      setShowSplitNotice(false);    
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
    
    const isExpanded = !!expandedOrders[order.id];

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
  
          <div className="flex items-center gap-1 text-[12px] text-muted-foreground md:justify-end">
            {order.date}
          </div>
        </CardHeader>
  
        {/* Body */}
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3.5">
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
                        <p className="text-muted-foreground">Size: {item.size ?? "—"}  /  Qty: {item.quantity ?? 0}</p>
                        {/* <p className="text-muted-foreground">Qty: {item.quantity ?? 0}</p> */}
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
  
          {/* CUSTOMER + TRACKING (com colapso) */}
          <div className="flex flex-col gap-4">
            <div className="relative bg-black/30 border border-white/10 p-4 rounded-lg text-xs space-y-3">
              {/* Top row: título + botão olho */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Tracking</h3>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-white/10"
                  type="button"
                  onClick={() => toggleOrderDetails(order.id)}
                >
                  {isExpanded ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>

              {/* Campo de tracking – SEMPRE visível */}
              {isShipped ? (
                <div className="flex items-center justify-between pt-1 border-t border-white/10">
                  <p className="font-semibold">
                    Tracking:{" "}
                    <span className="font-normal text-primary">
                      {order.trackingNumber}
                    </span>
                  </p>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    type="button"
                    onClick={() => handleResetTrackingNumber(order)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Input
                    type="text"
                    placeholder="Tracking Number"
                    value={trackingNumbers[order.id] || ""}
                    onChange={(e) =>
                      handleTrackingNumberChange(order.id, e.target.value)
                    }
                    className="h-8 text-xs bg-black/30 border-white/10"
                  />

                  <Button
                    onClick={() => handleSubmitTrackingNumber(order)}
                    disabled={isPending}
                    className="h-8 text-xs"
                    type="button"
                  >
                    {isPending && (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    )}
                    Submit
                  </Button>
                </div>
              )}

              {/* NOTA – SEMPRE visível, se existir */}
              {order.note && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-500/20 border border-amber-500/20 p-2">
                  <StickyNote className="h-3.5 w-3.5 mt-0.5 text-amber-400" />
                  <p className="text-[11px] italic whitespace-pre-line">
                    {order.note}
                  </p>
                </div>
              )}

              {/* PAINEL COLAPSADO – Customer Details + Note + Edit */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">Customer Details</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-purple-500/20"
                      type="button"
                      onClick={() => handleOpenEditModal(order)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>

                  <p className="font-medium">{order.customer.name}</p>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {order.customer.address}
                  </p>
                  <p className="text-muted-foreground">{order.customer.phone}</p>

                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const clearDateFilter = () => {
    setStartDate({ day: '', month: '', year: '' });
    setEndDate({ day: '', month: '', year: '' });
    setIsDateFilterOpen(false);
  };
  
  const isFilterActive =
    !!startDate.day && !!startDate.month && !!startDate.year &&
    !!endDate.day && !!endDate.month && !!endDate.year;
    
  const searchMatches =
  searchQuery.trim().length === 0
    ? []
    : filteredOrders
        .filter((o) => {
          const q = searchQuery.toLowerCase();
          return (
            o.id.toLowerCase().includes(q) ||
            o.customer.name.toLowerCase().includes(q)
          );
        })
        .slice(0, 10);

  return (
    <>
      {isExporting && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4 px-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-white" />

          {showSplitNotice && exportChunksInfo && exportChunksInfo.totalChunks > 1 ? (
            <>
              {/* AVISO GRANDE – ÚNICA MENSAGEM PRINCIPAL DURANTE 1s */}
              <p className="text-white text-xl font-bold">
                This export will generate {exportChunksInfo.totalChunks} PDF files.
              </p>
              <p className="text-white/80 text-sm">
                Up to {MAX_ORDERS_PER_PDF} orders per file.
              </p>
            </>
          ) : (
            <>
              {/* MODO NORMAL: TYPEWRITER + INFO EXTRA */}
              <p className="text-white text-lg font-semibold flex items-center justify-center">
                {typedLoadingText || PDF_LOADING_MESSAGES[loadingMessageIndex]}
                <span className="ml-1 inline-block w-[8px] h-[18px] bg-white/80 animate-pulse rounded-[1px]" />
              </p>

              <p className="text-white/70 text-xs">
                This might take a few seconds, don&apos;t refresh.
              </p>
            </>
          )}
        </div>
      )}

      <Dialog open={isEditModalOpen}   onOpenChange={setIsEditModalOpen}>
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

      <div className="flex flex-col gap-4" id="dashboard-content">        
        {/* HEADER */}
        <div className="pt-2">
          <h1 className="font-headline text-3xl md:text-4xl font-bold tracking-tight">
            Shopify Orders
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm mt-1.5">
            Manage ALL your Shopify orders in one place.
          </p>
        </div>

        {/* FILTER BAR – torna-se a “barra premium” */}
        <div className="sticky top-12 z-20 flex flex-col gap-3 rounded-2xl bg-black/40 border border-white/5 px-3 py-3 backdrop-blur-md md:flex-row md:items-center">
          {/* Países */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={activeFilter === 'ALL' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('ALL')}
              className="h-8 rounded-full text-xs px-3 border-white/10"
            >
              ALL
              {pendingCounts.ALL > 0 && (
                <span className="ml-1.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                  {pendingCounts.ALL}
                </span>
              )}
            </Button>

            <Button
              variant={activeFilter === 'PT' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('PT')}
              className="h-8 rounded-full text-xs px-3 border-white/10 flex items-center gap-1.5"
            >
              <FlagPT />
              <span>Portugal</span>
              {pendingCounts.PT > 0 && activeFilter !== 'PT' && (
                <span className="ml-1.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                  {pendingCounts.PT}
                </span>
              )}
            </Button>

            <Button
              variant={activeFilter === 'DE' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('DE')}
              className="h-8 rounded-full text-xs px-3 border-white/10 flex items-center gap-1.5"
            >
              <FlagDE />
              <span>Germany</span>
              {pendingCounts.DE > 0 && activeFilter !== 'DE' && (
                <span className="ml-1.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                  {pendingCounts.DE}
                </span>
              )}
            </Button>

            <Button
              variant={activeFilter === 'ES' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('ES')}
              className="h-8 rounded-full text-xs px-3 border-white/10 flex items-center gap-1.5"
            >
              <FlagES />
              <span>Spain</span>
              {pendingCounts.ES > 0 && activeFilter !== 'ES' && (
                <span className="ml-1.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                  {pendingCounts.ES}
                </span>
              )}
            </Button>
          </div>

          {/* Search + Export alinhados à direita */}
          <div className="ml-auto flex flex-col gap-2 md:flex-row md:items-center">
            <div className="flex items-center gap-2 md:justify-end">
              {/* WRAPPER RELATIVO DA PESQUISA */}
              <div
                className={
                  "relative transition-all duration-200 " +
                  (isSearchExpanded ? "w-60" : "w-8")
                }
              >
                {/* Barra de pesquisa que expande para a esquerda */}
                <div
                    className={`
                      flex items-center overflow-hidden rounded-full px-2 py-1 transition-all duration-200
                      ${isSearchExpanded ? "bg-black/40 border border-white/15 justify-start" : "bg-transparent border-transparent justify-end"}
                    `}
                  >

                  {isSearchExpanded && (
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search orders…"
                      className="flex-1 bg-transparent border-0 outline-none text-xs text-white placeholder:text-muted-foreground pr-1"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (isSearchExpanded) {
                        // se já estiver aberto e clicas de novo: limpamos o texto
                        setSearchQuery("");
                      }
                      setIsSearchExpanded((prev) => !prev);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-purple-500/20"
                  >
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="sr-only">Search orders</span>
                  </button>
                </div>

                {/* DROPDOWN ALINHADO E COM MESMA LARGURA */}
                {isSearchExpanded && searchQuery.trim().length > 0 && (
                  <div className="absolute left-0 top-full mt-1 w-full rounded-xl bg-black/95 border border-white/10 shadow-lg max-h-64 overflow-y-auto z-30">
                    {searchMatches.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2 text-center">
                        No orders found.
                      </p>
                    ) : (
                      <div className="flex flex-col">
                        {searchMatches.map((order) => (
                          <button
                            key={order.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center justify-between gap-2"
                            onClick={() => {
                              const el = document.getElementById(`order-${order.id}`);
                              if (el) {
                                el.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                              }
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold text-[11px]">
                                {order.id}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {order.customer.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {order.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Export PDF */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleExportPackingSheetPDF}
                disabled={isExporting}
                className="hover:bg-purple-500/50"
              >
                <Download className="h-4 w-4" />
                <span className="sr-only">Export Orders</span>
              </Button>
            </div>

            {/* Date Filter fica logo abaixo em mobile / ao lado em desktop */}
            <Popover open={isDateFilterOpen} onOpenChange={setIsDateFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={isFilterActive ? "default" : "outline"}
                  className="h-8 rounded-full border-white/10 text-xs flex items-center gap-2"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {isFilterActive ? (
                    <span>
                      {startDate.day} {startDate.month.slice(0, 3)} {startDate.year} –{" "}
                      {endDate.day} {endDate.month.slice(0, 3)} {endDate.year}
                    </span>
                  ) : (
                    <span>Date Filter</span>
                  )}
                  {isFilterActive && (
                    <span
                      className="ml-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearDateFilter();
                      }}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-80 p-4" align="start">
                <div className="grid gap-4">
                  {/* Start Date */}
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Start Date</h4>
                    <div className="flex gap-2">
                      <Select
                        value={startDate.day}
                        onValueChange={(v) => setStartDate((p) => ({ ...p, day: v }))}
                      >
                        <SelectTrigger className="w-[70px]">
                          <SelectValue placeholder="Day" />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS.map((d) => (
                            <SelectItem key={d} value={d.toString()}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={startDate.month}
                        onValueChange={(v) => setStartDate((p) => ({ ...p, month: v }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={startDate.year}
                        onValueChange={(v) => setStartDate((p) => ({ ...p, year: v }))}
                      >
                        <SelectTrigger className="w-[80px]">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {YEARS.map((y) => (
                            <SelectItem key={y} value={y.toString()}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* End Date */}
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">End Date</h4>
                    <div className="flex gap-2">
                      <Select
                        value={endDate.day}
                        onValueChange={(v) => setEndDate((p) => ({ ...p, day: v }))}
                      >
                        <SelectTrigger className="w-[70px]">
                          <SelectValue placeholder="Day" />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS.map((d) => (
                            <SelectItem key={d} value={d.toString()}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={endDate.month}
                        onValueChange={(v) => setEndDate((p) => ({ ...p, month: v }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={endDate.year}
                        onValueChange={(v) => setEndDate((p) => ({ ...p, year: v }))}
                      >
                        <SelectTrigger className="w-[80px]">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {YEARS.map((y) => (
                            <SelectItem key={y} value={y.toString()}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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

        {/* Tabs como segmented control */}
        <div className="mt-2 flex items-center gap-2 md:mt-0 md:ml-auto">
        <div className="inline-flex items-center rounded-full bg-black/40 p-1 border border-white/5">
            <Button
              variant={orderTab === "pending" ? "default" : "ghost"}
              size="sm"
              className={`h-8 rounded-full px-4 text-xs transition-none ${
                orderTab === "pending"
                  ? "bg-white text-black shadow-sm"
                  : "text-muted-foreground hover:bg-white/5"
              }`}
              onClick={() => {
                setOrderTab("pending");
                setPage(1);
              }}
            >
              Pending Orders ({pendingOrders.length})
            </Button>

            <Button
              variant={orderTab === "shipped" ? "default" : "ghost"}
              size="sm"
              className={`h-8 rounded-full px-4 text-xs transition-none ${
                orderTab === "shipped"
                  ? "bg-white text-black shadow-sm"
                  : "text-muted-foreground hover:bg-white/5"
              }`}
              onClick={() => {
                setOrderTab("shipped");
                setPage(1);
              }}
            >
              Shipped Orders ({shippedOrders.length})
            </Button>
          </div>
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
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-16 right-6 z-[9999] rounded-full bg-white/10 
                    border border-white/30 backdrop-blur-md text-white 
                    shadow-lg p-3 hover:bg-white/20 transition"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
    </>
  );
}
