'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { Exchange } from '../types';

const EXCHANGES_QUERY = `
  *,
  exchange_attachments (*),
  exchange_email_log (*)
`;

export function useExchanges() {
  const { user, loading: isUserLoading } = useAuth();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExchanges = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('exchanges')
      .select(EXCHANGES_QUERY)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching exchanges:', error);
      setLoading(false);
      return;
    }

    setExchanges((data as Exchange[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isUserLoading || !user) {
      setLoading(false);
      return;
    }

    fetchExchanges();

    // Realtime subscription
    const supabase = createClient();
    const channel = supabase
      .channel('exchanges-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exchanges' },
        () => {
          fetchExchanges();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isUserLoading, fetchExchanges]);

  return { exchanges, loading, user, isUserLoading };
}
