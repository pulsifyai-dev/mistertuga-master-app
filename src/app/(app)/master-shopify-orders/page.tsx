'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Search, ChevronUp, Eye, EyeOff, Globe } from "lucide-react";

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
const YEARS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 3 + i); 

// Define o limite máximo de pedidos por PDF, consistente com a mensagem de aviso.
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
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

  // Date Filter State
  const [startDate, setStartDate] = useState({ day: '', month: '', year: '' });
  const [endDate, setEndDate] = useState({ day: '', month: '', year: '' });

  // Funções de Reset do Filtro de Data
  const handleResetDateFilter = () => {
    setStartDate({ day: "", month: "", year: "" });
    setEndDate({ day: "", month: "", year: "" });
    setIsDateFilterOpen(false); 
  };


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
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);

  const { toast } = useToast();
  const form = useForm<EditOrderSchema>({ resolver: zodResolver(editOrderSchema) });

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  
  const formatSizeForPdf = (size: unknown): string | string[] => {
    if (!size) return "—";
    const s = String(size).trim();
    // Se contiver "years" (qualquer variação), força quebra de linha
    if (/years/i.test(s)) {
      return s
        .replace(/years/i, "\nyears")
        .split("\n");
    }
    return s;
  };

  // ESTADO NOVO: Guarda o ID do pedido selecionado pela pesquisa
  const [selectedOrderIdForSearch, setSelectedOrderIdForSearch] = useState<string | null>(null);

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
          // Caso Firestore Timestamp
          const d = data.date.toDate();
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const hh = String(d.getHours()).padStart(2, "0");
          const min = String(d.getMinutes()).padStart(2, "0");
        
          finalDate = `${yyyy}-${mm}-${dd} | ${hh}:${min} PT`;
        } else {
          // Caso seja string que vem do Shopify ("3 de dezembro de 2025 às 23:36:17 UTC")
          const raw = String(data.date);
        
          const timeMatch = raw.match(/\d{1,2}:\d{2}/);
          const time = timeMatch ? timeMatch[0] : "";
        
          const parsed = new Date(raw);
        
          if (!isNaN(parsed.getTime())) {
            const yyyy = parsed.getFullYear();
            const mm = String(parsed.getMonth() + 1).padStart(2, "0");
            const dd = String(parsed.getDate()).padStart(2, "0");
        
            finalDate = `${yyyy}-${mm}-${dd}${time ? ` | ${time} PT` : ""}`;
          } else {
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
    // não escrever mensagens enquanto o aviso de split está ativo
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
  
    // mostrar aviso em grande durante 3 segundos
    setShowSplitNotice(true);
    const t = window.setTimeout(() => {
      setShowSplitNotice(false);
    }, 3000); 
  
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

  const handleUpdateOrder = async (data: EditOrderSchema) => {
    if (!editingOrder) return;
  
    try {
      const result = await updateOrderDetails({
        orderId: editingOrder.id,
        countryCode: editingOrder.countryCode,
        ...data,
      });
  
      if (result.success) {
        toast({
          title: 'Order Updated',
          description: 'The details have been saved successfully.',
        });
        setIsEditModalOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: 'Could not save the details.',
        });
        console.error('Failed to update order:', result.error);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Unexpected Error',
        description: 'Something went wrong while updating the order.',
      });
      console.error('Unexpected error updating order:', error);
    }
  };
  

  const handleSubmitTrackingNumber = async (order: Order) => {
    if (!user || !firestore) return;
  
    const trackingNumber = trackingNumbers[order.id];
    if (!trackingNumber) {
      toast({
        variant: "destructive",
        title: "Missing Tracking Number",
      });
      return;
    }
  
    setSubmittingOrderId(order.id);
  
    try {
      const result = await updateOrderDetails({
        orderId: order.id,
        countryCode: order.countryCode,
        customerName: order.customer.name,
        customerAddress: order.customer.address,
        customerPhone: order.customer.phone,
        note: order.note,
        trackingNumber,
      });
  
      if (result.success) {
        toast({ title: "Tracking Submitted" });
        setTrackingNumbers((prev) => ({
          ...prev,
          [order.id]: "",
        }));
      } else {
        toast({
          variant: "destructive",
          title: "Update Failed",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Unexpected error",
      });
    } finally {
      setSubmittingOrderId(null);
    }
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
  
    // Mapeamento de mês por string para o índice numérico + 1
    const startMonthIndex = MONTHS.indexOf(startDate.month) + 1;
    const endMonthIndex = MONTHS.indexOf(endDate.month) + 1;
  
    if (startMonthIndex <= 0 || endMonthIndex <= 0) {
      return ordersToFilter;
    }
  
    const startYearStr = startDate.year;
    const endYearStr = endDate.year;
  
    // Formato YYYY-MM-DD para comparação de string
    const startKey = `${startYearStr}-${pad(startMonthIndex)}-${pad(parseInt(startDate.day, 10))}`;
    const endKey = `${endYearStr}-${pad(endMonthIndex)}-${pad(parseInt(endDate.day, 10))}`;
  
    const normalizeOrderDate = (dateStr: string) => {
      // "2025-12-04 | 12:30" → "2025-12-04"
      const [datePart] = dateStr.split('|');
      const safe = datePart.trim();
      const parts = safe.split('-');
      if (parts.length !== 3) return null;
      const [y, m, d] = parts;
      // Garante que o formato é YYYY-MM-DD
      return `${y}-${pad(parseInt(m, 10))}-${pad(parseInt(d, 10))}`;
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
        const chunks: Order[][] = [];
        for (let i = 0; i < total; i += MAX_ORDERS_PER_PDF) {
            chunks.push(ordersToExport.slice(i, i + MAX_ORDERS_PER_PDF));
        }
      
        setExportChunksInfo({
            totalChunks: chunks.length,
            totalOrders: total,
        });
  
        const todayStr = new Date().toISOString().split("T")[0];
        const baseName =
            orderTab === "pending" ? "pending_orders" : "shipped_orders";
  
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
                { key: "custom", label: "Customization", width: pageWidth - marginX * 2 - (26 + 68 + 12 + 12 + 25) },
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
                pdf.setFont("helvetica", "bold");
                const orderHeader = `Order ${order.id.replace(/^#/, "")} - ${order.customer.name} - ${order.date.split(' | ')[0]} (${order.countryCode})`;
                pdf.text(orderHeader, marginX, cursorY);
                cursorY += 7; 
  
                // Address and Tracking
                pdf.setFontSize(8);
                pdf.setFont("helvetica", "normal");

                // 🔒 garantir texto visível
                pdf.setTextColor(0, 0, 0);

// Address (multi-line)
const addressText = toText(order.customer.address);
const addressLines = pdf.splitTextToSize(addressText, 70);

const addressLineSpacing = 4;
const minAddressHeight = addressLines.length * addressLineSpacing + 6;

// 🔒 FIX 2 — garantir que a morada cabe na página
if (cursorY + minAddressHeight > pageHeight - marginY) {
  pdf.addPage();
  cursorY = marginY;

  // IMPORTANTÍSSIMO: resetar estado visual
  pdf.setDrawColor(0, 0, 0);
  pdf.setTextColor(0, 0, 0);
  pdf.setLineWidth(0.3);
}

// agora SIM, desenhar a morada
let currentAddressY = cursorY;

addressLines.forEach((line: string) => {
  pdf.text(line, marginX, currentAddressY);
  currentAddressY += addressLineSpacing;
});

// avançar cursor após a morada
cursorY = currentAddressY + 1;


                // Phone (à direita do bloco)
                pdf.text(
                  `Phone: ${toText(order.customer.phone)}`,
                  marginX + 80,
                  cursorY - addressLineSpacing
                );

                // Draw the Tracking number
                const cleanTrackingPDF = order.trackingNumber ? order.trackingNumber.replace(/^TN_/, "") : "";
                pdf.text(`Tracking: ${toText(cleanTrackingPDF)}`, marginX, cursorY);
                cursorY += 6; 

                // Table Header
                pdf.setDrawColor(0, 0, 0);
                pdf.setLineWidth(0.3);

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
                pdf.setFontSize(8);
  
                for (const item of order.items) {

                  const lineSpacing = 3.5;

                  // product name
                  const productNameLines = pdf.splitTextToSize(
                    toText(item.name),
                    columns[1].width - 4
                  );
                  
                  // customization (DECLARADO UMA ÚNICA VEZ)
                  const custLines = pdf.splitTextToSize(
                    toText(item.customization),
                    columns[5].width - 4
                  );
                  
                  // altura real necessária
                  const textBlockHeight = Math.max(
                    productNameLines.length * lineSpacing + 8, // nome + ID
                    custLines.length * lineSpacing + 4,
                    thumbSize + 8
                  );
                  
                  const dynamicRowHeight = Math.max(26, textBlockHeight);
                  
                  // Check if item row fits
                  if (cursorY + dynamicRowHeight > pageHeight - marginY) {
                      pdf.addPage();
                      cursorY = marginY;
                      pdf.setDrawColor(0, 0, 0);
                      pdf.setTextColor(0, 0, 0);
                      pdf.setLineWidth(0.3);

                      // New page header for continuation
                      pdf.setFontSize(12);
                      pdf.setFont("helvetica", "bold");
                      pdf.text(
                          `Order ${order.id.replace(/^#/, "")} — (cont.)`,
                          marginX,
                          cursorY
                      );
                      cursorY += 8;
                      
                      // Repeat table header on continuation page
                      pdf.setFontSize(10);
                      pdf.setFont("helvetica", "bold");
                      let contHeaderX = marginX;
                      columns.forEach((col) => {
                          pdf.rect(contHeaderX, cursorY, col.width, 8);
                          pdf.text(col.label, contHeaderX + 2, cursorY + 5);
                          contHeaderX += col.width;
                      });
                      cursorY += 8;
                      pdf.setFont("helvetica", "normal");
                      pdf.setFontSize(8);
                  }

                  // Drawing cells
                  pdf.setDrawColor(0, 0, 0);

                  let cellX = marginX;
                  columns.forEach((col) => {
                    pdf.rect(cellX, cursorY, col.width, dynamicRowHeight);
                      cellX += col.width;
                  });
          
                  // Thumbnail
                  const validThumb = item.thumbnailUrl && item.thumbnailUrl !== "null" && item.thumbnailUrl !== "undefined" && item.thumbnailUrl.trim() !== "" && item.thumbnailUrl.startsWith("http");
                  const thumbUrl = validThumb ? item.thumbnailUrl : "https://placehold.co/80x80/e2e8f0/64748b?text=N/A";

                  try {
                      const imgData = await loadImageAsDataURL(thumbUrl);
                      const imgY = cursorY + (dynamicRowHeight - thumbSize) / 2;
                      pdf.addImage(imgData, "JPEG", marginX + 4, imgY, thumbSize, thumbSize);
                  } catch (imgError) {
                      console.error("Error loading image:", imgError);
                      pdf.text("Image N/A", marginX + 4, cursorY + rowHeight / 2);
                  }

                  // CORREÇÃO 1: Product Name and ID (Column 2) - Altura dinâmica
                  const productName = toText(item.name);

                  let currentNameY = cursorY + 5; 
                  productNameLines.forEach((line: string) => {
                    pdf.text(line, marginX + columns[0].width + 2, currentNameY);
                    currentNameY += lineSpacing;
                  });
                  

                  // Posição do ID: Abaixo do Nome + margem segura
                  const productIdY = currentNameY + 1.5; 
                  pdf.text(`ID: ${toText(item.productId)}`, marginX + columns[0].width + 2, productIdY);
                  
                  // CORREÇÃO 2: Size e Qty - Centrado Horizontal e Vertical
                  const centerY = cursorY + dynamicRowHeight / 2 + 2;
                  // Size (Column 3)
                  const sizeCenterX = marginX + columns[0].width + columns[1].width + (columns[2].width / 2);
                  
                  const formattedSize = formatSizeForPdf(item.size);
                  pdf.text(
                    formattedSize,
                    sizeCenterX,
                    cursorY + dynamicRowHeight / 2 - 2,
                    { align: "center" }
                  );

                  // Qty (Column 4)
                  const qtyCenterX = marginX + columns[0].width + columns[1].width + columns[2].width + (columns[3].width / 2);
                  pdf.text(toText(item.quantity), qtyCenterX, centerY, { align: "center" });

                  // Version (Column 5)
                  pdf.text(
                    toText(item.version),
                    marginX + columns[0].width + columns[1].width + columns[2].width + columns[3].width + 2,
                    centerY,
                    { maxWidth: columns[4].width - 4 }
                  );
          
                  // CORREÇÃO 3: Customization (Column 6) - Centrado Verticalmente (à esquerda)
                  const textH = custLines.length * lineSpacing; 

                  // Y para texto centrado verticalmente
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
            
                    // Usar 6 e 7 para maior espaçamento de segurança no mobile
                    if (cursorY + noteLines.length * 6 + 7 > pageHeight - marginY) {
                        pdf.addPage();
                        cursorY = marginY;

                        pdf.setDrawColor(0, 0, 0);
                        pdf.setTextColor(0, 0, 0);
                        pdf.setLineWidth(0.3);
                    }
  
                    pdf.setFontSize(8);
                    pdf.setFont("helvetica", "bold");
                    pdf.rect(
                        marginX,
                        cursorY,
                        pageWidth - marginX * 2,
                        noteLines.length * 6 + 7
                    );
                    let noteY = cursorY + 4;
                    pdf.text("NOTE:", marginX + 2, noteY);
                    pdf.setFont("helvetica", "normal");
                    noteY += 5;
                    noteLines.forEach((line: string) => {
                      pdf.text(line, marginX + 3, noteY);
                      noteY += 5;
                    });
                    cursorY += noteLines.length * 6 + 7;
                }
                
                // Separator line between orders
                cursorY += 4;
                pdf.setLineWidth(0.2);
                pdf.line(marginX, cursorY, pageWidth - marginX, cursorY);
                cursorY += 4; 
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

  // ATUALIZE ESTAS LINHAS:
  const pendingOrders = filteredOrders.filter(o => 
    o.status === 'Pending Production' && (!o.trackingNumber || o.trackingNumber.trim() === "")
  );

  const shippedOrders = filteredOrders.filter(o => 
    o.status === 'Shipped' || (!!o.trackingNumber && o.trackingNumber.trim() !== "")
  );
  
  // Select list based on tab
  let listToShow = orderTab === "pending" ? pendingOrders : shippedOrders;

  // NOVO FILTRO DE PESQUISA: Se houver um ID selecionado, filtra a lista para mostrar apenas esse ID.
  if (selectedOrderIdForSearch) {
    listToShow = listToShow.filter(o => o.id === selectedOrderIdForSearch);
  }

  const totalPages = Math.ceil(listToShow.length / ITEMS_PER_PAGE);

  const paginatedOrders = listToShow.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const renderOrderCard = (order: Order, isShipped = false) => {
    
    const displayTracking = order.trackingNumber ? order.trackingNumber.replace(/^TN_/, "") : "";
    
    const isSubmittingThisOrder = submittingOrderId === order.id;

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
          borderLeft: `4px solid ${countryColor}`,
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
                  className="h-7 w-7 bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
                  type="button"
                  onClick={() => toggleOrderDetails(order.id)}
                >
                  {isExpanded ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Campo de tracking – SEMPRE visível */}
              {isShipped ? (
                <div className="flex items-center justify-between pt-1 border-t border-white/10">
                  <p className="font-semibold">
                    Tracking:{" "}
                    <span className="font-normal text-primary">
                      {displayTracking}
                    </span>
                  </p>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
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
                    value={trackingNumbers[order.id] ?? order.trackingNumber ?? ""}
                    onChange={(e) =>
                      handleTrackingNumberChange(order.id, e.target.value)
                    }
                    className="h-8 text-xs bg-black/30 border-white/10"
                  />
                  <Button
                    onClick={() => handleSubmitTrackingNumber(order)}
                    disabled={isSubmittingThisOrder}
                    className="h-8 text-xs bg-purple-600 text-white hover:bg-purple-500 active:bg-purple-700 active:scale-[0.98]"
                    type="button"
                  >
                    {isSubmittingThisOrder && (
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
                      className="h-7 w-7 bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
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
                <Button type="submit" className="bg-purple-600 text-white hover:bg-purple-500 active:bg-purple-700 active:scale-[0.98]" > Save Changes </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-4" id="dashboard-content">        
      {/* NOVO HEADER COMBINADO: Título + Busca */}
      <div className="pt-2 flex items-start justify-between">
        {/* Título e Subtítulo (à esquerda) */}
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-bold tracking-tight">
            Shopify Orders
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm mt-1.5">
            Manage ALL your Shopify orders in one place.
          </p>
        </div>
        
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
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    // Limpa o filtro de ID ao começar a digitar uma nova pesquisa
                    setSelectedOrderIdForSearch(null); 
                  }}
                  placeholder="Search orders…"
                  className="flex-1 bg-transparent border-0 outline-none text-xs text-white placeholder:text-muted-foreground pr-1"
                />
              )}

              <button
                type="button"
                onClick={() => {
                  if (isSearchExpanded) {
                    setSearchQuery("");
                    setSelectedOrderIdForSearch(null); // Limpa o filtro de ID se fechar a busca com o botão X
                  }
                  setIsSearchExpanded((prev) => !prev);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
              >
                <Search className="h-4 w-4" />
                <span className="sr-only">Search orders</span>
              </button>
            </div>

            {/* DROPDOWN ALINHADO */}
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
                        className="w-full text-left px-3 py-2 text-xs bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30 flex items-center justify-between gap-2"
                        onClick={() => {
                          // NOVO COMPORTAMENTO: Aplica o filtro de ID e fecha a busca
                          setSelectedOrderIdForSearch(order.id);
                          setIsSearchExpanded(false);
                          setSearchQuery("");
                          setPage(1); // Volta para a primeira página
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
      </div>

        {/* FILTER BAR – torna-se a “barra premium” */}
        <div className="sticky top-12 z-20 flex flex-col gap-3 rounded-2xl bg-black/40 border border-white/5 px-3 py-3 backdrop-blur-md md:flex-row md:items-center">
          {/* Países */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={activeFilter === 'ALL' ? 'default' : 'outline'}
              onClick={() => {
                setActiveFilter('ALL');
                setSelectedOrderIdForSearch(null);
                setPage(1);
              }}
              className={`
                h-8 rounded-full text-xs px-3 border-white/10 flex items-center gap-1.5
                ${activeFilter === 'ALL'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30'
                }
              `}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>ALL</span>

              {pendingCounts.ALL > 0 && activeFilter !== 'ALL' && (
                <span className="ml-1.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                  {pendingCounts.ALL}
                </span>
              )}
            </Button>
            <Button
              variant={activeFilter === 'PT' ? 'default' : 'outline'}
              onClick={() => {
                setActiveFilter('PT');
                setSelectedOrderIdForSearch(null);
                setPage(1);
              }}
              className={`
                h-8 rounded-full text-xs px-3 border-white/10 flex items-center gap-1.5
                ${activeFilter === 'PT'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30'
                }
              `}
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
              onClick={() => {
                setActiveFilter('DE');
                setSelectedOrderIdForSearch(null);
                setPage(1);
              }}
              className={`
                h-8 rounded-full text-xs px-3 border-white/10 flex items-center gap-1.5
                ${activeFilter === 'DE'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30'
                }
              `}
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
              onClick={() => {
                setActiveFilter('ES');
                setSelectedOrderIdForSearch(null);
                setPage(1);
              }}
              className={`
                h-8 rounded-full text-xs px-3 border-white/10 flex items-center gap-1.5
                ${activeFilter === 'ES'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30'
                }
              `}
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

        {/* Tabs como segmented control e Filtros Adicionais */} 
<div className="mt-2 flex flex-wrap items-center gap-2 md:mt-0 md:ml-auto">
    <div className="inline-flex items-center rounded-full bg-black/40 p-1 border border-white/5">
            <Button
          size="sm"
          onClick={() => { setOrderTab("pending"); setPage(1); }}
          className={`
            h-8 rounded-full px-4 text-xs transition-colors
            ${orderTab === "pending"
              ? "bg-purple-600 text-white hover:bg-purple-700"
              : "bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white" } `} >
          Pending ({pendingOrders.length})
        </Button>
        <Button
          size="sm"
          onClick={() => { setOrderTab("shipped"); setPage(1); }}
          className={`
            h-8 rounded-full px-4 text-xs transition-colors
            ${orderTab === "shipped"
              ? "bg-purple-600 text-white hover:bg-purple-700"
              : "bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white" } `} >
          Shipped ({shippedOrders.length})
        </Button>
    </div>

    {/* NOVO BOTÃO: Exibir Filtro de Pesquisa Ativo */}
    {selectedOrderIdForSearch && (
        <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-4 text-xs bg-purple-600 text-white border-purple-600 hover:bg-purple-500 hover:text-white active:bg-purple-700 active:scale-[0.98] transition-none"
            onClick={() => {
                setSelectedOrderIdForSearch(null); // Limpa o filtro
                setPage(1); // Reseta a paginação
                // O orderTab mantém-se
            }}
        >
            <X className="h-3.5 w-3.5 mr-2" />
            Showing: {selectedOrderIdForSearch}
        </Button>
    )}


    <div className="flex items-center gap-2">
        {/* BOTÃO DE EXPORT (Dropdown) */}
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8 rounded-full border-white/10 hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
                >
                    <Download className="h-4 w-4" />
                    <span className="sr-only">Export</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto bg-black/80 backdrop-blur-md border-white/10">
                <DropdownMenuItem 
                    onClick={handleExportPackingSheetPDF} 
                    className="text-sm font-medium focus:bg-purple-500/20 cursor-pointer"
                >
                    <Download className="mr-2 h-4 w-4" />
                    Export Current List (PDF)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>

        {/* Popover do Calendário (Filtro de Data) */}
        <Popover open={isDateFilterOpen} onOpenChange={setIsDateFilterOpen}>
            <PopoverTrigger asChild>
                <Button 
                    variant="outline" 
                    size="icon" 
                    className={`h-8 w-8 rounded-full border-white/10 ${isDateFilterOpen || isFilterActive ? 'bg-purple-600 text-white border-purple-600' : 'hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30'}`}
                >
                    <CalendarIcon className="h-4 w-4" />
                    <span className="sr-only">Date Filter</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-4 bg-black/80 backdrop-blur-md border-white/10 text-white" align="end">
                <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold">Date Filter</h3>
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Start Date</h4>
                        <div className="flex gap-2">
                            <Select value={startDate.day} onValueChange={(v) => setStartDate((p) => ({ ...p, day: v }))}>
                                <SelectTrigger className="w-[80px]"><SelectValue placeholder="Day" /></SelectTrigger>
                                <SelectContent>{DAYS.map((d) => (<SelectItem key={d} value={d.toString()}>{pad(d)}</SelectItem>))}</SelectContent>
                            </Select>
                            <Select value={startDate.month} onValueChange={(v) => setStartDate((p) => ({ ...p, month: v }))}>
                                <SelectTrigger className="w-[100px]"><SelectValue placeholder="Month" /></SelectTrigger>
                                <SelectContent>{MONTHS.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}</SelectContent>
                            </Select>
                            <Select value={startDate.year} onValueChange={(v) => setStartDate((p) => ({ ...p, year: v }))}>
                                <SelectTrigger className="w-[80px]"><SelectValue placeholder="Year" /></SelectTrigger>
                                <SelectContent>{YEARS.map((y) => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">End Date</h4>
                        <div className="flex gap-2">
                            <Select value={endDate.day} onValueChange={(v) => setEndDate((p) => ({ ...p, day: v }))}>
                                <SelectTrigger className="w-[80px]"><SelectValue placeholder="Day" /></SelectTrigger>
                                <SelectContent>{DAYS.map((d) => (<SelectItem key={d} value={d.toString()}>{pad(d)}</SelectItem>))}</SelectContent>
                            </Select>
                            <Select value={endDate.month} onValueChange={(v) => setEndDate((p) => ({ ...p, month: v }))}>
                                <SelectTrigger className="w-[100px]"><SelectValue placeholder="Month" /></SelectTrigger>
                                <SelectContent>{MONTHS.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}</SelectContent>
                            </Select>
                            <Select value={endDate.year} onValueChange={(v) => setEndDate((p) => ({ ...p, year: v }))}>
                                <SelectTrigger className="w-[80px]"><SelectValue placeholder="Year" /></SelectTrigger>
                                <SelectContent>{YEARS.map((y) => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    {/* FOOTER DO POPOVER COM OS BOTÕES */}
                    <div className="flex justify-between mt-2">
                        <Button 
                            onClick={handleResetDateFilter} 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs text-white/70 hover:bg-white/10"
                        >
                            <X className="h-3 w-3 mr-1" /> Reset Filter
                        </Button>
                        <Button 
                            onClick={() => setIsDateFilterOpen(false)} 
                            size="sm" 
                            className="text-xs"
                        >
                            Apply
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
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
                className="hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
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
                className="hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
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
                    shadow-lg p-3 hover:bg-purple-500/20 active:bg-purple-500/30 transition"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
    </>
  );
}