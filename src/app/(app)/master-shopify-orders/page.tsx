'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useFirebase } from '@/firebase';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Loader2, Database } from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type Product = {
  name: string;
  productId: string;
  customization: string;
  size: string;
  quantity: number;
  thumbnailUrl: string;
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
  date: string;
  status: 'Pending Production' | 'Shipped';
  customer: Customer;
  trackingNumber: string;
  items: Product[];
};

// SVG Flag Components
const FlagPT = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15"><path fill="#006233" d="M0 0h8v15H0z"/><path fill="#D21034" d="M8 0h12v15H8z"/><circle cx="8" cy="7.5" r="2.5" fill="#FFE000"/><path fill="none" stroke="#D21034" stroke-width="0.5" d="M8 5a2.5 2.5 0 000 5m-1.5-3.5h3"/></svg>;
const FlagDE = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15"><path fill="#000" d="M0 0h20v5H0z"/><path fill="#D00" d="M0 5h20v5H0z"/><path fill="#FFCE00" d="M0 10h20v5H0z"/></svg>;
const FlagES = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 20 15"><path fill="#C60B1E" d="M0 0h20v3.75H0zM0 11.25h20V15H0z"/><path fill="#FFC400" d="M0 3.75h20v7.5H0z"/></svg>;


const countryFlags: { [key: string]: React.ReactNode } = {
  PT: <FlagPT />,
  DE: <FlagDE />,
  ES: <FlagES />,
};

const mockOrdersForSeeding: Omit<Order, 'id'>[] = [
    {
      country: "Portugal",
      countryCode: "PT",
      date: "2024-05-20",
      status: "Pending Production",
      customer: { name: "João Silva", address: "Rua das Flores 123, Lisboa", phone: "+351 912 345 678" },
      trackingNumber: "",
      items: [
        { name: "Caneca Personalizada", productId: "PROD-001", customization: "Foto de um gato", size: "11oz", quantity: 1, thumbnailUrl: "https://picsum.photos/seed/cup/80/80" },
      ],
    },
    {
      country: "Germany",
      countryCode: "DE",
      date: "2024-05-19",
      status: "Pending Production",
      customer: { name: "Hans Müller", address: "Musterstraße 1, Berlin", phone: "+49 176 12345678" },
      trackingNumber: "",
      items: [
        { name: "T-Shirt 'Eu Amo Berlim'", productId: "PROD-002", customization: "N/A", size: "L", quantity: 2, thumbnailUrl: "https://picsum.photos/seed/shirt/80/80" },
      ],
    },
    {
      country: "Spain",
      countryCode: "ES",
      date: "2024-05-18",
      status: "Shipped",
      customer: { name: "Maria García", address: "Calle Mayor 5, Madrid", phone: "+34 600 123 456" },
      trackingNumber: "ES123456789",
      items: [
        { name: "Almofada com Nome", productId: "PROD-003", customization: "'Sofia'", size: "40x40cm", quantity: 1, thumbnailUrl: "https://picsum.photos/seed/pillow/80/80" },
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

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      setPageLoading(false);
      return;
    }

    const ordersCollection = collection(firestore, 'users', user.uid, 'orders');
    const q = query(ordersCollection);

    setPageLoading(true);
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const userOrders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(userOrders);
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
        const ordersCollectionRef = collection(firestore, 'users', user.uid, 'orders');

        mockOrdersForSeeding.forEach((orderData, index) => {
            const countryCode = orderData.countryCode;
            const newId = `${countryCode}#101${index + 4}`;
            const docRef = doc(ordersCollectionRef, newId);
            batch.set(docRef, orderData);
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

  const handleSubmitTrackingNumber = (orderId: string) => {
    if (!user) return;
    const trackingNumber = trackingNumbers[orderId];
    if (!trackingNumber) {
      alert("Please enter a tracking number.");
      return;
    }

    const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);
    const updatedData = {
      trackingNumber: trackingNumber,
      status: 'Shipped' as const,
    };

    updateDoc(orderRef, updatedData)
      .then(() => {
        console.log(`Successfully updated tracking number for order ${orderId}`);
        setTrackingNumbers(prev => {
          const newTrackingNumbers = { ...prev };
          delete newTrackingNumbers[orderId];
          return newTrackingNumbers;
        });
      })
      .catch((error) => {
        const contextualError = new FirestorePermissionError({
          path: orderRef.path,
          operation: 'update',
          requestResourceData: updatedData,
        });
        errorEmitter.emit('permission-error', contextualError);
        console.error(`Error updating tracking number for order ${orderId}:`, error);
        alert("Failed to update tracking number. Check console for details.");
      });
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
                  {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2" />}
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
                    <div className="text-sm text-muted-foreground">{order.date}</div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
                    <div className="md:col-span-2 flex flex-col gap-4">
                      {order.items.map((item, index) => (
                        <div key={index} className="flex items-start gap-4">
                          <Image src={item.thumbnailUrl} alt={item.name} width={80} height={80} className="rounded-md" />
                          <div className="text-sm">
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-muted-foreground">ID: {item.productId}</p>
                            <p className="text-muted-foreground">Customization: {item.customization}</p>
                            <p className="text-muted-foreground">Size: {item.size}</p>
                            <p className="text-muted-foreground">Qty: {item.quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col justify-between gap-4">
                       <div className="bg-muted/50 p-3 rounded-lg text-sm">
                        <h3 className="font-semibold mb-2">Customer Details</h3>
                        <p>{order.customer.name}</p>
                        <p className="text-muted-foreground">{order.customer.address}</p>
                        <p className="text-muted-foreground">{order.customer.phone}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                         <Input
                            type="text"
                            placeholder="Número de rastreio"
                            value={trackingNumbers[order.id] || ''}
                            onChange={(e) => handleTrackingNumberChange(order.id, e.target.value)}
                          />
                         <Button onClick={() => handleSubmitTrackingNumber(order.id)}>Submit</Button>
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
                    <div className="text-sm text-muted-foreground">{order.date}</div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
                     <div className="md:col-span-2 flex flex-col gap-4">
                      {order.items.map((item, index) => (
                        <div key={index} className="flex items-start gap-4">
                          <Image src={item.thumbnailUrl} alt={item.name} width={80} height={80} className="rounded-md" />
                          <div className="text-sm">
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-muted-foreground">ID: {item.productId}</p>
                            <p className="text-muted-foreground">Customization: {item.customization}</p>
                            <p className="text-muted-foreground">Size: {item.size}</p>
                            <p className="text-muted-foreground">Qty: {item.quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                     <div className="bg-muted/50 p-3 rounded-lg text-sm self-start">
                        <h3 className="font-semibold mb-2">Customer Details</h3>
                        <p>{order.customer.name}</p>
                        <p className="text-muted-foreground">{order.customer.address}</p>
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
  );
}
