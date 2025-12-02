'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useFirebase } from '@/firebase';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2, Database, Pencil } from 'lucide-react';
import { collectionGroup, query, onSnapshot, doc, updateDoc, writeBatch, Timestamp, getDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';

type Product = {
  name: string;
  productId: string;
  customization: string;
  size: string;
  quantity: number;
  thumbnailUrl: string;
  version: string;
};

type Customer = {
  name: string;
  address: string;
  phone: string;
};

type Order = {
  id: string;
  country: string;
  countryCode: string;
  date: string; // Keeping as string for rendering
  status: 'Pending Production' | 'Shipped';
  customer: Customer;
  trackingNumber: string;
  items: Product[];
};

// Raw type from Firestore, where date can be a Timestamp
type FirestoreOrder = Omit<Order, 'date' | 'items'> & { date: Timestamp | string; items?: Product[] };


const editOrderSchema = z.object({
  customerName: z.string().min(1, 'Name is required'),
  customerAddress: z.string().min(1, 'Address is required'),
  customerPhone: z.string().min(1, 'Phone is required'),
  trackingNumber: z.string().optional(),
});
type EditOrderSchema = z.infer<typeof editOrderSchema>;

// SVG Flag Components
const FlagPT = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15"><path fill="#006233" d="M0 0h8v15H0z"/><path fill="#D21034" d="M8 0h12v15H8z"/><circle cx="8" cy="7.5" r="2.5" fill="#FFE000"/><path fill="none" stroke="#D21034" strokeWidth="0.5" d="M8 5a2.5 2.5 0 000 5m-1.5-3.5h3"/></svg>;
const FlagDE = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15"><path fill="#000" d="M0 0h20v5H0z"/><path fill="#D00" d="M0 5h20v5H0z"/><path fill="#FFCE00" d="M0 10h20v5H0z"/></svg>;
const FlagES = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15"><path fill="#C60B1E" d="M0 0h20v3.75H0zM0 11.25h20V15H0z"/><path fill="#FFC400" d="M0 3.75h20v7.5H0z"/></svg>;


const countryFlags: { [key: string]: React.ReactNode } = {
  PT: <FlagPT />,
  DE: <FlagDE />,
  ES: <FlagES />,
};

const mockOrdersForSeeding = [
    {
      country: "Portugal",
      countryCode: "PT",
      date: new Date("2024-05-20"),
      status: "Pending Production",
      customer: { name: "João Silva", address: "Rua das Flores 123, Lisboa", phone: "+351912345678" },
      trackingNumber: "",
      items: [
        { name: "Caneca Personalizada", productId: "PROD-001", customization: "Foto de um gato", size: "11oz", quantity: 1, thumbnailUrl: "https://cdn.shopify.com/s/files/1/0925/7972/5693/files/FullSizeRender_bf3a04cc-2b0e-4c0f-8e01-057d4926999b.jpg?v=1764020613", version: "1.0" },
      ],
    },
    {
      country: "Germany",
      countryCode: "DE",
      date: new Date("2024-05-19"),
      status: "Pending Production",
      customer: { name: "Hans Müller", address: "Musterstraße 1, Berlin", phone: "+4917612345678" },
      trackingNumber: "",
      items: [
        { name: "T-Shirt 'Eu Amo Berlim'", productId: "PROD-002", customization: "N/A", size: "L", quantity: 2, thumbnailUrl: "https://picsum.photos/seed/shirt/80/80", version: "1.2" },
      ],
    },
    {
      country: "Spain",
      countryCode: "ES",
      date: new Date("2024-05-18"),
      status: "Shipped",
      customer: { name: "Maria García", address: "Calle Mayor 5, Madrid", phone: "+34600123456" },
      trackingNumber: "ES123456789",
      items: [
        { name: "Almofada com Nome", productId: "PROD-003", customization: "'Sofia'", size: "40x40cm", quantity: 1, thumbnailUrl: "https://picsum.photos/seed/pillow/80/80", version: "2.0" },
      ],
    },
];

export default function MasterShopifyOrdersPage() {
  const { firestore, user, isUserLoading } = useFirebase();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [trackingNumbers, setTrackingNumbers] = useState<{ [key: string]: string }>({});
  const [isSeeding, setIsSeeding] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const form = useForm<EditOrderSchema>({
    resolver: zodResolver(editOrderSchema),
  });

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
    if (isUserLoading || !firestore) return;
    if (!user) {
      setPageLoading(false);
      return;
    }

    const ordersCollectionGroup = collectionGroup(firestore, 'orders');
    const q = query(ordersCollectionGroup);

    setPageLoading(true);
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const allOrders = querySnapshot.docs.map(doc => {
        const data = doc.data() as FirestoreOrder;
        let dateString = '';
        if (data.date) {
            if (data.date instanceof Timestamp) {
                dateString = data.date.toDate().toISOString().split('T')[0];
            } else if (typeof data.date === 'string') {
                dateString = data.date.split('T')[0];
            }
        }
        return { ...data, id: doc.id, date: dateString, items: data.items || [] } as Order;
      });
      setOrders(allOrders);
      setPageLoading(false);
    }, (error) => {
      console.error("Error fetching orders: ", error);
      setPageLoading(false);
    });

    return () => unsubscribe();
  }, [user, isUserLoading, firestore]);

  const handleTrackingNumberChange = (orderId: string, value: string) => {
    setTrackingNumbers(prev => ({ ...prev, [orderId]: value }));
  };
  
  const seedDatabase = async () => {
    if (!user || !firestore) {
        alert("You must be logged in to seed the database.");
        return;
    }
    setIsSeeding(true);
    try {
        const batch = writeBatch(firestore);
        
        mockOrdersForSeeding.forEach((orderData, index) => {
            const countryCode = orderData.countryCode;
            const newId = `${countryCode}#101${index + 4}`;
            // Correct path: /orders/{countryCode}/orders/{orderId}
            const docRef = doc(firestore, 'orders', countryCode, 'orders', newId);
            batch.set(docRef, {
                ...orderData,
                customer: {
                    ...orderData.customer,
                    phone: orderData.customer.phone.replace(/\s/g, ''),
                }
            });
        });

        await batch.commit();
        console.log("Database seeded successfully!");
    } catch (error) {
        console.error("Error seeding database: ", error);
        alert("Failed to seed database. Check console for details.");
    } finally {
        setIsSeeding(false);
    }
  };

  const handleOpenEditModal = (order: Order) => {
    setEditingOrder(order);
    setIsEditModalOpen(true);
  };

  const handleUpdateOrder = async (data: EditOrderSchema) => {
    if (!user || !editingOrder || !firestore) return;
    
    // Correct path: /orders/{countryCode}/orders/{orderId}
    const orderRef = doc(firestore, 'orders', editingOrder.countryCode, 'orders', editingOrder.id);
    const updatedData: Partial<Order> = {
      customer: {
        ...editingOrder.customer,
        name: data.customerName,
        address: data.customerAddress,
        phone: data.customerPhone.replace(/\s/g, ''),
      },
    };

    if(data.trackingNumber) {
        updatedData.trackingNumber = data.trackingNumber;
        if(editingOrder.status === 'Pending Production') {
            updatedData.status = 'Shipped';
        }
    }

    updateDoc(orderRef, updatedData)
      .then(() => {
        console.log(`Successfully updated order ${editingOrder.id}`);
        setIsEditModalOpen(false);
        setEditingOrder(null);
      })
      .catch((error) => {
        const contextualError = new FirestorePermissionError({
          path: orderRef.path,
          operation: 'update',
          requestResourceData: updatedData,
        });
        errorEmitter.emit('permission-error', contextualError);
        console.error(`Error updating order ${editingOrder.id}:`, error);
        alert("Failed to update order. Check console for details.");
      });
  };

  const handleSubmitTrackingNumber = async (order: Order) => {
    if (!user || !firestore) return;
    const trackingNumber = trackingNumbers[order.id];
    if (!trackingNumber) {
      alert("Please enter a tracking number.");
      return;
    }

    const orderRef = doc(firestore, 'orders', order.countryCode, 'orders', order.id);
    const updatedData = {
      trackingNumber: trackingNumber,
      status: 'Shipped' as const,
    };

    try {
        await updateDoc(orderRef, updatedData);
        console.log(`Successfully updated tracking number for order ${order.id}`);

        // Send to webhook
        const settingsRef = doc(firestore, "settings", "tracking");
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists() && settingsSnap.data()?.url) {
            const webhookUrl = settingsSnap.data().url;
            const payload = {
                order_id: order.id,
                order_name: order.items.length > 0 ? order.items[0].name : "N/A",
                trackingNumber: trackingNumber,
            };

            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            console.log(`Webhook sent for order ${order.id}`);
        }

        setTrackingNumbers(prev => {
            const newTrackingNumbers = { ...prev };
            delete newTrackingNumbers[order.id];
            return newTrackingNumbers;
        });

    } catch (error) {
        const contextualError = new FirestorePermissionError({
            path: orderRef.path,
            operation: 'update',
            requestResourceData: updatedData,
        });
        errorEmitter.emit('permission-error', contextualError);
        console.error(`Error updating tracking number for order ${order.id}:`, error);
        alert("Failed to update tracking number. Check console for details.");
    }
  };

  if (pageLoading || isUserLoading) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center">
        <h1 className="font-headline text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">Please log in to view your orders.</p>
      </div>
    )
  }

  const filteredOrders = activeFilter === 'ALL'
    ? orders
    : orders.filter(order => order.countryCode === activeFilter);

  const pendingOrders = filteredOrders.filter(order => order.status === 'Pending Production');
  const shippedOrders = filteredOrders.filter(order => order.status === 'Shipped');

  return (
    <>
    <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Order {editingOrder?.id}</DialogTitle>
            <DialogDescription>
              Update customer details and tracking information. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateOrder)} className="space-y-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Address</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="trackingNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tracking Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={editingOrder?.status === 'Shipped' ? 'Cannot change shipped tracking number' : 'Enter tracking number'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancel</Button>
                  </DialogClose>
                  <Button type="submit">Save Changes</Button>
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
                  <p className="text-sm text-muted-foreground">Clique no botão abaixo para preencher com dados de exemplo.</p>
              </div>
              <Button onClick={seedDatabase} disabled={isSeeding}>
                  {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                  {isSeeding ? 'Aguarde...' : 'Adicionar Dados de Exemplo'}
              </Button>
          </Card>
      )}

      {/* Pending Production Section */}
      {pendingOrders.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold font-headline mb-4">Pending Production</h2>
          <div className="flex flex-col gap-4">
            {pendingOrders.map(order => (
                <Card key={order.id} className="bg-card">
                  <CardHeader className="flex flex-row items-center justify-between bg-muted/30 p-4">
                    <div className="flex items-center gap-2 font-semibold text-card-foreground">
                      {countryFlags[order.countryCode]}
                      <span>{order.id}</span>
                    </div>
                     <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">{order.date}</div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenEditModal(order)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
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
                       <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-2">
                        <h3 className="font-semibold mb-2">Customer Details</h3>
                        <p>{order.customer.name}</p>
                        <p className="text-muted-foreground whitespace-pre-line">{order.customer.address}</p>
                        <p className="text-muted-foreground">{order.customer.phone}</p>
                        <Separator className="my-2" />
                        <div className="flex flex-col gap-2">
                            <Input
                                type="text"
                                placeholder="Número de rastreio"
                                value={trackingNumbers[order.id] || ''}
                                onChange={(e) => handleTrackingNumberChange(order.id, e.target.value)}
                            />
                            <Button onClick={() => handleSubmitTrackingNumber(order)}>Submit</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>
      )}
      
      {pendingOrders.length > 0 && shippedOrders.length > 0 && <Separator />}

      {/* Shipped Orders Section */}
      {shippedOrders.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold font-headline mb-4">Shipped Orders</h2>
          <div className="flex flex-col gap-4">
             {shippedOrders.map(order => (
                <Card key={order.id} className="bg-card">
                   <CardHeader className="flex flex-row items-center justify-between bg-muted/30 p-4">
                    <div className="flex items-center gap-2 font-semibold text-card-foreground">
                      {countryFlags[order.countryCode]}
                      <span>{order.id}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground">{order.date}</div>
                       <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenEditModal(order)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
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
                     <div className="bg-muted/50 p-3 rounded-lg text-sm self-start">
                        <h3 className="font-semibold mb-2">Customer Details</h3>
                        <p>{order.customer.name}</p>
                        <p className="text-muted-foreground whitespace-pre-line">{order.customer.address}</p>
                        <p className="text-muted-foreground">{order.customer.phone}</p>
                        <p className="font-semibold mt-2">Tracking: <span className="font-normal text-primary">{order.trackingNumber}</span></p>
                      </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>
      )}

    </div>
    </>
  );
}
