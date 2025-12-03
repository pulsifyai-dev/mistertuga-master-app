'use client';

import { useState, useEffect, useTransition } from 'react';
import Image from 'next/image';
import { useFirebase } from '@/firebase';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2, Database, Pencil, RotateCcw } from 'lucide-react';
import { collectionGroup, query, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { updateOrderDetails } from './actions';

// --- Type Definitions ---
type Product = { name: string; productId: string; customization: string; size: string; quantity: number; thumbnailUrl: string; version: string; };
type Customer = { name: string; address: string; phone: string; };
type Order = { id: string; country: string; countryCode: string; date: string; status: 'Pending Production' | 'Shipped'; customer: Customer; trackingNumber: string; items: Product[]; note?: string; };
type FirestoreOrder = Omit<Order, 'date' | 'items'> & { date: Timestamp | string; items?: Product[]; note?: string };

// --- Zod Schema for the Edit Modal ---
const editOrderSchema = z.object({
  customerName: z.string().min(1, 'Name is required'),
  customerAddress: z.string().min(1, 'Address is required'),
  customerPhone: z.string().min(1, 'Phone is required'),
  trackingNumber: z.string().optional(),
});
type EditOrderSchema = z.infer<typeof editOrderSchema>;

// --- Flag Components ---
const FlagPT = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15"><path fill="#006233" d="M0 0h8v15H0z"/><path fill="#D21034" d="M8 0h12v15H8z"/><circle cx="8" cy="7.5" r="2.5" fill="#FFE000"/><path fill="none" stroke="#D21034" strokeWidth="0.5" d="M8 5a2.5 2.5 0 000 5m-1.5-3.5h3"/></svg>;
const FlagDE = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15"><path fill="#000" d="M0 0h20v5H0z"/><path fill="#D00" d="M0 5h20v5H0z"/><path fill="#FFCE00" d="M0 10h20v5H0z"/></svg>;
const FlagES = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15"><path fill="#C60B1E" d="M0 0h20v3.75H0zM0 11.25h20V15H0z"/><path fill="#FFC400" d="M0 3.75h20v7.5H0z"/></svg>;
const countryFlags: { [key: string]: React.ReactNode } = { PT: <FlagPT />, DE: <FlagDE />, ES: <FlagES /> };

// --- Main Page Component ---
export default function MasterShopifyOrdersPage() {
  const { firestore, user, isUserLoading } = useFirebase();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [trackingNumbers, setTrackingNumbers] = useState<{ [key: string]: string }>({});
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isPending, startTransition] = useTransition();

  const { toast } = useToast();
  const form = useForm<EditOrderSchema>({ resolver: zodResolver(editOrderSchema) });

  useEffect(() => {
    if (editingOrder) {
      form.reset({
        customerName: editingOrder.customer.name,
        customerAddress: editingOrder.customer.address,
        customerPhone: editingOrder.customer.phone,
        trackingNumber: editingOrder.trackingNumber || '',
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
        const date = data.date instanceof Timestamp ? data.date.toDate().toISOString().split('T')[0] : String(data.date).split('T')[0];
        return { ...data, id: doc.id, date, items: data.items || [] } as Order;
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
      const result = await updateOrderDetails({ ...order, ...order.customer, customerName: order.customer.name, customerAddress: order.customer.address, customerPhone: order.customer.phone, trackingNumber });
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

  if (pageLoading || isUserLoading) return <div className="flex h-[400px] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <div className="text-center"><h1 className="font-headline text-2xl font-bold">Access Denied</h1><p>Please log in.</p></div>;

  const filteredOrders = activeFilter === 'ALL' ? orders : orders.filter(o => o.countryCode === activeFilter);
  const pendingOrders = filteredOrders.filter(o => o.status === 'Pending Production');
  const shippedOrders = filteredOrders.filter(o => o.status === 'Shipped');

  const renderOrderCard = (order: Order, isShipped = false) => (
    <Card key={order.id} className="bg-card">
      <CardHeader className="flex flex-row items-center justify-between bg-muted/30 p-4">
        <div className="flex items-center gap-2 font-semibold text-card-foreground">
          {countryFlags[order.countryCode]}<span>{order.id}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">{order.date}</div>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
        <div className="md:col-span-2 flex flex-col gap-4">
          {Array.isArray(order.items) && order.items.map((item, index) => (
            <div key={index} className="flex items-start gap-4">
              <Image src={item.thumbnailUrl || `https://placehold.co/80x80/e2e8f0/64748b?text=N/A`} alt={item.name} width={80} height={80} className="rounded-md" />
              <div className="text-sm">
                <p className="font-semibold">{item.name}</p>
                <p className="text-muted-foreground">ID: {item.productId}</p>
                <p className="text-muted-foreground">Customization: {item.customization}</p>
                <p className="text-muted-foreground">Size: {item.size}</p>
                <p className="text-muted-foreground">Qty: {item.quantity}</p>
                <p className="text-muted-foreground">Version: {item.version}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <div className="relative bg-muted/50 p-3 rounded-lg text-sm space-y-2">
            <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => handleOpenEditModal(order)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <h3 className="font-semibold mb-2">Customer Details</h3>
            <p>{order.customer.name}</p>
            <p className="text-muted-foreground whitespace-pre-line">{order.customer.address}</p>
            <p className="text-muted-foreground">{order.customer.phone}</p>
            {isShipped ? (
                <div className="flex items-center justify-between mt-2">
                    <p className="font-semibold">Tracking: <span className="font-normal text-primary">{order.trackingNumber}</span></p>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleResetTrackingNumber(order)}>
                        <RotateCcw className="h-4 w-4" /><span className="sr-only">Reset Tracking</span>
                    </Button>
                </div>
            ) : (
              <>
                <Separator className="my-2" />
                <div className="flex flex-col gap-2">
                    <Input type="text" placeholder="Número de rastreio" value={trackingNumbers[order.id] || ''} onChange={(e) => handleTrackingNumberChange(order.id, e.target.value)} />
                    <Button onClick={() => handleSubmitTrackingNumber(order)}>Submit</Button>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Order {editingOrder?.id}</DialogTitle>
            <DialogDescription>Update customer details and tracking information.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateOrder)} className="space-y-4 pt-4">
              <FormField control={form.control} name="customerName" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="customerAddress" render={({ field }) => <FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="customerPhone" render={({ field }) => <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="trackingNumber" render={({ field }) => <FormItem><FormLabel>Tracking</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-8">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Pedidos Shopify</h1>
          <p className="text-muted-foreground">Faça a gestão e acompanhe os seus pedidos Shopify aqui.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant={activeFilter === 'ALL' ? 'default' : 'outline'} onClick={() => setActiveFilter('ALL')}>ALL</Button>
          <Button variant={activeFilter === 'PT' ? 'default' : 'outline'} onClick={() => setActiveFilter('PT')}><FlagPT /> <span className="ml-2">Portugal</span></Button>
          <Button variant={activeFilter === 'DE' ? 'default' : 'outline'} onClick={() => setActiveFilter('DE')}><FlagDE /> <span className="ml-2">Germany</span></Button>
          <Button variant={activeFilter === 'ES' ? 'default' : 'outline'} onClick={() => setActiveFilter('ES')}><FlagES /> <span className="ml-2">Spain</span></Button>
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

        {pendingOrders.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold font-headline mb-4">Pending Production</h2>
            <div className="flex flex-col gap-4">{pendingOrders.map(order => renderOrderCard(order, false))}</div>
          </section>
        )}
        
        {pendingOrders.length > 0 && shippedOrders.length > 0 && <Separator />}

        {shippedOrders.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold font-headline mb-4">Shipped Orders</h2>
            <div className="flex flex-col gap-4">{shippedOrders.map(order => renderOrderCard(order, true))}</div>
          </section>
        )}
      </div>
    </>
  );
}
