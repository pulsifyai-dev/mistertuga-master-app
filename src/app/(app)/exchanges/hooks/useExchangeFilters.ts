'use client';

import { useState, useMemo } from 'react';
import type { Exchange, ExchangeStatus } from '../types';
import { ITEMS_PER_PAGE } from '../types';

type SortField = 'created_at' | 'order_number' | 'customer_name' | 'status';
type SortDirection = 'asc' | 'desc';

export function useExchangeFilters(exchanges: Exchange[]) {
  const [statusFilter, setStatusFilter] = useState<'all' | ExchangeStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: exchanges.length };
    for (const ex of exchanges) {
      counts[ex.status] = (counts[ex.status] || 0) + 1;
    }
    return counts;
  }, [exchanges]);

  const filteredExchanges = useMemo(() => {
    let result = exchanges;

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((ex) => ex.status === statusFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (ex) =>
          (ex.order_number?.toLowerCase().includes(q)) ||
          ex.customer_name.toLowerCase().includes(q) ||
          (ex.customer_email?.toLowerCase().includes(q))
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      const cmp = String(valA).localeCompare(String(valB));
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [exchanges, statusFilter, searchQuery, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredExchanges.length / ITEMS_PER_PAGE));

  const paginatedExchanges = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredExchanges.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredExchanges, page]);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return exchanges
      .filter(
        (ex) =>
          (ex.order_number?.toLowerCase().includes(q)) ||
          ex.customer_name.toLowerCase().includes(q) ||
          (ex.customer_email?.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [exchanges, searchQuery]);

  // Reset page when filters change
  const handleStatusFilter = (status: 'all' | ExchangeStatus) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  return {
    statusFilter,
    searchQuery,
    page,
    sortField,
    sortDirection,
    statusCounts,
    filteredExchanges,
    paginatedExchanges,
    totalPages,
    searchMatches,
    setStatusFilter: handleStatusFilter,
    setSearchQuery: handleSearch,
    setPage,
    handleSort,
  };
}
