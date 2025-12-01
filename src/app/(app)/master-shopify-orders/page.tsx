'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

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

const mockUserOrders = {
  userId: "DUMMY_USER_ID_12345",
  orders: [
    {
      id: 'DE#1014',
      country: 'Germany',
      countryCode: 'DE',
      date: '2024-05-20',
      status: 'Pending Production',
      customer: {
        name: 'Klaus Mueller',
        address: 'Berliner Str. 123, 10115 Berlin',
        phone: '+49 123 4567890',
      },
      trackingNumber: '',
      items: [
        {
          name: 'Custom T-Shirt',
          productId: 'TS-001',
          customization: 'Logo "Alpha"',
          size: 'L',
          quantity: 1,
          thumbnailUrl: 'https://picsum.photos/seed/a1/100/100',
        },
      ],
    },
    {
      id: 'PT#2045',
      country: 'Portugal',
      countryCode: 'PT',
      date: '2024-05-18',
      status: 'Shipped',
      customer: {
        name: 'Ana Silva',
        address: 'Rua da Prata 55, 1100-420 Lisboa',
        phone: '+351 912 345 678',
      },
      trackingNumber: 'LP123456789PT',
      items: [
        {
          name: 'Personalized Mug',
          productId: 'MG-002',
          customization: 'Photo "Family"',
          size: '11oz',
          quantity: 2,
          thumbnailUrl: 'https://picsum.photos/seed/b1/100/100',
        },
      ],
    },
    {
      id: 'ES#3001',
      country: 'Spain',
      countryCode: 'ES',
      date: '2024-05-21',
      status: 'Pending Production',
      customer: {
        name: 'Carlos Ruiz',
        address: 'Calle Mayor 10, 28013 Madrid',
        phone: '+34 612 345 678',
      },
      trackingNumber: '',
      items: [
        {
          name: 'Engraved Pen',
          productId: 'PN-005',
          customization: '"C.R."',
          size: 'N/A',
          quantity: 1,
          thumbnailUrl: 'https://picsum.photos/seed/c1/100/100',
        },
        {
          name: 'Custom Notebook',
          productId: 'NB-003',
          customization: 'Cover Art "Mountains"',
          size: 'A5',
          quantity: 1,
          thumbnailUrl: 'https://picsum.photos/seed/d1/100/100',
        },
      ],
    },
  ]
};

const countryFlags: { [key: string]: React.ReactNode } = {
  PT: <FlagPT />,
  DE: <FlagDE />,
  ES: <FlagES />,
};


export default function MasterShopifyOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [trackingNumbers, setTrackingNumbers] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!authLoading && user) {
      // Simulate fetching data for the logged-in user
      // In a real scenario, this would be a Firestore query
      // e.g., firestore.collection('users').doc(user.uid).collection('orders').get()
      setOrders(mockUserOrders.orders);
      setPageLoading(false);
    } else if (!authLoading && !user) {
      // Handle case where there is no user
      setPageLoading(false);
    }
  }, [user, authLoading]);

  const handleTrackingNumberChange = (orderId: string, value: string) => {
    setTrackingNumbers(prev => ({ ...prev, [orderId]: value }));
  };

  const handleSubmitTrackingNumber = (orderId: string) => {
    const trackingNumber = trackingNumbers[orderId];
    if (!trackingNumber) {
      alert("Please enter a tracking number.");
      return;
    }
    console.log(`Submitting tracking number ${trackingNumber} for order ${orderId} for user ${user?.uid}`);
    // Here you would typically update Firestore
    // For now, we'll just log it and maybe update the local state to move the order
    // For a better UX, you'd show a loading state on the button and then refetch/update data
  };

  if (pageLoading || authLoading) {
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
      
      {/* Pending Production Section */}
      <section>
        <h2 className="text-xl font-semibold font-headline mb-4">Pending Production</h2>
        <div className="flex flex-col gap-4">
          {pendingOrders.length > 0 ? (
            pendingOrders.map(order => (
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
            ))
          ) : (
            <p className="text-muted-foreground">No pending orders found for the selected filter.</p>
          )}
        </div>
      </section>
      
      <Separator />

      {/* Shipped Orders Section */}
      <section>
        <h2 className="text-xl font-semibold font-headline mb-4">Shipped Orders</h2>
        <div className="flex flex-col gap-4">
           {shippedOrders.length > 0 ? (
            shippedOrders.map(order => (
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
            ))
          ) : (
            <p className="text-muted-foreground">No shipped orders found for the selected filter.</p>
          )}
        </div>
      </section>

    </div>
  );
}
