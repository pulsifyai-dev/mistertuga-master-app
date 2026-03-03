'use client';

import { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { collectionGroup, query, onSnapshot, Timestamp } from 'firebase/firestore';
import type { Order, FirestoreOrder, Customer } from '../types';

export function useOrders() {
  const { firestore } = useFirebase();
  const { user, loading: isUserLoading } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading || !firestore || !user) {
      setPageLoading(false);
      return;
    }

    const q = query(collectionGroup(firestore, 'orders'));
    setPageLoading(true);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allOrders = snapshot.docs.map((doc) => {
          const data = doc.data() as FirestoreOrder;

          let finalDate = '';
          if (data.date instanceof Timestamp) {
            const d = data.date.toDate();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            finalDate = `${yyyy}-${mm}-${dd} | ${hh}:${min} PT`;
          } else {
            const raw = String(data.date);
            const timeMatch = raw.match(/\d{1,2}:\d{2}/);
            const time = timeMatch ? timeMatch[0] : '';
            const parsed = new Date(raw);
            if (!isNaN(parsed.getTime())) {
              const yyyy = parsed.getFullYear();
              const mm = String(parsed.getMonth() + 1).padStart(2, '0');
              const dd = String(parsed.getDate()).padStart(2, '0');
              finalDate = `${yyyy}-${mm}-${dd}${time ? ` | ${time} PT` : ''}`;
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

        const sortedOrders = allOrders.sort((a, b) => {
          const dateA = new Date(a.date.replace(' | ', ' ').replace(' PT', '')).getTime();
          const dateB = new Date(b.date.replace(' | ', ' ').replace(' PT', '')).getTime();
          return dateA - dateB;
        });

        setOrders(sortedOrders);
        setPageLoading(false);
      },
      (error) => {
        console.error('Error fetching orders: ', error);
        setPageLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isUserLoading, firestore]);

  return { orders, pageLoading, isUserLoading, user, firestore };
}
