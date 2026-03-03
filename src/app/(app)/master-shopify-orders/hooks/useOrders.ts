'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';
import type { Order, Product, Customer } from '../types';

// Supabase row types (from normalized schema)
interface SupabaseOrderRow {
  id: string;
  order_number: string;
  country_code: string;
  status: string;
  fulfillment_status: string;
  tracking_number: string | null;
  note: string | null;
  shopify_created_at: string | null;
  created_at: string;
  shipping_address: Record<string, unknown> | null;
  customers: {
    name: string;
    phone: string | null;
    address_line1: string | null;
    city: string | null;
    postal_code: string | null;
    country_code: string | null;
  } | null;
  order_items: {
    product_name: string;
    shopify_line_item_id: string | null;
    customization: string | null;
    size: string | null;
    quantity: number;
    thumbnail_url: string | null;
    version: string | null;
  }[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} | ${hh}:${min} PT`;
}

function buildAddress(row: SupabaseOrderRow): string {
  // Try shipping_address JSON first (richer data)
  const sa = row.shipping_address as Record<string, string> | null;
  if (sa) {
    const parts = [sa.address1, sa.address2, sa.city, sa.zip, sa.province, sa.country].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }
  // Fallback to customer table
  const c = row.customers;
  if (!c) return '';
  const parts = [c.address_line1, c.city, c.postal_code].filter(Boolean);
  return parts.join(', ');
}

function mapStatus(status: string, trackingNumber: string | null): 'Pending Production' | 'Shipped' {
  if (status === 'fulfilled' || (trackingNumber && trackingNumber.trim() !== '')) {
    return 'Shipped';
  }
  return 'Pending Production';
}

function mapRow(row: SupabaseOrderRow): Order {
  const customer: Customer = {
    name: row.customers?.name || '',
    address: buildAddress(row),
    phone: row.customers?.phone || '',
  };

  const items: Product[] = (row.order_items || []).map((item) => ({
    name: item.product_name || '',
    productId: item.shopify_line_item_id || '',
    customization: item.customization || '',
    size: item.size || '',
    quantity: item.quantity || 0,
    thumbnailUrl: item.thumbnail_url || '',
    version: item.version || '',
  }));

  return {
    id: row.order_number,
    country: row.country_code,
    countryCode: row.country_code,
    date: formatDate(row.shopify_created_at || row.created_at),
    status: mapStatus(row.status, row.tracking_number),
    customer,
    trackingNumber: row.tracking_number || '',
    items,
    note: row.note || undefined,
    supabaseId: row.id,
  };
}

const ORDERS_QUERY = `
  id,
  order_number,
  country_code,
  status,
  fulfillment_status,
  tracking_number,
  note,
  shopify_created_at,
  created_at,
  shipping_address,
  customers (
    name,
    phone,
    address_line1,
    city,
    postal_code,
    country_code
  ),
  order_items (
    product_name,
    shopify_line_item_id,
    customization,
    size,
    quantity,
    thumbnail_url,
    version
  )
`;

export function useOrders() {
  const { user, loading: isUserLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('orders')
      .select(ORDERS_QUERY)
      .is('deleted_at', null)
      .order('shopify_created_at', { ascending: true });

    if (error) {
      console.error('Error fetching orders:', error);
      setPageLoading(false);
      return;
    }

    const mapped = (data as unknown as SupabaseOrderRow[]).map(mapRow);
    setOrders(mapped);
    setPageLoading(false);
  }, []);

  useEffect(() => {
    if (isUserLoading || !user) {
      setPageLoading(false);
      return;
    }

    fetchOrders();

    // Subscribe to Realtime changes on orders table
    const supabase = createClient();
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          // Re-fetch all orders on any change (INSERT, UPDATE, DELETE)
          // This is simpler and more reliable than patching individual rows
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isUserLoading, fetchOrders]);

  return { orders, pageLoading, isUserLoading, user };
}
